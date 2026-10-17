import { NextRequest } from "next/server";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { config, hasLlmCredentials, paidEndpointsDisabledResponse } from "@/lib/config";
import { getVisualAiOpinion, scanForProvenanceMarkers } from "@/lib/aiImageDetection";
import { DetectAiImageRequestSchema } from "@/lib/types";

// The visual-opinion call now fires 3 parallel vision requests to Claude (self-consistency
// sampling) instead of 1, so the route's own latency is higher than Vercel's 10s default
// function timeout leaves much room for — a single slow sample among the three can push the
// whole request past it. 60s matches what Hobby/Pro both allow without extra configuration.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const maintenance = paidEndpointsDisabledResponse();
  if (maintenance) return maintenance;

  const clientKey = clientKeyFromRequest(request);
  const rate = await checkRateLimit(`aiimg:${clientKey}`, config.imageRateLimitPerIpPerHour);
  if (!rate.allowed) {
    return Response.json(
      { error: "חרגת ממכסת הבדיקות השעתית. נסה שוב מאוחר יותר." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "גוף הבקשה אינו JSON תקין" }, { status: 400 });
  }

  const parsed = DetectAiImageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "קלט לא תקין" }, { status: 400 });
  }

  const approxBytes = Math.floor((parsed.data.imageBase64.length * 3) / 4);
  if (approxBytes > config.maxImageBytes) {
    return Response.json(
      { error: `התמונה גדולה מדי (מגבלה: ${Math.floor(config.maxImageBytes / 1_000_000)}MB)` },
      { status: 413 }
    );
  }

  const credentialsMarkers = scanForProvenanceMarkers(parsed.data.imageBase64);

  let visualOpinion = null;
  let visualOpinionFailed = false;
  if (hasLlmCredentials()) {
    try {
      visualOpinion = await getVisualAiOpinion(parsed.data.imageBase64, parsed.data.mediaType);
    } catch (err) {
      // Best-effort only: the metadata scan result is still returned even if the
      // visual-opinion model call fails (rate limit, transient API error, etc.) — but
      // log the real reason and flag it, so the UI can tell this apart from the
      // model's own honest "unsure" verdict instead of showing the same message for both.
      console.error("[detect-ai-image] visual opinion failed:", err);
      visualOpinion = null;
      visualOpinionFailed = true;
    }
  }

  return Response.json({ credentialsMarkers, visualOpinion, visualOpinionFailed });
}
