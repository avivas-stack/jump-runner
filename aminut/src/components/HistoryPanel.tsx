"use client";

import type { HistoryEntry } from "@/lib/clientHistory";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export function HistoryPanel({
  history,
  onSelect,
  onClear,
}: {
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onClear: () => void;
}) {
  const t = useTranslation("historyPanel");
  if (history.length === 0) return null;

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-700">{t.recentChecksTitle}</h3>
        <button onClick={onClear} type="button" className="text-xs text-stone-600 hover:text-stone-900">
          {t.clearHistoryButton}
        </button>
      </div>
      <ul className="mt-2 space-y-1">
        {history.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => onSelect(entry)}
              className="w-full truncate rounded-lg px-2 py-1.5 text-start text-sm text-stone-600 hover:bg-stone-50"
              title={entry.inputPreview}
            >
              {entry.inputPreview}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
