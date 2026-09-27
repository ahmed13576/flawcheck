import { describe, it, expect } from "vitest";
import { buildCells, tokenize } from "@/lib/ingest/csv";
import {
  MAX_ROWS,
  buildParsedRows,
  rowIssues,
  type ValidateOptions,
} from "@/lib/ingest/validate";
import type { ParsedRow, TargetField } from "@/lib/ingest/session";

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
  tInitial: "Original_Scantling_mm",
  measuredThickness: "Measured_Thickness_mm",
  measurementDate: "Measurement_Date",
  tPrevious: null,
};

const BASE_OPTS: ValidateOptions = { odMm: 0, todayIso: "2026-09-27" };

function rowsFrom(records: string[][]): ParsedRow[] {
  return buildParsedRows(HEADERS, records);
}

describe("validate — the locked error catalog (UI-SPEC copy verbatim)", () => {
  it("Row 14 example: thickness 0 -> 'Row 14: Measured thickness — impossible value, must be greater than 0 (0 mm).'", () => {
    const rows: ParsedRow[] = Array.from({ length: 14 }, (_, i) => ({
      row: i + 1,
      cells: buildCells(HEADERS, [
        `R${i + 1}`,
        "T",
        "G",
        "20",
        i === 13 ? "0" : "9.5",
        "2025-01-15",
      ]),
      issues: [],
    }));
    const issues = rowIssues(rows, FULL_MAPPING, BASE_OPTS);
    expect(issues.map((issue) => issue.message)).toContain(
      "Row 14: Measured thickness — impossible value, must be greater than 0 (0 mm).",
    );
  });

  it("non-numeric thickness -> not a number ('abc')", () => {
    const rows = rowsFrom([["R1", "T", "G", "20", "abc", "2025-01-15"]]);
    const issues = rowIssues(rows, FULL_MAPPING, BASE_OPTS);
    expect(issues.map((i) => i.message)).toContain(
      "Row 1: Measured thickness — not a number ('abc').",
    );
    expect(issues.find((i) => i.message.includes("not a number"))!.severity).toBe("error");
  });

  it("blank required cell -> missing value", () => {
    const rows = rowsFrom([["R1", "T", "G", "20", "  ", "2025-01-15"]]);
    const issues = rowIssues(rows, FULL_MAPPING, BASE_OPTS);
    expect(issues.map((i) => i.message)).toContain(
      "Row 1: Measured thickness — missing value.",
    );
  });

  it("thickness >= OD -> impossible value, exceeds outer diameter ({v} mm)", () => {
    const rows = rowsFrom([["R1", "T", "G", "20", "120", "2025-01-15"]]);
    const issues = rowIssues(rows, FULL_MAPPING, { ...BASE_OPTS, odMm: 114.3 });
    expect(issues.map((i) => i.message)).toContain(
      "Row 1: Measured thickness — impossible value, exceeds outer diameter (114.3 mm).",
    );
  });

  it("OD check disabled when odMm is 0 (metadata not yet entered)", () => {
    const rows = rowsFrom([["R1", "T", "G", "20", "120", "2025-01-15"]]);
    const issues = rowIssues(rows, FULL_MAPPING, BASE_OPTS);
    expect(issues).toEqual([]);
  });

  it("unparseable date -> not a valid date ('31/02/2026')", () => {
    const rows = rowsFrom([["R1", "T", "G", "20", "9.5", "31/02/2026"]]);
    const issues = rowIssues(rows, FULL_MAPPING, BASE_OPTS);
    expect(issues.map((i) => i.message)).toContain(
      "Row 1: Measurement date — not a valid date ('31/02/2026').",
    );
  });

  it("future-dated reading -> WARNING 'date is in the future.' (does not block)", () => {
    const rows = rowsFrom([["R1", "T", "G", "20", "9.5", "2027-01-15"]]);
    const issues = rowIssues(rows, FULL_MAPPING, BASE_OPTS);
    const future = issues.find((i) => i.message.includes("date is in the future"));
    expect(future).toBeDefined();
    expect(future!.severity).toBe("warning");
    expect(future!.message).toBe("Row 1: Measurement date — date is in the future.");
  });

  it("duplicate Reading ID -> WARNING 'duplicate reading ID ('R1').'", () => {
    const rows = rowsFrom([
      ["R1", "T", "G", "20", "9.5", "2025-01-15"],
      ["R1", "T", "G", "20", "9.4", "2024-01-15"],
      ["R1", "T", "G", "20", "9.3", "2023-01-15"],
    ]);
    const issues = rowIssues(rows, FULL_MAPPING, BASE_OPTS);
    const duplicates = issues.filter((i) => i.message.includes("duplicate reading ID"));
    expect(duplicates).toHaveLength(2); // every occurrence after the first
    for (const dup of duplicates) {
      expect(dup.severity).toBe("warning");
      expect(dup.message.endsWith("duplicate reading ID ('R1').")).toBe(true);
    }
  });
});

