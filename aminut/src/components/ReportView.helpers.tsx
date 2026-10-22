"use client";

import { useState } from "react";
import type { EvidenceItem, ExtractedClaim, Report } from "@/lib/types";
import { SITE_NAME } from "@/lib/siteConfig";
import { ClassificationBadge, RECOMMENDATION_TONE, RecommendationNote } from "./ClassificationBadge";
import { useLanguage, useTranslation } from "@/lib/i18n/LanguageContext";
import type { Language } from "@/lib/i18n/LanguageContext";

export function ClaimComparisonTable({ report }: { report: Report }) {
  const t = useTranslation("report");
  const classifications = useTranslation("classifications");
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
    <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-lg font-bold text-stone-900">{t.comparisonTitle}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-start text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-xs text-stone-500">
              <th className="py-2 pe-2 font-medium">{t.comparisonHeaders.index}</th>
              <th className="py-2 pe-2 font-medium">{t.comparisonHeaders.claim}</th>
              <th className="py-2 pe-2 font-medium">{t.comparisonHeaders.classification}</th>
              <th className="py-2 pe-2 font-medium">{t.comparisonHeaders.confidence}</th>
              <th className="py-2 font-medium">{t.comparisonHeaders.recommendation}</th>
            </tr>
          </thead>
          <tbody>
            {report.claims.map((claim, i) => {
              const evaluation = report.evaluations.find((e) => e.claimId === claim.id);
              if (!evaluation) return null;
              return (
                <tr key={claim.id} className="border-b border-stone-100 last:border-0">
                  <td className="py-2 pe-2 align-top text-stone-600">{i + 1}</td>
                  <td className="py-2 pe-2 align-top">
                    <a href={`#claim-${claim.id}`} className="text-stone-700 underline-offset-2 hover:underline">
                      {truncate(claim.originalText, 60)}
                    </a>
                  </td>
                  <td className="py-2 pe-2 align-top">
                    <ClassificationBadge classification={evaluation.classification} />
                  </td>
                  <td className="py-2 pe-2 align-top text-xs text-stone-500">
                    {classifications.confidenceShort[evaluation.confidence]}
                  </td>
                  <td className="py-2 align-top">
                    <RecommendationNote classification={evaluation.classification} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sharedSourceCount > 0 && (
        <p className="mt-3 text-xs text-stone-500">
          {sharedSourceCount === 1
            ? t.sharedSourceSingular
            : `${sharedSourceCount} ${t.sharedSourcePluralSuffix}`}
        </p>
      )}
    </section>
  );
}

/**
 * Surfaces evidence the pipeline already retrieved from known independent
 * fact-checking sites (see FACT_CHECKER_HOSTS in evidenceRegistry.ts) in its own
 * highlighted section, grouped by claim — instead of scraping those sites
 * separately. Renders nothing when no such evidence was found for this report.
 */
export function FactCheckerSitesSection({ report }: { report: Report }) {
  const t = useTranslation("report");
  const byClaim = new Map<string, EvidenceItem[]>();
  for (const item of report.evidence) {
    if (item.sourceType !== "fact-checker") continue;
    const list = byClaim.get(item.claimId) ?? [];
    list.push(item);
    byClaim.set(item.claimId, list);
  }
  if (byClaim.size === 0) return null;

  return (
    <section className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-6 shadow-sm">
      <h2 className="font-serif text-lg font-bold text-stone-900">{t.factCheckerSitesTitle}</h2>
      <p className="mt-1 text-xs text-stone-500">
        {t.factCheckerDescPart1}
        <span dir="ltr">fakereporter.net</span>
        {t.factCheckerDescPart2}
        <span dir="ltr">irrelevant.org.il</span>
        {t.factCheckerDescPart3}
      </p>
      <div className="mt-4 space-y-4">
        {report.claims.map((claim) => {
          const items = byClaim.get(claim.id);
          if (!items || items.length === 0) return null;
          return (
            <div key={claim.id} className="rounded-md border border-indigo-100 bg-white p-4">
              <p className="text-sm font-medium text-stone-800">{truncate(claim.originalText, 100)}</p>
              <ul className="mt-2 space-y-2">
                {items.map((e) => (
                  <li key={e.id} className="text-sm">
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="font-medium text-indigo-700 underline-offset-2 hover:underline"
                    >
                      {e.title || e.url}
                    </a>
                    <span className="ms-1 text-xs text-stone-600">
                      {e.publisher ? `· ${e.publisher}` : ""}
                      {e.publicationDate ? ` · ${e.publicationDate}` : ""}
                    </span>
                    {e.excerpt && <p className="mt-0.5 text-xs text-stone-600">{truncate(e.excerpt, 200)}</p>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function SourceList({ evidence }: { evidence: EvidenceItem[] }) {
  const t = useTranslation("report");
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
          <span className="text-xs text-stone-600">
            {sourceTypeLabel(e.sourceType, t.sourceTypeLabel)}
            {e.publicationDate ? ` · ${e.publicationDate}` : ""}
            {!e.accessible ? ` · ${t.inaccessibleLabel} (${e.inaccessibleReason ?? t.unknownReason})` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CopySummaryButton({ report }: { report: Report }) {
  const t = useTranslation("report");
  const { language } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const summary = buildPlainTextSummary(report, t, language);
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
      {copied ? t.copied : t.copySummary}
    </button>
  );
}

export function CopyShareLinkButton({ shareUrl }: { shareUrl: string }) {
  const t = useTranslation("report");
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
      {copied ? t.linkCopied : t.copyShareLink}
    </button>
  );
}

const TONE_EMOJI: Record<"share" | "caution" | "block", string> = {
  share: "✅",
  caution: "⚠️",
  block: "❌",
};

/**
 * A WhatsApp-ready share button — opens wa.me with a short, pre-filled "certificate"-style
 * message (one verdict line, one recommendation line, a link back to the full report) for
 * forwarding into a chat, the way a VirusTotal scan result gets pasted around as proof of
 * a check. Deliberately NOT the same text as CopySummaryButton, which is the full,
 * multi-paragraph breakdown — this is the opposite: as short as the verdict allows.
 * Only rendered when a shareUrl exists (see ReportView.tsx) — a "look what I checked"
 * message is only worth sending with a real link to back it up.
 */
export function ShareWhatsAppButton({ report, shareUrl }: { report: Report; shareUrl: string }) {
  const t = useTranslation("report");
  const classifications = useTranslation("classifications");
  const overallClassification = report.overallClassification ?? report.evaluations[0]?.classification;
  if (!overallClassification) return null;

  const fullUrl = `${window.location.origin}${shareUrl}`;
  const tone = RECOMMENDATION_TONE[overallClassification];
  const message = [
    `${TONE_EMOJI[tone]} ${t.whatsappVerdictPrefix}${classifications.label[overallClassification]}`,
    classifications.recommendation[overallClassification],
    "",
    `${t.whatsappLinkPrefix}${fullUrl}`,
  ].join("\n");

  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
    >
      {t.shareOnWhatsApp}
    </a>
  );
}

function buildPlainTextSummary(
  report: Report,
  t: ReturnType<typeof useTranslation<"report">>,
  language: Language
): string {
  const lines = [
    `${SITE_NAME} — ${t.summaryTitleSuffix} (${formatDate(report.checkedAt, language)})`,
    "",
    report.overallAssessment,
    "",
    ...report.plainExplanation.map((point) => `• ${point}`),
    "",
    ...report.claims.map((claim) => {
      const ev = report.evaluations.find((e) => e.claimId === claim.id);
      return `• "${claim.originalText}" — ${ev?.classification ?? t.notEvaluated}`;
    }),
  ];
  return lines.join("\n");
}

export function claimTypeLabel(
  type: ExtractedClaim["claimType"],
  labels: Record<ExtractedClaim["claimType"], string>
): string {
  return labels[type];
}

export function sourceTypeLabel(
  type: EvidenceItem["sourceType"],
  labels: Record<EvidenceItem["sourceType"], string>
): string {
  return labels[type];
}

export function formatDate(iso: string, language: Language = "he"): string {
  try {
    return language === "en"
      ? new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
      : new Date(iso).toLocaleString("he-IL", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}
