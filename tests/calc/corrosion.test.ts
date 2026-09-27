import { describe, it, expect } from "vitest";
import { crLongTerm, crShortTerm, rateOutcome } from "@/lib/calc/corrosion";
import { remainingLife } from "@/lib/calc/remaining-life";

describe("corrosion — G4 rates (API 570 7.1.2, formula-level Δt)", () => {
  it("crLongTerm(10.0, 9.2, 10.0) = 0.080; crShortTerm(9.5, 9.2, 1.0) = 0.300", () => {
    expect(crLongTerm(10.0, 9.2, 10.0)).toBe(0.08);
    expect(crShortTerm(9.5, 9.2, 1.0)).toBe(0.3);
  });
  it("governing = max(LT, ST) = 0.300; no flags on a healthy history", () => {
    const outcome = rateOutcome(10.0, 9.5, 9.2, 10.0, 1.0);
    expect(outcome.rawLt).toBe(0.08);
    expect(outcome.rawSt).toBe(0.3);
    expect(outcome.governingRaw).toBe(0.3);
    expect(outcome.governingEffective).toBe(0.3);
    expect(outcome.insufficientHistory).toBe(false);
    expect(outcome.measurementInconsistency).toBe(false);
  });
});

describe("corrosion — G9a both rates negative (negative_cr_policy)", () => {
  it("rawLt -0.020, rawSt -0.100 -> floored to 0 -> insufficient history + inconsistency flag, raw rates surfaced verbatim", () => {
    const outcome = rateOutcome(9.0, 9.1, 9.2, 10.0, 1.0);
    expect(outcome.rawLt).toBe(-0.02);
    expect(outcome.rawSt).toBe(-0.1);
    expect(outcome.governingRaw).toBe(-0.02);
    expect(outcome.governingEffective).toBe(0);
    expect(outcome.insufficientHistory).toBe(true);
    expect(outcome.measurementInconsistency).toBe(true);
    // RL from the floored rate is null — never Infinity (G9a contract)
    expect(remainingLife(9.2, 2.637536, outcome.governingEffective)).toBeNull();
  });
});

describe("corrosion — G9b mixed signs (OQ2: flag on EITHER raw rate negative)", () => {
  it("governing stays 0.100 positive, flag still fires, RL uses the positive rate", () => {
    const outcome = rateOutcome(9.0, 9.3, 9.2, 10.0, 1.0);
    expect(outcome.rawLt).toBe(-0.02);
    expect(outcome.rawSt).toBe(0.1);
    expect(outcome.governingRaw).toBe(0.1);
    expect(outcome.governingEffective).toBe(0.1);
    expect(outcome.measurementInconsistency).toBe(true);
    expect(outcome.insufficientHistory).toBe(false);
    expect(remainingLife(9.2, 2.637536, outcome.governingEffective)).toBe(65.6246);
  });
});

describe("corrosion — zero rate is insufficient history (B02 tracer case)", () => {
  it("identical readings -> rates 0 -> governingEffective 0 -> insufficientHistory true", () => {
    const outcome = rateOutcome(2.0, 2.0, 2.0, 10.001369, 10.001369);
    expect(outcome.rawLt).toBe(0);
    expect(outcome.rawSt).toBe(0);
    expect(outcome.governingRaw).toBe(0);
    expect(outcome.governingEffective).toBe(0);
    expect(outcome.insufficientHistory).toBe(true);
    expect(outcome.measurementInconsistency).toBe(false);
  });
});

describe("corrosion — missing history (G10)", () => {
  it("null t-initial/t-previous or non-positive Δt -> null rates", () => {
    expect(rateOutcome(null, null, 9.2, null, null)).toEqual({
      rawLt: null,
      rawSt: null,
      governingRaw: null,
      governingEffective: null,
      insufficientHistory: true,
      measurementInconsistency: false,
    });
    // Δt <= 0 can never yield a rate
    const outcome = rateOutcome(10.0, 9.5, 9.2, 0, -1);
    expect(outcome.rawLt).toBeNull();
    expect(outcome.rawSt).toBeNull();
  });
});
