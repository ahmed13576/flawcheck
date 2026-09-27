/**
 * Verdict bands — ut-criteria.json verdict_bands.boundary_convention,
 * implementation_note VERBATIM: "Implement as: if (t_actual < t_required)
 * reject; else if (t_actual < t_required + gauge_uncertainty) re_check; else
 * accept — evaluated in exactly this order".
 *
 * Boundary conventions (locked):
 * - t_actual == t_required            -> re_check (reject is strictly less-than)
 * - t_actual == t_required + unc      -> accept  (accept floor == re_check ceiling)
 *
 * The gauge uncertainty defaults from criteria (ut-criteria.json
 * verdict_bands.default_gauge_uncertainty_mm) — the value never appears as a
 * literal here. Both sides are canonicalized to 6 dp before comparing (R4) so
 * float drift cannot flip the locked equalities.
 */
import { defaultGaugeUncertaintyMm } from "./criteria";
import { roundTo } from "./round";

export type Verdict = "accept" | "re_check" | "reject";

export function verdictBand(
  tActualMm: number,
  tRequiredMm: number,
  gaugeUncertaintyMm?: number,
): Verdict {
  const unc = gaugeUncertaintyMm ?? defaultGaugeUncertaintyMm();
  const tReq = roundTo(tRequiredMm, 6);
  const tAct = roundTo(tActualMm, 6);
  if (tAct < tReq) return "reject"; // FAIL in the UI (rendering concern)
  if (tAct < roundTo(tReq + unc, 6)) return "re_check";
  return "accept";
}
