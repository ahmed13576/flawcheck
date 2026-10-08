/**
 * Remaining life per API 570 para. 7.2:
 *   RL_years = (t_actual - t_required) / CR_governing
 *
 * Precondition (ut-criteria.json remaining_life_formula): division by zero CR
 * must surface "insufficient corrosion history" instead of Infinity. This
 * module returns null on that path — the strings Infinity and NaN never
 * appear in any result field.
 */
import { roundTo } from "./round";

/**
 * RL at 4 dp (canonical R4), or null when the governing effective rate is
 * null or zero after the negative-CR floor (G9a/G10 contract).
 */
export function remainingLife(
  tActualMm: number,
  tRequiredMm: number,
  governingEffectiveMmYr: number | null,
): number | null {
  if (governingEffectiveMmYr === null || governingEffectiveMmYr <= 0) {
    return null;
  }
  // API 570 para. 7.1.1 & 7.2: if t_actual <= t_required, the component has reached
  // or breached retirement thickness — remaining life is clamped to 0.0 yr (never negative).
  if (tActualMm <= tRequiredMm) {
    return 0;
  }
  return roundTo((tActualMm - tRequiredMm) / governingEffectiveMmYr, 4);
}
