/**
 * Spike A: API 570 Fluid Service Classifier (SubQ Snap)
 * 
 * Classifies piping process stream descriptions into API 570 (5th Edition)
 * Section 6.3.4 & Table 1 Service Classes (Class 1, 2, 3, or 4).
 * 
 * Strict Invariant:
 * Enforces fail-closed review threshold: confidence p < 0.85 flags inspector review required.
 * Pure TypeScript (lib/calc/interval.ts) consumes the resulting class to calculate
 * maximum inspection intervals.
 */

import type { DecisionProvider, DecisionContext, ChoiceOptions } from "../types";

export type Api570PipingClass = "class_1" | "class_2" | "class_3" | "class_4";

export interface FluidClassificationResult {
  pipingClass: Api570PipingClass;
  confidence: number;
  probabilities: Record<Api570PipingClass, number>;
  failClosedReviewRequired: boolean;
  citation: "api570_6_3_4";
  reasoningHint?: string;
  latencyMs: number;
}

export const API_570_TABLE_1_CRITERIA: Record<Api570PipingClass, string> = {
  class_1: "Autorefrigeration, rapid vaporization on release, toxic chemicals (H2S > 3%, anhydrous HF, chlorine), piping over public waterways.",
  class_2: "Unit process piping, on-site hydrocarbons below boiling point, hydrogen, acids, caustics.",
  class_3: "Low volatility, diesel, lube oil, off-site storage transfer lines below flash point.",
  class_4: "Utility piping (steam, air, nitrogen, potable or cooling water).",
};

export const FLUID_CLASSIFICATION_THRESHOLD = 0.85;

/**
 * Classifies process fluid description into API 570 Table 1 Service Class.
 */
export async function classifyFluidService(
  provider: DecisionProvider,
  processDescription: string,
  signal?: AbortSignal
): Promise<FluidClassificationResult> {
  const context: DecisionContext = {
    state: processDescription,
    metadata: { domain: "api_570", spike: "fluid_classifier" },
    signal,
  };

  const options: ChoiceOptions<Api570PipingClass> = {
    instructions:
      "Classify this process piping stream description into API 570 Table 1 Piping Service Class (class_1, class_2, class_3, class_4).",
    criteria: API_570_TABLE_1_CRITERIA,
  };

  const result = await provider.choice<Api570PipingClass>(context, options);
  const failClosedReviewRequired = result.confidence < FLUID_CLASSIFICATION_THRESHOLD;

  return {
    pipingClass: result.choice,
    confidence: result.confidence,
    probabilities: result.probabilities,
    failClosedReviewRequired,
    citation: "api570_6_3_4",
    latencyMs: result.latencyMs,
  };
}
