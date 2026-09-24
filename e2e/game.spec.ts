import { expect, test, type Page } from "@playwright/test";

const square = (page: Page, name: string) => page.locator(`[data-square="${name}"]`);
const pieceOn = (page: Page, name: string) => square(page, name).locator("[data-piece]");
const status = (page: Page) => page.getByTestId("game-status");

/** Click or tap a square, whichever matches the device. */
async function press(page: Page, name: string, isMobile: boolean) {
  if (isMobile) await square(page, name).tap();
  else await square(page, name).click();
}

/** Play moves like "e2e4" by pressing the source then the target, waiting for each to land. */
async function play(page: Page, isMobile: boolean, ...moves: string[]) {
  for (const move of moves) {
    const from = move.slice(0, 2);
    const to = move.slice(2, 4);
    await press(page, from, isMobile);
    await press(page, to, isMobile);
    await expect(pieceOn(page, from)).toHaveCount(0);
    await expect(pieceOn(page, to)).toHaveCount(1);
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(status(page)).toHaveText("White to move.");
});

test("moves a piece by clicking and hands the turn over", async ({ page, isMobile }) => {
  await play(page, isMobile, "e2e4");
  await expect(pieceOn(page, "e4")).toHaveAttribute("data-piece", "wP");
  await expect(status(page)).toHaveText("Black to move.");
});

test("rejects an illegal move", async ({ page, isMobile }) => {
  await press(page, "e2", isMobile);
  await press(page, "e5", isMobile);
  await expect(pieceOn(page, "e2")).toHaveAttribute("data-piece", "wP");
  await expect(pieceOn(page, "e5")).toHaveCount(0);
  await expect(status(page)).toHaveText("White to move.");
});

test("does not let a player move the opponent's pieces", async ({ page, isMobile }) => {
  await press(page, "e7", isMobile);
  await press(page, "e5", isMobile);
  await expect(pieceOn(page, "e7")).toHaveAttribute("data-piece", "bP");
  await expect(status(page)).toHaveText("White to move.");
});

/**
 * Drag a piece with the mouse from one square to another.
 *
 * After a drag ends, dnd-kit (react-chessboard's drag library) swallows clicks
 * for 50ms so the drop is not also read as a click. People never click that
 * fast, but Playwright does, so pause briefly like a person would.
 */
async function drag(page: Page, fromName: string, toName: string) {
  const from = await square(page, fromName).boundingBox();
  const to = await square(page, toName).boundingBox();
  if (!from || !to) throw new Error("Board squares are not visible");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}

test("moves a piece by dragging", async ({ page, isMobile }) => {
  test.skip(isMobile, "Mouse drag does not apply to touch devices.");
  await drag(page, "g1", "f3");
  await expect(pieceOn(page, "f3")).toHaveAttribute("data-piece", "wN");
  await expect(status(page)).toHaveText("Black to move.");
});

test("castles kingside", async ({ page, isMobile }) => {
  await play(page, isMobile, "e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6");
  await press(page, "e1", isMobile);
  await press(page, "g1", isMobile);
  await expect(pieceOn(page, "g1")).toHaveAttribute("data-piece", "wK");
  await expect(pieceOn(page, "f1")).toHaveAttribute("data-piece", "wR");
  await expect(pieceOn(page, "h1")).toHaveCount(0);
});

test("captures en passant", async ({ page, isMobile }) => {
  await play(page, isMobile, "e2e4", "a7a6", "e4e5", "d7d5", "e5d6");
  await expect(pieceOn(page, "d6")).toHaveAttribute("data-piece", "wP");
  await expect(pieceOn(page, "d5")).toHaveCount(0);
});

test.describe("promotion", () => {
  const toPromotion = ["a2a4", "b7b5", "a4b5", "a7a6", "b5a6", "c8b7", "a6b7", "b8c6"];

  test("promotes to the chosen piece", async ({ page, isMobile }) => {
    await play(page, isMobile, ...toPromotion);
    await press(page, "b7", isMobile);
    await press(page, "a8", isMobile);
    const picker = page.getByRole("dialog", { name: "Promote pawn to" });
    await expect(picker).toBeVisible();
    await picker.getByRole("button", { name: "Promote to knight" }).click();
    await expect(picker).toBeHidden();
    await expect(pieceOn(page, "a8")).toHaveAttribute("data-piece", "wN");
    await expect(status(page)).toHaveText("Black to move.");
  });

  test("works after dragging the pawn", async ({ page, isMobile }) => {
    test.skip(isMobile, "Mouse drag does not apply to touch devices.");
    await play(page, isMobile, ...toPromotion);
    await drag(page, "b7", "a8");
    const picker = page.getByRole("dialog", { name: "Promote pawn to" });
    await expect(picker).toBeVisible();
    // The pawn waits on its square until a piece is chosen.
    await expect(pieceOn(page, "b7")).toHaveAttribute("data-piece", "wP");
    await picker.getByRole("button", { name: "Promote to queen" }).click();
    await expect(pieceOn(page, "a8")).toHaveAttribute("data-piece", "wQ");
    await expect(pieceOn(page, "b7")).toHaveCount(0);
  });

  test("can be cancelled", async ({ page, isMobile }) => {
    await play(page, isMobile, ...toPromotion);
    await press(page, "b7", isMobile);
    await press(page, "a8", isMobile);
    await expect(page.getByRole("dialog")).toBeVisible();
    if (isMobile) {
      // Tap the dimmed backdrop, away from the picker.
      await page.getByTestId("game-board").tap({ position: { x: 8, y: 8 } });
    } else {
      await page.keyboard.press("Escape");
    }
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(pieceOn(page, "b7")).toHaveAttribute("data-piece", "wP");
    await expect(status(page)).toHaveText("White to move.");
  });
});

test("announces check", async ({ page, isMobile }) => {
  await play(page, isMobile, "e2e4", "f7f6", "d1h5");
  await expect(status(page)).toHaveText("Black is in check.");
  await expect(page.getByText("Check", { exact: true })).toBeVisible();
});

test("ends the game on checkmate and starts a new one", async ({ page, isMobile }) => {
  await play(page, isMobile, "f2f3", "e7e5", "g2g4", "d8h4");
  await expect(status(page)).toHaveText("Checkmate. Black wins.");

  // No more moves are allowed once the game is over.
  await press(page, "a2", isMobile);
  await press(page, "a3", isMobile);
  await expect(pieceOn(page, "a2")).toHaveAttribute("data-piece", "wP");

  await page.getByRole("button", { name: "Play again" }).click();
  await expect(status(page)).toHaveText("White to move.");
  await expect(pieceOn(page, "d8")).toHaveAttribute("data-piece", "bQ");
});

test("New game resets the board mid-game", async ({ page, isMobile }) => {
  const newGame = page.getByRole("button", { name: "New game" });
  await expect(newGame).toBeDisabled();
  await play(page, isMobile, "e2e4");
  await newGame.click();
  await expect(pieceOn(page, "e2")).toHaveAttribute("data-piece", "wP");
  await expect(status(page)).toHaveText("White to move.");
});
