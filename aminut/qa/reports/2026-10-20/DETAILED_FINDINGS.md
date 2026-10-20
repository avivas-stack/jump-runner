# Facto — Detailed Findings, 2026-10-20

Every finding from this phase (functional, security, AI-reliability, accessibility), with
ID, severity, repro steps, expected vs. actual, evidence, and confidence level. Severity:
**P0** critical / **P1** high / **P2** medium / **P3** low.

No P0 findings. No P1 findings.

---

## BUG-01 — Vitest `ReportView.test.tsx` suite fails: missing `LanguageProvider` wrapper

- **Severity**: P2 (blocks a real test suite, but caused by in-flight, unrelated work —
  see below)
- **Confidence**: Confirmed by running `npx vitest run`
- **Status**: Not fixed by this phase — `ReportView.tsx` and `ReportView.test.tsx` are on
  the concurrent i18n-conversion agent's active-edit list and on this phase's explicit
  do-not-touch list.
- **Repro**: `npx vitest run` from the project root.
- **Expected**: All 150 tests pass (per the baseline stated in this task's brief, confirmed
  working before the i18n refactor started).
- **Actual**: 131 pass, 19 fail, all in `ReportView.test.tsx`, all with:
  `Error: useLanguage/useTranslation must be used within a LanguageProvider` thrown from
  `src/lib/i18n/LanguageContext.tsx:83`.
- **Root cause**: `ReportView.tsx` now calls `useTranslation(...)` (mid-flight i18n work),
  but `ReportView.test.tsx` renders `<ReportView />` directly without a `<LanguageProvider>`
  ancestor. Every failing test fails for the identical reason — this is one root cause
  manifesting 19 times, not 19 separate bugs.
- **Evidence**: full failure list and stack trace in `TEST_RESULTS.md` §1.
- **Recommendation**: whoever finishes the i18n work should wrap `ReportView.test.tsx`'s
  render calls in a `LanguageProvider` (matching whatever pattern the rest of the
  i18n-aware test suite ends up using) before merging. Not a regression this phase
  introduced; flagged here so it doesn't get lost.

## SEC-04 — `GET /api/trending-examples` is not gated by `DISABLE_PAID_ENDPOINTS` despite making a real Anthropic call

- **Severity**: P2
- **Confidence**: Confirmed by reading `src/app/api/trending-examples/route.ts` and
  `src/lib/trendingExamples.ts`
- **Repro**: read the route handler — it checks rate limiting only, never
  `paidEndpointsDisabledResponse()`. `trendingExamples.ts` calls `callStructured(...)`
  (an Anthropic call) on a 24h cache miss.
- **Expected** (per the kill switch's own documented purpose in `config.ts`'s comment —
  "lets whoever holds the Vercel project flip the paid endpoints off... as a stopgap"):
  every route that makes a real, billed Anthropic/Tavily call should be covered.
- **Actual**: `/api/verify`, `/api/extract-image`, `/api/detect-ai-image` are covered;
  `/api/trending-examples` is not, despite calling the same billed API on cache miss.
- **Impact**: low in practice (one call per server instance per 24h, not per-request), but
  it means the operator kill switch doesn't actually stop *all* spending as its own
  documentation implies, during the exact "viral traffic / cost spike" scenario it exists
  to mitigate.
- **Recommendation**: see `SECURITY_FINDINGS.md` §3 for the suggested fix (gate the route,
  or have it skip straight to the static fallback list when the switch is set).

## A11Y-01 — Color contrast below WCAG AA on footer/secondary links (axe: `color-contrast`, serious)

- **Severity**: P2
- **Confidence**: Confirmed by real `@axe-core/playwright` scan (`e2e/accessibility.spec.ts`)
- **Repro**: run `npx playwright test e2e/accessibility.spec.ts` — both the home idle-state
  and report-result-state scans report this violation (6 affected nodes each run).
- **Expected**: WCAG AA requires ≥4.5:1 contrast for normal-size text.
- **Actual**: text colored `#a6a09b` (the app's `text-stone-400`/`text-stone-500`-family
  gray) on `#fafaf9`/`#ffffff` backgrounds measures **2.47:1 and 2.58:1** respectively —
  both well under the 4.5:1 threshold. Axe specifically flagged the footer links
  (`מה זה פייק ניוז?`, `מדיניות פרטיות ותנאי שימוש`, `יצירת קשר / דיווח על באג`) at 12px
  font size.
- **Evidence**: raw axe output in `TEST_RESULTS.md` §4; exact contrast ratios and color
  values are in the tool's own output, not estimated.
- **Recommendation**: darken the footer/secondary text color (e.g. to something in the
  `stone-500`/`stone-600` range, or verify specifically against the actual rendered
  background) until it clears 4.5:1, or increase font size to qualify for the lower
  "large text" 3:1 threshold if that's visually acceptable.

