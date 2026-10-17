import { NextRequest } from "next/server";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { config, paidEndpointsDisabledResponse } from "@/lib/config";
import { runVerifyPipeline, PipelineError } from "@/lib/pipeline";
import { saveReport } from "@/lib/reportStore";
import { hasReportStorage } from "@/lib/config";
import { VerifyRequestSchema, StageEvent } from "@/lib/types";

// A multi-claim report runs several claims through claim extraction, up to 2 searches
// each, a full-page fetch, and an evaluation call — all sequentially. 120s gives that
// realistic headroom without relying on the platform's own (higher, but unstated-in-code)
// default.
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const maintenance = paidEndpointsDisabledResponse();
  if (maintenance) return maintenance;

  const clientKey = clientKeyFromRequest(request);
  const rate = await checkRateLimit(clientKey, config.rateLimitPerIpPerHour);
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

  const parsed = VerifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  let streamClosed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: StageEvent) => {
        if (streamClosed) return;
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        const report = await runVerifyPipeline(parsed.data, emit);
        await saveReport(report);
        emit({ type: "done", report, shareUrl: hasReportStorage() ? `/report/${report.id}` : null });
      } catch (err) {
        if (err instanceof PipelineError) {
          // PipelineError messages are always our own, written for the end user.
          emit({ type: "error", message: err.message, code: err.code });
        } else {
          // Anything else is an unexpected failure from a dependency (Anthropic, Tavily,
          // etc.) — its message is implementation detail for us, not the user, so log it
          // and send a generic one instead of forwarding vendor error text verbatim.
          console.error("verify pipeline failed unexpectedly:", err);
          emit({ type: "error", message: "שגיאה לא צפויה בעת הבדיקה. נסו שוב.", code: "unexpected" });
        }
      } finally {
        streamClosed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
