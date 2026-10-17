import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { config, hasFeedbackNotifications, hasReportStorage } from "./config";
import type { FeedbackCategory, FeedbackRequest } from "./types";

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  bug: "דיווח על באג / תקלה",
  privacy: "בקשה בנושא פרטיות",
  other: "פנייה אחרת",
};

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(config.resendApiKey);
  }
  return resendClient;
}

/**
 * Best-effort only — never throws and never blocks the feedback save. A missed
 * notification just means the sender has to check the feedback_messages table directly;
 * a failed save would lose the feedback entirely, which is the actual bad outcome.
 */
async function notifyNewFeedback(feedback: FeedbackRequest): Promise<void> {
  if (!hasFeedbackNotifications()) return;
  try {
    const { error } = await getResendClient().emails.send({
      from: "Facto <onboarding@resend.dev>",
      to: config.feedbackNotificationEmail!,
      subject: `${CATEGORY_LABEL[feedback.category]} — פנייה חדשה ב-Facto`,
      text: [
        `סוג: ${CATEGORY_LABEL[feedback.category]}`,
        feedback.contactEmail ? `אימייל לחזרה: ${feedback.contactEmail}` : null,
        "",
        feedback.message,
      ]
        .filter((line) => line !== null)
        .join("\n"),
    });
    if (error) {
      console.error("notifyNewFeedback failed:", error.message);
    }
  } catch (err) {
    console.error("notifyNewFeedback failed:", err instanceof Error ? err.message : err);
  }
}

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
    await notifyNewFeedback(feedback);
    return true;
  } catch (err) {
    console.error("saveFeedback failed:", err instanceof Error ? err.message : err);
    return false;
  }
}
