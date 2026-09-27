import { describe, it, expect } from "vitest";
import { evaluate } from "@/lib/calc/evaluate";
import { toMm } from "@/lib/calc/units";
import { EvaluationInputError } from "@/lib/ingest/session";
import type { ComponentMetadata, EvaluationInput } from "@/lib/ingest/session";

const BASE_METADATA: ComponentMetadata = {
  od: 114.3,
  tNominal: 0,
  fca: 1.0,
  tStructural: 0,
  designCode: "ASME B31.3 — 2024 Edition",
  pipeClass: 1,
  gaugeUncertainty: 0.1,
  pressureUnit: "MPa",
  designPressure: 4.0,
  allowableStress: 138,
  e: 1.0,
  w: 1.0,
  y: 0.4,
  formula: "asme_b31_3_straight_pipe",
};

const MM_UNITS = { csvThickness: "mm", metadata: "mm" } as const;

function input(overrides: Partial<EvaluationInput>): EvaluationInput {
  return {
    readingId: "R1",
    location: "CML-1",
    date: "2025-01-15",
    tActualMm: 9.2,
    tInitialMm: null,
    tPreviousMm: null,
    dtLtYears: null,
    dtStYears: null,
    ...overrides,
  };
}

describe("evaluate — G5 remaining life + interval with class caps", () => {
  const results = evaluate(
    [
      input({
        readingId: "G5",
        tInitialMm: 10.0,
        tPreviousMm: 9.5,
        dtLtYears: 10.0,
        dtStYears: 1.0,
      }),
    ],
    BASE_METADATA,
    MM_UNITS,
  );
  const reading = results.readings[0];

  it("RL = 21.8749 (4 dp) from CR_gov 0.300", () => {
    expect(reading.crGoverningMmYr).toBe(0.3);
    expect(reading.rlYears).toBe(21.8749);
  });

  it("next inspection anchored to the measurement date: Class 1 -> 2030-01-15 (5.00 yr)", () => {
    expect(reading.nextInspection).toEqual({
      date: "2030-01-15",
      intervalYears: 5.0,
    });
  });

  it("class maxima cap Classes 2/3 at 10.00", () => {
    const withHistory = {
      tInitialMm: 10.0,
      tPreviousMm: 9.5,
      dtLtYears: 10.0,
      dtStYears: 1.0,
    };
    const class2 = evaluate(
      [input({ readingId: "G5c2", ...withHistory })],
      { ...BASE_METADATA, pipeClass: 2 },
      MM_UNITS,
    );
    expect(class2.readings[0].nextInspection!.intervalYears).toBe(10.0);
    const class3 = evaluate(
      [input({ readingId: "G5c3", ...withHistory })],
      { ...BASE_METADATA, pipeClass: 3 },
      MM_UNITS,
    );
    expect(class3.readings[0].nextInspection!.intervalYears).toBe(10.0);
  });

  it("raw rates surfaced: crLt 0.080 / crSt 0.300", () => {
    expect(reading.crLtMmYr).toBe(0.08);
    expect(reading.crStMmYr).toBe(0.3);
  });
});

describe("evaluate — G10 insufficient history (verdict still computes)", () => {
  const results = evaluate([input({ readingId: "G10", tActualMm: 9.2 })], BASE_METADATA, MM_UNITS);
  const reading = results.readings[0];

  it("CR_LT / CR_ST / governing / RL / interval all null with the insufficient-history flag", () => {
    expect(reading.crLtMmYr).toBeNull();
    expect(reading.crStMmYr).toBeNull();
    expect(reading.crGoverningMmYr).toBeNull();
    expect(reading.rlYears).toBeNull();
    expect(reading.nextInspection).toBeNull();
    expect(reading.flags).toContain("insufficient_history");
  });

  it("verdict computes from t_actual vs t_required alone", () => {
    expect(reading.verdict).toBe("accept");
  });
});

describe("evaluate — G12 mils end-to-end through the mm-canonical pipeline", () => {
  const milsMetadata: ComponentMetadata = {
    ...BASE_METADATA,
    od: 4500, // mils -> 114.3 mm
    fca: 0,
    tStructural: 440, // mils -> 11.176 mm (governs; pressure branch negligible)
    gaugeUncertainty: 0.1,
    designPressure: 0.1,
    allowableStress: 138,
  };
  const milsInputs: EvaluationInput[] = [
    input({
      readingId: "G12",
      tActualMm: toMm(465, "mils"),
      tPreviousMm: toMm(470, "mils"), // 5 mils above t_actual
      dtStYears: 1.0,
    }),
  ];
  const results = evaluate(milsInputs, milsMetadata, {
    csvThickness: "mils",
    metadata: "mils",
  });
  const reading = results.readings[0];

  it("raw double before canonicalization is 4.999999999999998-ish (toBeCloseTo 5.0 at 9 dp)", () => {
    const raw = (toMm(465, "mils") - reading.tRequiredMm) / 0.127;
    expect(raw).toBeCloseTo(5.0, 9);
  });

  it("RL exactly 5.0 post-canonical rounding; t_required 11.176 from 440 mils", () => {
    expect(reading.tRequiredMm).toBe(11.176);
    expect(reading.rlYears).toBe(5.0);
  });

  it("Class-1 interval 2.50", () => {
    expect(reading.nextInspection!.intervalYears).toBe(2.5);
    expect(reading.nextInspection!.date).toBe(
      // measurement date 2025-01-15 + 2.5 yr (whole 2 -> 2027-01-15; 0.5*365 = 183 days)
      "2027-07-17",
    );
  });
});

