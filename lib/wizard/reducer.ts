/**
 * Wizard reducer — the pure state engine for the Phase 2 wizard.
 *
 * ALL evaluation logic lives here so tests need no React. The reducer calls
 * only the lib/calc barrel, lib/ingest modules, and lib/demo/demo-scenario —
 * the app layer never imports calc internals (must_haves key link). State is
 * JSON-serializable (the Phase 3/4 contract): EvaluationSession fields stay
 * flat at the top level; wizard-only UI state rides in the additive `ui`
 * field (never shipped to the LLM phase).
 *
 * Plan 02-04 action surface:
 * - ingest: start-parse / parse-file / parse-invalid / parse-too-large /
 *   cancel-parse / dismiss-ingest-error (T-02-06 caps enforced BEFORE tokenize)
 * - demo: load-demo (zero network beyond the static fixture import)
 * - replace: stage-replace / cancel-replace / confirm-replace (UI-03)
 * - review: set-mapping / set-csv-thickness-unit / set-metadata-unit /
 *   set-row-cell / set-page (UI-07..09, UI-13)
 * - metadata: set-metadata-field (string draft; strict numeric grammar) +
 *   set-ptmt-notes / add|update|remove-indication (ING-03, ING-04)
 * - evaluation: evaluation-start / run-evaluation (UI-23) — the ING-05 gate
 *   (assertUnitsDeclared) runs BEFORE the calc engine can be reached
 * - navigation: set-screen (back only), reset
 */
import { buildCells, tokenize, type CsvParseError } from "@/lib/ingest/csv";
import { autoGuess, csvThicknessUnitFromHeader } from "@/lib/ingest/map";
import { groupByCml } from "@/lib/ingest/group";
import {
  assertFileBytes,
  buildParsedRows,
  parseNumericCell,
  rowIssues,
} from "@/lib/ingest/validate";
import {
  assertUnitsDeclared,
  type ComponentMetadata,
  type EvaluationResults,
  type EvaluationSession,
  type ParsedRow,
  type PtmIndication,
  type RowIssue,
  type TargetField,
  type Unit,
} from "@/lib/ingest/session";
import { evaluate, toMm, type EvaluateOptions } from "@/lib/calc";
import { createDemoSession, DEMO_METADATA } from "@/lib/demo/demo-scenario";
import { tracerSampleCsv } from "@/lib/demo/fixtures/tracer-sample";

/** Injectable engine call (tests stub this to force the failure path). */
export type EvaluateFn = typeof evaluate;

export type Screen = 1 | 2 | 3;

/** Loud ingest failures — each renders per the Screen 1 states table. */
export type IngestError =
  | { kind: "invalid-file"; filename: string }
  | { kind: "too-large"; filename: string; message: string }
  | { kind: "too-many-rows"; filename: string; message: string }
  | { kind: "parse-failure"; filename: string; errors: CsvParseError[] }
  | { kind: "zero-rows"; filename: string };

export interface PendingFile {
  filename: string;
  content: string;
}

/** Every metadata form value as a raw string (the strict grammar parses it). */
export type MetadataDraftField =
  | "od"
  | "tNominal"
  | "fca"
  | "tStructural"
  | "pipeClass"
  | "gaugeUncertainty"
  | "designPressure"
  | "allowableStress"
  | "e"
  | "w"
  | "y"
  | "formula"
  | "pressureUnit"
  | "designCode";

export type MetadataDraft = Record<MetadataDraftField, string>;

export interface WizardUiState {
  screen: Screen;
  parsing: { filename: string } | null;
  ingestError: IngestError | null;
  replaceConfirm: { pending: PendingFile } | null;
  page: number;
  /** Semantic row issues — recomputed by every data-touching action (UI-07). */
  rowIssues: RowIssue[];
  metadataDraft: MetadataDraft;
  /** Once the user overrides the CSV unit manually, mapping changes stop re-guessing. */
  csvThicknessUnitManual: boolean;
  evaluating: boolean;
  evaluationError: string | null;
  /** Captured by run-evaluation for the results data-source footnote. */
  evaluatedAt: string | null;
}

/**
 * The wizard store: the EvaluationSession contract fields stay FLAT (R7
 * verbatim, JSON-serializable) plus the additive `ui` field.
 */
export interface WizardState extends EvaluationSession {
  ui: WizardUiState;
}

