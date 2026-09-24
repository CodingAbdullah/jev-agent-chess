# jev-agent-chess

Agent-driven chess project written in TypeScript.

## Requirements

- Node.js 20 or newer (22 recommended, see `.nvmrc`)

## Getting started

```bash
npm install
npm run dev
```

## Scripts

| Script               | What it does                                   |
| -------------------- | ---------------------------------------------- |
| `npm run dev`        | Runs `src/index.ts` with tsx, reloading on save |
| `npm run build`      | Compiles `src/` to `dist/`                     |
| `npm start`          | Runs the compiled `dist/index.js`              |
| `npm run typecheck`  | Type-checks the project without emitting files |
| `npm test`           | Runs the Vitest suite once                     |
| `npm run test:watch` | Runs Vitest in watch mode                      |
| `npm run clean`      | Deletes `dist/`                                |

## Layout

```
src/     application source
tests/   Vitest test files
dist/    build output (git-ignored)
```
