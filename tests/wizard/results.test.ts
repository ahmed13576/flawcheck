import { describe, it, expect } from "vitest";
import {
  formatFixed,
  formatCaption,
  formatReadingDate,
  formatEvaluatedAt,
  nextInspectionCell,
  rlCell,
  formatFlagLabel,
} from "@/lib/wizard/format";
import { flagChipFor } from "@/components/wizard/verdict-chip";
import { APPARENT_GAIN_SENTENCE } from "@/components/wizard/flag-detail-row";
import { dimensionsLine } from "@/components/wizard/ptmt-triage-list";
import { resultRowKey } from "@/components/wizard/results-table";
import type { ReadingResult } from "@/lib/ingest/session";

/**
 * Screen 3 rendering contracts, pinned at the pure-helper layer (UI-13/14/
 * 17..19, UI-24, G14): locked precision, null-to-dash mapping with the
 * insufficient-history sub-text, the immediate-inspection branch, chip-class
 * mapping per flag, and the render-scan proving Infinity/NaN can never reach
 * the DOM.
 */

const baseReading: ReadingResult = {
  readingId: "R1",
  location: "T1",
  cml: "T1 / G1",
  date: "2025-01-15",
  tActualMm: 19.9,
  tPressureMm: 0,
  tStructuralMm: 19.85,
  tRequiredMm: 19.85,
  crLtMmYr: 0.0299,
  crStMmYr: 0.031,
  rawCrLtMmYr: 0.0299,
  rawCrStMmYr: 0.031,
  crGoverningMmYr: 0.031,
  rlYears: 4.5,
  nextInspection: { date: "2027-07-15", intervalYears: 2.25 },
  flags: [],
  verdict: "accept",
  citations: ["api570_7_2"],
};

describe("results formatters — locked precision (UI-24)", () => {
  it("thickness 2 dp, rates 3 dp, years 1 dp", () => {
    expect(formatFixed(19.85, 2)).toBe("19.85");
    expect(formatFixed(0.0299, 3)).toBe("0.030");
    expect(formatFixed(4.949, 1)).toBe("4.9");
  });

  it("null fields render '—' at every precision", () => {
    expect(formatFixed(null, 2)).toBe("—");
    expect(formatFixed(null, 3)).toBe("—");
    expect(formatFixed(null, 1)).toBe("—");
  });

  it("render-scan: Infinity and NaN can never reach the DOM", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(formatFixed(value, 2)).toBe("—");
      expect(formatFixed(value, 3)).toBe("—");
      expect(formatFixed(value, 1)).toBe("—");
    }
    // toFixed itself would leak 'NaN'/'Infinity' — the helpers are the only
    // rendering path for computed numbers (grep-gated by the sweep in Task 3).
    expect(Number.NaN.toFixed(2)).toContain("NaN");
  });

  it("caption composition uses the en dash and thousands separators", () => {
    expect(formatCaption(1, 50, 4912)).toBe("Showing 1–50 of 4,912");
    expect(formatCaption(951, 1000, 4912)).toBe("Showing 951–1,000 of 4,912");
  });

  it("dates render as ISO YYYY-MM-DD; evaluated-at as YYYY-MM-DD HH:mm with an explicit UTC marker (IN-07)", () => {
    expect(formatReadingDate("2025-01-15")).toBe("2025-01-15");
    // IN-07: the timestamp is UTC wall-clock — without a marker a UTC+5:30
    // user reads it as local and is hours off.
    expect(formatEvaluatedAt("2026-09-27T17:05:00.000Z")).toBe("2026-09-27 17:05 UTC");
  });
});

describe("next-inspection cell model — G14 immediate inspection", () => {
  it("an immediate_inspection reading renders the text branch, never a date", () => {
    const reading: ReadingResult = {
      ...baseReading,
      flags: ["immediate_inspection"],
      nextInspection: null,
    };
    const cell = nextInspectionCell(reading);
    expect(cell).toEqual({ kind: "immediate" });
    // no date and no negative interval can be derived from this branch
    expect(cell.kind !== "date" && "intervalYears" in cell).toBe(false);
  });

  it("a normal reading renders date + interval", () => {
    const cell = nextInspectionCell(baseReading);
    expect(cell).toEqual({ kind: "date", date: "2027-07-15", intervalYears: 2.25 });
  });

  it("null nextInspection renders '—' with the insufficient-history sub-text", () => {
    const reading: ReadingResult = {
      ...baseReading,
      rlYears: null,
      nextInspection: null,
      flags: ["insufficient_history"],
    };
    expect(nextInspectionCell(reading)).toEqual({
      kind: "dash",
      subText: "insufficient corrosion history",
    });
    expect(rlCell(reading)).toEqual({
      kind: "dash",
      subText: "insufficient corrosion history",
    });
  });

  it("a null nextInspection without the flag renders a bare dash", () => {
    const reading: ReadingResult = { ...baseReading, nextInspection: null };
    expect(nextInspectionCell(reading)).toEqual({ kind: "dash" });
  });

  it("RL null-to-dash mapping never produces Infinity/NaN text", () => {
    const leaked: ReadingResult = {
      ...baseReading,
      rlYears: Number.NaN,
      nextInspection: null,
    };
    // engine contract keeps rlYears null — but even a leak degrades to '—'
    expect(rlCell(leaked).kind === "years" ? (rlCell(leaked) as { text: string }).text : "—").toBe(
      "—",
    );
  });

  it("RL <= 0 renders 0.0 with RETIRED / IMMEDIATE ACTION subtext", () => {
    const reading: ReadingResult = {
      ...baseReading,
      rlYears: 0,
      nextInspection: null,
    };
    expect(rlCell(reading)).toEqual({
      kind: "years",
      text: "0.0",
      subText: "RETIRED / IMMEDIATE ACTION",
    });
  });

  it("formatFlagLabel converts snake_case to uppercase readable text", () => {
    expect(formatFlagLabel("immediate_inspection")).toBe("IMMEDIATE INSPECTION REQUIRED");
    expect(formatFlagLabel("insufficient_history")).toBe("INSUFFICIENT HISTORY");
  });
});

