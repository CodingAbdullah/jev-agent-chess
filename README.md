# Jev Chess

A chess web app where you play against TypeSafe AI's Jev, Stockfish, or a hybrid of both. Built end to end in TypeScript.

## Stack

- [Next.js](https://nextjs.org) with the App Router, React and TypeScript
- [Tailwind CSS](https://tailwindcss.com) and [shadcn/ui](https://ui.shadcn.com)
- [chess.js](https://github.com/jhlywa/chess.js) for the rules of chess
- [react-chessboard](https://github.com/Clariity/react-chessboard) for the board
- [Vitest](https://vitest.dev) with Testing Library for unit tests
- [Playwright](https://playwright.dev) for end-to-end tests

## Current features

- Local two-player games on one device
- Move by clicking or by dragging pieces
- Legal-move dots, capture rings, and last-move and check highlights
- Castling, en passant, and promotion with a piece picker
- Checkmate and every draw rule: stalemate, insufficient material, threefold repetition and the fifty-move rule
- New game at any time

Jev and Stockfish opponents arrive in later build phases.

## Requirements

- Node.js 20.9 or newer, 22 recommended (see `.nvmrc`)

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

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

Before the first end-to-end run on a new machine, install the browser Playwright needs:

```bash
npx playwright install chromium
```

## Adding UI components

shadcn/ui is configured in `components.json`. Add components with:

```bash
npx shadcn@latest add dialog
```

## Layout

```
src/app/               pages, layouts and global styles
src/components/chess/  board, promotion picker and game screen
src/components/ui/     shadcn/ui components
src/hooks/             React hooks, including the game state hook
src/lib/chess/         chess rules and game status helpers, free of React
src/lib/               shared helpers
e2e/                   Playwright tests
```

Unit tests sit next to the code they test, named `*.test.ts` or `*.test.tsx`.
