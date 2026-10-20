# Facto (אמינות) — Safety & Environments (Phase A)

This document is a factual inventory of what environments exist or could exist, based
purely on what's checkable from the local filesystem/repo. It does **not** state
Vercel project settings, DNS records, or anything else that requires logging into an
external dashboard — those are explicitly called out as open questions below.

## 1. Is there a staging environment?

**Not confirmed from the repository.** Specifically checked and not found:

- No `vercel.json` in the repo (would sometimes encode environment-specific config, build commands, or regions).
- No `.vercel/` directory in this checkout (expected: it's gitignored via `.gitignore`'s `# vercel` / `.vercel` line — its absence here just means this particular local checkout was never linked with `vercel link`, it says nothing about whether the project has staging/preview deployments configured on Vercel's side).
- No `.env.staging`, `.env.production`, or any environment-suffixed env file — only `.env.example` (template, no values) and `.env.local` (real local dev values, gitignored).
- No CI config (`.github/workflows/`, `.gitlab-ci.yml`, etc.) that might reference a staging deploy step or environment name.
- No references in code/README to a staging URL, a second Supabase project, or a "test mode" flag beyond the generic `DISABLE_PAID_ENDPOINTS` kill switch (which disables paid routes everywhere it's set, it is not an environment selector).

**What this means**: Vercel's standard behavior is to auto-generate a **Preview Deployment** for every git branch/PR pushed to a connected repo, separate from the Production deployment tied to `main`. Whether that standard behavior is active for this project — and whether preview deployments share the *same* production Supabase/Anthropic/Tavily/Resend credentials (common default, and risky if so) or have their own — **cannot be determined from this repository** and must be checked directly in the Vercel project's dashboard (Settings → Environments / Settings → Environment Variables, checking which vars are scoped to Production vs. Preview vs. Development).

**Open question for the user**: Please confirm, from the Vercel dashboard directly:
1. Are Preview Deployments enabled for this project?
2. Do Preview Deployments use separate API keys/Supabase project from Production, or the same ones?
3. Is there any password/SSO protection on preview URLs (Vercel's Deployment Protection feature), or are they publicly reachable the same as production?

## 2. Environments that exist (as far as this phase can confirm)

| Environment | Confirmed how | Safe to test against? |
|---|---|---|
| **Local dev** (`npm run dev`, port 3000; or Playwright's own port 3100) | `package.json` scripts, `playwright.config.ts` | **Yes**, with the caveat that `.env.local` in this checkout currently has real credential *names* populated (see below) — whether the *values* are real production keys, separate low-volume test keys, or placeholders was not and should not be checked by reading them. Treat local dev as "safe for mocked/UI tests always; safe for real-API tests only if the owner confirms the configured keys are a test/sandboxed tier, not shared production billing." |
| **Vitest unit/component tests** (`npm run test`) | `vitest.config.mts`, 22 test files | **Yes, always safe** — per the project's own README, these run entirely against mocks, no real network calls |
| **Playwright E2E** (`npm run test:e2e`) | `playwright.config.ts`, `e2e/main-journey.spec.ts` | **Yes, always safe** — confirmed by reading the spec file: every external-facing API route it touches (`/api/verify`, `/api/extract-image`, `/api/trending-examples`) is intercepted via `page.route(...)` before the real route handler would run any external call. It does boot a real local Next.js dev server, but that server is only ever called by the mocked routes in-test. |
| **Production** (`https://aminut-il.vercel.app`, per user-supplied context) | Not inspected directly in this phase (no network calls made) | **No** — any test that writes data (feedback, reports), sends email, or incurs real Anthropic/Tavily spend requires explicit approval per the task's own rules, scenario by scenario. Passive, read-only checks (e.g., confirming response headers on a normal page load, viewing the public homepage) are lower-risk but still should be confirmed with the user first since this is a live, public product. |
| **Staging / Preview** | **Unconfirmed, see §1** | Unknown until confirmed to exist and to use isolated credentials |

## 3. Env var names found (names only — no values read beyond confirming they're non-empty placeholders where applicable)

From `.env.example` (template, committed, no real values — safe to read in full):

```
ANTHROPIC_API_KEY
ANTHROPIC_WORKSPACE_ID
TAVILY_API_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
# commented-out tuning vars with example defaults shown in comments:
EXTRACTION_MODEL
EVALUATION_MODEL
MAX_SEARCHES_PER_ANALYSIS
MAX_CLAIMS_PER_ANALYSIS
MAX_RESULTS_PER_SEARCH
MAX_PAGE_FETCH_BYTES
FETCH_TIMEOUT_MS
RATE_LIMIT_PER_IP_PER_HOUR
```

From `src/lib/config.ts`'s Zod schema (the authoritative full list, since `.env.example` doesn't mention every var the code actually reads):

```
ANTHROPIC_API_KEY
ANTHROPIC_WORKSPACE_ID
TAVILY_API_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
EXTRACTION_MODEL
EVALUATION_MODEL
MAX_SEARCHES_PER_ANALYSIS
MAX_CLAIMS_PER_ANALYSIS
MAX_RESULTS_PER_SEARCH
MAX_PAGE_FETCH_BYTES
FETCH_TIMEOUT_MS
RATE_LIMIT_PER_IP_PER_HOUR
IMAGE_RATE_LIMIT_PER_IP_PER_HOUR
MAX_IMAGE_BYTES
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
DISABLE_PAID_ENDPOINTS
RESEND_API_KEY
FEEDBACK_NOTIFICATION_EMAIL
```

From `.env.local` in this checkout (names only — confirmed present, values not read or reproduced anywhere in this document or elsewhere):

```
ANTHROPIC_API_KEY        — present
ANTHROPIC_WORKSPACE_ID   — present
TAVILY_API_KEY           — present
SUPABASE_URL             — present
SUPABASE_ANON_KEY        — present
RESEND_API_KEY           — present
FEEDBACK_NOTIFICATION_EMAIL — present
```

**Notably absent from `.env.local`**: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `DISABLE_PAID_ENDPOINTS`, and all the numeric tuning overrides (so this local checkout runs on code defaults for those, e.g. in-memory rate limiting rather than Upstash-backed). **This says nothing about what's configured in the actual Vercel production project's environment variables** — those were not and could not be inspected from this filesystem. This is the single biggest reason rate-limiting test results from local dev should not be assumed to carry over to production.

## 4. What would need explicit approval before active/costly/external-facing testing

All of the following require the user's explicit, scenario-specific go-ahead — not a one-time blanket approval — per the task's own hard safety rules:

1. **Any test that submits real data to the production Supabase project** (a real claim-verification that gets saved as a `reports` row, or any `/contact` form submission that becomes a `feedback_messages` row) against `https://aminut-il.vercel.app`. A test/sandbox Supabase project should be used instead wherever possible (see PROJECT_MAP §10, item 1 — whether one already exists is unconfirmed).
2. **Any test that could trigger a real Resend email** to `FEEDBACK_NOTIFICATION_EMAIL` — this is a real inbox notification, not a sandboxed action, regardless of environment, unless a disposable test inbox + separate Resend key is explicitly set up for testing.
3. **Load/performance testing of any kind** (section J of `TEST_STRATEGY.md`) — every meaningful request in this app costs real, metered Anthropic/Tavily spend with no caching layer in front of it; concurrent/sustained testing without a budget ceiling and the `DISABLE_PAID_ENDPOINTS` kill switch rehearsed beforehand could run up a real bill quickly. Requires a verified isolated environment **and** an explicit cost ceiling agreed with the user beforehand.
4. **Active SSRF probing** (attempting to actually reach internal/metadata endpoints through the app's URL-fetching features) — this is testing the app's own defenses by trying to defeat them, which should happen in an isolated environment the user has explicitly sanctioned for this purpose, never against the production deployment, since a successful bypass could expose real internal infrastructure (if the hosting platform has any reachable from the function's network context).
5. **Any Supabase RLS probing that issues raw `UPDATE`/`DELETE`/broad `SELECT` calls using the anon key** — even though README claims this was already verified live once, re-verification should happen against a disposable/test Supabase project, never the production one, since a mistake in a test script here is literal data tampering or a real data-exposure incident, not a simulated one.
6. **Security scanning tools** (automated vulnerability scanners, fuzzers) pointed at the production URL — these generate high request volumes and unpredictable payloads; explicit approval and a pre-agreed scope/rate ceiling is needed, and a staging environment is strongly preferable if one exists.
7. **Changing `DISABLE_PAID_ENDPOINTS` or any other production environment variable** — this is a production configuration change, not a test action, and is out of scope for this QA engagement entirely unless the user explicitly directs it.
8. **Real third-party web requests as part of SSRF-guard or trending-examples testing** that target domains Claude/the tester doesn't control — e.g., re-running `getTrendingExamples()` against the real fakereporter.net/irrelevant.org.il in a tight loop would be an unapproved, unnecessary load on a third party's site; a handful of real calls to confirm the scrape still works is reasonable, repeated/automated hits are not.

## 5. What is safe to test immediately, with zero production impact

- All 22 Vitest unit/component test files (`npm run test`) — entirely mocked, no network calls, already exist.
- All 4 Playwright E2E scenarios (`npm run test:e2e`) — entirely mocked API routes, runs against a local dev server only.
- Any new unit/component test added for scenarios identified in `TEST_STRATEGY.md` that can be written against mocks (most of section D "Abnormal input & error handling", and the pure-validation items in section I).
- `npm run typecheck` and `npm run lint` — static analysis only.
- Local dev server manual exploration of UI/UX, RTL, mobile-viewport, accessibility scenarios (sections G and H of `TEST_STRATEGY.md`) that don't require real backend responses — can be done against either the mocked E2E harness or a locally running dev server with intentionally-absent/invalid API keys (which exercises the app's own "no credentials configured" graceful-degradation paths, itself a useful and currently real test target, e.g. F-08, E-14).
- Static/manual code-level security review items (confirming `dangerouslySetInnerHTML` usage, confirming RLS policy files match what's described, confirming header configuration in `next.config.ts`) — pure reading, no execution needed, already substantially done in `PROJECT_MAP.md` §7 and `TEST_STRATEGY.md` §E.
- Synthetic, local-only tests of `scanForProvenanceMarkers` (F-20) — pure string matching, no API calls, can construct test fixtures locally.
- Passive checks against production that involve nothing more than a normal page load a real visitor would also do (checking response headers, viewing public pages, confirming RTL/lang attributes) — lower risk, but still worth a quick confirmation with the user first given this is a live product, per the instruction-source-boundary and general caution around a live public site.

## 6. Where this phase stopped short (by design, per the hard safety rules)

- **No `npm install`/`npm run build`/`npm run dev`/`npm run test`/`npm run test:e2e` was executed.** All test counts, behaviors, and "this is mocked" claims in `TEST_STRATEGY.md` and `PROJECT_MAP.md` are derived from **reading** the test files' source code, not from running them. The actual pass/fail status of the existing test suite is therefore unverified by this phase — a natural first real action for whoever executes Phase B.
- **No real API calls were made** to Anthropic, Tavily, Supabase, or Resend — so no live-system behavior (e.g., actual classification output for a real claim, actual RLS enforcement under a real anon key) was confirmed in this phase; everything about those systems' *configured* behavior comes from reading code/migrations only. The README's own claims of having previously run live acceptance tests against real keys (e.g. the RLS UPDATE/DELETE check) were **not** re-verified here and should be treated as a historical claim, not a current guarantee.
- **The Vercel project dashboard was not and could not be accessed** from this filesystem-only investigation — all statements about "no CI," "no staging confirmed," etc. are statements about what's in the git repository, not about what's configured in Vercel/Supabase/Resend/Anthropic/Tavily's own dashboards. Several open questions in `PROJECT_MAP.md` §10 explicitly depend on that dashboard access instead.
