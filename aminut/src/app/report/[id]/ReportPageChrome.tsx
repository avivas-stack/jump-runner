"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/LanguageContext";

/**
 * Small translated chrome pieces for the otherwise server-rendered shared-report page
 * (data fetching, Suspense and the ClaimReview JSON-LD must stay server-side, so only
 * these static bits are pulled out into their own client components).
 */
export function SharedReportSubtitle() {
  const t = useTranslation("reportPage");
  return <p className="mt-2 text-sm text-stone-600">{t.sharedReportLabel}</p>;
}

export function ReportNotFoundMessage() {
  const t = useTranslation("reportPage");
  return (
    <div className="text-center">
      <h1 className="text-xl font-semibold text-stone-900">{t.notFoundTitle}</h1>
      <p className="mt-2 text-sm text-stone-600">{t.notFoundBody}</p>
    </div>
  );
}

export function BackToHomeLink() {
  const t = useTranslation("reportPage");
  return (
    <Link href="/" className="font-medium text-teal-700 underline">
      {t.backToHome}
    </Link>
  );
}
