"use client";

import { useEffect, useRef, useState } from "react";

type A11yPrefs = {
  fontScale: number;
  contrast: boolean;
  grayscale: boolean;
  underlineLinks: boolean;
  noMotion: boolean;
};

const DEFAULT_PREFS: A11yPrefs = {
  fontScale: 100,
  contrast: false,
  grayscale: false,
  underlineLinks: false,
  noMotion: false,
};

const FONT_SCALE_STEPS = [100, 115, 130, 145];
export const A11Y_STORAGE_KEY = "facto-a11y-prefs";

/**
 * Mirrors applyPrefsToDocument below — kept as a string so layout.tsx can inline it as a
 * blocking pre-hydration script. Must stay dependency-free (runs before React/any module).
 */
export const A11Y_INLINE_BOOTSTRAP_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem(${JSON.stringify(A11Y_STORAGE_KEY)});
    if (!raw) return;
    var p = JSON.parse(raw);
    var root = document.documentElement;
    if (p.fontScale && p.fontScale !== 100) root.style.fontSize = p.fontScale + "%";
    if (p.contrast) root.classList.add("a11y-contrast");
    if (p.grayscale) root.classList.add("a11y-grayscale");
    if (p.underlineLinks) root.classList.add("a11y-underline-links");
    if (p.noMotion) root.classList.add("a11y-no-motion");
  } catch {}
})();
`;

function applyPrefsToDocument(prefs: A11yPrefs) {
  const root = document.documentElement;
  root.style.fontSize = prefs.fontScale === 100 ? "" : `${prefs.fontScale}%`;
  root.classList.toggle("a11y-contrast", prefs.contrast);
  root.classList.toggle("a11y-grayscale", prefs.grayscale);
  root.classList.toggle("a11y-underline-links", prefs.underlineLinks);
  root.classList.toggle("a11y-no-motion", prefs.noMotion);
}

function loadStoredPrefs(): A11yPrefs {
  try {
    const raw = localStorage.getItem(A11Y_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function AccessibilityWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [prefs, setPrefs] = useState<A11yPrefs>(DEFAULT_PREFS);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Mount-only sync from storage (normally redundant with the inline bootstrap script,
  // which already applied these to the DOM before hydration). Deliberately never writes
  // back here — see updatePrefs below for why a reactive write-on-change effect is the
  // wrong shape for this.
  useEffect(() => {
    const loaded = loadStoredPrefs();
    setPrefs(loaded);
    applyPrefsToDocument(loaded);
  }, []);

  useEffect(() => {
    applyPrefsToDocument(prefs);
  }, [prefs]);

  /**
   * The only path that writes to storage — only ever called from a user action (the
   * toggles/buttons below), never automatically from an effect. A write effect keyed on
   * `prefs` would also fire for the initial default state on mount (before the load
   * effect's result lands), racing the read above and clobbering a saved preference back
   * to the default under React's dev-mode double-invoked effects.
   */
  const updatePrefs = (updater: A11yPrefs | ((prev: A11yPrefs) => A11yPrefs)) => {
    setPrefs((prev) => {
      const next = typeof updater === "function" ? (updater as (p: A11yPrefs) => A11yPrefs)(prev) : updater;
      try {
        localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && e.target !== buttonRef.current) {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const cycleFontScale = (direction: 1 | -1) => {
    updatePrefs((prev) => {
      const currentIndex = FONT_SCALE_STEPS.indexOf(prev.fontScale);
      const nextIndex = Math.min(FONT_SCALE_STEPS.length - 1, Math.max(0, currentIndex + direction));
      return { ...prev, fontScale: FONT_SCALE_STEPS[nextIndex] };
    });
  };

  const toggle = (key: keyof Omit<A11yPrefs, "fontScale">) => {
    updatePrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const reset = () => updatePrefs(DEFAULT_PREFS);

  return (
    <div className="fixed bottom-4 start-4 z-50">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="אפשרויות נגישות"
        title="נגישות"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-700 text-white shadow-lg ring-2 ring-white transition hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-900"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7" aria-hidden="true">
          <circle cx="12" cy="4" r="2" />
          <path d="M12 7c-2.8 0-6.3.7-6.3 2.3 0 .8.7 1.3 1.5 1.1 1.2-.3 2.7-.5 3.8-.6l-1 3.3-3.2 3.9c-.5.6-.4 1.5.2 2 .6.5 1.5.4 2-.2l2.7-3.3h.6l2.7 3.3c.5.6 1.4.7 2 .2.6-.5.7-1.4.2-2l-3.2-3.9-1-3.3c1.1.1 2.6.3 3.8.6.8.2 1.5-.3 1.5-1.1C18.3 7.7 14.8 7 12 7z" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="תפריט נגישות"
          className="absolute bottom-16 start-0 w-72 rounded-lg border border-stone-200 bg-white p-4 shadow-xl"
        >
          <h2 className="mb-3 text-sm font-bold text-stone-900">נגישות</h2>

          <div className="mb-3">
            <span className="mb-1 block text-xs font-medium text-stone-600">גודל טקסט</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => cycleFontScale(-1)}
                disabled={prefs.fontScale === FONT_SCALE_STEPS[0]}
                aria-label="הקטן טקסט"
                className="h-8 w-8 rounded-md border border-stone-300 text-sm font-bold hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                א-
              </button>
              <span className="min-w-10 text-center text-xs text-stone-500">{prefs.fontScale}%</span>
              <button
                type="button"
                onClick={() => cycleFontScale(1)}
                disabled={prefs.fontScale === FONT_SCALE_STEPS[FONT_SCALE_STEPS.length - 1]}
                aria-label="הגדל טקסט"
                className="h-8 w-8 rounded-md border border-stone-300 text-sm font-bold hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                א+
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <ToggleRow label="ניגודיות גבוהה" checked={prefs.contrast} onChange={() => toggle("contrast")} />
            <ToggleRow label="גווני אפור" checked={prefs.grayscale} onChange={() => toggle("grayscale")} />
            <ToggleRow label="הדגשת קישורים" checked={prefs.underlineLinks} onChange={() => toggle("underlineLinks")} />
            <ToggleRow label="עצירת אנימציות" checked={prefs.noMotion} onChange={() => toggle("noMotion")} />
          </div>

          <button
            type="button"
            onClick={reset}
            className="mt-3 w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
          >
            איפוס הגדרות נגישות
          </button>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-md px-1 py-1 text-sm text-stone-700 hover:bg-stone-50">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-teal-700"
      />
    </label>
  );
}
