"use client";

import { ChangeEvent, useRef, useState } from "react";
import type { DetectAiImageResult } from "@/lib/types";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_BYTES = 5_000_000;

const OPINION_LABEL: Record<"yes" | "no" | "unsure", string> = {
  yes: "נראית כמו תמונה שנוצרה או עובדה על ידי AI",
  no: "לא נראתה עדות חזותית ברורה ל-AI",
  unsure: "אי אפשר לקבוע מהמראה החזותי בלבד",
};

type VerdictTone = "block" | "caution" | "share";

const VERDICT_BADGE_STYLES: Record<VerdictTone, string> = {
  block: "border-rose-700 text-rose-900 bg-rose-50/60",
  caution: "border-amber-700 text-amber-900 bg-amber-50/60",
  share: "border-emerald-700 text-emerald-900 bg-emerald-50/60",
};

/**
 * Combines the two independent signals (metadata markers, visual opinion) into one
 * headline badge. A metadata hit is the strongest signal (real, checkable fact about
 * the file) and wins outright; otherwise the cautious visual opinion decides — and an
 * absence of signal ("unsure") is always shown as "can't determine", never as "clean",
 * so the UI never implies a certainty the tool doesn't have.
 */
function computeVerdict(result: DetectAiImageResult): { label: string; tone: VerdictTone } {
  if (result.credentialsMarkers.length > 0) {
    return { label: "נמצאו סימני מקור של AI במטא-דאטה", tone: "block" };
  }
  const opinion = result.visualOpinion?.likelyAiGenerated;
  if (opinion === "yes") {
    return { label: "ככל הנראה נוצרה או עובדה על ידי AI", tone: "block" };
  }
  if (opinion === "no") {
    return { label: "לא נמצאו עדויות ל-AI", tone: "share" };
  }
  return { label: "לא ניתן לקבוע באופן ברור", tone: "caution" };
}

export function AiImageDetector() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<DetectAiImageResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStatus("idle");
    setError(null);
    setPreviewUrl(null);
    setResult(null);
  };

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setResult(null);

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError("סוג קובץ לא נתמך. יש להעלות JPEG, PNG, GIF או WebP בלבד.");
      setStatus("error");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`התמונה גדולה מדי (מגבלה: ${Math.floor(MAX_IMAGE_BYTES / 1_000_000)}MB).`);
      setStatus("error");
      return;
    }

    setStatus("loading");
    setPreviewUrl(URL.createObjectURL(file));
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/detect-ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "שגיאה בבדיקת התמונה");
      }
      setResult(data);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה לא צפויה בבדיקת התמונה");
      setStatus("error");
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="font-serif text-lg font-bold text-stone-900">זיהוי תוכן שנוצר על ידי AI בתמונה</h2>
        <p className="mt-1 text-sm text-stone-600">
          הכלי בודק שני דברים נפרדים: סימני מקור ידועים (כמו C2PA Content Credentials או{" "}
          <span dir="ltr">SynthID</span>) שנמצאים במטא-דאטה של הקובץ עצמו, וחוות דעת חזותית זהירה
          של מודל AI. שני אלה אינם זיהוי פורנזי וודאי — ראה הסתייגות למטה.
        </p>
      </div>

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          onChange={handleImageSelect}
          disabled={status === "loading"}
          className="hidden"
        />
        <button
          type="button"
          disabled={status === "loading"}
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center rounded-md border border-dashed border-stone-300 p-4 text-xs text-stone-500 hover:border-teal-400 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading"
            ? "בודק את התמונה..."
            : "לחץ/י לבחירת תמונה (JPEG/PNG/GIF/WebP, עד 5MB)"}
        </button>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </div>

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="תצוגה מקדימה" className="max-h-64 w-full rounded-md object-contain" />
      )}

      {result && (
        <div className="space-y-3 rounded-md border border-stone-200 bg-stone-50 p-4">
          <div className="text-center">
            <span
              className={`inline-block border-s-4 px-4 py-2 text-sm font-bold tracking-wide ${VERDICT_BADGE_STYLES[computeVerdict(result).tone]}`}
            >
              {computeVerdict(result).label}
            </span>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-stone-900">סימני מקור במטא-דאטה</h3>
            {result.credentialsMarkers.length > 0 ? (
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-stone-700">
                {result.credentialsMarkers.map((marker) => (
                  <li key={marker}>{marker}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-stone-500">
                לא נמצאו סימני מקור ידועים — אין בכך הוכחה שהתמונה אותנטית, שכן ניתן להסיר מטא-דאטה
                בקלות (שמירה מחדש, צילום מסך, עריכה).
              </p>
            )}
          </div>

          {result.visualOpinion && (
            <div>
              <h3 className="text-sm font-semibold text-stone-900">חוות דעת חזותית (לא ודאית)</h3>
              <p className="mt-1 text-sm text-stone-700">{OPINION_LABEL[result.visualOpinion.likelyAiGenerated]}</p>
              <p className="mt-1 text-xs text-stone-500">{result.visualOpinion.rationale}</p>
              {result.visualOpinion.visualSigns.length > 0 && (
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-stone-600">
                  {result.visualOpinion.visualSigns.map((sign, i) => (
                    <li key={i}>{sign}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="text-xs text-stone-400">
            הערה: <span dir="ltr">SynthID</span> הוא סימן מים קריפטוגרפי בלתי נראה; פענוח אמין שלו
            דורש את הכלי הייעודי של גוגל, שאינו זמין כשירות API ציבורי. הכלי הזה בודק רק סימני
            מקור גלויים בקובץ וחוות דעת חזותית — לא פענוח ישיר של סימן המים.
          </p>

          <button
            type="button"
            onClick={reset}
            className="w-full rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            בדיקת תמונה נוספת
          </button>
        </div>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("קריאת הקובץ נכשלה"));
    reader.readAsDataURL(file);
  });
}
