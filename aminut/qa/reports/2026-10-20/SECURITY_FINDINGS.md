# Facto — Security Findings (Phase C/D light static review), 2026-10-20

Scope: read-only static code review only, per the hard safety rules carried forward from
Phase A. No active exploitation, no scanning tool run against any live target. Severity
scale per the product owner's brief: **P0** critical / **P1** high / **P2** medium /
**P3** low. Every finding is labeled with its confidence level, as required.

---

## 1. SSRF protection (`src/lib/ssrfGuard.ts`)

**Confirmed by reading the code.**

The guard is a genuinely layered defense, not a single check:
- Protocol allowlist (`http:`/`https:` only); rejects embedded credentials in the URL.
- Blocks `localhost`, `*.localhost`, `metadata.google.internal` by hostname before any
  DNS lookup.
- Resolves the hostname via `dns.promises.lookup(..., { all: true })` and checks **every**
  returned A/AAAA record against private/loopback/link-local/CGNAT/reserved ranges — if
  *any* resolved address is blocked, the whole request is rejected (not just the first
  address), which specifically closes a multi-A-record DNS-rebinding trick.
- **Connects to the already-validated IP literal** (`host: connectIp` passed directly to
  `http(s).request`), not back to the hostname — this closes the classic TOCTOU/DNS-rebinding
  gap where validation and connection use two separate DNS lookups that could resolve
  differently.
- Re-validates every redirect hop through the same `assertSafeUrlShape` +
  `resolveSafeAddresses` path, capped at 3 redirects — a redirect to an internal address
  is rejected, not silently followed.
- Enforces a byte-size cap (destroys the socket mid-stream once exceeded) and a connect/
  response timeout.

**Finding SEC-01 (P3, theoretical risk, not verified)**: the IPv6 blocklist
(`isBlockedIPv6`) checks loopback, unspecified, link-local (`fe80::/10`), unique-local
(`fc00::/7`), and IPv4-mapped addresses, but does not explicitly check the 6to4
(`2002::/16`), Teredo (`2001::/32`), or NAT64 well-known prefix (`64:ff9b::/96`) ranges,
which can embed an IPv4 address (including a private one) inside a "public-looking" IPv6
literal. Whether any of these could realistically reach an internal address through this
app's specific network context (Vercel serverless functions) is unverified — flagged as a
hardening suggestion, not a demonstrated exploit path.

**Finding SEC-02 (P3, theoretical risk, not verified)**: numeric-hostname IP obfuscation
(decimal/octal/hex forms like `http://2130706433/` for `127.0.0.1`) is not explicitly
handled by this code — but the WHATWG URL parser that `new URL()` implements (used in
`assertSafeUrlShape`) already normalizes such forms to standard dotted-quad in
`.hostname` per spec, so this is very likely already closed as a side effect, not a gap.
Not independently re-verified with a live request (out of scope — would be active
probing), hence listed as "could not fully determine" rather than "confirmed safe."

**Overall assessment**: SSRF protection is well-designed defense-in-depth. No confirmed
bypass found by static review. Per the task's hard rules, no live exploitation attempt was
made to further validate this (that remains Phase E/staging-only work, as Phase A already
flagged).

## 2. XSS via untrusted fetched/evidence content

**Confirmed safe by reading the code.**

- Grepped all of `src/components/ReportView*.tsx` for `dangerouslySetInnerHTML`/`innerHTML`:
  **zero matches.** Evidence titles, excerpts, URLs, and claim text are rendered exclusively
  through normal JSX text interpolation (`{value}`), which React escapes by default.
