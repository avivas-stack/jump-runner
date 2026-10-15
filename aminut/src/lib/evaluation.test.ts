import { describe, expect, it, vi } from "vitest";
import type { EvidenceItem, ExtractedClaim } from "./types";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));
vi.mock("./anthropic", () => ({ callStructured: callStructuredMock }));

const { evaluateClaim } = await import("./evaluation");

function makeClaim(overrides: Partial<ExtractedClaim> = {}): ExtractedClaim {
  return {
    id: "c1",
    originalText: 'ראש העירייה הכריז על תקציב של 10 מיליון ש"ח לפארק חדש',
    normalizedText: "ראש העירייה הכריז על תקציב לפארק חדש",
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
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: "e1",
    claimId: "c1",
    url: "https://example-news.co.il/article",
    title: "כתבה על התקציב",
    publisher: "example-news.co.il",
    publicationDate: "2026-01-01",
    retrievedAt: new Date().toISOString(),
    sourceType: "news",
    excerpt: "ראש העירייה אישר תקציב של 10 מיליון שקל",
    accessible: true,
    inaccessibleReason: null,
    ...overrides,
  };
}

describe("evaluateClaim", () => {
  it("classifies a claim strongly supported by primary sources as מאומת", async () => {
    const evidence = [makeEvidence({ id: "e1", sourceType: "official" })];
    callStructuredMock.mockResolvedValueOnce({
      claimId: "c1",
      classification: "מאומת",
      confidence: "high",
      rationale: "מסמך רשמי מאשר את הטענה",
      supportingEvidenceIds: ["e1"],
      contradictingEvidenceIds: [],
      missingContext: null,
      whatWouldChangeConclusion: null,
    });

    const result = await evaluateClaim(makeClaim(), evidence);
    expect(result.classification).toBe("מאומת");
    expect(result.supportingEvidenceIds).toEqual(["e1"]);
  });

  it("classifies a contradicted claim as שקרי", async () => {
    const evidence = [makeEvidence({ id: "e1", excerpt: "התקציב שאושר היה 2 מיליון ש\"ח בלבד, לא 10" })];
    callStructuredMock.mockResolvedValueOnce({
      claimId: "c1",
      classification: "שקרי",
      confidence: "high",
      rationale: "המקור הרשמי סותר את הסכום הנטען",
      supportingEvidenceIds: [],
      contradictingEvidenceIds: ["e1"],
      missingContext: null,
      whatWouldChangeConclusion: null,
    });

    const result = await evaluateClaim(makeClaim(), evidence);
    expect(result.classification).toBe("שקרי");
    expect(result.contradictingEvidenceIds).toEqual(["e1"]);
  });

  it("classifies a true-but-misleading headline as מטעה", async () => {
    callStructuredMock.mockResolvedValueOnce({
      claimId: "c1",
      classification: "מטעה",
      confidence: "medium",
      rationale: "המספר נכון אך מוצג ללא ההקשר שהוא חלק מתקציב רב-שנתי",
      supportingEvidenceIds: ["e1"],
      contradictingEvidenceIds: [],
      missingContext: "הסכום פרוס על פני שלוש שנים, לא תקציב חד פעמי",
      whatWouldChangeConclusion: null,
    });

    const result = await evaluateClaim(makeClaim(), [makeEvidence()]);
    expect(result.classification).toBe("מטעה");
    expect(result.missingContext).toBeTruthy();
  });

  it("classifies a claim missing historical context as חסר הקשר", async () => {
    callStructuredMock.mockResolvedValueOnce({
      claimId: "c1",
      classification: "חסר הקשר",
      confidence: "medium",
      rationale: "הטענה נכונה אך משמיטה שהפרויקט כבר הוכרז שנה קודם",
      supportingEvidenceIds: ["e1"],
      contradictingEvidenceIds: [],
      missingContext: "הכרזה קודמת ב-2025 לא הוזכרה",
      whatWouldChangeConclusion: null,
    });

    const result = await evaluateClaim(makeClaim(), [makeEvidence()]);
    expect(result.classification).toBe("חסר הקשר");
  });

  it("classifies a claim with insufficient evidence as לא ניתן לאימות, never as false", async () => {
    callStructuredMock.mockResolvedValueOnce({
      claimId: "c1",
      classification: "לא ניתן לאימות",
      confidence: "high",
      rationale: "לא נמצאו מקורות אמינים הדנים בטענה זו",
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      missingContext: null,
      whatWouldChangeConclusion: "דיווח ישיר מראיית העירייה",
    });

    const result = await evaluateClaim(makeClaim(), []);
    expect(result.classification).toBe("לא ניתן לאימות");
  });

  it("classifies a once-true-now-outdated claim as מיושן", async () => {
    callStructuredMock.mockResolvedValueOnce({
      claimId: "c1",
      classification: "מיושן",
      confidence: "medium",
      rationale: "הנתון היה נכון ב-2023 אך עודכן מאז",
      supportingEvidenceIds: ["e1"],
      contradictingEvidenceIds: [],
      missingContext: null,
      whatWouldChangeConclusion: null,
    });

    const result = await evaluateClaim(makeClaim(), [makeEvidence()]);
    expect(result.classification).toBe("מיושן");
  });

  it('classifies a thoroughly-searched, unsubstantiated viral-style claim as ככה"נ שקרי (distinct from a flat unverifiable, and from a directly-refuted שקרי)', async () => {
    const evidence = [
      makeEvidence({ id: "e1", excerpt: "אין בשום מקור רשמי אזכור להודעה כזו מהעירייה" }),
      makeEvidence({ id: "e2", excerpt: "ישיבת המועצה האחרונה לא כללה דיון בנושא פארקים" }),
    ];
    callStructuredMock.mockResolvedValueOnce({
      claimId: "c1",
      classification: 'ככה"נ שקרי',
      confidence: "medium",
      rationale:
        "זוהי מסקנה מהיעדר אימות לאחר חיפוש יסודי, לא הפרכה ישירה: לא נמצא כל מקור מקורי או הודעה רשמית שתואמת את הטענה, והראיות הזמינות אינן מזכירות אותה כלל.",
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      missingContext: null,
      whatWouldChangeConclusion: "הודעה רשמית מתועדת מהעירייה שתציג את התקציב הנטען",
    });

    const result = await evaluateClaim(makeClaim(), evidence);
    expect(result.classification).toBe('ככה"נ שקרי');
    expect(result.confidence).not.toBe("high");
  });

  it("classifies conflicting sources as שנוי במחלוקת rather than forcing true/false", async () => {
    const evidence = [
      makeEvidence({ id: "e1", excerpt: "מקור א' מאשר את הנתון" }),
      makeEvidence({ id: "e2", excerpt: "מקור ב' מכחיש את הנתון" }),
    ];
    callStructuredMock.mockResolvedValueOnce({
      claimId: "c1",
      classification: "שנוי במחלוקת",
      confidence: "low",
      rationale: "שני מקורות אמינים סותרים זה את זה",
      supportingEvidenceIds: ["e1"],
      contradictingEvidenceIds: ["e2"],
      missingContext: null,
      whatWouldChangeConclusion: null,
    });

    const result = await evaluateClaim(makeClaim(), evidence);
    expect(result.classification).toBe("שנוי במחלוקת");
  });

  it("strips fabricated citation ids not present in the registered evidence (prompt-injection / hallucination defense)", async () => {
    const evidence = [makeEvidence({ id: "e1" })];
    callStructuredMock.mockResolvedValueOnce({
      claimId: "c1",
      classification: "מאומת",
      confidence: "high",
      rationale: "מבוסס על מקור",
      // "e999" and "e_injected" were never given to the model as real evidence ids;
      // this simulates a model that was manipulated (e.g. via injected article text)
      // into fabricating a citation.
      supportingEvidenceIds: ["e1", "e999", "e_injected"],
      contradictingEvidenceIds: ["e_also_fake"],
      missingContext: null,
      whatWouldChangeConclusion: null,
    });

    const result = await evaluateClaim(makeClaim(), evidence);
    expect(result.supportingEvidenceIds).toEqual(["e1"]);
    expect(result.contradictingEvidenceIds).toEqual([]);
  });
});
