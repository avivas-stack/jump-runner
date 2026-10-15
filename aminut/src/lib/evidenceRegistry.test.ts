import { describe, expect, it } from "vitest";
import { EvidenceRegistry, classifySourceType } from "./evidenceRegistry";

function baseItem() {
  return {
    claimId: "c1",
    url: "https://example.com/article",
    title: "כתבה",
    publisher: "example.com",
    publicationDate: null,
    retrievedAt: new Date().toISOString(),
    sourceType: "news" as const,
    excerpt: "קטע",
    accessible: true,
    inaccessibleReason: null,
  };
}

describe("EvidenceRegistry", () => {
  it("assigns stable, sequential ids", () => {
    const registry = new EvidenceRegistry();
    const a = registry.add(baseItem());
    const b = registry.add({ ...baseItem(), url: "https://example.com/other" });
    expect(a.id).toBe("e1");
    expect(b.id).toBe("e2");
  });

  it("deduplicates identical sources by URL — multiple outlets repeating one report count once", () => {
    const registry = new EvidenceRegistry();
    const first = registry.add(baseItem());
    const second = registry.add(baseItem());
    expect(first.id).toBe(second.id);
    expect(registry.all()).toHaveLength(1);
  });

  it("only recognizes ids it actually issued — fabricated ids must not validate", () => {
    const registry = new EvidenceRegistry();
    const item = registry.add(baseItem());
    expect(registry.has(item.id)).toBe(true);
    expect(registry.has("e_fabricated")).toBe(false);
  });

  it("filters evidence per claim", () => {
    const registry = new EvidenceRegistry();
    registry.add({ ...baseItem(), url: "https://a.com/1", claimId: "c1" });
    registry.add({ ...baseItem(), url: "https://a.com/2", claimId: "c2" });
    expect(registry.forClaim("c1")).toHaveLength(1);
    expect(registry.forClaim("c2")).toHaveLength(1);
  });
});

describe("classifySourceType", () => {
  it("recognizes known Israeli and international fact-checkers", () => {
    expect(classifySourceType("https://www.hamashrokit.globes.co.il/some-article")).toBe("fact-checker");
    expect(classifySourceType("https://www.snopes.com/fact-check/x")).toBe("fact-checker");
    expect(classifySourceType("https://www.irrelevant.org.il/some-post")).toBe("fact-checker");
    expect(classifySourceType("https://fakereporter.net/exposures/x")).toBe("fact-checker");
    expect(classifySourceType("https://special.n12.co.il/elections_factcheck")).toBe("fact-checker");
  });

  it("recognizes government/official domains", () => {
    expect(classifySourceType("https://www.gov.il/he/pages/x")).toBe("official");
  });

  it("falls back to news for ordinary domains, including the general n12 site (only its elections fact-check subdomain is a fact-checker)", () => {
    expect(classifySourceType("https://www.ynet.co.il/article")).toBe("news");
    expect(classifySourceType("https://www.n12.co.il/some-regular-article")).toBe("news");
  });

  it("falls back to other for an unparseable URL", () => {
    expect(classifySourceType("not a url")).toBe("other");
  });
});