- Three `dangerouslySetInnerHTML` sinks exist in the whole app, none of which take
  untrusted fetched/evidence content:
  1. `src/app/layout.tsx` — two pre-hydration bootstrap `<script>` tags
     (`A11Y_INLINE_BOOTSTRAP_SCRIPT`, `LANGUAGE_INLINE_BOOTSTRAP_SCRIPT`). Both are
     **static string literals** defined in source (`AccessibilityWidget.tsx`,
     `LanguageContext.tsx`) — the only dynamic value interpolated into either is a
     hardcoded localStorage key name via `JSON.stringify(A11Y_STORAGE_KEY)` /
     `JSON.stringify(LANGUAGE_STORAGE_KEY)`, both compile-time constants, not user or
     fetched input.
  2. `src/app/report/[id]/page.tsx` — the `ClaimReview` JSON-LD `<script
     type="application/ld+json">`. Built via `buildClaimReviewJsonLd()`, which only
     includes the classification label, dates, and the first 120 characters of the
     claim's own original text — run through `JSON.stringify(...).replace(/<\//g, "<\\/")`
     to prevent premature `</script>` closure. It does **not** include any evidence
     title/excerpt/URL text. This is a narrowly-scoped, correctly-mitigated sink.

**Finding SEC-03 (P3, informational, confirmed)**: the JSON-LD sink's `</`-escaping
mitigates the specific "break out of the script tag" vector, which is the realistic risk
for this sink (since `JSON.stringify` already escapes quotes/control characters for JSON
syntax itself). No further action needed; documented here only so it's recorded as
checked, not assumed safe.

## 3. Rate limiting coverage and the `DISABLE_PAID_ENDPOINTS` kill switch

**Confirmed by reading every route handler** (`src/app/api/*/route.ts`).

| Route | Rate-limited? | Gated by `DISABLE_PAID_ENDPOINTS`? | Makes a real Anthropic/Tavily call? |
|---|---|---|---|
| `POST /api/verify` | Yes | **Yes** | Yes (multiple) |
| `POST /api/extract-image` | Yes | **Yes** | Yes |
| `POST /api/detect-ai-image` | Yes | **Yes** | Yes |
| `POST /api/feedback` | Yes (separate 10/hr budget) | **No** | No (Supabase write + optional Resend email only) |
| `GET /api/trending-examples` | Yes (separate 60/hr budget) | **No** | **Yes, on cache miss** — `getTrendingExamples()` calls `callStructured(...)` (confirmed: `src/lib/trendingExamples.ts` imports and calls `callStructured` from `./anthropic`) |

**Finding SEC-04 (P2, confirmed)**: this resolves Phase A's open question. `/api/feedback`
being exempt from the kill switch is correct and intentional (it costs no paid-API money).
**`/api/trending-examples` being exempt is a real gap**: it does make a real, billed
Anthropic call on every 24h cache-miss per server instance, identically to the three
routes the kill switch *does* cover, but `DISABLE_PAID_ENDPOINTS=true` would not stop it.
Under the exact "viral traffic cost spike" scenario the kill switch's own code comment
describes as its reason to exist, an operator flipping it would still see
`trending-examples` keep spending on every cache-miss across however many serverless
instances are cold. Low realistic cost (one call per instance per 24h, not per-request),
but it undermines the stated guarantee of what the kill switch covers. **Recommendation**:
add the same `paidEndpointsDisabledResponse()` check to `trending-examples/route.ts` (it
already degrades gracefully to the static fallback list on any failure, so a 503-equivalent
here is a very low-risk change — or simpler, have it return the static fallback directly
when the switch is set, skipping the API call without erroring the route at all).

