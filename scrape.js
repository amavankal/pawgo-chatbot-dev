/**
 * ASSUMES: a file called sources.json exists w/ a url property that
 *  stores an array of urls. (and ofc, you've got libraries installed)
 *
 * this is very very very messy and probably terrible. it is a proof of
 *   concept, so there are probably many silly silly things happening..
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import url from "node:url";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { format } from "prettier";

const DEBUG = true; // change if U don't want FETCHED_HTML to be generated
const DEBUG_DIR = "output/FETCHED_HTML";
const RESULTS_FILE = "output/OUTPUT.json";

const results = []; // { url: string, textContent: string }

// 1: read urls from sources.json
let urls;
try {
  urls = JSON.parse(await readFile("./sources.json")).urls;
  //console.log("URLS:\n" + urls.join("\n"));
} catch (err) {
  console.log(err);
}

// create output directory
mkdir("./output/", { recursive: true });

// 1.5: create a directory for fetched html (for debugging inspection)
if (DEBUG) {
  try {
    await mkdir(`./${DEBUG_DIR}/`, { recursive: true });
  } catch (err) {
    if (err.code !== "EEXIST") console.log(err);
  }
}

// 2: process sources
for (let source of urls) {
  let urlObj = new URL(source);

  // fetch from source + get html
  const response = await fetch(urlObj);

  // verify content type - if not HTML oof
  if (!response.headers.get("content-type").includes("text/html")) {
    console.log("Response type was not HTML. Moving on...\n");
    continue;
  }

  // verify status - if not success (2xx), oof.. likely to get some 403: FORBIDDENs here
  if (response.status < 200 || response.status > 299) {
    console.log(
      `Failed to fetch from ${source}; code: ${response.status}\nMoving on...\n`,
    );
    continue;
  }

  // get html from response
  let text = await response.text();
  let html = text;

  if (DEBUG) {
    // try to format the html for our eyes if debugging is on
    // if it fails (which it does sometimes), oh well
    try {
      html = await format(text, {
        parser: "html",
      });
    } catch (err) {
      console.log(
        `Something went wrong when formatting ${source}. going on...`,
      );
    }

    // write to debugging file
    try {
      await writeFile(
        `./${DEBUG_DIR}/${(urlObj.hostname + urlObj.pathname).replace(/[./]/g, "-") + ".html"}`,
        html,
      );
    } catch (err) {
      console.log("Error writing to debug file: " + err);
    }
  }

  // convert html to DOM object
  const { document } = new JSDOM(html).window;

  // get a readability object, and output to a file
  let article = new Readability(document).parse();
  console.log("SUCCESS! for: " + source + "\n");

  // add source url + text content to results
  // get rid of all the silly spaces in text content w/ replace + RegEx
  // the space fixing is iffy
  results.push({
    url: source,
    textContent: article.textContent.replace(/\s+/g, " "),
  });
}

// print results (uncomment to print... it's long which is why commented out)
/*
console.log(
  "RESULTS:\n" +
    results
      .map(
        (result) => "URL: " + result.url + "\nCONTENT:\n" + result.textContent,
      )
      .join("\n\n"),
);
*/

// write results to a file
try {
  writeFile(
    `./${RESULTS_FILE}`,
    await format(JSON.stringify(results), { parser: "json" }),
  );
} catch (err) {
  console.log("Error writing to output: " + err);
}
