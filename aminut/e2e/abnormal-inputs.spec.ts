import { test, expect } from "@playwright/test";
import type { Report, StageEvent } from "../src/lib/types";

// Covers TEST_STRATEGY.md section D (abnormal input) and V-08 (no accidental double-submit).
// Every request stays mocked via page.route — zero real API cost.

test.beforeEach(async ({ page }) => {
  await page.route("**/api/trending-examples", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ examples: [] }) });
  });
});

const minimalReport: Report = {
  id: "r-abnormal",
  checkedAt: new Date("2026-02-01T08:00:00Z").toISOString(),
  overallAssessment: "לא נמצאו טענות עובדתיות הניתנות לבדיקה",
  plainExplanation: ["התוכן שנשלח לא כלל טענה עובדתית ברורה."],
  claims: [],
  evaluations: [],
  evidence: [],
  limitations: [],
  openQuestions: [],
  searchesUsed: 0,
  searchBudget: 8,
  incomplete: false,
  incompleteReason: null,
};

function ndjson(events: StageEvent[]): string {
  return events.map((e) => JSON.stringify(e)).join("\n") + "\n";
}

test("submit button is disabled with empty text and URL", async ({ page }) => {
  await page.goto("/");
  const submit = page.getByRole("button", { name: "בדוק אמינות" });
  await expect(submit).toBeDisabled();
});

test("submit button stays disabled with whitespace-only text", async ({ page }) => {
  await page.goto("/");
  const textarea = page.getByLabel("טקסט, כותרת, ציטוט או פוסט לבדיקה");
  await textarea.fill("   \n\t   ");
  const submit = page.getByRole("button", { name: "בדוק אמינות" });
  await expect(submit).toBeDisabled();
});

test("very long text is capped at the 8000-character maxLength", async ({ page }) => {
  await page.goto("/");
  const textarea = page.getByLabel("טקסט, כותרת, ציטוט או פוסט לבדיקה");
  const longText = "א".repeat(8500);
  await textarea.fill(longText);
  const value = await textarea.inputValue();
  expect(value.length).toBeLessThanOrEqual(8000);
  // Submit should still be enabled once there's non-whitespace content under the cap.
  await expect(page.getByRole("button", { name: "בדוק אמינות" })).toBeEnabled();
});

test("mixed Hebrew/English/emoji text is accepted and submittable", async ({ page }) => {
  let requestBody: unknown = null;
  await page.route("**/api/verify", async (route) => {
    requestBody = route.request().postDataJSON();
    const body = ndjson([{ type: "done", report: minimalReport, shareUrl: null }]);
    await route.fulfill({ status: 200, contentType: "application/x-ndjson; charset=utf-8", body });
  });

  await page.goto("/");
  const mixedText = 'The שר האוצר said "מע"מ" will rise to 20% 😀🔥 #breaking';
  await page.getByLabel("טקסט, כותרת, ציטוט או פוסט לבדיקה").fill(mixedText);
  await page.getByRole("button", { name: "בדוק אמינות" }).click();

  await expect(page.getByText(minimalReport.overallAssessment)).toBeVisible();
  expect((requestBody as { text?: string })?.text).toBe(mixedText);
});

test("URL-only submission (no text) sends only the url field", async ({ page }) => {
  let requestBody: unknown = null;
  await page.route("**/api/verify", async (route) => {
    requestBody = route.request().postDataJSON();
    const body = ndjson([{ type: "done", report: minimalReport, shareUrl: null }]);
    await route.fulfill({ status: 200, contentType: "application/x-ndjson; charset=utf-8", body });
  });

  await page.goto("/");
  await page.getByLabel("או קישור לכתבה / פוסט").fill("https://example.com/some-article");
  const submit = page.getByRole("button", { name: "בדוק אמינות" });
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByText(minimalReport.overallAssessment)).toBeVisible();
  const sent = requestBody as { text?: string; url?: string };
  expect(sent.url).toBe("https://example.com/some-article");
  expect(sent.text).toBeUndefined();
});

test("double-clicking submit fires at most one /api/verify request", async ({ page }) => {
  let callCount = 0;
  await page.route("**/api/verify", async (route) => {
    callCount += 1;
    // Deliberately slow so a second click (if it slipped through before the UI
    // transitions away from the form) would still be observable as a second call.
    await new Promise((r) => setTimeout(r, 300));
    const body = ndjson([{ type: "done", report: minimalReport, shareUrl: null }]);
    await route.fulfill({ status: 200, contentType: "application/x-ndjson; charset=utf-8", body });
  });

  await page.goto("/");
  await page.getByLabel("טקסט, כותרת, ציטוט או פוסט לבדיקה").fill("בדיקה כלשהי לצורך הדאבל-קליק");
  const submit = page.getByRole("button", { name: "בדוק אמינות" });

  // Fire the double-click; the app unmounts the form as soon as the first click
  // transitions state to "running", so this also exercises that unmount race.
  await submit.dblclick({ force: true }).catch(() => {
    // A dblclick on an element that disappears mid-interaction may throw — that's
    // fine, the assertion below is the real check.
  });

  await expect(page.getByText(minimalReport.overallAssessment)).toBeVisible({ timeout: 10_000 });
  expect(callCount).toBe(1);
});
