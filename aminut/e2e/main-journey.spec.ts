import { test, expect } from "@playwright/test";
import type { Report, StageEvent } from "../src/lib/types";

test.beforeEach(async ({ page }) => {
  // Deterministic, offline, free: never let a test depend on fakereporter.net or a
  // real LLM call — always fall back to the static example claims.
  await page.route("**/api/trending-examples", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ examples: [] }) });
  });
});

const mockReport: Report = {
  id: "r1",
  checkedAt: new Date("2026-02-01T08:00:00Z").toISOString(),
  overallAssessment: 'הטענה בדבר העלאת המע"מ אינה מאומתת במקורות הרשמיים הזמינים',
  plainExplanation: ["לא נמצאה הודעה רשמית התואמת לטענה.", "יש להמתין לפרסום רשמי."],
  claims: [
    {
      id: "c1",
      originalText: 'שר האוצר הודיע כי שיעור המע"מ יועלה ל-20%',
      normalizedText: 'העלאת מע"מ ל-20%',
      people: ["שר האוצר"],
      organizations: ["משרד האוצר"],
      locations: [],
      dates: [],
      events: [],
      eventDate: null,
      publicationDate: null,
      claimType: "factual",
      missingForVerification: [],
      searchQueryEn: null,
    },
  ],
  evaluations: [
    {
      claimId: "c1",
      classification: "לא ניתן לאימות",
      confidence: "medium",
      rationale: "לא נמצא מקור רשמי התומך או סותר את הטענה",
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      missingContext: null,
      whatWouldChangeConclusion: "פרסום רשמי של משרד האוצר",
      likelyOrigin: null,
    },
  ],
  evidence: [
    {
      id: "e1",
      claimId: "c1",
      url: "https://www.gov.il/he/departments/finance",
      title: "אתר משרד האוצר",
      publisher: "gov.il",
      publicationDate: null,
      retrievedAt: new Date().toISOString(),
      sourceType: "official",
      excerpt: "לא נמצאה הודעה רלוונטית בדף הבית",
      accessible: true,
      inaccessibleReason: null,
    },
  ],
  limitations: ["הבדיקה התבססה על מספר מצומצם של מקורות"],
  openQuestions: ["האם קיימת הודעה רשמית שטרם פורסמה באתר?"],
  searchesUsed: 2,
  searchBudget: 8,
  incomplete: false,
  incompleteReason: null,
};

function ndjson(events: StageEvent[]): string {
  return events.map((e) => JSON.stringify(e)).join("\n") + "\n";
}

test("main journey: submit a claim, see real progress stages, and get a sourced report", async ({ page }) => {
  await page.route("**/api/verify", async (route) => {
    const body = ndjson([
      { type: "stage", stage: "extracting_claims" },
      { type: "stage", stage: "searching", claimIndex: 1, totalClaims: 1, claimText: 'שר האוצר הודיע כי שיעור המע"מ יועלה ל-20%' },
      { type: "stage", stage: "comparing_sources" },
      { type: "stage", stage: "preparing_report" },
      { type: "done", report: mockReport, shareUrl: null },
    ]);
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson; charset=utf-8",
      body,
    });
  });

  await page.goto("/");

  // RTL is set at the document level regardless of which input is used.
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "he");

  await page.getByRole("button", { name: /שר האוצר בישראל הודיע/ }).click();
  await page.getByRole("button", { name: "בדוק אמינות" }).click();

  // Final report renders with the real (mocked) evidence-backed content — never a fabricated verdict.
  await expect(page.getByText(mockReport.overallAssessment)).toBeVisible();
  await expect(page.getByText("לא ניתן לאימות").first()).toBeVisible();

  const sourceLink = page.getByRole("link", { name: /אתר משרד האוצר/ });
  await expect(sourceLink).toBeVisible();
  await expect(sourceLink).toHaveAttribute("href", mockReport.evidence[0].url);

  // Copy-summary control is present and clickable.
  await page.getByRole("button", { name: /העתק סיכום/ }).click();

  // A convenient "new check" button exists at the top of the results too, not just the bottom
  // (both share the same prominent label/style by design).
  await page.getByRole("button", { name: "+ בדיקה חדשה" }).first().click();
  await expect(page.getByLabel("טקסט, כותרת, ציטוט או פוסט לבדיקה")).toBeVisible();
});

test("mobile viewport renders the form without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "אמינות" })).toBeVisible();
  await expect(page.getByRole("button", { name: "בדוק אמינות" })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("image upload: populates the claim text and surfaces a low-confidence warning for a partially unreadable screenshot", async ({
  page,
}) => {
  await page.route("**/api/extract-image", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        extractedText: 'שר האוצר הודיע [לא קריא] על העלאת המע"מ ל-[לא קריא]%',
        confidence: "low",
        uncertainNotes: ["האחוז המדויק מטושטש", "חלק מהמשפט חתוך בתמונה"],
      }),
    });
  });

  await page.goto("/");

  // A tiny 1x1 PNG, inlined so the test needs no fixture file on disk.
  const pngBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  );

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({ name: "screenshot.png", mimeType: "image/png", buffer: pngBuffer });

  const textarea = page.getByLabel("טקסט, כותרת, ציטוט או פוסט לבדיקה");
  await expect(textarea).toHaveValue(/לא קריא/);
  await expect(page.getByText(/קושי בזיהוי/)).toBeVisible();
  await expect(page.getByText(/האחוז המדויק מטושטש/)).toBeVisible();
});

test("shows a clear error state instead of a silent failure when the backend errors", async ({ page }) => {
  await page.route("**/api/verify", async (route) => {
    const body = ndjson([{ type: "error", code: "missing_llm_credentials", message: "חסר מפתח API הכרחי להרצת הבדיקה" }]);
    await route.fulfill({ status: 200, contentType: "application/x-ndjson", body });
  });

  await page.goto("/");
  await page.getByLabel("טקסט, כותרת, ציטוט או פוסט לבדיקה").fill("בדיקה כלשהי");
  await page.getByRole("button", { name: "בדוק אמינות" }).click();

  await expect(page.getByText(/הבדיקה נכשלה/)).toBeVisible();
  await expect(page.getByText("חסר מפתח API הכרחי להרצת הבדיקה")).toBeVisible();
});