## A11Y-02 — Language toggle button's accessible name doesn't include its visible text (axe: `label-content-name-mismatch`, serious)

- **Severity**: P2
- **Confidence**: Confirmed by real axe scan
- **Repro**: same scan as above; element: `<button aria-label="שינוי שפת התצוגה"
  title="שינוי שפת התצוגה">EN</button>` (the `LanguageToggle` component).
- **Expected** (WCAG 2.5.3, Label in Name): a control's visible text label should be
  contained within its accessible name, so voice-control/speech-input users who say what
  they see ("click EN") can actually activate it.
- **Actual**: the `aria-label` ("Change display language") completely replaces the visible
  text "EN" in the accessible name — a user speaking "EN" to a voice-control tool would
  not find this match.
- **Recommendation**: change the accessible name to include the visible text, e.g.
  `aria-label={`Switch to English (EN)`}` or similar, so "EN" is a substring of the
  computed accessible name. (Note: `LanguageToggle.tsx` is on the concurrent i18n agent's
  active file set per this task's coordination rules — not edited here; flagged for them
  or for a follow-up pass.)

## A11Y-03 — Heading-level skip and un-landmarked content (axe: `heading-order`, `region`, moderate)

- **Severity**: P3
- **Confidence**: Confirmed by real axe scan (home idle state only — 1 and 8 nodes
  respectively; not reproduced in the report-result scan, which may have a different DOM
  shape)
- **Repro**: `npx playwright test e2e/accessibility.spec.ts -g "home page idle"`
- **Expected**: heading levels increase by one at a time; all visible content sits inside
  a landmark region (`<main>`, `<nav>`, `<header>`, etc.).
- **Actual**: axe detected a heading-level jump and 8 nodes of content not contained in a
  landmark on the home page's idle state.
- **Recommendation**: lower priority than A11Y-01/02 — worth a manual pass once the i18n
  layout work settles (the page structure is actively changing), rather than fixing now
  against a moving target.

## INFO-01 — Very long textarea input and the 8000-char cap

- **Severity**: Informational (no defect found)
- **Confidence**: Confirmed by real Playwright run (`e2e/abnormal-inputs.spec.ts`)
- Typing/filling 8500 characters into the claim textarea resulted in a value capped at
  8000 characters (the `maxLength={8000}` attribute on the `<textarea>` holds under
  Playwright's `fill()`, which exercises the browser's native text-insertion path). No bug
  found; documented because the task specifically asked this boundary be checked, not
  assumed.

## INFO-02 — Double-click submit does not fire two `/api/verify` requests

- **Severity**: Informational (no defect found)
- **Confidence**: Confirmed by real Playwright run with route-call counting
  (`e2e/abnormal-inputs.spec.ts`)
- A `dblclick()` on the submit button, against a deliberately slow (300ms) mocked
  `/api/verify`, resulted in exactly 1 request. This holds structurally: `page.tsx`'s
  `showForm` flag (and therefore `<ClaimForm>` itself) unmounts as soon as `state.status`
  transitions to `"running"`, which happens synchronously in the click handler before the
  fetch resolves — there is no window in the UI where a second click can reach the submit
  button once the first has registered. No separate explicit debounce/lock exists, but
  none is needed given this architecture. Documented as a confirmed-safe finding, not
  assumed from reading the code alone (a real double-click was executed).

## INFO-03 — Error handling never leaks a raw stack trace

- **Severity**: Informational (no defect found)
- **Confidence**: Confirmed across all 12 cases in `e2e/error-handling.spec.ts` (6 status
  codes × `/api/verify`, 4 status codes × `/api/extract-image`, plus 2 non-JSON-body edge
  cases)
- Every tested status code (400/401/403/404/429/500, plus non-JSON 500 bodies) resulted in
  a clear Hebrew message shown to the user, with no stack-trace-shaped text
  (`TypeError:`, `at Object.`, `node_modules/`, etc.) appearing anywhere on the page, and
  the retry/upload-again control remained usable afterward in every case.

## SSRF guard, XSS, evidence-id fabrication, secrets handling

See `SECURITY_FINDINGS.md` for the full write-up (SEC-01 through SEC-05, plus three areas
confirmed safe with no finding: SSRF design, XSS via evidence content, evidence-id
fabrication defense, and secrets-never-reach-client at the source level).

## Prompt-injection resistance (3 real probes)

See `AI_EVALUATION.md`. No hijack observed in any of the 3 real probes run (extraction
stage + 2 evaluation-stage probes, one with the injection hidden inside fetched-evidence-
shaped content). This is a positive finding, with explicit caveats about sample size
documented in that file — not claimed as a blanket guarantee.
