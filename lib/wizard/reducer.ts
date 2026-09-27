/**
 * Wizard reducer — the pure state engine for the Phase 2 wizard.
 *
 * ALL evaluation logic lives here so tests need no React. The reducer calls
 * only the lib/calc/index.ts barrel and lib/ingest/csv.ts tokenize — the app
 * layer never imports calc internals (must_haves key link). State is the
 * JSON-serializable EvaluationSession (the Phase 3/4 contract).
 *
 * Tracer scope (Plan 02-01): actions load-sample / run-evaluation / reset
 * (no-op placeholder). Plan 02-03 replaces the inline grouping/validation
 * with lib/ingest/group.ts + validate.ts; Plan 02-02 replaces the inline
 * per-reading computation with lib/calc/evaluate.ts; Plan 02-04 expands the
 * action surface for Screens 1-2.
 */
import { buildCells, tokenize } from "@/lib/ingest/csv";
import {
  daysBetweenUtc,
  daysToYears,
  defaultGaugeUncertaintyMm,
  parseIsoUtc,
  rateOutcome,
  remainingLife,
  requiredThickness,
  toMm,
  verdictBand,
} from "@/lib/calc";
import type {
  ComponentMetadata,
  EvaluationInput,
  EvaluationResults,
  EvaluationSession,
  ParsedRow,
  ReadingFlag,
  ReadingResult,
  TargetField,
} from "@/lib/ingest/session";
import { tracerSampleCsv } from "@/lib/demo/fixtures/tracer-sample";

export type WizardAction =
  | { type: "load-sample" }
  | { type: "run-evaluation" }
  | { type: "reset" };

/** Builder-authored preset matching the tracer fixture (Plan 02-01 spec). */
export const TRACER_METADATA_PRESET: ComponentMetadata = {
  od: 114.3,
  tNominal: 0,
  fca: 1.0,
  tStructural: 0,
  designCode: "ASME B31.3 — 2024 Edition",
  pipeClass: 1,
  gaugeUncertainty: defaultGaugeUncertaintyMm(),
  pressureUnit: "MPa",
  designPressure: 4.0,
  allowableStress: 138,
  e: 1.0,
  w: 1.0,
  y: 0.4,
  formula: "asme_b31_3_straight_pipe",
};

const TRACER_MAPPING: Record<TargetField, string | null> = {
  readingId: "Reading_ID",
  tank: "Tank",
  tInitial: "Original_Scantling_mm",
  measuredThickness: "Measured_Thickness_mm",
  measurementDate: "Measurement_Date",
  tPrevious: null,
};

export function createInitialSession(): EvaluationSession {
  return {
    source: { filename: "", isDemo: false, ingestedAt: "" },
    csv: { headers: [], delimiter: ",", rowCount: 0 },
    mapping: {
      readingId: null,
      measuredThickness: null,
      measurementDate: null,
      tInitial: null,
      tPrevious: null,
      tank: null,
    },
    units: { csvThickness: "mm", metadata: "mm" },
    rows: [],
    metadata: TRACER_METADATA_PRESET,
    ptmt: { notes: "", indications: [] },
    results: null,
  };
}

function loadSample(state: EvaluationSession): EvaluationSession {
  const { records, errors, delimiter } = tokenize(tracerSampleCsv, ",");
  if (errors.length > 0 || records.length < 2) {
    // The committed fixture is known-good; a parse failure here is a build bug.
    throw new Error("tracer fixture failed to tokenize");
  }
  const headers = records[0];
  const rows: ParsedRow[] = records.slice(1).map((cells, i) => ({
    row: i + 1,
    cells: buildCells(headers, cells),
    issues: [],
  }));
  return {
    ...state,
    source: { filename: "tracer-sample.csv", isDemo: false, ingestedAt: "" },
    csv: { headers, delimiter, rowCount: rows.length },
    mapping: { ...TRACER_MAPPING },
    units: { csvThickness: "mm", metadata: "mm" },
    rows,
    metadata: { ...TRACER_METADATA_PRESET },
    ptmt: { notes: "", indications: [] },
    results: null,
  };
}

/**
 * Tracer grouping: group valid rows by mapped Tank (fallback Reading_ID),
 * sort each group by parsed date ascending, derive t-initial / t-previous and
 * Δt years per reading (R6). Plan 02-03's lib/ingest/group.ts replaces this
 * inline derivation.
 */
