import { expect, test } from "@playwright/test";
import { pieceOn, play, preferLocalMode, square, startNewGame, status } from "./helpers";

const clockOf = (page: import("@playwright/test").Page, side: "White" | "Black") =>
  page.getByRole("timer", { name: `${side} clock` });

test.describe("with the real clock", () => {
  test.beforeEach(async ({ page }) => {
    await preferLocalMode(page);
    await page.goto("/");
    await expect(status(page)).toHaveText("White to move.");
  });

  test("records moves in the history and undoes them", async ({ page, isMobile }) => {
    const undo = page.getByRole("button", { name: "Undo" });
    await expect(undo).toBeDisabled();
    await play(page, isMobile, "e2e4", "e7e5", "g1f3");

    const history = page.getByRole("list", { name: "Move history" });
    await expect(history).toContainText("1.e4e5");
    await expect(history).toContainText("2.Nf3");
    await expect(history.locator('[aria-current="step"]')).toHaveText("Nf3");

    await undo.click();
    await expect(history).not.toContainText("Nf3");
    await expect(pieceOn(page, "g1")).toHaveAttribute("data-piece", "wN");
    await expect(status(page)).toHaveText("White to move.");
  });

  test("flips the board and the player bars", async ({ page }) => {
    const a1 = await square(page, "a1").boundingBox();
    const a8 = await square(page, "a8").boundingBox();
    expect(a1!.y).toBeGreaterThan(a8!.y);
    const whiteBarBelow = async () =>
      (await page.getByTestId("player-w").boundingBox())!.y >
      (await page.getByTestId("player-b").boundingBox())!.y;
    expect(await whiteBarBelow()).toBe(true);

    await page.getByRole("button", { name: "Flip board" }).click();
    await expect
      .poll(async () => (await square(page, "a1").boundingBox())!.y < (await square(page, "a8").boundingBox())!.y)
      .toBe(true);
    expect(await whiteBarBelow()).toBe(false);
  });

  test("shows captured pieces and the material lead", async ({ page, isMobile }) => {
    await play(page, isMobile, "e2e4", "d7d5", "e4d5", "e7e6");
    await expect(page.getByTestId("captured-by-w").locator("svg")).toHaveCount(1);
    await expect(page.getByTestId("lead-w")).toHaveText("+1");
    await expect(page.getByTestId("lead-b")).toHaveCount(0);
  });

  test("exports the game as FEN and PGN", async ({ page, isMobile }) => {
    await play(page, isMobile, "e2e4", "e7e5");
    await page.getByRole("button", { name: "FEN / PGN" }).click();
    const dialog = page.getByRole("dialog", { name: "Import and export" });
    await expect(dialog.getByLabel("FEN", { exact: true })).toHaveValue(
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    );
    await expect(dialog.getByLabel("PGN", { exact: true })).toHaveValue(/1\. e4 e5 \*/);
    await expect(dialog.getByLabel("PGN", { exact: true })).toHaveValue(/\[Event "Jev Chess game"\]/);
  });

  test("imports a FEN position", async ({ page }) => {
    await page.getByRole("button", { name: "FEN / PGN" }).click();
    const dialog = page.getByRole("dialog", { name: "Import and export" });
    await dialog.getByRole("tab", { name: "Import" }).click();
    await dialog.getByLabel("Paste a FEN or PGN").fill("4k3/8/8/8/8/8/4P3/4K3 b - - 0 1");
    await dialog.getByRole("button", { name: "Load game" }).click();
    await expect(dialog).toBeHidden();
    await expect(status(page)).toHaveText("Black to move.");
    await expect(pieceOn(page, "e8")).toHaveAttribute("data-piece", "bK");
    await expect(pieceOn(page, "d1")).toHaveCount(0);
  });

  test("imports a PGN game and continues from its end", async ({ page, isMobile }) => {
    await page.getByRole("button", { name: "FEN / PGN" }).click();
    const dialog = page.getByRole("dialog", { name: "Import and export" });
    await dialog.getByRole("tab", { name: "Import" }).click();
    await dialog.getByLabel("Paste a FEN or PGN").fill("1. e4 e5 2. Nf3 Nc6");
    await dialog.getByRole("button", { name: "Load game" }).click();
    await expect(page.getByRole("list", { name: "Move history" })).toContainText("2.Nf3Nc6");
    await expect(status(page)).toHaveText("White to move.");
    await play(page, isMobile, "f1b5");
    await expect(page.getByRole("list", { name: "Move history" })).toContainText("3.Bb5");
  });

  test("explains why an import failed", async ({ page }) => {
    await page.getByRole("button", { name: "FEN / PGN" }).click();
    const dialog = page.getByRole("dialog", { name: "Import and export" });
    await dialog.getByRole("tab", { name: "Import" }).click();
    await dialog.getByLabel("Paste a FEN or PGN").fill("1. e4 e5 2. Qxf7");
    await dialog.getByRole("button", { name: "Load game" }).click();
    await expect(dialog.getByRole("alert")).toContainText("PGN could not be read");
    await expect(dialog).toBeVisible();
  });

  test("changes the board theme, appearance and sound, and remembers them", async ({ page }) => {
    await page.getByRole("button", { name: "Settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Settings" });

    await dialog.getByRole("radio", { name: /Green/ }).click();
    await expect(square(page, "a1")).toHaveCSS("background-color", "rgb(118, 150, 86)");

    await dialog.getByRole("radio", { name: /Dark/ }).click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);

    const sound = dialog.getByRole("switch", { name: "Sound" });
    await expect(sound).toBeChecked();
    await sound.click();
    await expect(sound).not.toBeChecked();

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(square(page, "a1")).toHaveCSS("background-color", "rgb(118, 150, 86)");
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("switch", { name: "Sound" })).not.toBeChecked();
  });

  test("hides the board coordinates", async ({ page }) => {
    await expect(square(page, "a1")).toContainText("1");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("switch", { name: "Board coordinates" }).click();
    await expect(square(page, "a1")).not.toContainText("1");
  });

  test("starts a game with the chosen time control and remembers it", async ({ page }) => {
    await startNewGame(page, "3 | 2");
    await expect(page.getByTestId("time-control")).toHaveText("3 | 2");
    await expect(clockOf(page, "White")).toHaveText("3:00");

    await page.reload();
    await expect(page.getByTestId("time-control")).toHaveText("3 | 2");

    await startNewGame(page, "Unlimited");
    await expect(page.getByRole("timer")).toHaveCount(0);
  });
});

