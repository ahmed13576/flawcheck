/**
 * Spike C: ASME B31.3 PT/MT Morphology Classifier (SubQ Snap)
 * 
 * Classifies defect indications into linear vs rounded indications per
 * ASME B31.3-2024 Section 344.4.2 (Liquid Penetrant) & Section 344.3.2 (Magnetic Particle):
 * - Relevance threshold: Dimension > 1.5 mm
 * - Linear indication: Length L > 3 * Width W -> Strictly REJECT
 * - Rounded indication: Length L <= 3 * Width W -> Accept if L <= 5.0 mm and not clustered
 * 
 * Supports textual notes and native SubQ Snap multi-modal image inspection.
 */

import type { DecisionProvider, DecisionContext, ChoiceOptions, DecisionImage } from "../types";

export type MorphologyType = "linear" | "rounded";
export type AsmeVerdict = "ACCEPT" | "REJECT";

export interface IndicationInput {
  dimensionLengthMm: number;
  dimensionWidthMm: number;
  inspectorNotes?: string;
  image?: DecisionImage;
}

export interface MorphologyClassificationResult {
  morphology: MorphologyType;
  isRelevant: boolean;
  isCrackSuspect: boolean;
  confidence: number;
  asmeVerdict: AsmeVerdict;
  citation: "asme_b31_3_344_4_2" | "asme_b31_3_344_3_2";
  rejectionReason?: string;
  latencyMs: number;
}

export const MORPHOLOGY_OPTIONS: Record<MorphologyType, string> = {
  linear: "Linear indication: Length exceeds three times the width (L > 3W). Represents cracks, lack of fusion, or sharp tears.",
  rounded: "Rounded indication: Circular or elliptical shape with length equal to or less than three times the width (L <= 3W). Represents porosity or gas pockets.",
};

/**
 * Classifies flaw indication morphology and applies ASME B31.3 acceptance criteria.
 */
export async function classifyIndicationMorphology(
  provider: DecisionProvider,
  indication: IndicationInput,
  method: "pt" | "mt" = "pt",
  signal?: AbortSignal
): Promise<MorphologyClassificationResult> {
  const isRelevant = indication.dimensionLengthMm > 1.5;
  const citation = method === "mt" ? "asme_b31_3_344_3_2" : "asme_b31_3_344_4_2";

  // Deterministic geometric rule check (ASME B31.3 definition)
  const isStrictlyLinearByGeometry = indication.dimensionLengthMm > 3 * indication.dimensionWidthMm;

  const context: DecisionContext = {
    state: {
      dimensionLengthMm: indication.dimensionLengthMm,
      dimensionWidthMm: indication.dimensionWidthMm,
      ratio: indication.dimensionWidthMm > 0 ? indication.dimensionLengthMm / indication.dimensionWidthMm : 0,
      inspectorNotes: indication.inspectorNotes ?? "",
      inspectionMethod: method.toUpperCase(),
    },
    images: indication.image ? [indication.image] : undefined,
    metadata: { spike: "morphology_classifier", method },
    signal,
  };

  const options: ChoiceOptions<MorphologyType> = {
    instructions:
      "Classify this NDT indication as 'linear' or 'rounded' based on geometry and indication visual features.",
    criteria: MORPHOLOGY_OPTIONS,
  };

  const choiceResult = await provider.choice<MorphologyType>(context, options);
  const morphology = isStrictlyLinearByGeometry ? "linear" : choiceResult.choice;

  // Crack check gate
  const crackGate = await provider.noul(
    context,
    {
      instructions: "Does this indication show evidence of cracking, sharp stress concentration, or lack of fusion?",
      criteria: {
        true: "High probability of crack or lack of fusion",
        false: "Benign rounded gas porosity or slag inclusion",
      },
    },
    0.5
  );

  const isCrackSuspect = crackGate.verdict || morphology === "linear";

  let asmeVerdict: AsmeVerdict = "ACCEPT";
  let rejectionReason: string | undefined;

  if (!isRelevant) {
    asmeVerdict = "ACCEPT";
  } else if (morphology === "linear" || isCrackSuspect) {
    asmeVerdict = "REJECT";
    rejectionReason = "Linear or crack-suspect indication exceeds 1.5 mm relevance threshold.";
  } else if (indication.dimensionLengthMm > 5.0) {
    asmeVerdict = "REJECT";
    rejectionReason = "Rounded indication exceeds 5.0 mm maximum acceptable size limit.";
  }

  return {
    morphology,
    isRelevant,
    isCrackSuspect,
    confidence: choiceResult.confidence,
    asmeVerdict,
    citation,
    rejectionReason,
    latencyMs: choiceResult.latencyMs + crackGate.latencyMs,
  };
}
