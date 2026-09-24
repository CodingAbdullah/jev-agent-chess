import { expect, test, type Page } from "@playwright/test";
import { pieceOn, play, status } from "./helpers";

// Real Stockfish in the browser, with the mock Jev on the server (JEV_MOCK=1).

async function newHybridGame(page: Page, options: { color?: string; personality?: string; difficulty?: string } = {}) {
  await page.getByRole("button", { name: "New game" }).click();
  const dialog = page.getByRole("dialog", { name: "New game" });
  await dialog.getByRole("radio", { name: "Hybrid" }).click();
  await expect(dialog.getByText("Jev's personality")).toBeVisible();
  await expect(dialog.getByText(/Stockfish shortlists 5 moves/)).toBeVisible();
  if (options.color) await dialog.getByRole("radio", { name: options.color, exact: true }).click();
  if (options.personality) await dialog.getByRole("radio", { name: options.personality }).click();
  if (options.difficulty) await dialog.getByRole("radio", { name: options.difficulty }).click();
  await dialog.getByRole("button", { name: "Start game" }).click();
  await expect(dialog).toBeHidden();
}

const played = (page: Page) => page.getByTestId("hybrid-played");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(status(page)).toHaveText("White to move.");
});

test("Stockfish shortlists moves and Jev picks one", async ({ page, isMobile }) => {
  await newHybridGame(page, { personality: "Tactical", difficulty: "Medium" });
  await expect(page.getByTestId("game-mode")).toHaveText("Hybrid");
  await expect(page.getByTestId("player-b")).toContainText("Jev + Stockfish");

  await play(page, isMobile, "e2e4");
  await expect(played(page)).toBeVisible({ timeout: 15_000 });
  await expect(status(page)).toHaveText("White to move.");

  const san = await played(page).textContent();
  await expect(page.getByRole("list", { name: "Move history" })).toContainText(`1.e4${san}`);
  await expect(page.getByTestId("hybrid-source")).toHaveText("Mock");
  await expect(page.getByTestId("hybrid-summary")).toHaveText(/Jev chose Stockfish's \w+ choice\./);

  const rows = page.getByTestId("hybrid-shortlist").getByRole("listitem");
  expect(await rows.count()).toBeGreaterThanOrEqual(2);
  expect(await rows.count()).toBeLessThanOrEqual(5);
  await expect(page.getByTestId("hybrid-shortlist").getByRole("listitem").filter({ hasText: "played" })).toContainText(
    san!,
  );
  await expect(rows.first()).toContainText(/Jev \d+%/);
  // Stockfish's scores are hints, so they stay hidden until the game ends.
  await expect(page.getByTestId("hybrid-shortlist")).not.toContainText("Stockfish");
});

test("undo takes back the hybrid reply and your move", async ({ page, isMobile }) => {
  await newHybridGame(page, { difficulty: "Easy" });
  await play(page, isMobile, "d2d4");
  await expect(played(page)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("No moves yet.")).toBeVisible();
  await expect(pieceOn(page, "d2")).toHaveAttribute("data-piece", "wP");
});

test("moves first when you play Black", async ({ page }) => {
  await newHybridGame(page, { color: "Black", personality: "Defensive" });
  await expect(played(page)).toBeVisible({ timeout: 15_000 });
  await expect(status(page)).toHaveText("Black to move.");
  await expect(page.getByTestId("hybrid-panel")).toContainText("Plays White");
  await expect(page.getByTestId("hybrid-panel")).toContainText("Defensive");
});

test("finds a mate in one from Stockfish's shortlist", async ({ page }) => {
  await newHybridGame(page, { difficulty: "Hard" });
  await page.getByRole("button", { name: "FEN / PGN" }).click();
  const dialog = page.getByRole("dialog", { name: "Import and export" });
  await dialog.getByRole("tab", { name: "Import" }).click();
  await dialog
    .getByLabel("Paste a FEN or PGN")
    .fill("rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2");
  await dialog.getByRole("button", { name: "Load game" }).click();

  const gameOver = page.getByRole("dialog", { name: "Checkmate" });
  await expect(gameOver).toBeVisible({ timeout: 15_000 });
  await expect(gameOver).toContainText("Checkmate. Jev + Stockfish wins.");
  await expect(gameOver).toContainText("Jev + Stockfish: Balanced, Hard");
});
