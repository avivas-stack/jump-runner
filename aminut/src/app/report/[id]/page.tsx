import type { Metadata } from "next";
import { Suspense, cache } from "react";
import Link from "next/link";
import { getReportById as getReportByIdUncached } from "@/lib/reportStore";
import { ReportView } from "@/components/ReportView";
import { SITE_NAME } from "@/lib/siteConfig";
import type { Classification, Report } from "@/lib/types";

// Shared between generateMetadata and the page body so a single request only ever
// fetches the report once (React's per-request cache, not a cross-request cache).
const getReportById = cache(getReportByIdUncached);

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export async function generateMetadata({ params }: PageProps<"/report/[id]">): Promise<Metadata> {
  const { id } = await params;
  const report = await getReportById(id);
  if (!report) {
    return { title: `דוח לא נמצא — ${SITE_NAME}` };
  }

  const singleClaim = report.claims.length === 1 ? report.claims[0] : null;
  const singleEvaluation = singleClaim ? report.evaluations.find((e) => e.claimId === singleClaim.id) : null;
  const title = singleClaim
    ? `${singleEvaluation?.classification ?? "בדיקה"}: ${truncate(singleClaim.originalText, 70)} — ${SITE_NAME}`
    : `דוח בדיקת מהימנות — ${SITE_NAME}`;
  const description = truncate(report.overallAssessment, 200);

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

/**
 * Rating scale for the ClaimReview structured data below (1 = false, 5 = verified).
 * Only emitted for single-claim reports: Google's rich-result eligibility requires
 * one ClaimReview per page, and a multi-claim report has no single claim it's "about".
 */
const CLASSIFICATION_RATING: Record<Classification, number> = {
  מאומת: 5,
  "חסר הקשר": 3,
  "שנוי במחלוקת": 3,
  "לא ניתן לאימות": 3,
  "דעה, תחזית או סאטירה": 3,
  מיושן: 2,
  מטעה: 2,
  'ככה"נ שקרי': 2,
  שקרי: 1,
};

function buildClaimReviewJsonLd(report: Report, shareUrl: string): string | null {
  if (report.claims.length !== 1) return null;
  const claim = report.claims[0];
  const evaluation = report.evaluations.find((e) => e.claimId === claim.id);
  if (!evaluation) return null;
  // A low-confidence verdict is, by definition, one this tool itself isn't sure of —
  // never hand it to a crawler as a confident structured "True"/"False" claim about a
  // real, possibly identifiable person. The hedging that already exists in the HTML
  // (ConfidenceNote, the "ייתכנו טעויות" disclaimers) isn't read by anything parsing
  // this JSON-LD, so the guard has to live here too.
  if (evaluation.confidence === "low") return null;

  // Escape "</" so claim text can never prematurely close the <script> tag it's embedded in.
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ClaimReview",
    datePublished: report.checkedAt,
    url: shareUrl,
    claimReviewed: claim.originalText.slice(0, 120),
    itemReviewed: {
      "@type": "Claim",
      datePublished: claim.publicationDate ?? report.checkedAt,
    },
    author: {
      "@type": "Organization",
      name: SITE_NAME,
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: CLASSIFICATION_RATING[evaluation.classification],
      bestRating: 5,
      worstRating: 1,
      alternateName: evaluation.classification,
    },
  }).replace(/<\//g, "<\\/");
}

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

  const shareUrl = `/report/${id}`;
  const jsonLd = buildClaimReviewJsonLd(report, shareUrl);

  return (
    <>
      {jsonLd && (
        // eslint-disable-next-line @next/next/no-danger
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      )}
      <ReportView report={report} shareUrl={shareUrl} />
    </>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <div className="h-24 animate-pulse rounded-lg bg-stone-100" />
      <div className="h-40 animate-pulse rounded-lg bg-stone-100" />
      <div className="h-40 animate-pulse rounded-lg bg-stone-100" />
    </div>
  );
}

export default function SharedReportPage({ params }: PageProps<"/report/[id]">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-6 border-b-2 border-stone-900 pb-5 text-center">
        <Link href="/" className="inline-flex items-center gap-2 font-serif text-3xl font-bold text-stone-900 sm:text-4xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" aria-hidden className="h-7 w-7 sm:h-8 sm:w-8" />
          {SITE_NAME}
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
