import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReportView } from "./ReportView";
import type { Report } from "@/lib/types";

const report: Report = {
  id: "r1",
  checkedAt: new Date("2026-01-01T10:00:00Z").toISOString(),
  overallAssessment: "הטענה הראשונה אומתה, השנייה נמצאה שגויה",
  plainExplanation: ["הסבר מפורט בעברית על הממצאים", "נקודה שנייה בהסבר"],
  claims: [
    {
      id: "c1",
      originalText: "טענה ראשונה שאומתה",
      normalizedText: "טענה ראשונה",
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
    },
    {
      id: "c2",
      originalText: "טענה שנייה שנמצאה שגויה",
      normalizedText: "טענה שנייה",
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
    },
  ],
  evaluations: [
    {
      claimId: "c1",
      classification: "מאומת",
      confidence: "high",
      rationale: "מבוסס על מקור רשמי",
      supportingEvidenceIds: ["e1"],
      contradictingEvidenceIds: [],
      missingContext: null,
      whatWouldChangeConclusion: null,
    },
    {
      claimId: "c2",
      classification: "שקרי",
      confidence: "high",
      rationale: "סותר מקור רשמי",
      supportingEvidenceIds: [],
      contradictingEvidenceIds: ["e1"],
      missingContext: null,
      whatWouldChangeConclusion: null,
    },
  ],
  evidence: [
    {
      id: "e1",
      claimId: "c1",
      url: "https://example.gov.il/doc",
      title: "מסמך רשמי",
      publisher: "example.gov.il",
      publicationDate: "2026-01-01",
      retrievedAt: new Date().toISOString(),
      sourceType: "official",
      excerpt: "קטע מהמסמך",
      accessible: true,
      inaccessibleReason: null,
    },
  ],
  limitations: ["לא נבדקו כל המקורות האפשריים"],
  openQuestions: ["האם יש עדכון נוסף?"],
  searchesUsed: 3,
  searchBudget: 8,
  incomplete: false,
  incompleteReason: null,
};

