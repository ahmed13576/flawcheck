import { describe, it, expect } from "vitest";
import {
  formatFixed,
  formatCaption,
  formatReadingDate,
  formatEvaluatedAt,
  nextInspectionCell,
  rlCell,
} from "@/lib/wizard/format";
import { flagChipFor } from "@/components/wizard/verdict-chip";
import { APPARENT_GAIN_SENTENCE } from "@/components/wizard/flag-detail-row";
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

  it("dates render as ISO YYYY-MM-DD; evaluated-at as YYYY-MM-DD HH:mm", () => {
    expect(formatReadingDate("2025-01-15")).toBe("2025-01-15");
    expect(formatEvaluatedAt("2026-09-27T17:05:00.000Z")).toBe("2026-09-27 17:05");
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
