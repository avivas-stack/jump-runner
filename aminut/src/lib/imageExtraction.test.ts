import { describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));
vi.mock("./anthropic", () => ({ callStructured: callStructuredMock }));

const { extractTextFromImage } = await import("./imageExtraction");

describe("extractTextFromImage", () => {
  it("sends the image as a content block alongside an instruction, not as a prompt string", async () => {
    callStructuredMock.mockResolvedValueOnce({
      extractedText: "שר האוצר הודיע על העלאת מע\"מ",
      confidence: "high",
      uncertainNotes: [],
    });

    await extractTextFromImage("base64data", "image/png");

    const call = callStructuredMock.mock.calls[0][0];
    expect(Array.isArray(call.prompt)).toBe(true);
    expect(call.prompt[0]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "base64data" },
    });
  });

  it("preserves low-confidence uncertainty for a partially unreadable screenshot instead of guessing", async () => {
    callStructuredMock.mockResolvedValueOnce({
      extractedText: "שר האוצר הודיע [לא קריא] על המע\"מ ל-[לא קריא]%",
      confidence: "low",
      uncertainNotes: ["החלק המרכזי של האחוז מטושטש", "שם השר אינו מופיע בבירור"],
    });

    const result = await extractTextFromImage("base64data", "image/jpeg");
    expect(result.confidence).toBe("low");
    expect(result.uncertainNotes.length).toBeGreaterThan(0);
    expect(result.extractedText).toContain("[לא קריא]");
  });
});
