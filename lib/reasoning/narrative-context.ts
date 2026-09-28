/**
 * Narrative context — 03-02 Task 1 (Pattern R2, single-source guarantee).
 *
 * buildNarrativeContext returns { payload, allowedNumbers, allowedCitationIds }
 * TOGETHER so the prompt and the numeric/citation lints can never drift: the
 * prompt's only numeric surface is the payload, and the lint's allowlist is
 * built from the exact same injected values (A6 policy: raw 6-dp value plus
 * 1/2/3-dp display variants of every injected number).
 *
 * Numeric-surface discipline (Pitfall 1 / Pitfall 4):
 * - NO identifiers are injected (reading ids, CML tags, indication ids, dates,
 *   clause numbers, design_code strings) — every one of them carries digits
 *   ("CML-1", "A01", "344.3.2", "2024 Edition") that would trip the numeric
 *   lint the moment the model quotes them. The pane header renders identity;
 *   the prose narrates the chain; citation chips render code + clause.
 * - PT/MT thresholds ARE injected deliberately — they are repo-vetted
 *   criteria.ptmt values, so legitimate limit-mentioning passes the lint.
 * - History values (t-initial / t-previous / Δt years) are injected when
 *   present and omitted when null (open-question resolution 4).
 */
import { criteria } from "@/lib/calc/criteria";
import { formatFixed } from "@/lib/wizard/format";
import { VERDICT_LABELS } from "@/lib/reasoning/fallback";
import type {
  ComponentMetadata,
  PtmIndicationResult,
  ReadingResult,
} from "@/lib/ingest/session";
import type { ExtractionResult } from "@/lib/reasoning/schemas";

/** Campaign history slice (mirrors lib/reasoning/schemas.ts HistorySchema). */
export interface NarrativeHistory {
  tInitialMm: number | null;
  tPreviousMm: number | null;
  dtLtYears: number | null;
  dtStYears: number | null;
}

export interface NarrativeContextInput {
  kind: "cml" | "ptmt";
  /** Required for kind "cml". */
  reading?: ReadingResult;
  /** CML metadata numerics (gauge uncertainty, design pressure, stress). */
  metadata?: ComponentMetadata;
  /** Required for kind "ptmt". */
  indication?: PtmIndicationResult;
  /** The Lightning evaluation context pack — worded fields only. */
  extraction: ExtractionResult | null;
  /** CML history values (open-question resolution 4); omitted when null. */
  history?: NarrativeHistory | null;
  /** criteria.ptmt — repo-vetted thresholds injected verbatim. */
  thresholds: typeof criteria.ptmt;
}

export interface NarrativeContext {
  /** JSON block (null, 1 indent) — the prompt's ONLY numeric surface. */
  payload: string;
  /** Raw 6-dp values ∪ 1/2/3-dp variants of every injected number (A6). */
  allowedNumbers: Set<number>;
  /** The reading's citations (or the indication's citationId) — prompt + lint. */
  allowedCitationIds: string[];
}

/**
 * A6 allowlist policy: for each injected value, admit the raw value rounded to
 * 6 dp plus its 1-dp, 2-dp, and 3-dp roundings. Exported for tests and reused
 * internally — one policy, one implementation.
 */
export function numericAllowlist(values: Iterable<number>): Set<number> {
  const allowed = new Set<number>();
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    allowed.add(Number(v.toFixed(6)));
    allowed.add(Number(v.toFixed(1)));
    allowed.add(Number(v.toFixed(2)));
    allowed.add(Number(v.toFixed(3)));
  }
  return allowed;
}

/**
 * Build the narrative context for one pane. Throws on kind/shape mismatch —
 * a programmer error, never a runtime condition (the request schema already
 * validates the kind/discriminator).
 */
