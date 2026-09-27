/**
 * evaluate — the calc-engine orchestration (research R7 / OQ5 per-reading
 * granularity). Consumes EvaluationInput[] (the group->evaluate seam type
 * emitted by lib/ingest/group.ts, Plan 02-03) plus ComponentMetadata, emits
 * EvaluationResults exactly per the R7 shape.
 *
 * Orchestration per reading: canonicalize metadata thickness at entry
 * (units.toMm — ING-05), governing t_required (max of both branches),
 * rateOutcome (raw rates surfaced + negative-CR floor), remaining life (null
 * never Infinity), interval via nextInterval when RL exists, outlier flags
 * per CML population (n >= 4), verdict band, per-reading citations — then the
 * summary + citationsUsed rollup.
 *
 * Purity: next inspection anchors to the reading's measurement date via
 * addYearsUtc — never Date.now (Pitfall 11). G14 builder decision: a
 * nextInterval state "immediate-inspection" result (RL <= 0 with a valid
 * positive CR) sets the "immediate_inspection" flag with nextInspection null
 * — never a negative interval or a past date.
 */
import type {
  ComponentMetadata,
  EvaluationInput,
  EvaluationResults,
  PtmIndication,
  PtmIndicationResult,
  ReadingFlag,
  ReadingResult,
  Unit,
} from "../ingest/session";
import { EvaluationInputError } from "../ingest/session";
import { addYearsUtc } from "./dates";
import { rateOutcome } from "./corrosion";
import { flagOutliers, type OutlierHistoryReading } from "./outliers";
import { remainingLife } from "./remaining-life";
import { requiredThickness } from "./formulas";
import { nextInterval } from "./interval";
import { evaluateIndication } from "./ptmt";
import { toMm } from "./units";
import { verdictBand } from "./verdicts";

export interface EvaluateOptions {
  /** Structured PT/MT indications to triage alongside the thickness readings. */
  ptmtIndications?: PtmIndication[];
}

/**
 * WR-01 fail-closed guard. Verdict banding is a chain of `<` comparisons: with
 * a NaN t_actual BOTH branches are false and the reading silently lands in
 * `accept` with rlYears NaN — a fabricated clean bill on the Phase 3/4 public
 * API. The engine therefore refuses any non-finite input (or any non-finite
 * metadata numeric / computed t_required) with a typed, loud error naming the
 * reading and field. The wizard path never hits this (error rows are filtered
 * before grouping); this is the engine's own defense at the seam.
 */
function assertFinite(value: number | null, field: string, readingId: string): void {
  if (value !== null && !Number.isFinite(value)) {
    throw new EvaluationInputError(
      `Evaluation refused (fail-closed): reading '${readingId}' has non-finite ${field}. ` +
        "Non-finite input can never produce a verdict — fix the source data instead.",
    );
  }
}

function assertFiniteMetadata(metadata: ComponentMetadata): void {
  const fields: Array<[keyof ComponentMetadata, string]> = [
    ["od", "od"],
    ["tNominal", "tNominal"],
    ["fca", "fca"],
    ["tStructural", "tStructural"],
    ["gaugeUncertainty", "gaugeUncertainty"],
    ["designPressure", "designPressure"],
    ["allowableStress", "allowableStress"],
    ["e", "e"],
    ["w", "w"],
    ["y", "y"],
  ];
  for (const [key, label] of fields) {
    const value = metadata[key];
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new EvaluationInputError(
        `Evaluation refused (fail-closed): metadata ${label} is non-finite. ` +
          "Non-finite input can never produce a verdict — fix the metadata form instead.",
      );
    }
  }
}

