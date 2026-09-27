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
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    // FULL_MAPPING explicitly maps Original_Scantling_mm — the CR-02 warning
    // fires (non-blocking); auto-guess never produces this mapping.
    expect(issues.map((i) => i.message)).toContainEqual(
      expect.stringContaining("nominal-scantling-as-t-initial ('Original_Scantling_mm')"),
    );
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

describe("validate — CR-01 regression: thickness-vs-OD compares in canonical mm", () => {
  it("a 748-mil row (19.005 mm) validates clean against a 114.3 mm OD when csvThicknessUnit is mils", () => {
    const rows = rowsFrom([["R1", "T", "G", "20", "748", "2025-01-15"]]);
    const issues = rowIssues(rows, { ...FULL_MAPPING, tInitial: null }, {
      ...BASE_OPTS,
      odMm: 114.3,
      csvThicknessUnit: "mils",
    });
    expect(issues).toEqual([]);
  });

  it("an in-unit row (5.5 in = 139.7 mm) validates clean against a 2000 mm OD", () => {
    const rows = rowsFrom([["R1", "T", "G", "20", "5.5", "2025-01-15"]]);
    const issues = rowIssues(rows, { ...FULL_MAPPING, tInitial: null }, {
      ...BASE_OPTS,
      odMm: 2000,
      csvThicknessUnit: "in",
    });
    expect(issues).toEqual([]);
  });

  it("a genuinely-too-thick mils value still fires the OD error (guard is not disabled)", () => {
    // 6000 mils = 152.4 mm > 114.3 mm OD — must still be rejected after conversion.
    const rows = rowsFrom([["R1", "T", "G", "20", "6000", "2025-01-15"]]);
    const issues = rowIssues(rows, FULL_MAPPING, {
      ...BASE_OPTS,
      odMm: 114.3,
      csvThicknessUnit: "mils",
    });
    expect(issues.map((i) => i.message)).toContain(
      "Row 1: Measured thickness — impossible value, exceeds outer diameter (114.3 mm).",
    );
  });

  it("defaults to mm when csvThicknessUnit is omitted (back-compat)", () => {
    const rows = rowsFrom([["R1", "T", "G", "20", "120", "2025-01-15"]]);
    const issues = rowIssues(rows, FULL_MAPPING, { ...BASE_OPTS, odMm: 114.3 });
    expect(issues.map((i) => i.message)).toContain(
      "Row 1: Measured thickness — impossible value, exceeds outer diameter (114.3 mm).",
    );
  });
});

describe("validate — CR-02 regression: explicitly-mapped scantling columns warn (never block)", () => {
  it("a nominal-scantling t-initial mapping emits a warning naming the hazard on every consuming row", () => {
    const rows = rowsFrom([
      ["R1", "T", "G", "20", "9.5", "2015-01-15"],
      ["R2", "T", "G", "20", "9.2", "2025-01-15"],
    ]);
    const issues = rowIssues(rows, FULL_MAPPING, BASE_OPTS);
    const warnings = issues.filter((i) => i.message.includes("nominal-scantling-as-t-initial"));
    expect(warnings).toHaveLength(2); // both rows consume the mapped column
    for (const w of warnings) {
      expect(w.severity).toBe("warning"); // honored mapping never blocks (UI-07)
      expect(w.message).toContain("constant design scantling");
    }
  });

  it("a nominal-scantling t-previous mapping warns with the t-previous token", () => {
    const rows = rowsFrom([["R1", "T", "G", "20", "9.5", "2025-01-15"]]);
    const issues = rowIssues(
      rows,
      { ...FULL_MAPPING, tPrevious: "Original_Scantling_mm" },
      BASE_OPTS,
    );
    expect(
      issues.some((i) =>
        i.message.includes("nominal-scantling-as-t-previous ('Original_Scantling_mm')"),
      ),
    ).toBe(true);
  });

  it("a genuinely measured t-initial mapping emits NO scantling warning", () => {
    const rows = rowsFrom([["R1", "T", "G", "11.5", "9.5", "2025-01-15"]]);
    const issues = rowIssues(
      rows,
      { ...FULL_MAPPING, tInitial: "Initial_Thickness" },
      BASE_OPTS,
    );
    expect(issues.some((i) => i.message.includes("nominal-scantling"))).toBe(false);
  });
});

describe("validate — WR-07 regression: all-empty data records are never silently dropped", () => {
  it("',,' is a real RFC 4180 record: it reaches rowIssues and row numbering is preserved", () => {
    const csv = [
      "Reading_ID,Tank,Measured_Thickness_mm,Measurement_Date",
      "R1,T1,9.5,2025-01-15",
      ",,",
      "R3,T1,9.4,2025-01-15",
    ].join("\n");
    const { records } = tokenize(csv, ",");
    expect(records).toHaveLength(4); // header + 3 data records (the ',,' survives)
    const rows = buildParsedRows(records[0], records.slice(1));
    expect(rows.map((r) => r.row)).toEqual([1, 2, 3]);
    const issues = rowIssues(
      rows,
      { ...FULL_MAPPING, tInitial: null },
      BASE_OPTS,
    );
    // The empty record reports missing values on its own row number —
    // pre-fix the record vanished and every subsequent row number shifted.
    expect(issues.map((i) => i.message)).toContain("Row 2: Reading ID — missing value.");
    expect(issues.map((i) => i.message)).toContain("Row 2: Measured thickness — missing value.");
    // R3 stays Row 3 exactly as the user sees it in their file.
    expect(issues.map((i) => i.message)).not.toContain("Row 3: Reading ID — missing value.");
  });

  it("true blank lines and the trailing newline still never become phantom rows", () => {
    const csv = "Reading_ID,Measured_Thickness_mm\n9.5,1.0\n\n \n2.0,2.0\n";
    const { records } = tokenize(csv, ",");
    expect(records).toHaveLength(3); // header + 2 data records only
  });

  it("a quoted empty field is an explicit record and is kept (missing values surface)", () => {
    const csv = 'Reading_ID,Measured_Thickness_mm\n""\n';
    const { records } = tokenize(csv, ",");
    expect(records).toHaveLength(2);
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
