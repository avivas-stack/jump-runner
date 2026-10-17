import { describe, expect, it } from "vitest";
import { toVisualOrder, wrapVisualLines } from "./bidiVisualText";

describe("toVisualOrder", () => {
  it("reverses a pure-Hebrew word into correct left-to-right visual order for a renderer with no bidi support", () => {
    // "אמינות" stored logically as א-מ-י-נ-ו-ת; a non-bidi renderer prints codepoints
    // left-to-right as given, so it needs the reversed sequence to display correctly.
    expect(toVisualOrder("אמינות")).toBe("תונימא");
  });

  it("keeps an embedded Latin/number run in its own correct order within reordered Hebrew text", () => {
    const result = toVisualOrder("שנת 2026 הייתה");
    // The Hebrew words flip, but "2026" (a left-to-right run) must not itself reverse into "6202".
    expect(result).toContain("2026");
  });

  it("returns an empty string unchanged", () => {
    expect(toVisualOrder("")).toBe("");
  });
});

describe("wrapVisualLines", () => {
  it("keeps whole sentences on one line when they fit", () => {
    const lines = wrapVisualLines("אמינות בודקת טענות", 100);
    expect(lines).toHaveLength(1);
  });

  it("wraps long text into multiple lines in correct logical (reading) order, not reversed", () => {
    const lines = wrapVisualLines("שר האוצר בישראל הודיע אתמול כי שיעור המעמ יועלה לעשרים אחוז החל מינואר הקרוב", 30);
    expect(lines.length).toBeGreaterThan(1);
    // The first logical word of the sentence ("שר") must appear in the FIRST line, not the last —
    // this is exactly the bug where reordering the whole string before wrapping flips line order.
    const firstLineLogical = [...lines[0]].reverse().join("");
    expect(firstLineLogical.startsWith("שר")).toBe(true);
  });
});
