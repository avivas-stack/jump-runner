import { beforeEach, describe, expect, it, vi } from "vitest";

const { safeFetchMock } = vi.hoisted(() => ({ safeFetchMock: vi.fn() }));
vi.mock("./ssrfGuard", () => ({ safeFetch: safeFetchMock }));

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));
vi.mock("./anthropic", () => ({ callStructured: callStructuredMock }));

const { getTrendingExamples, _resetCacheForTests } = await import("./trendingExamples");

const SAMPLE_HTML = `
<html><body>
<article class="elementor-post elementor-grid-item post-1 exposures type-exposures">
  <h3 class="elementor-post__title"><a href="https://fakereporter.net/exposures/claim-a/">הפייק על X</a></h3>
  <div class="elementor-post__excerpt"><p>סרטון המופץ ברשתות טוען ש-X קרה, אך בפועל לא נמצאה כל ראיה לכך.</p></div>
</article>
<article class="elementor-post elementor-grid-item post-2 exposures type-exposures">
  <h3 class="elementor-post__title"><a href="https://fakereporter.net/exposures/campaign-launch/">פייק ריפורטר משיק קמפיין חדש</a></h3>
  <div class="elementor-post__excerpt"><p>פייק ריפורטר ואיגוד האינטרנט הישראלי השיקו קמפיין חדש להסברה.</p></div>
</article>
<article class="elementor-post elementor-grid-item post-3 exposures type-exposures">
  <h3 class="elementor-post__title"><a href="https://fakereporter.net/exposures/title-only/">ניסיון להטות את הבחירות באמצעות סרטוני בינה מלאכותית</a></h3>
</article>
</body></html>
`;

beforeEach(() => {
  safeFetchMock.mockReset();
  callStructuredMock.mockReset();
  _resetCacheForTests();
});

describe("getTrendingExamples", () => {
  it("extracts a claim only from articles the model judges as a real debunked claim, skipping site announcements", async () => {
    safeFetchMock.mockResolvedValue({ ok: true, status: 200, finalUrl: "https://fakereporter.net/", body: SAMPLE_HTML, contentType: "text/html", truncated: false });
    callStructuredMock.mockResolvedValueOnce({
      picks: [{ candidateIndex: 0, claim: "טענה שX קרה" }],
    });

    const examples = await getTrendingExamples();
    expect(examples).toEqual([
      { claim: "טענה שX קרה", sourceUrl: "https://fakereporter.net/exposures/claim-a/", sourceName: "FakeReporter" },
    ]);
  });

  it("returns an empty array (never throws, never fabricates) when the fetch fails", async () => {
    safeFetchMock.mockRejectedValue(new Error("network down"));
    const examples = await getTrendingExamples();
    expect(examples).toEqual([]);
  });

  it("returns an empty array when the page has no recognizable exposure articles", async () => {
    safeFetchMock.mockResolvedValue({ ok: true, status: 200, finalUrl: "https://fakereporter.net/", body: "<html><body>nothing here</body></html>", contentType: "text/html", truncated: false });
    const examples = await getTrendingExamples();
    expect(examples).toEqual([]);
    expect(callStructuredMock).not.toHaveBeenCalled();
  });

  it("still offers a title-only candidate (no excerpt element on the page) to the model, since some listing widgets render title-only", async () => {
    safeFetchMock.mockResolvedValue({ ok: true, status: 200, finalUrl: "https://fakereporter.net/", body: SAMPLE_HTML, contentType: "text/html", truncated: false });
    callStructuredMock.mockResolvedValueOnce({
      picks: [{ candidateIndex: 2, claim: "טענה שניסיון קיים להטות את הבחירות באמצעות סרטוני בינה מלאכותית" }],
    });

    const examples = await getTrendingExamples();
    expect(examples).toEqual([
      {
        claim: "טענה שניסיון קיים להטות את הבחירות באמצעות סרטוני בינה מלאכותית",
        sourceUrl: "https://fakereporter.net/exposures/title-only/",
        sourceName: "FakeReporter",
      },
    ]);
  });

  it("returns an empty array when the model finds nothing claim-shaped, rather than forcing a pick", async () => {
    safeFetchMock.mockResolvedValue({ ok: true, status: 200, finalUrl: "https://fakereporter.net/", body: SAMPLE_HTML, contentType: "text/html", truncated: false });
    callStructuredMock.mockResolvedValueOnce({ picks: [] });

    const examples = await getTrendingExamples();
    expect(examples).toEqual([]);
  });
});
