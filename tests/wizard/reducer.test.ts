import { describe, it, expect } from "vitest";
import {
  createInitialState,
  createInitialSession,
  wizardReducer,
  blockingChecks,
  type WizardState,
} from "@/lib/wizard/reducer";
import type { EvaluationSession } from "@/lib/ingest/session";

// -- helpers -------------------------------------------------------------------

const loaded: WizardState = wizardReducer(createInitialState(), {
  type: "load-sample",
});
const evaluated: WizardState = wizardReducer(loaded, {
  type: "run-evaluation",
});

const SAMPLE_CSV = [
  "Reading_ID,Tank,Grid_Position,Original_Scantling_mm,Measured_Thickness_mm,Measurement_Date",
  "R1,T1,G1,20,10.5,2024-01-15",
  "R2,T1,G1,20,10.2,2025-01-15",
].join("\n");

function parse(csv: string, filename = "register.csv"): WizardState {
  return wizardReducer(createInitialState(), { type: "parse-file", filename, content: csv });
}

// -- Plan 02-01 tracer slice (carried forward) ----------------------------------

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
    // 02-04: Original_Scantling_mm is a constant design scantling, not a
    // measured t-initial — the demo decision applies to the tracer too.
    expect(loaded.mapping.tInitial).toBeNull();
    expect(loaded.mapping.measuredThickness).toBe("Measured_Thickness_mm");
    expect(loaded.mapping.measurementDate).toBe("Measurement_Date");
    expect(loaded.mapping.tPrevious).toBeNull();
    expect(loaded.units.csvThickness).toBe("mm");
    expect(loaded.units.metadata).toBe("mm");
  });
});

describe("wizard reducer — run-evaluation (tracer golden values)", () => {
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
    expect(first.nextInspection).toBeNull();
    expect(["accept", "re_check", "reject"]).toContain(first.verdict);
  });
  it("state stays JSON-serializable (Phase 3/4 contract)", () => {
    const roundTripped = JSON.parse(JSON.stringify(evaluated)) as EvaluationSession;
    expect(roundTripped).toEqual(evaluated);
  });
});

// -- Plan 02-04 Task 1: ingest pipeline ------------------------------------------

describe("wizard reducer — parse-file (Screen 1 ingest)", () => {
  it("parses a valid CSV string into rows + headers with auto-guessed mapping", () => {
    const state = parse(SAMPLE_CSV);
    expect(state.csv.rowCount).toBe(2);
    expect(state.rows).toHaveLength(2);
    expect(state.csv.headers).toHaveLength(6);
    expect(state.source.filename).toBe("register.csv");
    expect(state.source.isDemo).toBe(false);
    expect(state.mapping.readingId).toBe("Reading_ID");
    expect(state.mapping.measuredThickness).toBe("Measured_Thickness_mm");
    expect(state.mapping.measurementDate).toBe("Measurement_Date");
    expect(state.mapping.tank).toBe("Tank");
    // _mm suffix auto-guesses the CSV thickness unit.
    expect(state.units.csvThickness).toBe("mm");
    expect(state.ui.screen).toBe(2);
    expect(state.ui.parsing).toBeNull();
  });

  it("stores the CsvParseError list on an unparseable CSV (UI-05)", () => {
    const state = parse('Reading_ID,Measured_Thickness_mm\n"R1,10.5', "bad.csv");
    expect(state.ui.ingestError).not.toBeNull();
    expect(state.ui.ingestError!.kind).toBe("parse-failure");
    if (state.ui.ingestError!.kind === "parse-failure") {
      expect(state.ui.ingestError!.filename).toBe("bad.csv");
      expect(state.ui.ingestError!.errors.length).toBeGreaterThan(0);
      expect(state.ui.ingestError!.errors[0].line).toBe(2);
      expect(state.ui.ingestError!.errors[0].problem).toContain("unclosed quoted field");
    }
    expect(state.csv.rowCount).toBe(0);
    expect(state.ui.screen).toBe(1);
  });

  it("renders the zero-rows error for a headers-only CSV (UI-06)", () => {
    const state = parse("Reading_ID,Measured_Thickness_mm\n", "empty.csv");
    expect(state.ui.ingestError).not.toBeNull();
    expect(state.ui.ingestError!.kind).toBe("zero-rows");
    expect(state.ui.screen).toBe(1);
  });

  it("a 6 MB payload fails the size gate loudly BEFORE tokenize (T-02-06)", () => {
    const sixMb = "a".repeat(6 * 1024 * 1024);
    const state = parse(sixMb, "huge.csv");
    expect(state.ui.ingestError).not.toBeNull();
    expect(state.ui.ingestError!.kind).toBe("too-large");
    if (state.ui.ingestError!.kind === "too-large") {
      expect(state.ui.ingestError!.message).toContain("6.0 MB");
      expect(state.ui.ingestError!.message).toContain("5 MB");
    }
  });

  it("parse-invalid only sets the inline error — loaded rows unchanged (UI-02)", () => {
    const state = wizardReducer(loaded, { type: "parse-invalid", filename: "notes.txt" });
    expect(state.ui.ingestError).not.toBeNull();
    expect(state.ui.ingestError!.kind).toBe("invalid-file");
    expect(state.csv.rowCount).toBe(6);
    expect(state.rows).toBe(loaded.rows);
    expect(state.ui.screen).toBe(2);
  });

  it("dismiss-ingest-error returns to the idle state", () => {
    const errored = wizardReducer(createInitialState(), {
      type: "parse-invalid",
      filename: "x.txt",
    });
    const dismissed = wizardReducer(errored, { type: "dismiss-ingest-error" });
    expect(dismissed.ui.ingestError).toBeNull();
    expect(dismissed.ui.screen).toBe(1);
  });
});

