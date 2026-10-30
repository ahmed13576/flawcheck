import { describe, expect, it } from "vitest";
import { createInitialState, wizardReducer } from "@/lib/wizard/reducer";
import { buildCmlSummaries, topCriticalCmls } from "@/lib/calc/cml-summary";
import type { EvaluationResults } from "@/lib/ingest/session";

const subsetDemo = wizardReducer(createInitialState(), { type: "load-demo" });
const subsetEvaluated = wizardReducer(subsetDemo, { type: "run-evaluation" });
const results = subsetEvaluated.results as EvaluationResults;
const rows = buildCmlSummaries(results.readings, subsetDemo.metadata.gaugeUncertainty);

describe("WBT-S6 deterministic CML summaries", () => {
  it("has exactly one Master Register row per unique CML, no duplicates and no omissions", () => {
    expect(results.summary.total).toBe(420);
    expect(rows).toHaveLength(40);
    expect(new Set(rows.map((r) => r.cmlId)).size).toBe(40);
    const ids = rows.map((r) => r.cmlId.replace("WBT-S6 / ", ""));
    expect(ids).toEqual([
      "A1","A2","A3","A4","A5","A6","A7","A8","A9","A10",
      "B1","B2","B3","B4","B5","B6","B7","B8","B9","B10",
      "C1","C2","C3","C4","C5","C6","C7","C8","C9","C10",
      "D1","D2","D3","D4","D5","D6","D7","D8","D9","D10",
    ]);
    expect(rows.reduce((sum, row) => sum + row.scanCount, 0)).toBe(420);
  });

  it("exposes required traceability and thickness/rate fields on every row", () => {
    for (const row of rows) {
      expect(row.scanCount).toBeGreaterThan(0);
      expect(Number.isFinite(row.baselineMm)).toBe(true);
      expect(Number.isFinite(row.latestMm)).toBe(true);
      expect(Number.isFinite(row.historicalMinimumMm)).toBe(true);
      expect(Number.isFinite(row.tPressureMm)).toBe(true);
      expect(Number.isFinite(row.tStructuralMm)).toBe(true);
      expect(Number.isFinite(row.tRequiredMm)).toBe(true);
      expect(Number.isFinite(row.governingRateMmYr)).toBe(true);
      expect(Number.isFinite(row.rawMaxRateMmYr)).toBe(true);
      expect(row.trace).toContain(row.historicalMinimumReadingId);
      expect(["accept", "re_check", "reject"]).toContain(row.disposition);
    }
  });

  it("top 10 CMLs are unique and sorted by min thickness, validated governing rate, raw max rate, natural ID", () => {
    const top = topCriticalCmls(rows, 10);
    expect(top).toHaveLength(10);
    expect(new Set(top.map((r) => r.cmlId)).size).toBe(10);
    const expected = [...rows].sort((a, b) =>
      a.historicalMinimumMm - b.historicalMinimumMm ||
      b.governingRateMmYr - a.governingRateMmYr ||
      b.rawMaxRateMmYr - a.rawMaxRateMmYr ||
      a.cmlId.localeCompare(b.cmlId, undefined, { numeric: true }),
    ).slice(0, 10).map((r) => r.cmlId);
    expect(top.map((r) => r.cmlId)).toEqual(expected);
  });

  it("19.85/19.95 mm verdict boundary remains explicit in the data", () => {
    const tRequired = rows[0].tRequiredMm;
    const guard = tRequired + subsetDemo.metadata.gaugeUncertainty;
    expect(tRequired).toBeCloseTo(19.85, 6);
    expect(guard).toBeCloseTo(19.95, 6);
  });
});
