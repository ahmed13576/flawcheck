import { describe, it, expect } from "vitest";
import { createInitialSession, wizardReducer } from "@/lib/wizard/reducer";
import type { EvaluationSession } from "@/lib/ingest/session";

const loaded: EvaluationSession = wizardReducer(createInitialSession(), {
  type: "load-sample",
});
const evaluated: EvaluationSession = wizardReducer(loaded, {
  type: "run-evaluation",
});

describe("wizard reducer — load-sample", () => {
  it("fills 6 parsed rows from the committed tracer fixture", () => {
    expect(loaded.rows).toHaveLength(6);
    expect(loaded.csv.rowCount).toBe(6);
    expect(loaded.csv.headers).toEqual([
      "Reading_ID",
      "Tank",
      "Grid_Position",
      "Original_Scantling_mm",
      "Measured_Thickness_mm",
      "Measurement_Date",
    ]);
  });
  it("fills the fixture's metadata preset", () => {
    expect(loaded.metadata.designPressure).toBe(4.0);
    expect(loaded.metadata.od).toBe(114.3);
    expect(loaded.metadata.allowableStress).toBe(138);
    expect(loaded.metadata.e).toBe(1.0);
    expect(loaded.metadata.w).toBe(1.0);
    expect(loaded.metadata.y).toBe(0.4);
    expect(loaded.metadata.fca).toBe(1.0);
    expect(loaded.metadata.tStructural).toBe(0);
    expect(loaded.metadata.gaugeUncertainty).toBe(0.1);
    expect(loaded.metadata.pipeClass).toBe(1);
    expect(loaded.metadata.pressureUnit).toBe("MPa");
    expect(loaded.metadata.formula).toBe("asme_b31_3_straight_pipe");
  });
  it("presets the tracer mapping and mm units on both sides", () => {
    expect(loaded.mapping.readingId).toBe("Reading_ID");
    expect(loaded.mapping.tank).toBe("Tank");
    expect(loaded.mapping.tInitial).toBe("Original_Scantling_mm");
    expect(loaded.mapping.measuredThickness).toBe("Measured_Thickness_mm");
    expect(loaded.mapping.measurementDate).toBe("Measurement_Date");
    expect(loaded.mapping.tPrevious).toBeNull();
    expect(loaded.units.csvThickness).toBe("mm");
    expect(loaded.units.metadata).toBe("mm");
  });
});

describe("wizard reducer — run-evaluation", () => {
  it("produces results with summary total 6 and verdict counts accept 2 / re_check 2 / fail 2", () => {
    expect(evaluated.results).not.toBeNull();
    expect(evaluated.results!.summary).toEqual({
      total: 6,
      locations: 3,
      accept: 2,
      reCheck: 2,
      fail: 2,
    });
  });
  it("computes per-reading results via the calc barrel", () => {
    const readings = evaluated.results!.readings;
    expect(readings).toHaveLength(6);
    const byId = new Map(readings.map((r) => [r.readingId, r]));
    expect(byId.get("A01-2025")!.verdict).toBe("accept");
    expect(byId.get("A01-2025")!.rawCrLtMmYr).toBe(0.029996);
    expect(byId.get("A01-2025")!.rlYears).not.toBeNull();
    expect(Number.isFinite(byId.get("A01-2025")!.rlYears!)).toBe(true);
    expect(byId.get("B02-2025")!.verdict).toBe("reject");
    expect(byId.get("C03-2025")!.verdict).toBe("re_check");
  });
  it("first-campaign readings carry insufficient history with computed verdicts", () => {
    const first = evaluated.results!.readings.find(
      (r) => r.readingId === "A01-2015",
    )!;
    expect(first.flags).toContain("insufficient_history");
    expect(first.rlYears).toBeNull();
    expect(first.nextInspection).toBeNull(); // nextInterval lands in Plan 02-02
    expect(["accept", "re_check", "reject"]).toContain(first.verdict);
  });
  it("state stays JSON-serializable (Phase 3/4 contract)", () => {
    const roundTripped = JSON.parse(JSON.stringify(evaluated)) as EvaluationSession;
    expect(roundTripped).toEqual(evaluated);
  });
});

describe("wizard reducer — reset placeholder", () => {
  it("reset is a no-op placeholder until Plan 02-04 expands the actions", () => {
    expect(wizardReducer(evaluated, { type: "reset" })).toBe(evaluated);
  });
});