function deriveEvaluationInputs(rows: ParsedRow[], state: EvaluationSession): EvaluationInput[] {
  const groups = new Map<string, ParsedRow[]>();
  for (const row of rows) {
    const tankKey = state.mapping.tank ? row.cells[state.mapping.tank] : "";
    const identity =
      tankKey ||
      (state.mapping.readingId ? row.cells[state.mapping.readingId] : `row-${row.row}`);
    const list = groups.get(identity) ?? [];
    list.push(row);
    groups.set(identity, list);
  }

  const inputs: EvaluationInput[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => {
      const da = parseIsoUtc(a.cells[state.mapping.measurementDate ?? ""])?.getTime() ?? 0;
      const db = parseIsoUtc(b.cells[state.mapping.measurementDate ?? ""])?.getTime() ?? 0;
      return da - db;
    });
    sorted.forEach((row, i) => {
      const dateStr = row.cells[state.mapping.measurementDate ?? ""];
      const d0 = parseIsoUtc(sorted[0].cells[state.mapping.measurementDate ?? ""]);
      const dPrev = i > 0 ? parseIsoUtc(sorted[i - 1].cells[state.mapping.measurementDate ?? ""]) : null;
      const thicknessCell = state.mapping.measuredThickness
        ? row.cells[state.mapping.measuredThickness]
        : "";
      const thicknessAt = (r: ParsedRow) =>
        Number(r.cells[state.mapping.measuredThickness ?? ""]);
      inputs.push({
        readingId: state.mapping.readingId
          ? row.cells[state.mapping.readingId]
          : `row-${row.row}`,
        location: state.mapping.tank
          ? row.cells[state.mapping.tank]
          : (state.mapping.readingId ? row.cells[state.mapping.readingId] : `row-${row.row}`),
        date: dateStr,
        tActualMm: Number(thicknessCell),
        tInitialMm: i === 0 ? null : thicknessAt(sorted[0]),
        tPreviousMm: i === 0 ? null : thicknessAt(sorted[i - 1]),
        dtLtYears: i === 0 || !d0 ? null : daysToYears(daysBetweenUtc(d0, parseIsoUtc(dateStr)!)),
        dtStYears:
          i === 0 || !dPrev || !d0
            ? null
            : daysToYears(daysBetweenUtc(dPrev, parseIsoUtc(dateStr)!)),
      });
    });
  }
  return inputs;
}

function evaluate(state: EvaluationSession): EvaluationSession {
  const meta = state.metadata;
  const inputs = deriveEvaluationInputs(state.rows, state);
  const formulaInputs = {
    designPressure: meta.designPressure,
    odMm: toMm(meta.od, state.units.metadata),
    allowableStress: meta.allowableStress,
    e: meta.e,
    w: meta.w,
    y: meta.y,
    fcaMm: toMm(meta.fca, state.units.metadata),
    tStructuralMm: toMm(meta.tStructural, state.units.metadata),
    formula: meta.formula,
  };
  const rt = requiredThickness(formulaInputs);

  const readings: ReadingResult[] = inputs.map((input) => {
    const outcome = rateOutcome(
      input.tInitialMm,
      input.tPreviousMm,
      input.tActualMm,
      input.dtLtYears,
      input.dtStYears,
    );
    const rl = remainingLife(input.tActualMm, rt.tRequiredMm, outcome.governingEffective);
    const verdict = verdictBand(input.tActualMm, rt.tRequiredMm, meta.gaugeUncertainty);
    const flags: ReadingFlag[] = [];
    if (outcome.insufficientHistory) flags.push("insufficient_history");
    if (outcome.measurementInconsistency) flags.push("measurement_inconsistency");

    const citations = new Set<string>(rt.citations);
    if (outcome.rawLt !== null) citations.add("api570_7_1_2_lt");
    if (outcome.rawSt !== null) citations.add("api570_7_1_2_st");
    if (outcome.governingRaw !== null) citations.add("api570_7_1_2_governing");
    if (rl !== null) citations.add("api570_7_2");

    const reading: ReadingResult = {
      readingId: input.readingId,
      location: input.location,
      date: input.date,
      tActualMm: input.tActualMm,
      tPressureMm: rt.tPressureMm,
      tStructuralMm: rt.tStructuralMm,
      tRequiredMm: rt.tRequiredMm,
      crLtMmYr: outcome.rawLt,
      crStMmYr: outcome.rawSt,
      rawCrLtMmYr: outcome.rawLt,
      rawCrStMmYr: outcome.rawSt,
      crGoverningMmYr: outcome.governingEffective,
      rlYears: rl,
      // nextInspection stays null in the tracer — nextInterval lands in Plan 02-02.
      nextInspection: null,
      flags,
      verdict,
      citations: [...citations],
    };
    return reading;
  });

  const results: EvaluationResults = {
    readings,
    summary: {
      total: readings.length,
      locations: new Set(readings.map((r) => r.location)).size,
      accept: readings.filter((r) => r.verdict === "accept").length,
      reCheck: readings.filter((r) => r.verdict === "re_check").length,
      fail: readings.filter((r) => r.verdict === "reject").length,
    },
    indications: [],
    citationsUsed: [...new Set(readings.flatMap((r) => r.citations))],
  };
  return { ...state, results };
}

export function wizardReducer(
  state: EvaluationSession,
  action: WizardAction,
): EvaluationSession {
  switch (action.type) {
    case "load-sample":
      return loadSample(state);
    case "run-evaluation":
      return evaluate(state);
    case "reset":
      // No-op placeholder — Plan 02-04 expands the action surface.
      return state;
    default:
      return state;
  }
}
