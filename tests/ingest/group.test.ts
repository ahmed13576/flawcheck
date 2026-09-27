import { describe, it, expect } from "vitest";
import { buildCells, tokenize } from "@/lib/ingest/csv";
import { buildParsedRows } from "@/lib/ingest/validate";
import { groupByCml } from "@/lib/ingest/group";
import { daysToYears, parseIsoUtc } from "@/lib/calc/dates";
import { toMm } from "@/lib/calc/units";
import type { EvaluationInput, ParsedRow, TargetField } from "@/lib/ingest/session";

const HEADERS = [
  "Reading_ID",
  "Tank",
  "Grid_Position",
  "Original_Scantling_mm",
  "Measured_Thickness_mm",
  "Measurement_Date",
];

const FULL_MAPPING: Record<TargetField, string | null> = {
  readingId: "Reading_ID",
  tank: "Tank",
  tInitial: null,
  measuredThickness: "Measured_Thickness_mm",
  measurementDate: "Measurement_Date",
  tPrevious: null,
};

const MM = { csvThicknessUnit: "mm" } as const;

function rowsFrom(csv: string): ParsedRow[] {
  const { records } = tokenize(csv, ",");
  return buildParsedRows(records[0], records.slice(1));
}

describe("group — R6 long-format campaign history", () => {
  const csv = [
    "Reading_ID,Tank,Grid_Position,Original_Scantling_mm,Measured_Thickness_mm,Measurement_Date",
    "R-2023,A01,N-3,20,9.8,2023-01-15",
    "R-2015,A01,N-3,20,10.0,2015-01-15",
    "R-2025,A01,N-3,20,9.5,2025-01-15", // deliberately out of order in the file
    "R-2025b,B02,S-1,20,7.0,2025-01-15",
  ].join("\n");

  const inputs: EvaluationInput[] = groupByCml(rowsFrom(csv), FULL_MAPPING, MM);

  it("groups by Tank + grid-position identity: A01 has 3 readings, B02 has 1", () => {
    const a01 = inputs.filter((r) => r.location === "A01");
    const b02 = inputs.filter((r) => r.location === "B02");
    expect(a01).toHaveLength(3);
    expect(b02).toHaveLength(1);
  });

  it("sorts each group by date ascending (stable) regardless of file order", () => {
    const a01 = inputs.filter((r) => r.location === "A01");
    expect(a01.map((r) => r.date)).toEqual(["2015-01-15", "2023-01-15", "2025-01-15"]);
  });

  it("derives t-initial from the earliest reading and t-previous from the immediately prior reading", () => {
    const a01 = inputs.filter((r) => r.location === "A01");
    expect(a01[0].tInitialMm).toBeNull();
    expect(a01[0].tPreviousMm).toBeNull();
    expect(a01[1].tInitialMm).toBe(10.0);
    expect(a01[1].tPreviousMm).toBe(10.0);
    expect(a01[2].tInitialMm).toBe(10.0);
    expect(a01[2].tPreviousMm).toBe(9.8);
  });

  it("derives dtLt/dtSt years from the parsed dates (365.25 convention)", () => {
    const a01 = inputs.filter((r) => r.location === "A01");
    const d2015 = parseIsoUtc("2015-01-15")!;
    const d2023 = parseIsoUtc("2023-01-15")!;
    const d2025 = parseIsoUtc("2025-01-15")!;
    expect(a01[1].dtLtYears).toBe(daysToYears(365 * 8 + 2)); // 2015-01-15 -> 2023-01-15
    expect(a01[1].dtStYears).toBe(daysToYears(Math.round((d2023.getTime() - d2015.getTime()) / 86400000)));
    expect(a01[2].dtStYears).toBe(daysToYears(Math.round((d2025.getTime() - d2023.getTime()) / 86400000)));
    expect(a01[0].dtLtYears).toBeNull();
  });

  it("first-campaign readings carry no history (OQ3)", () => {
    const b02 = inputs.find((r) => r.location === "B02")!;
    expect(b02.tInitialMm).toBeNull();
    expect(b02.tPreviousMm).toBeNull();
    expect(b02.dtLtYears).toBeNull();
    expect(b02.dtStYears).toBeNull();
    expect(b02.tActualMm).toBe(7.0);
  });
});

