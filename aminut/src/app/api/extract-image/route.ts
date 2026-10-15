import { NextRequest } from "next/server";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { config, hasLlmCredentials } from "@/lib/config";
import { extractTextFromImage } from "@/lib/imageExtraction";
import { ExtractImageRequestSchema } from "@/lib/types";

export async function POST(request: NextRequest) {
  const clientKey = clientKeyFromRequest(request);
  const rate = checkRateLimit(`image:${clientKey}`, config.imageRateLimitPerIpPerHour);
  if (!rate.allowed) {
    return Response.json(
      { error: "חרגת ממכסת העלאות התמונה השעתית. נסה שוב מאוחר יותר." },
      { status: 429 }
    );
  }

  if (!hasLlmCredentials()) {
    return Response.json({ error: "חסר מפתח API הכרחי (ANTHROPIC_API_KEY)" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "גוף הבקשה אינו JSON תקין" }, { status: 400 });
  }

  const parsed = ExtractImageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "קלט לא תקין" }, { status: 400 });
  }

  // Precise byte-size check (base64 inflates ~4/3x over raw bytes) — the request
  // body itself is never written to disk; this image is processed in memory only
  // and discarded once the Anthropic call returns.
  const approxBytes = Math.floor((parsed.data.imageBase64.length * 3) / 4);
  if (approxBytes > config.maxImageBytes) {
    return Response.json(
      { error: `התמונה גדולה מדי (מגבלה: ${Math.floor(config.maxImageBytes / 1_000_000)}MB)` },
      { status: 413 }
    );
  }

  try {
    const result = await extractTextFromImage(parsed.data.imageBase64, parsed.data.mediaType);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "שגיאה לא צפויה בעיבוד התמונה";
    return Response.json({ error: message }, { status: 502 });
  }
}
