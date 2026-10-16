import type { Metadata } from "next";
import { Assistant } from "next/font/google";
import "./globals.css";

// Assistant: a Hebrew/Latin sans designed in the same clean, neutral "system UI" spirit
// as Segoe UI — the fallback for every visitor not on Windows (Segoe UI itself isn't a
// web font and can't be embedded/downloaded to other platforms).
const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: "אמינות — בדיקת מהימנות חדשות",
  description: "כלי לבדיקת טענות, כותרות ושמועות מול מקורות אמיתיים ברשת.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${assistant.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900">{children}</body>
    </html>
  );
}
