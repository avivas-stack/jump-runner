import { Redis } from "@upstash/redis";
import { config, hasDurableRateLimitStore } from "./config";

const windowMs = 60 * 60 * 1000;
const windowSeconds = windowMs / 1000;

/**
 * In-memory, per-IP sliding-window rate limiter — the fallback used whenever no durable
 * store is configured (see checkRateLimit below).
 *
 * Known limitation: this state lives in a single server process's memory. On a
 * multi-instance or serverless deployment (e.g. Vercel's default), each instance tracks
 * its own counters, so the effective global limit is higher than configured, and resets
 * on every cold start — it cannot actually bound total cost under real concurrent/viral
 * traffic. Connect Upstash Redis (see UPSTASH_REDIS_REST_URL in config.ts) to close that gap.
 */
const hits = new Map<string, number[]>();

function checkRateLimitInMemory(key: string, maxPerWindow: number): { allowed: boolean; remaining: number } {
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

let redisClient: Redis | null = null;
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis({ url: config.upstashRedisRestUrl!, token: config.upstashRedisRestToken! });
  }
  return redisClient;
}

/**
 * Fixed-window counter in Redis — shared across every serverless instance, so (unlike
 * the in-memory fallback) it actually bounds total request volume for a key regardless
 * of how many instances are running. Slightly less precise at window boundaries than a
 * true sliding window, which is an acceptable trade for the simplicity of INCR + EXPIRE.
 */
async function checkRateLimitRedis(key: string, maxPerWindow: number): Promise<{ allowed: boolean; remaining: number }> {
  const redisKey = `ratelimit:${key}`;
  const count = await getRedis().incr(redisKey);
  if (count === 1) {
    await getRedis().expire(redisKey, windowSeconds);
  }
  if (count > maxPerWindow) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: maxPerWindow - count };
}

export async function checkRateLimit(key: string, maxPerWindow: number): Promise<{ allowed: boolean; remaining: number }> {
  if (hasDurableRateLimitStore()) {
    try {
      return await checkRateLimitRedis(key, maxPerWindow);
    } catch (err) {
      // Never let a Redis outage take the rate limiter (and therefore every paid route)
      // down with it — fall back to the in-memory limiter for this one request.
      console.error("checkRateLimit: Redis call failed, falling back to in-memory:", err instanceof Error ? err.message : err);
      return checkRateLimitInMemory(key, maxPerWindow);
    }
  }
  return checkRateLimitInMemory(key, maxPerWindow);
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
