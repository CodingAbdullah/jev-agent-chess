import { expect, test, type Page } from "@playwright/test";
import { pieceOn, play, square, status } from "./helpers";

// The test server always runs the mock Jev (JEV_MOCK=1 in playwright.config.ts).

const panel = (page: Page) => page.getByTestId("jev-panel");
const history = (page: Page) => page.getByRole("list", { name: "Move history" });

/** Wait until Jev has answered and it is the human's turn again. */
async function waitForJev(page: Page, humanTurnText: string) {
  await expect(page.getByTestId("jev-played")).toBeVisible({ timeout: 10_000 });
  await expect(status(page)).toHaveText(humanTurnText);
}

async function newJevGame(page: Page, options: { color?: string; personality?: string; difficulty?: string }) {
  await page.getByRole("button", { name: "New game" }).click();
  const dialog = page.getByRole("dialog", { name: "New game" });
  await dialog.getByRole("radio", { name: "vs Jev" }).click();
  if (options.color) await dialog.getByRole("radio", { name: options.color, exact: true }).click();
  if (options.personality) await dialog.getByRole("radio", { name: options.personality }).click();
  if (options.difficulty) await dialog.getByRole("radio", { name: options.difficulty }).click();
  await dialog.getByRole("button", { name: "Start game" }).click();
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(status(page)).toHaveText("White to move.");
});

test("Jev replies to your move and explains its choice", async ({ page, isMobile }) => {
  await expect(page.getByTestId("game-mode")).toHaveText("vs Jev");
  await expect(page.getByTestId("jev-state")).toHaveText("Waiting for your first move.");

  await play(page, isMobile, "e2e4");
  await waitForJev(page, "White to move.");

  const played = await page.getByTestId("jev-played").textContent();
  await expect(history(page)).toContainText(`1.e4${played}`);
  await expect(page.getByTestId("jev-source")).toHaveText("Mock");
  await expect(page.getByTestId("jev-confidence")).toHaveText(/^\d{1,3}%$/);
  const candidates = page.getByTestId("jev-candidates").getByRole("listitem");
  expect(await candidates.count()).toBeGreaterThan(0);
  expect(await candidates.count()).toBeLessThanOrEqual(5);
  await expect(page.getByTestId("jev-candidates")).toContainText(`${played} (played)`);
});

test("undo takes back Jev's reply and your move", async ({ page, isMobile }) => {
  await play(page, isMobile, "e2e4");
  await waitForJev(page, "White to move.");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("No moves yet.")).toBeVisible();
  await expect(pieceOn(page, "e2")).toHaveAttribute("data-piece", "wP");
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  // It is your turn again, so Jev stays quiet.
  await expect(page.getByTestId("jev-state")).toHaveText("Waiting for your first move.");
});

test("does not let you move Jev's pieces", async ({ page, isMobile }) => {
  await play(page, isMobile, "e2e4");
  await waitForJev(page, "White to move.");
  const blackPawn = square(page, "a7");
  if (isMobile) await blackPawn.tap();
  else await blackPawn.click();
  await expect(square(page, "a6")).not.toHaveCSS("background-image", /radial-gradient/);
});

test("Jev moves first when you play Black, and the board turns around", async ({ page }) => {
  await newJevGame(page, { color: "Black", personality: "Aggressive", difficulty: "Hard" });
  await waitForJev(page, "Black to move.");

  await expect(page.getByTestId("player-b")).toContainText("You");
  await expect(page.getByTestId("player-w")).toContainText("Jev");
  await expect(panel(page)).toContainText("Plays White");
  await expect(panel(page)).toContainText("Aggressive");
  await expect(panel(page)).toContainText("Hard");
  const a1 = (await square(page, "a1").boundingBox())!;
  const a8 = (await square(page, "a8").boundingBox())!;
  expect(a1.y).toBeLessThan(a8.y);
});

test("Jev finds a mate in one and the game ends", async ({ page }) => {
  // Fool's mate position with Black, played by Jev, to move.
  await page.getByRole("button", { name: "FEN / PGN" }).click();
  const dialog = page.getByRole("dialog", { name: "Import and export" });
  await dialog.getByRole("tab", { name: "Import" }).click();
  await dialog
    .getByLabel("Paste a FEN or PGN")
    .fill("rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2");
  await dialog.getByRole("button", { name: "Load game" }).click();

  const gameOver = page.getByRole("dialog", { name: "Checkmate" });
  await expect(gameOver).toBeVisible({ timeout: 10_000 });
  await expect(gameOver).toContainText("Checkmate. Jev wins.");
  await expect(gameOver).toContainText("Jev: Balanced, Medium");
  await gameOver.getByRole("button", { name: "Export PGN" }).click();
  const pgn = page.getByRole("dialog", { name: "Import and export" }).getByLabel("PGN", { exact: true });
  await expect(pgn).toHaveValue(/\[Black "Jev \(Balanced, Medium\)"\]/);
  await expect(pgn).toHaveValue(/Qh4# 0-1/);
});

test("switching to two players stops Jev", async ({ page, isMobile }) => {
  await page.getByRole("button", { name: "New game" }).click();
  const dialog = page.getByRole("dialog", { name: "New game" });
  await dialog.getByRole("radio", { name: "2 Players" }).click();
  await dialog.getByRole("button", { name: "Start game" }).click();

  await expect(panel(page)).toHaveCount(0);
  await play(page, isMobile, "e2e4");
  await expect(status(page)).toHaveText("Black to move.");
  await page.waitForTimeout(1_000);
  await expect(status(page)).toHaveText("Black to move.");
});
