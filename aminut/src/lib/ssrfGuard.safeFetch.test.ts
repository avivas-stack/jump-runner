import { describe, expect, it } from "vitest";
import { safeFetch, SsrfBlockedError } from "./ssrfGuard";

/**
 * Integration-level tests for the full safeFetch guard (URL shape + DNS/literal-IP
 * resolution), as opposed to ssrfGuard.test.ts which only covers the pure isBlockedIp
 * range-check helper. These never reach the network for the blocked cases — the
 * request is rejected during validation, before any socket is opened.
 */
describe("safeFetch SSRF protection", () => {
  const opts = { maxBytes: 1_000_000, timeoutMs: 2000 };

  it("blocks a literal loopback IP", async () => {
    await expect(safeFetch("http://127.0.0.1:1/admin", opts)).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("blocks the literal 'localhost' hostname", async () => {
    await expect(safeFetch("http://localhost/admin", opts)).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("blocks a private-range literal IP (10.x)", async () => {
    await expect(safeFetch("http://10.0.0.5/", opts)).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("blocks the cloud metadata endpoint address", async () => {
    await expect(safeFetch("http://169.254.169.254/latest/meta-data/", opts)).rejects.toBeInstanceOf(
      SsrfBlockedError
    );
  });

  it("blocks IPv6 loopback", async () => {
    await expect(safeFetch("http://[::1]/", opts)).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("rejects non-http(s) protocols", async () => {
    await expect(safeFetch("file:///etc/passwd", opts)).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(safeFetch("ftp://example.com/", opts)).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("rejects a URL carrying embedded credentials", async () => {
    await expect(safeFetch("http://admin:password@127.0.0.1/", opts)).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("rejects a malformed URL", async () => {
    await expect(safeFetch("not a url at all", opts)).rejects.toBeInstanceOf(SsrfBlockedError);
  });
});
