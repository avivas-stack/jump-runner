"use client";

import type { HistoryEntry } from "@/lib/clientHistory";

export function HistoryPanel({
  history,
  onSelect,
  onClear,
}: {
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onClear: () => void;
}) {
  if (history.length === 0) return null;

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-700">בדיקות אחרונות</h3>
        <button onClick={onClear} type="button" className="text-xs text-stone-400 hover:text-stone-600">
          נקה היסטוריה
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
