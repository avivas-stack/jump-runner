"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import type { FeedbackCategory } from "@/lib/types";
import { SITE_NAME } from "@/lib/siteConfig";

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  bug: "דיווח על באג / תקלה",
  privacy: "בקשה בנושא פרטיות (כולל הסרת דוח)",
  other: "פנייה אחרת",
};

export default function ContactPage() {
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message: message.trim(), contactEmail: contactEmail.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "שליחת הפנייה נכשלה");
      }
      setStatus("sent");
      setMessage("");
      setContactEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שליחת הפנייה נכשלה. נסו שוב.");
      setStatus("error");
    }
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-8 border-b-2 border-stone-900 pb-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2 font-serif text-3xl font-bold text-stone-900 sm:text-4xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" aria-hidden className="h-7 w-7 sm:h-8 sm:w-8" />
          {SITE_NAME}
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-stone-700">יצירת קשר</h1>
      </header>

      <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        {status === "sent" ? (
          <div className="text-center">
            <p className="text-stone-700">הפנייה נשלחה, תודה! נטפל בה בהקדם.</p>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="mt-4 text-sm font-medium text-teal-700 underline"
            >
              שליחת פנייה נוספת
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="category" className="mb-1 block text-sm font-medium text-stone-700">
                סוג הפנייה
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                className="w-full rounded-md border border-stone-300 bg-white p-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                {(Object.keys(CATEGORY_LABEL) as FeedbackCategory[]).map((key) => (
                  <option key={key} value={key}>
                    {CATEGORY_LABEL[key]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="message" className="mb-1 block text-sm font-medium text-stone-700">
                תוכן הפנייה
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={4000}
                rows={6}
                required
                placeholder={
                  category === "bug"
                    ? "מה קרה? אילו שלבים הובילו לכך? (אם אפשר, גם מה ציפית שיקרה)"
                    : category === "privacy"
                      ? "אם מדובר בבקשה להסרת דוח, נא לצרף את הקישור לדוח"
                      : "איך אפשר לעזור?"
                }
                className="w-full resize-none rounded-md border border-stone-300 p-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>

            <div>
              <label htmlFor="contact-email" className="mb-1 block text-sm font-medium text-stone-700">
                אימייל לחזרה אליך (לא חובה)
              </label>
              <input
                id="contact-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                maxLength={200}
                placeholder="your@email.com"
                dir="ltr"
                className="w-full rounded-md border border-stone-300 p-3 text-start text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={status === "loading" || !message.trim()}
              className="w-full rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {status === "loading" ? "שולח..." : "שליחה"}
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-sm">
        <Link href="/" className="font-medium text-teal-700 underline">
          חזרה לדף הבית
        </Link>
      </p>
    </main>
  );
}
