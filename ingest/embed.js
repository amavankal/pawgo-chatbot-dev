import { readFile, writeFile } from "node:fs/promises";

const CHUNKS_FILE = "../output/cleaned_chunks.json";
const OUTPUT_FILE = "../output/embedded_chunks.json";
const OLLAMA_URL = "http://127.0.0.1:11434";
const MODEL = "qwen3-embedding:4b";
const VECTOR_SIZE = 2560;
const BATCH_SIZE = 8;

// Send an HTTP request to Ollama and return its JSON response.
async function requestJSON(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.text();
  const data = body ? JSON.parse(body) : {};

  // Stop with the server's response included if Ollama reports an error.
  if (!response.ok) {
    throw new Error("Request failed (" + response.status + "): " + body);
  }

  return data;
}

// Load the chunks produced by chunk.js.
const chunks = JSON.parse(await readFile(CHUNKS_FILE, "utf8"));
if (chunks.length === 0) throw new Error("No chunks found to embed.");

const embeddedChunks = [];

// Send small groups of text to Ollama to keep each request manageable.
for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
  const batch = chunks.slice(start, start + BATCH_SIZE);

  // Ollama converts each chunk's text into a numeric embedding vector.
  const result = await requestJSON(OLLAMA_URL + "/api/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      input: batch.map((chunk) => chunk.text),
      // Fail on overlong input instead of embedding a silently truncated chunk.
      truncate: false,
    }),
  });

  if (result.embeddings.length !== batch.length) {
    throw new Error("Ollama returned an unexpected number of embeddings.");
  }

  // Keep each vector beside its original chunk so loading can happen separately.
  for (let index = 0; index < batch.length; index += 1) {
    const vector = result.embeddings[index];

    // Confirm the vector size matches the Qdrant collection configuration.
    if (vector.length !== VECTOR_SIZE) {
      throw new Error(
        "Embedding has " + vector.length + " dimensions, expected " + VECTOR_SIZE + ".",
      );
    }

    embeddedChunks.push({
      ...batch[index],
      embedding: vector,
      embedding_model: MODEL,
    });
  }

  // Show embedding progress without uploading anything to Qdrant yet.
  console.log(
    "Embedded " + Math.min(start + batch.length, chunks.length) +
      " / " + chunks.length + " chunks",
  );
}

// Save the vectors to an intermediate file; load-qdrant.js can upload them later.
await writeFile(OUTPUT_FILE, JSON.stringify(embeddedChunks));
console.log(`Saved ${embeddedChunks.length} embedded chunks to ${OUTPUT_FILE}`);
