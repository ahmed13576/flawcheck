import { describe, expect, it } from "vitest";
import { createDemoSession } from "@/lib/demo/demo-scenario";
import { groupByCml } from "@/lib/ingest/group";
import { evaluate } from "@/lib/calc/evaluate";
import { buildCmlSummaries } from "@/lib/calc/cml-summary";
import { buildLatestPerCml } from "@/lib/analytics/adapters";

describe("WBT-S6 population reconciliation across CML summary and heatmap", () => {
  const session = createDemoSession("subset");
  const inputs = groupByCml(session.rows, session.mapping, { csvThicknessUnit: session.units.csvThickness });
  const results = evaluate(inputs, session.metadata, session.units, { ptmtIndications: session.ptmt.indications });
  const cmls = buildCmlSummaries(results.readings, session.metadata.gaugeUncertainty);
  const heatmap = buildLatestPerCml(results.readings);

  it("reconciles 420 readings to exactly 40 CML dispositions", () => {
    expect(results.summary.total).toBe(420);
    expect(cmls).toHaveLength(40);
    expect(cmls.reduce((sum, row) => sum + row.scanCount, 0)).toBe(420);
    expect(heatmap).toHaveLength(40);
  });

  it("uses historical-minimum-governed dispositions in the heatmap", () => {
    const byId = new Map(cmls.map((row) => [row.cmlId, row]));
    for (const item of heatmap) {
      const row = byId.get(item.cmlId)!;
      expect(item.verdict).toBe(row.disposition);
      expect(item.tActualMm).toBe(row.historicalMinimumMm);
    }
    expect(heatmap.filter((item) => item.verdict === "reject")).toHaveLength(40);
  });
});
