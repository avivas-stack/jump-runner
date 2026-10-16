import { beforeEach, describe, expect, it, vi } from "vitest";

const { safeFetchMock } = vi.hoisted(() => ({ safeFetchMock: vi.fn() }));
vi.mock("./ssrfGuard", () => ({ safeFetch: safeFetchMock }));

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));
vi.mock("./anthropic", () => ({ callStructured: callStructuredMock }));

const { getTrendingExamples, _resetCacheForTests } = await import("./trendingExamples");

const FAKEREPORTER_HTML = `
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

const IRRELEVANT_HTML = `
<html><body>
<article class="item-list post w2 post-6676">
  <h2 class="entry-title"><a href="https://www.irrelevant.org.il/2026/09/06/6676">שיחת עוקץ מפלטינום <span class="titlecat">(המלצה - לכאן ולכאן)</span></a></h2>
  <p class="post-date">6 בספטמבר 2026</p>
  <div class="entry"><p>חברת פלטינום יש אתר אינטרנט ואכן הטלפון שלהם הוא 3779*.<a class="more-link">המשך לקרוא »</a></p></div>
</article>
<article class="item-list post w2 post-6677">
  <h2 class="entry-title"><a href="https://www.irrelevant.org.il/2026/09/07/6677">עוד שמועה שנבדקה <span class="titlecat">(פייק)</span></a></h2>
  <div class="entry"><p>תיאור קצר של השמועה השנייה שנבדקה.<a class="more-link">המשך לקרוא »</a></p></div>
</article>
</body></html>
`;

const EMPTY_HTML = "<html><body>nothing here</body></html>";

function mockSources(fakereporter: "ok" | "empty" | "fail", irrelevant: "ok" | "empty" | "fail") {
  safeFetchMock.mockImplementation((url: string) => {
    if (url.includes("fakereporter")) {
      if (fakereporter === "fail") return Promise.reject(new Error("network down"));
      return Promise.resolve({
        ok: true,
        status: 200,
        finalUrl: url,
        body: fakereporter === "ok" ? FAKEREPORTER_HTML : EMPTY_HTML,
        contentType: "text/html",
        truncated: false,
      });
    }
    if (url.includes("irrelevant")) {
      if (irrelevant === "fail") return Promise.reject(new Error("network down"));
      return Promise.resolve({
        ok: true,
        status: 200,
        finalUrl: url,
        body: irrelevant === "ok" ? IRRELEVANT_HTML : EMPTY_HTML,
        contentType: "text/html",
        truncated: false,
      });
    }
    return Promise.resolve({ ok: false, status: 404, finalUrl: url, body: "", contentType: "text/html", truncated: false });
  });
}

function mockModelPicks() {
  callStructuredMock.mockImplementation((opts: { prompt: string }) => {
    if (opts.prompt.includes("הפייק על X")) {
      return Promise.resolve({
        picks: [
          { candidateIndex: 0, claim: "טענה שX קרה" },
          { candidateIndex: 2, claim: "טענה שניסיון קיים להטות את הבחירות באמצעות סרטוני בינה מלאכותית" },
        ],
      });
    }
    if (opts.prompt.includes("שיחת עוקץ")) {
      return Promise.resolve({
        picks: [
          { candidateIndex: 0, claim: "טענה שחברת פלטינום מתחזה לכללית פלטינום" },
          { candidateIndex: 1, claim: "טענה על השמועה השנייה" },
        ],
      });
    }
    return Promise.resolve({ picks: [] });
  });
}

beforeEach(() => {
  safeFetchMock.mockReset();
  callStructuredMock.mockReset();
  _resetCacheForTests();
});

describe("getTrendingExamples", () => {
  it("combines claims from multiple fact-checking sources, each with its own correct source link", async () => {
    mockSources("ok", "ok");
    mockModelPicks();

    const examples = await getTrendingExamples();

    expect(examples).toEqual([
      { claim: "טענה שX קרה", sourceUrl: "https://fakereporter.net/exposures/claim-a/", sourceName: "FakeReporter" },
      {
        claim: "טענה שניסיון קיים להטות את הבחירות באמצעות סרטוני בינה מלאכותית",
        sourceUrl: "https://fakereporter.net/exposures/title-only/",
        sourceName: "FakeReporter",
      },
      {
        claim: "טענה שחברת פלטינום מתחזה לכללית פלטינום",
        sourceUrl: "https://www.irrelevant.org.il/2026/09/06/6676",
        sourceName: "לא רלוונטי",
      },
      {
        claim: "טענה על השמועה השנייה",
        sourceUrl: "https://www.irrelevant.org.il/2026/09/07/6677",
        sourceName: "לא רלוונטי",
      },
    ]);
  });

  it("still returns the other source's claims when one source's fetch fails (one bad source never takes the rest down)", async () => {
    mockSources("fail", "ok");
    mockModelPicks();

    const examples = await getTrendingExamples();

    expect(examples.every((e) => e.sourceName === "לא רלוונטי")).toBe(true);
    expect(examples).toHaveLength(2);
  });

  it("returns an empty array (never throws, never fabricates) when every source's fetch fails", async () => {
    mockSources("fail", "fail");
    const examples = await getTrendingExamples();
    expect(examples).toEqual([]);
  });

  it("skips a source with no recognizable articles without calling the model for it", async () => {
    mockSources("ok", "empty");
    mockModelPicks();

    const examples = await getTrendingExamples();

    expect(examples.every((e) => e.sourceName === "FakeReporter")).toBe(true);
    const irrelevantCalls = callStructuredMock.mock.calls.filter((c) => c[0].prompt.includes("שיחת עוקץ"));
    expect(irrelevantCalls).toHaveLength(0);
  });

  it("returns an empty array when the model finds nothing claim-shaped in either source, rather than forcing a pick", async () => {
    mockSources("ok", "ok");
    callStructuredMock.mockResolvedValue({ picks: [] });

    const examples = await getTrendingExamples();
    expect(examples).toEqual([]);
  });
});
