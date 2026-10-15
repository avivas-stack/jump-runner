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
    Functions: Record<string, never>;
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
  const { data, error } = await getClient().from("reports").select("report").eq("id", id).maybeSingle();
  if (error || !data) return null;
  const parsed = ReportSchema.safeParse(data.report);
  return parsed.success ? parsed.data : null;
}
