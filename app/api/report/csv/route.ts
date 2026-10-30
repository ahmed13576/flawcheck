import { buildCmlSummaries } from "@/lib/calc/cml-summary";
import { cmlSummariesToCanonicalCsv, sha256HexFromCanonicalCsv } from "@/lib/report/canonical-csv";
import { ReportSnapshotSchema } from "@/lib/report/snapshot-schema";
import { checkRateLimit, clientIp, rateLimitedResponse } from "@/lib/api/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorJson(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const rl = checkRateLimit(clientIp(req));
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);
  let body: unknown;
  try { body = await req.json(); } catch { return errorJson("request body must be valid JSON", 400); }
  const rawSnapshot = (body && typeof body === "object" && "snapshot" in body) ? (body as { snapshot: unknown }).snapshot : body;
  const parsed = ReportSnapshotSchema.safeParse(rawSnapshot);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.length ? first.path.join(".") : "(root)";
    return errorJson(`invalid report payload: ${path}: ${first?.message ?? "unknown issue"}`, 400);
  }
  const csv = cmlSummariesToCanonicalCsv(buildCmlSummaries(parsed.data.readings, parsed.data.metadata.gaugeUncertainty));
  const seal = sha256HexFromCanonicalCsv(csv);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"wbt-s6-canonical-cml-register.csv\"",
      "X-FlawCheck-CSV-SHA256": seal,
    },
  });
}
