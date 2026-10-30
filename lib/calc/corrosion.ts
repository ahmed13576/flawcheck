/**
 * Corrosion-rate validation for FlawCheck's deterministic UT engine.
 *
 * API 570-style raw rates are still surfaced for audit traceability, but the
 * governing rate used for remaining life is a validated, quarantined value:
 * positive growth, insufficient short-term intervals, and gauge-deadband-sized
 * deltas are excluded before selecting a governing rate. If short-term is
 * quarantined, the engine falls back to a valid positive long-term rate. If no
 * positive validated rate exists, the governing rate is exactly 0.000 mm/yr
 * and remaining life renders as not applicable rather than NaN/Infinity.
 */
import { roundTo } from "./round";
import { corrosionGaugeDeadbandMm, minimumShortTermIntervalYears } from "./criteria";

export const MIN_SHORT_TERM_INTERVAL_YEARS = minimumShortTermIntervalYears();
export const GAUGE_DEADBAND_MM = corrosionGaugeDeadbandMm();

export interface RateOutcome {
  rawLt: number | null;
  rawSt: number | null;
  /** max(raw LT, raw ST), retained for audit/sorting even when quarantined. */
  governingRaw: number | null;
  /** Validated RL divisor: positive validated rate or exactly 0. */
  governingEffective: number;
  insufficientHistory: boolean;
  /** Apparent positive thickness growth in either raw rate. */
  measurementInconsistency: boolean;
  /** A rate exists but is excluded because the scan interval is too short. */
  insufficientInterval: boolean;
  /** A rate exists but is excluded because the loss is inside gauge deadband. */
  gaugeDeadband: boolean;
  /** True when the short-term rate was excluded and LT fallback was considered. */
  usedLongTermFallback: boolean;
  /** Validated display/audit rates after quarantine. */
  validatedLt: number | null;
  validatedSt: number | null;
}

/** CR_LT = (t_initial - t_actual) / delta_t_years, 6 dp canonical. */
export function crLongTerm(
  tInitialMm: number,
  tActualMm: number,
  dtYears: number,
): number {
  return roundTo((tInitialMm - tActualMm) / dtYears, 6);
}

/** CR_ST = (t_previous - t_actual) / delta_t_years, 6 dp canonical. */
export function crShortTerm(
  tPreviousMm: number,
  tActualMm: number,
  dtYears: number,
): number {
  return roundTo((tPreviousMm - tActualMm) / dtYears, 6);
}

function validateRate(args: {
  rate: number | null;
  dtYears: number | null;
  lossMm: number | null;
  requireMinInterval: boolean;
}): { validated: number | null; inconsistency: boolean; insufficientInterval: boolean; deadband: boolean } {
  const { rate, dtYears, lossMm, requireMinInterval } = args;
  if (rate === null || lossMm === null || dtYears === null || dtYears <= 0) {
    return { validated: null, inconsistency: false, insufficientInterval: false, deadband: false };
  }
  if (lossMm < 0 || rate < 0) {
    return { validated: null, inconsistency: true, insufficientInterval: false, deadband: false };
  }
  if (lossMm <= GAUGE_DEADBAND_MM) {
    return { validated: null, inconsistency: false, insufficientInterval: false, deadband: true };
  }
  if (requireMinInterval && dtYears < MIN_SHORT_TERM_INTERVAL_YEARS) {
    return { validated: null, inconsistency: false, insufficientInterval: true, deadband: false };
  }
  return { validated: rate > 0 ? rate : null, inconsistency: false, insufficientInterval: false, deadband: false };
}

export function rateOutcome(
  tInitialMm: number | null,
  tPreviousMm: number | null,
  tActualMm: number,
  dtLtYears: number | null,
  dtStYears: number | null,
): RateOutcome {
  const rawLt =
    tInitialMm !== null && dtLtYears !== null && dtLtYears > 0
      ? crLongTerm(tInitialMm, tActualMm, dtLtYears)
      : null;
  const rawSt =
    tPreviousMm !== null && dtStYears !== null && dtStYears > 0
      ? crShortTerm(tPreviousMm, tActualMm, dtStYears)
      : null;
  const governingRaw =
    rawLt === null && rawSt === null
      ? null
      : Math.max(rawLt ?? -Infinity, rawSt ?? -Infinity);

  const ltLoss = tInitialMm === null ? null : tInitialMm - tActualMm;
  const stLoss = tPreviousMm === null ? null : tPreviousMm - tActualMm;
  const lt = validateRate({ rate: rawLt, dtYears: dtLtYears, lossMm: ltLoss, requireMinInterval: false });
  const st = validateRate({ rate: rawSt, dtYears: dtStYears, lossMm: stLoss, requireMinInterval: true });

  const usedLongTermFallback = st.validated === null && lt.validated !== null;
  const governingEffective = Math.max(st.validated ?? 0, lt.validated ?? 0);

  return {
    rawLt,
    rawSt,
    governingRaw,
    governingEffective: roundTo(governingEffective, 6),
    insufficientHistory: governingEffective === 0,
    measurementInconsistency: lt.inconsistency || st.inconsistency,
    insufficientInterval: lt.insufficientInterval || st.insufficientInterval,
    gaugeDeadband: lt.deadband || st.deadband,
    usedLongTermFallback,
    validatedLt: lt.validated,
    validatedSt: st.validated,
  };
}
