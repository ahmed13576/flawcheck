import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DecisionBatchResult, DecisionProvider } from "../../lib/decision/types";
import { BenchmarkRunner } from "../../lib/decision/benchmark/runner";
import { createBenchmarkScenarios } from "../../lib/decision/benchmark/scenarios";
import { calculateCalibrationMetrics, calculateCostMetrics, calculateLatencyDistribution } from "../../lib/decision/benchmark/metrics";
import type { BenchmarkScenario } from "../../lib/decision/benchmark/types";

function providerWithBatch(batch: (scenario: BenchmarkScenario) => DecisionBatchResult): DecisionProvider {
  let currentScenario: BenchmarkScenario | undefined;
  return {
    providerId: "subq",
    modelId: "mock-subq",
    noul: async () => { throw new Error("not used"); },
    choice: async () => { throw new Error("not used"); },
    score: async () => { throw new Error("not used"); },
    batch: async (_context, questions) => {
      currentScenario = {
        id: "test",
        name: "test",
        spike: "fluid_classifier",
        description: "test",
        context: { state: "test" },
        expectedType: "choice",
        question: questions.evaluation,
        expectedAnswer: "class_1",
        source: "synthetic_fixture",
      };
      return batch(currentScenario);
    },
  };
}

describe("System-1 benchmark harness", () => {
  it("builds 30 synthetic scenarios spanning all four spikes", () => {
    const scenarios = createBenchmarkScenarios();

    expect(scenarios).toHaveLength(30);
    expect(new Set(scenarios.map((scenario) => scenario.spike))).toEqual(new Set([
      "fluid_classifier", "fleet_triage", "morphology_classifier", "semantic_guard",
    ]));
    expect(scenarios.every((scenario) => scenario.source === "synthetic_fixture")).toBe(true);
  });

  it("calculates nearest-rank latency percentiles accurately", () => {
    expect(calculateLatencyDistribution([40, 10, 30, 20])).toEqual({
      minMs: 10,
      maxMs: 40,
      meanMs: 25,
      p50Ms: 20,
      p90Ms: 40,
      p95Ms: 40,
      p99Ms: 40,
    });
  });

  it("calculates Brier score, ten-bin ECE, and boundary accuracy", () => {
    expect(calculateCalibrationMetrics([
      { probability: 0.9, correct: true, boundary: false },
      { probability: 0.2, correct: false, boundary: true },
    ])).toEqual({ brierScore: 0.025, expectedCalibrationError: 0.15, boundaryAccuracy: 0 });
    expect(calculateCalibrationMetrics([])).toEqual({ brierScore: null, expectedCalibrationError: null, boundaryAccuracy: null });
  });

  it("computes cost only when caller supplies verified prices", () => {
    expect(calculateCostMetrics(20, 0, 2, { inputUsd: 2, outputUsd: 6 })).toEqual({
      totalInputTokens: 20,
      totalOutputTokens: 0,
      estimatedCostPer1kUsd: 0.02,
    });
    expect(calculateCostMetrics(20, 0, 2).estimatedCostPer1kUsd).toBeNull();
  });

  it("runs identical scenarios, captures usage, and leaves cost unpriced without inputs", async () => {
    const scenario = createBenchmarkScenarios()[0];
    const provider = providerWithBatch(() => ({
      answers: { evaluation: {
        type: "choice",
        choice: "class_1",
        probabilities: { class_1: 0.8, class_2: 0.1, class_3: 0.05, class_4: 0.05 },
        confidence: 0.8,
        latencyMs: 3,
      } },
      usage: { inputTokens: 10, outputTokens: 0 },
      totalLatencyMs: 3,
    }));

    const metrics = await new BenchmarkRunner().runProviderSuite(provider, [scenario], { iterations: 2 });

    expect(metrics).toMatchObject({
      totalRuns: 2,
      successCount: 2,
      failureCount: 0,
      latency: { minMs: 3, p95Ms: 3 },
      calibration: { brierScore: 0.04, expectedCalibrationError: 0.2 },
      cost: { totalInputTokens: 20, totalOutputTokens: 0, estimatedCostPer1kUsd: null },
    });
  });

  it("does not publish invented benchmark measurements in the committed report", () => {
    const artifact = JSON.parse(readFileSync("docs/system1-benchmark-report.json", "utf8"));
    const pending = new BenchmarkRunner().createPendingReport(30, ["Live measurements not run."]);

    expect(artifact.status).toBe("pending_live_measurement");
    expect(artifact.providers).toEqual({});
    expect(artifact.verdict).toEqual({ latencyWinner: null, calibrationWinner: null, costWinner: null });
    expect(pending.status).toBe("pending_live_measurement");
    expect(JSON.parse(new BenchmarkRunner().serializeReport(pending)).providers).toEqual({});
  });
});
