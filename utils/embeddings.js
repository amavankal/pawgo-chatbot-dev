// embedding model constants
export const OLLAMA_URL = "http://127.0.0.1:11434";
export const EMBEDDING_MODEL = "qwen3-embedding:4b";
export const VECTOR_SIZE = 2560;

// vector db constants
export const QDRANT_URL = "http://127.0.0.1:6333";
export const COLLECTION = "pawgo_dogcare";

// Send an HTTP request to Ollama and return its JSON response.
export async function requestJSON(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.text();
  const data = body ? JSON.parse(body) : {};

  // Stop with the server's response included if Ollama reports an error.
  if (!response.ok) {
    throw new Error("Request failed (" + response.status + "): " + body);
  }

  return data;
}

export async function isOllamaServerRunning() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/version`);
    return response.ok;
  } catch {
    return false;
  }
}
