/**
 * Canonical rounding helper — the single float-safety primitive for lib/calc.
 *
 * Policy (research R4): round at public-function exits. t_required & CR round
 * to 6 dp, RL to 4 dp, interval to 2 dp, modified z to 4 dp. Verdict
 * comparisons then run on canonicalized values, and golden tests construct
 * boundary inputs by arithmetic (never hand-typed decimal literals).
 */
export function roundTo(value: number, dp: number): number {
  const factor = Math.pow(10, dp);
  return Math.round(value * factor) / factor;
}
