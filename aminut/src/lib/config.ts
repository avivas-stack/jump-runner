import { z } from "zod";

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  // Only needed for a personal/user-scoped Anthropic API key that isn't tied to one
  // workspace (the API returns an explicit "anthropic-workspace-id header" error
  // naming this exact requirement). A standard sk-ant-api03-... workspace key never
  // needs this. Find it in the Anthropic Console under Settings -> Workspaces.
  ANTHROPIC_WORKSPACE_ID: z.string().optional(),
  TAVILY_API_KEY: z.string().min(1).optional(),
  // Optional: enables persisted, shareable report permalinks (Phase 2). Without
  // these, verification still works end-to-end; reports just aren't shareable by URL.
  SUPABASE_URL: z.string().min(1).optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  EXTRACTION_MODEL: z.string().default("claude-haiku-5-5"),
  EVALUATION_MODEL: z.string().default("claude-sonnet-5-5"),
  MAX_SEARCHES_PER_ANALYSIS: z.coerce.number().int().positive().default(8),
  MAX_CLAIMS_PER_ANALYSIS: z.coerce.number().int().positive().default(5),
  MAX_RESULTS_PER_SEARCH: z.coerce.number().int().positive().default(5),
  MAX_PAGE_FETCH_BYTES: z.coerce.number().int().positive().default(1_500_000),
  FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  RATE_LIMIT_PER_IP_PER_HOUR: z.coerce.number().int().positive().default(20),
  IMAGE_RATE_LIMIT_PER_IP_PER_HOUR: z.coerce.number().int().positive().default(10),
  MAX_IMAGE_BYTES: z.coerce.number().int().positive().default(5_000_000),
  // Optional: when both are set, rate limiting uses this durable, shared-across-instances
  // store (Upstash's free tier covers this comfortably) instead of in-memory counters that
  // reset per serverless instance. Connect the "Upstash for Redis" integration from the
  // Vercel dashboard (Storage tab) to get these automatically — no code change needed.
  UPSTASH_REDIS_REST_URL: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  // Emergency brake for a viral-traffic cost spike: rate limiting here is in-memory and
  // per-serverless-instance (not a durable/global store), so it can't actually cap total
  // spend under real concurrent load across many instances. Setting this lets whoever
  // holds the Vercel project flip the paid endpoints off (a 503, not a crash) without
  // writing or shipping any code, as a stopgap until a durable global limiter is in place.
  DISABLE_PAID_ENDPOINTS: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  // Optional: when set, a new feedback/bug-report submission also sends an email
  // notification via Resend. Without it, feedback is still saved to Supabase — it's
  // just not actively surfaced anywhere.
  RESEND_API_KEY: z.string().min(1).optional(),
  FEEDBACK_NOTIFICATION_EMAIL: z.string().min(1).optional(),
});

function loadEnv() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Only used for defaulted/optional config; never throws for missing API keys,
    // since those are checked explicitly at the point of use with a user-facing error.
    return EnvSchema.parse({});
  }
  return parsed.data;
}

export const env = loadEnv();

export const config = {
  anthropicApiKey: env.ANTHROPIC_API_KEY,
  anthropicWorkspaceId: env.ANTHROPIC_WORKSPACE_ID,
  tavilyApiKey: env.TAVILY_API_KEY,
  supabaseUrl: env.SUPABASE_URL,
  supabaseAnonKey: env.SUPABASE_ANON_KEY,
  extractionModel: env.EXTRACTION_MODEL,
  evaluationModel: env.EVALUATION_MODEL,
  maxSearchesPerAnalysis: env.MAX_SEARCHES_PER_ANALYSIS,
  maxClaimsPerAnalysis: env.MAX_CLAIMS_PER_ANALYSIS,
  maxResultsPerSearch: env.MAX_RESULTS_PER_SEARCH,
  maxPageFetchBytes: env.MAX_PAGE_FETCH_BYTES,
  fetchTimeoutMs: env.FETCH_TIMEOUT_MS,
  rateLimitPerIpPerHour: env.RATE_LIMIT_PER_IP_PER_HOUR,
  imageRateLimitPerIpPerHour: env.IMAGE_RATE_LIMIT_PER_IP_PER_HOUR,
  maxImageBytes: env.MAX_IMAGE_BYTES,
  disablePaidEndpoints: env.DISABLE_PAID_ENDPOINTS,
  upstashRedisRestUrl: env.UPSTASH_REDIS_REST_URL,
  upstashRedisRestToken: env.UPSTASH_REDIS_REST_TOKEN,
  resendApiKey: env.RESEND_API_KEY,
  feedbackNotificationEmail: env.FEEDBACK_NOTIFICATION_EMAIL,
};

export function hasDurableRateLimitStore(): boolean {
  return Boolean(config.upstashRedisRestUrl && config.upstashRedisRestToken);
}

export function hasLlmCredentials(): boolean {
  return Boolean(config.anthropicApiKey);
}

export function hasSearchCredentials(): boolean {
  return Boolean(config.tavilyApiKey);
}

export function hasReportStorage(): boolean {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

export function hasFeedbackNotifications(): boolean {
  return Boolean(config.resendApiKey && config.feedbackNotificationEmail);
}

/**
 * Checked first thing by every route that triggers paid API calls (Anthropic, Tavily).
 * Returns a ready-to-send 503 when DISABLE_PAID_ENDPOINTS is set, null otherwise — see
 * that env var's comment above for why this exists.
 */
export function paidEndpointsDisabledResponse(): Response | null {
  if (!config.disablePaidEndpoints) return null;
  return Response.json({ error: "השירות מושבת זמנית לתחזוקה. נסו שוב בקרוב." }, { status: 503 });
}
