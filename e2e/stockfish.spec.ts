import { expect, test, type Page } from "@playwright/test";
import { pieceOn, play, preferLocalMode, square, status } from "./helpers";

// These tests run the real Stockfish engine in the browser.

async function newStockfishGame(page: Page, options: { color?: string; difficulty?: string } = {}) {
  await page.getByRole("button", { name: "New game" }).click();
  const dialog = page.getByRole("dialog", { name: "New game" });
  await dialog.getByRole("radio", { name: "vs Stockfish" }).click();
  await expect(dialog.getByText("Jev's personality")).toHaveCount(0);
  if (options.color) await dialog.getByRole("radio", { name: options.color, exact: true }).click();
  if (options.difficulty) await dialog.getByRole("radio", { name: options.difficulty }).click();
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

const panel = (page: Page) => page.getByTestId("stockfish-panel");

test.describe("playing Stockfish", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(status(page)).toHaveText("White to move.");
  });

  test("Stockfish replies and shows its evaluation and plan", async ({ page, isMobile }) => {
    await newStockfishGame(page, { difficulty: "Medium" });
    await expect(page.getByTestId("game-mode")).toHaveText("vs Stockfish");
    await expect(panel(page)).toContainText("Skill 8 · depth 8");

    await play(page, isMobile, "e2e4");
    await expect(page.getByTestId("stockfish-played")).toBeVisible({ timeout: 15_000 });
    await expect(status(page)).toHaveText("White to move.");

    const played = await page.getByTestId("stockfish-played").textContent();
    await expect(page.getByRole("list", { name: "Move history" })).toContainText(`1.e4${played}`);
    await expect(page.getByTestId("stockfish-score")).toHaveText(/^[+-]?\d+\.\d\d$|^-?M\d+$|^0\.00$/);
  });

  test("undo takes back Stockfish's reply and your move", async ({ page, isMobile }) => {
    await newStockfishGame(page, { difficulty: "Easy" });
    await play(page, isMobile, "d2d4");
    await expect(page.getByTestId("stockfish-played")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("No moves yet.")).toBeVisible();
    await expect(pieceOn(page, "d2")).toHaveAttribute("data-piece", "wP");
  });

  test("Stockfish moves first when you play Black", async ({ page }) => {
    await newStockfishGame(page, { color: "Black", difficulty: "Hard" });
    await expect(page.getByTestId("stockfish-played")).toBeVisible({ timeout: 15_000 });
    await expect(status(page)).toHaveText("Black to move.");
    await expect(page.getByTestId("player-w")).toContainText("Stockfish");
    const a1 = (await square(page, "a1").boundingBox())!;
    const a8 = (await square(page, "a8").boundingBox())!;
    expect(a1.y).toBeLessThan(a8.y);
  });

  test("Stockfish finds a mate in one", async ({ page }) => {
    await newStockfishGame(page, { difficulty: "Hard" });
    await importFen(page, "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2");
    const gameOver = page.getByRole("dialog", { name: "Checkmate" });
    await expect(gameOver).toBeVisible({ timeout: 15_000 });
    await expect(gameOver).toContainText("Checkmate. Stockfish wins.");
    await expect(gameOver).toContainText("Stockfish: Hard");
  });
});

test.describe("evaluation bar", () => {
  test.beforeEach(async ({ page }) => {
    await preferLocalMode(page);
    await page.goto("/");
    await expect(status(page)).toHaveText("White to move.");
  });

  test("shows Stockfish's view of the position and follows the board when flipped", async ({ page }) => {
    const evaluation = page.getByTestId("evaluation");
    await expect(evaluation).toContainText("depth", { timeout: 15_000 });

    // White is a queen up.
    await importFen(page, "4k3/8/8/8/8/8/4P3/3QK3 w - - 0 1");
    await expect(evaluation).toContainText(/Evaluation (\+\d+\.\d\d|M\d+)/, { timeout: 15_000 });
    const bar = page.getByTestId("eval-bar");
    await expect.poll(async () => Number(await bar.getAttribute("data-white-share"))).toBeGreaterThan(0.9);
    await expect(bar).toHaveAttribute("aria-label", /White is winning|White mates/);

    const fill = bar.locator("div").first();
    await expect(fill).toHaveClass(/bottom-0/);
    await page.getByRole("button", { name: "Flip board" }).click();
    await expect(fill).toHaveClass(/top-0/);
  });

  test("shows the result once the game ends", async ({ page, isMobile }) => {
    await play(page, isMobile, "f2f3", "e7e5", "g2g4", "d8h4");
    await page.getByRole("dialog", { name: "Checkmate" }).getByRole("button", { name: "View board" }).click();
    await expect(page.getByTestId("evaluation")).toHaveText("Evaluation 0-1");
    await expect(page.getByTestId("eval-bar")).toHaveAttribute("data-white-share", "0.000");
  });

  test("can be turned off in settings", async ({ page }) => {
    await expect(page.getByTestId("eval-bar")).toBeVisible();
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("switch", { name: "Evaluation bar" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("eval-bar")).toHaveCount(0);
    await expect(page.getByTestId("evaluation")).toHaveCount(0);
  });
});

test("serves Stockfish's GPL licence next to the engine", async ({ request }) => {
  const response = await request.get("/stockfish/Copying.txt");
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain("GNU GENERAL PUBLIC LICENSE");
});
