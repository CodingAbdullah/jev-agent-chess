import { expect, test, type Page } from "@playwright/test";
import { play, preferLocalMode, status } from "./helpers";

// The narrowest common phone width.
test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

async function expectNoSidewaysScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${label} scrolls sideways`).toBeLessThanOrEqual(0);
}

async function expectDialogFits(page: Page, name: string) {
  const box = await page.getByRole("dialog", { name }).boundingBox();
  expect(box, `${name} dialog`).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
}

test("every mode fits a 360px screen", async ({ page }) => {
  for (const mode of ["2 Players", "vs Jev", "vs Stockfish", "Hybrid"]) {
    await page.goto("/");
    await page.getByRole("button", { name: "New game" }).click();
    await expectDialogFits(page, "New game");
    const dialog = page.getByRole("dialog", { name: "New game" });
    await dialog.getByRole("radio", { name: mode }).click();
    await dialog.getByRole("button", { name: "Start game" }).click();
    await play(page, true, "e2e4");
    await expect(status(page)).toHaveText(mode === "2 Players" ? "Black to move." : "White to move.", {
      timeout: 15_000,
    });
    await expectNoSidewaysScroll(page, mode);
  }
});

test("dialogs and the move box fit a 360px screen", async ({ page }) => {
  await preferLocalMode(page);
  await page.goto("/");
  for (const [button, name] of [
    ["Settings", "Settings"],
    ["FEN / PGN", "Import and export"],
  ] as const) {
    await page.getByRole("button", { name: button }).click();
    await expectDialogFits(page, name);
    await page.keyboard.press("Escape");
  }
  const box = await page.getByRole("textbox", { name: "Type a move" }).boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  const board = await page.getByTestId("game-board").boundingBox();
  expect(board!.width).toBeGreaterThan(280);
});
