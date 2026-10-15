import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetCacheForTests,
  clearHistory,
  getHistorySnapshot,
  saveHistoryEntry,
  type HistoryEntry,
} from "./clientHistory";
import type { Report } from "./types";

const STORAGE_KEY = "aminut.history.v1";

const validReport: Report = {
  id: "r1",
  checkedAt: new Date().toISOString(),
  overallAssessment: "x",
  plainExplanation: ["point one"],
  claims: [],
  evaluations: [],
  evidence: [],
  limitations: [],
  openQuestions: [],
  searchesUsed: 1,
  searchBudget: 8,
  incomplete: false,
  incompleteReason: null,
};

const validEntry: HistoryEntry = {
  id: "r1",
  checkedAt: validReport.checkedAt,
  inputPreview: "טענה לדוגמה",
  overallAssessment: "x",
  report: validReport,
  shareUrl: null,
};

beforeEach(() => {
  localStorage.clear();
  _resetCacheForTests();
});

describe("getHistorySnapshot / computeHistory", () => {
  it("returns entries that match the current schema", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([validEntry]));
    expect(getHistorySnapshot()).toEqual([validEntry]);
  });

  it("silently drops an entry saved under an older app version (e.g. plainExplanation as a string, pre-bullet-points), instead of crashing", () => {
    const staleEntry = {
      ...validEntry,
      report: { ...validReport, plainExplanation: "a single paragraph, the old shape" },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([staleEntry, validEntry]));

    const result = getHistorySnapshot();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("r1");
  });

  it("returns an empty list (never throws) when localStorage contains garbage JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");
    expect(getHistorySnapshot()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: "an array" }));
    expect(getHistorySnapshot()).toEqual([]);
  });
});

describe("saveHistoryEntry / clearHistory", () => {
  it("persists and clears entries", () => {
    saveHistoryEntry(validEntry);
    expect(getHistorySnapshot()).toEqual([validEntry]);
    clearHistory();
    expect(getHistorySnapshot()).toEqual([]);
  });
});
