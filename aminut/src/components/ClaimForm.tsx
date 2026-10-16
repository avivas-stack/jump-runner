"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_BYTES = 5_000_000;

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "זוהה בבירור",
  medium: "זוהה ברובו, כדאי לבדוק",
  low: "קושי בזיהוי — יש לבדוק ולתקן",
};

export function ClaimForm({
  text,
  onTextChange,
  url,
  onUrlChange,
  disabled,
  onSubmit,
}: {
  text: string;
  onTextChange: (value: string) => void;
  url: string;
  onUrlChange: (value: string) => void;
  disabled: boolean;
  onSubmit: (input: { text?: string; url?: string }) => void;
}) {
  const [imageStatus, setImageStatus] = useState<"idle" | "loading" | "error">("idle");
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageNote, setImageNote] = useState<{ confidence: string; notes: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = !disabled && (text.trim().length > 0 || url.trim().length > 0);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ text: text.trim() || undefined, url: url.trim() || undefined });
  };

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImageNote(null);
    setImageError(null);

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImageError("סוג קובץ לא נתמך. יש להעלות JPEG, PNG, GIF או WebP בלבד.");
      setImageStatus("error");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(`התמונה גדולה מדי (מגבלה: ${Math.floor(MAX_IMAGE_BYTES / 1_000_000)}MB).`);
      setImageStatus("error");
      return;
    }

    setImageStatus("loading");
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/extract-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "שגיאה בזיהוי טקסט מהתמונה");
      }
      onTextChange(text.trim() ? `${text.trim()}\n\n${data.extractedText}` : data.extractedText);
      setImageNote({ confidence: data.confidence, notes: data.uncertainNotes ?? [] });
      setImageStatus("idle");
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "שגיאה לא צפויה בעיבוד התמונה");
      setImageStatus("error");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="claim-text" className="mb-1 block text-sm font-medium text-stone-700">
          טקסט, כותרת, ציטוט או פוסט לבדיקה
        </label>
        <textarea
          id="claim-text"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          maxLength={8000}
          rows={5}
          disabled={disabled}
          placeholder="הדבק כאן כותרת, ציטוט, פוסט או טענה שברצונך לבדוק..."
          className="w-full resize-none rounded-md border border-stone-300 p-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 disabled:bg-stone-50"
        />
        {imageNote && (
          <p
            className={
              "mt-1 text-xs " +
              (imageNote.confidence === "low" ? "text-amber-700" : "text-stone-500")
            }
          >
            זיהוי טקסט מהתמונה: {CONFIDENCE_LABEL[imageNote.confidence] ?? imageNote.confidence}
            {imageNote.notes.length > 0 && ` — ${imageNote.notes.join("; ")}`}. בדוק/י ותקן/י לפני הבדיקה.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="claim-url" className="mb-1 block text-sm font-medium text-stone-700">
          או קישור לכתבה / פוסט
        </label>
        <input
          id="claim-url"
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          maxLength={2000}
          disabled={disabled}
          placeholder="https://..."
          className="w-full rounded-md border border-stone-300 p-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 disabled:bg-stone-50"
        />
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-stone-700">או העלאת צילום מסך</span>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          onChange={handleImageSelect}
          disabled={disabled || imageStatus === "loading"}
          className="hidden"
        />
        <button
          type="button"
          disabled={disabled || imageStatus === "loading"}
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center rounded-md border border-dashed border-stone-300 p-4 text-xs text-stone-500 hover:border-teal-400 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {imageStatus === "loading"
            ? "מזהה טקסט בתמונה..."
            : "לחץ/י לבחירת תמונה (JPEG/PNG/GIF/WebP, עד 5MB) — הטקסט שיזוהה יתווסף לתיבה למעלה לבדיקה ועריכה"}
        </button>
        {imageError && <p className="mt-1 text-xs text-rose-600">{imageError}</p>}
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-stone-300"
      >
        בדוק אמינות
      </button>
    </form>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // "data:image/png;base64,AAAA..." -> keep only the base64 payload
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("קריאת הקובץ נכשלה"));
    reader.readAsDataURL(file);
  });
}
