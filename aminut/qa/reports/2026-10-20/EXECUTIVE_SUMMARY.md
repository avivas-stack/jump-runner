# Facto — Executive Summary (Phase C/D QA), 2026-10-20

## Snapshot

This phase built and ran the missing test infrastructure identified in Phase A
(`qa/PROJECT_MAP.md`/`TEST_STRATEGY.md`/`SAFETY_AND_ENVIRONMENTS.md`), then executed
everything safe to run locally: the full Vitest/Playwright/tsc suite, 31 new E2E scenarios
across abnormal input, error handling, visual/RTL, and accessibility, a static security
review of the previously-flagged risk points, and a small real-call prompt-injection
evaluation against the live Anthropic pipeline. No production data was touched, no real
email was sent, no load test was run.

## Test counts (all real, from commands actually executed)

| Suite | Pass | Fail | Total |
|---|---|---|---|
| Vitest (unit/component) | 131 | 19 (all one root cause — see below) | 150 |
| TypeScript (`tsc --noEmit`) | clean | — | — |
| Playwright E2E (pre-existing 4 + 31 new) | 33 | 2 (real axe findings, not test bugs) | 35 |

Not-run / blocked categories (load testing, Supabase RLS probing, active SSRF
exploitation, feedback/email live test, full AI classification-accuracy matrix,
build-output secret scan) are listed with reasons in `TEST_RESULTS.md` and
`RELEASE_READINESS.md` — all out of scope by the task's own hard safety rules, not
oversights.

## Top findings

- **No P0 or P1 findings.**
- **P2 — SEC-04**: `GET /api/trending-examples` makes a real, billed Anthropic call on
  cache miss but is not covered by the `DISABLE_PAID_ENDPOINTS` kill switch, unlike the
  other three paid routes. This resolves Phase A's open question: confirmed to be a real
  gap, not intentional design. Low cost impact (one call per instance per 24h), easy fix.
- **P2 — A11Y-01/A11Y-02**: a real (not assumed) `@axe-core/playwright` scan found two
  "serious"-impact violations: footer-link text contrast at ~2.5:1 against a 4.5:1
  requirement, and the language-toggle button's accessible name ("Change display
  language") not including its own visible text ("EN"), which fails WCAG 2.5.3 for
  voice-control users. Two moderate findings (heading-order, un-landmarked content) were
  also flagged, lower priority. Axe only catches a subset of WCAG issues — manual
  keyboard/screen-reader testing (A11Y-01/03 in the original matrix) remains unverified.
- **Positive finding, real-call confirmed**: 3 live prompt-injection probes against the
  actual claim-extraction and evaluation pipeline (one in claim text, one in a fabricated
  evidence excerpt) all failed to hijack the model — it correctly treated injected
  instructions as data, never fabricated a verdict or a source, and in one case explicitly
  named the injection attempt in its own written rationale. Small sample (3 probes); not a
  blanket guarantee. See `AI_EVALUATION.md` for full real outputs.
- **SSRF guard, XSS-via-evidence, and evidence-id-fabrication defenses were all confirmed
  sound by static code review** — no bypass found, no unescaped-HTML sink reachable by
  untrusted content. Two low-severity (P3) theoretical SSRF edge cases noted but not
  demonstrated exploitable.
- **One test-suite failure not caused by this phase**: `ReportView.test.tsx` (19 of its 19
  tests) fails because the concurrently in-progress i18n conversion added a
  `useTranslation()` call to `ReportView.tsx` without updating the test file to wrap it in
  a `LanguageProvider`. Both files are on this task's explicit do-not-touch list; this is
  flagged, not fixed, and should block that branch's own merge, not today's `main`.

## Open risks / coverage limitations

- Supabase RLS behavior, active SSRF exploitation resistance, real-world rate-limiting
  under concurrent load, and the AI's classification-accuracy judgment calls across a
  broad range of real claims remain unverified by any phase to date (all explicitly
  out of scope here, per the hard safety rules — carried forward from Phase A, not
  newly discovered gaps).
- The shipped production JS bundle was not grepped for leaked secrets (would require
  `npm run build`, judged out of this phase's "local/mocked only" scope); secrets handling
  was confirmed safe at the source/API-response level only.

## Release recommendation

**Ready-with-conditions.** No launch-blocking defect was found. Fix or explicitly accept
the two P2 accessibility findings and the one P2 kill-switch gap on a reasonable timeline;
track the pre-existing out-of-scope gaps (RLS, live SSRF, load, AI-accuracy breadth) as
still-open rather than resolved. Full reasoning and a per-gate table:
`RELEASE_READINESS.md`.
