import { describe, it, expect } from "vitest";
import { requiredThickness } from "@/lib/calc/formulas";

const G1_INPUTS = {
  designPressure: 4.0, // MPa
  odMm: 114.3,
  allowableStress: 138, // MPa
  e: 1.0,
  w: 1.0,
  y: 0.4,
  fcaMm: 1.0,
  tStructuralMm: 0,
  formula: "asme_b31_3_straight_pipe",
} as const;

describe("formulas — G1 ASME B31.3 eq. 3a (asme_b31_3_304_1_2)", () => {
  it("t_required = 2.637536 with the pressure branch exposed", () => {
    const result = requiredThickness({ ...G1_INPUTS });
    expect(result.tRequiredMm).toBe(2.637536);
    expect(result.tPressureMm).toBe(2.637536);
    expect(result.tStructuralMm).toBe(0);
    expect(result.citations).toContain("asme_b31_3_304_1_2");
    expect(result.citations).toContain("api574_10_5_1_4");
  });
});

describe("formulas — G2 API 574 Barlow in-service (api574_10_5_1_2)", () => {
  it("t_required = 2.656522 on the same inputs", () => {
    const result = requiredThickness({ ...G1_INPUTS, formula: "barlow_in_service" });
    expect(result.tRequiredMm).toBe(2.656522);
    expect(result.citations).toContain("api574_10_5_1_2");
    expect(result.citations).not.toContain("asme_b31_3_304_1_2");
  });
});

describe("formulas — G3 governing max selects the structural branch (api574_10_5_1_4)", () => {
  it("t_structural 6.0 governs: t_required 6.0 with tPressureMm 2.637536 reported alongside", () => {
    const result = requiredThickness({ ...G1_INPUTS, tStructuralMm: 6.0 });
    expect(result.tRequiredMm).toBe(6.0);
    expect(result.tPressureMm).toBe(2.637536);
    expect(result.tStructuralMm).toBe(6.0);
    expect(result.citations).toContain("api574_10_5_1_4");
    expect(result.citations).toContain("api574_annex_d");
  });
});
