import bidiFactory from "bidi-js";

const bidi = bidiFactory();

/**
 * Converts logical-order text (as typed/stored) into visual left-to-right character
 * order. Satori (used by next/og's ImageResponse, for OG images/icons) doesn't
 * implement the Unicode Bidirectional Algorithm the way a real browser does — it just
 * prints codepoints in the given sequence — so Hebrew/Arabic text renders backwards
 * unless it's pre-reordered like this before being passed in as text content. Never
 * needed for normal HTML/CSS rendering (browsers already do this correctly).
 */
/**
 * Splits text into lines (by word, in normal logical order) each no longer than
 * maxCharsPerLine, then visually reorders each line independently. Needed because
 * Satori has no native bidi support: reordering one long logical string as a single
 * unit and letting Satori's own wrapping break the *already-reordered* string produces
 * correctly-ordered characters within each line, but the lines themselves come out in
 * reverse sequence (the end of the sentence appears on the first line). Pre-wrapping
 * ourselves and reordering line-by-line keeps both character order and line order correct.
 */
export function wrapVisualLines(text: string, maxCharsPerLine: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.map(toVisualOrder);
}

export function toVisualOrder(text: string): string {
  if (!text) return text;
  const embeddingLevels = bidi.getEmbeddingLevels(text);
  return bidi.getReorderedString(text, embeddingLevels);
}
