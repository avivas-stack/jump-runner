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

export function PrivacyContent() {
  const t = useTranslation("privacy");
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
        <p className="mt-1 text-xs text-stone-600">{t.lastUpdatedLabel}</p>
      </header>

      <div className="space-y-8 rounded-lg border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <Section title={s.whatIsThisTool.title}>
          <p>{s.whatIsThisTool.body}</p>
        </Section>

        <Section title={s.dataCollected.title}>
          <ul className="list-inside list-disc space-y-1">
            {s.dataCollected.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <p>{s.dataCollected.note}</p>
        </Section>

        <Section title={s.thirdPartySharing.title}>
          <p>{s.thirdPartySharing.intro}</p>
          <ul className="list-inside list-disc space-y-1">
            {s.thirdPartySharing.services.map((service) => (
              <li key={service.name}>
                <span dir="ltr" className="font-medium">
                  {service.name}
                </span>{" "}
                — {service.desc}
              </li>
            ))}
          </ul>
          <p>{s.thirdPartySharing.outro}</p>
        </Section>

        <Section title={s.sharedReports.title}>
          <p>
            {s.sharedReports.part1}
            <Link href="/contact" className="font-medium text-teal-700 underline">
              {s.sharedReports.contactLinkText}
            </Link>
            {s.sharedReports.part2}
          </p>
        </Section>

        <Section title={s.noWarranty.title}>
          <p>{s.noWarranty.body}</p>
        </Section>

        <Section title={s.fairUse.title}>
          <p>{s.fairUse.body}</p>
        </Section>

        <Section title={s.policyChanges.title}>
          <p>{s.policyChanges.body}</p>
        </Section>

        <Section title={s.contactUs.title}>
          <p>
            {s.contactUs.part1}
            <Link href="/contact" className="font-medium text-teal-700 underline">
              {s.contactUs.contactLinkText}
            </Link>
            {s.contactUs.part2}
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
