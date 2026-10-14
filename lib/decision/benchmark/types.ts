/**
 * Comparative Benchmark Harness Types (R3)
 * 
 * Compares System-1 decision architectures:
 * NVIDIA Nemotron-3.5-Lightning (Nebius) vs SubQ Snap (SubQ.ai)
 * across latency distributions, calibration metrics, and cost per 1k evals.
 */

import type { DecisionContext } from "../types";

export interface BenchmarkScenario {
  id: string;
  name: string;
  description: string;
  spike: "fluid_classifier" | "fleet_triage" | "morphology_classifier" | "semantic_guard";
  context: DecisionContext;
  expectedType: "noul" | "choice" | "score";
  expectedAnswer?: string | boolean | number;
  tolerance?: number;
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
  brierScore: number;
  /** Expected Calibration Error (ECE) across 10 probability bins */
  expectedCalibrationError: number;
  /** Accuracy specifically on borderline edge cases */
  boundaryAccuracy: number;
}

export interface CostMetrics {
  totalInputTokens: number;
  totalOutputTokens: number;
  /** Estimated cost in USD per 1,000 evaluations */
  estimatedCostPer1kUsd: number;
}

export interface ProviderBenchmarkMetrics {
  providerId: string;
  modelId: string;
  totalRuns: number;
  successCount: number;
  failureCount: number;
  latency: LatencyDistribution;
  calibration: CalibrationMetrics;
  cost: CostMetrics;
}

export interface BenchmarkComparisonReport {
  timestamp: string;
  scenarioCount: number;
  providers: {
    nebius?: ProviderBenchmarkMetrics;
    subq: ProviderBenchmarkMetrics;
  };
  verdict: {
    latencyWinner: "nebius" | "subq" | "tie";
    calibrationWinner: "nebius" | "subq" | "tie";
    costWinner: "nebius" | "subq" | "tie";
  };
}
