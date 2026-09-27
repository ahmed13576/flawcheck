/**
 * Minimum required thickness formulas — formula SHAPES live here; every
 * threshold/constant of policy comes from lib/criteria/*.json via criteria.ts.
 *
 * - asme_b31_3_straight_pipe: ASME B31.3 para. 304.1.2 eq. (3a) —
 *   t = (P * OD) / (2 * (S * E * W + P * Y)) + FCA
 * - barlow_in_service: API 574 para. 10.5.1.2 —
 *   t_pressure = (P * OD) / (2 * S * E); t_required = t_pressure + FCA
 * - Governing rule (ut-criteria.json governing_t_required / API 574
 *   para. 10.5.1.4): t_required = max(t_pressure, t_structural). A Phase 2
 *   implementation MUST apply this max() — computing only the pressure
 *   formula silently overstates remaining life.
 *
 * P and S must share one consistent unit system (MPa or psi) per
 * ut-criteria.json unit_system.pressure — the formulas are dimensionally
 * consistent, so no cross-unit conversion happens here.
 */
import { roundTo } from "./round";

export type FormulaSelection =
  | "asme_b31_3_straight_pipe"
  | "barlow_in_service";

export interface FormulaInputs {
  /** Internal design gauge pressure P — same unit system as allowableStress. */
  designPressure: number;
  /** Outside diameter, mm (canonical). */
  odMm: number;
  /** Allowable stress S — same unit system as designPressure. */
  allowableStress: number;
  /** Longitudinal quality factor E (1.0 for seamless). */
  e: number;
  /** Weld joint strength reduction factor W (1.0 default). */
  w: number;
  /** Material coefficient Y (0.4 for ferritic steels at normal temperature). */
  y: number;
  /** Future corrosion allowance, mm. */
  fcaMm: number;
  /** Structural minimum thickness, mm (0 = not governing). */
  tStructuralMm: number;
  /** Formula branch selection (defaults to the B31.3 straight-pipe shape). */
  formula?: FormulaSelection;
}

export interface RequiredThicknessResult {
  tPressureMm: number;
  tStructuralMm: number;
  tRequiredMm: number;
  citations: string[];
}

/** ASME B31.3 Eq. 3a shape (includes FCA). */
export function tPressureB313(inputs: FormulaInputs): number {
  const { designPressure, odMm, allowableStress, e, w, y, fcaMm } = inputs;
  return (
    (designPressure * odMm) / (2 * (allowableStress * e * w + designPressure * y)) +
    fcaMm
  );
}

/** API 574 10.5.1.2 Barlow in-service shape (includes FCA). */
export function tPressureBarlow(inputs: FormulaInputs): number {
  const { designPressure, odMm, allowableStress, e, fcaMm } = inputs;
  return (designPressure * odMm) / (2 * allowableStress * e) + fcaMm;
}

/**
 * Governing required thickness: max(t_pressure, t_structural) per
 * ut-criteria.json governing_t_required (API 574 para. 10.5.1.4), rounded to
 * the canonical 6 dp at the exit (R4).
 */
export function requiredThickness(
  inputs: FormulaInputs,
): RequiredThicknessResult {
  const formula = inputs.formula ?? "asme_b31_3_straight_pipe";
  const tPressure =
    formula === "barlow_in_service"
      ? tPressureBarlow(inputs)
      : tPressureB313(inputs);
  const tPressureMm = roundTo(tPressure, 6);
  const tStructuralMm = roundTo(inputs.tStructuralMm, 6);
  const tRequiredMm = Math.max(tPressureMm, tStructuralMm);

  const citations: string[] = [];
  citations.push(
    formula === "barlow_in_service"
      ? "api574_10_5_1_2"
      : "asme_b31_3_304_1_2",
  );
  // The structural branch consults API 574 Annex D tables; the governing max
  // selection is API 574 para. 10.5.1.4.
  if (tStructuralMm > 0) citations.push("api574_annex_d");
  citations.push("api574_10_5_1_4");

  return { tPressureMm, tStructuralMm, tRequiredMm, citations };
}
