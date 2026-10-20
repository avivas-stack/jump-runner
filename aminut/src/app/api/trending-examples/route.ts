import { NextRequest } from "next/server";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { paidEndpointsDisabledResponse } from "@/lib/config";
import { getTrendingExamples } from "@/lib/trendingExamples";

// Generous relative to the other routes — this endpoint takes no user input and is
// normally called once per page load — but still bounded, not left wide open.
const TRENDING_EXAMPLES_RATE_LIMIT_PER_HOUR = 60;

export async function GET(request: NextRequest) {
  // A cache-miss here calls the Anthropic API same as the other paid routes (see
  // trendingExamples.ts) — it just does so far less often (a 24h in-memory cache), which
  // is why this was previously missed when the kill switch was added elsewhere. The
  // client already treats any non-200 response as "no trending examples this time" and
  // falls back to its static list (Sidebar.tsx), so a 503 here is a safe no-op for users.
  const maintenance = paidEndpointsDisabledResponse();
  if (maintenance) return maintenance;

  const clientKey = clientKeyFromRequest(request);
  const rate = await checkRateLimit(`trending:${clientKey}`, TRENDING_EXAMPLES_RATE_LIMIT_PER_HOUR);
  if (!rate.allowed) {
    return Response.json({ examples: [] }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }

  const examples = await getTrendingExamples();
  // No HTTP-level caching here: the server already caches the underlying work for
  // 24h in-memory (trendingExamples.ts). A long browser Cache-Control would risk a
  // client that happened to hit it before the first population replaying a stale
  // empty result for up to that long — always reflect the server's current cache.
  return Response.json({ examples }, { headers: { "Cache-Control": "no-store" } });
}
