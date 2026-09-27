import { describe, it, expect } from "vitest";
import { buildCells, tokenize } from "@/lib/ingest/csv";
import { roundTo } from "@/lib/calc/round";
import { toMm } from "@/lib/calc/units";
import {
  addYearsUtc,
  daysBetweenUtc,
  daysToYears,
  parseIsoUtc,
} from "@/lib/calc/dates";
import { requiredThickness, tPressureB313 } from "@/lib/calc/formulas";
import { crLongTerm, crShortTerm, rateOutcome } from "@/lib/calc/corrosion";
import { remainingLife } from "@/lib/calc/remaining-life";
import { verdictBand } from "@/lib/calc/verdicts";
import { criteria } from "@/lib/calc/criteria";
import { tracerSampleCsv } from "@/lib/demo/fixtures/tracer-sample";

// ---------------------------------------------------------------------------
// Tracer pipeline helpers.
// NOTE: this minimal grouping helper is test-only. Plan 02-03 replaces it with
// the real lib/ingest/group.ts (R6 long-format grouping); this tracer slice
// stays thin but real.
// ---------------------------------------------------------------------------

const TRACER_META = {
  designPressure: 4.0, // MPa
  odMm: 114.3,
  allowableStress: 138, // MPa
  e: 1.0,
  w: 1.0,
  y: 0.4,
  fcaMm: 1.0,
  tStructuralMm: 0,
} as const;

interface DerivedReading {
  readingId: string;
  location: string;
  date: string;
  tActualMm: number;
  tInitialMm: number | null;
  tPreviousMm: number | null;
  dtLtYears: number | null;
  dtStYears: number | null;
}

