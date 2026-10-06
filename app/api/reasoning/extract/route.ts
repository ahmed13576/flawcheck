/**
 * POST /api/reasoning/extract — 03-02 Task 2 (Pattern R1: batched context
 * pack, one Lightning call via runValidatedCompletion, loud failure).
 *
 * Contract (SC1 / REAS-01): 400 on malformed JSON or strict-schema violation
 * naming the first Zod issue; 200 `{ disabled: true }` when the LLM is off
 * (open-question resolution 3 — fallback mode needs no extraction); 200 with
 * `{ extraction, usage }` on success (real tokens via the usageSink tap,
 * server-timed latency, runtime-resolved model — PLAT-05); 502 naming the
 * error after the bounded retry exhausts — never a partial extraction.
 *
 * Prompt-injection posture (T-03-04): user note text reaches the model only
 * through buildExtractionUserPrompt's BEGIN-NOTES/END-NOTES delimiters with
 * the treat-as-data instruction; schema caps bound the blast radius, and any
 * downstream narrative built from a poisoned pack still passes through the
 * four server-side lints + fallback.
 */
import { getClient } from "@/lib/llm/client";
import { getExtractionModel } from "@/lib/llm/config";
import { runValidatedCompletion } from "@/lib/llm/complete";
import {
  EXTRACTION_SCHEMA_HINT,
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
} from "@/lib/reasoning/prompts";
import {
  ExtractionRequestSchema,
  ExtractionResultSchema,
  isLlmDisabled,
} from "@/lib/reasoning/schemas";

import { checkRateLimit, clientIp, rateLimitedResponse } from "@/lib/api/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const rl = checkRateLimit(clientIp(req));
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "request body must be valid JSON" }, { status: 400 });
  }

  const parsed = ExtractionRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.length ? first.path.join(".") : "(root)";
    return Response.json(
      { error: `invalid extraction request: ${path}: ${first?.message ?? "unknown issue"}` },
      { status: 400 },
    );
  }

  if (isLlmDisabled()) {
    return Response.json({ extraction: null, usage: null, disabled: true });
  }

  const reqData = parsed.data;
  const startedAt = Date.now();
  // Holder object because the sink fires inside runValidatedCompletion's
  // closure — TS control-flow narrowing cannot see callback assignments on a
  // plain `let`, and would narrow it to `null` at the read site.
  const usage: { v: { promptTokens: number; completionTokens: number } | null } = { v: null };
  try {
    const extraction = await runValidatedCompletion({
      client: getClient(),
      model: getExtractionModel(),
      system: EXTRACTION_SYSTEM_PROMPT,
      user: buildExtractionUserPrompt(
        reqData.metadata,
        reqData.notes,
        reqData.indications,
        reqData.populationDigest,
      ),
      schema: ExtractionResultSchema,
      schemaHint: EXTRACTION_SCHEMA_HINT,
      // Live finding (A11, 2026-09-27): Lightning's visible chain-of-thought
      // counts inside max_completion_tokens and truncated the JSON at 800.
      // 3000 leaves ample room for thinking + the answer; schema.parse still
      // rejects anything malformed and the bounded retry still applies.
      maxCompletionTokens: 3000,
      reasoningEffort: "low",
      usageSink: (u) => {
        usage.v = u;
      },
      // WR-02: propagate a client disconnect AND bound the paid call — a
      // hung upstream can no longer pin the route for the SDK's default
      // timeout per attempt. (The narrative route composes the same pair.)
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(60_000)]),
    });
    return Response.json({
      extraction,
      usage: {
        promptTokens: usage.v?.promptTokens ?? 0,
        completionTokens: usage.v?.completionTokens ?? 0,
        latencyMs: Date.now() - startedAt,
        model: getExtractionModel(),
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