describe("ReportView", () => {
  it("renders the overall assessment, each claim's classification, and sources as links", () => {
    render(<ReportView report={report} />);

    expect(screen.getByText(report.overallAssessment)).toBeInTheDocument();
    expect(screen.getAllByText("מאומת").length).toBeGreaterThan(0);
    expect(screen.getAllByText("שקרי").length).toBeGreaterThan(0);

    const link = screen.getAllByRole("link", { name: /מסמך רשמי/ })[0];
    expect(link).toHaveAttribute("href", "https://example.gov.il/doc");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("shows a visible incomplete banner when the report is marked incomplete, never presenting it as a full check", () => {
    render(<ReportView report={{ ...report, incomplete: true, incompleteReason: "לא בוצע חיפוש אמיתי" }} />);
    expect(screen.getByText(/בדיקה חלקית/)).toBeInTheDocument();
    expect(screen.getByText(/לא בוצע חיפוש אמיתי/)).toBeInTheDocument();
  });

  it("shows an empty-state message instead of a fabricated claim list when no claims were found", () => {
    render(<ReportView report={{ ...report, claims: [], evaluations: [] }} />);
    expect(screen.getByText(/לא זוהו טענות עובדתיות/)).toBeInTheDocument();
  });

  it("shows a claim-comparison table when there is more than one claim, linking each row to its card", () => {
    render(<ReportView report={report} />);
    expect(screen.getByText("השוואת טענות")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /טענה ראשונה שאומתה/ });
    expect(link).toHaveAttribute("href", "#claim-c1");
  });

  it("hides the comparison table for a single-claim report (nothing to compare)", () => {
    render(<ReportView report={{ ...report, claims: [report.claims[0]], evaluations: [report.evaluations[0]] }} />);
    expect(screen.queryByText("השוואת טענות")).not.toBeInTheDocument();
  });

  it("flags sources reused across more than one claim instead of presenting them as independent each time", () => {
    const sharedUrl = "https://shared-outlet.example.com/story";
    const reportWithSharedSource: Report = {
      ...report,
      evidence: [
        ...report.evidence,
        { ...report.evidence[0], id: "e2", claimId: "c2", url: sharedUrl, title: "כתבה משותפת" },
        { ...report.evidence[0], id: "e3", claimId: "c1", url: sharedUrl, title: "כתבה משותפת" },
      ],
    };
    render(<ReportView report={reportWithSharedSource} />);
    expect(screen.getByText(/מקור אחד שימש לבדיקת יותר מטענה אחת/)).toBeInTheDocument();
  });

  it("renders plainExplanation as separate bullet points, not one paragraph", () => {
    render(<ReportView report={report} />);
    expect(screen.getByText("הסבר מפורט בעברית על הממצאים")).toBeInTheDocument();
    expect(screen.getByText("נקודה שנייה בהסבר")).toBeInTheDocument();
  });

  it("shows a large single-verdict badge for a one-claim report, keeping the full classification wording (never a true/false binary)", () => {
    const singleClaimReport = { ...report, claims: [report.claims[0]], evaluations: [report.evaluations[0]] };
    render(<ReportView report={singleClaimReport} />);
    // The big hero badge and the per-claim card both render the classification/confidence text.
    expect(screen.getAllByText("מאומת").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/ביטחון גבוה/).length).toBeGreaterThanOrEqual(2);
  });

  it('renders the ככה"נ שקרי classification distinctly from both שקרי and לא ניתן לאימות', () => {
    const singleClaimReport = {
      ...report,
      claims: [report.claims[0]],
      evaluations: [
        {
          ...report.evaluations[0],
          classification: 'ככה"נ שקרי' as const,
          confidence: "medium" as const,
          rationale: "לא נמצא כל אימות לאחר חיפוש יסודי, ואין מקור מקורי לטענה",
        },
      ],
    };
    render(<ReportView report={singleClaimReport} />);
    // Two visible occurrences: the big hero badge and the per-claim card. (The
    // "how it works" legend also lists every classification name, incl. שקרי and
    // לא ניתן לאימות, inside a closed <dialog> — present in the DOM by design,
    // but not what this test is about.)
    expect(screen.getAllByText('ככה"נ שקרי').length).toBeGreaterThanOrEqual(2);
  });

  it("shows a classification-count summary for a multi-claim report instead of one single verdict", () => {
    render(<ReportView report={report} />);
    expect(screen.getByText("סיכום הסיווגים")).toBeInTheDocument();
    expect(screen.getAllByText("× 1")).toHaveLength(2);
  });

  it("truncates a long evidence excerpt with a 'show more' toggle instead of dumping the full text inline", () => {
    const longExcerpt =
      "קטע ראיה ארוך מאוד שמטרתו לבדוק שהתצוגה אינה מציפה את הקורא בטקסט ארוך ברצף אחד ללא כל קיצור או אפשרות לקפל אותו בחזרה, " +
      "וממשיך עוד ועוד כדי לוודא שהוא עובר את סף הקיצור המוגדר ברכיב כך שאפשרות ההרחבה תופיע בפועל ותהיה ניתנת לבדיקה.";
    const singleClaimReport = {
      ...report,
      claims: [report.claims[0]],
      evaluations: [report.evaluations[0]],
      evidence: [{ ...report.evidence[0], excerpt: longExcerpt }],
    };
    render(<ReportView report={singleClaimReport} />);

    expect(screen.queryByText(longExcerpt)).not.toBeInTheDocument();
    const showMore = screen.getByRole("button", { name: "הצג עוד" });
    fireEvent.click(showMore);
    expect(screen.getByText(longExcerpt)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "הצג פחות" })).toBeInTheDocument();
  });

  it("renders a 'new check' button at the top only when onNewCheck is provided", () => {
    const onNewCheck = vi.fn();
    render(<ReportView report={report} onNewCheck={onNewCheck} />);
    const button = screen.getByRole("button", { name: /בדיקה חדשה/ });
    button.click();
    expect(onNewCheck).toHaveBeenCalledOnce();
  });

  it("omits the top 'new check' button when onNewCheck is not provided", () => {
    render(<ReportView report={report} />);
    expect(screen.queryByRole("button", { name: /בדיקה חדשה/ })).not.toBeInTheDocument();
  });

  it("shows a share/don't-share recommendation next to every classification, defaulting false claims to don't-share", () => {
    render(<ReportView report={report} />);
    // מאומת -> share; שקרי -> block. Each appears at least in the hero/summary and the claim card.
    expect(screen.getAllByText("המלצה: אפשר להעביר").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("המלצה: לא להעביר!").length).toBeGreaterThanOrEqual(1);
  });

  it("never recommends sharing an unverifiable claim, even though it isn't classified as false", () => {
    const singleClaimReport = {
      ...report,
      claims: [report.claims[0]],
      evaluations: [{ ...report.evaluations[0], classification: "לא ניתן לאימות" as const }],
    };
    render(<ReportView report={singleClaimReport} />);
    expect(screen.getAllByText("המלצה: לא להעביר!").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("המלצה: אפשר להעביר")).not.toBeInTheDocument();
  });

  it("shows a dedicated section for evidence from known fact-checking sites, grouped by claim", () => {
    const reportWithFactChecker: Report = {
      ...report,
      evidence: [
        ...report.evidence,
        {
          id: "e2",
          claimId: "c2",
          url: "https://fakereporter.net/some-check",
          title: "בדיקה של FakeReporter",
          publisher: "fakereporter.net",
          publicationDate: "2026-01-02",
          retrievedAt: new Date().toISOString(),
          sourceType: "fact-checker",
          excerpt: "ממצא עצמאי מהאתר",
          accessible: true,
          inaccessibleReason: null,
        },
      ],
    };
    render(<ReportView report={reportWithFactChecker} />);
    expect(screen.getByText("מה אתרי בדיקת עובדות אחרים אמרו")).toBeInTheDocument();
    // Appears both in the dedicated section and in the full "all sources" list below it.
    const links = screen.getAllByRole("link", { name: "בדיקה של FakeReporter" });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]).toHaveAttribute("href", "https://fakereporter.net/some-check");
  });

  it("omits the fact-checking-sites section when no fact-checker evidence was found", () => {
    render(<ReportView report={report} />);
    expect(screen.queryByText("מה אתרי בדיקת עובדות אחרים אמרו")).not.toBeInTheDocument();
  });
});
