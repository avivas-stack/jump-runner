import type { StageEvent } from "@/lib/types";

const ALL_STAGES: { key: string; label: string }[] = [
  { key: "fetching_url", label: "מאחזר את תוכן הקישור" },
  { key: "extracting_claims", label: "מחלץ טענות מהטקסט" },
  { key: "searching", label: "מחפש ראיות מול מקורות" },
  { key: "comparing_sources", label: "משווה בין מקורות" },
  { key: "preparing_report", label: "מכין את הדוח" },
];

export function LoadingStages({ stage, hasUrl }: { stage: StageEvent | null; hasUrl: boolean }) {
  const stages = hasUrl ? ALL_STAGES : ALL_STAGES.filter((s) => s.key !== "fetching_url");
  const currentKey = stage?.type === "stage" ? stage.stage : null;
  const currentIndex = stages.findIndex((s) => s.key === currentKey);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm" role="status" aria-live="polite">
      <ul className="space-y-3">
        {stages.map((s, i) => {
          const isDone = currentIndex > i || (currentIndex === -1 && i < 0);
          const isActive = i === currentIndex;
          return (
            <li key={s.key} className="flex items-center gap-3 text-sm">
              <span
                className={
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs " +
                  (isDone
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : isActive
                      ? "border-teal-600 text-teal-700"
                      : "border-stone-300 text-stone-400")
                }
              >
                {isDone ? "✓" : isActive ? <span className="h-2 w-2 animate-pulse rounded-full bg-teal-600" /> : ""}
              </span>
              <span className={isActive ? "font-medium text-stone-900" : isDone ? "text-stone-500" : "text-stone-400"}>
                {s.label}
                {isActive && s.key === "searching" && stage?.type === "stage" && stage.stage === "searching" && (
                  <span className="block text-xs font-normal text-stone-500">
                    בודק טענה {stage.claimIndex} מתוך {stage.totalClaims}: &ldquo;{truncate(stage.claimText, 60)}&rdquo;
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
