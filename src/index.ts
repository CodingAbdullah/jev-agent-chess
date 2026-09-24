import { pathToFileURL } from "node:url";

export function greet(name: string): string {
  return `Hello, ${name}! Welcome to jev-agent-chess.`;
}

// Run only when executed directly (e.g. `npm start`), not when imported.
const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  console.log(greet("player"));
}
