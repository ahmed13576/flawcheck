/**
 * lib/calc public barrel — the ONLY import surface the app layer uses.
 *
 * Purity invariant (lib/calc/README.md): files under lib/calc/ must never
 * import from the LLM layer, react, react-dom, next, or node builtins — the
 * calc engine is deterministic ground truth. Plan 02-02 gates this with an
 * eslint no-restricted-imports block plus a vitest boundary guard.
 */
export { roundTo } from "./round";
export { toMm } from "./units";
export type { Unit } from "./units";
export {
  addYearsUtc,
  daysBetweenUtc,
  daysToYears,
  parseIsoUtc,
} from "./dates";
export {
  criteria,
  citationIdExists,
  defaultGaugeUncertaintyMm,
  maxIntervalByClass,
} from "./criteria";
export type { CitationId } from "./criteria";
export {
  requiredThickness,
  tPressureB313,
  tPressureBarlow,
} from "./formulas";
export type { FormulaInputs, FormulaSelection, RequiredThicknessResult } from "./formulas";
export { crLongTerm, crShortTerm, rateOutcome } from "./corrosion";
export type { RateOutcome } from "./corrosion";
export { remainingLife } from "./remaining-life";
export { verdictBand } from "./verdicts";
export type { Verdict } from "./verdicts";
export { nextInterval } from "./interval";
export type { IntervalResult, IntervalState } from "./interval";
export { flagOutliers, modifiedZScores, median, OUTLIER_Z_THRESHOLD } from "./outliers";
export type { OutlierFlag, OutlierHistoryReading, ModifiedZResult } from "./outliers";
export { evaluateIndication } from "./ptmt";
export type { IndicationResult } from "./ptmt";
export { evaluate } from "./evaluate";
export type { EvaluateOptions } from "./evaluate";
