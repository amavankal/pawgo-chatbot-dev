import { OLLAMA_URL, MODEL, requestJSON } from "../utils/embeddings.js";

/**
 * 
 * @param prompt string
 * @returns response with following format:
 * {
 *   response: string,
 *   sources: (URL | string)[]
 * }
 */
export async function askQuestion(prompt) {
  // 1: embed question
  const response = await requestJSON(OLLAMA_URL + "/api/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      input: prompt,
      // Fail on overlong input instead of embedding a silently truncated chunk.
      truncate: false,
    }),
  });

  // 2: query Qdrant to find relevant context DEBUG
  console.log(response.embeddings.length);

  return {
    response: "oopsi",
    sources: ["oo"]
  };
}
