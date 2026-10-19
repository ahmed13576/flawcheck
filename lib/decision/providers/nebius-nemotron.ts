/**
 * NebiusNemotronDecisionProvider — System-1 fast decision adapter
 *
 * Adapts the Nebius Token Factory chat-completion API (Nemotron-3.5-Lightning
 * class model, routed EXCLUSIVELY via the NEBIUS_MODEL_EXTRACTION env var —
 * no model-ID literals may appear in this file per the inherited grep gate)
 * into the typed System-1 DecisionProvider seam.
 *
 * Transport hardening (verified model quirks, inherited from the extraction
 * pipeline):
 * - temperature 0, strict `json_object` response format, single-pass.
 * - Lightning sometimes wraps the JSON object in a prose preamble even under
 *   json_object mode → parsing goes through `parseJsonLoose` (balanced-brace
 *   recovery, LAST-first candidate order for visible CoT), the SAME parser
 *   the extraction route uses — no second, diverging implementation.
 * - `reasoning_effort` enum is low|medium|high ONLY (anything wider 422s);
 *   default "low" for System-1 latency.
 * - Exactly ONE bounded retry on a malformed/non-conforming reply, then a
 *   fail-closed DecisionProviderError — callers never receive freeform text.
 *
 * Hermeticity (DEC-02 / DEC-04): the kill-switch (FLAWCHECK_DISABLE_LLM or a
 * missing API key) hard-fails every call on the network path — zero requests.
 * Tests inject a fake client (`options.client`), which bypasses the network
 * path entirely; an injected client is the caller's explicit offline double.
 */

import OpenAI from "openai";
import { z } from "zod";
import type {
  DecisionProvider,
  DecisionContext,
  NoulCriteria,
  NoulResult,
  ChoiceOptions,
  ChoiceResult,
  ScoreLevels,
  ScoreResult,
  DecisionBatchQuestions,
  DecisionBatchResult,
} from "../types";
import { DecisionProviderError, DecisionValidationError } from "../types";
import { getClient } from "@/lib/llm/client";
import { getExtractionModel } from "@/lib/llm/config";
import { parseJsonLoose } from "@/lib/llm/complete";
import { isLlmDisabled } from "@/lib/reasoning/schemas";

export interface NebiusProviderOptions {
  /** Direct client injection (offline doubles / tests). Bypasses env config and the kill-switch network path. */
  client?: OpenAI;
  apiKey?: string;
  baseURL?: string;
  /** Must come from env (NEBIUS_MODEL_EXTRACTION) or explicit caller config — never a hardcoded vendor ID. */
  model?: string;
  /** low|medium|high ONLY — the reasoning_effort enum rejects anything wider. Default: low (System-1 latency). */
  reasoningEffort?: "low" | "medium" | "high";
  /** Output budget; visible reasoning counts inside it (verified quirk). Default 2048. */
  maxCompletionTokens?: number;
}

