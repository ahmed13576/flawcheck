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
    if (scenarios.length === 0) throw new RangeError("Benchmark requires at least one scenario.");
    const scenarioIds = new Set(scenarios.map(({ id }) => id));
    if (scenarioIds.size !== scenarios.length || scenarios.some(({ id }) => !id.trim())) {
      throw new RangeError("Benchmark scenario IDs must be non-empty and unique.");
    }

    const latencies: number[] = [];
    const calibration: CalibrationObservation[] = [];
    let successCount = 0;
    let failureCount = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const failureDiagnostics: string[] = [];

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
        } catch (error) {
          failureCount++;
          const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
          failureDiagnostics.push(`${scenario.id} (attempt ${iteration + 1}): ${detail.slice(0, 240)}`);
        }
      }
    }

    const totalRuns = scenarios.length * iterations;
    return {
      providerId: provider.providerId,
      modelId: provider.modelId,
      scenarioCount: scenarios.length,
      attemptCount: totalRuns,
      successCount,
      failureCount,
      failureDiagnostics,
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
    const complete = Boolean(nebiusMetrics && isComplete(subqMetrics) && isComplete(nebiusMetrics) &&
      subqMetrics.scenarioCount === nebiusMetrics.scenarioCount &&
      subqMetrics.attemptCount === nebiusMetrics.attemptCount);
    const measurementNotes = !nebiusMetrics
      ? ["No Nebius baseline provider was supplied; comparative results are unavailable."]
      : complete
        ? []
        : [
          ...incompleteDiagnostics("SubQ", subqMetrics),
          ...incompleteDiagnostics("Nebius", nebiusMetrics),
          ...(subqMetrics.scenarioCount !== nebiusMetrics.scenarioCount ? ["Provider scenario counts differ; comparison is invalid."] : []),
          ...(subqMetrics.attemptCount !== nebiusMetrics.attemptCount ? ["Provider attempt counts differ; comparison is invalid."] : []),
        ];
    if (complete && (subqMetrics.cost.estimatedCostPer1kUsd === null || nebiusMetrics?.cost.estimatedCostPer1kUsd === null)) {
      measurementNotes.push("Cost winner is unavailable until verified per-token pricing is supplied for both providers.");
    }
    return {
      generatedAt: new Date().toISOString(),
      status: complete ? "measured" : hasComparison ? "incomplete_measurement" : "pending_live_measurement",
      measurementNotes,
      scenarioCount: subqMetrics.scenarioCount,
      runCount: subqMetrics.attemptCount,
      providers: { subq: subqMetrics, ...(nebiusMetrics ? { nebius: nebiusMetrics } : {}) },
      verdict: {
        latencyWinner: complete && nebiusMetrics ? winner(subqMetrics.latency.p95Ms, nebiusMetrics.latency.p95Ms, true) : null,
        calibrationWinner: complete && nebiusMetrics && subqMetrics.calibration.brierScore !== null && nebiusMetrics.calibration.brierScore !== null
          ? winner(subqMetrics.calibration.brierScore, nebiusMetrics.calibration.brierScore, true)
          : null,
        costWinner: complete && nebiusMetrics && subqMetrics.cost.estimatedCostPer1kUsd !== null && nebiusMetrics.cost.estimatedCostPer1kUsd !== null
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
      runCount: 0,
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

function isComplete(metrics: ProviderBenchmarkMetrics): boolean {
  return metrics.scenarioCount > 0 && metrics.attemptCount > 0 &&
    metrics.attemptCount % metrics.scenarioCount === 0 &&
    metrics.successCount === metrics.attemptCount && metrics.failureCount === 0;
}

function incompleteDiagnostics(providerName: string, metrics: ProviderBenchmarkMetrics): string[] {
  if (metrics.failureCount === 0 && metrics.successCount === metrics.attemptCount && metrics.scenarioCount > 0) {
    if (metrics.attemptCount % metrics.scenarioCount === 0) return [];
    return [`${providerName} run incomplete: ${metrics.attemptCount} attempts do not evenly cover ${metrics.scenarioCount} scenarios.`];
  }
  const notes = [`${providerName} run incomplete: ${metrics.successCount}/${metrics.attemptCount} attempts succeeded across ${metrics.scenarioCount} scenarios.`];
  return [...notes, ...metrics.failureDiagnostics.map((failure) => `${providerName}: ${failure}`)];
}

function winner(subq: number, nebius: number, lowerIsBetter: boolean): "nebius" | "subq" | "tie" {
  if (subq === nebius) return "tie";
  if (lowerIsBetter) return subq < nebius ? "subq" : "nebius";
  return subq > nebius ? "subq" : "nebius";
}
