import {
  OLLAMA_URL,
  EMBEDDING_MODEL,
  requestJSON,
  QDRANT_URL,
  COLLECTION,
} from "../utils/utils.js";

/**
 * Returns response to prompt from LLM
 * @param prompt string
 * @returns response with following format:
 * {
 *   response: string,
 *   sources: {
 *     id: string,
 *     url: string,
 *     text: string
 *   }[]
 * }
 */
export async function askQuestion(prompt) {
  // 1: embed question
  const embedding = await requestJSON(OLLAMA_URL + "/api/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: prompt,
      // Fail on overlong input instead of embedding a silently truncated chunk.
      truncate: false,
    }),
  });

  // 2: query Qdrant to find relevant context DEBUG
  const response = await requestJSON(
    `${QDRANT_URL}/collections/${COLLECTION}/points/query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: embedding.embeddings[0],
        with_payload: true,
      }),
    },
  );

  return {
    response: "not implemented",
    sources: response.result.points.map((chunk) => ({
      id: chunk.payload.id,
      url: chunk.payload.source_url,
      text: chunk.payload.text,
    })),
  };
}
