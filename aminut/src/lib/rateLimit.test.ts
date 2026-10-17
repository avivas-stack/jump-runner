import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, clientKeyFromRequest } from "./rateLimit";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.doUnmock("@upstash/redis");
  vi.resetModules();
});

describe("checkRateLimit (in-memory fallback, no durable store configured)", () => {
  it("allows requests up to the configured budget and then blocks", async () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect((await checkRateLimit(key, 3)).allowed).toBe(true);
    }
    expect((await checkRateLimit(key, 3)).allowed).toBe(false);
  });

  it("tracks separate keys independently", async () => {
    const keyA = `a-${Math.random()}`;
    const keyB = `b-${Math.random()}`;
    expect((await checkRateLimit(keyA, 1)).allowed).toBe(true);
    expect((await checkRateLimit(keyA, 1)).allowed).toBe(false);
    expect((await checkRateLimit(keyB, 1)).allowed).toBe(true);
  });
});

describe("checkRateLimit (durable Upstash Redis store, when configured)", () => {
  it("uses Redis INCR/EXPIRE instead of the in-memory map when Upstash env vars are set", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    const incrMock = vi.fn().mockResolvedValue(1);
    const expireMock = vi.fn().mockResolvedValue(1);
    vi.doMock("@upstash/redis", () => ({
      Redis: vi.fn(function () {
        return { incr: incrMock, expire: expireMock };
      }),
    }));
    vi.resetModules();

    const { checkRateLimit: checkRateLimitWithRedis } = await import("./rateLimit");
    const result = await checkRateLimitWithRedis("some-key", 5);

    expect(incrMock).toHaveBeenCalledWith("ratelimit:some-key");
    expect(expireMock).toHaveBeenCalledWith("ratelimit:some-key", 3600);
    expect(result).toEqual({ allowed: true, remaining: 4 });
  });

  it("blocks once the Redis counter exceeds the budget", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    const incrMock = vi.fn().mockResolvedValue(6);
    const expireMock = vi.fn().mockResolvedValue(1);
    vi.doMock("@upstash/redis", () => ({
      Redis: vi.fn(function () {
        return { incr: incrMock, expire: expireMock };
      }),
    }));
    vi.resetModules();

    const { checkRateLimit: checkRateLimitWithRedis } = await import("./rateLimit");
    const result = await checkRateLimitWithRedis("some-key", 5);

    expect(result).toEqual({ allowed: false, remaining: 0 });
  });

  it("falls back to the in-memory limiter for that request if Redis itself errors, instead of failing the whole request", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    const incrMock = vi.fn().mockRejectedValue(new Error("upstash down"));
    vi.doMock("@upstash/redis", () => ({
      Redis: vi.fn(function () {
        return { incr: incrMock, expire: vi.fn() };
      }),
    }));
    vi.resetModules();

    const { checkRateLimit: checkRateLimitWithRedis } = await import("./rateLimit");
    const result = await checkRateLimitWithRedis(`fallback-${Math.random()}`, 5);

    expect(result.allowed).toBe(true);
  });
});

describe("clientKeyFromRequest", () => {
  it("trusts the LAST X-Forwarded-For entry (the hop appended by a trusted proxy), not the first (client-controlled)", () => {
    const request = new Request("https://example.com/api/verify", {
      headers: { "x-forwarded-for": "1.2.3.4-spoofed, 203.0.113.9" },
    });
    expect(clientKeyFromRequest(request)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip when no x-forwarded-for is present", () => {
    const request = new Request("https://example.com/api/verify", {
      headers: { "x-real-ip": "198.51.100.7" },
    });
    expect(clientKeyFromRequest(request)).toBe("198.51.100.7");
  });

  it("falls back to 'unknown' rather than throwing when no client IP header is present", () => {
    const request = new Request("https://example.com/api/verify");
    expect(clientKeyFromRequest(request)).toBe("unknown");
  });
});
