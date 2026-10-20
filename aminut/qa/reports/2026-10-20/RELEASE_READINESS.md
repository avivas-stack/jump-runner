# Facto — Release Readiness, 2026-10-20

Quality-gate table from this Phase C/D run, plus the carried-forward gaps from Phase A
that remain genuinely unverified. PASS/FAIL/BLOCKED/NOT RUN per gate, then a reasoned
go/no-go.

## Quality gates

| Gate | Status | Detail |
|---|---|---|
| TypeScript compiles clean | **PASS** | `npx tsc --noEmit` — 0 errors |
| Unit/component tests | **PASS, with a known-cause exception** | 131/150 pass; 19 failures are all in `ReportView.test.tsx`, all one root cause (missing `LanguageProvider` wrapper), caused by in-flight i18n work on files this phase was told not to touch — see `DETAILED_FINDINGS.md` BUG-01. Not a regression from this phase; should block merge of the i18n branch specifically, not block release of the current `main` as tested. |
| E2E tests (functional/error/abnormal-input/visual) | **PASS** | 33/35 — the pre-existing 4 + all 31 new functional/error/viewport scenarios pass |
| E2E tests (accessibility) | **FAIL — real findings, not a test defect** | 2 real axe-core violations (color contrast, accessible-name mismatch), both P2. See A11Y-01/A11Y-02 in `DETAILED_FINDINGS.md`. |
| Security: SSRF protection | **PASS (static review)** | Confirmed sound design, defense-in-depth, no bypass found by reading the code. Two P3 theoretical gaps noted (IPv6 edge forms), not demonstrated exploitable. No live exploitation attempted (blocked — needs staging/approval). |
| Security: XSS via fetched/evidence content | **PASS (static review)** | No `dangerouslySetInnerHTML`/unescaped-HTML sink reachable by untrusted evidence/claim content. Confirmed by direct grep + code read, not assumed. |
| Security: evidence-id fabrication defense | **PASS (static review)** | Code-level `validIds` filter confirmed independent of LLM compliance. |
| Security: rate limiting / kill-switch coverage | **PASS, with one documented gap** | One P2 finding (SEC-04): `/api/trending-examples` isn't covered by `DISABLE_PAID_ENDPOINTS` despite making a real billed call on cache miss. Low real-world cost impact; recommend fixing before relying on the kill switch as a complete emergency brake. |
| Security: secrets never reach the client | **PASS (source-level), NOT RUN (build-output level)** | Confirmed at the source/API-response level. The literal shipped-bundle grep (`npm run build` + scan) was judged out of this phase's scope, same as Phase A — genuinely not verified either way at that level. |
| Security: Supabase RLS (UPDATE/DELETE/broad-SELECT probing) | **NOT RUN — blocked** | Needs a disposable test Supabase project per the hard safety rules; was already out of scope for this phase. |
| Security: active SSRF exploitation attempt | **NOT RUN — blocked** | Needs an isolated/staging environment and explicit sign-off. |
| AI reliability: prompt-injection resistance | **PASS (3 real probes)** | No hijack observed across extraction-stage and evaluation-stage (including evidence-embedded) injection attempts, in a real run against the real pipeline modules with real Anthropic calls. Small sample — see caveats in `AI_EVALUATION.md`. |
| AI reliability: classification-accuracy judgment calls (AI-04–AI-10) | **NOT RUN** | Needs many more real, human-calibrated runs; out of this phase's ~15-call budget. |
| Core verify/OCR/AI-image-detection journeys against real services | **NOT RUN (beyond the 6 AI-reliability calls)** | Would need real Tavily/Supabase/more Anthropic calls; most of `TEST_STRATEGY.md` sections A/B require either real keys (acceptable per this phase's rules, but not exercised beyond the targeted AI-reliability script) or are explicitly blocked (feedback/email, load). |
| Feedback form + email notification | **NOT RUN — blocked** | Writes real data and can trigger a real email; needs approval or a disposable test environment per `SAFETY_AND_ENVIRONMENTS.md` §4. |
| Load/performance testing | **NOT RUN — blocked** | Explicitly out of scope without a staging environment and an agreed cost ceiling. |
| Lint | **PASS (new files only, informational)** | `npx eslint e2e qa/scripts` clean. Full-project lint was not re-run as part of this phase's required gates. |

## Launch-blocker vs. nice-to-fix-later vs. accepted/documented risk

**Hard launch-blockers found by this phase: none.** No P0 or P1 finding came out of this
review. Nothing found here, on its own, should stop a launch that was otherwise ready.

**Should fix before/soon after launch (nice-to-fix, not blocking)**:
- A11Y-01 (footer link color contrast) and A11Y-02 (language-toggle accessible name) — both
  P2, both quick, targeted CSS/markup fixes. Worth doing before launch given the low effort,
  but not launch-blocking on their own.
- SEC-04 (`trending-examples` kill-switch gap) — P2, low real-world cost impact, quick fix.
- BUG-01 (ReportView test suite) — this is process debt from in-flight work, not a product
  defect; it should be resolved as part of merging the i18n branch, not treated as a
  separate release blocker for the current `main`.

**Accepted / explicitly documented risk (not fixed, not blocking, but should not be
forgotten)**:
- SEC-01/SEC-02 (SSRF IPv6/numeric-hostname edge cases) — theoretical, unverified, P3.
- The large swath of "NOT RUN" items above (RLS probing, active SSRF exploitation, load
  testing, full AI classification-accuracy matrix, feedback/email live test, shipped-bundle
  secret scan) — every one of these was **out of scope by the task's own hard safety
  rules**, not skipped by oversight. They remain real gaps in pre-launch confidence,
  specifically around: (a) whether Supabase RLS actually behaves as documented in
  production, (b) whether the SSRF guard holds under live adversarial probing, (c) how the
  app behaves under real concurrent load given the in-memory rate-limiter's documented
  multi-instance weakness, and (d) whether the AI's classification judgment calls hold up
  across a wide range of real claims. None of these were newly identified as risks by this
  phase — they were already flagged in Phase A's `TEST_STRATEGY.md`/`SAFETY_AND_ENVIRONMENTS.md`
  and remain open.

## Go / no-go recommendation

**Ready-with-conditions.**

Nothing found in this phase rises to a launch-blocking defect. The functional, error-
handling, abnormal-input, and visual/RTL coverage added this phase all pass against a
realistic range of scenarios, type-checking is clean, and a real (not just read-from-code)
prompt-injection test came back clean across 3 probes. The two concrete new findings
(A11Y-01/02, SEC-04) are both low-effort, well-understood fixes, not systemic problems.

**Conditions**:
1. The two P2 accessibility findings and the one P2 kill-switch gap should be fixed or
   explicitly accepted by the product owner before or shortly after launch — they're small
   enough not to block, but "shipped with axe-serious violations" shouldn't be silently
   true.
2. This QA pass could not exercise several categories that materially affect launch
   confidence for a product that already has a live audience: Supabase RLS behavior,
   SSRF-guard behavior under live probing, real-world rate-limiting effectiveness under
   concurrent load, and the AI's classification accuracy across a broad range of real
   claims. These were out of scope by design (per the hard safety rules), not because they
   don't matter — if they have not been verified through some other channel (e.g. the
   README's own claimed historical RLS test), that is a real, pre-existing gap in
   pre-launch confidence that predates this phase and isn't resolved by it.
3. The `ReportView.test.tsx` failures should be resolved as part of the concurrent i18n
   work before that work merges to `main` — not a blocker for anything already on `main`
   today, but a blocker for *that* branch's own merge readiness.

Given this product is already live in production (not a pre-launch gate in the literal
sense — `https://aminut-il.vercel.app` is already serving real traffic per this task's own
framing), "ready-with-conditions" here means: **no finding from this phase justifies
pulling the current production deployment**, but the conditions above should be tracked
and addressed on a reasonable timeline rather than treated as closed.
