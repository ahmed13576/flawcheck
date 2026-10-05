/**
 * POST /api/report/pdf — 04-02 Task 2: validate the full snapshot with the
 * WR-10 strict schema (no casts), gate on the complete four-field sign-off,
 * and render a genuine selectable-text PDF via @react-pdf/renderer.
 *
 * 400 for: oversized body, malformed JSON, schema violations (incl. snapshot
 * absent and incomplete sign-off) — never a 500 for bad input. The only 500
 * path is an unexpected render failure. (UI-50)
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { buildPdfDocument } from "@/components/report/pdf-document";
import { ReportPdfRequestSchema } from "@/lib/report/snapshot-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 25 * 1024 * 1024; // mirrors the Phase 2 upload cap

function errorJson(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return errorJson("request body exceeds the 25 MB ceiling", 400);
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return errorJson("request body must be valid JSON", 400);
  }

  const parsed = ReportPdfRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.length ? first.path.join(".") : "(root)";
    return errorJson(`invalid report payload: ${path}: ${first?.message ?? "unknown issue"}`, 400);
  }

  const { snapshot, audit } = parsed.data;
  const signOff = snapshot.signOff ?? null;
  if (
    !signOff ||
    signOff.name.length === 0 ||
    signOff.certification.length === 0 ||
    signOff.date.length === 0 ||
    signOff.signature.length === 0
  ) {
    return errorJson(
      "report requires a complete inspector sign-off (name, certification, date, signature)",
      400,
    );
  }

  try {
    const buffer = await renderToBuffer(buildPdfDocument(snapshot, audit ?? null));
    const sourceSafe = snapshot.sourceName.replace(/[^a-zA-Z0-9._-]/g, "_");
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="flawcheck-report-${dateOnly(snapshot.evaluatedAt)}-${sourceSafe}.pdf"`,
      },
    });
  } catch (e) {
    console.error("[api/report/pdf] render failure:", e instanceof Error ? e.message : String(e));
    return errorJson("PDF render failed", 500);
  }
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}
