# Facto (אמינות) — Project Map (Phase A Discovery)

Scope: static, read-only analysis of the repository at
`C:\Users\aviv2\Desktop\Cloude Code\aminut` (branch `main`, latest commit at time of
writing `ab4fde2` "Send an email notification when new feedback arrives", 2026-10-17).
No build/dev/test command was run to produce this document — everything below is
derived from reading source, config, and migration files directly, cross-checked
against the project's own `README.md`/`AGENTS.md` where present (the README here is
unusually detailed and itself appears to be kept in sync with the code — but every
claim below was independently verified against the actual source, not taken from the
README on faith).

Legend: **[Confirmed]** = read directly in code/config. **[Inferred]** = reasonable
conclusion from confirmed facts, not stated outright. **[Open question]** = could not
be verified by static reading alone.

---

## 1. Technologies identified

| Technology | Confidence | Evidence |
|---|---|---|
| Next.js 16.4.1, App Router | **Confirmed** | `package.json` (`"next": "16.4.1"`), `src/app/` directory structure with `page.tsx`/`layout.tsx`/`route.ts` files, `next.config.ts` |
| React 19.3.0 / React DOM 19.3.0 | **Confirmed** | `package.json` |
| TypeScript 5.x | **Confirmed** | `package.json` devDependencies, `tsconfig.json` |
| Tailwind CSS v4 (via `@tailwindcss/turbopack`) | **Confirmed** | `package.json`, `next.config.ts` turbopack loader rule for `*.css` |
| Zod v4 | **Confirmed** | `package.json` (`"zod": "^4.6.7"`), used throughout `src/lib/types.ts` and as JSON-Schema source for Anthropic tool calls (`z.toJSONSchema`) |
| Anthropic SDK (`@anthropic-ai/sdk` ^0.134.0) — Claude models | **Confirmed** | `src/lib/anthropic.ts`; models configured as `claude-haiku-5-5` (extraction) and `claude-sonnet-5-5` (evaluation) in `src/lib/config.ts` defaults |
| Supabase (`@supabase/supabase-js` ^2.117.3) — Postgres + RLS, used only server-side | **Confirmed** | `src/lib/reportStore.ts`, `src/lib/feedbackStore.ts`, `supabase/migrations/*.sql` |
| Tavily Search API | **Confirmed** | `src/lib/search/tavily.ts` — sole concrete `SearchProvider` implementation |
| Resend (transactional email) | **Confirmed** | `package.json`, `src/lib/feedbackStore.ts` (`notifyNewFeedback`) |
| Upstash Redis (`@upstash/redis`) — optional durable rate limiting | **Confirmed** | `src/lib/rateLimit.ts`, `src/lib/config.ts` (`UPSTASH_REDIS_REST_URL/TOKEN`) |
| cheerio (server-side HTML parsing) | **Confirmed** | `src/lib/pageRetrieval.ts`, `src/lib/trendingExamples.ts` |
| bidi-js | **Confirmed** | `package.json`, `src/lib/bidiVisualText.ts` (RTL/bidi text handling, has its own test file) |
| Vitest (unit/component tests) + Testing Library + jsdom | **Confirmed** | `package.json`, `vitest.config.mts`, `vitest.setup.ts`, 22 `*.test.ts(x)` files under `src/` |
| Playwright (E2E) | **Confirmed** | `package.json`, `playwright.config.ts`, `e2e/main-journey.spec.ts` (the only E2E spec file) |
| ESLint 9 (flat config) | **Confirmed** | `eslint.config.mjs` |
| Deployment: Vercel | **Confirmed** (per user-supplied context: production URL `https://aminut-il.vercel.app`) and **[Inferred]** from code: `maxDuration` exports in route handlers reference "Hobby/Pro" Vercel function-timeout tiers explicitly in comments (`src/app/api/detect-ai-image/route.ts`), and `config.ts` comments reference "Vercel dashboard (Storage tab)" for Upstash integration. No `vercel.json` or `.vercel/` directory is present in the checked-out working tree (expected — `.vercel` is gitignored). |

