"use client";

import type { Report } from "@/lib/types";
import { HowItWorksModal } from "./HowItWorksModal";
import { ClaimCard } from "./ReportView.claimcard";
import {
  ClaimComparisonTable,
  CopyShareLinkButton,
  CopySummaryButton,
  FactCheckerSitesSection,
  SourceList,
  formatDate,
} from "./ReportView.helpers";
import { VerdictHero } from "./ReportView.verdict";

export function ReportView({
  report,
  shareUrl = null,
  onNewCheck,
}: {
  report: Report;
  shareUrl?: string | null;
  onNewCheck?: () => void;
}) {
  return (
    <div className="space-y-6">
      {onNewCheck && (
        <button
          type="button"
          onClick={onNewCheck}
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
        >
          + בדיקה חדשה
        </button>
      )}

      {report.incomplete && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong className="font-semibold">בדיקה חלקית: </strong>
          {report.incompleteReason ?? "לא כל המידע הדרוש היה זמין."} התוצאה אינה בדיקת עובדות מלאה.
        </div>
      )}

      {report.claims.length > 0 && (
        <div className="space-y-2 text-center">
          <VerdictHero report={report} />
          <HowItWorksModal />
        </div>
      )}

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">הערכה כוללת</h2>
            <p className="mt-2 text-stone-700">{report.overallAssessment}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <CopySummaryButton report={report} />
            {shareUrl && <CopyShareLinkButton shareUrl={shareUrl} />}
          </div>
        </div>
        {report.plainExplanation.length > 0 && (
          <ul className="mt-4 list-inside list-disc space-y-1.5 text-sm leading-relaxed text-stone-600">
            {report.plainExplanation.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-stone-400">
          מבוסס על המקורות שנמצאו נכון ל-{formatDate(report.checkedAt)}. ייתכנו טעויות בבדיקה, ולכן יש להפעיל ביקורת
          ושיקול דעת.
        </p>
      </section>

      {report.claims.length > 1 && <ClaimComparisonTable report={report} />}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-stone-900">טענות שחולצו</h2>
        {report.claims.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-500">
            לא זוהו טענות עובדתיות הניתנות לבדיקה בטקסט שסופק.
          </p>
        ) : (
          report.claims.map((claim) => {
            const evaluation = report.evaluations.find((e) => e.claimId === claim.id);
            const evidence = report.evidence.filter((e) => e.claimId === claim.id);
            return evaluation ? (
              <ClaimCard key={claim.id} claim={claim} evaluation={evaluation} evidence={evidence} />
            ) : null;
          })
        )}
      </section>

      <FactCheckerSitesSection report={report} />

      {report.evidence.length > 0 && (
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-900">כל המקורות</h2>
          <SourceList evidence={report.evidence} />
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-stone-900">מגבלות הבדיקה</h3>
          {report.limitations.length ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-stone-600">
              {report.limitations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-stone-400">לא דווחו מגבלות נוספות.</p>
          )}
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-stone-900">שאלות פתוחות</h3>
          {report.openQuestions.length ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-stone-600">
              {report.openQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-stone-400">אין שאלות פתוחות נוספות.</p>
          )}
        </div>
      </section>

      <p className="text-center text-xs text-stone-400">נבדק ב-{formatDate(report.checkedAt)}</p>
    </div>
  );
}


