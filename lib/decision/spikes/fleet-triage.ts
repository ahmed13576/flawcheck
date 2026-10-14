/**
 * Spike B: High-Throughput Fleet Triage (SubQ Snap)
 * 
 * Scalable screening across ultrasonic thickness inspection registers (e.g. 4,912 Zenodo readings)
 * routing components into operational triage tiers:
 * - tier_1: Routine (t_actual >= t_required + margin, RL > 10 yr)
 * - tier_2: Re-Check (borderline thickness or 4 yr <= RL <= 10 yr)
 * - tier_3: Critical Escalation (t_actual <= t_required or RL < 4 yr)
 * 
 * Strict Invariant:
 * Pure TypeScript (lib/calc/) computes t_required, corrosion rates, and remaining life.
 * Deterministic critical conditions (t_actual <= t_required or non-finite inputs)
 * immediately trigger Tier 3 without model call.
 */

import type { DecisionProvider, DecisionContext, ChoiceOptions } from "../types";

export type TriageTier = "tier_1" | "tier_2" | "tier_3";

export interface TriageReading {
  cmlId: string;
  component: string;
  location?: string;
  tActualMm: number;
  tRequiredMm: number;
  corrosionRateMmYr?: number;
  remainingLifeYears?: number;
}

export interface TriageEvaluation {
  cmlId: string;
  tier: TriageTier;
  urgency: "immediate" | "scheduled" | "routine";
  confidence: number;
  isDeterministicOverride: boolean;
  notes?: string;
}

export interface BatchTriageSummary {
  totalReadings: number;
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  deterministicOverrides: number;
  elapsedMs: number;
  results: TriageEvaluation[];
}

export const TRIAGE_TIER_CRITERIA: Record<TriageTier, string> = {
  tier_1: "Routine monitoring: Adequate safety margin above t_required and remaining life exceeding 10 years.",
  tier_2: "Re-Check / Scheduled inspection: Borderline remaining life (4 to 10 years) or accelerated corrosion trending.",
  tier_3: "Critical escalation / Immediate engineering review: Thickness at or below t_required, remaining life under 4 years, or high-risk anomaly.",
};

/**
 * Screens a single UT reading into an operational triage tier.
 */
export async function triageReading(
  provider: DecisionProvider,
  reading: TriageReading,
  signal?: AbortSignal
): Promise<TriageEvaluation> {
  // Deterministic guardrails (lib/calc invariant)
  if (!Number.isFinite(reading.tActualMm) || !Number.isFinite(reading.tRequiredMm)) {
    return {
      cmlId: reading.cmlId,
      tier: "tier_3",
      urgency: "immediate",
      confidence: 1.0,
      isDeterministicOverride: true,
      notes: "Deterministic override: Non-finite thickness measurement encountered.",
    };
  }

  if (reading.tActualMm <= reading.tRequiredMm) {
    return {
      cmlId: reading.cmlId,
      tier: "tier_3",
      urgency: "immediate",
      confidence: 1.0,
      isDeterministicOverride: true,
      notes: "Deterministic override: Measured thickness at or below required minimum thickness.",
    };
  }

  if (reading.remainingLifeYears !== undefined && reading.remainingLifeYears < 4.0) {
    return {
      cmlId: reading.cmlId,
      tier: "tier_3",
      urgency: "immediate",
      confidence: 1.0,
      isDeterministicOverride: true,
      notes: "Deterministic override: Remaining life under 4 years.",
    };
  }

  const context: DecisionContext = {
    state: reading as unknown as Record<string, unknown>,
    metadata: { spike: "fleet_triage", cmlId: reading.cmlId },
    signal,
  };

  const options: ChoiceOptions<TriageTier> = {
    instructions: "Evaluate the inspection reading telemetry and classify into operational monitoring tier (tier_1, tier_2, tier_3).",
    criteria: TRIAGE_TIER_CRITERIA,
  };

  const result = await provider.choice<TriageTier>(context, options);
  const urgency = result.choice === "tier_3" ? "immediate" : result.choice === "tier_2" ? "scheduled" : "routine";

  return {
    cmlId: reading.cmlId,
    tier: result.choice,
    urgency,
    confidence: result.confidence,
    isDeterministicOverride: false,
  };
}

/**
 * Batches triage across a large fleet of readings (e.g. 4,912 records).
 */
export async function triageFleetBatch(
  provider: DecisionProvider,
  readings: TriageReading[],
  options?: { batchSize?: number; signal?: AbortSignal }
): Promise<BatchTriageSummary> {
  const start = performance.now();
  const results: TriageEvaluation[] = [];
  let tier1Count = 0;
  let tier2Count = 0;
  let tier3Count = 0;
  let deterministicOverrides = 0;

  for (const reading of readings) {
    const res = await triageReading(provider, reading, options?.signal);
    results.push(res);
    if (res.tier === "tier_1") tier1Count++;
    else if (res.tier === "tier_2") tier2Count++;
    else tier3Count++;
    if (res.isDeterministicOverride) deterministicOverrides++;
  }

  return {
    totalReadings: readings.length,
    tier1Count,
    tier2Count,
    tier3Count,
    deterministicOverrides,
    elapsedMs: performance.now() - start,
    results,
  };
}