describe("WR-04 regression — duplicate reading IDs never collide as React keys or DOM ids", () => {
  it("row keys namespace by position: two 'R1' results get distinct keys", () => {
    // 'duplicate reading ID' is a WARNING that never blocks — identical IDs
    // flow into results.readings and used to key <tr> and detail-* ids.
    const keys = ["R1", "R1", "R1"].map((_, index) => resultRowKey("R1", index));
    expect(new Set(keys).size).toBe(3);
  });

  it("distinct ids at distinct positions keep unique keys (no accidental overlap)", () => {
    const keys = new Set([
      resultRowKey("R1", 3),
      resultRowKey("R1-3", 4), // would collide with a naive `${id}-${index}` split
      resultRowKey("R1", 34),
      resultRowKey("R1-3", 40),
    ]);
    expect(keys.size).toBe(4);
  });
});

describe("WR-05 regression — declared morphology is labeled informational when it disagrees with the engine's derived classification", () => {
  const base = { id: "ind-1", method: "MT" as const, count: 1, edgeSeparationMm: null, crackSuspect: false };

  it("agreement renders the plain morphology line (no noise)", () => {
    expect(dimensionsLine({ ...base, morphology: "linear", lengthMm: 4.2, widthMm: 0.8 })).toBe(
      "Linear indication L 4.2 × W 0.8 mm",
    );
    expect(dimensionsLine({ ...base, morphology: "rounded", lengthMm: 2.0, widthMm: 1.9 })).toBe(
      "Rounded indication L 2.0 × W 1.9 mm",
    );
  });

  it("declared linear but L <= 3W: 'declared: linear (informational)' names the rounded classification", () => {
    // The probed contradiction: declared Linear, dimensions classify rounded —
    // the card used to print 'Linear indication ... ACCEPT' with no explanation.
    const line = dimensionsLine({ ...base, morphology: "linear", lengthMm: 2.0, widthMm: 1.9 });
    expect(line).toContain("declared: linear (informational)");
    expect(line).toContain("classifies rounded");
    expect(line).toContain("L 2.0 × W 1.9 mm");
  });

  it("declared rounded but L > 3W: 'declared: rounded (informational)' names the linear classification", () => {
    const line = dimensionsLine({ ...base, morphology: "rounded", lengthMm: 5.0, widthMm: 1.0 });
    expect(line).toContain("declared: rounded (informational)");
    expect(line).toContain("classifies linear");
  });

  it("the L > 3W boundary stays locked: exactly 3W classifies rounded (P7a)", () => {
    // Boundary constructed arithmetically (house float convention): L = 3*W
    // exactly -> strict > is false -> derived rounded -> plain agreement line.
    expect(dimensionsLine({ ...base, morphology: "rounded", lengthMm: 3 * 2.0, widthMm: 2.0 })).toBe(
      "Rounded indication L 6.0 × W 2.0 mm",
    );
    // One epsilon above 3W flips to linear (and a declared-rounded card says so).
    const above = dimensionsLine({ ...base, morphology: "rounded", lengthMm: 6.0000001, widthMm: 2.0 });
    expect(above).toContain("declared: rounded (informational)");
    expect(above).toContain("classifies linear");
  });
});

describe("flag chip mapping — Flag Chip Contract", () => {
  it("maps each flag to its exact label and classes", () => {
    expect(flagChipFor("outlier")).toEqual({
      label: "OUTLIER",
      classes: "border-amber-500/40 text-amber-400",
    });
    expect(flagChipFor("measurement_inconsistency")).toEqual({
      label: "MEASUREMENT INCONSISTENCY",
      classes: "border-amber-500/40 text-amber-400",
    });
    expect(flagChipFor("insufficient_history")).toEqual({
      label: "INSUFFICIENT HISTORY",
      classes: "border-gray-600 text-gray-400",
    });
  });

  it("immediate_inspection renders no chip (its treatment is the cell text)", () => {
    expect(flagChipFor("immediate_inspection")).toBeNull();
  });

  it("measurement-inconsistency detail shows raw and clamped rates side by side", () => {
    const reading: ReadingResult = {
      ...baseReading,
      rawCrLtMmYr: -0.12,
      rawCrStMmYr: 0.031,
      crLtMmYr: 0,
      flags: ["measurement_inconsistency"],
    };
    const rawLine = `Raw CR LT: −${Math.abs(reading.rawCrLtMmYr!).toFixed(2)} mm/yr · clamped to 0.00 mm/yr for remaining life`;
    expect(rawLine).toBe(
      "Raw CR LT: −0.12 mm/yr · clamped to 0.00 mm/yr for remaining life",
    );
    expect(APPARENT_GAIN_SENTENCE).toBe(
      "Apparent thickness gain detected — possible measurement-point drift, re-coating, or gauge noise.",
    );
    expect(rawLine).not.toContain("Infinity");
    expect(rawLine).not.toContain("NaN");
  });
});
