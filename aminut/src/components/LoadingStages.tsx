import type { StageEvent } from "@/lib/types";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export function LoadingStages({ stage, hasUrl }: { stage: StageEvent | null; hasUrl: boolean }) {
  const t = useTranslation("loadingStages");
  const allStages: { key: string; label: string }[] = [
    { key: "fetching_url", label: t.stages.fetching_url },
    { key: "extracting_claims", label: t.stages.extracting_claims },
    { key: "searching", label: t.stages.searching },
    { key: "comparing_sources", label: t.stages.comparing_sources },
    { key: "preparing_report", label: t.stages.preparing_report },
  ];
  const stages = hasUrl ? allStages : allStages.filter((s) => s.key !== "fetching_url");
  const currentKey = stage?.type === "stage" ? stage.stage : null;
  const currentIndex = stages.findIndex((s) => s.key === currentKey);

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm" role="status" aria-live="polite">
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
                      : "border-stone-300 text-stone-600")
                }
              >
                {isDone ? "✓" : isActive ? <span className="h-2 w-2 animate-pulse rounded-full bg-teal-600" /> : ""}
              </span>
              <span className={isActive ? "font-medium text-stone-900" : isDone ? "text-stone-500" : "text-stone-600"}>
                {s.label}
                {isActive && s.key === "searching" && stage?.type === "stage" && stage.stage === "searching" && (
                  <span className="block text-xs font-normal text-stone-500">
                    {t.searchingDetailPrefix}
                    {stage.claimIndex}
                    {t.searchingDetailSeparator}
                    {stage.totalClaims}
                    {t.searchingDetailSuffix}&ldquo;{truncate(stage.claimText, 60)}&rdquo;
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
