import { NextRequest } from "next/server";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { config } from "@/lib/config";
import { runVerifyPipeline, PipelineError } from "@/lib/pipeline";
import { saveReport } from "@/lib/reportStore";
import { hasReportStorage } from "@/lib/config";
import { VerifyRequestSchema, StageEvent } from "@/lib/types";

export async function POST(request: NextRequest) {
  const clientKey = clientKeyFromRequest(request);
  const rate = checkRateLimit(clientKey, config.rateLimitPerIpPerHour);
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
          emit({ type: "error", message: err.message, code: err.code });
        } else {
          const message = err instanceof Error ? err.message : "שגיאה לא צפויה בעת הבדיקה";
          emit({ type: "error", message, code: "unexpected" });
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
