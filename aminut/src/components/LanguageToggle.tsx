"use client";

import { useLanguage, useTranslation } from "@/lib/i18n/LanguageContext";

/** The small EN/HE switch — toggles only how the site is displayed, never its logic. */
export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();
  const t = useTranslation("languageToggle");
  const visibleLabel = language === "he" ? "EN" : "עב";

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      // The accessible name must contain the visible label verbatim (WCAG 2.5.3 "Label in
      // Name") so speech-control users saying "click EN" actually match this button —
      // t.label alone ("Change display language") doesn't mention "EN" at all.
      aria-label={`${visibleLabel} — ${t.label}`}
      title={t.label}
      className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-600 transition hover:border-teal-400 hover:text-teal-700"
    >
      {visibleLabel}
    </button>
  );
}
