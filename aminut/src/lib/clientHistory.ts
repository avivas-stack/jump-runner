"use client";

import { z } from "zod";
import { ReportSchema, type Report } from "./types";

const STORAGE_KEY = "aminut.history.v1";
const MAX_ITEMS = 15;

export interface HistoryEntry {
  id: string;
  checkedAt: string;
  inputPreview: string;
  overallAssessment: string;
  report: Report;
  shareUrl: string | null;
}

const HistoryEntrySchema = z.object({
  id: z.string(),
  checkedAt: z.string(),
  inputPreview: z.string(),
  overallAssessment: z.string(),
  report: ReportSchema,
  shareUrl: z.string().nullable(),
});

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: HistoryEntry[] | null = null;
const EMPTY: HistoryEntry[] = [];

function computeHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Entries saved under an older app version (e.g. before plainExplanation became
    // an array of bullet points) would otherwise crash the report view on render.
    // Validate each one and silently drop anything that no longer matches the
    // current shape — losing a stale local-only history entry is harmless; crashing
    // the whole page when the user clicks it is not.
    const valid: HistoryEntry[] = [];
    for (const item of parsed) {
      const result = HistoryEntrySchema.safeParse(item);
      if (result.success) valid.push(result.data);
    }
    return valid;
  } catch {
    return [];
  }
}

function setCache(next: HistoryEntry[]) {
  cache = next;
  listeners.forEach((listener) => listener());
}

/** `useSyncExternalStore`-compatible subscribe function. */
export function subscribeHistory(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `useSyncExternalStore`-compatible client snapshot getter (stable reference until a write happens). */
export function getHistorySnapshot(): HistoryEntry[] {
  if (cache === null) cache = computeHistory();
  return cache;
}

/** `useSyncExternalStore`-compatible server snapshot getter — localStorage doesn't exist during SSR. */
export function getServerHistorySnapshot(): HistoryEntry[] {
  return EMPTY;
}

export function saveHistoryEntry(entry: HistoryEntry): void {
  const current = getHistorySnapshot();
  const next = [entry, ...current.filter((e) => e.id !== entry.id)].slice(0, MAX_ITEMS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // best-effort only, e.g. private browsing mode blocks storage
  }
  setCache(next);
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  setCache([]);
}

/** Test-only escape hatch: forces the next read to recompute from localStorage. */
export function _resetCacheForTests(): void {
  cache = null;
}
