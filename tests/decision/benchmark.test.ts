import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DecisionBatchResult, DecisionProvider } from "../../lib/decision/types";
import { BenchmarkRunner } from "../../lib/decision/benchmark/runner";
import { createBenchmarkScenarios } from "../../lib/decision/benchmark/scenarios";
import { calculateCalibrationMetrics, calculateCostMetrics, calculateLatencyDistribution } from "../../lib/decision/benchmark/metrics";
function providerWithBatch(batch: () => DecisionBatchResult, providerId = "subq"): DecisionProvider {
  return {
    providerId,
    modelId: "mock-subq",
    noul: async () => { throw new Error("not used"); },
    choice: async () => { throw new Error("not used"); },
    score: async () => { throw new Error("not used"); },
    batch: async () => batch(),
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
    const batchResult: DecisionBatchResult = {
      answers: { evaluation: {
        type: "choice",
        choice: "class_1",
        probabilities: { class_1: 0.8, class_2: 0.1, class_3: 0.05, class_4: 0.05 },
        confidence: 0.8,
        latencyMs: 3,
      } },
      usage: { inputTokens: 10, outputTokens: 0 },
      totalLatencyMs: 3,
    };
    const provider = providerWithBatch(() => batchResult);

    const metrics = await new BenchmarkRunner().runProviderSuite(provider, [scenario], { iterations: 2 });

    expect(metrics).toMatchObject({
      scenarioCount: 1,
      attemptCount: 2,
      successCount: 2,
      failureCount: 0,
      latency: { minMs: 3, p95Ms: 3 },
      calibration: { brierScore: 0.04, expectedCalibrationError: 0.2 },
      cost: { totalInputTokens: 20, totalOutputTokens: 0, estimatedCostPer1kUsd: null },
    });
  });

  it("reports a comparison measured only after both providers complete every attempt", async () => {
    const batchResult: DecisionBatchResult = {
      answers: { evaluation: {
        type: "choice", choice: "class_1", probabilities: { class_1: 0.8, class_2: 0.1, class_3: 0.05, class_4: 0.05 }, confidence: 0.8, latencyMs: 3,
      } },
      usage: { inputTokens: 10, outputTokens: 0 },
      totalLatencyMs: 3,
    };
    const runner = new BenchmarkRunner();
    const scenarios = createBenchmarkScenarios().slice(0, 2);
    const report = await runner.runComparison(
      providerWithBatch(() => batchResult, "subq"),
      scenarios,
      providerWithBatch(() => batchResult, "nebius"),
      { iterations: 3 },
    );

    expect(report.status).toBe("measured");
    expect(report.scenarioCount).toBe(2);
    expect(report.runCount).toBe(6);
    expect(report.providers.subq).toMatchObject({ scenarioCount: 2, attemptCount: 6, successCount: 6, failureCount: 0 });
    expect(report.verdict.latencyWinner).toBe("tie");
  });

  it("keeps failed provider comparisons unmeasured with null verdicts and diagnostics", async () => {
    const batchResult: DecisionBatchResult = {
      answers: { evaluation: {
        type: "choice", choice: "class_1", probabilities: { class_1: 0.8, class_2: 0.1, class_3: 0.05, class_4: 0.05 }, confidence: 0.8, latencyMs: 3,
      } },
      usage: { inputTokens: 10, outputTokens: 0 },
      totalLatencyMs: 3,
    };
    const failed: DecisionProvider = {
      ...providerWithBatch(() => batchResult, "nebius"),
      batch: async () => { throw new Error("HTTP 429 rate limit"); },
    };
    const report = await new BenchmarkRunner().runComparison(
      providerWithBatch(() => batchResult, "subq"),
      createBenchmarkScenarios().slice(0, 1),
      failed,
    );

    expect(report.status).toBe("incomplete_measurement");
    expect(report.verdict).toEqual({ latencyWinner: null, calibrationWinner: null, costWinner: null });
    expect(report.measurementNotes.join(" ")).toContain("HTTP 429 rate limit");
    expect(report.providers.nebius).toMatchObject({ successCount: 0, failureCount: 1, attemptCount: 1 });
  });

  it("does not publish invented benchmark measurements in the committed report", () => {
    const artifact = JSON.parse(readFileSync("docs/system1-benchmark-report.json", "utf8"));
    const pending = new BenchmarkRunner().createPendingReport(30, ["Live measurements not run."]);

    expect(artifact.status).toBe("pending_live_measurement");
    expect(artifact.scenarioCount).toBe(30);
    expect(artifact.runCount).toBe(0);
    expect(artifact.providers).toEqual({});
    expect(artifact.verdict).toEqual({ latencyWinner: null, calibrationWinner: null, costWinner: null });
    expect(pending.status).toBe("pending_live_measurement");
    expect(JSON.parse(new BenchmarkRunner().serializeReport(pending)).providers).toEqual({});
  });
});
