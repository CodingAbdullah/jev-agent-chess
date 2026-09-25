import { expect, type Page } from "@playwright/test";

export const square = (page: Page, name: string) => page.locator(`[data-square="${name}"]`);
export const pieceOn = (page: Page, name: string) => square(page, name).locator("[data-piece]");
export const status = (page: Page) => page.getByTestId("game-status");

/** Click or tap a square, whichever matches the device. */
export async function press(page: Page, name: string, isMobile: boolean) {
  if (isMobile) await square(page, name).tap();
  else await square(page, name).click();
}

/** Play moves like "e2e4" by pressing the source then the target, waiting for each to land. */
export async function play(page: Page, isMobile: boolean, ...moves: string[]) {
  for (const move of moves) {
    const from = move.slice(0, 2);
    const to = move.slice(2, 4);
    await press(page, from, isMobile);
    await press(page, to, isMobile);
    await expect(pieceOn(page, from)).toHaveCount(0);
    await expect(pieceOn(page, to)).toHaveCount(1);
  }
}

/**
 * Drag a piece with the mouse from one square to another.
 *
 * After a drag ends, dnd-kit (react-chessboard's drag library) swallows clicks
 * for 50ms so the drop is not also read as a click. People never click that
 * fast, but Playwright does, so pause briefly like a person would.
 */
export async function drag(page: Page, fromName: string, toName: string) {
  const from = await square(page, fromName).boundingBox();
  const to = await square(page, toName).boundingBox();
  if (!from || !to) throw new Error("Board squares are not visible");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}

/** Start a new game with the given time control label, such as "1 min" or "Unlimited". */
export async function startNewGame(page: Page, timeControl: string) {
  await page.getByRole("button", { name: "New game" }).click();
  const dialog = page.getByRole("dialog", { name: "New game" });
  await dialog.getByRole("radio", { name: new RegExp(`^${timeControl.replace(/[|]/g, "\\|")}`) }).click();
  await dialog.getByRole("button", { name: "Start game" }).click();
  await expect(dialog).toBeHidden();
}

/**
 * Start in two-player mode unless the test has already saved other settings.
 * Runs before every page load, so it must not overwrite what a test changes.
 */
export async function preferLocalMode(page: Page) {
  await page.addInitScript(() => {
    const key = "jev-chess:settings";
    if (!window.localStorage.getItem(key)) {
      window.localStorage.setItem(key, JSON.stringify({ mode: "local" }));
    }
  });
}

/** Play a move by typing it into the move box, the keyboard way to play. */
export async function typeMove(page: Page, move: string) {
  const box = page.getByRole("textbox", { name: "Type a move" });
  await expect(box).toBeEnabled({ timeout: 15_000 });
  await box.fill(move);
  await box.press("Enter");
}

/** The current position, from the board's data attribute. */
export async function currentFen(page: Page): Promise<string> {
  return (await page.getByTestId("game-board").getAttribute("data-fen")) ?? "";
}
