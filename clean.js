import { readFile, writeFile } from "node:fs/promises";

const INPUT_FILE = "./output/OUTPUT.json";
const OUTPUT_FILE = "./output/cleaned_articles.json";

// Exact page-control labels to skip; article wording is otherwise preserved.
const BOILERPLATE = new Set([
  "skip to content",
  "skip to main content",
  "go to top",
  "back to top",
  "back to the top",
  "home",
  "who we are",
  "what we do",
  "share",
  "share this article",
  "share this post",
  "subscribe to our newsletter",
  "donate",
  "view larger image",
]);

// Remove extra whitespace and trim the text without changing its wording.
function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

// Check whether a block exactly matches one of the known boilerplate labels.
function isBoilerplate(text) {
  const normalized = cleanText(text)
    .toLowerCase()
    .replace(/[.!:]+$/g, "");

  return BOILERPLATE.has(normalized);
}

// Load the structured article blocks created by scrape.js.
const articles = JSON.parse(await readFile(INPUT_FILE, "utf8"));

// Clean each block while preserving its type, order, article title, and source URL.
const cleanedArticles = articles.map((article) => ({
  ...article,
  blocks: article.blocks
    .map((block) => ({ ...block, text: cleanText(block.text) }))
    .filter((block) => block.text && !isBoilerplate(block.text)),
}));

// Save the cleaned articles as a separate intermediate file for inspection.
await writeFile(OUTPUT_FILE, JSON.stringify(cleanedArticles, null, 2));

// Report the number of articles written to the intermediate file.
console.log(`Cleaned ${cleanedArticles.length} articles into ${OUTPUT_FILE}`);
