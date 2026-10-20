import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Report, StageEvent } from "../src/lib/types";

// Automated axe-core scans (TEST_STRATEGY.md A11Y-06). This catches a meaningful subset
// of WCAG issues (missing labels/alt text, contrast, landmark/ARIA misuse, etc.) but is
// NOT a substitute for manual keyboard-navigation or screen-reader testing (A11Y-01, A11Y-03)
// — see qa/reports/*/DETAILED_FINDINGS.md for what this run actually found, broken down by
// impact severity, and what axe cannot check.

test.beforeEach(async ({ page }) => {
  await page.route("**/api/trending-examples", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ examples: [] }) });
  });
});

const mockReport: Report = {
  id: "r-a11y",
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

test("home page idle state: axe scan (reported by impact, not gated on zero findings)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Facto" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  // Always print the full violation list so it ends up in the Playwright run output and
  // can be transcribed verbatim into qa/reports/*/DETAILED_FINDINGS.md — never summarized
  // away before a human sees exactly what axe flagged.
  console.log(
    "[axe:home-idle]",
    JSON.stringify(
      results.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length })),
      null,
      2
    )
  );

  const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
});

test("report-result state: axe scan (reported by impact, not gated on zero findings)", async ({ page }) => {
  await page.route("**/api/verify", async (route) => {
    const body = ndjson([{ type: "done", report: mockReport, shareUrl: null }]);
    await route.fulfill({ status: 200, contentType: "application/x-ndjson; charset=utf-8", body });
  });

  await page.goto("/");
  await page.getByLabel("טקסט, כותרת, ציטוט או פוסט לבדיקה").fill("בדיקת נגישות עבור מצב דוח");
  await page.getByRole("button", { name: "בדוק אמינות" }).click();
  await expect(page.getByText(mockReport.overallAssessment)).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  console.log(
    "[axe:report-result]",
    JSON.stringify(
      results.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length })),
      null,
      2
    )
  );

  const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
});
