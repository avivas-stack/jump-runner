import { test, expect } from "@playwright/test";

// Covers TEST_STRATEGY.md V-02/V-03: no horizontal overflow at a spread of viewport
// widths beyond the single 375px check in main-journey.spec.ts, and a few more routes.

test.beforeEach(async ({ page }) => {
  await page.route("**/api/trending-examples", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ examples: [] }) });
  });
});

async function hasHorizontalOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

const WIDTHS = [320, 768, 1024, 1440];

for (const width of WIDTHS) {
  test(`home page has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Facto" })).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
}

const OTHER_ROUTES = ["/contact", "/privacy", "/what-is-fake-news"];

for (const route of OTHER_ROUTES) {
  test(`${route} has no horizontal overflow at 375px (mobile)`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(route);
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test(`${route} has no horizontal overflow at 1440px (desktop)`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(route);
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
}

test("RTL attributes hold at every tested width", async ({ page }) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
  }
});
