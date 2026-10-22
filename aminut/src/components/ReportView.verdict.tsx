"use client";

import type { Classification, Report } from "@/lib/types";
import { ClassificationBadge, RecommendationNote } from "./ClassificationBadge";
import { useTranslation } from "@/lib/i18n/LanguageContext";

/**
 * A large, hard-to-miss verdict summary at the very top of the report. Deliberately
 * keeps the full classification vocabulary (never collapses to a true/false binary,
 * and "unverifiable" is never shown as "probably false") — it's a size/prominence fix,
 * not a simplification of what the classifications mean.
 */
export function VerdictHero({ report }: { report: Report }) {
  const t = useTranslation("reportVerdict");
  const classifications = useTranslation("classifications");

  if (report.claims.length === 1) {
    const evaluation = report.evaluations.find((e) => e.claimId === report.claims[0].id);
    if (!evaluation) return null;
    return (
      <section className="rounded-lg border border-stone-200 bg-white p-6 text-center shadow-sm">
        <span className={BIG_BADGE_STYLES[evaluation.classification]}>
          {classifications.label[evaluation.classification]}
        </span>
        <p className="mt-2 text-sm text-stone-500">{classifications.confidenceFull[evaluation.confidence]}</p>
        <div className="mt-1">
          <RecommendationNote classification={evaluation.classification} />
        </div>
      </section>
    );
  }

  const counts = new Map<Classification, number>();
  for (const evaluation of report.evaluations) {
    counts.set(evaluation.classification, (counts.get(evaluation.classification) ?? 0) + 1);
  }
  // Same gate as ReportView.tsx's hasMixedClassifications: only "partial"-label the
  // per-classification counts once there's an overall verdict for them to be part of —
  // an older report with no overallClassification renders exactly as it always did.
  const isMixed = Boolean(report.overallClassification) && counts.size > 1;

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      {/* Older reports (saved before overallClassification existed) have no value here —
          ReportSchema keeps the field optional specifically so those still render, just
          without this combined-verdict block, instead of 404ing (see types.ts). */}
      {report.overallClassification && (
        <div className="mb-5 border-b border-stone-200 pb-5 text-center">
          <span className={BIG_BADGE_STYLES[report.overallClassification]}>
            {classifications.label[report.overallClassification]}
          </span>
          <div className="mt-2">
            <RecommendationNote classification={report.overallClassification} />
          </div>
        </div>
      )}
      <h2 className="text-center text-xs font-medium tracking-wide text-stone-500 uppercase">
        {t.classificationsSummaryTitle}
      </h2>
      <div className="mt-3 flex flex-wrap items-start justify-center gap-4">
        {Array.from(counts.entries()).map(([classification, count]) => (
          <div key={classification} className="flex flex-col items-center gap-1">
            <span className="flex items-center gap-1.5">
              <ClassificationBadge classification={classification} partial={isMixed} />
              <span className="text-sm font-medium text-stone-500">× {count}</span>
            </span>
            {!report.overallClassification && <RecommendationNote classification={classification} />}
          </div>
        ))}
      </div>
    </section>
  );
}

const BIG_BADGE_BASE =
  "inline-block border-s-[6px] px-6 py-3 font-serif text-2xl font-bold";
const BIG_BADGE_STYLES: Record<Classification, string> = {
  מאומת: `${BIG_BADGE_BASE} border-emerald-700 text-emerald-900 bg-emerald-50/60`,
  שקרי: `${BIG_BADGE_BASE} border-rose-700 text-rose-900 bg-rose-50/60`,
  מטעה: `${BIG_BADGE_BASE} border-amber-700 text-amber-900 bg-amber-50/60`,
  "חסר הקשר": `${BIG_BADGE_BASE} border-orange-700 text-orange-900 bg-orange-50/60`,
  "לא ניתן לאימות": `${BIG_BADGE_BASE} border-stone-500 text-stone-700 bg-stone-100/60`,
  'ככה"נ שקרי': `${BIG_BADGE_BASE} border-dashed border-orange-700 text-orange-900 bg-orange-50/60`,
  "שנוי במחלוקת": `${BIG_BADGE_BASE} border-violet-700 text-violet-900 bg-violet-50/60`,
  מיושן: `${BIG_BADGE_BASE} border-sky-700 text-sky-900 bg-sky-50/60`,
  "דעה, תחזית או סאטירה": `${BIG_BADGE_BASE} italic border-stone-500 text-stone-700 bg-stone-100/60`,
};