describe("wizard reducer — load-demo (zero-network Zenodo fixture)", () => {
  const demo: WizardState = wizardReducer(createInitialState(), { type: "load-demo" });

  it("loads the 4,912-row session with isDemo true", () => {
    expect(demo.csv.rowCount).toBe(4912);
    expect(demo.rows).toHaveLength(4912);
    expect(demo.source.isDemo).toBe(true);
    expect(demo.ui.screen).toBe(2);
  });

  it("leaves t-initial/t-previous unmapped (derived R6 history governs)", () => {
    expect(demo.mapping.tInitial).toBeNull();
    expect(demo.mapping.tPrevious).toBeNull();
  });

  it("carries zero blocking row errors and a valid metadata draft", () => {
    const blockers = blockingChecks(demo);
    expect(blockers.rowErrors).toBe(0);
    expect(blockers.unmappedRequired).toHaveLength(0);
    expect(blockers.metadataProblems).toHaveLength(0);
    expect(blockers.unitsUndeclared).toBe(false);
  });

  it("metadata draft round-trips the demo preset values", () => {
    expect(demo.ui.metadataDraft.tStructural).toBe("19.85");
    expect(demo.ui.metadataDraft.gaugeUncertainty).toBe("0.1");
    expect(demo.ui.metadataDraft.pipeClass).toBe("2");
    expect(demo.ui.metadataDraft.od).toBe("2000");
  });
});

describe("wizard reducer — replace-confirm flow (UI-03)", () => {
  it("staging keeps existing rows until Replace is confirmed", () => {
    const staged = wizardReducer(loaded, {
      type: "stage-replace",
      pending: { filename: "new.csv", content: SAMPLE_CSV },
    });
    expect(staged.ui.replaceConfirm).not.toBeNull();
    expect(staged.csv.rowCount).toBe(6);
    expect(staged.rows).toBe(loaded.rows);

    const cancelled = wizardReducer(staged, { type: "cancel-replace" });
    expect(cancelled.ui.replaceConfirm).toBeNull();
    expect(cancelled.csv.rowCount).toBe(6);
    expect(cancelled.rows).toBe(loaded.rows);
  });

  it("Replace swaps data and re-enters mapping", () => {
    const staged = wizardReducer(loaded, {
      type: "stage-replace",
      pending: { filename: "new.csv", content: SAMPLE_CSV },
    });
    const replaced = wizardReducer(staged, { type: "confirm-replace" });
    expect(replaced.ui.replaceConfirm).toBeNull();
    expect(replaced.csv.rowCount).toBe(2);
    expect(replaced.source.filename).toBe("new.csv");
    expect(replaced.rows).not.toBe(loaded.rows);
    expect(replaced.ui.screen).toBe(2);
  });
});

describe("wizard reducer — navigation", () => {
  it("set-screen allows back-navigation only", () => {
    const back = wizardReducer(evaluated, { type: "set-screen", screen: 2 });
    expect(back.ui.screen).toBe(2);
    const backAgain = wizardReducer(back, { type: "set-screen", screen: 1 });
    expect(backAgain.ui.screen).toBe(1);
    // forward via set-screen is refused (CTAs own forward navigation)
    const forward = wizardReducer(back, { type: "set-screen", screen: 3 });
    expect(forward.ui.screen).toBe(2);
  });

  it("reset returns a fresh initial state", () => {
    const reset = wizardReducer(evaluated, { type: "reset" });
    expect(reset.ui.screen).toBe(1);
    expect(reset.csv.rowCount).toBe(0);
    expect(reset.results).toBeNull();
    expect(reset.ui.rowIssues).toHaveLength(0);
  });

  it("createInitialSession (session-only factory) stays available", () => {
    const session = createInitialSession();
    expect(session.csv.rowCount).toBe(0);
    expect(session.results).toBeNull();
  });
});

// -- Plan 02-04 Task 2: mapping + row editing + blocking selector ----------------