export type WizardAction =
  | { type: "load-sample" }
  | { type: "load-demo" }
  | { type: "start-parse"; filename: string }
  | { type: "parse-file"; filename: string; content: string }
  | { type: "parse-invalid"; filename: string }
  | { type: "parse-too-large"; filename: string; sizeBytes: number }
  | { type: "cancel-parse" }
  | { type: "dismiss-ingest-error" }
  | { type: "stage-replace"; pending: PendingFile }
  | { type: "cancel-replace" }
  | { type: "confirm-replace" }
  | { type: "set-screen"; screen: Screen }
  | { type: "set-mapping"; field: TargetField; header: string | null }
  | { type: "set-csv-thickness-unit"; unit: Unit }
  | { type: "set-metadata-unit"; unit: Unit }
  | { type: "set-row-cell"; row: number; header: string; value: string }
  | { type: "set-page"; page: number }
  | { type: "set-metadata-field"; field: MetadataDraftField; value: string }
  | { type: "set-ptmt-notes"; notes: string }
  | { type: "add-indication" }
  | { type: "update-indication"; id: string; patch: Partial<PtmIndication> }
  | { type: "remove-indication"; id: string }
  | { type: "evaluation-start" }
  | { type: "run-evaluation"; evaluateFn?: EvaluateFn }
  | { type: "reset" };

// --- presets ------------------------------------------------------------------

/** Builder-authored preset matching the tracer fixture (Plan 02-01 spec). */
export const TRACER_METADATA_PRESET: ComponentMetadata = {
  od: 114.3,
  // 02-04: 8.0 (was 0) so the tracer preset passes the metadata gate —
  // t-nominal is form context only (never used by the engine formulas).
  tNominal: 8.0,
  fca: 1.0,
  tStructural: 0,
  designCode: "ASME B31.3 — 2024 Edition",
  pipeClass: 1,
  gaugeUncertainty: 0.1,
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
  // 02-04: null (was Original_Scantling_mm) — same builder decision as the
  // demo session: Original_Scantling_mm is a constant nominal design
  // scantling (20), NOT a measured t-initial. Wide-format precedence in
  // lib/ingest/group would otherwise feed the constant into CR_LT.
  tInitial: null,
  measuredThickness: "Measured_Thickness_mm",
  measurementDate: "Measurement_Date",
  tPrevious: null,
};

/**
 * Blank form state for a user-supplied CSV: required fields empty (UI-10
 * blocks until filled), optional numeric fields at their spec defaults.
 * session.metadata mirrors the blank numerics so the thickness-vs-OD
 * validation check stays disabled (0) until the user enters a real OD.
 */
export const BLANK_METADATA_DRAFT: MetadataDraft = {
  od: "",
  tNominal: "",
  fca: "0",
  tStructural: "0",
  pipeClass: "",
  gaugeUncertainty: "0.1",
  designPressure: "",
  allowableStress: "",
  e: "1.0",
  w: "1.0",
  y: "0.4",
  formula: "asme_b31_3_straight_pipe",
  pressureUnit: "MPa",
  designCode: "ASME B31.3 — 2024 Edition",
};

const BLANK_METADATA: ComponentMetadata = {
  od: 0,
  tNominal: 0,
  fca: 0,
  tStructural: 0,
  designCode: "ASME B31.3 — 2024 Edition",
  pipeClass: 2,
  gaugeUncertainty: 0.1,
  pressureUnit: "MPa",
  designPressure: 0,
  allowableStress: 0,
  e: 1.0,
  w: 1.0,
  y: 0.4,
  formula: "asme_b31_3_straight_pipe",
};

export function draftFromMetadata(metadata: ComponentMetadata): MetadataDraft {
  return {
    od: String(metadata.od),
    tNominal: String(metadata.tNominal),
    fca: String(metadata.fca),
    tStructural: String(metadata.tStructural),
    pipeClass: String(metadata.pipeClass),
    gaugeUncertainty: String(metadata.gaugeUncertainty),
    designPressure: String(metadata.designPressure),
    allowableStress: String(metadata.allowableStress),
    e: String(metadata.e),
    w: String(metadata.w),
    y: String(metadata.y),
    formula: metadata.formula,
    pressureUnit: metadata.pressureUnit,
    designCode: metadata.designCode,
  };
}

// --- state factories -----------------------------------------------------------

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

