import { extractClaims } from "./claimExtraction";
import { evaluateClaim } from "./evaluation";
import { EvidenceRegistry, classifySourceType, FACT_CHECKER_HOSTS } from "./evidenceRegistry";
import { retrievePageText } from "./pageRetrieval";
import { buildReport } from "./report";
import { getSearchProvider } from "./search";
import { config, hasLlmCredentials, hasSearchCredentials } from "./config";
import { ClaimEvaluation, Report, StageEvent, VerifyRequest } from "./types";

export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "PipelineError";
  }
}

function isHebrew(text: string): boolean {
  return /[֐-׿]/.test(text);
}

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Runs the full verify pipeline, invoking `emit` with real progress events as each
 * stage actually starts — never a fabricated percentage or step the pipeline hasn't
 * reached yet.
 */
export async function runVerifyPipeline(
  input: VerifyRequest,
  emit: (event: StageEvent) => void
): Promise<Report> {
  if (!hasLlmCredentials()) {
    throw new PipelineError("חסר מפתח API הכרחי להרצת הבדיקה (ANTHROPIC_API_KEY)", "missing_llm_credentials");
  }

  let combinedContent = input.text?.trim() ?? "";
  let urlFetchNote: string | null = null;

  if (input.url) {
    emit({ type: "stage", stage: "fetching_url" });
    const page = await retrievePageText(input.url);
    if (page.accessible && page.text) {
      combinedContent = combinedContent
        ? `${combinedContent}\n\n[תוכן מהקישור שסופק: ${input.url}]\n${page.text}`
        : `[תוכן מהקישור שסופק: ${input.url}]\n${page.text}`;
    } else {
      urlFetchNote = `לא ניתן היה לאחזר את תוכן הקישור (${page.reason ?? "סיבה לא ידועה"}).`;
    }
  }

  if (!combinedContent.trim()) {
    throw new PipelineError("לא נמצא טקסט לבדיקה — הקישור לא נגיש ולא סופק טקסט נוסף", "no_content");
  }

  emit({ type: "stage", stage: "extracting_claims" });
  const claims = await extractClaims(combinedContent, config.maxClaimsPerAnalysis);

  const registry = new EvidenceRegistry();
  const evaluations: ClaimEvaluation[] = [];
  let searchesUsed = 0;
  const issuedQueries = new Set<string>();
  const searchProvider = getSearchProvider();
  const searchUnavailable = !hasSearchCredentials() || !searchProvider;

  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    emit({
      type: "stage",
      stage: "searching",
      claimIndex: i + 1,
      totalClaims: claims.length,
      claimText: claim.originalText,
    });

    if (searchUnavailable) {
      evaluations.push({
        claimId: claim.id,
        classification: "לא ניתן לאימות",
        confidence: "high",
        rationale: "חיפוש מקורות אמיתי אינו זמין כעת (לא הוגדר מפתח API לספק החיפוש), ולכן לא ניתן היה לאסוף ראיות עבור טענה זו.",
        supportingEvidenceIds: [],
        contradictingEvidenceIds: [],
        missingContext: null,
        whatWouldChangeConclusion: "הגדרת מפתח API תקין לספק חיפוש (TAVILY_API_KEY) תאפשר בדיקה אמיתית.",
        likelyOrigin: null,
      });
      continue;
    }

    const claimIsHebrew = isHebrew(claim.normalizedText);
    const queries: { text: string; preferCountry?: string; preferLanguage?: string }[] = [
      claimIsHebrew
        ? { text: claim.normalizedText, preferCountry: "israel", preferLanguage: "hebrew" }
        : { text: claim.normalizedText },
    ];
    if (claimIsHebrew && claim.searchQueryEn) {
      queries.push({ text: claim.searchQueryEn, preferLanguage: "english" });
    }

    const claimEvidence = [];
    for (const query of queries) {
      if (searchesUsed >= config.maxSearchesPerAnalysis) break;
      const key = normalizeQuery(query.text);
      if (issuedQueries.has(key)) continue;
      issuedQueries.add(key);

      try {
        let results = await searchProvider!.search(query.text, {
          maxResults: config.maxResultsPerSearch,
          preferCountry: query.preferCountry,
          preferLanguage: query.preferLanguage,
          // Boost (never restrict to) known fact-checking sites on every query —
          // costs no extra search, since it's the same call, just re-ranked.
          preferDomains: FACT_CHECKER_HOSTS,
        });
        // Defense in depth beyond the provider's own ranking boost: for the Hebrew
        // primary query, put Hebrew-script results first so the "fetch full page"
        // treatment below (reserved for index 0) lands on a Hebrew source when one
        // is available, instead of whichever the provider happened to rank first.
        if (claimIsHebrew && query.preferLanguage === "hebrew") {
          results = [...results].sort((a, b) => Number(isHebrew(b.title + b.content)) - Number(isHebrew(a.title + a.content)));
        }
        searchesUsed += 1;
        for (let r = 0; r < results.length; r++) {
          const result = results[r];
          let excerpt = result.content;
          let title = result.title;
          if (r === 0) {
            const page = await retrievePageText(result.url);
            if (page.accessible && page.text) {
              excerpt = page.text.slice(0, 1500);
              title = page.title ?? result.title;
            }
          }
          const item = registry.add({
            claimId: claim.id,
            url: result.url,
            title,
            publisher: safeHostname(result.url),
            publicationDate: result.publishedDate,
            retrievedAt: new Date().toISOString(),
            sourceType: classifySourceType(result.url),
            excerpt,
            accessible: true,
            inaccessibleReason: null,
          });
          claimEvidence.push(item);
        }
      } catch {
        // A single failed query must not kill the whole analysis; it just yields fewer
        // results for this claim, and the final report marks reduced confidence below.
        continue;
      }
    }

    emit({ type: "stage", stage: "comparing_sources" });
    const evaluation = await evaluateClaim(claim, claimEvidence.length ? claimEvidence : registry.forClaim(claim.id));
    evaluations.push(evaluation);
  }

  emit({ type: "stage", stage: "preparing_report" });

  const incomplete = searchUnavailable || Boolean(urlFetchNote);
  const incompleteReason = searchUnavailable
    ? "לא בוצע חיפוש אמיתי ברשת מכיוון שלא הוגדר מפתח API לספק חיפוש. התוצאה אינה בדיקת עובדות מלאה."
    : urlFetchNote;

  const report = await buildReport({
    claims,
    evaluations,
    evidence: registry.all(),
    searchesUsed,
    searchBudget: config.maxSearchesPerAnalysis,
    incomplete,
    incompleteReason,
  });

  return report;
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
