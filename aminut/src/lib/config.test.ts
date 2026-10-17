import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("paidEndpointsDisabledResponse", () => {
  it("returns null (endpoints enabled) when DISABLE_PAID_ENDPOINTS isn't set", async () => {
    delete process.env.DISABLE_PAID_ENDPOINTS;
    vi.resetModules();
    const { paidEndpointsDisabledResponse } = await import("./config");
    expect(paidEndpointsDisabledResponse()).toBeNull();
  });

  it("returns a 503 response when DISABLE_PAID_ENDPOINTS=true — the manual emergency brake", async () => {
    process.env.DISABLE_PAID_ENDPOINTS = "true";
    vi.resetModules();
    const { paidEndpointsDisabledResponse } = await import("./config");
    const response = paidEndpointsDisabledResponse();
    expect(response).not.toBeNull();
    expect(response?.status).toBe(503);
  });
});