No staging/CI tooling (GitHub Actions, etc.) was found — see `qa/SAFETY_AND_ENVIRONMENTS.md`.

---

## 2. System structure and responsibility boundaries

```
Browser (client components, "use client")
  └─ src/app/page.tsx (home), src/components/* (ClaimForm, AiImageDetector, ReportView, Sidebar, HistoryPanel, ...)
       │  fetch() calls only — no server secrets ever reach this layer
       ▼
Next.js Route Handlers (src/app/api/*/route.ts)  — all server-only
  ├─ POST /api/verify            → src/lib/pipeline.ts (orchestration)
  ├─ POST /api/extract-image     → src/lib/imageExtraction.ts
  ├─ POST /api/detect-ai-image   → src/lib/aiImageDetection.ts
  ├─ POST /api/feedback          → src/lib/feedbackStore.ts
  └─ GET  /api/trending-examples → src/lib/trendingExamples.ts
       │
       ▼
src/lib/*  (all business logic lives here, per README's own stated design goal of
            "API keys never reach the client")
  ├─ anthropic.ts      — single wrapper around Claude tool-use calls (callStructured)
  ├─ claimExtraction.ts, evaluation.ts, report.ts — three distinct LLM call sites
  ├─ search/{types,tavily}.ts — SearchProvider abstraction, Tavily is the only impl
  ├─ pageRetrieval.ts, ssrfGuard.ts — outbound HTTP fetch of user/search-supplied URLs
  ├─ evidenceRegistry.ts — per-request in-memory id registry (not persisted)
  ├─ rateLimit.ts — per-IP limiting (in-memory fallback, Upstash Redis if configured)
  ├─ reportStore.ts, feedbackStore.ts — Supabase persistence (both optional/best-effort)
  ├─ config.ts — single source of truth for env vars (Zod-validated, all defaulted/optional)
  └─ types.ts — all Zod schemas / TypeScript types shared by server and client
       │
       ▼
External services (see §7)
  Anthropic API, Tavily API, Supabase (Postgres+RLS), Resend, Upstash Redis (optional),
  arbitrary third-party web pages (via ssrfGuard), fakereporter.net / irrelevant.org.il
  (fixed, hardcoded URLs, for trending examples)
```

Responsibility boundary notes:
- **Frontend never calls external services directly** — every external call (LLM, search, email, DB) is server-side only, reached through the app's own API routes. **[Confirmed]** via grep: no API keys or `fetch()` to third-party hosts appear in any `"use client"` file.
- **`src/lib/pipeline.ts`** is the sole orchestrator for the verify flow; it directly imports `claimExtraction`, `evaluation`, `evidenceRegistry`, `pageRetrieval`, `report`, and `search` — i.e., all fact-checking logic is centralized in one call graph, not scattered across routes.
- **Evidence registry is per-request/in-memory only** (`new EvidenceRegistry()` instantiated fresh inside `runVerifyPipeline`) — it is not a persistence layer; only the final assembled `Report` object is optionally persisted (`reportStore.ts`).

---

## 3. Screens/routes verified from the code (App Router)

| Route | File | Type | Notes |
|---|---|---|---|
| `/` | `src/app/page.tsx` | Client page | Home: claim form, image upload, AI-image detector, results, history panel, sidebar |
| `/report/[id]` | `src/app/report/[id]/page.tsx` | Server component w/ Suspense | Shared/permalink report view; fetches from Supabase via `getReportById`; emits `ClaimReview` JSON-LD for single-claim, non-low-confidence reports |
| `/contact` | `src/app/contact/page.tsx` | Client page | Feedback/bug-report/privacy-request form |
| `/privacy` | `src/app/privacy/page.tsx` | Static/server page | Privacy policy & terms |
| `/what-is-fake-news` | `src/app/what-is-fake-news/page.tsx` | Static/server page | Educational content page, listed in `sitemap.ts` |
| `/sitemap.xml` | `src/app/sitemap.ts` | Generated | Lists only `/` and `/what-is-fake-news` — deliberately excludes all `/report/[id]` permalinks (comment explains: avoids bulk-publishing low-confidence reports about real people to crawlers) |
| `/robots.txt` | `src/app/robots.ts` | Generated | Allows all, points to sitemap |
| `/manifest.webmanifest` (PWA manifest) | `src/app/manifest.ts` | Generated | Not inspected in depth; present |
| OG images | `src/app/opengraph-image.tsx`, `src/app/report/[id]/opengraph-image.tsx` | Generated images | Per-route dynamic OG image generation |
| `/icon.png`, `/apple-icon.png`, `/favicon.ico` | static files | — | — |

