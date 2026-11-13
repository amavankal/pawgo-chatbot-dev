/**
 * Simulates client-side method calling our ask Question API
 */
import { askQuestion } from "./ask-question.js";

// For testing the RAG pipeline in Terminal
async function main() {
  console.log("\x1b[1;34mStart chatting!\x1b[0m\n");

  process.stdout.write("\x1b[1mEnter prompt (Q to quit):\x1b[0m ");
  let messageHistory = null;

  process.stdin.on("data", async (input) => {
    const prompt = input.toString().trim();

    // Exit when user enters Q
    if (prompt.toUpperCase() === "Q") {
      console.log("\nExiting...");
      process.exit(0);
    }

    if (!prompt) {
      process.stdout.write("\x1b[1mEnter prompt (Q to quit):\x1b[0m ");
      return;
    }

    try {
      // Display tokens immediately as Ollama generates them
      let started = false;

      const response = await askQuestion(prompt, (token) => {
        if (!started) {
          process.stdout.write("\n\x1b[1;34mResponse:\x1b[0m ");
          started = true;
        }
        process.stdout.write(token);
      }, messageHistory);

      // store message history
      messageHistory = response.messageHistory;

      process.stdout.write("\n\n");

      // Display only source URLs
      process.stdout.write("\x1b[1;34mSources used:\x1b[0m\n");

      const uniqueUrls = [
        ...new Set(
          (response.sources ?? []).map((src) => src.url).filter(Boolean),
        ),
      ];

      for (const url of uniqueUrls) {
        process.stdout.write(`\x1b[1;35m${url}\x1b[0m\n`);
      }

      process.stdout.write("\n");

      // Display generation time only once
      console.log(
        "\x1b[1;34mGeneration Time:\x1b[0m",
        response.time.toFixed(2),
        "seconds\n",
      );
    } catch (error) {
      console.error("\nChatbot error:", error.message);
    }

    process.stdout.write("\x1b[1mEnter prompt (Q to quit):\x1b[0m ");
  });
}

main().catch((error) => {
  console.error("Something went wrong:", error);
});