export function buildNarrativeContext(input: NarrativeContextInput): NarrativeContext {
  const raws: number[] = [];

  /** Format a number at table precision AND register its raw value. */
  const fmt = (v: number | null | undefined, dp: 1 | 2 | 3): string | null => {
    if (v === null || v === undefined || !Number.isFinite(v)) return null;
    raws.push(v);
    return formatFixed(v, dp);
  };
  /** Inject a repo-vetted number verbatim (thresholds, counts) AND register it. */
  const verbatim = (v: number): number => {
    raws.push(v);
    return v;
  };

  const values: Record<string, unknown> = {};

  if (input.kind === "cml") {
    const reading = input.reading;
    if (!reading) throw new Error("buildNarrativeContext: kind cml requires a reading");
    values.reading = {
      t_actual_mm: fmt(reading.tActualMm, 2),
      t_pressure_mm: fmt(reading.tPressureMm, 2),
      t_structural_mm: fmt(reading.tStructuralMm, 2),
      t_required_mm: fmt(reading.tRequiredMm, 2),
      cr_lt_mm_yr: fmt(reading.crLtMmYr, 3),
      cr_st_mm_yr: fmt(reading.crStMmYr, 3),
      cr_governing_mm_yr: fmt(reading.crGoverningMmYr, 3),
      rl_years: fmt(reading.rlYears, 1),
      next_inspection_interval_years: reading.nextInspection
        ? fmt(reading.nextInspection.intervalYears, 1)
        : null,
      flags: reading.flags,
      verdict: VERDICT_LABELS[reading.verdict],
    };
    if (input.history) {
      const h: Record<string, unknown> = {};
      if (input.history.tInitialMm !== null) h.t_initial_mm = fmt(input.history.tInitialMm, 2);
      if (input.history.tPreviousMm !== null) h.t_previous_mm = fmt(input.history.tPreviousMm, 2);
      if (input.history.dtLtYears !== null) h.dt_lt_years = fmt(input.history.dtLtYears, 1);
      if (input.history.dtStYears !== null) h.dt_st_years = fmt(input.history.dtStYears, 1);
      if (Object.keys(h).length > 0) values.history = h;
    }
    if (input.metadata) {
      values.metadata = {
        gauge_uncertainty_mm: fmt(input.metadata.gaugeUncertainty, 2),
        design_pressure: fmt(input.metadata.designPressure, 2),
        pressure_unit: input.metadata.pressureUnit,
        allowable_stress: fmt(input.metadata.allowableStress, 2),
      };
    }
  } else {
    const ind = input.indication;
    if (!ind) throw new Error("buildNarrativeContext: kind ptmt requires an indication");
    values.indication = {
      method: ind.method,
      morphology: ind.morphology,
      length_mm: fmt(ind.lengthMm, 1),
      width_mm: fmt(ind.widthMm, 1),
      count: verbatim(ind.count),
      edge_separation_mm: fmt(ind.edgeSeparationMm, 1),
      crack_suspect: ind.crackSuspect,
      verdict: VERDICT_LABELS[ind.verdict],
      detail: ind.detail,
    };
  }

  // PT/MT thresholds — deliberate injection of repo-vetted values (both kinds;
  // the plan injects thresholds unconditionally so limit-mentioning passes).
  values.thresholds = {
    relevance_threshold_mm: verbatim(input.thresholds.relevance_threshold_mm),
    max_rounded_dimension_mm: verbatim(input.thresholds.limits.max_rounded_dimension_mm),
    count_threshold: verbatim(input.thresholds.limits.aligned_rounded_cluster.count_threshold),
    max_separation_edge_to_edge_mm: verbatim(
      input.thresholds.limits.aligned_rounded_cluster.max_separation_edge_to_edge_mm,
    ),
  };

  // EVALUATION CONTEXT — the extraction pack's worded fields (no new numbers;
  // notableFacts/points are digit-free by prompt contract, schema-capped).
  if (input.extraction) {
    values.evaluation_context = {
      service_description: input.extraction.componentContext.serviceDescription,
      notable_facts: input.extraction.notableFacts,
      ptmt_notes_summary: input.extraction.ptmtNotesSummary,
      cautions: input.extraction.cautions,
    };
  }

  const allowedCitationIds =
    input.kind === "cml"
      ? [...(input.reading?.citations ?? [])]
      : [input.indication?.citationId ?? ""];

  return {
    payload: JSON.stringify(values, null, 1),
    allowedNumbers: numericAllowlist(raws),
    allowedCitationIds,
  };
}
