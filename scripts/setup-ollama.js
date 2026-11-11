import {
  isOllamaServerRunning,
  EMBEDDING_MODEL,
  CHAT_MODEL,
  OLLAMA_URL,
  requestJSON,
} from "../utils/embeddings.js";
import { spawn } from "node:child_process";

// pretty formatting :)
const SETUP_PREFIX = "\x1b[1;32mSETUP SCRIPT:\x1b[0m ";

// run command, printing output to stdout
async function run(command, args) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      stdio: "inherit",
    });

    process.on("error", reject);
    process.on("close", (exit_code) => {
      if (exit_code === 0) resolve();
      else reject(new Error(`${command} exited with code ${exit_code}`));
    });
  });
}

async function main() {
  // If Ollama server is not running, start it
  if (!(await isOllamaServerRunning())) {
    console.log(SETUP_PREFIX + "Starting Ollama server...");

    // start server in new thread
    const ollamaServer = spawn("ollama", ["serve"], {
      detached: true,
      stdio: "ignore",
    });

    // remind person to install ollama if ENOENT (ollama command not found)
    // else just propagate errors
    ollamaServer.on("error", (err) => {
      if (err.code === "ENOENT")
        throw new Error("Ollama is not installed :(. Pls install!", { cause: error });
      throw err;
    });

    // parent thread (this) shouldn't indefinitely wait on Ollama server to stop; it won't
    ollamaServer.unref();

    // wait for server to become available (30 secs max)
    for (let i = 0; i < 30; i++) {
      if (await isOllamaServerRunning()) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // verify server is available for realsies
    if (!(await isOllamaServerRunning()))
      throw new Error("Ollama server connection timed out.");
  } else {
    console.log(SETUP_PREFIX + "Ollama server already running. Yay!");
  }

  // Check available models
  const models = await requestJSON(OLLAMA_URL + "/api/tags");

  // check if embedding model exists first, then pull
  if (
    models.models.length > 0 &&
    models.models.some((model) => model.model === EMBEDDING_MODEL)
  )
    console.log(SETUP_PREFIX + `${EMBEDDING_MODEL} already pulled. Yay!`);
  else {
    console.log(`${SETUP_PREFIX} Pulling ${EMBEDDING_MODEL}...`);
    await run("ollama", ["pull", EMBEDDING_MODEL]);
  }

  // check if chat model exists first, then pull
  if (
    models.models.length > 0 &&
    models.models.some((model) => model.model === CHAT_MODEL)
  )
    console.log(`${SETUP_PREFIX} ${CHAT_MODEL} already pulled. Yay!`);
  else {
    console.log(`${SETUP_PREFIX} Pulling ${CHAT_MODEL}...`);
    await run("ollama", ["pull", CHAT_MODEL]);
  }

  // Log completion
  console.log(SETUP_PREFIX + "\x1b[1;7;38;5;28mOllama setup complete.\x1b[0m");
}

main().catch((err) => {
  console.log(SETUP_PREFIX + "Something went wrong setting up Ollama: " + err);
});
