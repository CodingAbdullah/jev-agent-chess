// One live call to Jev from the starting position, to check the key and network.
// Usage: npm run jev:smoke   (reads TYPESAFE_API_KEY from the environment or .env.local)
// The key is never printed.
import { choice, TypeSafeClient } from "@typesafe-ai/sdk";

if (!process.env.TYPESAFE_API_KEY?.trim()) {
  console.error("TYPESAFE_API_KEY is not set. Add it to .env.local or the environment first.");
  process.exit(1);
}

const client = new TypeSafeClient({ timeout: 15_000, retry: { maxRetries: 0 } });
const started = Date.now();
try {
  const result = await client.systemOne({
    state: { position_fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", side_to_move: "white" },
    questions: {
      move: choice("You are playing chess as White. Choose the strongest move.", {
        e4: "Pawn from e2 to e4",
        d4: "Pawn from d2 to d4",
        Nf3: "Knight from g1 to f3",
        a3: "Pawn from a2 to a3",
      }),
    },
  });
  const answer = result.answers.move;
  console.log(`OK in ${Date.now() - started} ms. Model: ${result.model}`);
  console.log(`Choice: ${answer.choice} (confidence ${(answer.confidence * 100).toFixed(1)}%)`);
  console.log("Probabilities:", answer.probabilities);
  console.log("Usage:", result.usage);
} catch (error) {
  console.error(`Failed after ${Date.now() - started} ms: ${error?.name}: ${error?.message}`);
  process.exit(1);
}