function deriveTracerInputs(csv: string): DerivedReading[] {
  const { records } = tokenize(csv, ",");
  const headers = records[0];
  const dataRows = records.slice(1);
  const mapped = dataRows.map((cells, i) => ({
    row: i + 1,
    cells: buildCells(headers, cells),
  }));

  const groups = new Map<string, typeof mapped>();
  for (const r of mapped) {
    const key = r.cells["Tank"];
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  const inputs: DerivedReading[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort(
      (a, b) =>
        (parseIsoUtc(a.cells["Measurement_Date"])?.getTime() ?? 0) -
        (parseIsoUtc(b.cells["Measurement_Date"])?.getTime() ?? 0),
    );
    sorted.forEach((r, i) => {
      const date = parseIsoUtc(r.cells["Measurement_Date"])!;
      const d0 = parseIsoUtc(sorted[0].cells["Measurement_Date"])!;
      const dPrev =
        i > 0 ? parseIsoUtc(sorted[i - 1].cells["Measurement_Date"])! : null;
      inputs.push({
        readingId: r.cells["Reading_ID"],
        location: r.cells["Tank"],
        date: r.cells["Measurement_Date"],
        tActualMm: Number(r.cells["Measured_Thickness_mm"]),
        tInitialMm: i === 0 ? null : Number(sorted[0].cells["Measured_Thickness_mm"]),
        tPreviousMm:
          i === 0 ? null : Number(sorted[i - 1].cells["Measured_Thickness_mm"]),
        dtLtYears: i === 0 ? null : daysToYears(daysBetweenUtc(d0, date)),
        dtStYears:
          i === 0 || dPrev === null ? null : daysToYears(daysBetweenUtc(dPrev, date)),
      });
    });
  }
  return inputs;
}

describe("round — canonicalization helper (R4)", () => {
  it("restores 5.0 from the G12 float-drift double", () => {
    expect(roundTo(4.999999999999998, 4)).toBe(5.0);
  });
  it("canonizes the G1 pressure thickness to 6 dp", () => {
    expect(roundTo(2.637535816618911, 6)).toBe(2.637536);
  });
});

describe("units — exact conversion constants (ING-05)", () => {
  it("1 in is exactly 25.4 mm", () => {
    expect(toMm(1, "in")).toBe(25.4);
  });
  it("1 mil is exactly 0.0254 mm", () => {
    expect(toMm(1, "mils")).toBe(0.0254);
  });
  it("mm is the identity", () => {
    expect(toMm(11.811, "mm")).toBe(11.811);
  });
});

describe("dates — strict ISO + G13 convention (R5)", () => {
  it("2015-01-15 -> 2025-01-15 is exactly 3653 UTC days", () => {
    const a = parseIsoUtc("2015-01-15");
    const b = parseIsoUtc("2025-01-15");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(daysBetweenUtc(a!, b!)).toBe(3653);
  });
  it("daysToYears(3653) = 10.001369 (3653 / 365.25, 6 dp)", () => {
    expect(daysToYears(3653)).toBe(10.001369);
  });
  it("rejects '31/02/2026' and '2026-02-31' — never new Date(string) coercion", () => {
    expect(parseIsoUtc("31/02/2026")).toBeNull();
    expect(parseIsoUtc("2026-02-31")).toBeNull();
  });
  it("addYearsUtc clamps Feb 29 to Feb 28", () => {
    expect(addYearsUtc("2024-02-29", 1)).toBe("2025-02-28");
  });
});

describe("formulas — G1 pressure thickness (ASME B31.3 eq. 3a)", () => {
  it("G1: t_required = 2.637536 mm and tPressureMm is exposed", () => {
    const result = requiredThickness({ ...TRACER_META, formula: "asme_b31_3_straight_pipe" });
    expect(result.tRequiredMm).toBe(2.637536);
    expect(result.tPressureMm).toBe(2.637536);
    expect(result.tStructuralMm).toBe(0);
    expect(result.citations).toContain("asme_b31_3_304_1_2");
    expect(result.citations).toContain("api574_10_5_1_4");
  });
  it("B31.3 shape: (P*OD)/(2*(S*E*W + P*Y)) + FCA", () => {
    const t = tPressureB313({ ...TRACER_META });
    // 457.2 / 279.2 + 1.0
    expect(roundTo(t, 6)).toBe(2.637536);
  });
  it("G2: Barlow in-service branch gives 2.656522 (api574_10_5_1_2)", () => {
    const result = requiredThickness({ ...TRACER_META, formula: "barlow_in_service" });
    expect(result.tRequiredMm).toBe(2.656522);
    expect(result.citations).toContain("api574_10_5_1_2");
  });
});

describe("corrosion — G4 rates + G9b mixed-negative flag", () => {
  it("G4: rawLt 0.080, rawSt 0.300, governing 0.300", () => {
    expect(crLongTerm(10.0, 9.2, 10.0)).toBe(0.08);
    expect(crShortTerm(9.5, 9.2, 1.0)).toBe(0.3);
    const outcome = rateOutcome(10.0, 9.5, 9.2, 10.0, 1.0);
    expect(outcome.rawLt).toBe(0.08);
    expect(outcome.rawSt).toBe(0.3);
    expect(outcome.governingRaw).toBe(0.3);
    expect(outcome.governingEffective).toBe(0.3);
    expect(outcome.insufficientHistory).toBe(false);
    expect(outcome.measurementInconsistency).toBe(false);
  });
  it("G9b: mixed-negative keeps governing 0.1 positive and fires measurementInconsistency (OQ2: either raw rate negative)", () => {
    const outcome = rateOutcome(9.0, 9.3, 9.2, 10.0, 1.0);
    expect(outcome.rawLt).toBe(-0.02);
    expect(outcome.rawSt).toBe(0.1);
    expect(outcome.governingRaw).toBe(0.1);
    expect(outcome.governingEffective).toBe(0.1);
    expect(outcome.measurementInconsistency).toBe(true);
    expect(outcome.insufficientHistory).toBe(false);
  });
});

describe("remaining life — never Infinity", () => {
  it("null divisor or zero effective rate returns null (G9a/G10 contract)", () => {
    expect(remainingLife(9.2, 2.637536, null)).toBeNull();
    expect(remainingLife(9.2, 2.637536, 0)).toBeNull();
  });
  it("computes RL at 4 dp for a positive effective rate", () => {
    // G5 shape: (9.2 - 2.637536) / 0.3
    expect(remainingLife(9.2, 2.637536, 0.3)).toBe(21.8749);
  });
});

describe("verdicts — locked boundary order (G8 / ut-criteria boundary_convention)", () => {
  it("t_actual == t_required is re_check, 4.99 is reject, tReq + 0.1 by arithmetic is accept", () => {
    expect(verdictBand(5.0, 5.0, 0.1)).toBe("re_check");
    expect(verdictBand(4.99, 5.0, 0.1)).toBe("reject");
    const tReq = 5.0;
    const unc = 0.1;
    expect(verdictBand(tReq + unc, tReq, unc)).toBe("accept");
  });
  it("defaults gauge uncertainty from criteria (0.1 never a literal in verdicts.ts)", () => {
    expect(criteria.ut.verdict_bands.default_gauge_uncertainty_mm).toBe(0.1);
    expect(verdictBand(5.0, 5.0)).toBe("re_check");
    expect(verdictBand(5.0 + criteria.ut.verdict_bands.default_gauge_uncertainty_mm, 5.0)).toBe("accept");
  });
  it("tracer bands: 9.2 / 2.637536 / 2.0 against t_required 2.637536", () => {
    expect(verdictBand(9.2, 2.637536)).toBe("accept");
    expect(verdictBand(2.637536, 2.637536)).toBe("re_check");
    expect(verdictBand(2.0, 2.637536)).toBe("reject");
  });
});

describe("tokenizer — RFC 4180 core (R3 items 1-4, 6-8)", () => {
  it("strips the UTF-8 BOM before header parse", () => {
    const { records } = tokenize("\uFEFFReading_ID,Tank\r\nA1,TK-1\r\n", ",");
    expect(records[0][0]).toBe("Reading_ID");
    expect(records[1]).toEqual(["A1", "TK-1"]);
  });
  it("quoted field with comma and embedded CRLF round-trips", () => {
    const { records } = tokenize('a,"x,y\r\nz",b', ",");
    expect(records).toEqual([["a", "x,y\r\nz", "b"]]);
  });
  it("trailing newline does not produce a phantom record", () => {
    const { records } = tokenize("h1,h2\n1,2\n", ",");
    expect(records).toEqual([
      ["h1", "h2"],
      ["1", "2"],
    ]);
  });
  it("sniffs the delimiter from the header line (R3 item 6)", () => {
    const sniffed = tokenize("a;b\nc;d");
    expect(sniffed.delimiter).toBe(";");
    expect(sniffed.records).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
  it("builds null-prototype row cells — parsed header text can never pollute Object.prototype", () => {
    const cells = buildCells(["__proto__", "Tank"], ["poison", "TK-1"]);
    expect(Object.getPrototypeOf(cells)).toBeNull();
    expect(cells["__proto__"]).toBe("poison");
    expect(cells["Tank"]).toBe("TK-1");
  });
});

describe("tracer pipeline end-to-end on the committed 6-row fixture", () => {
  const inputs = deriveTracerInputs(tracerSampleCsv);

  it("parses 6 rows in 3 CML groups of 2 campaigns each", () => {
    expect(inputs).toHaveLength(6);
    expect(new Set(inputs.map((r) => r.location))).toEqual(
      new Set(["A01", "B02", "C03"]),
    );
  });

  it("derives campaign history: first campaign has no history, second has t_initial 9.5 and dt 10.001369", () => {
    const a01 = inputs.filter((r) => r.location === "A01");
    expect(a01[0].tInitialMm).toBeNull();
    expect(a01[0].tPreviousMm).toBeNull();
    expect(a01[1].tInitialMm).toBe(9.5);
    expect(a01[1].tPreviousMm).toBe(9.5);
    expect(a01[1].dtLtYears).toBe(10.001369);
    expect(a01[1].dtStYears).toBe(10.001369);
  });

  it("CML A01 verdict accept with CR_LT exactly 0.029996 and a finite positive RL", () => {
    const rt = requiredThickness({ ...TRACER_META, formula: "asme_b31_3_straight_pipe" });
    const a01_2025 = inputs.find((r) => r.readingId === "A01-2025")!;
    const outcome = rateOutcome(
      a01_2025.tInitialMm,
      a01_2025.tPreviousMm,
      a01_2025.tActualMm,
      a01_2025.dtLtYears,
      a01_2025.dtStYears,
    );
    expect(outcome.rawLt).toBe(0.029996);
    expect(outcome.governingEffective).toBe(0.029996);
    const rl = remainingLife(a01_2025.tActualMm, rt.tRequiredMm, outcome.governingEffective);
    expect(rl).not.toBeNull();
    expect(Number.isFinite(rl!)).toBe(true);
    expect(rl!).toBeGreaterThan(0);
    expect(verdictBand(a01_2025.tActualMm, rt.tRequiredMm)).toBe("accept");
  });

  it("CML B02 verdict reject; CML C03 verdict re_check (6-dp canonicalization makes equality exact)", () => {
    const rt = requiredThickness({ ...TRACER_META, formula: "asme_b31_3_straight_pipe" });
    const b02_2025 = inputs.find((r) => r.readingId === "B02-2025")!;
    const c03_2025 = inputs.find((r) => r.readingId === "C03-2025")!;
    expect(verdictBand(b02_2025.tActualMm, rt.tRequiredMm)).toBe("reject");
    expect(verdictBand(c03_2025.tActualMm, rt.tRequiredMm)).toBe("re_check");
  });

  it("every computed result field is finite or null — no Infinity, no NaN anywhere", () => {
    const rt = requiredThickness({ ...TRACER_META, formula: "asme_b31_3_straight_pipe" });
    for (const input of inputs) {
      const outcome = rateOutcome(
        input.tInitialMm,
        input.tPreviousMm,
        input.tActualMm,
        input.dtLtYears,
        input.dtStYears,
      );
      const rl = remainingLife(input.tActualMm, rt.tRequiredMm, outcome.governingEffective);
      const fields = [
        rt.tRequiredMm,
        outcome.rawLt,
        outcome.rawSt,
        outcome.governingRaw,
        outcome.governingEffective,
        rl,
      ];
      for (const f of fields) {
        if (f !== null) expect(Number.isFinite(f)).toBe(true);
      }
    }
  });

  it("first-campaign readings carry insufficient history with a still-computed verdict", () => {
    const rt = requiredThickness({ ...TRACER_META, formula: "asme_b31_3_straight_pipe" });
    for (const input of inputs.filter((r) => r.tInitialMm === null)) {
      const outcome = rateOutcome(
        input.tInitialMm,
        input.tPreviousMm,
        input.tActualMm,
        input.dtLtYears,
        input.dtStYears,
      );
      expect(outcome.insufficientHistory).toBe(true);
      expect(remainingLife(input.tActualMm, rt.tRequiredMm, outcome.governingEffective)).toBeNull();
      // verdict still computes from t_actual vs t_required alone (G10 contract)
      expect(["accept", "re_check", "reject"]).toContain(
        verdictBand(input.tActualMm, rt.tRequiredMm),
      );
    }
  });

  it("summary across the fixture is accept 2 / re_check 2 / reject 2", () => {
    const rt = requiredThickness({ ...TRACER_META, formula: "asme_b31_3_straight_pipe" });
    const counts = { accept: 0, re_check: 0, reject: 0 };
    for (const input of inputs) {
      counts[verdictBand(input.tActualMm, rt.tRequiredMm)] += 1;
    }
    expect(counts).toEqual({ accept: 2, re_check: 2, reject: 2 });
  });
});