const INITIAL_UI: WizardUiState = {
  screen: 1,
  parsing: null,
  ingestError: null,
  replaceConfirm: null,
  page: 1,
  rowIssues: [],
  metadataDraft: BLANK_METADATA_DRAFT,
  csvThicknessUnitManual: false,
  evaluating: false,
  evaluationError: null,
  evaluatedAt: null,
};

export function createInitialState(): WizardState {
  return { ...createInitialSession(), ui: { ...INITIAL_UI } };
}

// --- validation selectors (one path shared by ingest, mapping, and edits) ------

/**
 * Re-run lib/ingest rowIssues over the session (UI-07: never stale).
 *
 * - CR-01: the CSV thickness unit rides along so the OD comparison happens in
 *   canonical mm (a mils CSV is never compared as `748 >= 114.3`).
 * - WR-03: metadata edits re-gate the OD check through the DRAFT — the draft
 *   od is authoritative while the user fills the form (session.metadata only
 *   updates at run-evaluation). Callers without a draft (ingest/demo/sample)
 *   fall back to the session metadata value.
 */
export function validateSession(session: EvaluationSession, draft?: MetadataDraft): RowIssue[] {
  const odRaw = draft ? draftNumber(draft.od) : session.metadata.od;
  const od = odRaw !== null ? toMm(odRaw, session.units.metadata) : 0;
  return rowIssues(session.rows, session.mapping, {
    odMm: od > 0 ? od : 0,
    csvThicknessUnit: session.units.csvThickness,
  });
}

export interface MetadataProblem {
  field: MetadataDraftField;
  message: string;
}

const draftNumber = (raw: string): number | null => parseNumericCell(raw.trim());

/**
 * UI-10/UI-11 metadata catalog — the UI-SPEC error copies verbatim where the
 * spec locks them; parallel builder copy where the spec table gives none
 * (t-structural, E/W/Y).
 */
export function metadataProblems(draft: MetadataDraft): MetadataProblem[] {
  const problems: MetadataProblem[] = [];
  const od = draftNumber(draft.od);
  if (od === null || od <= 0) {
    problems.push({ field: "od", message: "Outer diameter must be a number greater than 0." });
  }
  const tNominal = draftNumber(draft.tNominal);
  if (tNominal === null || tNominal <= 0 || (od !== null && od > 0 && tNominal >= od)) {
    problems.push({
      field: "tNominal",
      message: "Nominal thickness must be smaller than the outer diameter.",
    });
  }
  const fca = draftNumber(draft.fca);
  if (fca === null || fca < 0) {
    problems.push({ field: "fca", message: "FCA cannot be negative." });
  }
  const tStructural = draftNumber(draft.tStructural);
  if (tStructural === null || tStructural < 0) {
    problems.push({ field: "tStructural", message: "Structural min thickness cannot be negative." });
  }
  if (draft.pipeClass.trim() === "") {
    problems.push({ field: "pipeClass", message: "Select a piping class." });
  }
  const gauge = draftNumber(draft.gaugeUncertainty);
  if (gauge === null || gauge < 0) {
    problems.push({ field: "gaugeUncertainty", message: "Gauge uncertainty cannot be negative." });
  }
  const pressure = draftNumber(draft.designPressure);
  if (pressure === null || pressure <= 0) {
    problems.push({
      field: "designPressure",
      message: "Design pressure must be a number greater than 0.",
    });
  }
  const stress = draftNumber(draft.allowableStress);
  if (stress === null || stress <= 0) {
    problems.push({
      field: "allowableStress",
      message: "Allowable stress must be a number greater than 0.",
    });
  }
  const e = draftNumber(draft.e);
  if (e === null || e <= 0) {
    problems.push({ field: "e", message: "E must be a number greater than 0." });
  }
  const w = draftNumber(draft.w);
  if (w === null || w <= 0) {
    problems.push({ field: "w", message: "W must be a number greater than 0." });
  }
  const y = draftNumber(draft.y);
  if (y === null || y <= 0) {
    problems.push({ field: "y", message: "Y must be a number greater than 0." });
  }
  return problems;
}