describe("evaluate — G14 immediate inspection on negative remaining life (builder decision)", () => {
  const results = evaluate(
    [
      input({
        readingId: "G14",
        tActualMm: 2.0, // below t_required 2.637536
        tInitialMm: 2.05,
        dtLtYears: 10.0, // CR = 0.005 > 0 -> RL = (2.0 - 2.637536)/0.005 < 0
      }),
    ],
    BASE_METADATA,
    MM_UNITS,
  );
  const reading = results.readings[0];

  it("immediate_inspection flag set, nextInspection null, no negative interval", () => {
    expect(reading.flags).toContain("immediate_inspection");
    expect(reading.nextInspection).toBeNull();
    expect(reading.rlYears).not.toBeNull();
    expect(reading.rlYears!).toBeLessThanOrEqual(0);
  });

  it("verdict is reject (component at/below t_required)", () => {
    expect(reading.verdict).toBe("reject");
  });
});

describe("evaluate — outliers per CML population (G11 through the orchestration)", () => {
  const values = [8.3, 9.19, 9.2, 9.2, 9.21];
  const inputs: EvaluationInput[] = values.map((v, i) =>
    input({
      readingId: `X-${i}`,
      location: "CML-X",
      date: `2020-01-${10 + i}`,
      tActualMm: v,
    }),
  );
  const results = evaluate(inputs, BASE_METADATA, MM_UNITS);

  it("the 8.3 reading carries the outlier flag with z/median/mad detail", () => {
    const flagged = results.readings.find((r) => r.readingId === "X-0")!;
    expect(flagged.flags).toContain("outlier");
    expect(flagged.outlier).toEqual({ z: -60.705, median: 9.2, mad: 0.01 });
  });

  it("outliers warn, never override the banding", () => {
    for (const reading of results.readings) {
      expect(reading.verdict).toBe("accept");
    }
  });
});

describe("evaluate — summary + citationsUsed rollup", () => {
  const inputs: EvaluationInput[] = [
    input({ readingId: "A1", location: "CML-A", tActualMm: 9.2 }),
    // Real positive rate with RL <= 0 -> immediate inspection; RL is computed
    // (api570_7_2 cited) and the verdict stays reject.
    input({
      readingId: "A2",
      location: "CML-A",
      tActualMm: 2.0,
      tInitialMm: 3.0,
      dtLtYears: 10.0,
    }),
    input({
      readingId: "B1",
      location: "CML-B",
      tActualMm: 2.637536,
      tInitialMm: 2.637536,
      dtLtYears: 10.0,
    }),
  ];
  const results = evaluate(inputs, BASE_METADATA, MM_UNITS);

  it("summary counts match the inputs (total, locations, accept/reCheck/fail)", () => {
    expect(results.summary).toEqual({
      total: 3,
      locations: 2,
      accept: 1,
      reCheck: 1,
      fail: 1,
    });
  });

  it("citationsUsed is the deduped union and every id exists in citations.json", () => {
    expect(new Set(results.citationsUsed).size).toBe(results.citationsUsed.length);
    const known = new Set([
      "asme_b31_3_304_1_2",
      "api574_10_5_1_2",
      "api574_10_5_1_4",
      "api574_annex_d",
      "api570_7_6",
      "api570_7_1_2_lt",
      "api570_7_1_2_st",
      "api570_7_1_2_governing",
      "api570_7_2",
      "api570_6_3_3_halflife",
      "api570_table1",
      "api570_6_3_4",
      "asme_b31_3_344_3_2",
      "asme_b31_3_344_4_2",
    ]);
    for (const id of results.citationsUsed) {
      expect(known.has(id)).toBe(true);
    }
    expect(results.citationsUsed).toContain("api570_7_2"); // RL computed
  });

  it("PT/MT indications evaluate to per-indication results with citations", () => {
    const withPtmt = evaluate(inputs, BASE_METADATA, MM_UNITS, {
      ptmtIndications: [
        {
          id: "ind-lin",
          method: "MT",
          morphology: "linear",
          lengthMm: 4.2,
          widthMm: 0.8,
          count: 1,
          edgeSeparationMm: null,
          crackSuspect: false,
        },
      ],
    });
    expect(withPtmt.indications).toHaveLength(1);
    expect(withPtmt.indications[0].verdict).toBe("reject");
    expect(withPtmt.indications[0].citationId).toBe("asme_b31_3_344_3_2");
    expect(withPtmt.citationsUsed).toContain("asme_b31_3_344_3_2");
  });
});

