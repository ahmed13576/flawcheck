/**
 * POST /api/reasoning/narrative — 03-01 Task 1 fallback-first tracer slice,
 * extended by 03-02 Task 2 with the ENABLED path (Pattern R5 route skeleton
 * cloned from app/api/spike/stream/route.ts: Node runtime, parse-boundary
 * validation, closed-guard/safeClose SSE structure).
 *
 * Frame protocol (final since 03-01; unchanged): meta/delta/usage/rejected/
 * fallback/error/[DONE]. Route selection:
 *   - isLlmDisabled()            → fallback frame (`llm_disabled`) + [DONE]
 *   - enabled, cml, no extraction → 422 (Pitfall 5: narration without the
 *                                  structured context pack is the garbage-in
 *                                  failure SC1 forbids)
 *   - enabled                    → Super-120B upstream stream relayed through
 *                                  the sentence-level numeric guard; at stream
 *                                  end the four final lints decide between a
 *                                  usage frame and a rejected frame (rejected
 *                                  narratives never carry usage metrics).
 *
 * Open-question resolution 1 (UI-29 vs UI-42): sentence-level mid-stream
 * numeric guard + final verdict/verbatim/citation lints + swap-to-fallback —
 * a contradicting sentence is never relayed; a rejected narrative swaps to the
 * deterministic fallback. Streaming resolution: mid-stream guard; strict
 * buffer-then-serve is the contained alternative (research A1).
 */
import { criteria } from "@/lib/calc/criteria";
import { getClient } from "@/lib/llm/client";
import { getReasoningModel } from "@/lib/llm/config";
import {
  NARRATIVE_SYSTEM_PROMPT,
  buildNarrativeUserPrompt,
} from "@/lib/reasoning/prompts";
import { buildNarrativeContext } from "@/lib/reasoning/narrative-context";
import {
  fallbackNarrative,
  fallbackNarrativeForIndication,
  VERDICT_LABELS,
} from "@/lib/reasoning/fallback";
import { runFinalLints, sentenceRelayCutoff, numericConsistency } from "@/lib/reasoning/lints";
import { NarrativeRequestSchema, isLlmDisabled } from "@/lib/reasoning/schemas";

export const runtime = "nodejs";

export { isLlmDisabled };

/** citations.json prose corpus for the verbatim n-gram lint. */
function citationCorpus(): string[] {
  return criteria.citations.flatMap((c) => [c.title, c.scope_note]);
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

  // Pitfall 5 (SC1): the enabled cml path is structurally impossible without
  // a valid extraction pack — 422 BEFORE any upstream call.
  if (!isLlmDisabled() && request.kind === "cml" && request.extraction === null) {
    return Response.json(
      { error: "narration requires a non-null extraction pack (run /api/reasoning/extract first)" },
      { status: 422 },
    );
  }

  // Deterministic fallback text — served verbatim on the disabled branch and
  // swapped in on every rejected frame.
  const fallbackText =
    request.kind === "cml"
      ? fallbackNarrative(request.reading, request.metadata, request.metadata.metadataUnit)
      : fallbackNarrativeForIndication(request.indication, criteria.ptmt);

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
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
      const send = (obj: unknown) => safeEnqueue(`data: ${JSON.stringify(obj)}\n\n`);

      // ---- Disabled branch (03-01 contract, preserved) -----------------
      if (isLlmDisabled()) {
        send({ type: "fallback", fallback: fallbackText, reason: "llm_disabled" });
        safeEnqueue("data: [DONE]\n\n");
        safeClose();
        return;
      }

      // ---- Enabled path -------------------------------------------------
      const ctx =
        request.kind === "cml"
          ? buildNarrativeContext({
              kind: "cml",
              reading: request.reading,
              metadata: request.metadata,
              metadataUnit: request.metadata.metadataUnit, // CR-03: convert to canonical mm
              extraction: request.extraction,
              history: request.history,
              thresholds: criteria.ptmt,
            })
          : buildNarrativeContext({
              kind: "ptmt",
              indication: request.indication,
              extraction: null,
              thresholds: criteria.ptmt,
            });
      const verdict = request.kind === "cml" ? request.reading.verdict : request.indication.verdict;
      const verdictLabel = VERDICT_LABELS[verdict];
      const lintCtx = {
        allowedNumbers: ctx.allowedNumbers,
        allowedCitationIds: ctx.allowedCitationIds,
        verdict,
        corpus: citationCorpus(),
      };

      const startedAt = Date.now();
      let upstream: Awaited<ReturnType<typeof openStream>>;
      try {
        upstream = await openStream(request, ctx, verdictLabel, req.signal);
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
        safeEnqueue("data: [DONE]\n\n");
        safeClose();
        return;
      }

      // Sentence-guarded relay: the completed-sentence prefix is linted then
      // relayed BYTE-EXACT (sentenceRelayCutoff preserves separators); the
      // trailing fragment stays buffered until the final lints pass.
      let relayed = "";
      let buffer = "";
      let usage: { prompt_tokens?: number; completion_tokens?: number } | null = null;
      try {
        for await (const chunk of upstream) {
          const u = (chunk as { usage?: { prompt_tokens?: number; completion_tokens?: number } })
            .usage;
          if (u) usage = u;
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (!delta) continue;
          buffer += delta;
          const cutoff = sentenceRelayCutoff(buffer);
          if (cutoff === 0) continue;
          const relayPart = buffer.slice(0, cutoff);
          if (!numericConsistency(relayPart, ctx.allowedNumbers)) {
            send({ type: "rejected", reason: "numeric_lint", fallback: fallbackText });
            safeEnqueue("data: [DONE]\n\n");
            safeClose();
            return;
          }
          relayed += relayPart;
          send({ type: "delta", text: relayPart });
          buffer = buffer.slice(cutoff);
        }
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
        safeEnqueue("data: [DONE]\n\n");
        safeClose();
        return;
      }

      const fullText = relayed + buffer;
      const final = runFinalLints(fullText, lintCtx);
      if (!final.ok) {
        send({ type: "rejected", reason: final.reason, fallback: fallbackText });
        safeEnqueue("data: [DONE]\n\n");
        safeClose();
        return;
      }

      safeEnqueue(`data: ${JSON.stringify({ type: "delta", text: buffer })}\n\n`);
      send({
        type: "usage",
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - startedAt,
        model: getReasoningModel(),
      });
      safeEnqueue("data: [DONE]\n\n");
      safeClose();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}

/** Open the Super-120B upstream stream (A2 timeout + browser disconnect). */
function openStream(
  request: import("@/lib/reasoning/schemas").NarrativeRequest,
  ctx: ReturnType<typeof buildNarrativeContext>,
  verdictLabel: string,
  signal: AbortSignal,
) {
  return getClient().chat.completions.create(
    {
      model: getReasoningModel(),
      messages: [
        { role: "system" as const, content: NARRATIVE_SYSTEM_PROMPT },
        { role: "user" as const, content: buildNarrativeUserPrompt(ctx, verdictLabel) },
      ],
      stream: true,
      max_completion_tokens: 1200,
      reasoning_effort: "low",
      stream_options: { include_usage: true },
    },
    { signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) },
  );
}
