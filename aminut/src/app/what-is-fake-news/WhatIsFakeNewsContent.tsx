"use client";

import Link from "next/link";
import { SITE_NAME } from "@/lib/siteConfig";
import { useTranslation } from "@/lib/i18n/LanguageContext";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-serif text-lg font-bold text-stone-900">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-stone-700">{children}</div>
    </section>
  );
}

export function WhatIsFakeNewsContent() {
  const t = useTranslation("whatIsFakeNews");
  const s = t.sections;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-8 border-b-2 border-stone-900 pb-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2 font-serif text-3xl font-bold text-stone-900 sm:text-4xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" aria-hidden className="h-7 w-7 sm:h-8 sm:w-8" />
          {SITE_NAME}
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-stone-700">{t.pageTitle}</h1>
      </header>

      <div className="space-y-8 rounded-lg border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <Section title={s.definitions.title}>
          <ul className="list-inside list-disc space-y-1.5">
            {s.definitions.terms.map(({ term, def }) => (
              <li key={term}>
                <span className="font-medium text-stone-900">{term}:</span> {def}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={s.whyItWorks.title}>
          <ul className="list-inside list-disc space-y-1.5">
            {s.whyItWorks.points.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </Section>

        <Section title={s.effects.title}>
          <ul className="list-inside list-disc space-y-1.5">
            {s.effects.points.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </Section>

        <Section title={s.checkSteps.title}>
          <ol className="list-inside list-decimal space-y-1.5">
            {s.checkSteps.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </Section>

        <Section title={s.warningSigns.title}>
          <ul className="list-inside list-disc space-y-1.5">
            {s.warningSigns.signs.map((sign, i) => (
              <li key={i}>{sign}</li>
            ))}
          </ul>
        </Section>

        <Section title={s.summary.title}>
          <p>{s.summary.body1}</p>
          <p>
            {s.summary.reasonPrefix}
            {SITE_NAME}
            {s.summary.reasonMiddle}
            <Link href="/" className="font-medium text-teal-700 underline">
              {s.summary.reasonLinkText}
            </Link>
            {s.summary.reasonSuffix}
          </p>
        </Section>
      </div>

      <p className="mt-6 text-center text-sm">
        <Link href="/" className="font-medium text-teal-700 underline">
          {t.backToHome}
        </Link>
      </p>
    </main>
  );
}
