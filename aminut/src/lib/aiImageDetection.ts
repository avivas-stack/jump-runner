import { callStructured } from "./anthropic";
import { config } from "./config";
import { VisualAiOpinion, VisualAiOpinionSchema } from "./types";

/**
 * Known, documented markers that generative-AI tools (including Google's SynthID
 * ecosystem) embed in a file's own metadata — C2PA "Content Credentials" manifests,
 * the IPTC DigitalSourceType field, and common generator/app names. This is a
 * substring scan over the raw file bytes, not a parsed/verified C2PA manifest or a
 * SynthID decode (Google does not publish a public API for the latter) — so a hit
 * here is a real, checkable fact about the file, while a miss proves nothing: any of
 * these markers can be stripped by re-saving, cropping, or screenshotting an image.
 */
const KNOWN_MARKERS: { pattern: RegExp; label: string }[] = [
  { pattern: /c2pa/i, label: "C2PA (Content Credentials)" },
  { pattern: /contentcredentials\.org/i, label: "Content Credentials" },
  { pattern: /SynthID/i, label: "SynthID" },
  { pattern: /trainedAlgorithmicMedia/i, label: "IPTC DigitalSourceType: תוכן שנוצר באלגוריתם" },
  { pattern: /compositeWithTrainedAlgorithmicMedia/i, label: "IPTC DigitalSourceType: הרכבה הכוללת AI" },
  { pattern: /Google\s*AI/i, label: "Google AI" },
  { pattern: /\bImagen\b/i, label: "Google Imagen" },
  { pattern: /\bGemini\b/i, label: "Google Gemini" },
  { pattern: /DALL[\s-]?E/i, label: "OpenAI DALL·E" },
  { pattern: /Midjourney/i, label: "Midjourney" },
  { pattern: /Adobe Firefly/i, label: "Adobe Firefly" },
  { pattern: /Stable Diffusion/i, label: "Stable Diffusion" },
];

export function scanForProvenanceMarkers(base64Data: string): string[] {
  const buffer = Buffer.from(base64Data, "base64");
  const text = buffer.toString("latin1");
  const found = new Set<string>();
  for (const { pattern, label } of KNOWN_MARKERS) {
    if (pattern.test(text)) found.add(label);
  }
  return Array.from(found);
}

const SYSTEM_PROMPT = `אתה נותן חוות דעת סגנונית זהירה האם תמונה נראית כאילו נוצרה או עובדה על ידי כלי AI.

כללים קריטיים:
- אינך כלי פורנזי ואינך יכול לפענח סימני מים בלתי נראים כמו SynthID — אלה דורשים מפענח ייעודי של גוגל שאינו זמין כאן. חוות דעתך מבוססת על מראה חזותי בלבד.
- אל תטען ודאות. אם אין סימן ברור (מרקמים לא טבעיים, פרטים לא עקביים, טשטוש אופייני ל-AI וכו'), החזר "unsure".
- rationale קצר (1-3 משפטים), בעברית, ניטרלי, ללא שפה סנסציונית.`;

/**
 * Non-authoritative, best-effort visual impression from a vision-capable model —
 * deliberately separate from the metadata scan above and framed as an opinion, not
 * a verdict, so the two never get conflated into a false sense of certainty.
 */
export async function getVisualAiOpinion(
  base64Data: string,
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"
): Promise<VisualAiOpinion> {
  return callStructured({
    model: config.extractionModel,
    system: SYSTEM_PROMPT,
    toolName: "visual_ai_opinion",
    maxTokens: 500,
    schema: VisualAiOpinionSchema,
    prompt: [
      { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
      { type: "text", text: "האם התמונה הזו נראית כמו תמונה שנוצרה או עובדה על ידי AI?" },
    ],
  });
}