**Finding SEC-05 (P3, confirmed, informational)**: `clientKeyFromRequest()` correctly
takes the **last** entry of `X-Forwarded-For` (the trusted-proxy-appended value), not the
first (client-controlled) one — this is the right mitigation for the common
spoofing mistake, assuming the deployment is genuinely always behind exactly one trusted
proxy (true for Vercel's standard setup). When neither `X-Forwarded-For` nor `X-Real-IP`
is present, the key falls back to the literal string `"unknown"`, which buckets every such
client into one shared rate-limit counter. This is very unlikely to be reachable in normal
Vercel traffic (Vercel's edge always sets `X-Forwarded-For`), so real-world risk is low —
flagged as Phase A already did (S-10), not newly discovered, and not verified against the
actual production edge configuration (out of scope).

## 4. Evidence-id fabrication defense (`src/lib/evaluation.ts`)

**Confirmed by reading the code.** `evaluateClaim()` builds `validIds` from the evidence
list it actually passed to the model, then filters both `supportingEvidenceIds` and
`contradictingEvidenceIds` returned by the LLM against that set before they ever reach the
report (lines ~42–56). This is enforced at the code level, independent of whether the
model honors the system prompt's instruction not to invent ids — genuine defense in depth,
not just a prompt-level ask. The real-call injection probes run for this phase (see
`AI_EVALUATION.md`) are consistent with the model also honoring the instruction in
practice, but the code-level filter means it wouldn't matter if it didn't.

## 5. Secrets handling — never reach the client

**Confirmed by reading every API route's response shape and the client-side code.**

- Every route handler (`verify`, `extract-image`, `detect-ai-image`, `feedback`,
  `trending-examples`) returns only application data (`{error}`, `{report, shareUrl}`,
  `{extractedText, confidence, uncertainNotes}`, `{credentialsMarkers, visualOpinion,
  visualOpinionFailed}`, `{ok:true}`, `{examples}`) — no response includes any env var,
  API key, or internal config value.
- `src/lib/anthropic.ts`, `pageRetrieval.ts`/`ssrfGuard.ts`, `reportStore.ts`,
  `feedbackStore.ts` are all plain server-side modules under `src/lib/`, never imported by
  any `"use client"` file (spot-checked via import graph: client components only import
  `@/lib/types`, `@/lib/clientHistory`, `@/lib/clientImageUpload`, `@/lib/i18n/*` — none of
  which touch `config.ts`'s secret fields).
- Error paths consistently log the real (vendor) error server-side via `console.error(...)`
  and return a separate, hand-written generic Hebrew message to the client (confirmed in
  `verify/route.ts`, `extract-image/route.ts`) — vendor error text (which could leak
  internal detail) is never forwarded verbatim in an HTTP response body.
- **Not verified in this phase** (confirmed out of scope by Phase A and carried forward):
  a post-`npm run build` grep of the actual shipped client JS bundle for leaked secret
  substrings (S-09). This phase did not run `npm run build`. This is a **"could not
  determine in this phase"** item, not a "confirmed safe" one — the source-level review
  above is strong indirect evidence, but it is not the same guarantee as inspecting the
  literal shipped bytes.

## Summary table

| ID | Area | Severity | Confidence |
|---|---|---|---|
| SEC-01 | SSRF: IPv6 6to4/Teredo/NAT64 forms not explicitly blocked | P3 | Theoretical, not verified |
| SEC-02 | SSRF: numeric/obfuscated IP hostnames | P3 | Likely already mitigated by URL parser; not independently re-verified |
| SEC-03 | JSON-LD sink scope/mitigation | P3 (informational) | Confirmed by reading code |
| SEC-04 | `trending-examples` not gated by `DISABLE_PAID_ENDPOINTS` despite making real Anthropic calls | **P2** | Confirmed by reading code |
| SEC-05 | Missing-XFF requests bucket into one shared `"unknown"` rate-limit key | P3 | Confirmed by reading code; real-world reachability unverified |
| — | SSRF guard overall design | — (no finding — confirmed sound) | Confirmed by reading code |
| — | XSS via evidence/fetched content | — (no finding — confirmed safe) | Confirmed by reading code |
| — | Evidence-id fabrication defense | — (no finding — confirmed sound) | Confirmed by reading code |
| — | Secrets never in API responses or client-reachable modules | — (no finding — confirmed safe at source level) | Confirmed by reading code (source-level only; not build-output-verified) |
| — | Shipped client bundle secret scan | — (not performed) | Could not determine — needs `npm run build`, out of this phase's scope |

No P0 or P1 findings from this review. The one P2 (SEC-04) is a cost-control/operational
gap, not a data-exposure or exploitation vector.
