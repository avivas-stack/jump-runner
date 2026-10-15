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
};

export function hasLlmCredentials(): boolean {
  return Boolean(config.anthropicApiKey);
}

export function hasSearchCredentials(): boolean {
  return Boolean(config.tavilyApiKey);
}

export function hasReportStorage(): boolean {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}
