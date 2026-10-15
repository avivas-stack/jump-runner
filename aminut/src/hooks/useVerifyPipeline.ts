"use client";

import { useCallback, useRef, useState } from "react";
import type { Report, StageEvent, VerifyRequest } from "@/lib/types";

export type PipelineStatus = "idle" | "running" | "done" | "error";

export interface PipelineState {
  status: PipelineStatus;
  stage: StageEvent | null;
  report: Report | null;
  shareUrl: string | null;
  error: { message: string; code: string } | null;
}

const initialState: PipelineState = {
  status: "idle",
  stage: null,
  report: null,
  shareUrl: null,
  error: null,
};

export function useVerifyPipeline() {
  const [state, setState] = useState<PipelineState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(initialState);
  }, []);

  const run = useCallback(async (input: VerifyRequest) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ status: "running", stage: null, report: null, shareUrl: null, error: null });

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let message = "שגיאה בשרת";
        try {
          const data = await res.json();
          message = data.error ?? message;
        } catch {
          // response wasn't JSON; keep default message
        }
        setState({
          status: "error",
          stage: null,
          report: null,
          shareUrl: null,
          error: { message, code: String(res.status) },
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StageEvent;
          if (event.type === "stage") {
            setState((prev) => ({ ...prev, stage: event }));
          } else if (event.type === "done") {
            setState({
              status: "done",
              stage: null,
              report: event.report,
              shareUrl: event.shareUrl,
              error: null,
            });
          } else if (event.type === "error") {
            setState({
              status: "error",
              stage: null,
              report: null,
              shareUrl: null,
              error: { message: event.message, code: event.code },
            });
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : "שגיאת רשת בלתי צפויה";
      setState({
        status: "error",
        stage: null,
        report: null,
        shareUrl: null,
        error: { message, code: "network" },
      });
    }
  }, []);

  return { state, run, reset };
}
