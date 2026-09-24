# Jev Chess project plan

This file carries the plan and the decisions behind it between work sessions.
Update the status table and "Next step" whenever a phase finishes.

## Goal

A polished chess web app, written in TypeScript end to end, where people play
against TypeSafe AI's Jev, against Stockfish, or against a hybrid of both. Jev's
decisions, with their confidence, are shown in the UI.

## Stack

| Piece       | Package                         | Notes                                       |
| ----------- | ------------------------------- | ------------------------------------------- |
| Framework   | Next.js 16, React 19            | App Router, `src/` directory                |
| Styling     | Tailwind CSS 4, shadcn/ui       | `new-york` style, neutral colours           |
| Rules       | chess.js 1.4                    | Final authority on every move               |
| Board       | react-chessboard 5.12           | Uses dnd-kit for dragging                   |
| AI judgment | @typesafe-ai/sdk 0.6            | Server only, through `src/lib/jev/client.ts` |
| Engine      | stockfish 19 (WASM)             | Not installed yet. Phase 5. GPL-3.0         |
| Tests       | Vitest, Testing Library, Playwright 1.56.1 | Playwright is pinned on purpose  |

## Phases

| Phase | Scope | Status |
| ----- | ----- | ------ |
| 1 | Convert the scaffold to Next.js with Tailwind, shadcn/ui, Vitest and Playwright | Done |
| 2 | Board, legal-move highlights, check and checkmate, castling, promotion, en passant, local two-player play | Done |
| 3 | Clocks, move history, captured pieces, undo, FEN and PGN import and export, board flip, themes, sound, game-over dialog, phone layout | Done |
| 4 | Jev mode: server route, personalities, difficulty, Jev panel, fallback on failure or timeout | Built and tested against the mock. Live check pending |
| 5 | Stockfish mode: Web Worker, Stockfish-only play, evaluation bar | Next |
| 6 | Hybrid mode: Stockfish shortlists candidate moves and Jev picks one | To do |
| 7 | Polish: end-to-end tests of full games, accessibility, final phone pass | To do |

Each phase ends with lint, type checks, unit tests, the production build and the
browser tests all passing, then one commit pushed to the working branch.

## Next step

1. **Finish phase 4 against the live API** once a key is available. Set
   `TYPESAFE_API_KEY` in the cloud environment's settings, add `api.typesafe.ai`
   to its allowed network domains, and start a new session, since settings only
   reach new sessions. Then run `npm run jev:smoke`, play a few games with the
   mock turned off, and tune the prompt wording and `MAX_CHOICES` against real
   answers. Check how the real API reports errors and limits.
2. **Add rate limiting to `/api/jev/move` before any public deployment.** Right
   now anyone who can reach the site can spend the API key's quota.
3. **Phase 5, Stockfish mode.**

## Design decisions

- **Jev runs only on the server.** The browser calls a Next.js route handler,
  which calls Jev. The key is read from `TYPESAFE_API_KEY` and never reaches the
  client. Locally the key goes in `.env.local`, which git ignores.
- **chess.js validates every move** from Jev or Stockfish before the board
  changes, so a bug can never produce an illegal position.
- **Jev-only mode sends every legal move as a choice.** Each choice gets a short
  description of what the move does, taken from chess.js: capture, check,
  castle, promotion.
- **Hybrid mode:** Stockfish proposes its top five or so moves with evaluations,
  using MultiPV, and Jev picks the one that fits the chosen personality.
- **Personalities** (aggressive, defensive, positional, tactical, unpredictable)
  are instruction wording. Unpredictable samples from Jev's probabilities instead
  of taking the top choice.
- **Difficulty:** for Jev, Easy samples from the probabilities with more
  randomness and Hard takes the top choice. For Stockfish, difficulty sets its
  skill level and search depth.
- **Jev panel** shows the chosen move, its confidence, and a bar chart of the
  next-best alternatives from Jev's probabilities.
- **Personalities** also include Balanced, the default, which simply asks for
  the strongest move.
- **vs Jev is the default mode**, with the player as White on Medium.
- **Undo against Jev** takes back Jev's reply and the player's last move together.
- **Choices are capped at 60 per question**, keeping the most forcing moves,
  because TypeSafe has not published a limit.
- **Evaluation bar** comes from Stockfish. In Jev-only mode a Jev score question
  can fill it, labelled as Jev's judgment rather than an engine evaluation.
- **Stockfish** runs in the browser in a Web Worker, using the lite
  single-threaded build. It is about 1.6MB and needs no special server headers.
- **Stockfish is GPL-3.0 and this repo is MIT.** Shipping it means the deployed
  app must follow GPL terms, mainly offering its source. This was raised with
  the owner, who approved the plan. Confirm again before any public deployment.

## Current architecture

- `src/lib/chess/game.ts`: rules helpers, game status, material, move list rows,
  FEN and PGN import and export. Free of React.
- `src/lib/chess/clock.ts`: time controls and pure clock maths.
- `src/lib/chess/game-state.ts`: the game reducer. State is the starting FEN, the
  moves, and a clock snapshot after each move, so undo restores the clocks.
