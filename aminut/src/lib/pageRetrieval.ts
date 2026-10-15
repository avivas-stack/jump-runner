import * as cheerio from "cheerio";
import { safeFetch, SsrfBlockedError } from "./ssrfGuard";
import { config } from "./config";

export interface RetrievedPage {
  accessible: boolean;
  title: string | null;
  text: string;
  reason: string | null;
}

const MAX_EXTRACTED_CHARS = 6000;

/**
 * Fetches a user- or evidence-supplied URL through the SSRF guard and extracts
 * readable text. Untrusted: the returned text is page content, never instructions.
 */
export async function retrievePageText(url: string): Promise<RetrievedPage> {
  try {
    const res = await safeFetch(url, {
      maxBytes: config.maxPageFetchBytes,
      timeoutMs: config.fetchTimeoutMs,
    });
    if (!res.ok) {
      return { accessible: false, title: null, text: "", reason: `הדף החזיר סטטוס ${res.status}` };
    }
    if (res.contentType && !/html|text\/plain|xml/i.test(res.contentType)) {
      return { accessible: false, title: null, text: "", reason: "סוג תוכן לא נתמך" };
    }
    const $ = cheerio.load(res.body);
    $("script, style, nav, footer, header, noscript, iframe, svg").remove();
    const title = $("title").first().text().trim() || $("h1").first().text().trim() || null;
    const container = $("article").length
      ? $("article")
      : $("main").length
        ? $("main")
        : $("body");
    const text = container
      .text()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_EXTRACTED_CHARS);
    return {
      accessible: true,
      title,
      text,
      reason: res.truncated ? "התוכן נחתך עקב מגבלת גודל" : null,
    };
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      return { accessible: false, title: null, text: "", reason: err.message };
    }
    const message = err instanceof Error ? err.message : "שגיאה לא ידועה בעת גישה לדף";
    return { accessible: false, title: null, text: "", reason: message };
  }
}
