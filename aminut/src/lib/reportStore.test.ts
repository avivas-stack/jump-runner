import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Report } from "./types";

const configMock = vi.hoisted(() => ({
  config: { supabaseUrl: undefined as string | undefined, supabaseAnonKey: undefined as string | undefined },
  hasReportStorage: vi.fn(),
}));
vi.mock("./config", () => configMock);

const insertMock = vi.hoisted(() => vi.fn());
const maybeSingleMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() =>
  vi.fn(() => ({
    from: vi.fn(() => ({
      insert: insertMock,
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })) })),
    })),
  }))
);
vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));

const { saveReport, getReportById } = await import("./reportStore");

const report: Report = {
  id: "r1",
  checkedAt: new Date().toISOString(),
  overallAssessment: "x",
  plainExplanation: ["y"],
  claims: [],
  evaluations: [],
  evidence: [],
  limitations: [],
  openQuestions: [],
  searchesUsed: 0,
  searchBudget: 8,
  incomplete: false,
  incompleteReason: null,
};

beforeEach(() => {
  insertMock.mockReset().mockResolvedValue({ error: null });
  maybeSingleMock.mockReset();
  createClientMock.mockClear();
  configMock.hasReportStorage.mockReturnValue(false);
  configMock.config.supabaseUrl = undefined;
  configMock.config.supabaseAnonKey = undefined;
});

describe("saveReport", () => {
  it("is a no-op when report storage isn't configured (never throws)", async () => {
    await expect(saveReport(report)).resolves.toBeUndefined();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("inserts the report keyed by its own id when storage is configured", async () => {
    configMock.hasReportStorage.mockReturnValue(true);
    configMock.config.supabaseUrl = "https://x.supabase.co";
    configMock.config.supabaseAnonKey = "anon-key";

    await saveReport(report);
    expect(insertMock).toHaveBeenCalledWith({ id: "r1", report });
  });

  it("swallows a failed insert rather than breaking verification", async () => {
    configMock.hasReportStorage.mockReturnValue(true);
    configMock.config.supabaseUrl = "https://x.supabase.co";
    configMock.config.supabaseAnonKey = "anon-key";
    insertMock.mockResolvedValue({ error: { message: "db down" } });

    await expect(saveReport(report)).resolves.toBeUndefined();
  });
});

describe("getReportById", () => {
  it("returns null when report storage isn't configured", async () => {
    expect(await getReportById("r1")).toBeNull();
  });

  it("returns null when the row isn't found", async () => {
    configMock.hasReportStorage.mockReturnValue(true);
    configMock.config.supabaseUrl = "https://x.supabase.co";
    configMock.config.supabaseAnonKey = "anon-key";
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    expect(await getReportById("missing")).toBeNull();
  });

  it("returns null (never a half-valid report) when the stored JSON fails schema validation", async () => {
    configMock.hasReportStorage.mockReturnValue(true);
    configMock.config.supabaseUrl = "https://x.supabase.co";
    configMock.config.supabaseAnonKey = "anon-key";
    maybeSingleMock.mockResolvedValue({ data: { report: { not: "a valid report" } }, error: null });

    expect(await getReportById("r1")).toBeNull();
  });

  it("returns the parsed report on a valid row", async () => {
    configMock.hasReportStorage.mockReturnValue(true);
    configMock.config.supabaseUrl = "https://x.supabase.co";
    configMock.config.supabaseAnonKey = "anon-key";
    maybeSingleMock.mockResolvedValue({ data: { report }, error: null });

    expect(await getReportById("r1")).toEqual(report);
  });
});
