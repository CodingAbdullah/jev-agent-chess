import { expect, test, type Page } from "@playwright/test";
import { currentFen, play, preferLocalMode, status, typeMove } from "./helpers";

// The test server always runs the mock Jev (JEV_MOCK=1 in playwright.config.ts).

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// Légal's mate: 13 plies ending in checkmate.
const LEGAL_MATE = ["e4", "e5", "Nf3", "d6", "Bc4", "Bg4", "Nc3", "g6", "Nxe5", "Bxd1", "Bxf7+", "Ke7", "Nd5#"];
// Move 30, White to move. White is a rook and a pawn up.
const WHITE_WAY_AHEAD = "4k3/8/8/8/8/8/4P3/R3K3 w - - 0 30";
// Move 12, White to move, material level.
const LEVEL_MIDDLEGAME = "r1bq1rk1/pp2bppp/2n1pn2/3p4/3P4/2NBPN2/PP3PPP/R2QK2R w KQ - 2 12";
// Move 30, White to move. Black has a queen against a bare king.
const BLACK_WAY_AHEAD = "3qk3/8/8/8/8/8/8/4K3 w - - 0 30";

const actions = (page: Page) => page.getByTestId("game-actions");
const offerButton = (page: Page) => actions(page).getByRole("button", { name: "Offer draw" });

async function newGame(page: Page, mode: string) {
  await page.getByRole("button", { name: "New game" }).click();
  const dialog = page.getByRole("dialog", { name: "New game" });
  await dialog.getByRole("radio", { name: mode }).click();
  await dialog.getByRole("button", { name: "Start game" }).click();
  await expect(dialog).toBeHidden();
}

async function importFen(page: Page, fen: string) {
  await page.getByRole("button", { name: "FEN / PGN" }).click();
  const dialog = page.getByRole("dialog", { name: "Import and export" });
  await dialog.getByRole("tab", { name: "Import" }).click();
  await dialog.getByLabel("Paste a FEN or PGN").fill(fen);
  await dialog.getByRole("button", { name: "Load game" }).click();
  await expect(dialog).toBeHidden();
}

