# Contributing to Jev Chess

Thanks for helping. This guide covers setting up, checking your change, and
how releases are made.

## Setting up

You need Node.js 22 (see `.nvmrc`; 20.9 or newer works).

```bash
git clone https://github.com/CodingAbdullah/jev-agent-chess.git
cd jev-agent-chess
./scripts/setup.sh local          # or .\scripts\setup.ps1 local on Windows
npm run dev
```

The setup script creates `.env.local` and asks for a TypeSafe key at a hidden
prompt. Press Enter to skip it. You can also copy `.env.example` to
`.env.local` by hand.

**You do not need an API key.** Without one the app uses a local mock Jev that
answers in the real API's format, so every mode works, and all the tests use
the mock too. If you do have a key, `npm run jev:smoke` and `npm run jev:live`
check the real API.

Read [docs/PLAN.md](docs/PLAN.md) for the design decisions and the current
architecture before larger changes.

## Before opening a pull request

Run these, and make sure they pass:

```bash
npm run check        # lint, type checks and unit tests
npm run test:e2e     # production build and browser tests
```

Before the first browser test run, install Chromium with
`npx playwright install chromium`. CI runs the same checks, plus a Docker
build and checks of the setup scripts, on every pull request.

Please also:

- **Keep the accessibility tests passing.** `e2e/a11y.spec.ts` runs axe's
  WCAG 2.2 A and AA rules on every screen and dialog in light and dark mode.
  New UI should be usable with a keyboard and a screen reader.
- **Add tests** for new behaviour: unit tests next to the code in `src/`, and
  browser tests in `e2e/` for anything a player sees.
- **Change both setup scripts together.** `scripts/setup.sh` and
  `scripts/setup.ps1` behave the same way.
- **Let chess.js decide legality.** Every move from Jev or Stockfish is checked
  by chess.js before it reaches the board.
- **Keep `@playwright/test` at its pinned version** unless you are deliberately
  updating the browser environment.

## Never commit keys

The TypeSafe key is read only on the server, from `TYPESAFE_API_KEY`. Keep it
in `.env.local` or `.env`, which git ignores, or in your hosting platform's
settings. Never put it in code, tests, issues or screenshots. If a key leaks,
revoke it in TypeSafe's dashboard straight away; see [SECURITY.md](SECURITY.md).

## Licence

Jev Chess is licensed under GPL-3.0-or-later, because it ships Stockfish,
which is GPL-3.0. By contributing, you agree that your contribution is
licensed under GPL-3.0-or-later too.

## Making a release

For maintainers. Releases are made from `main`.

1. Make sure `main` is green in CI.
2. Bump the version. This updates `package.json` and `package-lock.json`,
   commits, and creates the matching `vX.Y.Z` tag:

   ```bash
   npm version patch    # or minor, or major
   ```

3. Push the commit and the tag. The tag starts the Docker publish workflow,
   which pushes `ghcr.io/codingabdullah/jev-agent-chess` tagged with the
   version and `latest`:

   ```bash
   git push --follow-tags
   ```

4. Create a GitHub release for the tag, with short notes on what changed:

   ```bash
   gh release create vX.Y.Z --generate-notes
   ```

`package.json` keeps `"private": true`, so the app is never published to npm
by mistake. After the very first image is published, set the package to public
under the GitHub profile's **Packages** tab, so anyone can pull it without
logging in.
