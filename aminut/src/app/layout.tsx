import type { Metadata } from "next";
import { Assistant } from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/siteConfig";

// Assistant: a Hebrew/Latin sans designed in the same clean, neutral "system UI" spirit
// as Segoe UI — the fallback for every visitor not on Windows (Segoe UI itself isn't a
// web font and can't be embedded/downloaded to other platforms).
const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["hebrew", "latin"],
});

const TITLE = `${SITE_NAME} — בדיקת מהימנות חדשות`;
const DESCRIPTION = "כלי לבדיקת טענות, כותרות ושמועות מול מקורות אמיתיים ברשת.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "he_IL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${assistant.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900">{children}</body>
    </html>
  );
}
