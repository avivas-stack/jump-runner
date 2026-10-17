import { NextRequest } from "next/server";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { saveFeedback, hasFeedbackStorage } from "@/lib/feedbackStore";
import { FeedbackRequestSchema } from "@/lib/types";

const FEEDBACK_RATE_LIMIT_PER_HOUR = 10;

export async function POST(request: NextRequest) {
  const clientKey = clientKeyFromRequest(request);
  const rate = await checkRateLimit(`feedback:${clientKey}`, FEEDBACK_RATE_LIMIT_PER_HOUR);
  if (!rate.allowed) {
    return Response.json({ error: "חרגת ממכסת הפניות השעתית. נסה שוב מאוחר יותר." }, { status: 429 });
  }

  if (!hasFeedbackStorage()) {
    return Response.json({ error: "שליחת פניות אינה זמינה כרגע." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "גוף הבקשה אינו JSON תקין" }, { status: 400 });
  }

  const parsed = FeedbackRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "קלט לא תקין" }, { status: 400 });
  }

  const saved = await saveFeedback(parsed.data);
  if (!saved) {
    return Response.json({ error: "שליחת הפנייה נכשלה. נסה שוב." }, { status: 502 });
  }

  return Response.json({ ok: true });
}
