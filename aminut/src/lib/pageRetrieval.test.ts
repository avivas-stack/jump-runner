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

  it("falls back to the og:description meta tag when the body is entirely JS-rendered (e.g. a Facebook post-share link)", async () => {
    safeFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      finalUrl: "https://www.facebook.com/story.php?story_fbid=123",
      contentType: "text/html; charset=utf-8",
      truncated: false,
      body:
        '<html><head><title>FastNews - טענה שמתפרסמת</title>' +
        '<meta property="og:description" content="זו הטענה האמיתית שפורסמה בפוסט."/>' +
        '</head><body><script>window.__data = { huge: "json blob", more: "text that lives only in JS" };</script></body></html>',
    });

    const result = await retrievePageText("https://www.facebook.com/story.php?story_fbid=123");
    expect(result.accessible).toBe(true);
    expect(result.text).toBe("זו הטענה האמיתית שפורסמה בפוסט.");
  });

  it("never overrides real visible body text with the meta description, even when both exist", async () => {
    safeFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      finalUrl: "https://example.com/article",
      contentType: "text/html",
      truncated: false,
      body:
        '<html><head><meta property="og:description" content="תקציר קצר לשיתוף בלבד."/></head>' +
        "<body><article><p>זהו תוכן הכתבה המלא והאמיתי, ארוך בהרבה מהתקציר שבמטא-דאטה.</p></article></body></html>",
    });

    const result = await retrievePageText("https://example.com/article");
    expect(result.text).toContain("תוכן הכתבה המלא והאמיתי");
    expect(result.text).not.toContain("תקציר קצר לשיתוף בלבד");
  });

  it("identifies as a known link-preview crawler to social hosts that gate real content behind a login wall, but keeps the honest UA everywhere else", async () => {
    safeFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      finalUrl: "https://example.com",
      contentType: "text/html",
      truncated: false,
      body: "<html><body><article><p>תוכן</p></article></body></html>",
    });

    await retrievePageText("https://www.facebook.com/story.php?story_fbid=123");
    expect(safeFetchMock.mock.calls[0][1].userAgent).toMatch(/facebookexternalhit/);

    await retrievePageText("https://example.com/article");
    expect(safeFetchMock.mock.calls[1][1].userAgent).toBeUndefined();
  });
});
