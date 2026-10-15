import { describe, expect, it } from "vitest";
import { isBlockedIp } from "./ssrfGuard";

describe("isBlockedIp", () => {
  it("blocks IPv4 loopback", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("127.0.0.53")).toBe(true);
  });

  it("blocks IPv4 private ranges", () => {
    expect(isBlockedIp("10.0.0.1")).toBe(true);
    expect(isBlockedIp("172.16.0.1")).toBe(true);
    expect(isBlockedIp("172.31.255.255")).toBe(true);
    expect(isBlockedIp("192.168.1.1")).toBe(true);
  });

  it("blocks link-local and cloud metadata address", () => {
    expect(isBlockedIp("169.254.169.254")).toBe(true); // AWS/GCP/Azure metadata endpoint
  });

  it("blocks CGNAT and reserved ranges", () => {
    expect(isBlockedIp("100.64.0.1")).toBe(true);
    expect(isBlockedIp("0.0.0.0")).toBe(true);
    expect(isBlockedIp("240.0.0.1")).toBe(true);
  });

  it("blocks IPv6 loopback and unique-local/link-local", () => {
    expect(isBlockedIp("::1")).toBe(true);
    expect(isBlockedIp("fe80::1")).toBe(true);
    expect(isBlockedIp("fd00::1")).toBe(true);
    expect(isBlockedIp("fc00::1")).toBe(true);
  });

  it("blocks IPv4-mapped IPv6 addresses pointing at private ranges", () => {
    expect(isBlockedIp("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedIp("::ffff:10.0.0.5")).toBe(true);
  });

  it("allows ordinary public IPv4/IPv6 addresses", () => {
    expect(isBlockedIp("8.8.8.8")).toBe(false);
    expect(isBlockedIp("1.1.1.1")).toBe(false);
    expect(isBlockedIp("2606:4700:4700::1111")).toBe(false); // public IPv6 (Cloudflare)
  });

  it("treats non-IP strings as unsafe (defensive default)", () => {
    expect(isBlockedIp("not-an-ip")).toBe(true);
  });
});
