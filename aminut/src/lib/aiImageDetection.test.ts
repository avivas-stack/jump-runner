import { describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));
vi.mock("./anthropic", () => ({ callStructured: callStructuredMock }));

const { scanForProvenanceMarkers, getVisualAiOpinion } = await import("./aiImageDetection");

function base64Of(text: string): string {
  return Buffer.from(text, "latin1").toString("base64");
}

describe("scanForProvenanceMarkers", () => {
  it("finds no markers in a file with no AI-provenance metadata", () => {
    const fakeJpegBytes = base64Of("\xFF\xD8\xFF\xE0JFIF just some ordinary bytes, no markers here");
    expect(scanForProvenanceMarkers(fakeJpegBytes)).toEqual([]);
  });

  it("detects a C2PA Content Credentials marker embedded in the file bytes", () => {
    const withC2pa = base64Of("...urn:c2pa:manifest...rest of file...");
    expect(scanForProvenanceMarkers(withC2pa)).toContain("C2PA (Content Credentials)");
  });

  it("detects a SynthID marker without claiming to have decoded the watermark itself", () => {
    const withSynthId = base64Of("...SynthID watermark metadata...");
    const markers = scanForProvenanceMarkers(withSynthId);
    expect(markers).toContain("SynthID");
  });

  it("deduplicates repeated matches of the same marker", () => {
    const repeated = base64Of("Imagen Imagen Imagen generated this");
    const markers = scanForProvenanceMarkers(repeated);
    expect(markers.filter((m) => m === "Google Imagen")).toHaveLength(1);
  });
});

describe("getVisualAiOpinion", () => {
  it("sends the image as a content block and returns the model's cautious opinion when every sample agrees", async () => {
    callStructuredMock.mockResolvedValue({
      likelyAiGenerated: "unsure",
      rationale: "אין סימן ברור, אי אפשר לקבוע.",
      visualSigns: [],
    });

    const result = await getVisualAiOpinion("base64data", "image/png");

    const call = callStructuredMock.mock.calls[0][0];
    expect(Array.isArray(call.prompt)).toBe(true);
    expect(call.prompt[0]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "base64data" },
    });
    expect(result.likelyAiGenerated).toBe("unsure");
  });

  it("instructs the model to reason about concrete visual tells, not just a gut impression", async () => {
    callStructuredMock.mockResolvedValue({
      likelyAiGenerated: "yes",
      rationale: "נראו ידיים מעוותות ותאורה לא עקבית.",
      visualSigns: ["ידיים עם מספר אצבעות שגוי", "תאורה לא עקבית בין חלקי התמונה"],
    });

    const result = await getVisualAiOpinion("base64data", "image/jpeg");

    const call = callStructuredMock.mock.calls[0][0];
    expect(call.system).toMatch(/ידיים|אצבעות/);
    expect(result.visualSigns).toHaveLength(2);
  });

  it("instructs the model to reason about real-world plausibility of recognizable public figures, not just pixel artifacts", async () => {
    callStructuredMock.mockResolvedValue({
      likelyAiGenerated: "yes",
      rationale: "המצב המתואר אינו סביר בהתחשב על העובדות הידועות על הדמויות.",
      visualSigns: ["שתי דמויות ציבוריות מוצגות במפגש שאינו סביר בהתחשב על מעמדן"],
    });

    await getVisualAiOpinion("base64data", "image/jpeg");

    const call = callStructuredMock.mock.calls[0][0];
    expect(call.system).toMatch(/דמות ציבורית|דמויות ציבוריות/);
  });

  it("uses the stronger evaluation-tier model, not the cheap text-extraction model, since this task needs real visual scrutiny and world knowledge", async () => {
    callStructuredMock.mockResolvedValue({ likelyAiGenerated: "unsure", rationale: "x", visualSigns: [] });

    await getVisualAiOpinion("base64data", "image/jpeg");

    const call = callStructuredMock.mock.calls[0][0];
    expect(call.model).toBe("claude-sonnet-5-5");
  });

  it("samples the model 3 times and goes with the majority verdict, since the API has no determinism knob and a single borderline sample can go either way", async () => {
    callStructuredMock
      .mockResolvedValueOnce({ likelyAiGenerated: "unsure", rationale: "x", visualSigns: [] })
      .mockResolvedValueOnce({ likelyAiGenerated: "yes", rationale: "y", visualSigns: ["a", "b"] })
      .mockResolvedValueOnce({ likelyAiGenerated: "yes", rationale: "z", visualSigns: ["a"] });

    const result = await getVisualAiOpinion("base64data", "image/jpeg");

    expect(callStructuredMock).toHaveBeenCalledTimes(3);
    expect(result.likelyAiGenerated).toBe("yes");
    // Prefers the richer of the two agreeing "yes" samples for the user-facing explanation.
    expect(result.visualSigns).toEqual(["a", "b"]);
  });

  it("reports unsure, with an explicit note, when the 3 samples land in a real three-way split", async () => {
    callStructuredMock
      .mockResolvedValueOnce({ likelyAiGenerated: "yes", rationale: "x", visualSigns: [] })
      .mockResolvedValueOnce({ likelyAiGenerated: "no", rationale: "y", visualSigns: [] })
      .mockResolvedValueOnce({ likelyAiGenerated: "unsure", rationale: "z", visualSigns: [] });

    const result = await getVisualAiOpinion("base64data", "image/jpeg");

    expect(result.likelyAiGenerated).toBe("unsure");
    expect(result.rationale).toMatch(/לא הייתה עקבית/);
  });

  it("still returns an opinion from the samples that succeeded when one sample errors (e.g. a rate limit from 3x the call volume), instead of discarding the whole result", async () => {
    callStructuredMock
      .mockResolvedValueOnce({ likelyAiGenerated: "yes", rationale: "x", visualSigns: ["a"] })
      .mockRejectedValueOnce(new Error("429 rate limited"))
      .mockResolvedValueOnce({ likelyAiGenerated: "yes", rationale: "y", visualSigns: ["a", "b"] });

    const result = await getVisualAiOpinion("base64data", "image/jpeg");

    expect(result.likelyAiGenerated).toBe("yes");
  });

  it("falls back to the single sample that succeeded when two of three error out, rather than losing the opinion entirely", async () => {
    callStructuredMock
      .mockRejectedValueOnce(new Error("429 rate limited"))
      .mockRejectedValueOnce(new Error("model declined to use the tool"))
      .mockResolvedValueOnce({ likelyAiGenerated: "yes", rationale: "x", visualSigns: ["a"] });

    const result = await getVisualAiOpinion("base64data", "image/jpeg");

    expect(result.likelyAiGenerated).toBe("yes");
  });

  it("only propagates an error when every sample fails", async () => {
    callStructuredMock
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockRejectedValueOnce(new Error("fail 3"));

    await expect(getVisualAiOpinion("base64data", "image/jpeg")).rejects.toThrow(/fail/);
  });
});
