/**
 * Spike C: ASME B31.3 PT/MT Morphology Classifier
 *
 * Classifies defect indications into linear vs rounded indications per
 * ASME B31.3-2024 Section 344.4.2 (Liquid Penetrant) & Section 344.3.2 (Magnetic Particle),
 * with every threshold loaded from lib/criteria/ptmt-criteria.json via
 * lib/calc/criteria.ts (criteria sovereignty — no numeric threshold literals here):
 * - Relevance threshold: max dimension > relevance_threshold_mm
 * - Linear indication: Length L > 3 * Width W -> strictly REJECT
 * - Rounded indication: Length L <= 3 * Width W -> accept if within
 *   max_rounded_dimension_mm and not clustered (cluster evaluation stays in lib/calc/ptmt.ts)
 *
 * Strict invariant (0 false negatives): the deterministic geometric rule
 * (L > 3W) OVERRIDES any model "rounded" call — pure TypeScript enforces the
 * code definition, the System-1 model only classifies visual/feature signals.
 */

import type { DecisionProvider, DecisionContext, ChoiceOptions, DecisionImage } from "../types";
import { criteria } from "@/lib/calc/criteria";

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
  const c = criteria.ptmt;
  const maxDimensionMm = Math.max(indication.dimensionLengthMm, indication.dimensionWidthMm);
  const isRelevant = maxDimensionMm > c.relevance_threshold_mm;
  const citation = method === "mt" ? "asme_b31_3_344_3_2" : "asme_b31_3_344_4_2";

  // Deterministic geometric rule check (ASME B31.3 definition, strict > :
  // L == 3W is rounded per code). Pure TS overrides the model below.
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
  const morphology: MorphologyType = isStrictlyLinearByGeometry ? "linear" : choiceResult.choice;

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
    rejectionReason = "Linear or crack-suspect indication exceeds the relevance threshold.";
  } else if (maxDimensionMm > c.limits.max_rounded_dimension_mm) {
    asmeVerdict = "REJECT";
    rejectionReason = "Rounded indication exceeds the maximum acceptable dimension limit.";
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
