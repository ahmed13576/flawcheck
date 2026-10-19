/**
 * MEASURED comparative System-1 benchmark — SubQ Snap vs Nemotron-Lightning
 * over Fork B's full 30-scenario set.
 *
 * Runs BOTH providers through BenchmarkRunner.runComparison (identical
 * scenarioCount and attemptCount — the harness's completeness gate), with a
 * hard 60 s per-request timeout: a hung upstream is counted as a failure, never
 * waited out (Fork A observed a 17-minute upstream stall on 2026-10-19).
 *
 * Synthetic scenario inputs ONLY (no real inspection records, no images).
 * Credentials are never printed; only request counts and diagnostics.
 *
 * Zero-new-dependency runner: executed through vitest (already a devDependency;
 * resolves TS + the @/ alias). Lives under scripts/ (committed, gitignored
 * scratch/ is not for committed artifacts) but uses its OWN config with a
 * scratch/-only include pattern so `npm test` (committed vitest.config.ts,
 * tests/** only) never picks up live network tests.
 *
 * Run: FLAWCHECK_DISABLE_LLM= npx vitest run --config scripts/system1-benchmark/vitest.benchmark.config.ts scripts/system1-benchmark/run-system1-benchmark.test.ts
 */

import path from "node:path";
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DecisionProvider } from "@/lib/decision/types";
import { BenchmarkRunner } from "@/lib/decision/benchmark/runner";
import { createBenchmarkScenarios } from "@/lib/decision/benchmark/scenarios";
import { SubQSnapDecisionProvider } from "@/lib/decision/providers/subq-snap";
import { NebiusNemotronDecisionProvider } from "@/lib/decision/providers/nebius-nemotron";
import { PER_REQUEST_TIMEOUT_MS, PRICING_BY_PROVIDER, PRICING_SOURCES, withTimeout } from "./shared";

const REPORT_PATH = "docs/system1-benchmark-report.json";
const SCRIPT_DIR = path.resolve(__dirname);
const ROOT = path.resolve(SCRIPT_DIR, "..", "..");

function buildProviders(): { subq: DecisionProvider; nebius: DecisionProvider } {
  if (!process.env.SUBQ_API_KEY) throw new Error("SUBQ_API_KEY is required for the live benchmark (never printed).");
  if (!process.env.NEBIUS_API_KEY) throw new Error("NEBIUS_API_KEY is required for the live benchmark (never printed).");
  if (process.env.FLAWCHECK_DISABLE_LLM === "1") throw new Error("FLAWCHECK_DISABLE_LLM=1 would block every live call.");
  // SubQ: env key (SUBQ_API_KEY, never printed). The production-mode baseURL
  // guard requires exactly https://api.subq.ai/v1 — pass it explicitly.
  const subq = new SubQSnapDecisionProvider({ baseURL: "https://api.subq.ai/v1" });
  // Nebius: env-only routing (NEBIUS_MODEL_EXTRACTION), kill-switch aware, no model-ID literals.
  const nebius = new NebiusNemotronDecisionProvider();
  return { subq: withTimeout(subq), nebius: withTimeout(nebius) };
}

describe("measured System-1 comparison: SubQ Snap vs Nemotron-Lightning (live, 30 scenarios)", () => {
  it("runs both providers over the full scenario set and writes the measured report", async () => {
    const scenarios = createBenchmarkScenarios();
    expect(scenarios).toHaveLength(30);

    const { subq, nebius } = buildProviders();

    const runner = new BenchmarkRunner();
    const startedAt = new Date().toISOString();
    const report = await runner.runComparison(subq, scenarios, nebius, {
      iterations: 1,
      pricingByProvider: PRICING_BY_PROVIDER,
    });

    // Measurement notes: pricing sources + timeout policy + live conditions.
    report.measurementNotes.push(
      `Measured live ${startedAt}: SubQ subq-snap-preview vs Nebius NEBIUS_MODEL_EXTRACTION-routed Nemotron-Lightning, ${scenarios.length} synthetic scenarios, 1 attempt each, ${PER_REQUEST_TIMEOUT_MS / 1000}s per-request timeout (failures counted, not hung).`,
      ...PRICING_SOURCES,
    );

    writeFileSync(path.join(ROOT, REPORT_PATH), runner.serializeReport(report), "utf8");
    console.log(`\n=== status: ${report.status} ===`);
    console.log(`subq:  latency p50=${report.providers.subq?.latency.p50Ms}ms p95=${report.providers.subq?.latency.p95Ms}ms, Brier=${report.providers.subq?.calibration.brierScore}, ECE=${report.providers.subq?.calibration.expectedCalibrationError}, cost/1k=${report.providers.subq?.cost.estimatedCostPer1kUsd}, failures=${report.providers.subq?.failureCount}`);
    console.log(`nebius: latency p50=${report.providers.nebius?.latency.p50Ms}ms p95=${report.providers.nebius?.latency.p95Ms}ms, Brier=${report.providers.nebius?.calibration.brierScore}, ECE=${report.providers.nebius?.calibration.expectedCalibrationError}, cost/1k=${report.providers.nebius?.cost.estimatedCostPer1kUsd}, failures=${report.providers.nebius?.failureCount}`);
    console.log(`verdict: latency=${report.verdict.latencyWinner}, calibration=${report.verdict.calibrationWinner}, cost=${report.verdict.costWinner}`);

    // Structural sanity only — the harness itself decides measured vs
    // incomplete_measurement; failures are recorded in the report, not asserted away.
    expect(report.scenarioCount).toBe(30);
    expect(report.providers.subq?.attemptCount).toBe(30);
    expect(report.providers.nebius?.attemptCount).toBe(30);
  }, 3_600_000);
});
