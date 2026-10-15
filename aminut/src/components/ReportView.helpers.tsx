"use client";

import { useState } from "react";
import type { EvidenceItem, ExtractedClaim, Report } from "@/lib/types";
import { ClassificationBadge } from "./ClassificationBadge";

export function ClaimComparisonTable({ report }: { report: Report }) {
  // Sources cited for more than one claim — surfaces when two claims lean on the
  // same outlet/report, so a reader can spot a shared (not independent) basis at a glance.
  const urlToClaimIds = new Map<string, Set<string>>();
  for (const item of report.evidence) {
    const set = urlToClaimIds.get(item.url) ?? new Set<string>();
    set.add(item.claimId);
    urlToClaimIds.set(item.url, set);
  }
  const sharedSourceCount = Array.from(urlToClaimIds.values()).filter((s) => s.size > 1).length;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-900">השוואת טענות</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[420px] text-start text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-xs text-stone-500">
              <th className="py-2 pe-2 font-medium">#</th>
              <th className="py-2 pe-2 font-medium">טענה</th>
              <th className="py-2 pe-2 font-medium">סיווג</th>
              <th className="py-2 font-medium">ביטחון</th>
            </tr>
          </thead>
          <tbody>
            {report.claims.map((claim, i) => {
              const evaluation = report.evaluations.find((e) => e.claimId === claim.id);
              if (!evaluation) return null;
              return (
                <tr key={claim.id} className="border-b border-stone-100 last:border-0">
                  <td className="py-2 pe-2 align-top text-stone-400">{i + 1}</td>
                  <td className="py-2 pe-2 align-top">
                    <a href={`#claim-${claim.id}`} className="text-stone-700 underline-offset-2 hover:underline">
                      {truncate(claim.originalText, 60)}
                    </a>
                  </td>
                  <td className="py-2 pe-2 align-top">
                    <ClassificationBadge classification={evaluation.classification} />
                  </td>
                  <td className="py-2 align-top text-xs text-stone-500">{confidenceShortLabel(evaluation.confidence)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sharedSourceCount > 0 && (
        <p className="mt-3 text-xs text-stone-500">
          {sharedSourceCount === 1
            ? "מקור אחד שימש לבדיקת יותר מטענה אחת — לא בהכרח ראיה עצמאית נוספת לכל טענה."
            : `${sharedSourceCount} מקורות שימשו לבדיקת יותר מטענה אחת — לא בהכרח ראיה עצמאית נוספת לכל טענה.`}
        </p>
      )}
    </section>
  );
}

function confidenceShortLabel(confidence: Report["evaluations"][number]["confidence"]): string {
  return { low: "נמוך", medium: "בינוני", high: "גבוה" }[confidence];
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function SourceList({ evidence }: { evidence: EvidenceItem[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {evidence.map((e) => (
        <li key={e.id} className="flex flex-wrap items-baseline gap-2 text-sm">
          <a
            href={e.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="font-medium text-teal-700 underline-offset-2 hover:underline"
          >
            {e.title || e.url}
          </a>
          <span className="text-xs text-stone-400">
            {sourceTypeLabel(e.sourceType)}
            {e.publicationDate ? ` · ${e.publicationDate}` : ""}
            {!e.accessible ? ` · לא נגיש (${e.inaccessibleReason ?? "לא ידוע"})` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CopySummaryButton({ report }: { report: Report }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const summary = buildPlainTextSummary(report);
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — fail silently, nothing to retry.
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className="shrink-0 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
    >
      {copied ? "הועתק ✓" : "העתק סיכום"}
    </button>
  );
}

export function CopyShareLinkButton({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const fullUrl = `${window.location.origin}${shareUrl}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — fail silently, nothing to retry.
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className="shrink-0 rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
    >
      {copied ? "הקישור הועתק ✓" : "העתק קישור לשיתוף"}
    </button>
  );
}

function buildPlainTextSummary(report: Report): string {
  const lines = [
    `אמינות — סיכום בדיקה (${formatDate(report.checkedAt)})`,
    "",
    report.overallAssessment,
    "",
    ...report.plainExplanation.map((point) => `• ${point}`),
    "",
    ...report.claims.map((claim) => {
      const ev = report.evaluations.find((e) => e.claimId === claim.id);
      return `• "${claim.originalText}" — ${ev?.classification ?? "לא הוערך"}`;
    }),
  ];
  return lines.join("\n");
}

export function claimTypeLabel(type: ExtractedClaim["claimType"]): string {
  return {
    factual: "טענה עובדתית",
    interpretive: "פרשנות",
    predictive: "תחזית",
    satirical: "סאטירה",
    opinion: "דעה",
  }[type];
}

export function sourceTypeLabel(type: EvidenceItem["sourceType"]): string {
  return {
    primary: "מקור ראשוני",
    official: "מסמך רשמי",
    news: "כתבת חדשות",
    "fact-checker": "ארגון בודק עובדות",
    opinion: "דעה",
    other: "אחר",
  }[type];
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("he-IL", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}
