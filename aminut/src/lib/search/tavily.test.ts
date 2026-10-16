import { afterEach, describe, expect, it, vi } from "vitest";
import { TavilySearchProvider } from "./tavily";
import { SearchProviderError } from "./types";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("TavilySearchProvider", () => {
  it("parses successful results into the normalized SearchResultItem shape", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { url: "https://a.com/1", title: "כותרת", content: "תוכן", published_date: "2026-01-01" },
          ],
        }),
        { status: 200 }
      )
    );

    const provider = new TavilySearchProvider("test-key");
    const results = await provider.search("query", { maxResults: 5 });
    expect(results).toEqual([
      { url: "https://a.com/1", title: "כותרת", content: "תוכן", publishedDate: "2026-01-01" },
    ]);
  });

  it("passes country/language as ranking boosts (not a strict filter) when requested", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    global.fetch = fetchMock;

    const provider = new TavilySearchProvider("test-key");
    await provider.search("שאלה", { maxResults: 5, preferCountry: "israel", preferLanguage: "hebrew" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.country).toBe("israel");
    expect(body.language).toBe("hebrew");
  });

  it("passes preferDomains as include_domains with mode 'prefer' (a boost, never a restrict)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    global.fetch = fetchMock;

    const provider = new TavilySearchProvider("test-key");
    await provider.search("query", { maxResults: 5, preferDomains: ["fakereporter.net", "irrelevant.org.il"] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.include_domains).toEqual(["fakereporter.net", "irrelevant.org.il"]);
    expect(body.include_domains_mode).toBe("prefer");
  });

  it("passes restrictDomains as include_domains with no mode (a genuine strict filter, unlike preferDomains)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    global.fetch = fetchMock;

    const provider = new TavilySearchProvider("test-key");
    await provider.search("query", { maxResults: 5, restrictDomains: ["ynet.co.il", "haaretz.co.il"] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.include_domains).toEqual(["ynet.co.il", "haaretz.co.il"]);
    expect(body).not.toHaveProperty("include_domains_mode");
  });

  it("prefers restrictDomains over preferDomains if both were somehow passed together", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    global.fetch = fetchMock;

    const provider = new TavilySearchProvider("test-key");
    await provider.search("query", {
      maxResults: 5,
      preferDomains: ["fakereporter.net"],
      restrictDomains: ["ynet.co.il"],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.include_domains).toEqual(["ynet.co.il"]);
    expect(body).not.toHaveProperty("include_domains_mode");
  });

  it("omits include_domains entirely when no preferDomains are requested", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    global.fetch = fetchMock;

    const provider = new TavilySearchProvider("test-key");
    await provider.search("query", { maxResults: 5 });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("include_domains");
    expect(body).not.toHaveProperty("include_domains_mode");
  });

  it("omits country/language entirely when not requested, rather than sending empty values", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    global.fetch = fetchMock;

    const provider = new TavilySearchProvider("test-key");
    await provider.search("query", { maxResults: 5 });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("country");
    expect(body).not.toHaveProperty("language");
  });

  it("throws a SearchProviderError (not a silent empty result) on a network outage", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const provider = new TavilySearchProvider("test-key");
    await expect(provider.search("query", { maxResults: 5 })).rejects.toBeInstanceOf(SearchProviderError);
  });

  it("surfaces a clear error on an invalid API key (401)", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 }));
    const provider = new TavilySearchProvider("bad-key");
    await expect(provider.search("query", { maxResults: 5 })).rejects.toThrow(/מפתח/);
  });

  it("surfaces a clear error on provider rate-limiting (429)", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }));
    const provider = new TavilySearchProvider("test-key");
    await expect(provider.search("query", { maxResults: 5 })).rejects.toThrow(/מכסת/);
  });

  it("surfaces a clear error on a provider 5xx outage", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("down", { status: 503 }));
    const provider = new TavilySearchProvider("test-key");
    await expect(provider.search("query", { maxResults: 5 })).rejects.toThrow(/503/);
  });
});
