/**
 * GET /api/tavily — 05-01 (PLAT-03): post-acceptance code-edition/errata
 * lookup for the /report screen. One basic Tavily search per evaluation
 * (cached by evaluatedAt inside lib/tavily/lookup), 3 s timeout, degrades
 * to `{ results: null }` on timeout/failure/absent TAVILY_API_KEY — never
 * blocks the report. Results link OUT to sources only (cite-don't-quote:
 * code text is never re-served, only titles + URLs).
 */
import { tavilyCodeEditionLookup } from "@/lib/tavily/lookup";
import { checkRateLimit, clientIp, rateLimitedResponse } from "@/lib/api/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const rl = checkRateLimit(clientIp(req));
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  const url = new URL(req.url);
  const designCode = (url.searchParams.get("designCode") ?? "").trim();
  const evaluatedAt = (url.searchParams.get("evaluatedAt") ?? "").trim();
  if (
    designCode.length === 0 ||
    designCode.length > 64 ||
    evaluatedAt.length === 0 ||
    evaluatedAt.length > 40
  ) {
    return Response.json(
      { error: "designCode and evaluatedAt are required" },
      { status: 400 },
    );
  }

  const result = await tavilyCodeEditionLookup(designCode, evaluatedAt);
  return Response.json(result);
}
