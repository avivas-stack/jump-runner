"use client";

import { useState } from "react";
import type { EvidenceItem, ExtractedClaim, Report } from "@/lib/types";
import { ClassificationBadge, ConfidenceNote, RecommendationNote } from "./ClassificationBadge";
import { claimTypeLabel, sourceTypeLabel } from "./ReportView.helpers";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export function ClaimCard({
  claim,
  evaluation,
  evidence,
  partial = false,
}: {
  claim: ExtractedClaim;
  evaluation: Report["evaluations"][number];
  evidence: EvidenceItem[];
  /** See ClassificationBadge's own `partial` prop — forwarded from ReportView.tsx. */
  partial?: boolean;
}) {
  const t = useTranslation("report");
  const tCard = useTranslation("reportClaimCard");
  const supporting = evidence.filter((e) => evaluation.supportingEvidenceIds.includes(e.id));
  const contradicting = evidence.filter((e) => evaluation.contradictingEvidenceIds.includes(e.id));

  return (
    <article id={`claim-${claim.id}`} className="scroll-mt-4 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ClassificationBadge classification={evaluation.classification} partial={partial} />
        <span className="text-xs text-stone-600">{claimTypeLabel(claim.claimType, t.claimTypeLabel)}</span>
      </div>
      <RecommendationNote classification={evaluation.classification} />
      <p className="mt-3 font-medium text-stone-900">&ldquo;{claim.originalText}&rdquo;</p>
      <ConfidenceNote confidence={evaluation.confidence} />
      <p className="mt-3 text-sm leading-relaxed text-stone-700">{evaluation.rationale}</p>

      {evaluation.missingContext && (
        <p className="mt-2 text-sm text-stone-600">
          <strong className="font-medium">{tCard.missingContextLabel}</strong>
          {evaluation.missingContext}
        </p>
      )}

      {evaluation.likelyOrigin && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/60 p-3">
          <h4 className="font-serif text-sm font-bold text-stone-900">{tCard.likelyOriginTitle}</h4>
          <p className="mt-1 text-sm leading-relaxed text-stone-700">{evaluation.likelyOrigin}</p>
        </div>
      )}

      {supporting.length > 0 && (
        <EvidenceGroup title={tCard.supportingEvidenceTitle} items={supporting} />
      )}
      {contradicting.length > 0 && (
        <EvidenceGroup title={tCard.contradictingEvidenceTitle} items={contradicting} />
      )}

      {evaluation.whatWouldChangeConclusion && (
        <p className="mt-3 text-xs text-stone-500">
          <strong className="font-medium">{tCard.whatWouldChangeLabel}</strong>
          {evaluation.whatWouldChangeConclusion}
        </p>
      )}
    </article>
  );
}

function EvidenceGroup({ title, items }: { title: string; items: EvidenceItem[] }) {
  const t = useTranslation("report");
  const tCard = useTranslation("reportClaimCard");
  return (
    <div className="mt-3">
      <h4 className="text-xs font-semibold text-stone-500">{title}</h4>
      <ul className="mt-1 space-y-2">
        {items.map((e) => (
          <li key={e.id} className="rounded-lg bg-stone-50 p-3 text-sm">
            <a
              href={e.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-medium text-teal-700 underline-offset-2 hover:underline"
            >
              {e.title || e.url}
            </a>
            <p className="mt-1 text-xs text-stone-500">
              {e.publisher ?? tCard.unknownPublisher}
              {e.publicationDate ? ` · ${e.publicationDate}` : ""} · {sourceTypeLabel(e.sourceType, t.sourceTypeLabel)}
            </p>
            <ExpandableExcerpt text={e.excerpt} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const EXCERPT_COLLAPSED_LENGTH = 220;

function ExpandableExcerpt({ text }: { text: string }) {
  const tCard = useTranslation("reportClaimCard");
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > EXCERPT_COLLAPSED_LENGTH;

  return (
    <p className="mt-1 text-stone-600">
      {expanded || !isLong ? text : `${text.slice(0, EXCERPT_COLLAPSED_LENGTH)}…`}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ms-1 font-medium text-teal-700 hover:underline"
        >
          {expanded ? tCard.showLess : tCard.showMore}
        </button>
      )}
    </p>
  );
}
