# Facto — Test Results (Phase C/D run), 2026-10-20

All results below are from commands actually executed in this session against the local
checkout at `C:\Users\aviv2\Desktop\Cloude Code\aminut`. Nothing here is estimated or
assumed from reading code — every number is a real run's output.

**Important context**: a second agent was concurrently converting the site to support an
EN/HE language toggle while this phase ran, actively editing `ReportView*.tsx`, `Sidebar.tsx`,
and related files (per this task's own coordination instructions — those files were
intentionally not touched or fixed here). Some of the results below reflect that
in-flight, unrelated work, not anything broken by this phase. This is called out
explicitly wherever it applies, per instruction, rather than hidden or misattributed.

---

## 1. `npx vitest run` (unit/component tests)

```
Test Files  1 failed | 21 passed (22)
     Tests  19 failed | 131 passed (150)
```

- **131 passed, 19 failed, 150 total.** The 19 failures are **all** in
  `src/components/ReportView.test.tsx`, and all fail with the identical error:
  `Error: useLanguage/useTranslation must be used within a LanguageProvider`
  (thrown from `src/lib/i18n/LanguageContext.tsx:83`).
- **Root cause (confirmed by reading the error + the file list touched by the concurrent
  i18n agent)**: `ReportView.tsx` has been updated to call `useTranslation(...)`, but
  `ReportView.test.tsx` renders it without wrapping it in a `LanguageProvider`. Both
  `ReportView.tsx` and `ReportView.test.tsx` are on the i18n agent's active-edit list
  (`ReportView*.tsx`) and on this phase's explicit "do not touch" list — **this phase did
  not write or fix these failures, and did not modify either file.**
- This is a real, currently-failing test suite state as of this run — not hidden, not
  worked around. It should resolve once the concurrent i18n work finishes updating the
  test file to match (or wraps the render in a provider). **Action item for whoever owns
  that work**, not a new defect introduced by this phase.
- The other 21 test files (including `ssrfGuard.test.ts`, `ssrfGuard.safeFetch.test.ts`,
  `rateLimit.test.ts`, `evaluation.test.ts`, `claimExtraction.test.ts`, `pipeline.test.ts`,
  `config.test.ts`, `AiImageDetector.test.tsx`, etc.) all pass, 131 tests.

## 2. `npx tsc --noEmit` (type checking)

```
(no output — clean)
```

- **0 errors.** Exit clean.

## 3. `npx playwright test` (E2E, all specs)

Final run after fixing one test-locator bug introduced in this phase (see below):

```
33 passed (27.5s)
2 failed
```

### 3a. Pre-existing suite (not modified further, per instructions)
- `e2e/main-journey.spec.ts` — 4/4 passed (the product owner's own earlier fix to the
  stale "אמינות" → "Facto" heading assertion holds).

### 3b. New specs added this phase (31 new scenarios)

| File | Tests | Result |
|---|---|---|
| `e2e/abnormal-inputs.spec.ts` | 6 | **6/6 passed** |
| `e2e/error-handling.spec.ts` | 12 | **12/12 passed** |
| `e2e/viewports.spec.ts` | 11 | **11/11 passed** |
| `e2e/accessibility.spec.ts` | 2 | **0/2 passed — both fail, on real axe-core findings (see §4 and SECURITY_FINDINGS.md / DETAILED_FINDINGS.md)** |

**Total: 35 E2E tests, 33 passed, 2 failed.** The 2 failures are intentional — the tests
assert zero critical/serious automated-accessibility violations, and axe-core found real
ones (color contrast, accessible-name mismatch). This is correct, honest failure
reporting, not a test bug: weakening the assertion to force a "pass" would have hidden a
real finding, which the task explicitly said not to do.

One genuine test-authoring bug was found and fixed during this run: the first draft of
`error-handling.spec.ts`'s `/api/extract-image` 400 case used an ambiguous `getByText()`
locator that also matched Next.js's own dev-mode console-error overlay (a dev-server-only
artifact from the app's own `console.error(...)` diagnostic logging, not present in a
production build). Fixed by scoping the locator to the app's own error paragraph
(`p.text-rose-600`). Re-run confirmed 12/12 passing afterward.

### 3c. Scenarios covered (mapped to `qa/TEST_STRATEGY.md` IDs)
- D (abnormal input): empty submit (disabled), whitespace-only (disabled), text capped at
  8000 chars, mixed Hebrew/English/emoji, double-click submit (route-call-counted), URL-only
  submission (request-body-asserted).
