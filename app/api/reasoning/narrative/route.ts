/**
 * POST /api/reasoning/narrative — 03-01 Task 1 (fallback-first tracer slice,
 * Pattern R5 route skeleton cloned from app/api/spike/stream/route.ts: Node
 * runtime, parse-boundary validation, closed-guard/safeClose SSE structure).
 *
 * THIS PLAN the route serves the deterministic fallback frame for every valid
 * request — the full typed-frame protocol (meta/delta/usage/rejected/
 * fallback/error/DONE) is final, but no meta/usage frames are fabricated here
 * and no upstream call exists yet. Plan 03-02 inserts the Super-120B upstream
 * stream + lints at the marked branch WITHOUT changing the protocol.
 *
 * Request bodies pass NarrativeRequestSchema (.strict()) — unknown or
 * misspelled fields are a 400 naming the first Zod issue (T-03-02, ASVS V5).
 * The response contains only the deterministic template built from the
 * caller's own session slice (T-03-03: no persistence, no logging here).
 */
import { criteria } from "@/lib/calc/criteria";
import { fallbackNarrative, fallbackNarrativeForIndication } from "@/lib/reasoning/fallback";
import { NarrativeRequestSchema } from "@/lib/reasoning/schemas";

export const runtime = "nodejs";

/**
 * LLM availability gate (exported for 03-02's route extension): true when the
 * explicit kill-switch is set OR no API key is configured. Naming per
 * 03-RESEARCH assumption A4 (FLAWCHECK_DISABLE_LLM).
 */
export function isLlmDisabled(): boolean {
  const kill = process.env.FLAWCHECK_DISABLE_LLM;
  return kill === "1" || kill === "true" || !process.env.NEBIUS_API_KEY;
}

export async function POST(req: Request) {
  // Parse-boundary validation (ASVS V5): reject bad bodies BEFORE anything.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "request body must be valid JSON" }, { status: 400 });
  }

  const parsed = NarrativeRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.length ? first.path.join(".") : "(root)";
    return Response.json(
      { error: `invalid narrative request: ${path}: ${first?.message ?? "unknown issue"}` },
      { status: 400 },
    );
  }

  const request = parsed.data;

  // Deterministic narration (this plan's only branch). 03-02 inserts the
  // upstream Super-120B stream + lints immediately AFTER this block, using
  // isLlmDisabled() / lint results to pick between the same frame types —
  // the protocol does not change.
  const fallbackText =
    request.kind === "cml"
      ? fallbackNarrative(request.reading, request.metadata)
      : fallbackNarrativeForIndication(request.indication, criteria.ptmt);

  const encoder = new TextEncoder();
  let closed = false;
  const sse = new ReadableStream({
    async pull(controller) {
      const safeEnqueue = (frame: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(frame));
        } catch {
          closed = true;
        }
      };
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed by cancel — nothing left to do
        }
      };

      safeEnqueue(
        `data: ${JSON.stringify({ type: "fallback", fallback: fallbackText, reason: "llm_disabled" })}\n\n`,
      );
      safeEnqueue("data: [DONE]\n\n");
      safeClose();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(sse, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
