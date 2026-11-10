import { askQuestion } from "./ask-question.js";

// for testing RAG pipeline on commandline
async function main() {
    console.log("\x1b[1;34mStart chatting!\x1b[0m\n");

    process.stdout.write("\x1b[1mEnter prompt (Q to quit):\x1b[0m ");
    process.stdin.on("data", async (input) => {
        if (input.toString().trim().toUpperCase() === 'Q') {
            process.stdout.write("Exiting..");
            process.exit(0);
        }

        const response = await askQuestion(input.toString());
        process.stdout.write("\x1b[1mResponse:\x1b[0m " + response.response + "\n");
        process.stdout.write("\x1b[1mSources:\x1b[0m " + response.sources + "\n\n");

        process.stdout.write("\x1b[1mEnter prompt (Q to quit):\x1b[0m ");
    });
}

main().catch(err => {
    console.log("Something went wrong testing RAG pipeline: " + err);
});