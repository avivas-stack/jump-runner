"use client";

import { useEffect, useRef } from "react";
import { ClassificationBadge } from "./ClassificationBadge";
import { useLanguage, useTranslation } from "@/lib/i18n/LanguageContext";

export function HowItWorksModal() {
  const { language } = useLanguage();
  const t = useTranslation("howItWorks");
  const classifications = useTranslation("classifications");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClick = (e: MouseEvent) => {
      if (e.target === dialog) dialog.close();
    };
    dialog.addEventListener("click", handleClick);
    return () => dialog.removeEventListener("click", handleClick);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="text-xs font-medium text-teal-700 underline-offset-2 hover:underline"
      >
        {t.triggerButton}
      </button>
      <dialog
        ref={dialogRef}
        className="w-full max-w-lg rounded-lg border border-stone-200 p-0 backdrop:bg-stone-900/40"
      >
        <div className="max-h-[80vh] overflow-y-auto p-6" dir={language === "en" ? "ltr" : "rtl"}>
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-serif text-lg font-bold text-stone-900">{t.modalTitle}</h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label={t.closeLabel}
              className="shrink-0 rounded-full p-1 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            >
              ✕
            </button>
          </div>

          <ol className="mt-3 space-y-2 text-sm text-stone-600">
            {t.steps.map((step, i) => (
              <li key={i}>
                {i + 1}. {step}
              </li>
            ))}
          </ol>

          <h3 className="mt-5 text-sm font-semibold text-stone-900">{t.classificationsExplainedTitle}</h3>
          <ul className="mt-3 space-y-3">
            {classifications.order.map((classification) => (
              <li key={classification} className="flex items-start gap-3">
                <div className="shrink-0 pt-0.5">
                  <ClassificationBadge classification={classification} />
                </div>
                <p className="text-sm text-stone-600">{classifications.explanation[classification]}</p>
              </li>
            ))}
          </ul>

          <p className="mt-5 text-xs text-stone-600">{t.disclaimer}</p>
        </div>
      </dialog>
    </>
  );
}