No `/admin`, login, or account-management routes exist anywhere in `src/app` — **[Confirmed]** the product is genuinely no-login, consistent with the brief.

---

## 4. Main user journeys

1. **Submit a text/URL claim for fact-checking** (home page): type/paste text and/or a URL into `ClaimForm` → `POST /api/verify` (streamed NDJSON) → real-time stage events rendered by `LoadingStages`/`useVerifyPipeline` → final `Report` rendered by `ReportView`, saved to client-side history (`localStorage`, `clientHistory.ts`), and optionally given a shareable `/report/<id>` link if Supabase is configured.
2. **Submit a screenshot for OCR-assisted fact-checking**: upload an image in `ClaimForm`/`AiImageDetector` → client-side compression (`clientImageUpload.ts`) → `POST /api/extract-image` → extracted text (with confidence + uncertain-notes) is shown to the user **for review/edit before** it is ever sent into the verify pipeline — the user is an explicit confirmation gate, not auto-submitted.
3. **Check whether an image looks AI-generated** (`AiImageDetector` component): upload an image → `POST /api/detect-ai-image` → returns (a) a metadata/provenance-marker scan (C2PA, SynthID references, etc. — a text-level grep over file bytes) and (b) a "visual opinion" from Claude (multi-sample, majority-vote, explicitly framed as a non-forensic stylistic impression).
4. **View a shared report**: open `/report/<id>` link → server-rendered report from Supabase, no auth, publicly viewable by anyone with the (unguessable) UUID.
5. **Submit feedback / bug report / privacy request** (`/contact`): form → `POST /api/feedback` → saved to Supabase `feedback_messages` table, optionally triggers a Resend email notification to the configured recipient.
6. **Browse trending/example claims** (home page sidebar): client loads `GET /api/trending-examples` on page load → server scrapes FakeReporter.net and irrelevant.org.il (fixed URLs) through the SSRF guard, asks an LLM to pick genuinely-claim-shaped headlines, 24h in-memory cache; falls back to static hardcoded examples on any failure.
7. **Read educational content**: `/what-is-fake-news`, `/privacy` — static informational pages, no API calls.

---

## 5. API endpoints identified (only ones found in code)

| Method | Path | Request body (Zod schema) | Response | Rate limit key / budget |
|---|---|---|---|---|
| `POST` | `/api/verify` | `VerifyRequestSchema` — `{ text?: string ≤8000, url?: string ≤2000 }`, at least one required | Streamed NDJSON of `StageEvent`s, ending in `{type:"done", report, shareUrl}` or `{type:"error", message, code}` | `clientKeyFromRequest` (plain IP key), `RATE_LIMIT_PER_IP_PER_HOUR` (default 20/hr) |
| `POST` | `/api/extract-image` | `ExtractImageRequestSchema` — `{ imageBase64: string ≤10MB-as-string, mediaType: jpeg\|png\|gif\|webp }` | JSON `ImageExtractionResult` (`extractedText`, `confidence`, `uncertainNotes`) or `{error}` | key prefixed `image:`, `IMAGE_RATE_LIMIT_PER_IP_PER_HOUR` (default 10/hr) |
| `POST` | `/api/detect-ai-image` | `DetectAiImageRequestSchema` — same shape as above | JSON `{credentialsMarkers, visualOpinion, visualOpinionFailed}` | key prefixed `aiimg:`, same budget as extract-image |
| `POST` | `/api/feedback` | `FeedbackRequestSchema` — `{category: bug\|privacy\|other, message: string 1–4000, contactEmail?: string ≤200}` | `{ok:true}` or `{error}` | key prefixed `feedback:`, fixed 10/hr (hardcoded constant, not in `config.ts`) |
| `GET` | `/api/trending-examples` | none (no body) | `{examples: TrendingExample[]}` | key prefixed `trending:`, fixed 60/hr (hardcoded constant) |

