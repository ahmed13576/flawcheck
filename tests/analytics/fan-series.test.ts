/**
 * Phase 09 fan-series adapter tests — buildLimitingSeries (lib/analytics/
 * adapters.ts): the limiting-CML selection (topCriticalCmls — historical
 * minimum first), per-CML date-ordered grouping, and VERBATIM pass-through
 * of the precomputed t_required / governing rate. Zero DOM — plain node
 * vitest environment.
 */
import { describe, expect, it } from "vitest";
import { buildLimitingSeries } from "@/lib/analytics/adapters";
import type { ReadingResult } from "@/lib/ingest/session";

function reading(overrides: Partial<ReadingResult> = {}): ReadingResult {
  return {
    readingId: "r-1",
    location: "North header",
    cml: "CML-A",
    date: "2025-01-15T00:00:00Z",
    tActualMm: 6.5,
    tPressureMm: 4.2,
    tStructuralMm: 6.35,
    tRequiredMm: 6.35,
    crLtMmYr: 0.3,
    crStMmYr: null,
    rawCrLtMmYr: 0.3,
    rawCrStMmYr: null,
    crGoverningMmYr: 0.3,
    rlYears: 12.4,
    nextInspection: null,
    flags: [],
    verdict: "accept",
    citations: ["api574_10_5_1_4"],
    ...overrides,
  };
}

describe("buildLimitingSeries", () => {
  it("selects the limiting CMLs in topCriticalCmls order (historical minimum first)", () => {
    const readings = [
      reading({ readingId: "a-1", cml: "CML-A", date: "2024-01-01", tActualMm: 10.0, verdict: "accept" }),
      reading({ readingId: "a-2", cml: "CML-A", date: "2025-01-01", tActualMm: 9.5, verdict: "accept" }),
      reading({ readingId: "b-1", cml: "CML-B", date: "2024-01-01", tActualMm: 8.0, verdict: "re_check" }),
      reading({ readingId: "b-2", cml: "CML-B", date: "2025-01-01", tActualMm: 7.0, verdict: "reject" }),
      reading({ readingId: "c-1", cml: "CML-C", date: "2025-01-01", tActualMm: 6.0, verdict: "reject" }),
    ];
    const series = buildLimitingSeries(readings, 2);
    expect(series.map((s) => s.cmlId)).toEqual(["CML-C", "CML-B"]); // 6.0 < 7.0 < 9.5
    // Full histories, date-ordered — the selection does NOT truncate points.
    expect(series[1].points.map((p) => p.date.slice(0, 10))).toEqual(["2024-01-01", "2025-01-01"]);
    expect(series[1].points.map((p) => p.thicknessMm)).toEqual([8.0, 7.0]);
  });

  it("passes each row's precomputed t_required and governing rate through VERBATIM", () => {
    const readings = [
      reading({ readingId: "x-1", cml: "CML-X", tActualMm: 5.9, tRequiredMm: 6.35, crGoverningMmYr: 0.42, verdict: "reject" }),
      reading({ readingId: "y-1", cml: "CML-Y", tActualMm: 5.5, tRequiredMm: 6.35, crGoverningMmYr: null, verdict: "reject" }),
    ];
    const [worst, second] = buildLimitingSeries(readings);
    expect(worst.cmlId).toBe("CML-Y"); // 5.5 < 5.9
    expect(worst.tRequiredMm).toBe(6.35);
    // A null governing rate floors to 0 at the CmlSummaryRow layer — the same
    // value the register prints in its Gov column.
    expect(worst.governingRateMmYr).toBe(0);
    expect(second.cmlId).toBe("CML-X");
    expect(second.governingRateMmYr).toBe(0.42);
  });

  it("groups by cml, falling back to location when cml is absent", () => {
    const readings = [
      reading({ readingId: "p-1", cml: undefined, location: "South manway", date: "2025-01-01", tActualMm: 6.0 }),
      reading({ readingId: "p-2", cml: undefined, location: "South manway", date: "2024-01-01", tActualMm: 6.2 }),
      reading({ readingId: "q-1", cml: "CML-Q", date: "2025-01-01", tActualMm: 6.8 }),
    ];
    const series = buildLimitingSeries(readings);
    expect(series.map((s) => s.cmlId)).toEqual(["South manway", "CML-Q"]);
    // Date ordering survives the location-identity grouping.
    expect(series[0].points.map((p) => p.date.slice(0, 10))).toEqual(["2024-01-01", "2025-01-01"]);
  });

  it("defaults to a five-series limiting slice and caps beyond it", () => {
    const readings = Array.from({ length: 7 }, (_, i) =>
      reading({
        readingId: `z-${i}`,
        cml: `CML-Z${i + 1}`,
        date: "2025-01-01",
        tActualMm: 6.0 + i, // later CMLs are THICKER → earlier ones are limiting
      }),
    );
    const series = buildLimitingSeries(readings);
    expect(series).toHaveLength(5);
    expect(series.map((s) => s.cmlId)).toEqual(["CML-Z1", "CML-Z2", "CML-Z3", "CML-Z4", "CML-Z5"]);
  });

  it("degrades to an empty series list for zero readings", () => {
    expect(buildLimitingSeries([])).toEqual([]);
  });
});
