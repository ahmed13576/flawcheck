/**
 * SubQSnapDecisionProvider
 * 
 * Direct client for SubQ Decisions API (POST /v1/systemone).
 * Executes single-pass System-1 decisions using model subq-snap-preview with native
 * noul, choice, score question payloads and multi-modal image support.
 */

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

export interface SubQProviderOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

export class SubQSnapDecisionProvider implements DecisionProvider {
  readonly providerId = "subq";
  readonly modelId: string;
  private baseURL: string;
  private apiKey: string;

  constructor(options?: SubQProviderOptions) {
    this.apiKey = options?.apiKey ?? process.env.SUBQ_API_KEY ?? "";
    this.baseURL = options?.baseURL ?? process.env.SUBQ_BASE_URL ?? "https://api.subq.ai/v1";
    this.modelId = options?.model ?? "subq-snap-preview";
  }

  async noul(context: DecisionContext, criteria: NoulCriteria, threshold = 0.5): Promise<NoulResult> {
    const batch = await this.batch(context, {
      gate: {
        type: "noul",
        instructions: criteria.instructions,
        criteria: criteria.criteria,
      },
    });

    const ans = batch.answers["gate"];
    if (!ans || ans.type !== "noul") {
      throw new DecisionProviderError("Invalid or missing noul answer from SubQ Snap", 500, this.providerId);
    }

    return {
      ...ans,
      verdict: ans.noul >= threshold,
    };
  }

  async choice<T extends string = string>(
    context: DecisionContext,
    options: ChoiceOptions<T>
  ): Promise<ChoiceResult<T>> {
    const keys = Object.keys(options.criteria) as T[];
    if (keys.length < 2 || keys.length > 255) {
      throw new DecisionValidationError(
        `Choice criteria must have between 2 and 255 options. Provided: ${keys.length}`
      );
    }

    const batch = await this.batch(context, {
      selection: {
        type: "choice",
        instructions: options.instructions,
        criteria: options.criteria,
      },
    });

    const ans = batch.answers["selection"];
    if (!ans || ans.type !== "choice") {
      throw new DecisionProviderError("Invalid or missing choice answer from SubQ Snap", 500, this.providerId);
    }

    return ans as ChoiceResult<T>;
  }

  async score(context: DecisionContext, levels: ScoreLevels): Promise<ScoreResult> {
    if (levels.criteria.length < 2 || levels.criteria.length > 10) {
      throw new DecisionValidationError(
        `Score levels must have between 2 and 10 levels. Provided: ${levels.criteria.length}`
      );
    }

    const batch = await this.batch(context, {
      rating: {
        type: "score",
        instructions: levels.instructions,
        criteria: levels.criteria,
      },
    });

    const ans = batch.answers["rating"];
    if (!ans || ans.type !== "score") {
      throw new DecisionProviderError("Invalid or missing score answer from SubQ Snap", 500, this.providerId);
    }

    return ans as ScoreResult;
  }