All five routes call `checkRateLimit` **before** any paid/external call, and the three
paid-API routes (`verify`, `extract-image`, `detect-ai-image`) additionally check
`paidEndpointsDisabledResponse()` first, which can force a 503 via `DISABLE_PAID_ENDPOINTS`
env var — an operator kill switch. **[Confirmed]** `feedback` and `trending-examples` do
**not** check this kill switch (by design — they're not "paid LLM/search" routes in the
same sense, though `trending-examples` does call `callStructured` under the hood, i.e. it
does make Anthropic calls despite not being gated by the kill switch — **[Open question /
possible gap for TEST_STRATEGY]**: confirm whether this is intentional).

---

## 6. Data flow: claim submission → fact-check result (traced in code)

1. Client `POST /api/verify` with `{text?, url?}` (`src/app/api/verify/route.ts`).
2. Route checks `DISABLE_PAID_ENDPOINTS` kill switch, then rate limit, then validates body against `VerifyRequestSchema`.
3. Opens a streamed `ReadableStream` response (`Content-Type: application/x-ndjson`) and calls `runVerifyPipeline` (`src/lib/pipeline.ts`), passing an `emit` callback that writes one JSON line per stage event as it actually begins (not simulated percentages).
4. **If a URL was provided**: `emit({stage:"fetching_url"})`, then `retrievePageText(url)` (`src/lib/pageRetrieval.ts`) → `safeFetch` (`src/lib/ssrfGuard.ts`) → cheerio-extracted readable text (max 6000 chars), appended to the submitted text.
5. `emit({stage:"extracting_claims"})` → `extractClaims(combinedContent, maxClaimsPerAnalysis)` (`src/lib/claimExtraction.ts`) → one Anthropic call (`EXTRACTION_MODEL`, default `claude-haiku-5-5`) via `callStructured` (forced-tool-use + Zod re-validation), wrapped in `<content>` tags with an explicit prompt-injection-resistance instruction.
6. For each extracted claim (up to `MAX_CLAIMS_PER_ANALYSIS`, default 5): `emit({stage:"searching", claimIndex, totalClaims, claimText})`.
   - If no Tavily key is configured, the claim is immediately marked `"לא ניתן לאימות"` (unverifiable) with an explicit reason — **no search is silently skipped or faked**.
   - Otherwise: 1–2 Tavily queries per claim (primary + optional English translation for Hebrew claims), each bounded by the overall `MAX_SEARCHES_PER_ANALYSIS` (default 8) budget shared across all claims in the request; results are boosted (never hard-filtered) toward Hebrew/Israeli sources and known fact-checker hosts; the top result per query additionally gets its **full page fetched** via `retrievePageText` (same SSRF guard) for a longer excerpt (max 600 chars stored). A guaranteed fallback search hard-restricted to mainstream Israeli news domains runs if a Hebrew claim still has zero Hebrew-script evidence.
   - Every result is registered in a per-request `EvidenceRegistry` with a stable id (`e1`, `e2`, ...).
   - `emit({stage:"comparing_sources"})` → `evaluateClaim(claim, evidenceForThisClaim)` (`src/lib/evaluation.ts`) — one Anthropic call (`EVALUATION_MODEL`, default `claude-sonnet-5-5`) per claim, evidence wrapped in `<evidence id="...">` tags; the model may only cite ids present in that claim's evidence list. **Code-level defense in depth**: `evaluateClaim` filters `supportingEvidenceIds`/`contradictingEvidenceIds` against the actual registry (`validIds`) after the LLM call returns, stripping any fabricated id before it can reach the report — this is enforced in `evaluation.ts` lines ~42–63, not just prompted.
