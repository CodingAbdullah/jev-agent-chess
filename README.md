# Jev Chess

[![CI](https://github.com/CodingAbdullah/jev-agent-chess/actions/workflows/ci.yml/badge.svg)](https://github.com/CodingAbdullah/jev-agent-chess/actions/workflows/ci.yml)

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
- An evaluation bar beside the board, from a background Stockfish analysis. It shows in two-player games and after games against the computer, and hints stay hidden while you play the computer unless you turn them on
- In Jev games the bar shows Jev's own judgment of the position, such as "White is slightly better", with Stockfish's number beside it
- Resign, and offer draws: the other player answers in two-player games, Stockfish judges by its evaluation, and Jev answers a yes-or-no question in its own style. Computers consider offers from move 10
- Review a finished game move by move with the buttons, the arrow keys, Home and End, or by clicking a move in the history
- Keyboard play: type moves such as `e4`, `Nf3` or `e7e8q`, and moves are announced to screen readers in plain words
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
- Layouts for desktop and phone screens down to 360px, with reduced motion respected
- Checked with axe for WCAG 2.2 AA problems in light and dark mode

See [docs/PLAN.md](docs/PLAN.md) for the full plan and its status.

## Requirements

- Node.js 20.9 or newer, 22 recommended (see `.nvmrc`)

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

### Setup script

The setup script checks your tools, creates the right env file, asks for your
TypeSafe key at a hidden prompt, and can start the app. Press Enter at the key
prompt to play against the mock Jev.

```bash
./scripts/setup.sh            # macOS and Linux
```

```powershell
.\scripts\setup.ps1           # Windows PowerShell 5.1 or PowerShell 7
```

Choose how to run it, or name it directly:

| Command | What it does |
| --- | --- |
| `setup local` | Writes `.env.local` for `npm run dev` |
| `setup docker` | Writes `.env` for `docker compose` |
| `setup cloud` | Shows how to add the key to a Claude Code cloud environment |
| `setup vercel` | Shows how to add the key to Vercel |

Add `--start` (`-Start` in PowerShell) to install and start the app straight
away. The key is never taken as a command-line argument, so it stays out of
your shell history, and it is written only to the git-ignored env file. Run
the script again to change the key; other settings in the file are kept.

If Windows blocks the script, run
`powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1`.

## Connecting Jev

The app reads your TypeSafe API key from the `TYPESAFE_API_KEY` environment
variable on the server. The key is never sent to the browser. Never commit it.

```bash
cp .env.example .env.local   # then add your key; git ignores .env.local
```

Or run the [setup script](#setup-script), which does this and asks for the key
without showing it. `.env.example` lists every setting the app reads.

Without a key, the app uses a local mock that answers in Jev's format. The Jev
panel marks those moves "Mock". Set `JEV_MOCK=1` to force the mock even when a
key is set. The browser tests always do this.

The route is rate limited per client address and overall, so a public site
cannot drain the key's quota. The limits are set per minute:

| Variable | Default | Limits |
| --- | --- | --- |
| `JEV_RATE_LIMIT_PER_MINUTE` | 30 | Requests from one address |
| `JEV_GLOBAL_RATE_LIMIT_PER_MINUTE` | 300 | Requests from everyone together |

By default the limiter keeps its counts in memory, which covers a single
server. To share the limits across several instances, connect an
[Upstash Redis](https://upstash.com) database. The app then keeps the counts in
Redis through Upstash's REST API, with no extra package or open connection:

| Variable | Set by |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` | Upstash's console |
| `KV_REST_API_URL` and `KV_REST_API_TOKEN` | Vercel's Upstash integration, automatically |

If Redis cannot be reached, each instance falls back to its own in-memory
limits and logs a warning once a minute, so games keep working.

Check the live connection with one real call, or run the live checks, which
play a few puzzles and compare the personalities:

```bash
npm run jev:smoke
npm run jev:live
```

## Deploy

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FCodingAbdullah%2Fjev-agent-chess&env=TYPESAFE_API_KEY&envDescription=Your%20TypeSafe%20AI%20API%20key.%20Leave%20empty%20to%20use%20the%20mock%20Jev.)

1. Import the repository into Vercel, or use the button above.
2. Add `TYPESAFE_API_KEY` under Settings, then Environment Variables. Add the
   rate-limit variables too if you want other limits.
3. Deploy. Vercel builds the app with its default settings; nothing else is
   needed.

Vercel runs many short-lived copies of the server, and without a shared store
each keeps its own rate-limit counts. For a public deployment, add Upstash
Redis from the project's Storage tab (Marketplace, then Upstash). Vercel sets
`KV_REST_API_URL` and `KV_REST_API_TOKEN` for you, and the limits then hold
across every copy. Redeploy after connecting it.

### Docker

The image uses Next.js standalone output and runs as a non-root user. Your key
is passed when the container starts and is never stored in the image.

Run the prebuilt image from GitHub's container registry, for amd64 and arm64:

```bash
docker run -p 3000:3000 -e TYPESAFE_API_KEY=your-key ghcr.io/codingabdullah/jev-agent-chess
```

Or build it yourself:

```bash
docker build -t jev-chess .
docker run -p 3000:3000 -e TYPESAFE_API_KEY=your-key jev-chess
```

Or with Docker Compose, which reads settings from `.env`:

```bash
cp .env.example .env   # then add your key, or leave it empty for the mock
docker compose up --build
```

Then open http://localhost:3000. The container reports its health through
Docker's health check.

A single container is one server process, so the built-in rate limiter works
as intended. It identifies clients by the `X-Forwarded-For` header, so put the
container behind a reverse proxy or load balancer that sets that header.
Without one, all visitors share the per-client limit; the global limit still
protects your quota either way.

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
| `npm run jev:live`   | Runs the live Jev checks: puzzles and personalities |

Before the first end-to-end run on a new machine, install the browser Playwright needs:

```bash
npx playwright install chromium
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup,
the checks to run before a pull request, and how releases are made. No API key
is needed: the mock Jev covers development and every test. Report security
problems privately, as described in [SECURITY.md](SECURITY.md).

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
src/app/                      pages, layouts, error pages, icon and global styles
src/app/api/jev/              server routes that call Jev: move, evaluate and draw
src/components/chess/         game screen, board, clocks, move list, dialogs, the Jev,
                              Stockfish and hybrid panels, evaluation bar, review controls
src/components/ui/            shadcn/ui components
src/components/providers.tsx  theme and tooltip providers
src/hooks/                    React hooks: game state, computer opponents, Stockfish,
                              draw offers, Jev's evaluation, settings
src/lib/                      settings, sounds, board themes, game config, draw offers,
                              rate limiting and shared helpers
src/lib/chess/                rules, clocks, game state reducer and move descriptions, free of React
src/lib/jev/                  SDK client, prompts, move choice, evaluation and draw answers,
                              mock, fallback, route checks and validation
src/lib/stockfish/            UCI parsing, the Web Worker engine wrapper and Stockfish's move choice
src/lib/hybrid.ts             hybrid mode: Stockfish's shortlist, then Jev's choice
public/stockfish/             the engine, copied from npm at install (git ignores it)
scripts/                      engine copy step, live Jev smoke test and setup scripts
e2e/                          Playwright tests
test/                         Vitest stubs
docs/                         project plan
.github/                      CI, Docker publish, React Doctor and Dependabot
```

Unit tests sit next to the code they test, named `*.test.ts` or `*.test.tsx`.
