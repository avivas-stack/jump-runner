import { describe, expect, it, vi } from "vitest";

const { safeFetchMock } = vi.hoisted(() => ({ safeFetchMock: vi.fn() }));
vi.mock("./ssrfGuard", async () => {
  const actual = await vi.importActual<typeof import("./ssrfGuard")>("./ssrfGuard");
  return { ...actual, safeFetch: safeFetchMock };
});

const { retrievePageText } = await import("./pageRetrieval");

describe("retrievePageText", () => {
  it("extracts the article text and title from an accessible HTML page", async () => {
    safeFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      finalUrl: "https://example.com/article",
      contentType: "text/html; charset=utf-8",
      truncated: false,
      body: "<html><head><title>כותרת הכתבה</title></head><body><nav>תפריט</nav><article><p>תוכן הכתבה האמיתי.</p></article><footer>פוטר</footer></body></html>",
    });

    const result = await retrievePageText("https://example.com/article");
    expect(result.accessible).toBe(true);
    expect(result.title).toBe("כותרת הכתבה");
    expect(result.text).toContain("תוכן הכתבה האמיתי");
    expect(result.text).not.toContain("תפריט");
    expect(result.text).not.toContain("פוטר");
  });

  it("marks a partially-truncated (oversized) page as accessible but notes the truncation, never silently complete", async () => {
    safeFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      finalUrl: "https://example.com/huge",
      contentType: "text/html",
      truncated: true,
      body: "<html><body><article><p>רק חלק מהתוכן נקרא.</p></article></body></html>",
    });

    const result = await retrievePageText("https://example.com/huge");
    expect(result.accessible).toBe(true);
    expect(result.reason).toMatch(/נחתך/);
  });

  it("marks an unreachable page as inaccessible with a reason, never fabricating content", async () => {
    safeFetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      finalUrl: "https://example.com/missing",
      contentType: null,
      truncated: false,
      body: "",
    });

    const result = await retrievePageText("https://example.com/missing");
    expect(result.accessible).toBe(false);
    expect(result.text).toBe("");
    expect(result.reason).toMatch(/404/);
  });

  it("marks an SSRF-blocked private-network URL as inaccessible with the guard's reason", async () => {
    const { SsrfBlockedError } = await import("./ssrfGuard");
    safeFetchMock.mockRejectedValueOnce(new SsrfBlockedError("לא ניתן לגשת לכתובת IP פנימית"));

    const result = await retrievePageText("http://127.0.0.1:8080/admin");
    expect(result.accessible).toBe(false);
    expect(result.reason).toMatch(/פנימ/);
  });
});
