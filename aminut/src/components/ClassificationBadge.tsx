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
