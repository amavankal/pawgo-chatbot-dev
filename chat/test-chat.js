import { askQuestion } from "./ask-question.js";

// for testing RAG pipeline on commandline
async function main() {
  console.log("\x1b[1;34mStart chatting!\x1b[0m\n");

  process.stdout.write("\x1b[1mEnter prompt (Q to quit):\x1b[0m ");
  process.stdin.on("data", async (input) => {
    // leave if user wants to
    if (input.toString().trim().toUpperCase() === "Q") {
      process.stdout.write("Exiting..");
      process.exit(0);
    }

    // call askQuestion with user's prompt
    const response = await askQuestion(input.toString());

    // format response to output: print response & sources
    process.stdout.write("\x1b[1;34mResponse:\x1b[0m " + response.response + "\n");
    process.stdout.write(
      "\x1b[1;34mSource URLs:\x1b[0m\n" +
        response.sources.map((src) => src.url).join("\n") +
        "\n",
    );
    process.stdout.write(
      "\x1b[1;34mSource texts:\x1b[0m\n" +
        response.sources.map((src) => `\x1b[1;35m${src.id}\x1b[0m\n${src.text}`).join("\n") +
        "\n\n",
    );

    process.stdout.write("\x1b[1mEnter prompt (Q to quit):\x1b[0m ");
  });
}

main().catch((err) => {
  console.log("Something went wrong testing RAG pipeline: " + err);
});