const INVALID_CSV = [
  "Reading_ID,Tank,Measured_Thickness_mm,Measurement_Date",
  "R1,T1,10.5,2024-01-15",
  "R2,T1,abc,2024-02-20",
  "R3,T1,-2,2024-03-25",
].join("\n");

describe("wizard reducer — set-mapping revalidates (UI-07)", () => {
  it("overriding a mapping to not-mapped re-runs row validation immediately", () => {
    const parsed = parse(INVALID_CSV);
    const before = parsed.ui.rowIssues.filter((i) => i.severity === "error").length;
    expect(before).toBeGreaterThan(0); // 'abc' + negative thickness errors

    const unmapped = wizardReducer(parsed, {
      type: "set-mapping",
      field: "measuredThickness",
      header: null,
    });
    // Revalidation ran: with the column unmapped, every cell becomes a blank
    // required cell — 'not a number' errors flip to 'missing value' errors —
    // and the required-field blocker flips on.
    const missingValue = unmapped.ui.rowIssues.filter(
      (i) => i.severity === "error" && i.message.endsWith("missing value."),
    );
    expect(missingValue.length).toBeGreaterThan(0);
    expect(
      unmapped.ui.rowIssues.some((i) => i.message.includes("not a number ('abc')")),
    ).toBe(false);
    expect(blockingChecks(unmapped).unmappedRequired).toContain("measuredThickness");
  });

  it("mapping a header with a unit suffix re-guesses the CSV thickness unit", () => {
    const parsed = parse(SAMPLE_CSV);
    expect(parsed.units.csvThickness).toBe("mm");
    // 'Thickness_in' misses the thickness alias table (exact match), so the
    // user maps it manually — the unit then re-guesses from the suffix.
    const remapped = wizardReducer(parsed, {
      type: "set-mapping",
      field: "measuredThickness",
      header: "Thickness_in",
    });
    expect(remapped.mapping.measuredThickness).toBe("Thickness_in");
    expect(remapped.units.csvThickness).toBe("in");
  });

  it("a manual unit override survives mapping changes", () => {
    const parsed = parse(SAMPLE_CSV);
    const manual = wizardReducer(parsed, { type: "set-csv-thickness-unit", unit: "mils" });
    expect(manual.units.csvThickness).toBe("mils");
    const remapped = wizardReducer(manual, {
      type: "set-mapping",
      field: "tank",
      header: "Grid_Position",
    });
    expect(remapped.units.csvThickness).toBe("mils");
  });
});

describe("wizard reducer — set-row-cell (UI-09)", () => {
  it("editing a cell to a valid value clears its error badge", () => {
    const parsed = parse(INVALID_CSV);
    const row2Errors = parsed.ui.rowIssues.filter((i) => i.row === 2);
    expect(row2Errors.some((i) => i.message.includes("not a number ('abc')"))).toBe(true);

    const fixed = wizardReducer(parsed, {
      type: "set-row-cell",
      row: 2,
      header: "Measured_Thickness_mm",
      value: "10.1",
    });
    const row2After = fixed.ui.rowIssues.filter((i) => i.row === 2);
    expect(row2After).toHaveLength(0);
    expect(fixed.rows[1].cells["Measured_Thickness_mm"]).toBe("10.1");
  });

  it("editing keeps other rows' errors and stays JSON-serializable", () => {
    const parsed = parse(INVALID_CSV);
    const fixed = wizardReducer(parsed, {
      type: "set-row-cell",
      row: 2,
      header: "Measured_Thickness_mm",
      value: "10.1",
    });
    // row 3 still carries its impossible-value error
    expect(
      fixed.ui.rowIssues.some((i) => i.row === 3 && i.message.includes("must be greater than 0")),
    ).toBe(true);
    const roundTripped = JSON.parse(JSON.stringify(fixed)) as WizardState;
    expect(roundTripped).toEqual(fixed);
  });
});

describe("wizard reducer — blocking selector flips (UI-08)", () => {
  it("unmapping a required field adds the blocker; remapping clears it", () => {
    const parsed = parse(SAMPLE_CSV);
    expect(blockingChecks(parsed).unmappedRequired).toHaveLength(0);

    const unmapped = wizardReducer(parsed, { type: "set-mapping", field: "readingId", header: null });
    const blockers = blockingChecks(unmapped);
    expect(blockers.unmappedRequired).toEqual(["readingId"]);

    const remapped = wizardReducer(unmapped, {
      type: "set-mapping",
      field: "readingId",
      header: "Reading_ID",
    });
    expect(blockingChecks(remapped).unmappedRequired).toHaveLength(0);
  });

  it("4,912-row validation + selector runs fast (Pitfall 8 budget)", () => {
    const started = performance.now();
    const demo = wizardReducer(createInitialState(), { type: "load-demo" });
    const blockers = blockingChecks(demo);
    expect(blockers.rowErrors).toBe(0);
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(1000);
  });
});
