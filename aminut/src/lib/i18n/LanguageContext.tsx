"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { he } from "./dictionaries/he";
import { en } from "./dictionaries/en";

export type Language = "he" | "en";

// he.ts deliberately has no `as const` — every string/array leaf stays its general type
// (`string`, `{...}[]`), which is the actual shape that must match between languages.
// A literal-typed source (via `as const`) would make en.ts's different English strings
// fail `satisfies Dictionary` for having the "wrong" literal value, not a structural one.
export type Dictionary = typeof he;

export const LANGUAGE_STORAGE_KEY = "facto-language";

/**
 * Runs before hydration (inlined as a <script> in layout.tsx) so a returning visitor who
 * chose English never sees a flash of Hebrew/RTL before React takes over — mirrors the
 * accessibility widget's own bootstrap script for the same reason.
 */
export const LANGUAGE_INLINE_BOOTSTRAP_SCRIPT = `
(function () {
  try {
    var lang = localStorage.getItem(${JSON.stringify(LANGUAGE_STORAGE_KEY)});
    if (lang !== "en") return;
    var root = document.documentElement;
    root.lang = "en";
    root.dir = "ltr";
  } catch {}
})();
`;

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function applyLanguageToDocument(lang: Language) {
  document.documentElement.lang = lang === "en" ? "en" : "he";
  document.documentElement.dir = lang === "en" ? "ltr" : "rtl";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("he");

  // Mount-only sync from storage (normally redundant with the inline bootstrap script,
  // which already set the DOM before hydration — this is the fallback if that didn't
  // run). Deliberately never writes back: a write here, racing the read on every mount,
  // is what previously clobbered a stored "en" back to "he" under React's dev-mode
  // double-invoked effects. Only an explicit setLanguage/toggleLanguage call writes.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored === "en") {
        setLanguageState("en");
        applyLanguageToDocument("en");
      }
    } catch {}
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    applyLanguageToDocument(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {}
  };
  const toggleLanguage = () => setLanguage(language === "he" ? "en" : "he");

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

function useLanguageContext(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage/useTranslation must be used within a LanguageProvider");
  return ctx;
}

export function useLanguage() {
  const { language, setLanguage, toggleLanguage } = useLanguageContext();
  return { language, setLanguage, toggleLanguage };
}

/**
 * Returns only this namespace's slice of the current language's dictionary — e.g.
 * `useTranslation("claimForm")` returns `{ textLabel, textPlaceholder, ... }` typed
 * exactly from he.ts, so a component only ever touches its own strings.
 *
 * Dictionaries are plain in-memory objects (no network/async), so switching namespaces
 * never causes a loading state — this is purely a lookup, not a fetch.
 */
export function useTranslation<K extends keyof Dictionary>(namespace: K): Dictionary[K] {
  const { language } = useLanguageContext();
  const dict: Dictionary = language === "en" ? en : he;
  return dict[namespace];
}
