"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ClaimForm } from "@/components/ClaimForm";
import { HowItWorksModal } from "@/components/HowItWorksModal";
import { Sidebar } from "@/components/Sidebar";
import { LoadingStages } from "@/components/LoadingStages";
import { ReportView } from "@/components/ReportView";
import { HistoryPanel } from "@/components/HistoryPanel";
import { AiImageDetector } from "@/components/AiImageDetector";
import { useVerifyPipeline } from "@/hooks/useVerifyPipeline";
import {
  clearHistory,
  getHistorySnapshot,
  getServerHistorySnapshot,
  saveHistoryEntry,
  subscribeHistory,
} from "@/lib/clientHistory";
import type { Report, VerifyRequest } from "@/lib/types";

const STEPS = [
  { icon: "✍️", text: "מדביקים טענה, קישור או צילום מסך" },
  { icon: "🔎", text: "Facto בודק מול מקורות אמיתיים ברשת" },
  { icon: "📋", text: "מקבלים דוח ברור עם מקורות ורמת ביטחון" },
];

const BENEFITS = [
  {
    icon: "⏱️",
    title: "לפני שמעבירים הלאה",
    text: "קיבלתם משהו בוואטסאפ או בקבוצה? בדקו לפני שאתם משתפים אותו הלאה.",
  },
  {
    icon: "🔗",
    title: "לא ניחוש, מקורות",
    text: "כל תשובה מגיעה עם קישורים למקורות אמיתיים, כדי שתוכלו לבדוק בעצמכם.",
  },
  {
    icon: "🖼️",
    title: "גם לתמונות",
    text: "מזהה כשתמונה חשודה נוצרה או עובדה בעזרת AI.",
  },
  {
    icon: "⚡",
    title: "מהיר וחינמי",
    text: "בדיקה לוקחת כדקה, בלי הרשמה ובלי עלות.",
  },
];

