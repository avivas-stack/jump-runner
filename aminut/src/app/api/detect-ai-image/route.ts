import { NextRequest } from "next/server";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { config, hasLlmCredentials } from "@/lib/config";
import { getVisualAiOpinion, scanForProvenanceMarkers } from "@/lib/aiImageDetection";
import { DetectAiImageRequestSchema } from "@/lib/types";

export async function POST(request: NextRequest) {
  const clientKey = clientKeyFromRequest(request);
  const rate = checkRateLimit(`aiimg:${clientKey}`, config.imageRateLimitPerIpPerHour);
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
  if (hasLlmCredentials()) {
    try {
      visualOpinion = await getVisualAiOpinion(parsed.data.imageBase64, parsed.data.mediaType);
    } catch {
      // Best-effort only: the metadata scan result is still returned even if the
      // visual-opinion model call fails (rate limit, transient API error, etc.).
      visualOpinion = null;
    }
  }

  return Response.json({ credentialsMarkers, visualOpinion });
}