- E (error handling): `/api/verify` 400/401/403/404/429/500 + a non-JSON 500 body;
  `/api/extract-image` 400/413/429/500 + a non-JSON 500 body. Every case asserts a Hebrew
  message is shown, no stack-trace-shaped text leaks to the page, and the user can recover
  (retry button / upload control still usable).
- G (visual/RTL): no horizontal overflow at 320/768/1024/1440px on `/`, plus 375px and
  1440px on `/contact`, `/privacy`, `/what-is-fake-news` (closing the V-03 gap Phase A
  flagged — the original suite only checked `/`). RTL attributes re-confirmed at all four
  new widths.
- H (accessibility): automated axe-core scan of the home idle state and a mocked
  report-result state.

## 4. `@axe-core/playwright` scan results (real tool output, not fabricated)

**Home page, idle state** — 4 violation types, 0 critical:
| id | impact | nodes affected |
|---|---|---|
| `color-contrast` | serious | 6 |
| `label-content-name-mismatch` | serious | 1 |
| `heading-order` | moderate | 1 |
| `region` | moderate | 8 |

**Home page, report-result state** (after a mocked successful `/api/verify`) — 2 violation
types, 0 critical:
| id | impact | nodes affected |
|---|---|---|
| `color-contrast` | serious | 6 |
| `label-content-name-mismatch` | serious | 1 |

Full detail and root causes: `DETAILED_FINDINGS.md`. **Axe-core checks only a subset of
WCAG success criteria** (primarily programmatically detectable ones) — it does not
verify keyboard-only operability, screen-reader announcement behavior, or focus-order
correctness, none of which were tested in this phase (see "Not run" below).

## 5. ESLint (bonus, not explicitly requested but safe/free)

```
npx eslint e2e qa/scripts  →  clean, no errors or warnings
```

## 6. `npm install -D @axe-core/playwright`

Required `--legacy-peer-deps` — the project's existing devDependency tree already has an
unrelated pre-existing peer-dependency conflict (`@testing-library/jest-dom@7.0.1` wants
`vitest >= 0.32` with no upper bound issue, but `vitest@5.0.4` wants `@types/node >=22`
while the project pins `@types/node@^20`). This conflict pre-dates this phase (confirmed:
a plain `npm install` with no new package also fails the same way) and is unrelated to
axe-core. `node_modules` was already present and presumably installed the same way before
this session. Not fixed here — out of scope, and changing `@types/node`'s major version
project-wide is a larger decision than this QA phase should make unilaterally.

`npm audit` additionally reports 5 pre-existing high-severity advisories, all transitive
through `eslint-config-next`'s `braces`/`micromatch`/`fast-glob` chain (a ReDoS in
`braces`) — a **dev-tooling-only** dependency (lint), not shipped in the production
bundle. Fixing requires a breaking downgrade of `eslint-config-next`. Flagged as a
low-priority, non-blocking informational item, not something this phase changed.

## 7. Explicitly NOT run in this phase (per the hard safety rules)

| Item | Why not run |
|---|---|
| Section F (AI/fact-checking reliability) full matrix (AI-01 through AI-10) | Only the prompt-injection-specific probes (AI-01/AI-02-equivalent) were run for real, per the ~15-call budget — see `AI_EVALUATION.md`. The judgment-heavy classification-accuracy items (AI-04 through AI-10) need many more real runs and human judgment calibration; out of this phase's budget. |
| Section A (F-01–F-13 core verify journey against real search results) | Needs real Tavily+Supabase runs beyond the AI-reliability budget; not run here except indirectly via the 6 real Anthropic calls in the eval script. |
| Section B (image OCR / AI-image-detection quality, F-14–F-21) | Needs real Anthropic vision calls; out of this phase's scope/budget. |
| Section C (feedback/trending-examples live behavior, F-22–F-25) | `/api/feedback` writes real data and can send a real email (Resend) — explicitly blocked without approval per `SAFETY_AND_ENVIRONMENTS.md` §4. |
| Section E (S-01, S-05–S-07: active SSRF probing, Supabase RLS probing) | Explicitly blocked — active exploitation / probing against anything other than a disposable test environment needs separate sign-off. Addressed instead via static code review — see `SECURITY_FINDINGS.md`. |
| Section J (load/performance) | Explicitly blocked — real, metered, uncapped-by-default API spend; needs a staging environment and an agreed cost ceiling. |
| `npm run build` / production-bundle secret-scan (S-09) | Building was judged out of this phase's "local/mocked only" scope by the prior phase's own notes; addressed instead via static source review of what each API route returns (see `SECURITY_FINDINGS.md`). |
| Manual keyboard-only navigation and screen-reader testing (A11Y-01, A11Y-03) | Requires a human tester or a dedicated automation harness beyond axe's static scan; not performed. |
