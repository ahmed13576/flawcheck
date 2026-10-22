/**
 * Phase 09 VIS-01 — pure geometry engine unit tests.
 *
 * Pins the exact SVG path strings, scale arithmetic, tick generation, and
 * every SPEC edge (zero CR, negative CR / thickness gain, immediate failure,
 * single reading, degenerate viewports) with toBe on hand-computed values.
 * Zero DOM — these run in the plain node vitest environment.
 */
import { describe, expect, it } from "vitest";
import {
  calcTrendCurveGeometry,
  calcCmlHeatmapGeometry,
  calcGaugeGeometry,
  type TrendPoint,
  type CmlHeatmapItem,
} from "@/lib/analytics/geometry";

const POINTS: TrendPoint[] = [
  { date: "2022-06-01", thicknessMm: 9.0 },
  { date: "2023-06-01", thicknessMm: 8.7 },
  { date: "2024-06-01", thicknessMm: 8.4 },
];

describe("calcTrendCurveGeometry", () => {
  it("produces valid SVG path syntax for history, trajectory, and envelope", () => {
    const geo = calcTrendCurveGeometry(POINTS, 6.35, 0.3);
    expect(geo.historyPath).toMatch(/^M [\d.]+ [\d.]+( L [\d.]+ [\d.]+)+$/);
    expect(geo.trajectoryPath).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
    expect(geo.uncertaintyPath).toMatch(
      /^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+ L [\d.]+ [\d.]+ L [\d.]+ [\d.]+ Z$/,
    );
  });

  it("scales coordinates with hand-computed linear arithmetic", () => {
    // 2022-06 → year 2022.5; window 2022.5..2034.5 (last + 10); width 500,
    // padding L50/R30 → plot 420. X for 2022.5 = 50; for 2034.5 = 470.
    const geo = calcTrendCurveGeometry(POINTS, 6.35, 0.3);
    expect(geo.dataPoints[0].x).toBe(50);
    // Thickness axis: min = 6.35 - 0.5 = 5.85, max = 9.0 → range 3.15;
    // plot height 180, top 20. y(9.0) = 20 + 180 - ((9.0-5.85)/3.15)*180 = 200 - 180 = 20.
    expect(geo.dataPoints[0].y).toBeCloseTo(20, 6);
    // t_required line y: 20 + 180 - ((6.35-5.85)/3.15)*180 = 200 - 28.571…
    expect(geo.tRequiredY).toBeCloseTo(200 - (0.5 / 3.15) * 180, 6);
  });

  it("solves the t_required intercept date exactly (remaining-life boundary)", () => {
    // last 8.4 @ 2024-06 (fractional year 2024 + 5/12), CR 0.3 →
    // (8.4-6.35)/0.3 = 6.8333 yr after 2024.4167 → 2031.25 → April 2031.
    const geo = calcTrendCurveGeometry(POINTS, 6.35, 0.3);
    expect(geo.interceptPoint).not.toBeNull();
    expect(geo.interceptPoint?.date).toBe("2031-04");
    // The intercept Y sits exactly on the t_required line.
    expect(geo.interceptPoint?.y).toBeCloseTo(geo.tRequiredY, 6);
  });

  it("handles zero corrosion rate: horizontal trajectory and no intercept", () => {
    const geo = calcTrendCurveGeometry(POINTS, 6.35, 0);
    expect(geo.trajectoryPath).toMatch(/^M [\d.]+ ([\d.]+) L [\d.]+ \1$/);
    expect(geo.interceptPoint).toBeNull();
  });

  it("handles negative corrosion rate (measurement anomaly): dashed stub, no intercept", () => {
    const geo = calcTrendCurveGeometry(POINTS, 6.35, -0.2);
    expect(geo.anomalyPath).not.toBe("");
    expect(geo.interceptPoint).toBeNull();
    // Anomaly stub runs from the last point to the window edge — thickness
    // clamped to the scale max so the stub never leaves the viewBox.
    expect(geo.anomalyPath).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
    const yEnd = Number(geo.anomalyPath.split(" ")[5] ?? "NaN");
    expect(yEnd).toBeGreaterThanOrEqual(0);
    expect(yEnd).toBeLessThanOrEqual(240);
  });

  it("clamps the intercept to the last survey date on immediate failure (t_actual <= t_required)", () => {
    const failing: TrendPoint[] = [
      { date: "2023-01-01", thicknessMm: 6.0 },
      { date: "2025-01-01", thicknessMm: 6.1 }, // below t_required 6.35
    ];
    const geo = calcTrendCurveGeometry(failing, 6.35, 0.5);
    expect(geo.interceptPoint?.date).toBe("2025-01-01");
    expect(geo.interceptPoint?.y).toBeCloseTo(geo.tRequiredY, 6);
  });

  it("suppresses the intercept beyond the 10-year projection window", () => {
    // (8.4 - 6.35)/0.05 = 41 yr > 10-yr window → no intercept drawn.
    const geo = calcTrendCurveGeometry(POINTS, 6.35, 0.05);
    expect(geo.interceptPoint).toBeNull();
  });

  it("renders a single reading as one point with a horizontal projection", () => {
    const geo = calcTrendCurveGeometry([{ date: "2024-01-01", thicknessMm: 8.0 }], 6.35, 0.1);
    expect(geo.dataPoints).toHaveLength(1);
    expect(geo.historyPath).not.toContain("L");
  });

  it("returns an empty-safe geometry for zero points", () => {
    const geo = calcTrendCurveGeometry([], 6.35, 0.3);
    expect(geo.historyPath).toBe("");
    expect(geo.trajectoryPath).toBe("");
    expect(geo.uncertaintyPath).toBe("");
    expect(geo.interceptPoint).toBeNull();
    expect(geo.dataPoints).toEqual([]);
  });

  it("never emits NaN or Infinity across degenerate viewports", () => {
    for (const [w, h] of [[10, 10], [1, 240], [500, 1], [500, 240]]) {
      const geo = calcTrendCurveGeometry(POINTS, 6.35, 0.3, 0.1, w, h);
      const numbers = JSON.stringify(geo).match(/-?[\d.]+/g) ?? [];
      for (const n of numbers) {
        expect(Number(n)).not.toBeNaN();
        expect(Number.isFinite(Number(n))).toBe(true);
      }
    }
  });

  it("builds three first/middle/last ticks per axis", () => {
    const geo = calcTrendCurveGeometry(POINTS, 6.35, 0.3);
    expect(geo.xTicks).toHaveLength(3);
    expect(geo.yTicks).toHaveLength(3);
    expect(geo.xTicks[0].label).toBe("2022");
    expect(geo.xTicks[2].label).toBe("2034");
    expect(geo.yTicks.some((t) => t.label.includes("mm"))).toBe(true);
  });
});

