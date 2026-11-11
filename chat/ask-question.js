import {
  OLLAMA_URL,
  EMBEDDING_MODEL,
  requestJSON,
  QDRANT_URL,
  COLLECTION,
  CHAT_MODEL,
} from "../utils/utils.js";
import { readFile } from "node:fs/promises";

const SYSTEM_PROMPT = (
  await readFile(new URL("./context/system-prompt.txt", import.meta.url))
).toString();
const DOCUMENT_FORMAT = (
  await readFile(new URL("./context/document-format.txt", import.meta.url))
).toString();

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
  const context = await requestJSON(
    `${QDRANT_URL}/collections/${COLLECTION}/points/query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: embedding.embeddings[0],
        with_payload: true,
        limit: 3, 
      }),
    },
  );

  // 3: construct system prompt
  let messages = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "system",
      content:
        "Retrieved knowledge base content:\n\n" +
        context.result.points
          .map((chunk, index) =>
            DOCUMENT_FORMAT.replace("$INDEX$", index + 1)
              .replace("$URL$", chunk.payload.source_url)
              .replace("$CONTENT$", chunk.payload.text),
          )
          .join("\n"),
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  // query Qwen through ollama chat API (won't use generate so as to remember convo history)
  console.log("Querying chat model...");
  const llmResponse = await requestJSON(OLLAMA_URL + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      // chat history: implement later
      messages: messages,
      format: "json",
      options: {
        num_ctx:8192, 
        num_predict: 1024,
      },
      think: false,
      stream: false,
    }),
  });

  if (llmResponse.done_reason === "length")
    throw new Error("LLM ran out of context. :(");

  // extract content from response
  const jsonResponse = JSON.parse(llmResponse.message.content);

  return {
    response: jsonResponse.response,
    sources: jsonResponse.sources_used,
    time: llmResponse.total_duration / 1e9,
  };
}
