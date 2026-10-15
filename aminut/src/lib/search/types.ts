export interface SearchResultItem {
  url: string;
  title: string;
  content: string;
  publishedDate: string | null;
}

export interface SearchOptions {
  maxResults: number;
  /** Boosts (never strictly filters) results from this country, e.g. "israel". */
  preferCountry?: string;
  /** Boosts (never strictly filters, unless combined with a provider's own strict mode) results in this language, e.g. "hebrew". */
  preferLanguage?: string;
  /** Boosts (never restricts to) results from these hostnames, e.g. known fact-checking sites. */
  preferDomains?: string[];
}

export interface SearchProvider {
  readonly name: string;
  search(query: string, opts: SearchOptions): Promise<SearchResultItem[]>;
}

export class SearchProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "SearchProviderError";
  }
}
