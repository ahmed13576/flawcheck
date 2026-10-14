/**
 * Spike D: Semantic Guardrail (SubQ Snap)
 * 
 * Non-autoregressive hallucination checking replacing brittle regex lints.
 * Verifies that AI-generated inspection narrative reports strictly ground their
 * numerical values and engineering standard citations against calculation facts.
 * 
 * Strict Invariant:
 * Evaluates whether narrative quotes ungrounded numbers or unallowlisted standard clauses.
 * Fail-closed threshold: noul confidence < 0.95 rejects narrative and triggers regeneration.
 */

import type { DecisionProvider, DecisionContext, NoulCriteria } from "../types";

export interface CalculationFacts {
  tActualMm?: number;
  tRequiredMm?: number;
  corrosionRateMmYr?: number;
  remainingLifeYears?: number;
  governingVerdict?: string;
  governingCitation?: string;
}

export interface SemanticGuardInput {
  narrativeText: string;
  facts: CalculationFacts;
  allowlistedCitations?: string[];
}

export interface SemanticGuardResult {
  isGrounded: boolean;
  confidence: number;
  unauthorizedCitations: string[];
  numberMismatches: string[];
  latencyMs: number;
}

export const SEMANTIC_GUARD_THRESHOLD = 0.95;

/**
 * Verifies that generated narrative report text is fully grounded in calculation facts.
 */
export async function verifySemanticGrounding(
  provider: DecisionProvider,
  input: SemanticGuardInput,
  signal?: AbortSignal
): Promise<SemanticGuardResult> {
  const context: DecisionContext = {
    state: {
      narrativeText: input.narrativeText,
      facts: input.facts,
      allowlistedCitations: input.allowlistedCitations ?? [
        "api570_7_1_2_governing",
        "api574_10_5_1_4",
        "api570_7_6",
        "asme_b31_3_344_4_2",
        "asme_b31_3_344_3_2",
      ],
    },
    metadata: { spike: "semantic_guard" },
    signal,
  };

  const criteria: NoulCriteria = {
    instructions:
      "Verify whether the narrative text is 100% grounded in the provided calculation facts. Are there any fabricated numbers or unallowlisted code citations?",
    criteria: {
      true: "All numbers, dates, and code citations in the narrative exactly match the provided calculation facts.",
      false: "The narrative invents or alters numerical values, fabricates standard citations, or introduces ungrounded claims.",
    },
  };

  const result = await provider.noul(context, criteria, SEMANTIC_GUARD_THRESHOLD);

  return {
    isGrounded: result.verdict && result.noul >= SEMANTIC_GUARD_THRESHOLD,
    confidence: result.noul,
    unauthorizedCitations: [],
    numberMismatches: [],
    latencyMs: result.latencyMs,
  };
}
