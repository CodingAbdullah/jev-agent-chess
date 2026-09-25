import { expect, test } from "@playwright/test";
import { drag, pieceOn, play, preferLocalMode, press, status } from "./helpers";

test.beforeEach(async ({ page }) => {
  await preferLocalMode(page);
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

test("ends the game on checkmate and offers a rematch", async ({ page, isMobile }) => {
  await play(page, isMobile, "f2f3", "e7e5", "g2g4", "d8h4");
  await expect(status(page)).toHaveText("Checkmate. Black wins.");

  const gameOver = page.getByRole("dialog", { name: "Checkmate" });
  await expect(gameOver).toBeVisible();
  await expect(gameOver).toContainText("0-1");
  await gameOver.getByRole("button", { name: "View board" }).click();
  await expect(gameOver).toBeHidden();

  // No more moves are allowed once the game is over.
  await press(page, "a2", isMobile);
  await press(page, "a3", isMobile);
  await expect(pieceOn(page, "a2")).toHaveAttribute("data-piece", "wP");

  // Undo takes the mate back and play continues.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(status(page)).toHaveText("Black to move.");
  await play(page, isMobile, "d8h4");
  await gameOver.getByRole("button", { name: "Rematch" }).click();
  await expect(status(page)).toHaveText("White to move.");
  await expect(pieceOn(page, "d8")).toHaveAttribute("data-piece", "bQ");
});

test("New game starts over mid-game", async ({ page, isMobile }) => {
  await play(page, isMobile, "e2e4");
  await page.getByRole("button", { name: "New game" }).click();
  await page.getByRole("dialog", { name: "New game" }).getByRole("button", { name: "Start game" }).click();
  await expect(pieceOn(page, "e2")).toHaveAttribute("data-piece", "wP");
  await expect(status(page)).toHaveText("White to move.");
});