- `src/hooks/use-chess-game.ts`: wraps the reducer, rebuilds chess.js from the
  moves, and flags a side at the exact moment its clock hits zero.
- `src/components/chess/chess-app.tsx`: the game screen. It renders only in the
  browser, through `chess-app-loader.tsx`, so the first game can use the saved
  time control without a hydration mismatch.
- `src/lib/settings.ts`: device settings in localStorage, read with
  `useSyncExternalStore`. Light and dark mode are handled by next-themes.
- `src/lib/sound.ts`: move sounds synthesized with Web Audio, so no audio files.
- `src/app/api/jev/move/route.ts`: the only Jev entry point. It validates the
  request with `src/lib/jev/validate.ts`, then calls `decideMove`.
- `src/lib/jev/client.ts`: builds the SDK client. It is marked `server-only`.
  With no `TYPESAFE_API_KEY`, or with `JEV_MOCK=1`, it plugs the mock from
  `src/lib/jev/mock.ts` into the SDK's `fetch` option, so the whole SDK path
  still runs. Playwright's web server always sets `JEV_MOCK=1`.
- `src/lib/jev/prompt.ts`: builds the System One request. Choice labels are SAN
  moves, and each description says what the move does. The state holds the FEN,
  side to move, check, material balance and the last 16 moves.
- `src/lib/jev/decide.ts`: calls Jev, rejects any label that is not a legal
  move, applies difficulty with `select.ts`, and falls back to
  `heuristic.ts` with a plain-language reason when Jev fails.
- `src/hooks/use-jev-opponent.ts`: plays Jev's turns in the browser. A pending
  request is cancelled by undo, new game or a flag. Jev's moves wait at least
  500 ms so they do not feel instant.
- `src/components/chess/jev-panel.tsx`: the Jev panel and its candidate chart.
- The new game dialog lists vs Stockfish and Hybrid, disabled and marked
  "Soon". Enable them as each phase lands.

## What we know about Jev

Jev is TypeSafe AI's "System One" model, released in limited early access on
September 15, 2026. It does not generate text. It answers typed questions about
a given state and only ever returns one of the options it was given, with
probabilities. TypeSafe's docs site was unreachable from the build environment,
so everything below comes from the SDK's own README and type definitions.

- Package `@typesafe-ai/sdk`, version 0.6.0, installed. Node 20 or newer.
- The SDK returns the API's JSON body unchanged, so its TypeScript types are
  the wire format. The mock returns exactly that shape.
- `new TypeSafeClient()` reads `TYPESAFE_API_KEY`, and optionally
  `TYPESAFE_BASE_URL` (default `https://api.typesafe.ai`), `TYPESAFE_DEFAULT_MODEL`
  (default `jev-latest`) and `TYPESAFE_LOG_LEVEL`.
- `client.systemOne({ state, questions, model? })` posts to `/v1/systemone`.
  `state` is text, a JSON object or an array.
- Question helpers: `choice(instructions, { label: description | null })`,
  `score(instructions, [level0, level1, ...])` with at least two levels, and
  `noul(instructions, { true?, false? })` for yes or no.
- Answers are typed from the questions. A choice answer has `choice`,
  `confidence` and `probabilities`. A score answer has `score`, `confidence`,
  `legend` and `probabilities`. A yes or no answer has `noul`, the probability of yes.
- Defaults: 10 second timeout per attempt and 2 retries with backoff. Typed
  errors include `AuthenticationError`, `RateLimitError`, `APITimeoutError` and
  `APIConnectionError`.
- Browser use is off by default because it would expose the key.
- Unknown: the maximum number of choices per question, pricing, and rate limits.
  A position can have up to 218 legal moves, though most have 30 to 40. If there
  is a limit, shortlist moves before asking Jev.

Example, from the SDK README:

```ts
import { choice, TypeSafeClient } from "@typesafe-ai/sdk";

const client = new TypeSafeClient();
const response = await client.systemOne({
  state: { document: "I was charged twice. Please fix this ASAP." },
  questions: {
    category: choice("What is this ticket about?", { billing: null, technical: null, other: null }),
  },
});
console.log(response.answers.category.choice);
```

## Working notes

- Run `npm run check` for lint, type checks and unit tests, and
  `npm run test:e2e` for the build plus browser tests.
- Read the Next.js guide in `node_modules/next/dist/docs/` before writing
  Next.js code, as `AGENTS.md` asks. This version differs from older ones.
- The shadcn registry is blocked from the cloud environment, so `npx shadcn add`
  fails there. Fetch component sources from
  `https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/new-york-v4/ui/<name>.tsx`,
  then replace `from "cn"` with `from "@/lib/utils"` and `@/registry/new-york-v4/ui/`
  with `@/components/ui/`. On a normal machine `npx shadcn add` works.
- Playwright is pinned to 1.56.1 because that matches the Chromium preinstalled
  in the cloud environment. On a new machine run `npx playwright install chromium`.
- After a drag, dnd-kit ignores clicks for 50ms. Browser tests pause briefly
  after a drag for that reason. See `e2e/helpers.ts`.
- When stopping a stray Next.js server, match it with `pkill -f "[n]ext-server"`
  so the pattern cannot match the shell running the command.
