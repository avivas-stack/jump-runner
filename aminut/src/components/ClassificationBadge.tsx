import type { Classification, Confidence } from "@/lib/types";

const STYLES: Record<Classification, string> = {
  מאומת: "bg-emerald-50 text-emerald-800 border-emerald-200",
  שקרי: "bg-rose-50 text-rose-800 border-rose-200",
  מטעה: "bg-amber-50 text-amber-800 border-amber-200",
  "חסר הקשר": "bg-orange-50 text-orange-800 border-orange-200",
  "לא ניתן לאימות": "bg-stone-100 text-stone-700 border-stone-300",
  'ככה"נ שקרי': "bg-orange-50 text-orange-900 border-orange-400 border-dashed",
  "שנוי במחלוקת": "bg-violet-50 text-violet-800 border-violet-200",
  מיושן: "bg-sky-50 text-sky-800 border-sky-200",
  "דעה, תחזית או סאטירה": "bg-stone-100 text-stone-600 border-stone-300 italic",
};

export function ClassificationBadge({ classification }: { classification: Classification }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${STYLES[classification]}`}>
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
