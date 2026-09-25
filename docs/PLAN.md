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
| Engine      | stockfish 19 Lite (WASM)        | Browser Web Worker. GPL-3.0                 |
| Tests       | Vitest, Testing Library, Playwright 1.56.1 | Playwright is pinned on purpose  |

## Phases

| Phase | Scope | Status |
| ----- | ----- | ------ |
| 1 | Convert the scaffold to Next.js with Tailwind, shadcn/ui, Vitest and Playwright | Done |
| 2 | Board, legal-move highlights, check and checkmate, castling, promotion, en passant, local two-player play | Done |
| 3 | Clocks, move history, captured pieces, undo, FEN and PGN import and export, board flip, themes, sound, game-over dialog, phone layout | Done |
| 4 | Jev mode: server route, personalities, difficulty, Jev panel, fallback on failure or timeout | Done, checked against the live API |
| 5 | Stockfish mode: Web Worker, Stockfish-only play, evaluation bar | Done |
| 6 | Hybrid mode: Stockfish shortlists candidate moves and Jev picks one | Done, checked against the live API |
| 7 | Polish: end-to-end tests of full games, accessibility, final phone pass | Done |

Each phase ends with lint, type checks, unit tests, the production build and the
browser tests all passing, then one commit pushed to the working branch.

## Next step

Steps 1 and 2, and 5 to 9, are done. What remains needs the owner, or is a new
feature.

1. **Done: phase 4 against the live API.** `npm run jev:smoke` and
   `npm run jev:live` pass with a real key: model `jev-1.13.0`, answers in 150
   to 500 ms. The live checks solve four mates and captures at 87 to 98
   percent, and hybrid mode picks from Stockfish's shortlist. What changed:
   `MAX_CHOICES` went from 60 to the API's real limit, and each choice now
   says whether the moved piece can be taken. Errors come back as the SDK's
   typed errors: 401 `AuthenticationError` for a bad key, 400 for more than
   255 choices. A 429 has not been seen yet, so `Retry-After` from the API is
   untested.
2. **Done: shared rate limits.** See "Shared rate limits through Upstash
   Redis" under design decisions.
3. **Deployment:** the owner deploys to Vercel and publishes the project as
   open source. For a public Vercel deployment, add Upstash Redis from the
   project's Storage tab so the rate limits hold across instances.
4. **Merge the working branch into `main`.** All the work so far is on
   `claude/typescript-project-scaffold-tgecg6`. The owner opens a pull request
   into `main` and merges it. CI, the Docker publish workflow and Dependabot
   run from `main`, so they do nothing until this happens. Vercel should
   deploy from `main` as well. Then:
   - Turn on private vulnerability reporting under Settings, then Security.
   - After the first Docker publish, set the package to public under the
     GitHub profile's Packages tab.
5. **Done: CI** in `.github/workflows/ci.yml`: `npm run check`, the browser
   tests with the report uploaded on failure, a Docker build, and ShellCheck
   and PSScriptAnalyzer on the setup scripts. It uses no secrets, so pull
   requests from forks never see `TYPESAFE_API_KEY`. The owner's
   `react-doctor.yml` runs beside it.
6. **Done: Docker image on GHCR** in `.github/workflows/docker-publish.yml`.
   Version tags publish `1.2.3`, `1.2` and `latest`; pushes to `main` publish
   `main`. It builds for amd64 and arm64 and logs in with `GITHUB_TOKEN`.
7. **Done: release steps**, described in `CONTRIBUTING.md`: `npm version`,
   `git push --follow-tags`, then `gh release create`.
8. **Done: `CONTRIBUTING.md`**, linked from the README.
9. **Done: `SECURITY.md` and `.github/dependabot.yml`.** Dependabot groups
   npm minor and patch updates, and ignores `@playwright/test`.
10. **Ideas not yet built:** resign and draw offers, a review mode for stepping
    through finished games, and a Jev score question for the evaluation bar in
    Jev games.

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
- **Jev sees every legal move.** The live API accepts at most 255 choices per
  question and answers 400 above that; no position has more than 218 legal
  moves. `MAX_CHOICES` is 255, so the cap only guards the limit.
