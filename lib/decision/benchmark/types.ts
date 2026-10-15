/**
 * Comparative Benchmark Harness Types (R3)
 * 
 * Compares System-1 decision architectures:
 * NVIDIA Nemotron-3.5-Lightning (Nebius) vs SubQ Snap (SubQ.ai)
 * across latency distributions, calibration metrics, and cost per 1k evals.
 */

import type { DecisionBatchQuestions, DecisionContext } from "../types";

export interface BenchmarkScenario {
  id: string;
  name: string;
  description: string;
  spike: "fluid_classifier" | "fleet_triage" | "morphology_classifier" | "semantic_guard";
  context: DecisionContext;
  expectedType: "noul" | "choice" | "score";
  question: DecisionBatchQuestions[string];
  expectedAnswer?: string | boolean | number;
  tolerance?: number;
  boundary?: boolean;
  source: "synthetic_fixture" | "reviewed_fixture";
}

export interface LatencyDistribution {
  minMs: number;
  maxMs: number;
  meanMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
}

export interface CalibrationMetrics {
  /** Brier score: mean squared difference between predicted probabilities and actual outcomes */
  brierScore: number | null;
  /** Expected Calibration Error (ECE) across 10 probability bins */
  expectedCalibrationError: number | null;
  /** Accuracy specifically on borderline edge cases */
  boundaryAccuracy: number | null;
}

export interface CostMetrics {
  totalInputTokens: number;
  totalOutputTokens: number;
  /** Estimated cost in USD per 1,000 evaluations */
  estimatedCostPer1kUsd: number | null;
}

export interface ProviderBenchmarkMetrics {
  providerId: string;
  modelId: string;
  scenarioCount: number;
  attemptCount: number;
  successCount: number;
  failureCount: number;
  failureDiagnostics: string[];
  latency: LatencyDistribution;
  calibration: CalibrationMetrics;
  cost: CostMetrics;
}

export interface BenchmarkComparisonReport {
  generatedAt: string;
  status: "measured" | "pending_live_measurement" | "incomplete_measurement";
  measurementNotes: string[];
  scenarioCount: number;
  runCount: number;
  providers: {
    nebius?: ProviderBenchmarkMetrics;
    subq?: ProviderBenchmarkMetrics;
  };
  verdict: {
    latencyWinner: "nebius" | "subq" | "tie" | null;
    calibrationWinner: "nebius" | "subq" | "tie" | null;
    costWinner: "nebius" | "subq" | "tie" | null;
  };
}

export interface CalibrationObservation {
  probability: number;
  correct: boolean;
  boundary: boolean;
}

export interface TokenPricingPerMillion {
  inputUsd: number;
  outputUsd: number;
}
