/**
 * Session data model — the Phase 3/4 contract (research R7).
 *
 * One JSON-serializable type set: ISO strings instead of Date objects, no
 * Map/Set, no class instances — Phase 3 can POST it to an LLM route and cache
 * on it. Types only here; zod schemas land with the parse boundaries that
 * need them (rows in Plan 02-03, metadata form in Plan 02-04).
 */

export type Unit = "mm" | "in" | "mils";

/** Engine band names; the UI renders ACCEPT / RE-CHECK / FAIL (rendering concern). */
export type Verdict = "accept" | "re_check" | "reject";

export type TargetField =
  | "readingId"
  | "measuredThickness"
  | "measurementDate"
  | "tInitial"
  | "tPrevious"
  | "tank";

export interface ParsedRow {
  /** 1-based data-row index in original file order (row 1 = first data row). */
  row: number;
  cells: Record<string, string>;
  issues: RowIssue[];
}

export interface RowIssue {
  row: number;
  field: string;
  severity: "error" | "warning";
  message: string;
}

export interface ComponentMetadata {
  /** All thickness in the declared metadata unit; converted to mm at eval. */
  od: number;
  tNominal: number;
  fca: number;
  tStructural: number;
  designCode: "ASME B31.3 — 2024 Edition";
  pipeClass: 1 | 2 | 3;
  /** ± gauge uncertainty, mm after conversion. */
  gaugeUncertainty: number;
  /** OQ1 resolution: MPa | psi segmented selector — P and S share it. */
  pressureUnit: "MPa" | "psi";
  designPressure: number;
  allowableStress: number;
  e: number;
  w: number;
  y: number;
  formula: "asme_b31_3_straight_pipe" | "barlow_in_service";
}

export interface PtmIndication {
  id: string;
  method: "PT" | "MT";
  morphology: "linear" | "rounded";
  lengthMm: number;
  widthMm: number;
  count: number;
  edgeSeparationMm: number | null;
  crackSuspect: boolean;
  description?: string;
}

export interface EvaluationSession {
  source: { filename: string; isDemo: boolean; ingestedAt: string /* ISO */ };
  csv: { headers: string[]; delimiter: "," | ";" | "\t"; rowCount: number };
  mapping: Record<TargetField, string | null>;
  units: { csvThickness: Unit; metadata: Unit };
  rows: ParsedRow[];
  metadata: ComponentMetadata;
  ptmt: { notes: string; indications: PtmIndication[] };
  results: EvaluationResults | null; // populated by Run Evaluation
}

export interface EvaluationResults {
  readings: ReadingResult[]; // 4,912 entries for the demo
  summary: {
    total: number;
    locations: number;
    accept: number;
    reCheck: number;
    fail: number;
  };
  indications: PtmIndicationResult[];
  citationsUsed: string[]; // subset of citations.json ids
}

/**
 * Reading-level data-quality flags.
 *
 * G14 builder decision: "immediate_inspection" (RL <= 0 with a valid positive
 * CR) is a distinct flag from "insufficient_history" (RL null). The
 * immediate-inspection state keeps nextInspection null — the UI renders the
 * immediate-action text from the flag, never a date.
 */
export type ReadingFlag =
  | "outlier"
  | "measurement_inconsistency"
  | "insufficient_history"
  | "immediate_inspection";

export interface ReadingResult {
  readingId: string;
  location: string;
  /**
   * 02-03 additive: the tank + grid CML identity when a grid column exists —
   * the Screen 3 "CML / Location" cell renders it with `title` (UI-14),
   * falling back to location. Optional keeps the R7 shape verbatim otherwise.
   */
  cml?: string;
  date: string; // ISO
  tActualMm: number;
  tPressureMm: number;
  tStructuralMm: number;
  tRequiredMm: number;
  /** null = insufficient history (never Infinity/NaN). */
  crLtMmYr: number | null;
  crStMmYr: number | null;
  /** Possibly negative raw rates, surfaced verbatim per negative_cr_policy. */
  rawCrLtMmYr: number | null;
  rawCrStMmYr: number | null;
  /** Post-floor effective governing rate. */
  crGoverningMmYr: number | null;
  /** NEVER Infinity/NaN — null instead. */
  rlYears: number | null;
  nextInspection: { date: string; intervalYears: number } | null;
  flags: ReadingFlag[];
  outlier?: { z: number; median: number; mad: number };
  verdict: Verdict;
  citations: string[];
}

export interface PtmIndicationResult extends PtmIndication {
  verdict: Verdict;
  detail: string;
  citationId: string;
}

/**
 * Amendment 1 (seam contract, consumed by Plans 02-02/02-03): the
 * group->evaluate type. lib/ingest/group.ts emits it (deriving t-initial /
 * t-previous and Δt years from campaign history) and lib/calc/evaluate.ts
 * consumes it.
 *
 * 02-03 extension (what the grouping genuinely needs, per the R6 demo
 * geometry): `cml` is the tank + grid-position identity — the fixed
 * measurement point (campaign-history group and per-CML outlier population).
 * `location` is the mapped Tank, matching the UI-SPEC summary line
 * "4,912 readings · 12 locations". Optional so constructed inputs without a
 * grid column degrade to location identity.
 */
export interface EvaluationInput {
  readingId: string;
  location: string;
  cml?: string;
  date: string; // ISO
  tActualMm: number;
  tInitialMm: number | null;
  tPreviousMm: number | null;
  dtLtYears: number | null;
  dtStYears: number | null;
}

/**
 * Named refusal for engine-side precondition failures (ING-05): undeclared
 * units must never reach the calc engine. Callers surface `message` verbatim
 * in the error panel — never freeze, never silently default a unit.
 */
export class EvaluationInputError extends Error {}

/** Verbatim UI-SPEC mixed/undeclared-units error copy (line 160). */
export const UNITS_DECLARED_COPY =
  "Units are not declared for every input. Choose one unit — mm, in, or mils — " +
  "for the CSV thickness column and for the metadata form.";

/**
 * ING-05 engine-side gate (Plan 02-03 Task 3): both unit inputs must be
 * declared before evaluation. Declared-but-different units are legal (UI-12) —
 * conversion to canonical mm happens downstream in lib/calc/units. The reducer
 * path (Plan 02-04) calls this before evaluate(); here the function contract
 * is pinned. Pure — throws instead of mutating, message is plain text.
 */
export function assertUnitsDeclared(units: {
  csvThickness: Unit | null;
  metadata: Unit | null;
}): void {
  const missing: string[] = [];
  if (units.csvThickness == null) missing.push("CSV thickness column");
  if (units.metadata == null) missing.push("metadata form");
  if (missing.length > 0) {
    throw new EvaluationInputError(
      `${UNITS_DECLARED_COPY} Undeclared: ${missing.join(" and ")}.`,
    );
  }
}
