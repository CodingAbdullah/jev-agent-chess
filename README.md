# Jev Chess

A chess web app where you play against TypeSafe AI's Jev, Stockfish, or a hybrid of both. Built end to end in TypeScript.

## Stack

- [Next.js](https://nextjs.org) with the App Router, React and TypeScript
- [Tailwind CSS](https://tailwindcss.com) and [shadcn/ui](https://ui.shadcn.com)
- [chess.js](https://github.com/jhlywa/chess.js) for the rules of chess
- [react-chessboard](https://github.com/Clariity/react-chessboard) for the board
- [@typesafe-ai/sdk](https://www.npmjs.com/package/@typesafe-ai/sdk) for Jev, called only from the server
- [Stockfish.js](https://github.com/nmrugg/stockfish.js) 19 Lite, running in the browser in a Web Worker
- [Vitest](https://vitest.dev) with Testing Library for unit tests
- [Playwright](https://playwright.dev) for end-to-end tests

## Current features

- Play against Jev as White, Black or a random colour, with six personalities and three difficulty levels
- A Jev panel showing the move played, Jev's confidence, and its top candidate moves
- A local fallback move, clearly labelled, when Jev fails or times out
- Play against Stockfish at three difficulty levels, with its evaluation and expected line shown
- Hybrid mode: Stockfish shortlists its five best moves, and Jev picks the one that fits its personality. A panel shows Stockfish's ranking and evaluations beside Jev's probabilities
- An evaluation bar beside the board, from a background Stockfish analysis, which can be turned off
- Local two-player games on one device
- Move by clicking or by dragging pieces
- Legal-move dots, capture rings, and last-move and check highlights
- Castling, en passant, and promotion with a piece picker
- Checkmate and every draw rule: stalemate, insufficient material, threefold repetition and the fifty-move rule
- Chess clocks from bullet to classical, with increments and loss on time
- Move history, captured pieces and the material lead
- Undo, board flip, and a game-over dialog with rematch
- FEN and PGN import and export, including copy and download
- Light and dark mode, four board themes, synthesized move sounds and optional coordinates, all saved on the device
- Layouts for desktop and phone screens

See [docs/PLAN.md](docs/PLAN.md) for the full plan and its status.

## Requirements

- Node.js 20.9 or newer, 22 recommended (see `.nvmrc`)

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Connecting Jev

The app reads your TypeSafe API key from the `TYPESAFE_API_KEY` environment
variable on the server. The key is never sent to the browser. Never commit it.

```bash
# .env.local, which git ignores
TYPESAFE_API_KEY=your-key-here
```

Without a key, the app uses a local mock that answers in Jev's format. The Jev
panel marks those moves "Mock". Set `JEV_MOCK=1` to force the mock even when a
key is set. The browser tests always do this.

Check the live connection with one real call:

```bash
npm run jev:smoke
```

## Scripts

| Script               | What it does                                     |
| -------------------- | ------------------------------------------------ |
| `npm run dev`        | Starts the development server                    |
| `npm run build`      | Builds the production app                        |
| `npm start`          | Serves the production build                      |
| `npm run lint`       | Runs ESLint                                      |
| `npm run typecheck`  | Generates Next.js route types, then runs `tsc`   |
| `npm test`           | Runs the Vitest unit tests once                  |
| `npm run test:watch` | Runs Vitest in watch mode                        |
| `npm run test:e2e`   | Builds the app and runs the Playwright tests     |
| `npm run check`      | Runs lint, typecheck and unit tests together     |
| `npm run jev:smoke`  | Makes one live Jev call to check the key         |

Before the first end-to-end run on a new machine, install the browser Playwright needs:

```bash
npx playwright install chromium
```

## Licence

Copyright (C) 2026 Abdullah Muhammad.

Jev Chess is free software: you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version. It is distributed in the hope that it will be useful, but without any
warranty. See [LICENSE](LICENSE) for the full terms.

The project uses the GPL because it ships Stockfish, which is GPL-3.0. Anyone
who distributes this app, including a modified version, must make its source
available under the same licence.

### Third-party software

- **Stockfish** is GPL-3.0. The engine files are copied from the `stockfish`
  npm package into `public/stockfish/` by `scripts/copy-stockfish.mjs`, which
  runs after `npm install` and before `dev` and `build`. Its licence is served
  at `/stockfish/Copying.txt`, and the Stockfish panel links to it and to the
  engine's source code.
- The other runtime dependencies use MIT, BSD-2-Clause, ISC or Apache-2.0,
  all of which are compatible with GPLv3.

## Adding UI components

shadcn/ui is configured in `components.json`. Add components with:

```bash
npx shadcn@latest add dialog
```

## Layout

```
src/app/               pages, layouts and global styles
src/components/chess/  game screen, board, clocks, move list and dialogs
src/components/ui/     shadcn/ui components
src/hooks/             React hooks, including the game state hook
src/lib/chess/         rules, clocks and game state reducer, free of React
src/lib/jev/           Jev prompt, move selection, mock, fallback and route validation
src/app/api/jev/move/  the server route that calls Jev
src/lib/stockfish/     UCI parsing, the Web Worker engine wrapper and Stockfish's move choice
src/lib/hybrid.ts      hybrid mode: Stockfish's shortlist, then Jev's choice
scripts/               engine copy step and the live Jev smoke test
src/lib/               settings, sounds, board themes and shared helpers
e2e/                   Playwright tests
```

Unit tests sit next to the code they test, named `*.test.ts` or `*.test.tsx`.