  async batch(context: DecisionContext, questions: DecisionBatchQuestions): Promise<DecisionBatchResult> {
    const questionKeys = Object.keys(questions);
    if (questionKeys.length < 1 || questionKeys.length > 16) {
      throw new DecisionValidationError(
        `SubQ Decisions API accepts between 1 and 16 questions per batch. Provided: ${questionKeys.length}`
      );
    }

    // Offline / Calc Sovereignty Mock Bypass
    if (process.env.FLAWCHECK_DISABLE_LLM === "1" || (!this.apiKey && process.env.NODE_ENV === "test")) {
      return this.generateOfflineMockBatch(questions);
    }

    if (!this.apiKey) {
      throw new DecisionValidationError("Missing SUBQ_API_KEY environment variable.");
    }

    const start = performance.now();
    const endpoint = `${this.baseURL}/systemone`;

    // Process images (up to 4, strip data URL prefix, check limit)
    let imagesPayload: Array<{ mediaType: string; base64: string }> | undefined;
    if (context.images && context.images.length > 0) {
      if (context.images.length > 4) {
        throw new DecisionValidationError("SubQ Decisions API accepts at most 4 images per request.");
      }
      imagesPayload = context.images.map((img) => ({
        mediaType: img.mediaType,
        base64: img.base64.replace(/^data:image\/[a-z]+;base64,/, ""),
      }));
    }

    const payload = {
      model: this.modelId,
      state: context.state,
      ...(imagesPayload ? { images: imagesPayload } : {}),
      questions,
    };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: context.signal,
      });
    } catch (err) {
      throw new DecisionProviderError(
        err instanceof Error ? err.message : String(err),
        500,
        this.providerId,
        err
      );
    }

    if (!response.ok) {
      let detailMsg = response.statusText;
      try {
        const errJson = (await response.json()) as { detail?: { message?: string } };
        detailMsg = errJson.detail?.message ?? JSON.stringify(errJson);
      } catch {
        // Fall back to statusText
      }
      throw new DecisionProviderError(detailMsg, response.status, this.providerId);
    }

    interface SubQApiResponse {
      model: string;
      answers: Record<
        string,
        | { type: "noul"; noul: number }
        | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
        | { type: "score"; score: number; legend: Record<string, string>; probabilities: Record<string, number>; confidence: number }
      >;
      usage?: {
        input_tokens?: number;
      };
    }

    const data = (await response.json()) as SubQApiResponse;
    const answers: Record<string, NoulResult | ChoiceResult | ScoreResult> = {};
    const elapsed = performance.now() - start;

    for (const [key, qDef] of Object.entries(questions)) {
      const rawAns = data.answers[key];
      if (!rawAns) continue;

      if (qDef.type === "noul" && rawAns.type === "noul") {
        answers[key] = {
          type: "noul",
          noul: rawAns.noul,
          verdict: rawAns.noul >= 0.5,
          latencyMs: elapsed,
        };
      } else if (qDef.type === "choice" && rawAns.type === "choice") {
        answers[key] = {
          type: "choice",
          choice: rawAns.choice,
          probabilities: rawAns.probabilities,
          confidence: rawAns.confidence,
          latencyMs: elapsed,
        };
      } else if (qDef.type === "score" && rawAns.type === "score") {
        const lvl = Math.round(rawAns.score);
        answers[key] = {
          type: "score",
          score: rawAns.score,
          level: lvl,
          label: rawAns.legend?.[String(lvl)] ?? String(lvl),
          legend: rawAns.legend ?? {},
          probabilities: rawAns.probabilities,
          confidence: rawAns.confidence,
          latencyMs: elapsed,
        };
      }
    }

    return {
      answers,
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: 0,
      },
      totalLatencyMs: elapsed,
    };
  }

  private generateOfflineMockBatch(questions: DecisionBatchQuestions): DecisionBatchResult {
    const answers: Record<string, NoulResult | ChoiceResult | ScoreResult> = {};

    for (const [key, qDef] of Object.entries(questions)) {
      if (qDef.type === "noul") {
        answers[key] = {
          type: "noul",
          noul: 0.9,
          verdict: true,
          latencyMs: 1,
        };
      } else if (qDef.type === "choice") {
        const firstChoice = Object.keys(qDef.criteria)[0] ?? "unknown";
        answers[key] = {
          type: "choice",
          choice: firstChoice,
          probabilities: { [firstChoice]: 1.0 },
          confidence: 1.0,
          latencyMs: 1,
        };
      } else if (qDef.type === "score") {
        const legend: Record<string, string> = {};
        qDef.criteria.forEach((desc, idx) => {
          legend[String(idx)] = desc;
        });
        answers[key] = {
          type: "score",
          score: 0,
          level: 0,
          label: qDef.criteria[0] ?? "0",
          legend,
          probabilities: { "0": 1.0 },
          confidence: 1.0,
          latencyMs: 1,
        };
      }
    }

    return {
      answers,
      usage: { inputTokens: 50, outputTokens: 0 },
      totalLatencyMs: 1,
    };
  }
}
