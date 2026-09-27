import { describe, it, expect } from "vitest";
import { nextInterval } from "@/lib/calc/interval";
import { maxIntervalByClass } from "@/lib/calc/criteria";

describe("interval — class maxima load from ut-criteria.json (API 570 Table 1)", () => {
  it("Class 1 = 5, Class 2 = 10, Class 3 = 10 (thickness-measurement maxima)", () => {
    expect(maxIntervalByClass(1)).toBe(5.0);
    expect(maxIntervalByClass(2)).toBe(10.0);
    expect(maxIntervalByClass(3)).toBe(10.0);
  });
});

describe("interval — G6 RL < 4 branch (NOT naive RL/2)", () => {
  it("nextInterval(3.0, 1) = 2.00 — min(RL, 2.0), never 1.50", () => {
    const result = nextInterval(3.0, 1);
    expect(result.intervalYears).toBe(2.0);
    expect(result.state).toBe("ok");
  });
});

describe("interval — G7 floor/cap interactions", () => {
  it("nextInterval(1.0, 1) = 1.00 (floor below the 2.0 short-RL cap)", () => {
    expect(nextInterval(1.0, 1).intervalYears).toBe(1.0);
  });
  it("nextInterval(40, 1) = 5.00 (Class-1 cap over RL/2 = 20)", () => {
    expect(nextInterval(40, 1).intervalYears).toBe(5.0);
  });
});

describe("interval — G5 row (RL = 21.8749, RL/2 = 10.93745 exercises the class cap)", () => {
  // Research G5: RL = 21.8749 -> RL/2 = 10.93745 -> Class 1: 5.00; Class 2: 10.00; Class 3: 10.00.
  // (10.93745 > 10 caps Classes 2/3 — the class-maximum cap is exercised.)
  it("Class 1: 5.00, Class 2: 10.00, Class 3: 10.00", () => {
    expect(nextInterval(21.8749, 1).intervalYears).toBe(5.0);
    expect(nextInterval(21.8749, 2).intervalYears).toBe(10.0);
    expect(nextInterval(21.8749, 3).intervalYears).toBe(10.0);
  });
});

describe("interval — G14 builder decision (negative-RL contract)", () => {
  it("rlYears 0 and -1.5 return intervalYears 0 with state immediate-inspection", () => {
    const zero = nextInterval(0, 1);
    expect(zero.intervalYears).toBe(0);
    expect(zero.state).toBe("immediate-inspection");
    const negative = nextInterval(-1.5, 1);
    expect(negative.intervalYears).toBe(0);
    expect(negative.state).toBe("immediate-inspection");
  });
  it("never returns a negative interval", () => {
    for (const rl of [0, -0.5, -1.5, -100]) {
      expect(nextInterval(rl, 3).intervalYears).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("interval — WR-02: an unknown class is a hard error, never an uncapped interval", () => {
  it("a class without a numeric maximum (Class 4 'optional') throws — no ?? Infinity cap drop", () => {
    // maxIntervalByClass narrows 'Class 4': "optional" to null; pre-fix
    // nextInterval treated null as +Infinity and silently uncapped the interval.
    expect(() => nextInterval(30, 4 as unknown as 1)).toThrow(/maximum interval/i);
  });

  it("a NaN pipeClass (the probed uncapping path) throws instead of returning 15.00", () => {
    // Pre-fix probe: nextInterval(30, NaN) -> maxIntervalByClass null -> 15.00.
    expect(() => nextInterval(30, Number.NaN as unknown as 1)).toThrow(/maximum interval/i);
  });

  it("valid classes 1|2|3 still compute their capped intervals", () => {
    expect(nextInterval(30, 1).intervalYears).toBe(5.0);
    expect(nextInterval(30, 3).intervalYears).toBe(10.0);
  });
});

describe("interval — every return carries state and citation ids", () => {
  it("state is ok | immediate-inspection and citations pin API 570 6.3.3 + Table 1", () => {
    for (const result of [
      nextInterval(21.8749, 1),
      nextInterval(3.0, 2),
      nextInterval(1.0, 3),
      nextInterval(0, 1),
      nextInterval(-1.5, 2),
    ]) {
      expect(["ok", "immediate-inspection"]).toContain(result.state);
      expect(result.citationIds).toEqual(["api570_6_3_3_halflife", "api570_table1"]);
    }
  });
  it("intervals round to 2 dp", () => {
    // RL = 10 -> RL/2 = 5 < 10 class max -> 5.00; RL = 9 -> 4.50
    expect(nextInterval(10, 2).intervalYears).toBe(5.0);
    expect(nextInterval(9, 2).intervalYears).toBe(4.5);
  });
});
