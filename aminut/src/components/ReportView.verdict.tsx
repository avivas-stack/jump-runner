"use client";

import type { Classification, Confidence, Report } from "@/lib/types";
import { ClassificationBadge, RecommendationNote } from "./ClassificationBadge";

/**
 * A large, hard-to-miss verdict summary at the very top of the report. Deliberately
 * keeps the full classification vocabulary (never collapses to a true/false binary,
 * and "unverifiable" is never shown as "probably false") — it's a size/prominence fix,
 * not a simplification of what the classifications mean.
 */
export function VerdictHero({ report }: { report: Report }) {
  if (report.claims.length === 1) {
    const evaluation = report.evaluations.find((e) => e.claimId === report.claims[0].id);
    if (!evaluation) return null;
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm">
        <span className={BIG_BADGE_STYLES[evaluation.classification]}>{evaluation.classification}</span>
        <p className="mt-2 text-sm text-stone-500">{CONFIDENCE_FULL_LABEL[evaluation.confidence]}</p>
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

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="text-center text-xs font-medium text-stone-500">סיכום הסיווגים</h2>
      <div className="mt-3 flex flex-wrap items-start justify-center gap-4">
        {Array.from(counts.entries()).map(([classification, count]) => (
          <div key={classification} className="flex flex-col items-center gap-1">
            <span className="flex items-center gap-1.5">
              <ClassificationBadge classification={classification} />
              <span className="text-sm font-medium text-stone-500">× {count}</span>
            </span>
            <RecommendationNote classification={classification} />
          </div>
        ))}
      </div>
    </section>
  );
}

const BIG_BADGE_STYLES: Record<Classification, string> = {
  מאומת: "inline-block rounded-2xl border-2 px-6 py-3 text-2xl font-bold bg-emerald-50 text-emerald-800 border-emerald-300",
  שקרי: "inline-block rounded-2xl border-2 px-6 py-3 text-2xl font-bold bg-rose-50 text-rose-800 border-rose-300",
  מטעה: "inline-block rounded-2xl border-2 px-6 py-3 text-2xl font-bold bg-amber-50 text-amber-800 border-amber-300",
  "חסר הקשר": "inline-block rounded-2xl border-2 px-6 py-3 text-2xl font-bold bg-orange-50 text-orange-800 border-orange-300",
  "לא ניתן לאימות": "inline-block rounded-2xl border-2 px-6 py-3 text-2xl font-bold bg-stone-100 text-stone-700 border-stone-300",
  'ככה"נ שקרי':
    "inline-block rounded-2xl border-2 border-dashed px-6 py-3 text-2xl font-bold bg-orange-50 text-orange-900 border-orange-400",
  "שנוי במחלוקת": "inline-block rounded-2xl border-2 px-6 py-3 text-2xl font-bold bg-violet-50 text-violet-800 border-violet-300",
  מיושן: "inline-block rounded-2xl border-2 px-6 py-3 text-2xl font-bold bg-sky-50 text-sky-800 border-sky-300",
  "דעה, תחזית או סאטירה":
    "inline-block rounded-2xl border-2 px-6 py-3 text-2xl font-bold italic bg-stone-100 text-stone-600 border-stone-300",
};

const CONFIDENCE_FULL_LABEL: Record<Confidence, string> = {
  low: "ביטחון נמוך — הראיות מוגבלות או לא חד-משמעיות",
  medium: "ביטחון בינוני — יש ראיות סבירות אך לא מכריעות",
  high: "ביטחון גבוה — הראיות ברורות ועקביות",
};
