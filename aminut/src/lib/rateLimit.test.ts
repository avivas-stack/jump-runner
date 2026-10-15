import { describe, expect, it } from "vitest";
import { checkRateLimit, clientKeyFromRequest } from "./rateLimit";

describe("checkRateLimit", () => {
  it("allows requests up to the configured budget and then blocks", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3).allowed).toBe(true);
    }
    expect(checkRateLimit(key, 3).allowed).toBe(false);
  });

  it("tracks separate keys independently", () => {
    const keyA = `a-${Math.random()}`;
    const keyB = `b-${Math.random()}`;
    expect(checkRateLimit(keyA, 1).allowed).toBe(true);
    expect(checkRateLimit(keyA, 1).allowed).toBe(false);
    expect(checkRateLimit(keyB, 1).allowed).toBe(true);
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
