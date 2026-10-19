/**
 * Hermetic wiring smoke test for the measured benchmark (no network).
 * Env-gated (BENCHMARK_WIRING_SMOKE=1) so it never runs by default; verify the
 * wrapper/provider/report path end-to-end with fake providers before spending
 * live calls. Run with the scratch config.
 */
import { describe, expect, it } from "vitest";
import type { DecisionBatchResult, DecisionProvider } from "@/lib/decision/types";
import { BenchmarkRunner } from "@/lib/decision/benchmark/runner";
import { createBenchmarkScenarios } from "@/lib/decision/benchmark/scenarios";
import { PER_REQUEST_TIMEOUT_MS, withTimeout } from "./shared";

function fakeProvider(providerId: string, latencyMs: number, probability: number): DecisionProvider {
  const batch = async (): Promise<DecisionBatchResult> => {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
    return {
      answers: {
        evaluation: {
          type: "noul",
          noul: probability,
          verdict: probability >= 0.5,
          latencyMs,
        },
      },
      usage: { inputTokens: 500, outputTokens: 0 },
      totalLatencyMs: latencyMs,
    };
  };
  return {
    providerId,
    modelId: `fake-${providerId}`,
    noul: async () => { throw new Error("not used"); },
    choice: async () => { throw new Error("not used"); },
    score: async () => { throw new Error("not used"); },
    batch,
  };
}

describe("benchmark wiring smoke (hermetic)", () => {
  it("withTimeout passes through and runComparison completes over 30 scenarios", async () => {
    const scenarios = createBenchmarkScenarios();
    expect(scenarios).toHaveLength(30);

    const runner = new BenchmarkRunner();
    const subq = withTimeout(fakeProvider("subq", 5, 0.9));
    const nebius = withTimeout(fakeProvider("nebius", 8, 0.7));
    const report = await runner.runComparison(subq, scenarios, nebius, {
      iterations: 1,
      pricingByProvider: { nebius: { inputUsd: 0.13, outputUsd: 0.6 } },
    });

    expect(report.status).toBe("measured");
    expect(report.scenarioCount).toBe(30);
    expect(report.runCount).toBe(30);
    expect(report.providers.subq?.successCount).toBe(30);
    expect(report.providers.nebius?.successCount).toBe(30);
    // SubQ has no verified pricing -> null; Nebius gets a cost/1k.
    expect(report.providers.subq?.cost.estimatedCostPer1kUsd).toBeNull();
    expect(report.providers.nebius?.cost.estimatedCostPer1kUsd).toBeGreaterThan(0);
    expect(report.verdict.costWinner).toBeNull(); // cost winner needs BOTH prices
    expect(report.verdict.calibrationWinner).not.toBeNull();
    // Complete measurement, but the harness notes the missing SubQ price:
    expect(report.measurementNotes).toEqual([
      "Cost winner is unavailable until verified per-token pricing is supplied for both providers.",
    ]);
  });

  it("withTimeout composes an outer abort with the 60s per-request timeout", async () => {
    let received: AbortSignal | undefined;
    const probe: DecisionProvider = {
      providerId: "subq",
      modelId: "fake",
      noul: async () => { throw new Error("not used"); },
      choice: async () => { throw new Error("not used"); },
      score: async () => { throw new Error("not used"); },
      batch: async (context) => {
        received = context.signal;
        throw new Error("probe done");
      },
    };
    // No outer signal: the wrapper installs the per-request timeout signal.
    await withTimeout(probe).batch({ state: "x" }, { evaluation: { type: "noul", instructions: "i" } }).catch(() => undefined);
    expect(received).toBeInstanceOf(AbortSignal);
    expect(received?.aborted).toBe(false);

    // With an outer signal: aborting it aborts the composed signal (and the
    // 60s timeout is part of the composition).
    const controller = new AbortController();
    await withTimeout(probe)
      .batch({ state: "x", signal: controller.signal }, { evaluation: { type: "noul", instructions: "i" } })
      .catch(() => undefined);
    controller.abort();
    expect(received?.aborted).toBe(true);
    expect(PER_REQUEST_TIMEOUT_MS).toBe(60_000);
  });
});
