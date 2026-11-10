import {
  isOllamaServerRunning,
  MODEL,
  OLLAMA_URL,
  requestJSON,
} from "../utils/embeddings.js";
import { spawn } from "node:child_process";

const SETUP_PREFIX = "\x1b[1;32mSETUP SCRIPT:\x1b[0m ";

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
        throw new Error("Ollama is not installed :(.", { cause: error });
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

  // Pull model
  // check if model exists first
  const result = await requestJSON(OLLAMA_URL + "/api/tags");
  if (
    result.models.length > 0 &&
    result.models.some((model) => model.model === "qwen3-embedding:4b")
  )
    console.log(SETUP_PREFIX + "Qwen3-embedding-4b already pulled. Yay!");
  else {
    console.log(`${SETUP_PREFIX} Pulling ${MODEL}...`);
    await run("ollama", ["pull", MODEL]);
  }

  console.log(SETUP_PREFIX + "Ollama setup complete.");
}

main().catch((err) => {
  console.log(SETUP_PREFIX + "Something went wrong setting up Ollama: " + err);
});