/** Parse the validated draft into engine metadata; null while any problem remains. */
export function metadataFromDraft(draft: MetadataDraft): ComponentMetadata | null {
  if (metadataProblems(draft).length > 0) return null;
  return {
    od: draftNumber(draft.od)!,
    tNominal: draftNumber(draft.tNominal)!,
    fca: draftNumber(draft.fca)!,
    tStructural: draftNumber(draft.tStructural)!,
    pipeClass: Number(draft.pipeClass) as 1 | 2 | 3,
    gaugeUncertainty: draftNumber(draft.gaugeUncertainty)!,
    designPressure: draftNumber(draft.designPressure)!,
    allowableStress: draftNumber(draft.allowableStress)!,
    e: draftNumber(draft.e)!,
    w: draftNumber(draft.w)!,
    y: draftNumber(draft.y)!,
    formula: draft.formula as ComponentMetadata["formula"],
    pressureUnit: draft.pressureUnit as ComponentMetadata["pressureUnit"],
    designCode: "ASME B31.3 — 2024 Edition",
  };
}

export const REQUIRED_FIELDS: TargetField[] = [
  "readingId",
  "measuredThickness",
  "measurementDate",
];

/** Every blocker class for the Run Evaluation gate (UI-08..12). */
export interface Blockers {
  rowErrors: number;
  rowWarnings: number;
  unmappedRequired: TargetField[];
  metadataProblems: MetadataProblem[];
  unitsUndeclared: boolean;
}

export function blockingChecks(state: WizardState): Blockers {
  const rowErrors = state.ui.rowIssues.filter((i) => i.severity === "error").length;
  const rowWarnings = state.ui.rowIssues.filter((i) => i.severity === "warning").length;
  const unmappedRequired = REQUIRED_FIELDS.filter((f) => !state.mapping[f]);
  const metadata = metadataProblems(state.ui.metadataDraft);
  // UI-12: the session types declare units non-null; a null here means an
  // undeclared input reached the store. The gate refuses before evaluation.
  const unitsView = state.units as { csvThickness: Unit | null; metadata: Unit | null };
  const unitsUndeclared =
    unitsView.csvThickness == null || unitsView.metadata == null;
  return { rowErrors, rowWarnings, unmappedRequired, metadataProblems: metadata, unitsUndeclared };
}

export function hasBlockers(blockers: Blockers): boolean {
  return (
    blockers.rowErrors > 0 ||
    blockers.unmappedRequired.length > 0 ||
    blockers.metadataProblems.length > 0 ||
    blockers.unitsUndeclared
  );
}

// --- ingest pipeline (shared by parse-file and confirm-replace) ----------------

function ingestCsv(state: WizardState, filename: string, content: string): WizardState {
  // T-02-06: the 5 MB cap fires BEFORE tokenize — a huge file fails loudly.
  try {
    assertFileBytes(content.length);
  } catch (error) {
    return {
      ...state,
      ui: {
        ...state.ui,
        parsing: null,
        ingestError: {
          kind: "too-large",
          filename,
          message: error instanceof Error ? error.message : "File is too large.",
        },
      },
    };
  }

  const { records, errors, delimiter } = tokenize(content);
  if (errors.length > 0) {
    return {
      ...state,
      ui: {
        ...state.ui,
        parsing: null,
        ingestError: { kind: "parse-failure", filename, errors },
      },
    };
  }
  // records includes the header row — fewer than 2 means zero data rows (UI-06).
  if (records.length < 2) {
    return {
      ...state,
      ui: {
        ...state.ui,
        parsing: null,
        ingestError: { kind: "zero-rows", filename },
      },
    };
  }

  const headers = records[0];
  let rows: ParsedRow[];
  try {
    rows = buildParsedRows(headers, records.slice(1));
  } catch (error) {
    // T-02-06: the 50,000-row cap fires loudly (never freeze the tab).
    return {
      ...state,
      ui: {
        ...state.ui,
        parsing: null,
        ingestError: {
          kind: "too-many-rows",
          filename,
          message: error instanceof Error ? error.message : "Too many data rows.",
        },
      },
    };
  }
  const mapping = autoGuess(headers);
  const csvThicknessUnit = csvThicknessUnitFromHeader(mapping.measuredThickness);
  const session: EvaluationSession = {
    source: { filename, isDemo: false, ingestedAt: new Date().toISOString() },
    csv: { headers, delimiter, rowCount: rows.length },
    mapping,
    units: { csvThickness: csvThicknessUnit, metadata: state.units.metadata },
    rows,
    metadata: { ...BLANK_METADATA },
    ptmt: { notes: "", indications: [] },
    results: null,
  };
  return {
    ...session,
    ui: {
      ...INITIAL_UI,
      metadataDraft: { ...BLANK_METADATA_DRAFT },
      screen: 2,
      rowIssues: validateSession(session),
    },
  };
}