- **Each Jev-only choice says whether the moved piece can be taken** where it
  lands, by the cheapest attacker, and whether it is defended ("there it can
  be taken by a pawn and is not defended"). Without it, live Jev's Balanced
  personality chose unsound sacrifices such as Bxf7+ in the Italian Game; with
  it, Balanced castles. Hybrid choices skip it, since Stockfish's evaluation
  covers it. The mock reads these notes too.
- **Evaluation bar** comes from a separate background Stockfish worker. It
  shows in two-player games and once a game against the computer ends. While
  playing the computer, hints stay hidden unless the player turns on "Also
  during games against the computer": the bar and caption, the Stockfish
  panel's evaluation and expected line, and the hybrid panel's Stockfish
  scores. The background worker does not run while they are hidden.
- **Rate limiting** on `/api/jev/move`: a token bucket per client address (30
  a minute) and a global one (300 a minute), set by `JEV_RATE_LIMIT_PER_MINUTE`
  and `JEV_GLOBAL_RATE_LIMIT_PER_MINUTE`. Over the limit returns 429 with
  `Retry-After`, which the panels show with a retry button. Playwright's web
  server lifts both limits.
- **Shared rate limits through Upstash Redis.** With `UPSTASH_REDIS_REST_URL`
  and `_TOKEN`, or Vercel's `KV_REST_API_URL` and `_TOKEN`, the same token
  bucket runs as one Lua script in Redis over Upstash's REST API, with Redis's
  clock, so every instance shares it. There is no Redis package and no open
  connection, which suits serverless functions. If Redis fails or takes over a
  second, the in-memory limiter answers and a warning is logged at most once a
  minute: an outage weakens the limit, it never blocks games. Tested against
  real Redis through Upstash's local HTTP emulator (SRH).
- **Keyboard and screen readers:** a "Type a move" box under the board accepts
  SAN or coordinates. Board pieces get names such as "White knight on g1",
  and each move is announced in plain words in a polite live region. Board
  animations turn off when the system asks for reduced motion.
- **Hybrid mode** runs Stockfish in the browser at full skill with MultiPV 5,
  then sends the shortlist to the same Jev route as optional `candidates`. The
  route re-checks every candidate against chess.js and drops illegal ones, and
  each choice description adds Stockfish's rank, its evaluation from the
  mover's side, and the reply it expects. Difficulty sets Stockfish's depth
  (6, 10 or 16) and Jev's sampling, as in Jev mode. If Jev fails, Stockfish's
  top choice is played. With only one candidate, Jev is not asked.
- **Stockfish difficulty** uses Skill Level and search limits: Easy is skill 2
  at depth 4, Medium skill 8 at depth 8, Hard skill 20 at depth 16, each with a
  time cap of 0.4, 0.8 and 1.5 seconds.
- **Stockfish** runs in the browser in a Web Worker, using the lite
  single-threaded build. It is about 1.6MB and needs no special server headers.
- **The project is licensed GPL-3.0-or-later**, switched from MIT in phase 7 at
  the owner's request, because it ships Stockfish, which is GPL-3.0. Anyone who
  distributes the app must offer its source under the GPL.
- **Setup scripts, done:** `scripts/setup.sh` for macOS and Linux and
  `scripts/setup.ps1` for Windows PowerShell 5.1 and PowerShell 7 behave the
  same way. `local` writes `.env.local` and `docker` writes `.env`, each
  copied from `.env.example` if missing, keeping other settings when the file
  exists. The key is read at a hidden prompt, never as an argument, so it
  stays out of shell history and process lists; empty means the mock. Keys
  with spaces, `#`, `$`, quotes or backslashes are refused, since env files
  cannot hold them as typed. `--start` / `-Start` installs and runs
  `npm run dev`, or runs `docker compose up --build -d` and waits for the
  page. `cloud` and `vercel` only print the steps, because those keys are
  set in the Claude and Vercel settings, which no repository script can reach.
  `.gitattributes` keeps `.sh` files on LF so they run after a Windows
  checkout.
- **No npm package for the app.** It is a whole web app, not a library, so
  it is shared as a prebuilt Docker image on GHCR, the Deploy to Vercel
  button, and the source for anyone who wants to modify it. Parts such as
  the Jev move picker or the Stockfish worker wrapper could become npm
  libraries later if other projects want to reuse them.

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
- `src/components/chess/jev-panel.tsx`: the Jev panel and its candidate chart.
- `scripts/copy-stockfish.mjs`: copies the engine's JS, WASM and GPL licence
  into `public/stockfish/`, which git ignores. It runs on `postinstall`,
  `predev` and `prebuild`. The loader finds its WASM by swapping `.js` for
  `.wasm` in its own URL, so the two files must stay side by side.
- `src/lib/stockfish/uci.ts`: pure UCI helpers: parsing `info` and `bestmove`,
  scores from White's side, evaluation bar share, and the difficulty levels.
- `src/lib/stockfish/engine.ts`: `StockfishEngine` wraps one Web Worker. It
  runs searches one at a time, sends `stop` on cancel and waits for `bestmove`
  so the engine stays in sync. Tests drive it with a fake worker.
- `src/hooks/use-ai-opponent.ts`: the shared turn-taking hook for Jev and
  Stockfish. It takes a `think` function and handles cancellation, retries and
  the decision history for the panels.
- `src/hooks/use-stockfish.ts`: `useStockfishEngine` owns a worker's lifetime,
  and `useEvaluation` streams the background analysis for the evaluation bar.
- The settings field `jevColor` was renamed `playerColor`. Older saved
  settings are migrated when read.
- `src/lib/hybrid.ts`: hybrid move flow in the browser. It builds the
  shortlist from Stockfish's MultiPV lines, turns scores to White's side, asks
  the Jev route, and merges Jev's probabilities into the shortlist.
- `src/lib/jev/decide.ts` `hybridCandidates`: maps the shortlist to legal
  moves on the server. `src/lib/jev/validate.ts` checks the shortlist's shape:
  at most 8 candidates, UCI moves, integer scores and SAN lines.
- `src/components/chess/hybrid-panel.tsx`: the hybrid panel. Stockfish and
  hybrid games share one engine worker for the computer's moves.
- Every game mode in the new game dialog is now available.
- `src/lib/rate-limit.ts`: the token-bucket limiter in memory, the same bucket
  in Upstash Redis (`RedisRateLimiter`), and the client key.
- `src/lib/chess/describe.ts`: plain-language move descriptions, shared by the
  Jev prompt and the screen reader announcements.
- `src/components/chess/move-entry.tsx`: the typed move box, using
  `parseTypedMove` from `game.ts`.
- The logo is a king. `src/app/icon.svg` is the browser tab icon, and
  `src/components/chess/logo.tsx` draws the same king in the header in the
  text colour. Change both together.
- `src/app/icon.svg`, `error.tsx` and `not-found.tsx`: app icon and error pages.
  This Next.js version passes `retry`, not `reset`, to error pages.
- `Dockerfile`, `compose.yaml`, `.dockerignore` and `.env.example`: container
  build with Next.js standalone output, enabled only when
  `BUILD_STANDALONE=1`, so Vercel and `npm start` use the default output. The
  dependency stage installs with `--ignore-scripts`, and `npm run build` then
  copies the Stockfish engine in its prebuild step. The image runs as `node`,
  has a health check, and holds no secrets.
- `scripts/setup.sh` and `scripts/setup.ps1`: the setup scripts described
  under design decisions. `.gitattributes` keeps `.sh` files on LF.
- The board exposes the current position as `data-fen`, which the full-game
  browser tests read to choose legal moves.

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
- Measured on September 24, 2026 against model `jev-1.13.0`: at most 255
  choices per question (400 "Too many choices" above that), and 150 to 500 ms
  per answer whether a question has 40 choices or 218. Usage grows by about 20
  input and 10 output tokens per choice. A bad key returns 401. Probabilities
  are rounded to two decimals, so small ones read as 0.
- Still unknown: pricing, and the API's own rate limits.
- `npm run jev:live` (`src/lib/jev/live.test.ts`) runs puzzles, a hybrid
  shortlist and every personality against the live API. `npm test` skips it.

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
- ESLint ignores `public/stockfish/**`, the minified third-party engine.
- `e2e/a11y.spec.ts` runs axe's WCAG 2.2 A and AA rules on every screen and
  dialog in light and dark mode. Keep it passing when adding UI.
- Next.js adds its own hidden `role="alert"` region, so scope alert locators in
  tests to the component under test.
- Docker works in the cloud environment after starting `dockerd`, but builds
  need `--network host`, the sandbox CA as a build secret and the proxy passed
  in. Use a scratch copy of the Dockerfile for that; never commit those
  workarounds.
- PowerShell is not installed in the cloud environment. To test
  `scripts/setup.ps1`, download the Linux `powershell-7.x-linux-x64.tar.gz`
  from GitHub releases into the scratchpad and run it with `-File`. Test the
  Docker start path with a scratch Compose override passed in `COMPOSE_FILE`
  that points at the scratch Dockerfile, so the script itself runs unchanged.
- When changing either setup script, change the other to match.
- When stopping a stray Next.js server, match it with `pkill -f "[n]ext-server"`
  so the pattern cannot match the shell running the command.
