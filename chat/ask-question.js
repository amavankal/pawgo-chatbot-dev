import {
  OLLAMA_URL,
  EMBEDDING_MODEL,
  requestJSON,
  QDRANT_URL,
  COLLECTION,
  CHAT_MODEL,
} from "../utils/utils.js";
import { readFile } from "node:fs/promises";

// Max # of interactions to return, including the most recent one
const MAX_MESSAGE_HISTORY = 3;
const MAX_RETRIEVED_DOCUMENTS = 3;

const SYSTEM_PROMPT = (
  await readFile(new URL("./context/system-prompt.txt", import.meta.url))
).toString();
const DOCUMENT_FORMAT = (
  await readFile(new URL("./context/document-format.txt", import.meta.url))
).toString();

/**
 * Returns response to prompt from LLM
 * @param prompt (string) the user's prompt
 * @param onToken a function that accepts a string. It will be called
 *  every time a new response token is available from the LLM. (Allows for
 *  streaming responses)
 * @param messages an optional array of JUST past user and LLM responses.
 *  Should not include a system prompt or old context. You shouldn't construct
 *  this argument yourself, but rather pass in what is returned from previous
 *  calls to this function.
 * @returns response with following format:
 * {
 *   sources: {
 *     id: string,
 *     url: string,
 *     text: string
 *   }[],
 *   time: float
 *   messageHistory: [
 *    {
 *      role: "system" | "user" | "assistant",
 *      content: string,
 *    }
 *   ]
 * }
 *  - messageHistory will contain at most MAX_MESSAGE_HISTORY past interactions,
 *    including the most recent interaction (an interaction is one user prompt
 *    and one chatbot response)
 *  - the last message object is the chatbot's most recent response
 */
export async function askQuestion(prompt, onToken, messageHistory = null) {
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
        limit: MAX_RETRIEVED_DOCUMENTS,
      }),
    },
  );

  // 3: construct message history, including system prompt
  let messages = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    ...(messageHistory ?? []),
    {
      role: "user",
      content: prompt,
    },
    {
      role: "system",
      content:
        "Retrieved knowledge base content for user's query:\n\n" +
        context.result.points
          .map((chunk, index) =>
            DOCUMENT_FORMAT.replace("$INDEX$", index + 1)
              .replace("$URL$", chunk.payload.source_url)
              .replace("$CONTENT$", chunk.payload.text),
          )
          .join("\n"),
    },
  ];

  // 4: Query Qwen through Ollama with streaming
  console.log("Querying chat model...");

  const startTime = performance.now();

  const llmResponse = await fetch(OLLAMA_URL + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      think: false,
      stream: true,
      keep_alive: "30m",
      options: {
        num_ctx: 8192,
        num_predict: 768,
        temperature: 0.3,
      },
    }),
  });

  if (!llmResponse.ok) {
    throw new Error(await llmResponse.text());
  }

  if (!llmResponse.body) {
    throw new Error("Ollama returned no response stream.");
  }

  const reader = llmResponse.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let fullResponse = "";
  let doneReason = "";

  function processLine(line) {
    if (!line.trim()) return;

    const data = JSON.parse(line);

    if (data.message?.content) {
      const token = data.message.content;
      fullResponse += token;

      // Send each piece to the terminal immediately
      if (typeof onToken === "function") {
        onToken(token);
      }
    }

    if (data.done) {
      doneReason = data.done_reason;
    }
  }

  // Process Ollama's newline-delimited JSON stream
  while (true) {
    const { value, done } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      processLine(line);
    }
  }

  // Process any remaining response data
  buffer += decoder.decode();

  if (buffer.trim()) {
    processLine(buffer);
  }

  if (doneReason === "length") {
    console.warn("\nWarning: The LLM reached its generation limit.");
  }

  const generationTime = (performance.now() - startTime) / 1000;

  // Return the generated response and retrieved sources
  return {
    sources: context.result.points.map((point) => ({
      id: point.payload.chunk_id ?? point.id,
      url: point.payload.source_url,
      text: point.payload.text,
    })),
    time: generationTime,
    messageHistory: [
      ...messages.slice(
        // past conversation history, including user's most recent prompt
        Math.max(1, messages.length - (MAX_MESSAGE_HISTORY - 1) * 2 - 2),
        messages.length - 1, // don't include context
      ),
      {
        // llm's most recent response
        role: "assistant",
        content: fullResponse,
      },
    ],
  };
}
