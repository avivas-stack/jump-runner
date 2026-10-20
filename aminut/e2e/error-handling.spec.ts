import { test, expect, Page } from "@playwright/test";

// Covers TEST_STRATEGY.md section D/E error-handling scenarios for /api/verify and
// /api/extract-image: every non-2xx status the backend can plausibly return must surface
// a clear Hebrew message (never a raw stack trace / vendor error text) and leave the user
// able to recover. All mocked via page.route — zero real API cost.

test.beforeEach(async ({ page }) => {
  await page.route("**/api/trending-examples", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ examples: [] }) });
  });
});

const STACK_TRACE_MARKERS = [/at Object\./, /at Module\./, /node_modules[\\/]/, /\bTypeError:/, /\bReferenceError:/];

async function assertNoStackTraceLeak(page: Page) {
  const bodyText = await page.locator("body").innerText();
  for (const marker of STACK_TRACE_MARKERS) {
    expect(bodyText).not.toMatch(marker);
  }
}

const VERIFY_ERROR_CASES: { status: number; error: string; label: string }[] = [
  { status: 400, error: "קלט לא תקין", label: "400 bad request" },
  { status: 401, error: "גישה לא מורשית", label: "401 unauthorized" },
  { status: 403, error: "הגישה נדחתה", label: "403 forbidden" },
  { status: 404, error: "המשאב המבוקש לא נמצא", label: "404 not found" },
  { status: 429, error: "חרגת ממכסת הבדיקות השעתית. נסה שוב מאוחר יותר.", label: "429 rate limited" },
  { status: 500, error: "שגיאה לא צפויה בעת הבדיקה. נסו שוב.", label: "500 server error" },
];

for (const { status, error, label } of VERIFY_ERROR_CASES) {
  test(`/api/verify ${label} shows a clear Hebrew error and allows retry`, async ({ page }) => {
    await page.route("**/api/verify", async (route) => {
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error }) });
    });

    await page.goto("/");
    await page.getByLabel("טקסט, כותרת, ציטוט או פוסט לבדיקה").fill("טענה לבדיקת שגיאה");
    await page.getByRole("button", { name: "בדוק אמינות" }).click();

    await expect(page.getByText("הבדיקה נכשלה", { exact: false })).toBeVisible();
    await expect(page.getByText(error)).toBeVisible();
    await assertNoStackTraceLeak(page);

    // Recovery: the retry button must bring the input form back, not leave the user stuck.
    const retry = page.getByRole("button", { name: "נסה שוב" });
    await expect(retry).toBeVisible();
    await retry.click();
    await expect(page.getByLabel("טקסט, כותרת, ציטוט או פוסט לבדיקה")).toBeVisible();
  });
}

test("/api/verify 500 with a non-JSON body falls back to a generic Hebrew message (no raw body leaked)", async ({ page }) => {
  await page.route("**/api/verify", async (route) => {
    await route.fulfill({ status: 500, contentType: "text/plain", body: "Internal Server Error\n  at handler (/app/route.ts:42:11)" });
  });

  await page.goto("/");
  await page.getByLabel("טקסט, כותרת, ציטוט או פוסט לבדיקה").fill("טענה נוספת לבדיקה");
  await page.getByRole("button", { name: "בדוק אמינות" }).click();

  await expect(page.getByText("הבדיקה נכשלה", { exact: false })).toBeVisible();
  // Must not render the raw non-JSON body (which itself looks like a stack trace) verbatim.
  await expect(page.getByText(/at handler/)).toHaveCount(0);
  await assertNoStackTraceLeak(page);
});

const EXTRACT_IMAGE_ERROR_CASES: { status: number; error: string; label: string }[] = [
  { status: 400, error: "קלט לא תקין", label: "400 bad request" },
  { status: 413, error: "התמונה גדולה מדי (מגבלה: 5MB)", label: "413 payload too large" },
  { status: 429, error: "חרגת ממכסת העלאות התמונה השעתית. נסה שוב מאוחר יותר.", label: "429 rate limited" },
  { status: 500, error: "שגיאה לא צפויה בעיבוד התמונה. נסו שוב.", label: "500 server error" },
];

const pngBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

for (const { status, error, label } of EXTRACT_IMAGE_ERROR_CASES) {
  test(`/api/extract-image ${label} shows a clear Hebrew error and the user can try again`, async ({ page }) => {
    await page.route("**/api/extract-image", async (route) => {
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error }) });
    });

    await page.goto("/");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({ name: "screenshot.png", mimeType: "image/png", buffer: pngBuffer });

    // Scoped to the form's own error paragraph: Next.js dev mode additionally surfaces
    // any console.error() call (which ClaimForm intentionally makes for diagnostics) in
    // its own dev-only error overlay, which would otherwise make getByText ambiguous.
    // That overlay is a local dev-server artifact, not present in a production build.
    await expect(page.locator("p.text-rose-600", { hasText: error })).toBeVisible();
    await assertNoStackTraceLeak(page);

    // Recovery: the upload control must still be usable for a retry (not disabled/stuck).
    const uploadButton = page.getByRole("button", { name: /לחץ\/י לבחירת תמונה/ });
    await expect(uploadButton).toBeEnabled();
  });
}

test("/api/extract-image non-JSON 500 body falls back to the generic Hebrew image error", async ({ page }) => {
  await page.route("**/api/extract-image", async (route) => {
    await route.fulfill({ status: 500, contentType: "text/plain", body: "<html>502 Bad Gateway</html>" });
  });

  await page.goto("/");
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({ name: "screenshot.png", mimeType: "image/png", buffer: pngBuffer });

  await expect(
    page.locator("p.text-rose-600", { hasText: "שגיאה לא צפויה בעיבוד התמונה. נסו שוב, או עם תמונה אחרת." })
  ).toBeVisible();
  await assertNoStackTraceLeak(page);
});