describe("validate — strict numeric grammar (never bare Number())", () => {
  it.each([
    "0x1A",
    "Infinity",
    "19.5abc",
    "19,5",
  ])("'%s' fails as not a number", (raw) => {
    const rows = rowsFrom([["R1", "T", "G", "20", raw, "2025-01-15"]]);
    const issues = rowIssues(rows, FULL_MAPPING, BASE_OPTS);
    expect(
      issues.some((i) => i.message.includes("not a number")),
    ).toBe(true);
  });

  it("'' and ' ' fail as missing value, never as 0", () => {
    const rows = rowsFrom([
      ["R1", "T", "G", "20", "", "2025-01-15"],
      ["R2", "T", "G", "20", " ", "2025-01-15"],
    ]);
    const issues = rowIssues(rows, FULL_MAPPING, BASE_OPTS);
    expect(issues.filter((i) => i.message.includes("missing value"))).toHaveLength(2);
    expect(issues.some((i) => i.message.includes("greater than 0"))).toBe(false);
  });
});

describe("validate — two numbering spaces (R2)", () => {
  it("a quoted field with an embedded newline shifts physical lines but data-row numbering stays 1-based file order", () => {
    const csv =
      "Reading_ID,Tank,Grid_Position,Original_Scantling_mm,Measured_Thickness_mm,Measurement_Date\r\n" +
      'R1,"TK\r\n-1",G,20,9.5,2025-01-15\r\n' + // physical lines 2-3, data row 1
      "R2,TK-2,G,20,abc,2025-01-15\r\n"; // data row 2
    const { records } = tokenize(csv, ",");
    const rows = buildParsedRows(HEADERS, records.slice(1));
    // The record after the embedded-newline row is data row 2 (Row 2 in messages);
    // the tokenizer tracked physical lines separately (line 4 for the last record).
    const issues = rowIssues(rows, FULL_MAPPING, BASE_OPTS);
    expect(issues.map((i) => i.message)).toContain(
      "Row 2: Measured thickness — not a number ('abc').",
    );
    // The embedded-newline row itself is data row 1, cells intact.
    expect(rows[0].cells["Tank"]).toBe("TK\r\n-1");
    expect(rows[1].row).toBe(2);
  });

  it("a third data row after two multi-line rows still numbers as Row 3", () => {
    const csv =
      "Reading_ID,Tank,Grid_Position,Original_Scantling_mm,Measured_Thickness_mm,Measurement_Date\n" +
      'R1,"A\r\nB",G,20,9.5,2025-01-15\n' +
      'R2,"C\r\nD",G,20,9.4,2025-01-15\n' +
      "R3,TK,G,20,abc,2025-01-15\n";
    const { records } = tokenize(csv, ",");
    const rows = buildParsedRows(HEADERS, records.slice(1));
    const issues = rowIssues(rows, FULL_MAPPING, BASE_OPTS);
    expect(issues.map((i) => i.message)).toContain(
      "Row 3: Measured thickness — not a number ('abc').",
    );
  });
});

describe("validate — ragged rows (never silent truncation)", () => {
  it("fewer cells than header -> missing-value row error on the mapped field", () => {
    const rows = buildParsedRows(HEADERS, [["R1", "T", "G", "20", "9.5"]]); // date missing
    expect(rows[0].cells["Measurement_Date"]).toBe("");
    const issues = rowIssues(rows, FULL_MAPPING, BASE_OPTS);
    expect(issues.map((i) => i.message)).toContain(
      "Row 1: Measurement date — missing value.",
    );
  });

  it("extra cells -> row error naming the row, never a dropped cell", () => {
    const rows = buildParsedRows(HEADERS, [
      ["R1", "T", "G", "20", "9.5", "2025-01-15", "extra-1", "extra-2"],
    ]);
    const issues = rowIssues(rows, FULL_MAPPING, BASE_OPTS);
    const ragged = issues.find((i) => i.message.includes("extra value"));
    expect(ragged).toBeDefined();
    expect(ragged!.severity).toBe("error");
    expect(ragged!.message).toContain("Row 1:");
    expect(ragged!.message).toContain("extra-2");
  });
});

describe("validate — row cap (T-02-06 loud over-limit)", () => {
  it("MAX_ROWS is 50,000 and exceeding it throws a loud over-limit error", () => {
    expect(MAX_ROWS).toBe(50_000);
    expect(() => buildParsedRows(HEADERS, Array.from({ length: MAX_ROWS + 1 }, () => ["x"]))).toThrow(
      /limit is 50,000/,
    );
  });
});
