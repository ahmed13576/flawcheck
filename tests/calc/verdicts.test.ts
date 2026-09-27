import { describe, it, expect } from "vitest";
import { verdictBand } from "@/lib/calc/verdicts";

describe("verdicts — G8 boundary equalities (locked order, ut-criteria boundary_convention)", () => {
  const tReq = 5.0;
  const unc = 0.1;

  it("t_actual == t_required -> re_check (reject is strictly less-than)", () => {
    expect(verdictBand(5.0, tReq, unc)).toBe("re_check");
  });

  it("5.099 (strictly below tReq + unc) -> re_check", () => {
    expect(verdictBand(5.099, tReq, unc)).toBe("re_check");
  });

  it("t_actual constructed as tReq + unc by arithmetic -> accept (never the literal 5.1)", () => {
    expect(verdictBand(tReq + unc, tReq, unc)).toBe("accept");
  });

  it("4.99 (strictly less than t_required) -> reject", () => {
    expect(verdictBand(4.99, tReq, unc)).toBe("reject");
  });

  it("uncertainty 0: t_actual == t_required -> accept (amber band of zero width)", () => {
    expect(verdictBand(5.0, tReq, 0)).toBe("accept");
  });

  it("gauge uncertainty defaults from criteria when omitted", () => {
    expect(verdictBand(5.0, 5.0)).toBe("re_check");
    expect(verdictBand(5.0 + 0.1, 5.0)).toBe("accept");
    expect(verdictBand(4.99, 5.0)).toBe("reject");
  });
});
