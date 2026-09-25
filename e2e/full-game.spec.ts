import { expect, test, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { currentFen, preferLocalMode, status, typeMove } from "./helpers";

// Légal's mate: captures, a queen sacrifice, check and checkmate in 13 plies.
const LEGAL_MATE = ["e4", "e5", "Nf3", "d6", "Bc4", "Bg4", "Nc3", "g6", "Nxe5", "Bxd1", "Bxf7+", "Ke7", "Nd5#"];

test("plays a whole two-player game by typing moves", async ({ page }) => {
  await preferLocalMode(page);
  await page.goto("/");
  await expect(status(page)).toHaveText("White to move.");

  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  for (const move of LEGAL_MATE) await typeMove(page, move);

  const gameOver = page.getByRole("dialog", { name: "Checkmate" });
  await expect(gameOver).toContainText("Checkmate. White wins.");
  await gameOver.getByRole("button", { name: "Export PGN" }).click();
  await expect(page.getByRole("dialog", { name: "Import and export" }).getByLabel("PGN", { exact: true })).toHaveValue(
    /1\. e4 e5 2\. Nf3 d6 3\. Bc4 Bg4 4\. Nc3 g6 5\. Nxe5 Bxd1 6\. Bxf7\+ Ke7 7\. Nd5# 1-0/,
  );
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("move-announcement")).toHaveText(
    "White played Knight from c3 to d5, delivers checkmate.",
  );
  await expect(page.getByRole("textbox", { name: "Type a move" })).toBeDisabled();
  expect(errors).toEqual([]);
});

test("explains a typed move that is not legal", async ({ page }) => {
  await preferLocalMode(page);
  await page.goto("/");
  await typeMove(page, "e5");
  await expect(page.getByRole("form", { name: "Type a move" }).getByRole("alert")).toHaveText(
    "e5 is not a legal move here.",
  );
  await typeMove(page, "nf3");
  await expect(status(page)).toHaveText("Black to move.");
});

/**
 * Pick the human's move without an engine: the most valuable capture if there
 * is one, otherwise a move chosen by a fixed rule so runs are repeatable.
 */
function chooseMove(fen: string, ply: number): string {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  const value: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const captures = moves.filter((move) => move.captured).sort((a, b) => value[b.captured!]! - value[a.captured!]!);
  return (captures[0] ?? moves[(ply * 7) % moves.length]!).san;
}

async function playAgainstComputer(page: Page, mode: string, testId: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "New game" }).click();
  const dialog = page.getByRole("dialog", { name: "New game" });
  await dialog.getByRole("radio", { name: mode }).click();
  await dialog.getByRole("radio", { name: "Easy" }).click();
  await dialog.getByRole("button", { name: "Start game" }).click();

  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));

  const history = page.getByRole("list", { name: "Move history" });
  let plies = 0;
  for (let turn = 0; turn < 12; turn++) {
    const fen = await currentFen(page);
    if (new Chess(fen).isGameOver()) break;
    await typeMove(page, chooseMove(fen, turn));
    plies += 1;
    // Wait for the computer's reply, or for the game to end on our move.
    await expect
      .poll(async () => {
        const chess = new Chess(await currentFen(page));
        return chess.isGameOver() || chess.turn() === "w";
      }, { timeout: 20_000 })
      .toBe(true);
    if (new Chess(await currentFen(page)).turn() === "w") plies += 1;
    if (await page.getByRole("dialog").count()) break;
  }

  // A finished game opens a modal dialog, which hides the rest of the page
  // from role queries. Close it before reading the history.
  if (await page.getByRole("dialog").count()) {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }

  // Every move made it into the history, and the computer's panel kept up.
  const cells = history.locator("[data-ply]");
  await expect(cells).toHaveCount(plies);
  await expect(page.getByTestId(testId)).toBeVisible();
  expect(errors).toEqual([]);
}

test("plays a long game against Jev without errors", async ({ page }) => {
  await playAgainstComputer(page, "vs Jev", "jev-played");
});

test("plays a long game against Stockfish without errors", async ({ page }) => {
  await playAgainstComputer(page, "vs Stockfish", "stockfish-played");
});

test("plays a long hybrid game without errors", async ({ page }) => {
  await playAgainstComputer(page, "Hybrid", "hybrid-played");
});
