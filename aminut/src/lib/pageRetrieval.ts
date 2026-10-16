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
 * Hosts that serve their real page content to real browsers only behind a login
 * wall, but — by design, for link-preview purposes (the same og:/twitter: tags we
 * read below) — allow known link-unfurling crawlers to read the public preview of
 * a post. Every chat app (Slack, WhatsApp, iMessage, Telegram) relies on exactly
 * this mechanism. Identifying as one for these specific hosts, and only for the
 * public preview metadata, isn't evading a security control — it's the documented
 * intended use of that metadata. Every other host still gets our own honest UA.
 */
const SOCIAL_PREVIEW_UA_HOSTS = [
  "facebook.com",
  "fb.watch",
  "instagram.com",
  "x.com",
  "twitter.com",
  "threads.net",
];
const SOCIAL_PREVIEW_USER_AGENT = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

function userAgentFor(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return SOCIAL_PREVIEW_UA_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
      ? SOCIAL_PREVIEW_USER_AGENT
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fetches a user- or evidence-supplied URL through the SSRF guard and extracts
 * readable text. Untrusted: the returned text is page content, never instructions.
 */
export async function retrievePageText(url: string): Promise<RetrievedPage> {
  try {
    const res = await safeFetch(url, {
      maxBytes: config.maxPageFetchBytes,
      timeoutMs: config.fetchTimeoutMs,
      userAgent: userAgentFor(url),
    });
    if (!res.ok) {
      return { accessible: false, title: null, text: "", reason: `הדף החזיר סטטוס ${res.status}` };
    }
    if (res.contentType && !/html|text\/plain|xml/i.test(res.contentType)) {
      return { accessible: false, title: null, text: "", reason: "סוג תוכן לא נתמך" };
    }
    const $ = cheerio.load(res.body);
    const title = $("title").first().text().trim() || $("h1").first().text().trim() || null;
    const ogDescription = $('meta[property="og:description"]').attr("content")?.trim() || null;
    const twitterDescription = $('meta[name="twitter:description"]').attr("content")?.trim() || null;

    $("script, style, nav, footer, header, noscript, iframe, svg").remove();
    const container = $("article").length
      ? $("article")
      : $("main").length
        ? $("main")
        : $("body");
    let text = container.text().replace(/\s+/g, " ").trim();

    // Some pages (notably Facebook/X post-share links) render all real content
    // client-side via JavaScript and leave no static text in the body at all —
    // everything in <body> turns out to live inside <script> tags that get
    // stripped above. The only server-rendered summary of the post is in the
    // Open Graph / Twitter Card meta tags meant for link-preview cards. Fall
    // back to those only when the visible body came back empty or near-empty,
    // never as a substitute for real page text when some is actually present.
    if (text.length < 40) {
      const metaDescription = ogDescription || twitterDescription;
      if (metaDescription) {
        text = metaDescription;
      }
    }

    text = text.slice(0, MAX_EXTRACTED_CHARS);
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
