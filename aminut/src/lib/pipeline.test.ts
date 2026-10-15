import { describe, expect, it, vi } from "vitest";

const configMock = vi.hoisted(() => ({
  config: {
    anthropicApiKey: undefined as string | undefined,
    tavilyApiKey: undefined as string | undefined,
    extractionModel: "claude-haiku-5-5",
    evaluationModel: "claude-sonnet-5-5",
    maxSearchesPerAnalysis: 8,
    maxClaimsPerAnalysis: 5,
    maxResultsPerSearch: 5,
    maxPageFetchBytes: 1_500_000,
    fetchTimeoutMs: 8000,
    rateLimitPerIpPerHour: 20,
  },
  hasLlmCredentials: vi.fn(),
  hasSearchCredentials: vi.fn(),
}));

vi.mock("./config", () => configMock);

const extractClaimsMock = vi.hoisted(() => vi.fn());
vi.mock("./claimExtraction", () => ({ extractClaims: extractClaimsMock }));

const evaluateClaimMock = vi.hoisted(() => vi.fn());
vi.mock("./evaluation", () => ({ evaluateClaim: evaluateClaimMock }));

const getSearchProviderMock = vi.hoisted(() => vi.fn());
vi.mock("./search", () => ({ getSearchProvider: getSearchProviderMock }));

const buildReportMock = vi.hoisted(() => vi.fn());
vi.mock("./report", () => ({ buildReport: buildReportMock }));

const retrievePageTextMock = vi.hoisted(() => vi.fn());
vi.mock("./pageRetrieval", () => ({ retrievePageText: retrievePageTextMock }));

const { runVerifyPipeline, PipelineError } = await import("./pipeline");

const exampleClaim = {
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
  claimType: "factual" as const,
  missingForVerification: [],
  searchQueryEn: null,
};

describe("runVerifyPipeline", () => {
  it("fails fast with no fabricated progress when the LLM API key is missing", async () => {
    configMock.hasLlmCredentials.mockReturnValue(false);
    const emit = vi.fn();

    await expect(runVerifyPipeline({ text: "טענה" }, emit)).rejects.toMatchObject({
      code: "missing_llm_credentials",
    });
    expect(emit).not.toHaveBeenCalled();
  });

  it("marks the report incomplete and skips LLM evaluation when no search provider is configured", async () => {
    configMock.hasLlmCredentials.mockReturnValue(true);
    configMock.hasSearchCredentials.mockReturnValue(false);
    getSearchProviderMock.mockReturnValue(null);
    extractClaimsMock.mockResolvedValue([exampleClaim]);
    buildReportMock.mockImplementation(async (input) => ({ ...input, id: "r1", checkedAt: "now" }));

    const emit = vi.fn();
    const report = await runVerifyPipeline({ text: "טענה לבדיקה" }, emit);

    expect(evaluateClaimMock).not.toHaveBeenCalled();
    expect(report.incomplete).toBe(true);
    expect(report.incompleteReason).toMatch(/חיפוש/);
    expect(report.evaluations[0].classification).toBe("לא ניתן לאימות");

    const stages = emit.mock.calls.map((c) => c[0].stage);
    expect(stages).toEqual(["extracting_claims", "searching", "preparing_report"]);
  });

  it("rejects when neither text nor a fetchable url yields any content", async () => {
    configMock.hasLlmCredentials.mockReturnValue(true);
    const emit = vi.fn();

    await expect(runVerifyPipeline({ text: "" }, emit)).rejects.toBeInstanceOf(PipelineError);
  });

  it("searches with an Israel/Hebrew ranking boost for a Hebrew claim, and prioritizes the Hebrew result for the full-page fetch", async () => {
    configMock.hasLlmCredentials.mockReturnValue(true);
    configMock.hasSearchCredentials.mockReturnValue(true);
    const hebrewClaim = { ...exampleClaim, normalizedText: "טענה בעברית לבדיקה", searchQueryEn: null };
    extractClaimsMock.mockResolvedValue([hebrewClaim]);
    buildReportMock.mockImplementation(async (input) => ({ ...input, id: "r1", checkedAt: "now" }));
    retrievePageTextMock.mockResolvedValue({ accessible: true, title: "כותרת מלאה", text: "טקסט מלא", reason: null });
    evaluateClaimMock.mockResolvedValue({
      claimId: "c1",
      classification: "לא ניתן לאימות",
      confidence: "low",
      rationale: "x",
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      missingContext: null,
      whatWouldChangeConclusion: null,
    });

    const searchMock = vi.fn().mockResolvedValue([
      { url: "https://example.com/en", title: "English headline", content: "English body text", publishedDate: null },
      { url: "https://example.co.il/he", title: "כותרת בעברית", content: "תוכן בעברית", publishedDate: null },
    ]);
    getSearchProviderMock.mockReturnValue({ name: "tavily", search: searchMock });

    await runVerifyPipeline({ text: "טענה בעברית לבדיקה" }, vi.fn());

    expect(searchMock).toHaveBeenCalledWith(
      "טענה בעברית לבדיקה",
      expect.objectContaining({
        preferCountry: "israel",
        preferLanguage: "hebrew",
        preferDomains: expect.arrayContaining(["fakereporter.net", "irrelevant.org.il"]),
      })
    );
    // The Hebrew result (originally second) must be the one fetched in full, since
    // the full-page fetch is reserved for whichever result ends up first after sorting.
    expect(retrievePageTextMock).toHaveBeenCalledWith("https://example.co.il/he");
  });
});
