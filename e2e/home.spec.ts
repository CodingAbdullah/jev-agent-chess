import { expect, test } from "@playwright/test";

test("home page loads with the app title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Jev Chess");
  await expect(
    page.getByRole("heading", { level: 1, name: /jev chess/i }),
  ).toBeVisible();
});

test("footer credits the stack and links to the source code", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(footer).toContainText("Built by Next.js. Powered by Next.js");
  const source = footer.getByRole("link", { name: /source code on github/i });
  await expect(source).toHaveAttribute("href", "https://github.com/CodingAbdullah/jev-agent-chess");
  await expect(source).toHaveAttribute("target", "_blank");
});

test("home page has no horizontal scroll", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
