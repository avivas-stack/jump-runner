import { SearchOptions, SearchProvider, SearchProviderError, SearchResultItem } from "./types";

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

/**
 * Tavily Search API provider (https://docs.tavily.com/documentation/api-reference/endpoint/search).
 * The default, practical search backend for this app: one API key, clean JSON results with
 * title/url/content/published_date, and a search_depth tuned for research-style queries.
 */
export class TavilySearchProvider implements SearchProvider {
  readonly name = "tavily";

  constructor(private readonly apiKey: string) {}

  async search(query: string, opts: SearchOptions): Promise<SearchResultItem[]> {
    let res: Response;
    try {
      res = await fetch(TAVILY_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query,
          max_results: opts.maxResults,
          search_depth: "advanced",
          include_answer: false,
          // Both bias ranking only — never a strict filter — so English/international
          // coverage still surfaces when it's the best evidence, per the brief's
          // "prioritize Hebrew/Israeli... while supporting English and international sources".
          ...(opts.preferCountry ? { country: opts.preferCountry } : {}),
          ...(opts.preferLanguage ? { language: opts.preferLanguage } : {}),
          ...(opts.preferDomains?.length
            ? { include_domains: opts.preferDomains, include_domains_mode: "prefer" }
            : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      throw new SearchProviderError("לא ניתן היה להתחבר לספק החיפוש (Tavily)", err);
    }

    if (res.status === 401 || res.status === 403) {
      throw new SearchProviderError("מפתח ה-API של Tavily אינו תקין או שפג תוקפו");
    }
    if (res.status === 429) {
      throw new SearchProviderError("חריגה ממכסת הבקשות של ספק החיפוש (Tavily)");
    }
    if (!res.ok) {
      throw new SearchProviderError(`ספק החיפוש החזיר שגיאה (סטטוס ${res.status})`);
    }

    const data = (await res.json()) as {
      results?: Array<{ url: string; title: string; content: string; published_date?: string | null }>;
    };

    return (data.results ?? []).map((r) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      publishedDate: r.published_date ?? null,
    }));
  }
}
