"use client";

import { ChangeEvent, useRef, useState } from "react";
import type { DetectAiImageResult } from "@/lib/types";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_BYTES = 5_000_000;

/** An error whose message is our own clear Hebrew text, safe to show the user as-is. */
class KnownError extends Error {}

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
  // Distinct from the model's own honest "unsure" below: this is a technical failure
  // (rate limit, transient API error), not the model actually looking and not finding
  // a clear answer — conflating the two would quietly misrepresent a dropped check
  // as a real, if inconclusive, one.
  if (result.visualOpinionFailed) {
    return { label: "הבדיקה החזותית נכשלה זמנית — נסו שוב", tone: "caution" };
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
  const [wasCompressed, setWasCompressed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStatus("idle");
    setError(null);
    setPreviewUrl(null);
    setResult(null);
    setWasCompressed(false);
  };

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setResult(null);
    setWasCompressed(false);

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError("סוג קובץ לא נתמך. יש להעלות JPEG, PNG, GIF או WebP בלבד.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    try {
      // Phones routinely produce photos/screenshots over the limit (especially shared
      // in from another app, as on iOS) — shrink those client-side instead of just
      // refusing them, rather than forcing the person to go find a smaller copy.
      let blobToUpload: Blob = file;
      let mediaType: string = file.type;
      if (file.size > MAX_IMAGE_BYTES) {
        blobToUpload = await compressUntilUnderLimit(file);
        mediaType = blobToUpload.type;
        setWasCompressed(true);
      }

      setPreviewUrl(URL.createObjectURL(blobToUpload));
      const base64 = await fileToBase64(blobToUpload);
      const res = await fetch("/api/detect-ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new KnownError(data.error ?? "שגיאה בבדיקת התמונה");
      }
      setResult(data);
      setStatus("idle");
    } catch (err) {
      // Never leak a raw browser/runtime exception (e.g. a cryptic WebKit DOMException)
      // to a Hebrew-speaking user — only a KnownError carries a message we wrote
      // ourselves and know is clear Hebrew; log the real detail either way.
      console.error("AI image detection failed:", err);
      const message = err instanceof KnownError ? err.message : "אירעה שגיאה בבדיקת התמונה. נסו שוב, או עם תמונה אחרת.";
      setError(message);
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
          של מודל AI — הן על פגמים חזותיים טיפוסיים (עור חלק מדי, ידיים מעוותות) והן על כך שהמצב
          המתואר בתמונה הגיוני במציאות. שני אלה אינם זיהוי פורנזי וודאי — ראה הסתייגות למטה.
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
            : "לחץ/י לבחירת תמונה (JPEG/PNG/GIF/WebP) — תמונות גדולות יכווצו אוטומטית"}
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

          {wasCompressed && (
            <p className="text-xs text-stone-400">
              התמונה הייתה גדולה מהמגבלה וכווצה אוטומטית לפני הבדיקה — בדיקת סימני המקור במטא-דאטה
              למטה מתייחסת לעותק המכווץ, לא לקובץ המקורי.
            </p>
          )}

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

          {result.visualOpinionFailed && (
            <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3">
              <h3 className="text-sm font-semibold text-stone-900">חוות דעת חזותית</h3>
              <p className="mt-1 text-sm text-amber-800">
                הבדיקה החזותית נכשלה הפעם עקב תקלה זמנית (לדוגמה עומס זמני על השירות) — זה לא אומר
                שהתמונה תקינה, רק שלא הצלחנו לבדוק אותה הפעם. כדאי לנסות שוב.
              </p>
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

function fileToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("קריאת הקובץ נכשלה"));
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new KnownError("לא ניתן היה לפתוח את התמונה בדפדפן. נסו תמונה אחרת."));
    };
    img.src = objectUrl;
  });
}

function downscaleToJpeg(img: HTMLImageElement, maxDimension: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.reject(new KnownError("לא ניתן היה לעבד את התמונה בדפדפן זה. נסו תמונה קטנה יותר."));
  }
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new KnownError("לא ניתן היה לדחוס את התמונה. נסו תמונה אחרת."))),
      "image/jpeg",
      quality
    );
  });
}

/**
 * Shrinks an over-the-limit image until it fits, instead of just refusing it — phones
 * routinely produce photos/screenshots over 5MB, especially when shared in from another
 * app. Tries progressively smaller dimensions/quality; gives up with a clear message
 * only if even the smallest attempt still doesn't fit.
 *
 * Trade-off: re-encoding through canvas strips any original file metadata, so the
 * metadata-provenance check below only ever reflects the original file when it was
 * already under the limit and sent as-is.
 */
async function compressUntilUnderLimit(file: File): Promise<Blob> {
  const img = await loadImageElement(file);
  const attempts: [number, number][] = [
    [1600, 0.85],
    [1200, 0.75],
    [900, 0.65],
  ];
  let lastBlob: Blob | null = null;
  for (const [maxDimension, quality] of attempts) {
    lastBlob = await downscaleToJpeg(img, maxDimension, quality);
    if (lastBlob.size <= MAX_IMAGE_BYTES) return lastBlob;
  }
  throw new KnownError(
    `התמונה גדולה מדי גם אחרי דחיסה (מגבלה: ${Math.floor(MAX_IMAGE_BYTES / 1_000_000)}MB). נסו תמונה קטנה יותר או צילום מסך ממוקד יותר.`
  );
}
