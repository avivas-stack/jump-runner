import dns from "node:dns";
import net from "node:net";
import http from "node:http";
import https from "node:https";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_REDIRECTS = 3;

/**
 * True if an IPv4 address (dotted-quad) falls in a private, loopback,
 * link-local, CGNAT, or other non-public range.
 */
function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0.0/24 IETF protocol assignments
  if (a === 192 && b === 0 && parts[2] === 2) return true; // 192.0.2.0/24 TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a === 198 && b === 51 && parts[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && parts[2] === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

/** True if an IPv6 address falls in loopback, unique-local, link-local, or an embedded-IPv4 blocked range. */
function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true; // loopback
  if (normalized === "::") return true; // unspecified
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true; // fe80::/10 link-local
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // fc00::/7 unique local
  // IPv4-mapped / IPv4-compatible addresses: check the embedded IPv4
  const mappedMatch = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedMatch) return isBlockedIPv4(mappedMatch[1]);
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return isBlockedIPv4(ip);
  if (kind === 6) return isBlockedIPv6(ip);
  return true; // not a recognizable literal IP -> treat as unsafe
}

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

function assertSafeUrlShape(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError("כתובת לא תקינה");
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new SsrfBlockedError("פרוטוקול לא נתמך — רק http/https מותרים");
  }
  if (parsed.username || parsed.password) {
    throw new SsrfBlockedError("כתובת עם פרטי התחברות אינה נתמכת");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "metadata.google.internal") {
    throw new SsrfBlockedError("לא ניתן לגשת לכתובות פנימיות");
  }
  return parsed;
}

/** Resolves a hostname (or validates a literal IP) and returns safe-to-connect IPs, or throws. */
async function resolveSafeAddresses(hostname: string): Promise<string[]> {
  const literalKind = net.isIP(hostname);
  if (literalKind !== 0) {
    if (isBlockedIp(hostname)) throw new SsrfBlockedError("לא ניתן לגשת לכתובת IP פנימית");
    return [hostname];
  }
  const records = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) throw new SsrfBlockedError("לא ניתן לפענח את שם המתחם");
  const blocked = records.filter((r) => isBlockedIp(r.address));
  if (blocked.length > 0) {
    throw new SsrfBlockedError("שם המתחם מצביע על כתובת רשת פנימית");
  }
  return records.map((r) => r.address);
}

export interface SafeFetchResult {
  ok: boolean;
  status: number;
  finalUrl: string;
  body: string;
  contentType: string | null;
  truncated: boolean;
}

/**
 * Fetches a URL while defending against SSRF: only http/https, blocks private/loopback/
 * link-local/reserved IP ranges (checked on the DNS-resolved address actually connected to,
 * not just the hostname, to close the TOCTOU/DNS-rebinding gap), re-validates every redirect
 * hop, and enforces a byte-size cap and timeout.
 */
export async function safeFetch(
  rawUrl: string,
  opts: { maxBytes: number; timeoutMs: number; userAgent?: string }
): Promise<SafeFetchResult> {
  let currentUrl = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = assertSafeUrlShape(currentUrl);
    const addresses = await resolveSafeAddresses(parsed.hostname);
    const connectIp = addresses[0];
    const result = await requestOnce(parsed, connectIp, opts);
    if (result.status >= 300 && result.status < 400 && result.location) {
      currentUrl = new URL(result.location, parsed).toString();
      continue;
    }
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      finalUrl: currentUrl,
      body: result.body,
      contentType: result.contentType,
      truncated: result.truncated,
    };
  }
  throw new SsrfBlockedError("יותר מדי הפניות (redirects)");
}

function requestOnce(
  parsed: URL,
  connectIp: string,
  opts: { maxBytes: number; timeoutMs: number; userAgent?: string }
): Promise<{ status: number; location?: string; body: string; contentType: string | null; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const transport = parsed.protocol === "https:" ? https : http;
    const req = transport.request(
      {
        host: connectIp,
        servername: parsed.protocol === "https:" ? parsed.hostname : undefined,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: {
          Host: parsed.hostname,
          "User-Agent": opts.userAgent ?? "aminut-fact-checker/0.1 (+claim verification bot)",
          Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        },
        timeout: opts.timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > opts.maxBytes) {
            truncated = true;
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            location: res.headers.location,
            body: Buffer.concat(chunks).toString("utf-8"),
            contentType: res.headers["content-type"] ?? null,
            truncated,
          });
        });
        res.on("error", (err) => {
          if (truncated) {
            resolve({
              status: res.statusCode ?? 0,
              location: res.headers.location,
              body: Buffer.concat(chunks).toString("utf-8"),
              contentType: res.headers["content-type"] ?? null,
              truncated: true,
            });
          } else {
            reject(err);
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("בקשת הרשת נכשלה עקב פסק זמן (timeout)")));
    req.on("error", (err) => reject(err));
    req.end();
  });
}