export default function Home() {
  const { state, run, reset } = useVerifyPipeline();
  const history = useSyncExternalStore(subscribeHistory, getHistorySnapshot, getServerHistorySnapshot);
  const [hadUrl, setHadUrl] = useState(false);
  const [viewedReport, setViewedReport] = useState<Report | null>(null);
  const [viewedShareUrl, setViewedShareUrl] = useState<string | null>(null);
  const [claimText, setClaimText] = useState("");
  const [claimUrl, setClaimUrl] = useState("");
  const [activeTab, setActiveTab] = useState<"claims" | "aiImage">("claims");

  useEffect(() => {
    if (state.status === "done" && state.report) {
      saveHistoryEntry({
        id: state.report.id,
        checkedAt: state.report.checkedAt,
        inputPreview: state.report.claims[0]?.originalText ?? state.report.overallAssessment,
        overallAssessment: state.report.overallAssessment,
        report: state.report,
        shareUrl: state.shareUrl,
      });
    }
  }, [state.status, state.report, state.shareUrl]);

  const handleSubmit = (input: VerifyRequest) => {
    setHadUrl(Boolean(input.url));
    setViewedReport(null);
    setViewedShareUrl(null);
    run(input);
  };

  const displayedReport = viewedReport ?? state.report;
  const displayedShareUrl = viewedReport ? viewedShareUrl : state.shareUrl;
  const showForm = state.status === "idle" && !displayedReport;

  const startNewCheck = () => {
    reset();
    setViewedReport(null);
    setViewedShareUrl(null);
    setClaimText("");
    setClaimUrl("");
  };

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-8 border-b-2 border-stone-900 pb-6 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-stone-500 uppercase">כלי לבדיקת מהימנות</p>
        <div className="mt-1 flex items-center justify-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" aria-hidden className="h-9 w-9" />
          <h1 className="font-serif text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">Facto</h1>
        </div>
        <p className="mt-2 text-sm text-stone-600">
          בודקים טענות, כותרות ושמועות מול מקורות אמיתיים — לפני שמאמינים.
        </p>
        {showForm && activeTab === "claims" && (
          <>
            <ul className="mx-auto mt-5 flex max-w-xl flex-col gap-2 text-start text-xs text-stone-500 sm:flex-row sm:items-start sm:justify-center sm:gap-4 sm:text-center">
              {STEPS.map((step, i) => (
                <li key={i} className="flex items-center gap-2 sm:flex-col sm:gap-1">
                  <span aria-hidden className="text-base">
                    {step.icon}
                  </span>
                  <span>{step.text}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <HowItWorksModal />
            </div>
          </>
        )}

        <div className="mx-auto mt-6 flex max-w-xs gap-2 rounded-md border border-stone-200 bg-white p-1 text-sm">
          <button
            type="button"
            onClick={() => setActiveTab("claims")}
            className={`flex-1 rounded-lg px-3 py-1.5 font-medium transition ${
              activeTab === "claims" ? "bg-teal-700 text-white" : "text-stone-600 hover:bg-stone-50"
            }`}
          >
            בדיקת טענות
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("aiImage")}
            className={`flex-1 rounded-lg px-3 py-1.5 font-medium transition ${
              activeTab === "aiImage" ? "bg-teal-700 text-white" : "text-stone-600 hover:bg-stone-50"
            }`}
          >
            זיהוי AI בתמונה
          </button>
        </div>
      </header>

      {showForm && (
        <section className="mx-auto mb-8 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
          {BENEFITS.map((benefit) => (
            <div
              key={benefit.title}
              className="rounded-lg border border-stone-200 bg-white p-4 text-center shadow-sm"
            >
              <span aria-hidden className="text-xl">
                {benefit.icon}
              </span>
              <h3 className="mt-1.5 text-sm font-semibold text-stone-900">{benefit.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">{benefit.text}</p>
            </div>
          ))}
        </section>
      )}

      {activeTab === "aiImage" ? (
        <div className="mx-auto max-w-2xl">
          <AiImageDetector />
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <main className="min-w-0 flex-1 space-y-6 lg:order-2">
            {showForm && (
              <ClaimForm
                text={claimText}
                onTextChange={setClaimText}
                url={claimUrl}
                onUrlChange={setClaimUrl}
                disabled={false}
                onSubmit={handleSubmit}
              />
            )}

            {state.status === "running" && (
              <div className="space-y-4">
                <LoadingStages stage={state.stage} hasUrl={hadUrl} />
                <button
                  type="button"
                  onClick={reset}
                  className="w-full rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
                >
                  ביטול
                </button>
              </div>
            )}

            {state.status === "error" && state.error && (
              <div className="space-y-4">
                <div className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  <strong className="font-semibold">הבדיקה נכשלה: </strong>
                  {state.error.message}
                </div>
                <button
                  type="button"
                  onClick={reset}
                  className="w-full rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
                >
                  נסה שוב
                </button>
              </div>
            )}

            {displayedReport && state.status !== "running" && (
              <div className="space-y-4">
                <ReportView report={displayedReport} shareUrl={displayedShareUrl} onNewCheck={startNewCheck} />
                <button
                  type="button"
                  onClick={startNewCheck}
                  className="w-full rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
                >
                  + בדיקה חדשה
                </button>
              </div>
            )}

            {showForm && (
              <HistoryPanel
                history={history}
                onSelect={(entry) => {
                  setViewedReport(entry.report);
                  setViewedShareUrl(entry.shareUrl);
                }}
                onClear={clearHistory}
              />
            )}
          </main>

          {showForm && (
            <div className="lg:order-1">
              <Sidebar onSelectExample={setClaimText} disabled={false} />
            </div>
          )}
        </div>
      )}

      <footer className="mt-10 text-center text-xs text-stone-400">
        הכלי מספק עזרה לחשיבה ביקורתית בהתבסס על מקורות שנמצאו במועד הבדיקה.
        <br />
        ייתכנו טעויות בבדיקה, ולכן יש להפעיל ביקורת ושיקול דעת.
        <br />
        <Link href="/what-is-fake-news" className="underline hover:text-stone-600">
          מה זה פייק ניוז?
        </Link>
        {" · "}
        <Link href="/privacy" className="underline hover:text-stone-600">
          מדיניות פרטיות ותנאי שימוש
        </Link>
        {" · "}
        <Link href="/contact" className="underline hover:text-stone-600">
          יצירת קשר / דיווח על באג
        </Link>
      </footer>
    </div>
  );
}
