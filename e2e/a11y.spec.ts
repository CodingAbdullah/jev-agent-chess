import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { play, preferLocalMode, status } from "./helpers";

/**
 * Wait for entrance animations, such as a dialog fading in, to finish.
 * Otherwise axe measures half-transparent text and reports false contrast
 * failures. Endless animations, such as spinners, are skipped.
 */
async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}

/** Run axe's WCAG 2.2 A and AA checks on the page and fail with a readable list. */
async function expectNoViolations(page: Page, label: string) {
  await settle(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n` +
      violation.nodes.map((node) => `    ${node.target.join(" ")}`).join("\n"),
  );
  expect(summary, `Accessibility problems in ${label}`).toEqual([]);
}

async function openAndCheck(page: Page, button: string, dialogName: string) {
  await page.getByRole("button", { name: button }).click();
  await expect(page.getByRole("dialog", { name: dialogName })).toBeVisible();
  await expectNoViolations(page, `the ${dialogName} dialog`);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test("the two-player game screen and its dialogs", async ({ page, isMobile }) => {
      await preferLocalMode(page);
      await page.goto("/");
      await expect(status(page)).toHaveText("White to move.");
      await play(page, isMobile, "e2e4", "d7d5", "e4d5");
      await expect(page.getByTestId("evaluation")).toContainText("depth", { timeout: 15_000 });
      await expectNoViolations(page, "the two-player screen");

      await openAndCheck(page, "New game", "New game");
      await openAndCheck(page, "Settings", "Settings");
      await openAndCheck(page, "FEN / PGN", "Import and export");
    });

    // One test per opponent: together they ran close to the 30 second limit on slower machines.
    for (const mode of ["vs Jev", "vs Stockfish", "Hybrid"]) {
      test(`the ${mode} screen`, async ({ page, isMobile }) => {
        await page.goto("/");
        await page.getByRole("button", { name: "New game" }).click();
        const dialog = page.getByRole("dialog", { name: "New game" });
        await dialog.getByRole("radio", { name: mode }).click();
        await expectNoViolations(page, `the New game dialog for ${mode}`);
        await dialog.getByRole("button", { name: "Start game" }).click();
        await play(page, isMobile, "e2e4");
        await expect(status(page)).toHaveText("White to move.", { timeout: 15_000 });
        await expectNoViolations(page, `the ${mode} screen`);
      });
    }

    test("a draw offer, the resign dialog and the review controls", async ({ page, isMobile }) => {
      await preferLocalMode(page);
      await page.goto("/");
      await play(page, isMobile, "e2e4");
      await page.getByRole("button", { name: "Offer draw" }).click();
      await expect(page.getByTestId("draw-offer")).toContainText("offers a draw");
      await expectNoViolations(page, "a pending draw offer");

      await page.getByTestId("game-actions").getByRole("button", { name: "Resign" }).click();
      await expect(page.getByRole("dialog", { name: "Resign as Black?" })).toBeVisible();
      await expectNoViolations(page, "the resign dialog");
      await page.getByRole("dialog").getByRole("button", { name: "Resign" }).click();
      await page.getByRole("dialog", { name: "Resignation" }).getByRole("button", { name: "View board" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.getByRole("button", { name: "First position" }).click();
      await expectNoViolations(page, "the review controls");
    });

    test("Jev's evaluation during a Jev game", async ({ page, isMobile }) => {
      await page.addInitScript(() =>
        window.localStorage.setItem("jev-chess:settings", JSON.stringify({ mode: "jev", evaluationInComputerGames: true })),
      );
      await page.goto("/");
      await play(page, isMobile, "e2e4");
      await expect(page.getByTestId("jev-evaluation")).toContainText(/equal|better|winning/, { timeout: 15_000 });
      await expectNoViolations(page, "Jev's evaluation");
    });

    test("the game-over dialog", async ({ page, isMobile }) => {
      await preferLocalMode(page);
      await page.goto("/");
      await play(page, isMobile, "f2f3", "e7e5", "g2g4", "d8h4");
      await expect(page.getByRole("dialog", { name: "Checkmate" })).toBeVisible();
      await expectNoViolations(page, "the game-over dialog");
    });
  });
}
