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
const OUTPUT_DIR = "../output/";
const DEBUG_DIR = OUTPUT_DIR + "FETCHED_HTML/";
const RESULTS_FILE = OUTPUT_DIR + "OUTPUT.json";
const SOURCES = "./input/sources.json";

// (url: string, title: string, blocks: { type: string, text: string }[])
const results = [];

// 1: read urls from sources.json
let urls;
try {
  urls = JSON.parse(await readFile(SOURCES)).urls;
  //console.log("URLS:\n" + urls.join("\n"));
} catch (err) {
  console.log(err);
}

// create output directory
await mkdir(OUTPUT_DIR, { recursive: true });

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
  const article = new Readability(document).parse();

  // skip pages where Readability could not find an article
  if (!article) {
    console.log(`Could not extract an article from: ${source}\n`);
    continue;
  }

  // report success only after confirming an article was found
  console.log("SUCCESS! for: " + source + "\n");

  // parse Readability's selected article HTML so cleanup can use page structure
  const articleDocument = new JSDOM(article.content).window.document;

  // remove standard page navigation and footer areas across sites
  articleDocument
    .querySelectorAll("nav, [role='navigation'], footer, [role='contentinfo']")
    .forEach((element) => element.remove());

  // remove common non-article sections when sites label them in their HTML
  articleDocument
    .querySelectorAll(
      "[class*='breadcrumb'], [id*='breadcrumb'], [class*='social-share'], [class*='related-post'], [class*='newsletter']",
    )
    .forEach((element) => element.remove());

  // remove links that the text is a page control, like “Skip to content” or “Go to top”
  articleDocument.querySelectorAll("a").forEach((link) => {
    const label = link.textContent.replace(/\s+/g, " ").trim().toLowerCase();
    if (/^(skip to (main )?content|go to top|back to top|back to the top)$/.test(label)) {
      const container = link.closest("li, p");
      link.remove();
      if (container && !container.textContent.trim()) container.remove();
    }
  });

  // collect article headings and text blocks in their original order
  const blocks = [
    ...articleDocument.querySelectorAll(
      "h1, h2, h3, h4, h5, h6, p, li, blockquote",
    ),
  ]
    .map((element) => ({
      type: element.tagName.toLowerCase(),
      text: element.textContent.replace(/\s+/g, " ").trim(),
    }))
    .filter((block) => block.text);

  // save the source and the cleaned and ordered blocks
  results.push({
    url: source,
    title: article.title,
    blocks,
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
    `${RESULTS_FILE}`,
    await format(JSON.stringify(results), { parser: "json" }),
  );
} catch (err) {
  console.log("Error writing to output: " + err);
}