// The installed clock still moves with real time between steps, so the checks
// below allow for the fraction of a second the test itself takes.
test.describe("with a controlled clock", () => {
  test.beforeEach(async ({ page }) => {
    await preferLocalMode(page);
    await page.clock.install();
    await page.goto("/");
    await expect(status(page)).toHaveText("White to move.");
  });

  test("runs only the clock of the side to move, after the first move", async ({ page, isMobile }) => {
    await play(page, isMobile, "e2e4");
    await page.clock.runFor(5_000);
    await expect(clockOf(page, "Black")).toHaveText(/^9:5[45]$/);
    await expect(clockOf(page, "White")).toHaveText("10:00");

    await play(page, isMobile, "e7e5");
    const blackAfterMove = await clockOf(page, "Black").textContent();
    await page.clock.runFor(3_000);
    await expect(clockOf(page, "White")).toHaveText(/^9:5[67]$/);
    // Black's clock stays frozen while White thinks.
    await expect(clockOf(page, "Black")).toHaveText(blackAfterMove!);
  });

  test("ends the game when a clock runs out", async ({ page, isMobile }) => {
    await startNewGame(page, "1 min");
    await play(page, isMobile, "e2e4");
    await page.clock.runFor(50_000);
    await expect(clockOf(page, "Black")).toHaveText(/^0:(10|0\d\.\d)$/);
    await expect(clockOf(page, "White")).toHaveText("1:00");
    await page.clock.runFor(11_000);

    await expect(status(page)).toHaveText("Black ran out of time. White wins.");
    const gameOver = page.getByRole("dialog", { name: "Out of time" });
    await expect(gameOver).toContainText("1-0");
    await gameOver.getByRole("button", { name: "View board" }).click();
    await expect(clockOf(page, "Black")).toHaveText("0:00.0");
    await expect(clockOf(page, "White")).toHaveText("1:00");
  });
});
