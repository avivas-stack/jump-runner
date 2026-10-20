"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { KnownError, MAX_CLIENT_IMAGE_BYTES, compressImageUntilUnderLimit, fileToBase64 } from "@/lib/clientImageUpload";
import { useTranslation } from "@/lib/i18n/LanguageContext";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

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
  const t = useTranslation("claimForm");
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
      setImageError(t.unsupportedFileType);
      setImageStatus("error");
      return;
    }

    setImageStatus("loading");
    try {
      // Phones routinely produce photos/screenshots over the limit (especially shared
      // in from another app) — shrink those client-side instead of just refusing them.
      let blobToUpload: Blob = file;
      let mediaType: string = file.type;
      if (file.size > MAX_CLIENT_IMAGE_BYTES) {
        blobToUpload = await compressImageUntilUnderLimit(file);
        mediaType = blobToUpload.type;
      }

      const base64 = await fileToBase64(blobToUpload);
      const res = await fetch("/api/extract-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new KnownError(data.error ?? "שגיאה בזיהוי טקסט מהתמונה");
      }
      onTextChange(text.trim() ? `${text.trim()}\n\n${data.extractedText}` : data.extractedText);
      setImageNote({ confidence: data.confidence, notes: data.uncertainNotes ?? [] });
      setImageStatus("idle");
    } catch (err) {
      // Never leak a raw browser/runtime exception to the user — only a KnownError
      // carries a message we wrote ourselves and know is clear Hebrew.
      console.error("Image text extraction failed:", err);
      const message = err instanceof KnownError ? err.message : t.genericImageError;
      setImageError(message);
      setImageStatus("error");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="claim-text" className="mb-1 block text-sm font-medium text-stone-700">
          {t.textLabel}
        </label>
        <textarea
          id="claim-text"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          maxLength={8000}
          rows={5}
          disabled={disabled}
          placeholder={t.textPlaceholder}
          className="w-full resize-none rounded-md border border-stone-300 p-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 disabled:bg-stone-50"
        />
        {imageNote && (
          <p
            className={
              "mt-1 text-xs " +
              (imageNote.confidence === "low" ? "text-amber-700" : "text-stone-500")
            }
          >
            {t.imageNotePrefix}
            {t.confidenceLabels[imageNote.confidence as keyof typeof t.confidenceLabels] ?? imageNote.confidence}
            {imageNote.notes.length > 0 && ` — ${imageNote.notes.join("; ")}`}
            {t.imageNoteSuffix}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="claim-url" className="mb-1 block text-sm font-medium text-stone-700">
          {t.urlLabel}
        </label>
        <input
          id="claim-url"
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          maxLength={2000}
          disabled={disabled}
          placeholder={t.urlPlaceholder}
          className="w-full rounded-md border border-stone-300 p-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 disabled:bg-stone-50"
        />
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-stone-700">{t.imageUploadLabel}</span>
        <input
          ref={fileInputRef}
          // Targeted by name from browser-extension/content-handoff.js to hand off an
          // image captured via the extension's right-click-image flow — keep this id
          // stable if this input ever moves or gets wrapped.
          id="facto-claim-image-input"
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
          {imageStatus === "loading" ? t.uploadButtonLoading : t.uploadButtonIdle}
        </button>
        {imageError && <p className="mt-1 text-xs text-rose-600">{imageError}</p>}
        <p className="mt-1 text-xs text-stone-600">{t.imageDisclaimer}</p>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-stone-300"
      >
        {t.submit}
      </button>
    </form>
  );
}