/** Wire schemas — Zod runtime validation (DEC-03): non-conforming replies never reach business logic. */
const NoulWireSchema = z.object({
  probability: z.number().finite(),
});
const ChoiceWireSchema = z.object({
  choice: z.string().min(1),
  confidence: z.number().finite(),
  probabilities: z.record(z.string(), z.number().finite()).optional(),
});
const ScoreWireSchema = z.object({
  score: z.number().finite(),
  level: z.number().int().optional(),
  confidence: z.number().finite().optional(),
  probabilities: z.record(z.string(), z.number().finite()).optional(),
});

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export class NebiusNemotronDecisionProvider implements DecisionProvider {
  readonly providerId = "nebius";
  readonly modelId: string;
  private readonly injectedClient?: OpenAI;
  private readonly customClient?: OpenAI;
  private readonly reasoningEffort: "low" | "medium" | "high";
  private readonly maxCompletionTokens: number;

  constructor(options?: NebiusProviderOptions) {
    // Env-only routing: the model ID comes from NEBIUS_MODEL_EXTRACTION (or an
    // explicit caller-supplied value) — no vendor model-ID literals here.
    this.modelId = options?.model ?? getExtractionModel();
    this.reasoningEffort = options?.reasoningEffort ?? "low";
    this.maxCompletionTokens = options?.maxCompletionTokens ?? 2048;
    this.injectedClient = options?.client;
    if (!this.injectedClient && (options?.apiKey || options?.baseURL)) {
      this.customClient = new OpenAI({
        apiKey: options?.apiKey ?? process.env.NEBIUS_API_KEY ?? "",
        baseURL: options?.baseURL ?? process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1/",
      });
    }
  }

  private getOpenAI(): OpenAI {
    return this.injectedClient ?? this.customClient ?? getClient();
  }

  async noul(context: DecisionContext, criteria: NoulCriteria, threshold = 0.5): Promise<NoulResult> {
    const start = performance.now();
    const systemPrompt =
      "You are a calibrated System-1 binary gate evaluator for NDT inspection data.\n" +
      "Analyze the given state against the criteria and output a calibrated probability between 0.0 and 1.0.\n" +
      'Respond ONLY with JSON matching: {"probability": number}';

    const userPrompt = JSON.stringify({
      state: context.state,
      instructions: criteria.instructions,
      criteria: criteria.criteria,
    });

    const parsed = NoulWireSchema.parse(
      await this.executeCompletion(systemPrompt, userPrompt, context.signal)
    );

    const prob = clamp01(parsed.probability);
    return {
      type: "noul",
      noul: prob,
      verdict: prob >= threshold,
      latencyMs: performance.now() - start,
    };
  }

  async choice<T extends string = string>(
    context: DecisionContext,
    options: ChoiceOptions<T>
  ): Promise<ChoiceResult<T>> {
    const start = performance.now();
    const keys = Object.keys(options.criteria) as T[];
    if (keys.length < 2 || keys.length > 255) {
      throw new DecisionValidationError(
        `Choice criteria must have between 2 and 255 options. Provided: ${keys.length}`
      );
    }

    const systemPrompt =
      "You are a fast System-1 categorical classifier for NDT inspection workflows.\n" +
      `Available choices: ${JSON.stringify(keys)}\n` +
      'Respond ONLY with JSON matching: {"choice": string, "confidence": number, "probabilities": Record<string, number>}';

    const userPrompt = JSON.stringify({
      state: context.state,
      instructions: options.instructions,
      options: options.criteria,
    });

    const parsed = ChoiceWireSchema.parse(
      await this.executeCompletion(systemPrompt, userPrompt, context.signal)
    );

    const winningChoice = keys.includes(parsed.choice as T) ? (parsed.choice as T) : keys[0];
    const confidence = clamp01(parsed.confidence);
    const probabilities: Record<T, number> = {} as Record<T, number>;
    for (const key of keys) {
      const modelP = parsed.probabilities?.[key];
      probabilities[key] = typeof modelP === "number" ? clamp01(modelP) : key === winningChoice ? confidence : 0;
    }
    // Normalize so the distribution sums to ~1.0 (DEC-03) — deterministic TS math.
    const sum = keys.reduce((acc, k) => acc + probabilities[k], 0);
    if (sum > 0) {
      for (const key of keys) probabilities[key] = probabilities[key] / sum;
    }

    return {
      type: "choice",
      choice: winningChoice,
      probabilities,
      confidence,
      latencyMs: performance.now() - start,
    };
  }

  async score(context: DecisionContext, levels: ScoreLevels): Promise<ScoreResult> {
    const start = performance.now();
    if (levels.criteria.length < 2 || levels.criteria.length > 10) {
      throw new DecisionValidationError(
        `Score levels must have between 2 and 10 levels. Provided: ${levels.criteria.length}`
      );
    }

    const systemPrompt =
      "You are an ordered rating evaluator for NDT inspection metrics.\n" +
      `Levels (0 to ${levels.criteria.length - 1}): ${JSON.stringify(levels.criteria)}\n` +
      'Respond ONLY with JSON matching: {"score": number, "level": number, "confidence": number, "probabilities": Record<string, number>}';

    const userPrompt = JSON.stringify({
      state: context.state,
      instructions: levels.instructions,
      levels: levels.criteria,
    });

    const parsed = ScoreWireSchema.parse(
      await this.executeCompletion(systemPrompt, userPrompt, context.signal)
    );

    const lvl = Math.max(
      0,
      Math.min(
        levels.criteria.length - 1,
        parsed.level ?? Math.round(parsed.score)
      )
    );
    const legend: Record<string, string> = {};
    levels.criteria.forEach((desc, idx) => {
      legend[String(idx)] = desc;
    });

    return {
      type: "score",
      score: parsed.score,
      level: lvl,
      label: levels.criteria[lvl] ?? String(lvl),
      legend,
      probabilities: parsed.probabilities ?? {},
      confidence: parsed.confidence !== undefined ? clamp01(parsed.confidence) : 0.5,
      latencyMs: performance.now() - start,
    };
  }

  async batch(context: DecisionContext, questions: DecisionBatchQuestions): Promise<DecisionBatchResult> {
    const start = performance.now();
    const results: Record<string, NoulResult | ChoiceResult | ScoreResult> = {};
    let inputTokens = 0;
    let outputTokens = 0;

    for (const [name, q] of Object.entries(questions)) {
      if (q.type === "noul") {
        results[name] = await this.noul(context, { instructions: q.instructions, criteria: q.criteria });
      } else if (q.type === "choice") {
        results[name] = await this.choice(context, { instructions: q.instructions, criteria: q.criteria });
      } else if (q.type === "score") {
        results[name] = await this.score(context, { instructions: q.instructions, criteria: q.criteria });
      }
      // Each batch question is exactly one underlying completion; sum its
      // reported usage directly (retry attempts count only when they succeed).
      const used = this.lastUsage;
      inputTokens += used?.promptTokens ?? 0;
      outputTokens += used?.completionTokens ?? 0;
    }

    return {
      answers: results,
      usage: { inputTokens, outputTokens },
      totalLatencyMs: performance.now() - start,
    };
  }

  /** Usage of the last completed completion call (for batch token accounting). */
  private lastUsage?: { promptTokens: number; completionTokens: number };

  /**
   * Single completion with the transport contract: temperature 0, strict
   * json_object, reasoning_effort low|medium|high, abort propagation, ONE
   * bounded retry on a malformed reply, then fail-closed.
   */
  private async executeCompletion(system: string, user: string, signal?: AbortSignal): Promise<unknown> {
    // Kill-switch (DEC-04): on the network path, zero requests — fail closed.
    // An injected client is an explicit offline double owned by the caller
    // (tests); the switch governs the configured Nebius transport only.
    if (!this.injectedClient && isLlmDisabled()) {
      throw new DecisionProviderError(
        "LLM disabled (FLAWCHECK_DISABLE_LLM or missing NEBIUS_API_KEY) — System-1 provider fails closed",
        503,
        this.providerId
      );
    }

    const messages = [
      { role: "system" as const, content: system },
      { role: "user" as const, content: user },
    ];
    const client = this.getOpenAI();

    const call = () =>
      client.chat.completions.create(
        {
          model: this.modelId,
          messages,
          temperature: 0,
          response_format: { type: "json_object" },
          max_completion_tokens: this.maxCompletionTokens,
          reasoning_effort: this.reasoningEffort,
        },
        { signal }
      );

    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await call();
        const raw = res.choices[0]?.message?.content ?? "";
        const value = parseJsonLoose(raw); // prose-preamble recovery (verified Lightning quirk)
        this.lastUsage = {
          promptTokens: res.usage?.prompt_tokens ?? 0,
          completionTokens: res.usage?.completion_tokens ?? 0,
        };
        return value;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (signal?.aborted) {
          throw new DecisionProviderError("Request aborted", 499, this.providerId, err);
        }
      }
    }
    throw new DecisionProviderError(
      `Failed to parse JSON decision after 1 retry: ${lastError}`,
      500,
      this.providerId
    );
  }
}
