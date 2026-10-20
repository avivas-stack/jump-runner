import { NextRequest } from "next/server";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { config, hasLlmCredentials, paidEndpointsDisabledResponse } from "@/lib/config";
import { extractTextFromImage } from "@/lib/imageExtraction";
import { ExtractImageRequestSchema } from "@/lib/types";

// A dense screenshot can legitimately need close to the full 4096-token response (see
// imageExtraction.ts) — vision analysis plus that much generation can run past Vercel's
// short default function timeout, surfacing as this route's generic "processing error"
// for exactly the kind of image most worth checking. Matches detect-ai-image's own
// maxDuration for the same reason.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const maintenance = paidEndpointsDisabledResponse();
  if (maintenance) return maintenance;

  const clientKey = clientKeyFromRequest(request);
  const rate = await checkRateLimit(`image:${clientKey}`, config.imageRateLimitPerIpPerHour);
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
    // Log the real (vendor) error server-side only — forwarding it verbatim to an
    // anonymous client is unnecessary implementation disclosure.
    console.error("extractTextFromImage failed:", err);
    return Response.json({ error: "שגיאה לא צפויה בעיבוד התמונה. נסו שוב." }, { status: 502 });
  }
}