describe("evaluate — WR-01 fail-closed: non-finite input never becomes a silent accept", () => {
  it("NaN tActualMm is refused with a typed error — never verdict 'accept' with NaN rlYears", () => {
    // Pre-fix probe: every NaN comparison is false, so reject/re_check fall
    // through to accept and rlYears came back NaN — a silent accept on the
    // Phase 3/4 public API.
    expect(() =>
      evaluate([input({ readingId: "WR01", tActualMm: Number.NaN })], BASE_METADATA, MM_UNITS),
    ).toThrow(EvaluationInputError);
  });

  it("non-finite tInitialMm / tPreviousMm / dtLtYears / dtStYears are each refused", () => {
    const cases: Array<Partial<EvaluationInput>> = [
      { tInitialMm: Number.NaN },
      { tPreviousMm: Number.NaN },
      { tInitialMm: 10.0, dtLtYears: Number.NaN },
      { tPreviousMm: 9.5, dtStYears: Number.POSITIVE_INFINITY },
    ];
    for (const overrides of cases) {
      expect(() =>
        evaluate([input({ readingId: "WR01", ...overrides })], BASE_METADATA, MM_UNITS),
      ).toThrow(EvaluationInputError);
    }
  });

  it("the refusal names the reading and the offending field (loud, actionable)", () => {
    try {
      evaluate([input({ readingId: "BAD-7", tActualMm: Number.NaN })], BASE_METADATA, MM_UNITS);
      expect.unreachable("evaluate must throw on non-finite input");
    } catch (error) {
      expect(error).toBeInstanceOf(EvaluationInputError);
      expect((error as Error).message).toContain("BAD-7");
      expect((error as Error).message).toContain("tActualMm");
    }
  });

  it("non-finite metadata numerics are refused before any reading is evaluated", () => {
    const badMetadata: ComponentMetadata = { ...BASE_METADATA, gaugeUncertainty: Number.NaN };
    expect(() =>
      evaluate([input({ readingId: "WR01" })], badMetadata, MM_UNITS),
    ).toThrow(EvaluationInputError);
    const badOd: ComponentMetadata = { ...BASE_METADATA, od: Number.POSITIVE_INFINITY };
    expect(() =>
      evaluate([input({ readingId: "WR01" })], badOd, MM_UNITS),
    ).toThrow(EvaluationInputError);
  });

  it("null history fields stay legal (insufficient-history path is untouched)", () => {
    const results = evaluate([input({ readingId: "G10" })], BASE_METADATA, MM_UNITS);
    expect(results.readings[0].verdict).toBe("accept");
    expect(results.readings[0].rlYears).toBeNull();
  });
});

describe("evaluate — finiteness scan (Pitfall 6: no Infinity/NaN, no negative interval)", () => {
  it("every numeric field of every ReadingResult is finite or null; no negative intervalYears", () => {
    const inputs: EvaluationInput[] = [
      input({ readingId: "F1", tActualMm: 9.2, tInitialMm: 10.0, dtLtYears: 10.0 }),
      input({ readingId: "F2", tActualMm: 2.0, tInitialMm: 2.05, dtLtYears: 10.0 }), // G14 path
      input({ readingId: "F3", tActualMm: 2.0 }), // insufficient history
      input({
        readingId: "F4",
        tActualMm: 9.2,
        tInitialMm: 9.0,
        tPreviousMm: 9.3,
        dtLtYears: 10.0,
        dtStYears: 1.0,
      }), // mixed-sign
    ];
    const results = evaluate(inputs, BASE_METADATA, MM_UNITS);
    for (const reading of results.readings) {
      const numericFields: Array<number | null | undefined> = [
        reading.tActualMm,
        reading.tPressureMm,
        reading.tStructuralMm,
        reading.tRequiredMm,
        reading.crLtMmYr,
        reading.crStMmYr,
        reading.rawCrLtMmYr,
        reading.rawCrStMmYr,
        reading.crGoverningMmYr,
        reading.rlYears,
        reading.nextInspection?.intervalYears,
        reading.outlier?.z,
        reading.outlier?.median,
        reading.outlier?.mad,
      ];
      for (const value of numericFields) {
        if (value !== null && value !== undefined) {
          expect(Number.isFinite(value)).toBe(true);
        }
      }
      if (reading.nextInspection) {
        expect(reading.nextInspection.intervalYears).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