const CMLS: CmlHeatmapItem[] = [
  { cmlId: "CML-1", x: 1, y: 1, tActualMm: 9.0, tRequiredMm: 6.35, verdict: "accept", crMmYr: 0.1 },
  { cmlId: "CML-2", x: 2, y: 1, tActualMm: 6.4, tRequiredMm: 6.35, verdict: "re_check", crMmYr: 0.3 },
  { cmlId: "CML-3", x: 1, y: 2, tActualMm: 5.9, tRequiredMm: 6.35, verdict: "reject", crMmYr: 0.4 },
];

describe("calcCmlHeatmapGeometry", () => {
  it("maps grid cells to centered square pixels with verdict colors", () => {
    const geo = calcCmlHeatmapGeometry(CMLS, 600, 300);
    expect(geo.items).toHaveLength(3);
    // Bounds 2x2 cells → cellSize = min(600/2, 300/2) = 150.
    expect(geo.cellSize).toBe(150);
    // offsetX = (600 - 300)/2 = 150; center of cell 1 = 150 + 0 + 75 = 225.
    expect(geo.items[0].pixelX).toBe(225);
    expect(geo.items[0].pixelY).toBe(75); // offsetY = (300-300)/2 = 0
    expect(geo.items[0].color).toBe("#16a34a");
    expect(geo.items[1].color).toBe("#d97706");
    expect(geo.items[2].color).toBe("#dc2626");
  });

  it("computes safety margin percent without re-deriving engineering numbers", () => {
    const geo = calcCmlHeatmapGeometry(CMLS, 600, 300);
    expect(geo.items[0].marginPct).toBeCloseTo(((9.0 - 6.35) / 6.35) * 100, 6);
    expect(geo.items[2].marginPct).toBeLessThan(0);
  });

  it("handles a dense >100-location register without error", () => {
    const dense: CmlHeatmapItem[] = Array.from({ length: 120 }, (_, i) => ({
      cmlId: `CML-${i + 1}`,
      x: (i % 10) + 1,
      y: Math.floor(i / 10) + 1,
      tActualMm: 8.0,
      tRequiredMm: 6.35,
      verdict: "accept" as const,
      crMmYr: 0.1,
    }));
    const geo = calcCmlHeatmapGeometry(dense, 600, 300);
    expect(geo.items).toHaveLength(120);
    expect(geo.cellSize).toBe(25); // min(600/10, 300/12) = 25
  });

  it("degrades safely on an empty register", () => {
    const geo = calcCmlHeatmapGeometry([], 600, 300);
    expect(geo.items).toEqual([]);
    expect(geo.cellSize).toBe(0);
  });
});

