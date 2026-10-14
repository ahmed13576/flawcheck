/**
 * NebiusNemotronDecisionProvider
 * 
 * Adapts Nebius Token Factory completion API running nvidia/Nemotron-3_5-Lightning
 * into the typed System-1 DecisionProvider seam.
 * Enforces zero-temperature single-pass evaluation, structured JSON schema hints,
 * and balanced brace recovery for transport resilience.
 */

import OpenAI from "openai";
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

export interface NebiusProviderOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

export class NebiusNemotronDecisionProvider implements DecisionProvider {
  readonly providerId = "nebius";
  readonly modelId: string;
  private customClient?: OpenAI;

  constructor(options?: NebiusProviderOptions) {
    this.modelId = options?.model ?? process.env.NEBIUS_MODEL_EXTRACTION ?? "nvidia/Nemotron-3_5-Lightning";
    if (options?.apiKey || options?.baseURL) {
      this.customClient = new OpenAI({
        apiKey: options.apiKey ?? process.env.NEBIUS_API_KEY ?? "",
        baseURL: options.baseURL ?? process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1/",
      });
    }
  }

  private getOpenAI(): OpenAI {
    return this.customClient ?? getClient();
  }

  async noul(context: DecisionContext, criteria: NoulCriteria, threshold = 0.5): Promise<NoulResult> {
    const start = performance.now();
    const systemPrompt =
      "You are a calibrated System-1 binary gate evaluator for NDT inspection data.\n" +
      "Analyze the given state against the criteria and output a calibrated probability between 0.0 and 1.0.\n" +
      'Respond ONLY with JSON matching: {"probability": number, "reasoning_hint": string}';

    const userPrompt = JSON.stringify({
      state: context.state,
      instructions: criteria.instructions,
      criteria: criteria.criteria,
    });

    const parsed = await this.executeCompletion<{ probability: number }>(
      systemPrompt,
      userPrompt,
      context.signal
    );

    const prob = typeof parsed.probability === "number" ? Math.max(0, Math.min(1, parsed.probability)) : 0.5;
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

    const parsed = await this.executeCompletion<{
      choice: T;
      confidence: number;
      probabilities?: Record<T, number>;
    }>(systemPrompt, userPrompt, context.signal);

    const winningChoice = keys.includes(parsed.choice) ? parsed.choice : keys[0];
    const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
    const probabilities = parsed.probabilities ?? ({ [winningChoice]: confidence } as Record<T, number>);

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

    const parsed = await this.executeCompletion<{
      score: number;
      level?: number;
      confidence?: number;
      probabilities?: Record<string, number>;
    }>(systemPrompt, userPrompt, context.signal);

    const score = typeof parsed.score === "number" ? parsed.score : 0;
    const lvl = Math.max(0, Math.min(levels.criteria.length - 1, Math.round(score)));
    const legend: Record<string, string> = {};
    levels.criteria.forEach((desc, idx) => {
      legend[String(idx)] = desc;
    });

    return {
      type: "score",
      score,
      level: lvl,
      label: levels.criteria[lvl] ?? String(lvl),
      legend,
      probabilities: parsed.probabilities ?? {},
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      latencyMs: performance.now() - start,
    };
  }

  async batch(context: DecisionContext, questions: DecisionBatchQuestions): Promise<DecisionBatchResult> {
    const start = performance.now();
    const results: Record<string, NoulResult | ChoiceResult | ScoreResult> = {};

    for (const [name, q] of Object.entries(questions)) {
      if (q.type === "noul") {
        results[name] = await this.noul(context, { instructions: q.instructions, criteria: q.criteria });
      } else if (q.type === "choice") {
        results[name] = await this.choice(context, { instructions: q.instructions, criteria: q.criteria });
      } else if (q.type === "score") {
        results[name] = await this.score(context, { instructions: q.instructions, criteria: q.criteria });
      }
    }

    return {
      answers: results,
      usage: { inputTokens: 0, outputTokens: 0 },
      totalLatencyMs: performance.now() - start,
    };
  }

  private async executeCompletion<T>(system: string, user: string, signal?: AbortSignal): Promise<T> {
    const client = this.getOpenAI();
    let res;
    try {
      res = await client.chat.completions.create(
        {
          model: this.modelId,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0,
          response_format: { type: "json_object" },
        },
        { signal }
      );
    } catch (err) {
      throw new DecisionProviderError(
        err instanceof Error ? err.message : String(err),
        500,
        this.providerId,
        err
      );
    }

    const raw = res.choices[0]?.message?.content ?? "";
    try {
      return JSON.parse(raw) as T;
    } catch {
      const balanced = extractBalancedBraceObjects(raw);
      if (balanced.length > 0) {
        return JSON.parse(balanced[balanced.length - 1]) as T;
      }
      throw new DecisionProviderError("Failed to parse JSON response from Nemotron", 500, this.providerId, raw);
    }
  }
}

/**
 * Extracts balanced JSON `{...}` blocks to withstand prose preamble in model output.
 */
function extractBalancedBraceObjects(raw: string): string[] {
  const blocks: string[] = [];
  const start = raw.indexOf("{");
  if (start === -1) return blocks;
  let depth = 0;
  let inStr = false;
  let esc = false;
  let open = -1;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") {
      if (depth === 0) open = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && open !== -1) {
        blocks.push(raw.slice(open, i + 1));
        open = -1;
      }
    }
  }
  return blocks;
}
