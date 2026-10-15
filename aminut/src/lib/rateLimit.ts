/**
 * In-memory, per-IP sliding-window rate limiter.
 *
 * Known limitation: this state lives in a single server process's memory.
 * On a multi-instance or serverless deployment (e.g. Vercel's default), each
 * instance tracks its own counters, so the effective global limit is higher
 * than configured. For real production use behind multiple instances, move
 * this to a shared store (e.g. Redis/Upstash) keyed the same way.
 */
const windowMs = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

export function checkRateLimit(key: string, maxPerWindow: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const existing = hits.get(key) ?? [];
  const recent = existing.filter((t) => now - t < windowMs);
  if (recent.length >= maxPerWindow) {
    hits.set(key, recent);
    return { allowed: false, remaining: 0 };
  }
  recent.push(now);
  hits.set(key, recent);
  return { allowed: true, remaining: maxPerWindow - recent.length };
}

/**
 * Derives a per-client rate-limit key from X-Forwarded-For.
 *
 * Security note: this assumes the app runs behind exactly one trusted reverse proxy
 * (e.g. Vercel's edge network, or an nginx/Cloudflare setup you control) that appends
 * the real connecting IP as the LAST entry in the header. We therefore take the last
 * entry, never the first — the first entry is whatever the client itself sent, so
 * trusting it (a common mistake) lets anyone bypass the rate limit by sending their
 * own X-Forwarded-For. If this server is ever exposed directly to the internet with
 * no trusted proxy in front, no X-Forwarded-For value can be trusted at all, and
 * IP-based limiting here should not be relied on as a security boundary.
 */
export function clientKeyFromRequest(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor.split(",").map((p) => p.trim());
    return parts[parts.length - 1];
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