function loadSample(): WizardState {
  const { records, errors, delimiter } = tokenize(tracerSampleCsv, ",");
  if (errors.length > 0 || records.length < 2) {
    // The committed fixture is known-good; a parse failure here is a build bug.
    throw new Error("tracer fixture failed to tokenize");
  }
  const headers = records[0];
  const rows: ParsedRow[] = buildParsedRows(headers, records.slice(1));
  const session: EvaluationSession = {
    source: { filename: "tracer-sample.csv", isDemo: false, ingestedAt: new Date().toISOString() },
    csv: { headers, delimiter, rowCount: rows.length },
    mapping: { ...TRACER_MAPPING },
    units: { csvThickness: "mm", metadata: "mm" },
    rows,
    metadata: { ...TRACER_METADATA_PRESET },
    ptmt: { notes: "", indications: [] },
    results: null,
  };
  return {
    ...session,
    ui: {
      ...INITIAL_UI,
      metadataDraft: draftFromMetadata(TRACER_METADATA_PRESET),
      screen: 2,
      rowIssues: validateSession(session),
    },
  };
}

function loadDemo(): WizardState {
  const session = createDemoSession();
  return {
    ...session,
    ui: {
      ...INITIAL_UI,
      metadataDraft: draftFromMetadata(DEMO_METADATA),
      screen: 2,
      rowIssues: validateSession(session),
    },
  };
}

// --- cell edit rebuild (cells stay null-prototyped — T-02-08) ------------------

function withCell(row: ParsedRow, headers: string[], header: string, value: string): ParsedRow {
  return {
    ...row,
    cells: buildCells(headers, headers.map((h) => (h === header ? value : row.cells[h] ?? ""))),
  };
}

