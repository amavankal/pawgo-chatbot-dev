import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const INPUT_FILE = new URL("../output/cleaned_articles.json", import.meta.url);
const METADATA_FILE = new URL("./input/source_metadata.json", import.meta.url);
const OUTPUT_FILE = new URL("../output/cleaned_chunks.json", import.meta.url);

// Set the target maximum size for each chunk, measured in words.
const MAX_WORDS = 300;

// Split a long block into smaller pieces so one paragraph cannot exceed the limit.
function splitLongBlock(text, maxWords) {
  const words = text.split(/\s+/);
  const pieces = [];

  for (let start = 0; start < words.length; start += maxWords) {
    pieces.push(words.slice(start, start + maxWords).join(" "));
  }

  return pieces;
}

// Load the cleaned articles and the per-source metadata spreadsheet export.
const articles = JSON.parse(await readFile(INPUT_FILE, "utf8"));
const sourceMetadata = JSON.parse(await readFile(METADATA_FILE, "utf8"));

const chunks = [];

// Turn each article's ordered blocks into smaller, section-aware chunks.
for (const article of articles) {
  // Look up metadata using the exact article URL.
  const metadata = sourceMetadata[article.url];

  // Require a metadata entry so every saved chunk has source context.
  if (!metadata) {
    throw new Error("Missing metadata for " + article.url + "; add it to source_metadata.json.");
  }

  let currentHeading = article.title;
  let currentParts = [];
  let currentWordCount = 0;
  let chunkNumber = 0;

  // Save the accumulated text and reset the temporary values for the next chunk.
  function saveChunk() {
    if (currentParts.length === 0) return;

    chunkNumber += 1;
    const text = currentParts.join("\n");

    chunks.push({
      id: `${article.url}#chunk-${chunkNumber}`,
      text: `Section: ${currentHeading}\n\n${text}`,
      source_url: article.url,
      article_title: article.title,
      ...metadata,
      section: currentHeading,
      chunk_number: chunkNumber,
    });

    currentParts = [];
    currentWordCount = 0;
  }

  // Process blocks in page order so section headings stay attached to their content.
  for (const block of article.blocks) {
    const text = block.text;

    // A heading starts a new section, so save the previous section before moving on.
    if (/^h[1-6]$/.test(block.type)) {
      saveChunk();
      currentHeading = text;
      continue;
    }

    // Prefix list items so their list structure remains visible in the chunk text.
    const formattedText = block.type === "li" ? `- ${text}` : text;
    const pieces = splitLongBlock(formattedText, MAX_WORDS);

    // Add each piece unless it would make the current chunk larger than the word limit.
    for (const piece of pieces) {
      const pieceWordCount = piece.split(/\s+/).length;

      if (
        currentWordCount > 0 &&
        currentWordCount + pieceWordCount > MAX_WORDS
      ) {
        saveChunk();
      }

      currentParts.push(piece);
      currentWordCount += pieceWordCount;
    }
  }

  // Save any text left after the final block in the article.
  saveChunk();
}

// Save the chunks and their source metadata for inspection and embedding.
await writeFile(OUTPUT_FILE, JSON.stringify(chunks, null, 2));

// Report how many chunks were created.
console.log(`Created ${chunks.length} chunks in ${fileURLToPath(OUTPUT_FILE)}`);
