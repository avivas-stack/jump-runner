import { describe, expect, it } from "vitest";
import { VerifyRequestSchema, EvidenceItemSchema, ClaimEvaluationSchema } from "./types";

describe("VerifyRequestSchema", () => {
  it("accepts text-only input", () => {
    expect(VerifyRequestSchema.safeParse({ text: "טענה לבדיקה" }).success).toBe(true);
  });

  it("accepts url-only input", () => {
    expect(VerifyRequestSchema.safeParse({ url: "https://example.com" }).success).toBe(true);
  });

  it("rejects a request with neither text nor url (any single input method must suffice, but at least one is required)", () => {
    expect(VerifyRequestSchema.safeParse({}).success).toBe(false);
    expect(VerifyRequestSchema.safeParse({ text: "", url: "" }).success).toBe(false);
  });

  it("rejects text longer than the configured limit", () => {
    expect(VerifyRequestSchema.safeParse({ text: "א".repeat(8001) }).success).toBe(false);
  });
});

describe("EvidenceItemSchema", () => {
  it("rejects an invalid sourceType (guards against a malformed LLM/tool response)", () => {
    const invalid = {
      id: "e1",
      claimId: "c1",
      url: "https://example.com",
      title: "t",
      retrievedAt: new Date().toISOString(),
      sourceType: "not-a-real-type",
      excerpt: "x",
      accessible: true,
    };
    expect(EvidenceItemSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("ClaimEvaluationSchema", () => {
  it("rejects a classification outside the fixed enum (no silent true/false binary)", () => {
    const invalid = {
      claimId: "c1",
      classification: "true",
      confidence: "high",
      rationale: "x",
    };
    expect(ClaimEvaluationSchema.safeParse(invalid).success).toBe(false);
  });

  it('accepts the ככה"נ שקרי classification (distinct from both שקרי and לא ניתן לאימות)', () => {
    const entry = {
      claimId: "c1",
      classification: 'ככה"נ שקרי',
      confidence: "medium",
      rationale: "x",
    };
    expect(ClaimEvaluationSchema.safeParse(entry).success).toBe(true);
  });
});
