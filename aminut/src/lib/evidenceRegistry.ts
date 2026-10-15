import { EvidenceItem, EvidenceSourceType } from "./types";

/**
 * Per-request registry of evidence items with stable ids. The report generator
 * (and the LLM) may only cite ids that exist here — every citation is checked
 * against this registry before the report is shown (see report.ts).
 */
export class EvidenceRegistry {
  private items = new Map<string, EvidenceItem>();
  private urlToId = new Map<string, string>();
  private counter = 0;

  /** Adds an item, or returns the existing id if this URL was already registered. */
  add(input: Omit<EvidenceItem, "id">): EvidenceItem {
    const existingId = this.urlToId.get(input.url);
    if (existingId) {
      return this.items.get(existingId)!;
    }
    this.counter += 1;
    const id = `e${this.counter}`;
    const item: EvidenceItem = { ...input, id };
    this.items.set(id, item);
    this.urlToId.set(input.url, id);
    return item;
  }

  get(id: string): EvidenceItem | undefined {
    return this.items.get(id);
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  all(): EvidenceItem[] {
    return Array.from(this.items.values());
  }

  forClaim(claimId: string): EvidenceItem[] {
    return this.all().filter((e) => e.claimId === claimId);
  }
}

export function classifySourceType(url: string): EvidenceSourceType {
  const host = safeHost(url);
  if (!host) return "other";
  if (FACT_CHECKER_HOSTS.some((h) => host.endsWith(h))) return "fact-checker";
  if (OFFICIAL_HOSTS.some((h) => host.endsWith(h))) return "official";
  return "news";
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Known fact-checking sites, Israeli ones first. Used both to classify evidence
 * source type and (see pipeline.ts) as a search ranking boost — never a filter,
 * so other sources still surface when they're the best evidence.
 */
export const FACT_CHECKER_HOSTS = [
  "hamashrokit.globes.co.il",
  "fakereporter.net",
  "irrelevant.org.il",
  "special.n12.co.il",
  "factcheck.org",
  "politifact.com",
  "snopes.com",
  "fullfact.org",
  "apnews.com/hub/ap-fact-check",
  "reuters.com/fact-check",
];

const OFFICIAL_HOSTS = ["gov.il", ".gov", "knesset.gov.il", "cbs.gov.il"];
