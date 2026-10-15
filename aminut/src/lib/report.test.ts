import { describe, expect, it, vi } from "vitest";
import type { ClaimEvaluation, EvidenceItem, ExtractedClaim } from "./types";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));
vi.mock("./anthropic", () => ({ callStructured: callStructuredMock }));

const { buildReport } = await import("./report");

const claim: ExtractedClaim = {
  id: "c1",
  originalText: "טענה לדוגמה",
  normalizedText: "טענה לדוגמה",
  people: [],
  organizations: [],
  locations: [],
  dates: [],
  events: [],
  eventDate: null,
  publicationDate: null,
  claimType: "factual",
  missingForVerification: [],
  searchQueryEn: null,
};

const evaluation: ClaimEvaluation = {
  claimId: "c1",
  classification: "מאומת",
  confidence: "high",
  rationale: "מבוסס על מקור רשמי",
  supportingEvidenceIds: ["e1"],
  contradictingEvidenceIds: [],
  missingContext: null,
  whatWouldChangeConclusion: null,
};

const evidence: EvidenceItem = {
  id: "e1",
  claimId: "c1",
  url: "https://example.com",
  title: "מקור",
  publisher: "example.com",
  publicationDate: null,
  retrievedAt: new Date().toISOString(),
  sourceType: "official",
  excerpt: "תוכן",
  accessible: true,
  inaccessibleReason: null,
};

describe("buildReport", () => {
  it("assembles a complete report carrying over all claims, evaluations and evidence unchanged", async () => {
    callStructuredMock.mockResolvedValueOnce({
      overallAssessment: "הטענה נבדקה ואומתה",
      plainExplanation: ["ההסבר המלא"],
      limitations: [],
      openQuestions: [],
    });

    const report = await buildReport({
      claims: [claim],
      evaluations: [evaluation],
      evidence: [evidence],
      searchesUsed: 2,
      searchBudget: 8,
      incomplete: false,
      incompleteReason: null,
    });

    expect(report.claims).toEqual([claim]);
    expect(report.evaluations).toEqual([evaluation]);
    expect(report.evidence).toEqual([evidence]);
    expect(report.incomplete).toBe(false);
    expect(report.id).toBeTruthy();
    expect(report.checkedAt).toBeTruthy();
  });

  it("propagates an incomplete/unavailable-search state instead of presenting it as a full fact-check", async () => {
    callStructuredMock.mockResolvedValueOnce({
      overallAssessment: "לא ניתן היה לבצע חיפוש אמיתי",
      plainExplanation: ["חסר מפתח API לספק חיפוש"],
      limitations: ["לא בוצע חיפוש אמיתי"],
      openQuestions: [],
    });

    const report = await buildReport({
      claims: [claim],
      evaluations: [],
      evidence: [],
      searchesUsed: 0,
      searchBudget: 8,
      incomplete: true,
      incompleteReason: "לא הוגדר מפתח API לספק חיפוש",
    });

    expect(report.incomplete).toBe(true);
    expect(report.incompleteReason).toMatch(/מפתח/);
  });
});