7. `emit({stage:"preparing_report"})` → `buildReport(...)` (`src/lib/report.ts`) — one final Anthropic call synthesizing `overallAssessment`, `plainExplanation` (array of bullet points, not a paragraph), `limitations`, `openQuestions` from the **already-decided** classifications/evidence only (prompt explicitly forbids adding new facts or changing any claim's classification). Report gets a fresh `randomUUID()` and timestamp here.
8. `await saveReport(report)` (`src/lib/reportStore.ts`) — best-effort Supabase insert into `public.reports (id uuid, report jsonb)`; silently no-ops if Supabase isn't configured, and failures are logged but never thrown (verification result is still returned to the user either way).
9. Final `emit({type:"done", report, shareUrl: hasReportStorage() ? "/report/<id>" : null})`; stream closes.
10. Client (`useVerifyPipeline.ts`) consumes the NDJSON stream, updates UI stage-by-stage, and on `done` renders `ReportView` and persists an entry to `localStorage` history (`clientHistory.ts`).

Reading a shared report (`/report/[id]`) is a **separate, simpler path**: server component calls `getReportById(id)` → Supabase RPC `get_report_by_id(p_id)` (a `SECURITY DEFINER` function, not a direct table `select *` — see §5 of `supabase/migrations/20261017070000_...sql`) → Zod-validates the returned JSON against `ReportSchema` before rendering, discarding it (shows "not found") if it doesn't parse.

---

## 7. External services, operational dependencies, and risk points

| Service | Used for | Required? | Risk if unavailable / misconfigured |
|---|---|---|---|
| **Anthropic API** (Claude) | Claim extraction, claim evaluation, report synthesis, image OCR, AI-image visual opinion, trending-examples claim-picking | **Required** for any verification at all | Without `ANTHROPIC_API_KEY`: `/api/verify` and `/api/extract-image` fail with explicit 503/`PipelineError`; `/api/detect-ai-image` degrades gracefully (metadata scan still runs, `visualOpinion: null`) |
| **Tavily Search API** | Real web search for evidence gathering | Recommended, not required | Without a key: every claim is explicitly marked `"לא ניתן לאימות"` and the report is flagged `incomplete: true` — never fabricates search results (verified in `pipeline.ts`) |
| **Supabase (Postgres + RLS)** | Persisting shareable report permalinks (`reports` table) and feedback messages (`feedback_messages` table) | Optional (Phase 2 feature) | Without it: verification works fully, just no `/report/<id>` share link; feedback form returns a 503 (`hasFeedbackStorage()` false) |
| **Resend** | Email notification on new feedback submission | Optional | Without it: feedback is still saved to Supabase, just no email alert (`notifyNewFeedback` no-ops) |
| **Upstash Redis** | Durable, cross-instance rate limiting | Optional | Without it: rate limiting falls back to in-memory, per-serverless-instance counters — effective limit is higher than configured under Vercel's multi-instance default, and resets on cold start (explicitly documented as a known limitation in README and in code comments) |
| **Arbitrary third-party web pages** (via `ssrfGuard.safeFetch`) | Fetching content from (a) user-submitted URLs, (b) top search-result URLs, (c) fixed scraping targets (fakereporter.net, irrelevant.org.il) | N/A (core mechanism) | This is the **SSRF risk surface** called out explicitly in the brief — mitigated in `src/lib/ssrfGuard.ts` (protocol allowlist, DNS-resolved-IP validation including redirect hops, private/loopback/link-local/CGNAT/reserved range blocking, byte/timeout caps). **Does fetch arbitrary user-influenced URLs by design** (that's the product's core function: checking a URL the user pastes, and following top search-result links) — the mitigation is the SSRF guard, not avoidance of the pattern. This is flagged for later security testing, not tested here per the task's hard rules. |
| **fakereporter.net / irrelevant.org.il** | Source material for "trending examples" sidebar | Optional (best-effort, 24h cache, falls back to static list) | Layout/markup changes on these third-party sites would silently degrade `extractFakeReporterCandidates`/`extractIrrelevantCandidates` (cheerio selectors tied to current DOM structure) to zero candidates — fails safe (empty list → static fallback), not a crash |
| **Vercel** (hosting) | Production deployment, serverless function execution, env var storage | N/A | `maxDuration` values (120s for `/api/verify`, 60s for `/api/detect-ai-image`) are tuned against Vercel's Hobby/Pro timeout tiers per code comments — a different host could have different real limits |

---

## 8. Operations that could cost money, write data, or have external side effects

**Do not trigger these against production without explicit approval / a verified isolated environment:**

- `POST /api/verify` — 1 Anthropic claim-extraction call + up to `MAX_CLAIMS_PER_ANALYSIS` (5) × (1 Anthropic evaluation call + up to `MAX_SEARCHES_PER_ANALYSIS` (8, shared budget) Tavily calls + full-page fetches) + 1 Anthropic synthesis call. **Writes** a row to Supabase `reports` if configured. Real, metered external API cost per call.
- `POST /api/extract-image` — 1 Anthropic vision call (OCR). No data write (image is never persisted — confirmed in code: base64 is processed in memory only, never written to disk or DB).
- `POST /api/detect-ai-image` — 2–3 **parallel** Anthropic vision calls per request (self-consistency sampling, see `aiImageDetection.ts`) — notably more expensive per request than the other two routes. No data write.
- `POST /api/feedback` — **writes** a row to Supabase `feedback_messages`; if `RESEND_API_KEY` + `FEEDBACK_NOTIFICATION_EMAIL` are set, **sends a real email** via Resend to a real inbox. This is an explicit "do not trigger casually against production" item — a test submission would land in a real person's inbox.
- `GET /api/trending-examples` — on cache miss (first call per 24h per server instance), fetches two real external websites and makes an Anthropic call. Cached afterward; still a real external-service call on cold cache.
- Any call that reaches `retrievePageText`/`safeFetch` — makes a real outbound HTTP request to whatever URL is given (subject to the SSRF guard's allow/deny logic), including to arbitrary user-supplied URLs and top search-result URLs. Treat any "fetch a URL" test case as a real network request with real side effects on the target server (e.g., appearing in its access logs) even though it doesn't cost *this* app money beyond bandwidth/time.
- `DISABLE_PAID_ENDPOINTS=true` is a real operator control that returns 503 on the three paid routes — useful as an emergency brake, but flipping it in production (even temporarily) affects real users; changing it is a production configuration change, not a test action.

Operations that are **safe to call repeatedly without cost/side effects**: none of the five routes are side-effect-free when `Anthropic`/`Tavily`/`Supabase`/`Resend` are actually configured — this app has no genuinely free-of-cost route once real credentials are in place, other than requests that fail validation before reaching any external call (e.g., malformed JSON, schema violations, rate-limit rejections) or are served entirely from the 24h trending-examples cache.

---

## 9. Existing tests and tooling

- **Unit/component tests**: Vitest (`vitest.config.mts`, jsdom environment, Testing Library + `@testing-library/jest-dom`). 22 `*.test.ts`/`*.test.tsx` files under `src/`, covering nearly every `src/lib/*.ts` module 1:1 (e.g. `pipeline.test.ts`, `ssrfGuard.test.ts`, `ssrfGuard.safeFetch.test.ts`, `rateLimit.test.ts`, `evaluation.test.ts`, `claimExtraction.test.ts`, `reportStore.test.ts`, `feedbackStore.test.ts`, `trendingExamples.test.ts`, `aiImageDetection.test.ts`, `imageExtraction.test.ts`, `bidiVisualText.test.ts`, `types.test.ts`, `config.test.ts`) plus two component tests (`AiImageDetector.test.tsx`, `ReportView.test.tsx`). A rough `grep` count of `it(`/`test(` call sites across these files returns **~150** (the README states "100 unit/component tests" — the discrepancy is likely due to counting method, e.g. `describe`/`test.each` blocks, or the README being slightly stale; exact count needs `npm run test` output, which this phase did not run per the hard safety rules).
- **E2E tests**: Playwright (`playwright.config.ts`, single `e2e/main-journey.spec.ts` file, 4 scenarios): full claim-submission journey against a **mocked** `/api/verify` and `/api/trending-examples` (via `page.route`), mobile-viewport no-horizontal-scroll check, image-upload-with-low-confidence-warning journey against a mocked `/api/extract-image`, and an explicit error-state journey. Playwright's `webServer` config boots `npm run dev -- -p 3100` automatically — **all E2E tests run against mocked API routes, never real Anthropic/Tavily/Supabase calls** (confirmed by reading the spec file: every external-facing route used in the spec is intercepted with `page.route`).
- **Type checking**: `npm run typecheck` (`tsc --noEmit`).
- **Linting**: `npm run lint` (ESLint 9 flat config, `eslint-config-next`).
- **CI**: **No CI configuration found** — no `.github/workflows/` directory, no other CI config file (checked for `.gitlab-ci.yml`, `vercel.json` build hooks, etc. — none present). Tests appear to be run manually/locally only, or via Vercel's own build step (which runs `next build`, not `npm run test`/`test:e2e`) at deploy time. **[Open question]**: confirm whether Vercel project settings run any test step pre-deploy, or whether `main` can be deployed without tests passing.

---

## 10. Information gaps that prevent reliable testing

1. **No staging/preview environment confirmed from the repo.** No `vercel.json`, no documented preview-deployment workflow, no separate `.env.staging`. Whether Vercel preview deployments (one per PR/branch, a standard Vercel feature) are actually enabled for this project could not be verified from the filesystem — **this must be confirmed in the Vercel dashboard directly**, not from code. See `qa/SAFETY_AND_ENVIRONMENTS.md`.
2. **Actual rate limits in production are unknown from a black-box perspective.** `RATE_LIMIT_PER_IP_PER_HOUR` (default 20), `IMAGE_RATE_LIMIT_PER_IP_PER_HOUR` (default 10), feedback (hardcoded 10), trending-examples (hardcoded 60) are code *defaults* — the actual deployed values depend on `.env.local`/Vercel project env vars, which were only checked for **variable names present**, not values (per the hard safety rule against reading secrets). Whether `UPSTASH_REDIS_REST_URL`/`TOKEN` are set in production (durable limiting) or not (in-memory, per-instance, effectively much higher real limit under Vercel's multi-instance scaling) is unknown from static reading alone — `.env.local` in this checkout **does list `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID`, `TAVILY_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `FEEDBACK_NOTIFICATION_EMAIL` as configured names, but does NOT list `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`** — suggesting the durable rate limiter is likely not configured in this local dev env; production Vercel env vars were not and could not be inspected from this filesystem.
3. **`DISABLE_PAID_ENDPOINTS` current production value is unknown** — whether the kill switch is armed or not in production cannot be determined from the repo.
4. **Whether `feedback` / `trending-examples` routes being excluded from the `paidEndpointsDisabledResponse()` kill switch is intentional or an oversight** is unclear from the code/comments alone (trending-examples does make real Anthropic calls on cache miss, yet isn't covered by the same "emergency brake" as the other three LLM-calling routes).
5. **No CI pipeline** means there's no way to know, purely from the repo, whether `npm run test`/`npm run test:e2e`/`npm run typecheck`/`npm run lint` are required to pass before `main` deploys, or whether they're purely a local developer convenience. This affects how much confidence QA should place in "tests exist" as a regression safety net for changes landing in production.
6. **Live behavior of third-party scraping targets** (fakereporter.net, irrelevant.org.il structure) cannot be verified without an actual network call, which this phase did not make. Their current DOM structure matching the hardcoded cheerio selectors in `trendingExamples.ts` is unverified.
7. **Exact current Anthropic/Tavily model names, quotas, and billing tier** in use in production are only known as code defaults (`claude-haiku-5-5`, `claude-sonnet-5-5`) and could be overridden by env vars whose values were not read.
8. **Whether Vercel Preview Deployments are protected by Vercel's deployment-protection / password feature** (relevant for whether a tester could safely hit a preview URL without it being indexed/public) is unknown without checking the Vercel project settings directly.
