import { writeFile } from "node:fs/promises";
import type { DecisionBatchResult, DecisionProvider } from "../types";
import {
  calculateCalibrationMetrics,
  calculateCostMetrics,
  calculateLatencyDistribution,
} from "./metrics";
import type {
  BenchmarkComparisonReport,
  BenchmarkScenario,
  CalibrationObservation,
  ProviderBenchmarkMetrics,
  TokenPricingPerMillion,
} from "./types";

export interface BenchmarkRunOptions {
  iterations?: number;
  pricingByProvider?: Record<string, TokenPricingPerMillion>;
}

export class BenchmarkRunner {
  async runProviderSuite(
    provider: DecisionProvider,
    scenarios: BenchmarkScenario[],
    options: BenchmarkRunOptions = {},
  ): Promise<ProviderBenchmarkMetrics> {
    const iterations = options.iterations ?? 1;
    if (!Number.isInteger(iterations) || iterations < 1) throw new RangeError("Benchmark iterations must be a positive integer.");

    const latencies: number[] = [];
    const calibration: CalibrationObservation[] = [];
    let successCount = 0;
    let failureCount = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const scenario of scenarios) {
      for (let iteration = 0; iteration < iterations; iteration++) {
        try {
          const result = await provider.batch(scenario.context, { evaluation: scenario.question });
          const answer = result.answers.evaluation;
          if (!answer) throw new Error("Provider omitted the benchmark answer.");
          successCount++;
          latencies.push(result.totalLatencyMs);
          totalInputTokens += result.usage.inputTokens;
          totalOutputTokens += result.usage.outputTokens;
          const observation = this.toCalibrationObservation(scenario, result);
          if (observation) calibration.push(observation);
        } catch {
          failureCount++;
        }
      }
    }

    const totalRuns = scenarios.length * iterations;
    return {
      providerId: provider.providerId,
      modelId: provider.modelId,
      totalRuns,
      successCount,
      failureCount,
      latency: calculateLatencyDistribution(latencies),
      calibration: calculateCalibrationMetrics(calibration),
      cost: calculateCostMetrics(
        totalInputTokens,
        totalOutputTokens,
        successCount,
        options.pricingByProvider?.[provider.providerId],
      ),
    };
  }

  async runComparison(
    subq: DecisionProvider,
    scenarios: BenchmarkScenario[],
    nebius?: DecisionProvider,
    options: BenchmarkRunOptions = {},
  ): Promise<BenchmarkComparisonReport> {
    const subqMetrics = await this.runProviderSuite(subq, scenarios, options);
    const nebiusMetrics = nebius ? await this.runProviderSuite(nebius, scenarios, options) : undefined;
    return this.generateComparisonReport(subqMetrics, nebiusMetrics);
  }

  generateComparisonReport(
    subqMetrics: ProviderBenchmarkMetrics,
    nebiusMetrics?: ProviderBenchmarkMetrics,
  ): BenchmarkComparisonReport {
    const hasComparison = Boolean(nebiusMetrics);
    return {
      generatedAt: new Date().toISOString(),
      status: hasComparison ? "measured" : "pending_live_measurement",
      measurementNotes: hasComparison ? [] : [
        "No Nebius baseline provider was supplied; comparative winners are unavailable.",
        "Cost remains unavailable until verified per-token pricing is supplied.",
      ],
      scenarioCount: subqMetrics.totalRuns,
      providers: { subq: subqMetrics, ...(nebiusMetrics ? { nebius: nebiusMetrics } : {}) },
      verdict: {
        latencyWinner: nebiusMetrics ? winner(subqMetrics.latency.p95Ms, nebiusMetrics.latency.p95Ms, true) : null,
        calibrationWinner: nebiusMetrics && subqMetrics.calibration.brierScore !== null && nebiusMetrics.calibration.brierScore !== null
          ? winner(subqMetrics.calibration.brierScore, nebiusMetrics.calibration.brierScore, true)
          : null,
        costWinner: nebiusMetrics && subqMetrics.cost.estimatedCostPer1kUsd !== null && nebiusMetrics.cost.estimatedCostPer1kUsd !== null
          ? winner(subqMetrics.cost.estimatedCostPer1kUsd, nebiusMetrics.cost.estimatedCostPer1kUsd, true)
          : null,
      },
    };
  }

  createPendingReport(scenarioCount: number, measurementNotes: string[]): BenchmarkComparisonReport {
    return {
      generatedAt: new Date().toISOString(),
      status: "pending_live_measurement",
      measurementNotes,
      scenarioCount,
      providers: {},
      verdict: { latencyWinner: null, calibrationWinner: null, costWinner: null },
    };
  }

  serializeReport(report: BenchmarkComparisonReport): string {
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  async writeReport(report: BenchmarkComparisonReport, outputPath = "docs/system1-benchmark-report.json"): Promise<void> {
    await writeFile(outputPath, this.serializeReport(report), "utf8");
  }

  private toCalibrationObservation(scenario: BenchmarkScenario, result: DecisionBatchResult): CalibrationObservation | undefined {
    if (scenario.expectedAnswer === undefined) return undefined;
    const answer = result.answers.evaluation;
    if (!answer) return undefined;

    let probability: number | undefined;
    let correct = false;
    if (answer.type === "noul" && typeof scenario.expectedAnswer === "boolean") {
      probability = scenario.expectedAnswer ? answer.noul : 1 - answer.noul;
      correct = answer.verdict === scenario.expectedAnswer;
    } else if (answer.type === "choice" && typeof scenario.expectedAnswer === "string") {
      probability = answer.probabilities[scenario.expectedAnswer];
      correct = answer.choice === scenario.expectedAnswer;
    } else if (answer.type === "score" && typeof scenario.expectedAnswer === "number") {
      probability = answer.probabilities[String(scenario.expectedAnswer)];
      correct = Math.abs(answer.score - scenario.expectedAnswer) <= (scenario.tolerance ?? 0);
    }
    if (probability === undefined || !Number.isFinite(probability)) return undefined;
    return { probability, correct, boundary: Boolean(scenario.boundary) };
  }
}

function winner(subq: number, nebius: number, lowerIsBetter: boolean): "nebius" | "subq" | "tie" {
  if (subq === nebius) return "tie";
  if (lowerIsBetter) return subq < nebius ? "subq" : "nebius";
  return subq > nebius ? "subq" : "nebius";
}
