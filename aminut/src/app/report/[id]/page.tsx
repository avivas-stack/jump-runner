import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getReportById } from "@/lib/reportStore";
import { ReportView } from "@/components/ReportView";

export const metadata: Metadata = {
  title: "דוח בדיקת מהימנות — אמינות",
};

async function ReportContent({ params }: { params: PageProps<"/report/[id]">["params"] }) {
  const { id } = await params;
  const report = await getReportById(id);

  if (!report) {
    return (
      <div className="text-center">
        <h1 className="text-xl font-semibold text-stone-900">הדוח לא נמצא</h1>
        <p className="mt-2 text-sm text-stone-600">
          ייתכן שהקישור שגוי, שהדוח נמחק, או שאחסון דוחות אינו מוגדר בסביבה זו.
        </p>
      </div>
    );
  }

  return <ReportView report={report} shareUrl={`/report/${id}`} />;
}

function ReportSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <div className="h-24 animate-pulse rounded-2xl bg-stone-100" />
      <div className="h-40 animate-pulse rounded-2xl bg-stone-100" />
      <div className="h-40 animate-pulse rounded-2xl bg-stone-100" />
    </div>
  );
}

export default function SharedReportPage({ params }: PageProps<"/report/[id]">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-6 text-center">
        <Link href="/" className="text-2xl font-bold text-stone-900 sm:text-3xl">
          אמינות
        </Link>
        <p className="mt-2 text-sm text-stone-600">דוח בדיקה משותף</p>
      </header>
      <Suspense fallback={<ReportSkeleton />}>
        <ReportContent params={params} />
      </Suspense>
      <p className="mt-6 text-center text-sm">
        <Link href="/" className="font-medium text-teal-700 underline">
          חזרה לדף הבית
        </Link>
      </p>
    </main>
  );
}