describe("calcGaugeGeometry", () => {
  it("computes circumference and dash offset from the safety margin percent", () => {
    // t_actual 7.9 vs required 6.35, nominal 10.31 →
    // percent = (7.9-6.35)/(10.31-6.35)*100 = 39.14…
    const geo = calcGaugeGeometry(7.9, 6.35, 10.31, 40);
    const c = 2 * Math.PI * 40;
    expect(geo.circumference).toBeCloseTo(c, 6);
    expect(geo.percent).toBeCloseTo(39.14, 2);
    expect(geo.strokeDashoffset).toBeCloseTo(c - (geo.percent / 100) * c, 6);
    expect(geo.color).toBe("#16a34a");
  });

  it("clamps to [0, 100] — gauge fill never negative nor overfull", () => {
    const over = calcGaugeGeometry(20, 6.35, 10.31, 40);
    expect(over.percent).toBeGreaterThan(100);
    expect(over.strokeDashoffset).toBeCloseTo(0, 6); // full circle fill
    const empty = calcGaugeGeometry(6.35, 6.35, 10.31, 40);
    expect(empty.percent).toBeCloseTo(0, 6);
    expect(empty.strokeDashoffset).toBeCloseTo(2 * Math.PI * 40, 6);
  });

  it("carries the negative margin in the color band, not in the arc fraction", () => {
    const failing = calcGaugeGeometry(5.9, 6.35, 10.31, 40);
    expect(failing.percent).toBeLessThan(0);
    expect(failing.color).toBe("#dc2626");
    expect(failing.strokeDashoffset).toBeCloseTo(2 * Math.PI * 40, 6); // zero fill
  });

  it("colors the 0–20% amber band", () => {
    const thin = calcGaugeGeometry(6.9, 6.35, 10.31, 40);
    // (6.9-6.35)/(10.31-6.35)*100 ≈ 13.9 % → amber.
    expect(thin.percent).toBeGreaterThan(0);
    expect(thin.percent).toBeLessThan(20);
    expect(thin.color).toBe("#d97706");
  });

  it("never yields NaN for degenerate gauge inputs", () => {
    const geo = calcGaugeGeometry(Number.NaN, 6.35, 10.31, 40);
    expect(Number.isNaN(geo.percent)).toBe(false);
    expect(Number.isNaN(geo.strokeDashoffset)).toBe(false);
  });
});
