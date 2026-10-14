/**
 * System-1 Decision Provider Types & Primitives
 * 
 * FlawCheck NDT Inspection Decision Seam:
 * Defines typed decision primitives (choice, noul, score) with zero freeform text leakage.
 * Pure TypeScript (lib/calc/) computes 100% of arithmetic; System-1 engines classify and route.
 */

export interface DecisionImage {
  mediaType: "image/png" | "image/jpeg" | "image/webp";
  /** Single line base64 encoded string without data URI prefix (<= 4 MiB decoded) */
  base64: string;
}

export interface DecisionContext {
  /** Text, serialized JSON entity, or prompt describing the subject under evaluation */
  state: string | Record<string, unknown> | unknown[];
  /** Optional domain-specific tags or metadata for logging/tracing */
  metadata?: Record<string, string | number | boolean>;
  /** Optional multi-modal images (up to 4) */
  images?: DecisionImage[];
  /** Optional abort signal for request cancellation */
  signal?: AbortSignal;
}

export interface NoulCriteria {
  instructions: string;
  criteria?: {
    true?: string;
    false?: string;
  };
}

export interface NoulResult {
  type: "noul";
  /** Calibrated probability of true (0.0 to 1.0) */
  noul: number;
  /** Binary verdict evaluated against a threshold (default: 0.5) */
  verdict: boolean;
  latencyMs: number;
}

export interface ChoiceOptions<T extends string = string> {
  instructions: string;
  /** 2 to 255 options. Map of option key -> description or null */
  criteria: Record<T, string | null>;
}

export interface ChoiceResult<T extends string = string> {
  type: "choice";
  /** The selected option key */
  choice: T;
  /** Probability distribution across all options (sums to ~1.0) */
  probabilities: Record<T, number>;
  /** Model confidence in the chosen option (0.0 to 1.0) */
  confidence: number;
  latencyMs: number;
}

export interface ScoreLevels {
  instructions: string;
  /** 2 to 10 ordered level descriptions from lowest (0) to highest (N-1) */
  criteria: string[];
}

export interface ScoreResult {
  type: "score";
  /** Probability-weighted continuous score across the levels */
  score: number;
  /** Rounded integer level index */
  level: number;
  /** Label of the winning level */
  label: string;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
  latencyMs: number;
}

export interface DecisionBatchQuestions {
  [questionName: string]:
    | { type: "noul"; instructions: string; criteria?: { true?: string; false?: string } }
    | { type: "choice"; instructions: string; criteria: Record<string, string | null> }
    | { type: "score"; instructions: string; criteria: string[]; [key: string]: unknown };
}

export interface DecisionBatchResult {
  answers: Record<string, NoulResult | ChoiceResult | ScoreResult>;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  totalLatencyMs: number;
}

export interface DecisionProvider {
  readonly providerId: string;
  readonly modelId: string;

  /** Binary probability gate (0.0 to 1.0) */
  noul(context: DecisionContext, criteria: NoulCriteria, threshold?: number): Promise<NoulResult>;

  /** Categorical choice selection among 2–255 options */
  choice<T extends string = string>(
    context: DecisionContext,
    options: ChoiceOptions<T>
  ): Promise<ChoiceResult<T>>;

  /** Ordered multi-level rating (2–10 levels) */
  score(context: DecisionContext, levels: ScoreLevels): Promise<ScoreResult>;

  /** Multi-question atomic batch evaluation (1–16 questions over the same state) */
  batch(context: DecisionContext, questions: DecisionBatchQuestions): Promise<DecisionBatchResult>;
}

export class DecisionProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly providerId: string,
    public readonly rawError?: unknown
  ) {
    super(`[${providerId}] ${statusCode}: ${message}`);
    this.name = "DecisionProviderError";
  }
}

export class DecisionValidationError extends Error {
  constructor(message: string) {
    super(`Validation Error: ${message}`);
    this.name = "DecisionValidationError";
  }
}
