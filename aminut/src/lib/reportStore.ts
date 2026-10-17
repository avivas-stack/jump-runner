import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config, hasReportStorage } from "./config";
import { Report, ReportSchema } from "./types";

interface ReportsDatabase {
  public: {
    Tables: {
      reports: {
        Row: { id: string; created_at: string; report: Report };
        Insert: { id: string; report: Report };
        Update: { id?: string; report?: Report };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      // A SECURITY DEFINER RPC, not a direct table select — see the
      // scope_report_reads_to_single_id_rpc migration for why: it returns only the one
      // row matching p_id, so the anon role never has standing `select *` access to the
      // whole table even if its key leaked.
      get_report_by_id: {
        Args: { p_id: string };
        Returns: Report | null;
      };
    };
  };
}

let client: SupabaseClient<ReportsDatabase> | null = null;

function getClient(): SupabaseClient<ReportsDatabase> {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("אחסון הדוחות אינו מוגדר (SUPABASE_URL / SUPABASE_ANON_KEY)");
  }
  if (!client) {
    client = createClient<ReportsDatabase>(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: false },
    });
  }
  return client;
}

/**
 * Persists a report so it can be opened later via a shareable permalink. Best-effort:
 * if storage isn't configured or the write fails, verification itself must still
 * succeed — a report that can't be shared is still a valid report.
 */
export async function saveReport(report: Report): Promise<void> {
  if (!hasReportStorage()) return;
  try {
    const { error } = await getClient().from("reports").insert({ id: report.id, report });
    if (error) {
      console.error("saveReport failed:", error.message);
    }
  } catch (err) {
    console.error("saveReport failed:", err instanceof Error ? err.message : err);
  }
}

export async function getReportById(id: string): Promise<Report | null> {
  if (!hasReportStorage()) return null;
  const { data, error } = await getClient().rpc("get_report_by_id", { p_id: id });
  if (error || !data) return null;
  const parsed = ReportSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
