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
 */
export interface EvaluationInput {
  readingId: string;
  location: string;
  date: string; // ISO
  tActualMm: number;
  tInitialMm: number | null;
  tPreviousMm: number | null;
  dtLtYears: number | null;
  dtStYears: number | null;
}
