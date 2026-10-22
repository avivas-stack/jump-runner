import type { Classification, Confidence } from "@/lib/types";
import { useTranslation } from "@/lib/i18n/LanguageContext";

/**
 * A stamp, not a pill: a sharp-cornered mark with a solid left bar and small-caps
 * tracking, closer to how a press outlet marks a verdict than a colorful SaaS tag —
 * part of moving the whole report away from a soft, generic "AI app" look.
 */
const STYLES: Record<Classification, string> = {
  מאומת: "border-emerald-700 text-emerald-900 bg-emerald-50/60",
  שקרי: "border-rose-700 text-rose-900 bg-rose-50/60",
  מטעה: "border-amber-700 text-amber-900 bg-amber-50/60",
  "חסר הקשר": "border-orange-700 text-orange-900 bg-orange-50/60",
  "לא ניתן לאימות": "border-stone-500 text-stone-700 bg-stone-100/60",
  'ככה"נ שקרי': "border-orange-700 text-orange-900 bg-orange-50/60 border-dashed",
  "שנוי במחלוקת": "border-violet-700 text-violet-900 bg-violet-50/60",
  מיושן: "border-sky-700 text-sky-900 bg-sky-50/60",
  "דעה, תחזית או סאטירה": "border-stone-500 text-stone-700 bg-stone-100/60 italic",
};

export function ClassificationBadge({
  classification,
  partial = false,
}: {
  classification: Classification;
  /**
   * Set when this badge is one claim among several with DIFFERING classifications in the
   * same report — prefixes the label (e.g. "Part: Verified") so it reads as one piece of
   * a mixed picture, not the report's overall verdict (that's `report.overallClassification`,
   * shown separately — see ReportView.verdict.tsx).
   */
  partial?: boolean;
}) {
  const t = useTranslation("classifications");
  return (
    <span
      className={`inline-flex items-center border-s-4 px-3 py-1 text-xs font-bold tracking-wide ${STYLES[classification]}`}
    >
      {partial ? t.partialLabel.replace("{classification}", t.label[classification]) : t.label[classification]}
    </span>
  );
}

export function ConfidenceNote({ confidence }: { confidence: Confidence }) {
  const t = useTranslation("classifications");
  return <p className="text-xs text-stone-500">{t.confidenceFull[confidence]}</p>;
}

/**
 * A plain-language "should I share this" recommendation for each classification.
 * Deliberately conservative: anything not clearly verified (including "unverifiable")
 * defaults to "don't share" — the cost of a false "share it" is much higher than an
 * over-cautious "don't" for content that turns out fine. The tone (for styling) never
 * changes with language, only the displayed text does — so it stays as plain code here.
 */
export const RECOMMENDATION_TONE: Record<Classification, "share" | "caution" | "block"> = {
  מאומת: "share",
  שקרי: "block",
  מטעה: "block",
  "חסר הקשר": "caution",
  "לא ניתן לאימות": "block",
  'ככה"נ שקרי': "block",
  "שנוי במחלוקת": "caution",
  מיושן: "caution",
  "דעה, תחזית או סאטירה": "share",
};

const RECOMMENDATION_TONE_STYLES: Record<"share" | "caution" | "block", string> = {
  share: "text-emerald-700",
  caution: "text-amber-700",
  block: "text-rose-700",
};

export function RecommendationNote({ classification }: { classification: Classification }) {
  const t = useTranslation("classifications");
  const tone = RECOMMENDATION_TONE[classification];
  return <p className={`text-xs font-medium ${RECOMMENDATION_TONE_STYLES[tone]}`}>{t.recommendation[classification]}</p>;
}