test.describe("two players", () => {
  test.beforeEach(async ({ page }) => {
    await preferLocalMode(page);
    await page.goto("/");
    await expect(status(page)).toHaveText("White to move.");
  });

  test("offers a draw that the other player declines, then accepts", async ({ page, isMobile }) => {
    await play(page, isMobile, "e2e4", "e7e5");
    await offerButton(page).click();
    await expect(page.getByTestId("draw-offer")).toContainText("White offers a draw. Black, do you accept?");
    await page.getByRole("button", { name: "Decline" }).click();
    await expect(page.getByTestId("draw-offer")).toHaveText("Black declined the draw.");
    // One offer per position.
    await expect(offerButton(page)).toBeDisabled();

    await play(page, isMobile, "g1f3");
    await expect(offerButton(page)).toBeEnabled();
    await offerButton(page).click();
    await page.getByRole("button", { name: "Accept draw" }).click();

    await expect(status(page)).toHaveText("Draw by agreement.");
    const gameOver = page.getByRole("dialog", { name: "Draw" });
    await expect(gameOver).toContainText("1/2-1/2");
  });

  test("a move withdraws a pending offer", async ({ page, isMobile }) => {
    await offerButton(page).click();
    await expect(page.getByTestId("draw-offer")).toContainText("White offers a draw.");
    await play(page, isMobile, "e2e4");
    await expect(page.getByTestId("draw-offer")).toBeEmpty();
  });

  test("the side to move resigns after confirming", async ({ page, isMobile }) => {
    await play(page, isMobile, "e2e4");
    await actions(page).getByRole("button", { name: "Resign" }).click();
    const confirm = page.getByRole("dialog", { name: "Resign as Black?" });
    await confirm.getByRole("button", { name: "Keep playing" }).click();
    await expect(confirm).toBeHidden();
    await expect(status(page)).toHaveText("Black to move.");

    await actions(page).getByRole("button", { name: "Resign" }).click();
    await page.getByRole("dialog", { name: "Resign as Black?" }).getByRole("button", { name: "Resign" }).click();
    await expect(status(page)).toHaveText("Black resigned. White wins.");
    const gameOver = page.getByRole("dialog", { name: "Resignation" });
    await expect(gameOver).toContainText("1-0");
    await gameOver.getByRole("button", { name: "Export PGN" }).click();
    await expect(page.getByRole("dialog", { name: "Import and export" }).getByLabel("PGN", { exact: true })).toHaveValue(
      /\[Result "1-0"\][\s\S]*1\. e4 1-0/,
    );
  });

  test("steps through a finished game", async ({ page }) => {
    for (const move of LEGAL_MATE) await typeMove(page, move);
    const finalFen = await currentFen(page);
    await page.getByRole("dialog", { name: "Checkmate" }).getByRole("button", { name: "View board" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const review = page.getByRole("toolbar", { name: "Review the game" });
    const position = page.getByTestId("review-position");
    await expect(position).toHaveText("Move 13 of 13, 7. Nd5#: White played Knight from c3 to d5, delivers checkmate.");
    await expect(review.getByRole("button", { name: "Next move" })).toBeDisabled();

    await review.getByRole("button", { name: "First position" }).click();
    expect(await currentFen(page)).toBe(START);
    await expect(position).toHaveText("Starting position.");

    await page.keyboard.press("ArrowRight");
    await expect(position).toHaveText("Move 1 of 13, 1. e4: White played Pawn from e2 to e4.");
    expect(await currentFen(page)).toContain("4P3");

    await page.getByRole("list", { name: "Move history" }).getByRole("button", { name: "Bxd1" }).click();
    await expect(position).toContainText("Move 10 of 13, 5… Bxd1: Black played Bishop from g4 to d1, captures a queen.");
    await expect(page.getByRole("button", { name: "Bxd1" })).toHaveAttribute("aria-current", "step");

    await page.keyboard.press("End");
    await expect(position).toContainText("Move 13 of 13");
    expect(await currentFen(page)).toBe(finalFen);
    // The result stands while reviewing.
    await expect(status(page)).toHaveText("Checkmate. White wins.");
  });
});

test.describe("against the computer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(status(page)).toHaveText("White to move.");
  });

  test("Jev declines a draw in the opening", async ({ page }) => {
    await offerButton(page).click();
    await expect(page.getByTestId("draw-offer")).toHaveText(
      "Jev declines: it is too early for a draw. Offers are considered from move 10.",
    );
    await expect(offerButton(page)).toBeDisabled();
  });

  test("Jev declines a level position and accepts a lost one", async ({ page }) => {
    await importFen(page, LEVEL_MIDDLEGAME);
    await offerButton(page).click();
    await expect(page.getByTestId("draw-offer")).toHaveText(/^Jev declines the draw \(\d+% for accepting\)\.$/, {
      timeout: 15_000,
    });

    await importFen(page, WHITE_WAY_AHEAD);
    await offerButton(page).click();
    await expect(status(page)).toHaveText("Draw by agreement.", { timeout: 15_000 });
    const gameOver = page.getByRole("dialog", { name: "Draw" });
    await expect(gameOver).toContainText(/Jev accepts the draw \(\d+% for accepting\)\./);
  });

  test("Stockfish declines when it is winning", async ({ page }) => {
    await newGame(page, "vs Stockfish");
    await importFen(page, BLACK_WAY_AHEAD);
    await offerButton(page).click();
    await expect(page.getByTestId("draw-offer")).toContainText("Stockfish declines", { timeout: 20_000 });
  });

  test("you resign against Jev", async ({ page, isMobile }) => {
    await play(page, isMobile, "e2e4");
    await actions(page).getByRole("button", { name: "Resign" }).click();
    await page.getByRole("dialog", { name: "Resign?" }).getByRole("button", { name: "Resign" }).click();
    await expect(status(page)).toHaveText("You resigned. Jev wins.");
    await expect(page.getByRole("dialog", { name: "Resignation" })).toContainText("Jev: Balanced, Medium");
  });

  test("shows Jev's own evaluation in Jev games", async ({ page }) => {
    await page.evaluate(() =>
      window.localStorage.setItem("jev-chess:settings", JSON.stringify({ mode: "jev", evaluationInComputerGames: true })),
    );
    await page.reload();
    await typeMove(page, "e4");
    await expect(page.getByTestId("jev-played")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("jev-evaluation")).toContainText(/about equal|better|winning/, { timeout: 15_000 });
    await expect(page.getByTestId("eval-bar")).toHaveAttribute("aria-label", /^Jev's evaluation: /);
    await expect(page.getByTestId("evaluation")).toContainText("Stockfish");
  });
});