export function evaluate(
  inputs: EvaluationInput[],
  metadata: ComponentMetadata,
  units: { csvThickness: Unit; metadata: Unit },
  options: EvaluateOptions = {},
): EvaluationResults {
  // ING-05 canonicalization: metadata thickness fields are declared in the
  // metadata unit and converted to canonical mm at eval entry. P and S share
  // the metadata pressureUnit (dimensionally consistent — no conversion).
  assertFiniteMetadata(metadata);

  const formulaInputs = {
    designPressure: metadata.designPressure,
    odMm: toMm(metadata.od, units.metadata),
    allowableStress: metadata.allowableStress,
    e: metadata.e,
    w: metadata.w,
    y: metadata.y,
    fcaMm: toMm(metadata.fca, units.metadata),
    tStructuralMm: toMm(metadata.tStructural, units.metadata),
    formula: metadata.formula,
  };
  const thickness = requiredThickness(formulaInputs);
  const gaugeUncertaintyMm = toMm(metadata.gaugeUncertainty, units.metadata);
  // WR-01: even finite inputs can overflow the formula shape (e.g. near-zero
  // divisor) — a non-finite t_required would silently accept everything.
  assertFinite(thickness.tRequiredMm, "computed tRequiredMm", "(metadata)");
  assertFinite(gaugeUncertaintyMm, "computed gaugeUncertaintyMm", "(metadata)");

  // Outliers per CML population: group by the CML identity (tank + grid when
  // the seam provides it, location otherwise), n >= 4.
  const byCml = new Map<string, EvaluationInput[]>();
  for (const input of inputs) {
    const key = input.cml ?? input.location;
    const list = byCml.get(key) ?? [];
    list.push(input);
    byCml.set(key, list);
  }
  const outlierByReadingId = new Map<string, ReturnType<typeof flagOutliers>[number]>();
  for (const population of byCml.values()) {
    const history: OutlierHistoryReading[] = population.map((r) => ({
      id: r.readingId,
      value: r.tActualMm,
    }));
    for (const flag of flagOutliers(history)) {
      outlierByReadingId.set(flag.id, flag);
    }
  }

  const readings: ReadingResult[] = inputs.map((input) => {
    // WR-01 fail-closed gate — before any verdict, rate, or RL is attempted.
    assertFinite(input.tActualMm, "tActualMm", input.readingId);
    assertFinite(input.tInitialMm, "tInitialMm", input.readingId);
    assertFinite(input.tPreviousMm, "tPreviousMm", input.readingId);
    assertFinite(input.dtLtYears, "dtLtYears", input.readingId);
    assertFinite(input.dtStYears, "dtStYears", input.readingId);
    const outcome = rateOutcome(
      input.tInitialMm,
      input.tPreviousMm,
      input.tActualMm,
      input.dtLtYears,
      input.dtStYears,
    );
    const rl = remainingLife(input.tActualMm, thickness.tRequiredMm, outcome.governingEffective);
    const verdict = verdictBand(
      input.tActualMm,
      thickness.tRequiredMm,
      gaugeUncertaintyMm,
    );

    const flags: ReadingFlag[] = [];
    if (outcome.insufficientHistory) flags.push("insufficient_history");
    if (outcome.measurementInconsistency) flags.push("measurement_inconsistency");
    const outlier = outlierByReadingId.get(input.readingId);
    if (outlier) flags.push("outlier");

    // Interval: computed only when RL exists. G14: an RL <= 0 result in the
    // valid-positive-CR context is immediate inspection — never a negative
    // interval or a past date.
    let nextInspection: ReadingResult["nextInspection"] = null;
    if (rl !== null) {
      const interval = nextInterval(rl, metadata.pipeClass);
      if (interval.state === "immediate-inspection") {
        flags.push("immediate_inspection");
      } else {
        nextInspection = {
          date: addYearsUtc(input.date, interval.intervalYears),
          intervalYears: interval.intervalYears,
        };
      }
    }

    const citations = new Set<string>(thickness.citations);
    if (outcome.rawLt !== null) citations.add("api570_7_1_2_lt");
    if (outcome.rawSt !== null) citations.add("api570_7_1_2_st");
    if (outcome.governingRaw !== null) citations.add("api570_7_1_2_governing");
    if (rl !== null) citations.add("api570_7_2");
    if (nextInspection !== null) {
      citations.add("api570_6_3_3_halflife");
      citations.add("api570_table1");
    }

    return {
      readingId: input.readingId,
      location: input.location,
      ...(input.cml !== undefined ? { cml: input.cml } : {}),
      date: input.date,
      tActualMm: input.tActualMm,
      tPressureMm: thickness.tPressureMm,
      tStructuralMm: thickness.tStructuralMm,
      tRequiredMm: thickness.tRequiredMm,
      crLtMmYr: outcome.rawLt,
      crStMmYr: outcome.rawSt,
      rawCrLtMmYr: outcome.rawLt,
      rawCrStMmYr: outcome.rawSt,
      crGoverningMmYr: outcome.governingEffective,
      rlYears: rl,
      nextInspection,
      flags,
      ...(outlier ? { outlier: { z: outlier.z, median: outlier.median, mad: outlier.mad } } : {}),
      verdict,
      citations: [...citations],
    };
  });

  const indications: PtmIndicationResult[] = (options.ptmtIndications ?? []).map(
    (indication) => {
      const result = evaluateIndication(indication);
      return { ...indication, ...result };
    },
  );

  return {
    readings,
    summary: {
      total: readings.length,
      // Distinct mapped-Tank locations (UI-SPEC: "4,912 readings · 12 locations");
      // CML identities are finer-grained (tank + grid) and are not summed here.
      locations: new Set(inputs.map((i) => i.location)).size,
      accept: readings.filter((r) => r.verdict === "accept").length,
      reCheck: readings.filter((r) => r.verdict === "re_check").length,
      fail: readings.filter((r) => r.verdict === "reject").length,
    },
    indications,
    citationsUsed: [
      ...new Set([
        ...readings.flatMap((r) => r.citations),
        ...indications.map((i) => i.citationId),
      ]),
    ],
  };
}
