import type { Metadata } from "next";
import { Heebo, Frank_Ruhl_Libre } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

const frankRuhlLibre = Frank_Ruhl_Libre({
  variable: "--font-serif",
  subsets: ["hebrew", "latin"],
  weight: ["500", "700", "900"],
});

export const metadata: Metadata = {
  title: "אמינות — בדיקת מהימנות חדשות",
  description: "כלי לבדיקת טענות, כותרות ושמועות מול מקורות אמיתיים ברשת.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${frankRuhlLibre.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900">{children}</body>
    </html>
  );
}
