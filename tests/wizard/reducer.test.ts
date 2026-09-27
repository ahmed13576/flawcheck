import { describe, it, expect } from "vitest";
import {
  createInitialState,
  createInitialSession,
  wizardReducer,
  blockingChecks,
  validateSession,
  type EvaluateFn,
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

  it("a 26 MB payload fails the size gate loudly BEFORE tokenize (T-02-06, cap raised to 25 MB in 03-00)", () => {
    const twentySixMb = "a".repeat(26 * 1024 * 1024);
    const state = parse(twentySixMb, "huge.csv");
    expect(state.ui.ingestError).not.toBeNull();
    expect(state.ui.ingestError!.kind).toBe("too-large");
    if (state.ui.ingestError!.kind === "too-large") {
      expect(state.ui.ingestError!.message).toContain("26.0 MB");
      expect(state.ui.ingestError!.message).toContain("25 MB");
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

describe("wizard reducer — CR-01 regression: in/mils upload rows validate clean against the mm OD", () => {
  const MILS_CSV = [
    "Reading_ID,Tank,Measured_Thickness_mils,Measurement_Date",
    "R1,T1,465,2025-01-15",
    "R2,T1,748,2025-01-15",
  ].join("\n");

  it("a healthy 748-mil wall is NOT flagged against a 114.3 mm OD", () => {
    const parsed = parse(MILS_CSV, "mils-register.csv");
    // 'Measured_Thickness_mils' misses the exact thickness alias table — the
    // user maps it manually and the suffix re-guesses the unit (UI-07/12).
    const mapped = wizardReducer(parsed, {
      type: "set-mapping",
      field: "measuredThickness",
      header: "Measured_Thickness_mils",
    });
    expect(mapped.units.csvThickness).toBe("mils");
    // OD check disabled while the draft OD is blank — fill it (mm metadata unit).
    const withOd = wizardReducer(mapped, {
      type: "set-metadata-field",
      field: "od",
      value: "114.3",
    });
    const odErrors = withOd.ui.rowIssues.filter((i) =>
      i.message.includes("exceeds outer diameter"),
    );
    expect(odErrors).toEqual([]);
    expect(withOd.ui.rowIssues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("an over-thickness mils row still fires the OD error after conversion", () => {
    const THICK_MILS_CSV = MILS_CSV.replace("748", "6000"); // 6000 mils = 152.4 mm
    const parsed = parse(THICK_MILS_CSV, "mils-register.csv");
    const mapped = wizardReducer(parsed, {
      type: "set-mapping",
      field: "measuredThickness",
      header: "Measured_Thickness_mils",
    });
    const withOd = wizardReducer(mapped, {
      type: "set-metadata-field",
      field: "od",
      value: "114.3",
    });
    // Direct validateSession pin (the CR-01 seam): unit pass-through keeps the
    // guard live — the UI-state recompute itself is WR-03's regression.
    const fresh = validateSession(withOd, withOd.ui.metadataDraft);
    expect(
      fresh.some((i) =>
        i.message.includes("Row 2: Measured thickness — impossible value, exceeds outer diameter"),
      ),
    ).toBe(true);
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

  it("IN-04: explicitly mapping a header that another field holds clears it there", () => {
    const CSV = "CML,Tank,Measured_Thickness_mm,Measurement_Date\nR1,T1,9.5,2025-01-15\n";
    const parsed = parse(CSV);
    // auto-guess: readingId -> CML (alias order), tank -> Tank.
    expect(parsed.mapping.readingId).toBe("CML");
    const retarget = wizardReducer(parsed, { type: "set-mapping", field: "tank", header: "CML" });
    expect(retarget.mapping.tank).toBe("CML");
    expect(retarget.mapping.readingId).toBeNull(); // one header, one column
  });
});

describe("wizard reducer — WR-03 regression: metadata edits re-gate row validation (UI-07 never stale)", () => {
  it("set-metadata-field (OD) recomputes the thickness-vs-OD check immediately", () => {
    const parsed = parse(SAMPLE_CSV); // thickness 10.5 / 10.2 mm, OD blank -> check disabled
    expect(parsed.ui.rowIssues).toHaveLength(0);

    const tooTight = wizardReducer(parsed, {
      type: "set-metadata-field",
      field: "od",
      value: "10.0",
    });
    expect(
      tooTight.ui.rowIssues.some(
        (i) => i.severity === "error" && i.message.includes("exceeds outer diameter"),
      ),
    ).toBe(true);

    const roomy = wizardReducer(tooTight, {
      type: "set-metadata-field",
      field: "od",
      value: "20",
    });
    expect(
      roomy.ui.rowIssues.some((i) => i.message.includes("exceeds outer diameter")),
    ).toBe(false);
  });

  it("set-metadata-unit recomputes in the converted unit (mm od 114.3 vs mils od 114.3 differ)", () => {
    const MILS_CSV = [
      "Reading_ID,Tank,Measured_Thickness_mils,Measurement_Date",
      "R1,T1,748,2025-01-15",
    ].join("\n");
    const state = wizardReducer(
      wizardReducer(parse(MILS_CSV), {
        type: "set-mapping",
        field: "measuredThickness",
        header: "Measured_Thickness_mils",
      }),
      { type: "set-metadata-field", field: "od", value: "114.3" },
    );
    // metadata unit mm: 114.3 mm OD vs 19.005 mm wall — clean.
    expect(state.ui.rowIssues.filter((i) => i.severity === "error")).toHaveLength(0);

    // Switch the metadata unit to mils: the SAME draft od digits now mean
    // 2.90 mm — the recomputed issues must appear, not a stale badge set.
    const asMils = wizardReducer(state, { type: "set-metadata-unit", unit: "mils" });
    expect(
      asMils.ui.rowIssues.some(
        (i) => i.severity === "error" && i.message.includes("exceeds outer diameter"),
      ),
    ).toBe(true);
  });

  it("set-csv-thickness-unit recomputes (the cells' meaning changed)", () => {
    const state = wizardReducer(parse(SAMPLE_CSV), {
      type: "set-metadata-field",
      field: "od",
      value: "20",
    });
    // CSV read as mm: 10.5 mm < 20 mm OD — clean.
    expect(state.ui.rowIssues.filter((i) => i.severity === "error")).toHaveLength(0);
    // Re-declare the CSV cells as inches: 10.5 in = 266.7 mm — must re-flag.
    const asInches = wizardReducer(state, { type: "set-csv-thickness-unit", unit: "in" });
    expect(
      asInches.ui.rowIssues.some(
        (i) => i.severity === "error" && i.message.includes("exceeds outer diameter"),
      ),
    ).toBe(true);
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

// -- Plan 02-04 Task 3: metadata form, PT/MT, evaluation gating (ING-03/04/05) --

describe("wizard reducer — metadata draft gates the blocking selector (UI-10/11)", () => {
  it("blank required fields produce the locked error copies", () => {
    const blank = createInitialState();
    const blockers = blockingChecks(blank);
    const messages = blockers.metadataProblems.map((p) => p.message);
    expect(messages).toContain("Outer diameter must be a number greater than 0.");
    // IN-06: a blank/zero/negative t-nominal is a non-positive-number problem,
    // not a smaller-than-OD problem — the copy is split accordingly.
    expect(messages).toContain("Nominal thickness must be a number greater than 0.");
    expect(messages).toContain("Select a piping class.");
    expect(messages).toContain("Design pressure must be a number greater than 0.");
    expect(messages).toContain("Allowable stress must be a number greater than 0.");
  });

  it("IN-06: t-nominal copy splits — non-positive vs >= OD each get the honest message", () => {
    const parsed = parse(SAMPLE_CSV);
    const zero = wizardReducer(parsed, { type: "set-metadata-field", field: "tNominal", value: "0" });
    expect(blockingChecks(zero).metadataProblems.map((p) => p.message)).toContain(
      "Nominal thickness must be a number greater than 0.",
    );
    const negative = wizardReducer(parsed, { type: "set-metadata-field", field: "tNominal", value: "-3" });
    expect(blockingChecks(negative).metadataProblems.map((p) => p.message)).toContain(
      "Nominal thickness must be a number greater than 0.",
    );
    const tooThick = [
      { type: "set-metadata-field" as const, field: "od" as const, value: "10" },
      { type: "set-metadata-field" as const, field: "tNominal" as const, value: "12" },
    ].reduce((acc, action) => wizardReducer(acc, action), parsed);
    expect(blockingChecks(tooThick).metadataProblems.map((p) => p.message)).toContain(
      "Nominal thickness must be smaller than the outer diameter.",
    );
  });

  it("t-nominal >= OD, negative FCA, and negative gauge each fire their copy", () => {
    const parsed = parse(SAMPLE_CSV);
    const bad = [
      { type: "set-metadata-field", field: "od", value: "100" },
      { type: "set-metadata-field", field: "tNominal", value: "100" },
      { type: "set-metadata-field", field: "fca", value: "-1" },
      { type: "set-metadata-field", field: "gaugeUncertainty", value: "-0.5" },
      { type: "set-metadata-field", field: "designPressure", value: "4" },
      { type: "set-metadata-field", field: "allowableStress", value: "138" },
      { type: "set-metadata-field", field: "pipeClass", value: "1" },
    ] as const;
    const state = bad.reduce((acc, action) => wizardReducer(acc, action), parsed);
    const messages = blockingChecks(state).metadataProblems.map((p) => p.message);
    expect(messages).toContain("Nominal thickness must be smaller than the outer diameter.");
    expect(messages).toContain("FCA cannot be negative.");
    expect(messages).toContain("Gauge uncertainty cannot be negative.");
  });

  it("WR-02: a non-1|2|3 pipeClass value is a metadata problem and blocks metadataFromDraft", () => {
    const parsed = parse(SAMPLE_CSV);
    const bad = ["4", "abc", "1.5", "-1"].map((value) =>
      wizardReducer(parsed, { type: "set-metadata-field", field: "pipeClass", value }),
    );
    for (const state of bad) {
      const problems = blockingChecks(state).metadataProblems;
      expect(problems.some((p) => p.field === "pipeClass")).toBe(true);
    }
    // blank still fires the same locked copy
    const blank = blockingChecks(parsed).metadataProblems;
    expect(blank.map((p) => p.message)).toContain("Select a piping class.");
  });

  it("a session with metadata problems cannot reach evaluate (gate order)", () => {
    const demo = wizardReducer(createInitialState(), { type: "load-demo" });
    const broke = wizardReducer(demo, {
      type: "set-metadata-field",
      field: "od",
      value: "-5",
    });
    let engineCalls = 0;
    const recording: EvaluateFn = () => {
      engineCalls += 1;
      throw new Error("engine must not run");
    };
    const result = wizardReducer(
      { ...broke, ui: { ...broke.ui, evaluating: true } },
      { type: "run-evaluation", evaluateFn: recording },
    );
    expect(engineCalls).toBe(0);
    expect(result.ui.screen).toBe(2);
  });
});

describe("wizard reducer — PT/MT indications round-trip (ING-04)", () => {
  it("add / update / remove works and stays JSON-serializable", () => {
    let state = parse(SAMPLE_CSV);
    expect(state.ptmt.indications).toHaveLength(0);
    state = wizardReducer(state, { type: "add-indication" });
    expect(state.ptmt.indications).toHaveLength(1);
    const id = state.ptmt.indications[0].id;

    state = wizardReducer(state, {
      type: "update-indication",
      id,
      patch: { method: "MT", morphology: "linear", lengthMm: 4.2, widthMm: 0.8 },
    });
    expect(state.ptmt.indications[0]).toMatchObject({
      method: "MT",
      morphology: "linear",
      lengthMm: 4.2,
      widthMm: 0.8,
      count: 1,
    });

    state = wizardReducer(state, { type: "set-ptmt-notes", notes: "Surface exam 2025." });
    expect(state.ptmt.notes).toBe("Surface exam 2025.");

    const roundTripped = JSON.parse(JSON.stringify(state)) as WizardState;
    expect(roundTripped).toEqual(state);

    state = wizardReducer(state, { type: "remove-indication", id });
    expect(state.ptmt.indications).toHaveLength(0);
  });

  it("incomplete indication rows (dimension 0) are not triaged", () => {
    // the demo carries 2 complete sample indications; a just-added empty row
    // (dimension still 0) must not reach the triage
    const demo = wizardReducer(createInitialState(), { type: "load-demo" });
    expect(demo.ptmt.indications).toHaveLength(2);
    const withRow = wizardReducer(demo, { type: "add-indication" });
    const result = wizardReducer(withRow, { type: "run-evaluation" });
    expect(result.results!.indications).toHaveLength(2);
  });
});

describe("wizard reducer — run-evaluation (UI-23)", () => {
  it("on a valid demo session populates results and flips to Screen 3", () => {
    const demo = wizardReducer(createInitialState(), { type: "load-demo" });
    const result = wizardReducer(demo, { type: "run-evaluation" });
    expect(result.ui.screen).toBe(3);
    expect(result.results).not.toBeNull();
    expect(result.results!.summary.total).toBe(4912);
    expect(result.results!.summary.accept).toBeGreaterThan(0);
    expect(result.results!.summary.fail).toBeGreaterThan(0);
    // demo PT/MT indications triage: linear MT reject + rounded PT accept
    expect(result.results!.indications).toHaveLength(2);
  });

  it("a forced engine error sets the failure banner state and re-enables", () => {
    const demo = wizardReducer(createInitialState(), { type: "load-demo" });
    const failing: EvaluateFn = () => {
      throw new Error("engine exploded");
    };
    const result = wizardReducer(
      { ...demo, ui: { ...demo.ui, evaluating: true } },
      { type: "run-evaluation", evaluateFn: failing },
    );
    expect(result.ui.evaluationError).toBe("engine exploded");
    expect(result.ui.evaluating).toBe(false);
    expect(result.ui.screen).toBe(2);
    expect(result.results).toBeNull();
  });

  it("a session with undeclared units cannot reach evaluate (ING-05 gate order)", () => {
    const demo = wizardReducer(createInitialState(), { type: "load-demo" });
    const undeclared: WizardState = {
      ...demo,
      units: { csvThickness: null, metadata: "mm" } as unknown as WizardState["units"],
    };
    let engineCalls = 0;
    const recording: EvaluateFn = () => {
      engineCalls += 1;
      throw new Error("engine must not run");
    };
    const result = wizardReducer(undeclared, {
      type: "run-evaluation",
      evaluateFn: recording,
    });
    expect(engineCalls).toBe(0);
    expect(result.ui.screen).toBe(2);
    expect(result.ui.evaluationError).toBeNull();
    expect(blockingChecks(undeclared).unitsUndeclared).toBe(true);
  });

  it("evaluation-start raises the evaluating flag (Evaluating… label state)", () => {
    const demo = wizardReducer(createInitialState(), { type: "load-demo" });
    const started = wizardReducer(demo, { type: "evaluation-start" });
    expect(started.ui.evaluating).toBe(true);
    expect(started.ui.evaluationError).toBeNull();
  });
});