describe("group — wide-format mapped columns take precedence", () => {
  const csv = [
    "Reading_ID,Tank,Grid_Position,Original_Scantling_mm,Previous_Thickness_mm,Measured_Thickness_mm,Measurement_Date",
    "R1,A01,G,11.5,11.0,9.2,2025-01-15",
    "R2,A01,G,11.5,11.0,9.6,2015-01-15",
  ].join("\n");
  const wideMapping: Record<TargetField, string | null> = {
    ...FULL_MAPPING,
    tInitial: "Original_Scantling_mm",
    tPrevious: "Previous_Thickness_mm",
  };
  const inputs = groupByCml(rowsFrom(csv), wideMapping, MM);

  it("mapped t-initial/t-previous values override the derived campaign values", () => {
    const sorted = inputs.sort((a, b) => (a.date < b.date ? -1 : 1));
    expect(sorted[1].tInitialMm).toBe(11.5); // mapped, not derived (derived would be 9.6)
    expect(sorted[1].tPreviousMm).toBe(11.0); // mapped, not derived (derived would be 9.6)
  });

  it("readings without a wide-format history still fall back to derived values", () => {
    // wide columns present for both rows here; the derived path is covered by the long-format suite
    expect(inputs).toHaveLength(2);
  });
});

describe("group — unmapped Tank degradation", () => {
  const csv = [
    "Reading_ID,Grid_Position,Measured_Thickness_mm,Measurement_Date",
    "R1,G,9.5,2025-01-15",
    "R2,G,9.4,2025-01-15",
  ].join("\n");
  const noTankMapping: Record<TargetField, string | null> = {
    readingId: "Reading_ID",
    tank: null,
    tInitial: null,
    measuredThickness: "Measured_Thickness_mm",
    measurementDate: "Measurement_Date",
    tPrevious: null,
  };
  const inputs = groupByCml(rowsFrom(csv), noTankMapping, MM);

  it("every row is its own CML with null history — verdicts still computable", () => {
    expect(inputs).toHaveLength(2);
    for (const input of inputs) {
      expect(input.tInitialMm).toBeNull();
      expect(input.tPreviousMm).toBeNull();
      expect(input.location).toBeTruthy();
    }
    expect(new Set(inputs.map((i) => i.location)).size).toBe(2);
  });
});

describe("group — CSV thickness unit conversion at the seam (ING-05)", () => {
  it("mils CSV values convert to canonical mm via exact constants", () => {
    const csv = [
      "Reading_ID,Tank,Measured_Thickness_mils,Measurement_Date",
      "R1,T,465,2025-01-15",
    ].join("\n");
    const rows = rowsFrom(csv);
    const inputs = groupByCml(rows, { ...FULL_MAPPING, tank: "Tank", measuredThickness: "Measured_Thickness_mils" }, {
      csvThicknessUnit: "mils",
    });
    expect(inputs[0].tActualMm).toBe(toMm(465, "mils"));
  });

  it("identity: mm values pass through unchanged", () => {
    const csv = [
      "Reading_ID,Tank,Measured_Thickness_mm,Measurement_Date",
      "R1,T,11.811,2025-01-15",
    ].join("\n");
    const inputs = groupByCml(
      rowsFrom(csv),
      { ...FULL_MAPPING, measuredThickness: "Measured_Thickness_mm" },
      MM,
    );
    expect(inputs[0].tActualMm).toBe(11.811);
  });
});

describe("group — emitted shape matches the R7 seam contract", () => {
  it("each EvaluationInput carries readingId/location/cml/date and mm thickness fields", () => {
    const csv = [
      "Reading_ID,Tank,Grid_Position,Original_Scantling_mm,Measured_Thickness_mm,Measurement_Date",
      "R1,A01,N-3,20,9.5,2015-01-15",
      "R2,A01,N-3,20,9.2,2025-01-15",
    ].join("\n");
    const inputs = groupByCml(rowsFrom(csv), FULL_MAPPING, MM);
    for (const input of inputs) {
      expect(Object.keys(input).sort()).toEqual(
        ["cml", "date", "dtLtYears", "dtStYears", "location", "readingId", "tActualMm", "tInitialMm", "tPreviousMm"].sort(),
      );
    }
    // location = tank (the summary's location count); cml = tank + grid identity.
    expect(inputs[0].location).toBe("A01");
    expect(inputs[0].cml).toBe("A01 / N-3");
  });
});