function nextIndicationId(indications: PtmIndication[]): string {
  const max = indications.reduce((acc, ind) => {
    const match = /^ind-(\d+)$/.exec(ind.id);
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 0);
  return `ind-${max + 1}`;
}

// --- the reducer ----------------------------------------------------------------

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "load-sample":
      return loadSample();

    case "load-demo":
      return loadDemo();

    case "start-parse":
      return {
        ...state,
        ui: {
          ...state.ui,
          parsing: { filename: action.filename },
          ingestError: null,
        },
      };

    case "parse-file":
      return ingestCsv(state, action.filename, action.content);

    case "parse-invalid":
      // UI-02: inline error only — dropzone state and loaded rows unchanged.
      return {
        ...state,
        ui: {
          ...state.ui,
          parsing: null,
          ingestError: { kind: "invalid-file", filename: action.filename },
        },
      };

    case "parse-too-large": {
      const mb = action.sizeBytes / (1024 * 1024);
      return {
        ...state,
        ui: {
          ...state.ui,
          parsing: null,
          ingestError: {
            kind: "too-large",
            filename: action.filename,
            message: `File is too large (${mb.toFixed(1)} MB). The limit is 5 MB.`,
          },
        },
      };
    }

    case "cancel-parse":
      return { ...state, ui: { ...state.ui, parsing: null } };

    case "dismiss-ingest-error":
      return { ...state, ui: { ...state.ui, ingestError: null, parsing: null } };

    case "stage-replace":
      // UI-03: offered only when rows are loaded (the dropzone guards this).
      return {
        ...state,
        ui: { ...state.ui, replaceConfirm: { pending: action.pending }, parsing: null },
      };

    case "cancel-replace":
      return { ...state, ui: { ...state.ui, replaceConfirm: null } };

    case "confirm-replace": {
      const pending = state.ui.replaceConfirm?.pending;
      if (!pending) return state;
      return ingestCsv({ ...state, ui: { ...state.ui, replaceConfirm: null } }, pending.filename, pending.content);
    }

    case "set-screen":
      // Forward navigation happens only through parse/run-evaluation success;
      // set-screen serves back-links (2->1, 3->2) and the lost-state redirect.
      if (action.screen > state.ui.screen) return state;
      return { ...state, ui: { ...state.ui, screen: action.screen } };

    case "set-mapping": {
      const mapping = { ...state.mapping, [action.field]: action.header };
      const units = { ...state.units };
      if (!state.ui.csvThicknessUnitManual) {
        units.csvThickness = csvThicknessUnitFromHeader(mapping.measuredThickness);
      }
      const session: EvaluationSession = { ...state, mapping, units, results: null };
      return { ...session, ui: { ...state.ui, rowIssues: validateSession(session) } };
    }

    case "set-csv-thickness-unit":
      return {
        ...state,
        units: { ...state.units, csvThickness: action.unit },
        results: null,
        ui: { ...state.ui, csvThicknessUnitManual: true },
      };

    case "set-metadata-unit":
      return {
        ...state,
        units: { ...state.units, metadata: action.unit },
        results: null,
      };

    case "set-row-cell": {
      const rows = state.rows.map((row) =>
        row.row === action.row ? withCell(row, state.csv.headers, action.header, action.value) : row,
      );
      const session: EvaluationSession = { ...state, rows, results: null };
      return { ...session, ui: { ...state.ui, rowIssues: validateSession(session) } };
    }

    case "set-page":
      return { ...state, ui: { ...state.ui, page: Math.max(1, action.page) } };

    case "set-metadata-field":
      return {
        ...state,
        results: null,
        ui: {
          ...state.ui,
          metadataDraft: { ...state.ui.metadataDraft, [action.field]: action.value },
        },
      };

    case "set-ptmt-notes":
      return {
        ...state,
        ptmt: { ...state.ptmt, notes: action.notes },
        results: null,
      };

    case "add-indication": {
      const indication: PtmIndication = {
        id: nextIndicationId(state.ptmt.indications),
        method: "PT",
        morphology: "rounded",
        lengthMm: 0,
        widthMm: 0,
        count: 1,
        edgeSeparationMm: null,
        crackSuspect: false,
        description: "",
      };
      return {
        ...state,
        ptmt: { ...state.ptmt, indications: [...state.ptmt.indications, indication] },
        results: null,
      };
    }

    case "update-indication":
      return {
        ...state,
        ptmt: {
          ...state.ptmt,
          indications: state.ptmt.indications.map((ind) =>
            ind.id === action.id ? { ...ind, ...action.patch } : ind,
          ),
        },
        results: null,
      };

    case "remove-indication":
      return {
        ...state,
        ptmt: {
          ...state.ptmt,
          indications: state.ptmt.indications.filter((ind) => ind.id !== action.id),
        },
        results: null,
      };

    case "evaluation-start":
      return {
        ...state,
        ui: { ...state.ui, evaluating: true, evaluationError: null },
      };

    case "run-evaluation": {
      // UI-23 / ING-05: the gate chain runs BEFORE the engine can be reached.
      const blockers = blockingChecks(state);
      if (hasBlockers(blockers)) return state;

      const evaluateFn = action.evaluateFn ?? evaluate;
      try {
        // ING-05 engine-side gate — undeclared units can never reach evaluate.
        assertUnitsDeclared(state.units);

        const metadata = metadataFromDraft(state.ui.metadataDraft);
        if (!metadata) return state;

        const errorRows = new Set(
          state.ui.rowIssues.filter((i) => i.severity === "error").map((i) => i.row),
        );
        const validRows = state.rows.filter((row) => !errorRows.has(row.row));
        const inputs = groupByCml(validRows, state.mapping, {
          csvThicknessUnit: state.units.csvThickness,
        });
        const options: EvaluateOptions = {
          // Incomplete indication rows (dimension still 0) are not indications
          // yet — only fully entered ones triage.
          ptmtIndications: state.ptmt.indications.filter(
            (ind) => ind.lengthMm > 0 && ind.widthMm > 0,
          ),
        };
        const results: EvaluationResults = evaluateFn(inputs, metadata, state.units, options);
        return {
          ...state,
          metadata,
          results,
          ui: {
            ...state.ui,
            evaluating: false,
            evaluationError: null,
            // Data-source footnote timestamp — captured by the UI layer at
            // run time, never Date.now inside lib/calc (purity).
            evaluatedAt: new Date().toISOString(),
            screen: 3,
            page: 1,
          },
        };
      } catch (error) {
        return {
          ...state,
          ui: {
            ...state.ui,
            evaluating: false,
            evaluationError:
              error instanceof Error ? error.message : "Unexpected evaluation failure.",
          },
        };
      }
    }

    case "reset":
      return createInitialState();

    default:
      return state;
  }
}
