import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  requestJSON,
  COLLECTION,
  VECTOR_SIZE,
  QDRANT_URL,
} from "../utils/utils.js";

const EMBEDDED_FILE = new URL(
  "../output/embedded_chunks.json",
  import.meta.url,
);
const BATCH_SIZE = 8;

// Turn a chunk ID into a repeatable UUID-shaped ID that Qdrant accepts.
// The same chunk ID creates the same point ID if this script is run again.
function stableUUID(value) {
  const bytes = Buffer.from(
    createHash("sha256").update(value).digest("hex").slice(0, 32),
    "hex",
  );

  // Set the UUID version and variant bits expected in this ID format.
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return [
    // Split the hex string into the standard UUID format.
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

// Make sure the destination collection exists and has the right vector size.
async function ensureCollection() {
  const collections = await requestJSON(QDRANT_URL + "/collections");
  const exists = collections.result.collections.some(
    (collection) => collection.name === COLLECTION,
  );

  if (!exists) {
    await requestJSON(QDRANT_URL + "/collections/" + COLLECTION, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vectors: { size: VECTOR_SIZE, distance: "Cosine" },
      }),
    });
    console.log("Created Qdrant collection: " + COLLECTION);
    return;
  }

  const info = await requestJSON(QDRANT_URL + "/collections/" + COLLECTION);
  const size = info.result.config.params.vectors.size;

  // The model's vector length and the collection's configured length must match.
  if (size !== VECTOR_SIZE) {
    throw new Error(
      "Collection vector size is " + size + ", expected " + VECTOR_SIZE + ".",
    );
  }

  console.log("Using existing Qdrant collection: " + COLLECTION);
}

// Load the file produced by embed.js and prepare the Qdrant collection.
const embeddedChunks = JSON.parse(await readFile(EMBEDDED_FILE, "utf8"));
if (embeddedChunks.length === 0)
  throw new Error("No embedded chunks found to load.");
await ensureCollection();

// Upload the saved vectors in small groups.
for (let start = 0; start < embeddedChunks.length; start += BATCH_SIZE) {
  const batch = embeddedChunks.slice(start, start + BATCH_SIZE);

  // Convert each embedded chunk into the point format Qdrant stores.
  const points = batch.map((chunk) => {
    if (chunk.embedding.length !== VECTOR_SIZE) {
      throw new Error(
        "Embedding has " +
          chunk.embedding.length +
          " dimensions, expected " +
          VECTOR_SIZE +
          ".",
      );
    }

    // Keep the text and source metadata as payload so results can be displayed and filtered.
    const { embedding, embedding_model, ...payload } = chunk;

    return {
      id: stableUUID(chunk.id),
      vector: embedding,
      payload: {
        ...payload,
        chunk_id: chunk.id,
        embedding_model,
      },
    };
  });

  // Upsert stores new points and replaces points with matching IDs.
  await requestJSON(
    QDRANT_URL + "/collections/" + COLLECTION + "/points?wait=true",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points }),
    },
  );

  // Show how many chunks have been uploaded so far.
  console.log(
    "Loaded " +
      Math.min(start + batch.length, embeddedChunks.length) +
      " / " +
      embeddedChunks.length +
      " chunks",
  );
}

// Check Qdrant's final point count and report where the data was saved.
const finalInfo = await requestJSON(QDRANT_URL + "/collections/" + COLLECTION);
console.log(
  "Done. Qdrant reports " +
    finalInfo.result.points_count +
    " points in " +
    COLLECTION +
    ".",
);
