/**
 * Corrosion rates per API 570 para. 7.1.2:
 *   CR_LT = (t_initial - t_actual) / delta_t_years
 *   CR_ST = (t_previous - t_actual) / delta_t_years
 * Governing rate: max(LT, ST) governs remaining life; both surfaced.
 *
 * negative_cr_policy (ut-criteria.json, verbatim): "If CR_LT or CR_ST computes
 * negative (apparent thickness gain), clamp CR_governing to 0 for the RL
 * calculation and surface a 'measurement inconsistency' warning flag on the
 * affected CML". Implementation reading (open question OQ2 resolution): the
 * flag fires when EITHER raw rate is negative; the RL divisor is
 * max(0, max(LT, ST)) — a positive max() is never discarded; a floored-to-zero
 * governing rate means insufficient corrosion history (RL null, never Infinity).
 */
import { roundTo } from "./round";

export interface RateOutcome {
  rawLt: number | null;
  rawSt: number | null;
  /** max(LT, ST) — may be negative; surfaced verbatim per negative_cr_policy. */
  governingRaw: number | null;
  /** Floored at 0 — the RL divisor. */
  governingEffective: number | null;
  insufficientHistory: boolean;
  /** Either raw rate negative (apparent thickness gain). */
  measurementInconsistency: boolean;
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
  const governingEffective =
    governingRaw === null ? null : Math.max(0, governingRaw);
  return {
    rawLt,
    rawSt,
    governingRaw,
    governingEffective,
    insufficientHistory: governingEffective === null || governingEffective === 0,
    measurementInconsistency:
      (rawLt !== null && rawLt < 0) || (rawSt !== null && rawSt < 0),
  };
}
