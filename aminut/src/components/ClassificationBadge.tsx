import type { Classification, Confidence } from "@/lib/types";

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

export function ClassificationBadge({ classification }: { classification: Classification }) {
  return (
    <span
      className={`inline-flex items-center border-s-4 px-3 py-1 text-xs font-bold tracking-wide ${STYLES[classification]}`}
    >
      {classification}
    </span>
  );
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  low: "ביטחון נמוך — הראיות מוגבלות או לא חד-משמעיות",
  medium: "ביטחון בינוני — יש ראיות סבירות אך לא מכריעות",
  high: "ביטחון גבוה — הראיות ברורות ועקביות",
};

export function ConfidenceNote({ confidence }: { confidence: Confidence }) {
  return <p className="text-xs text-stone-500">{CONFIDENCE_LABEL[confidence]}</p>;
}

/**
 * A plain-language "should I share this" recommendation for each classification.
 * Deliberately conservative: anything not clearly verified (including "unverifiable")
 * defaults to "don't share" — the cost of a false "share it" is much higher than an
 * over-cautious "don't" for content that turns out fine.
 */
const RECOMMENDATION: Record<Classification, { text: string; tone: "share" | "caution" | "block" }> = {
  מאומת: { text: "המלצה: אפשר להעביר", tone: "share" },
  שקרי: { text: "המלצה: לא להעביר!", tone: "block" },
  מטעה: { text: "המלצה: לא להעביר!", tone: "block" },
  "חסר הקשר": { text: "המלצה: אפשר להעביר רק בצירוף ההקשר החסר", tone: "caution" },
  "לא ניתן לאימות": { text: "המלצה: לא להעביר!", tone: "block" },
  'ככה"נ שקרי': { text: "המלצה: לא להעביר!", tone: "block" },
  "שנוי במחלוקת": { text: "המלצה: להעביר בזהירות — הנושא שנוי במחלוקת", tone: "caution" },
  מיושן: { text: "המלצה: לא להעביר בלי לציין שהמידע מיושן", tone: "caution" },
  "דעה, תחזית או סאטירה": { text: "המלצה: אפשר להעביר, בציון שמדובר בדעה/תחזית/סאטירה", tone: "share" },
};

const RECOMMENDATION_TONE_STYLES: Record<"share" | "caution" | "block", string> = {
  share: "text-emerald-700",
  caution: "text-amber-700",
  block: "text-rose-700",
};

export function RecommendationNote({ classification }: { classification: Classification }) {
  const { text, tone } = RECOMMENDATION[classification];
  return <p className={`text-xs font-medium ${RECOMMENDATION_TONE_STYLES[tone]}`}>{text}</p>;
}
