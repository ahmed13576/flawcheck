/**
 * Direct client for the SubQ Decisions API (`POST /v1/systemone`).
 * SubQ owns classification; deterministic engineering calculations stay in lib/calc.
 */

import type {
  ChoiceOptions,
  ChoiceResult,
  DecisionBatchQuestions,
  DecisionBatchResult,
  DecisionContext,
  DecisionProvider,
  NoulCriteria,
  NoulResult,
  ScoreLevels,
  ScoreResult,
} from "../types";
import { DecisionProviderError, DecisionValidationError } from "../types";

const DEFAULT_BASE_URL = "https://api.subq.ai/v1";
const DEFAULT_MODEL = "subq-snap-preview";
const MAX_QUESTIONS = 16;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export interface SubQProviderOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

interface SubQAnswer {
  type: "noul" | "choice" | "score";
  noul?: number;
  choice?: string;
  score?: number;
  legend?: Record<string, string>;
  probabilities?: Record<string, number>;
  confidence?: number;
}

interface SubQApiResponse {
  answers?: Record<string, SubQAnswer>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class SubQSnapDecisionProvider implements DecisionProvider {
  readonly providerId = "subq";
  readonly modelId: string;
  private readonly baseURL: string;
  private readonly apiKey: string;

  constructor(options?: SubQProviderOptions) {
    if (options?.model && options.model !== DEFAULT_MODEL) {
      throw new DecisionValidationError(`SubQ model is locked to ${DEFAULT_MODEL}.`);
    }
    this.apiKey = options?.apiKey ?? process.env.SUBQ_API_KEY ?? "";
    const configuredBaseURL = (options?.baseURL ?? process.env.SUBQ_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.baseURL = configuredBaseURL.endsWith("/v1") ? configuredBaseURL : `${configuredBaseURL}/v1`;
    this.modelId = DEFAULT_MODEL;
  }

  async noul(context: DecisionContext, criteria: NoulCriteria, threshold = 0.5): Promise<NoulResult> {
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
      throw new DecisionValidationError("Noul threshold must be between 0 and 1.");
    }
    const { answers } = await this.batch(context, {
      gate: { type: "noul", instructions: criteria.instructions, criteria: criteria.criteria },
    });
    const answer = answers.gate;
    if (!answer || answer.type !== "noul") {
      throw new DecisionProviderError("Invalid or missing noul answer from SubQ Snap", 502, this.providerId);
    }
    return { ...answer, verdict: answer.noul >= threshold };
  }

  async choice<T extends string = string>(
    context: DecisionContext,
    options: ChoiceOptions<T>
  ): Promise<ChoiceResult<T>> {
    const keys = Object.keys(options.criteria);
    if (keys.length < 2 || keys.length > 255) {
      throw new DecisionValidationError(`Choice criteria must have between 2 and 255 options. Provided: ${keys.length}`);
    }
    const { answers } = await this.batch(context, {
      selection: { type: "choice", instructions: options.instructions, criteria: options.criteria },
    });
    const answer = answers.selection;
    if (!answer || answer.type !== "choice" || !keys.includes(answer.choice)) {
      throw new DecisionProviderError("Invalid or missing choice answer from SubQ Snap", 502, this.providerId);
    }
    return answer as ChoiceResult<T>;
  }

  async score(context: DecisionContext, levels: ScoreLevels): Promise<ScoreResult> {
    if (levels.criteria.length < 2 || levels.criteria.length > 10) {
      throw new DecisionValidationError(`Score levels must have between 2 and 10 levels. Provided: ${levels.criteria.length}`);
    }
    const { answers } = await this.batch(context, {
      rating: { type: "score", instructions: levels.instructions, criteria: levels.criteria },
    });
    const answer = answers.rating;
    if (!answer || answer.type !== "score") {
      throw new DecisionProviderError("Invalid or missing score answer from SubQ Snap", 502, this.providerId);
    }
    return answer;
  }

  async batch(context: DecisionContext, questions: DecisionBatchQuestions): Promise<DecisionBatchResult> {
    this.validateQuestions(questions);
    const images = this.prepareImages(context.images);
    if (!this.apiKey) throw new DecisionValidationError("Missing SUBQ_API_KEY environment variable.");
    if (process.env.FLAWCHECK_DISABLE_LLM === "1") {
      throw new DecisionProviderError("SubQ requests are disabled by FLAWCHECK_DISABLE_LLM", 503, this.providerId);
    }

    const payload = {
      model: this.modelId,
      state: context.state,
      ...(images ? { images } : {}),
      questions,
    };
    const startedAt = performance.now();
    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/systemone`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: context.signal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DecisionProviderError(message, 0, this.providerId, error);
    }

    if (!response.ok) {
      const errorBody = await this.readErrorBody(response);
      const message = errorBody?.detail?.message ?? response.statusText ?? "SubQ request failed";
      throw new DecisionProviderError(message, response.status, this.providerId, errorBody);
    }

    let data: SubQApiResponse;
    try {
      data = (await response.json()) as SubQApiResponse;
    } catch (error) {
      throw new DecisionProviderError("SubQ returned invalid JSON", 502, this.providerId, error);
    }

    if (!data.answers || typeof data.answers !== "object") {
      throw new DecisionProviderError("SubQ response is missing its answers object", 502, this.providerId, data);
    }
    const elapsed = performance.now() - startedAt;
    const answers: DecisionBatchResult["answers"] = {};
    for (const [name, definition] of Object.entries(questions)) {
      const raw = data.answers[name];
      if (!raw || raw.type !== definition.type) {
        throw new DecisionProviderError(`SubQ response has a missing or mismatched answer for question "${name}"`, 502, this.providerId, data);
      }
      answers[name] = this.mapAnswer(raw, definition.type, elapsed);
    }

    return {
      answers,
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        // Decisions API contract reports zero generated output tokens.
        outputTokens: 0,
      },
      totalLatencyMs: elapsed,
    };
  }

  private validateQuestions(questions: DecisionBatchQuestions): void {
    const entries = Object.entries(questions);
    if (entries.length < 1 || entries.length > MAX_QUESTIONS) {
      throw new DecisionValidationError(`SubQ accepts 1 to ${MAX_QUESTIONS} questions per request. Provided: ${entries.length}`);
    }
    for (const [name, question] of entries) {
      if (!name.trim() || !question.instructions.trim()) {
        throw new DecisionValidationError("Questions must have a name and non-empty instructions.");
      }
      if (question.type === "choice") {
        const keys = Object.keys(question.criteria);
        if (keys.length < 2 || keys.length > 255 || keys.some((key) => !key.trim())) {
          throw new DecisionValidationError(`Question "${name}" must define 2 to 255 named choices.`);
        }
      } else if (question.type === "score" && (question.criteria.length < 2 || question.criteria.length > 10)) {
        throw new DecisionValidationError(`Question "${name}" must define 2 to 10 score levels.`);
      }
    }
  }

  private prepareImages(images: DecisionContext["images"]): Array<{ mediaType: string; base64: string }> | undefined {
    if (!images?.length) return undefined;
    if (images.length > MAX_IMAGES) throw new DecisionValidationError(`SubQ accepts at most ${MAX_IMAGES} images per request.`);
    let totalBytes = 0;
    const payload = images.map((image) => {
      if (!IMAGE_MEDIA_TYPES.has(image.mediaType)) {
        throw new DecisionValidationError(`Unsupported image media type: ${image.mediaType}`);
      }
      const base64 = image.base64.replace(/^data:image\/(?:png|jpeg|webp);base64,/i, "");
      if (!base64 || base64.includes("\n") || base64.includes("\r") || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 === 1) {
        throw new DecisionValidationError("Images must contain valid single-line base64 data.");
      }
      const decodedBytes = Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
      if (decodedBytes > MAX_IMAGE_BYTES) throw new DecisionValidationError("Each image must be 4 MiB or smaller.");
      totalBytes += decodedBytes;
      return { mediaType: image.mediaType, base64 };
    });
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) throw new DecisionValidationError("Combined image data must be 8 MiB or smaller.");
    return payload;
  }

  private mapAnswer(raw: SubQAnswer, type: "noul" | "choice" | "score", latencyMs: number) {
    if (type === "noul") {
      if (typeof raw.noul !== "number" || !Number.isFinite(raw.noul) || raw.noul < 0 || raw.noul > 1) {
        throw new DecisionProviderError("SubQ returned an invalid noul probability", 502, this.providerId, raw);
      }
      return { type: "noul" as const, noul: raw.noul, verdict: raw.noul >= 0.5, latencyMs };
    }
    if (type === "choice") {
      if (!raw.choice || typeof raw.confidence !== "number" || !raw.probabilities) {
        throw new DecisionProviderError("SubQ returned an invalid choice answer", 502, this.providerId, raw);
      }
      return { type: "choice" as const, choice: raw.choice, probabilities: raw.probabilities, confidence: raw.confidence, latencyMs };
    }
    if (typeof raw.score !== "number" || !Number.isFinite(raw.score) || !raw.probabilities || typeof raw.confidence !== "number") {
      throw new DecisionProviderError("SubQ returned an invalid score answer", 502, this.providerId, raw);
    }
    const level = Math.round(raw.score);
    const legend = raw.legend ?? {};
    return {
      type: "score" as const,
      score: raw.score,
      level,
      label: legend[String(level)] ?? String(level),
      legend,
      probabilities: raw.probabilities,
      confidence: raw.confidence,
      latencyMs,
    };
  }

  private async readErrorBody(response: Response): Promise<{ detail?: { error_type?: string; message?: string } } | undefined> {
    try {
      const body = (await response.json()) as { detail?: { error_type?: string; message?: string } };
      return body && typeof body === "object" ? body : undefined;
    } catch {
      return undefined;
    }
  }
}
