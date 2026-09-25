// Copies the Stockfish engine from node_modules into public/, where the browser
// can load it as a Web Worker. Runs after npm install and before dev and build.
// Copying.txt is Stockfish's GPL-3.0 licence, served next to the engine.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "stockfish");
const target = join(root, "public", "stockfish");

const files = [
  ["bin/stockfish-19-lite-single.js", "stockfish-19-lite-single.js"],
  ["bin/stockfish-19-lite-single.wasm", "stockfish-19-lite-single.wasm"],
  ["Copying.txt", "Copying.txt"],
];

mkdirSync(target, { recursive: true });
for (const [from, to] of files) copyFileSync(join(source, from), join(target, to));
console.log(`Copied Stockfish engine to ${target}`);
