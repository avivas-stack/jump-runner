import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config, hasReportStorage } from "./config";
import type { FeedbackRequest } from "./types";

interface FeedbackDatabase {
  public: {
    Tables: {
      feedback_messages: {
        Row: { id: string; created_at: string; category: string; message: string; contact_email: string | null };
        Insert: { category: string; message: string; contact_email: string | null };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

let client: SupabaseClient<FeedbackDatabase> | null = null;

function getClient(): SupabaseClient<FeedbackDatabase> {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("אחסון פניות אינו מוגדר (SUPABASE_URL / SUPABASE_ANON_KEY)");
  }
  if (!client) {
    client = createClient<FeedbackDatabase>(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: false },
    });
  }
  return client;
}

/** Reuses the same Supabase project as reports — a separate table, no new credentials. */
export function hasFeedbackStorage(): boolean {
  return hasReportStorage();
}

export async function saveFeedback(feedback: FeedbackRequest): Promise<boolean> {
  if (!hasFeedbackStorage()) return false;
  try {
    const { error } = await getClient()
      .from("feedback_messages")
      .insert({ category: feedback.category, message: feedback.message, contact_email: feedback.contactEmail ?? null });
    if (error) {
      console.error("saveFeedback failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("saveFeedback failed:", err instanceof Error ? err.message : err);
    return false;
  }
}
