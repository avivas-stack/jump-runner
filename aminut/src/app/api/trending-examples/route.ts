import { getTrendingExamples } from "@/lib/trendingExamples";

export async function GET() {
  const examples = await getTrendingExamples();
  // No HTTP-level caching here: the server already caches the underlying work for
  // 24h in-memory (trendingExamples.ts). A long browser Cache-Control would risk a
  // client that happened to hit it before the first population replaying a stale
  // empty result for up to that long — always reflect the server's current cache.
  return Response.json({ examples }, { headers: { "Cache-Control": "no-store" } });
}
