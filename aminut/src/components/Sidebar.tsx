"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

interface ViralExample {
  claim: string;
  sourceName: string;
  sourceUrl: string;
}

export function Sidebar({
  onSelectExample,
  disabled,
}: {
  onSelectExample: (text: string) => void;
  disabled: boolean;
}) {
  const t = useTranslation("sidebar");
  const [viral, setViral] = useState<ViralExample[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/trending-examples", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.examples?.length) return;
        setViral(data.examples);
      })
      .catch(() => {
        // Best-effort enhancement only — the static examples below always work.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="space-y-6 lg:w-80 lg:shrink-0">
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
          <span aria-hidden>🔥</span> {t.viralTitle}
        </h2>
        <p className="mt-1 text-xs text-stone-500">{t.viralSubtitle}</p>
        {viral.length === 0 ? (
          <p className="mt-3 text-xs text-stone-600">{t.noViralExamples}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {viral.map((item, i) => (
              <li key={i} className="rounded-md bg-stone-50 p-3">
                <p className="text-sm text-stone-700">{item.claim}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-xs text-stone-600 underline-offset-2 hover:underline"
                  >
                    {t.sourcePrefix}{item.sourceName}
                  </a>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelectExample(item.claim)}
                    className="shrink-0 rounded-full bg-teal-700 px-3 py-1 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    {t.checkThisButton}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-stone-900">{t.examplesTitle}</h2>
        <ul className="mt-3 space-y-2">
          {t.staticExampleClaims.map((claim) => (
            <li key={claim}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelectExample(claim)}
                className="w-full rounded-md border border-stone-200 bg-stone-50 p-3 text-start text-sm text-stone-700 hover:bg-stone-100 disabled:opacity-50"
              >
                {claim}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
