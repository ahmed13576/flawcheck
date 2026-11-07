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
  calcFanPlotGeometry,
  calcCmlHeatmapGeometry,
  calcGaugeGeometry,
  type TrendPoint,
  type FanSeries,
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

/**
 * Two limiting series with DISJOINT value ranges and DISJOINT date spans —
 * the fixture that proves the fan plot's scales are SHARED. A per-series
 * domain (the calcTrendCurveGeometry behavior) would put series A on ~5..7mm
 * and series B on ~19..21mm; the fan must put BOTH on one 5..21mm axis and
 * one 2015..2031 date axis.
 */
const FAN_LOW: FanSeries = {
  cmlId: "CML-A",
  points: [
    { date: "2015-01-01", thicknessMm: 5.8 },
    { date: "2016-01-01", thicknessMm: 5.6 },
  ],
  tRequiredMm: 5.5,
  governingRateMmYr: 0.2,
};
const FAN_HIGH: FanSeries = {
  cmlId: "CML-B",
  points: [
    { date: "2020-01-01", thicknessMm: 19.9 },
    { date: "2021-01-01", thicknessMm: 19.6 },
  ],
  tRequiredMm: 19.85,
  governingRateMmYr: 0.3,
};

describe("calcFanPlotGeometry", () => {
  // Hand-computed shared domains for (FAN_LOW, FAN_HIGH) at 500x240:
  //   y: minT = 5.5-0.5 = 5.0, maxT = 19.85+1 = 20.85 (range 15.85)
  //   x: firstYear 2015.0 .. lastYear 2021.0 + 10-yr horizon = 2031.0
  //   padding {20,30,40,50} → plot 420x180; scaleX(y) = 50 + (y-2015)/16*420
  //                          scaleY(t) = 200 - (t-5.0)/15.85*180
  it("computes ONE shared y-domain covering both disjoint series ranges", () => {
    const geo = calcFanPlotGeometry([FAN_LOW, FAN_HIGH], 500, 240, 0.1);
    expect(geo.yTicks).toHaveLength(3);
    // Low tick at the shared floor (series A's tReq - 0.5), high tick at the
    // shared ceiling (series B's tReq + 1) — a per-series domain could not
    // produce both labels in ONE three-tick axis.
    expect(geo.yTicks.map((t) => t.label)).toEqual(["5.0mm", "12.9mm", "20.9mm"]);
  });

  it("computes ONE shared x-domain covering both date spans plus the 10-year horizon", () => {
    const geo = calcFanPlotGeometry([FAN_LOW, FAN_HIGH], 500, 240, 0.1);
    expect(geo.xTicks.map((t) => t.label)).toEqual(["2015", "2023", "2031"]);
    // First tick sits at the plot's left edge for series A's first survey.
    expect(geo.xTicks[0].x).toBe(50);
  });

  it("maps every series through the SAME scale pair", () => {
    const geo = calcFanPlotGeometry([FAN_LOW, FAN_HIGH], 500, 240, 0.1);
    const [a, b] = geo.series;
    // Series A's first point: x=scaleX(2015)=50, y=scaleY(5.8)=190.91…
    expect(a.dataPoints[0].x).toBe(50);
    expect(a.dataPoints[0].y).toBeCloseTo(200 - (0.8 / 15.85) * 180, 2);
    // Series B's first point: x=scaleX(2020)=181.25, y=scaleY(19.9)=30.79…
    expect(b.dataPoints[0].x).toBe(181.25);
    expect(b.dataPoints[0].y).toBeCloseTo(200 - (14.9 / 15.85) * 180, 2);
    // On one scale, A's LOW thickness sits ~160px BELOW B's high thickness.
    expect(a.dataPoints[0].y - b.dataPoints[0].y).toBeGreaterThan(150);
    expect(a.historyPath).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
    expect(b.historyPath).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
  });

  it("colors series by limiting rank: heatmap hues then slate neutrals, cycling", () => {
    const six: FanSeries[] = Array.from({ length: 6 }, (_, i) => ({
      ...FAN_LOW,
      cmlId: `CML-${i + 1}`,
    }));
    const geo = calcFanPlotGeometry(six, 500, 240, 0.1);
    expect(geo.series.map((s) => s.color)).toEqual([
      "#dc2626",
      "#d97706",
      "#16a34a",
      "#475569",
      "#94a3b8",
      "#dc2626", // 6th cycles back to the first hue
    ]);
  });

  it("deduplicates t_required bands and draws the gauge guardband around each", () => {
    const geo = calcFanPlotGeometry([FAN_LOW, FAN_HIGH], 500, 240, 0.1);
    expect(geo.bands).toHaveLength(2);
    const [lowBand, highBand] = [...geo.bands].sort((x, y) => x.tRequiredMm - y.tRequiredMm);
    // Band edges: yBottom = t_required line, yTop = t_required + gauge; a
    // HIGHER thickness always maps to a SMALLER pixel Y.
    expect(lowBand.yBottom).toBeCloseTo(200 - (0.5 / 15.85) * 180, 2);
    expect(lowBand.yTop).toBeCloseTo(200 - (0.6 / 15.85) * 180, 2);
    expect(lowBand.yTop).toBeLessThan(lowBand.yBottom);
    expect(highBand.tRequiredMm).toBe(19.85);
    expect(highBand.yTop).toBeLessThan(highBand.yBottom);
    // Same t_required on every series → ONE shared band.
    const twin = calcFanPlotGeometry(
      [FAN_LOW, { ...FAN_HIGH, tRequiredMm: 5.5 }],
      500,
      240,
      0.1,
    );
    expect(twin.bands).toHaveLength(1);
  });

  it("solves each series' t_required intercept with the trend-curve conventions", () => {
    const geo = calcFanPlotGeometry([FAN_LOW, FAN_HIGH], 500, 240, 0.1);
    const [a, b] = geo.series;
    // A: last 5.6 @2016, tReq 5.5, CR 0.2 → crosses 0.5 yr later → 2016-07.
    expect(a.interceptPoint?.date).toBe("2016-07");
    expect(a.interceptPoint?.x).toBeCloseTo(50 + (1.5 / 16) * 420, 2);
    expect(a.interceptPoint?.y).toBeCloseTo(a.tRequiredY, 2);
    // B: last 19.6 is ALREADY below tReq 19.85 → intercept clamped to the
    // last survey date, exactly the immediate-failure convention.
    expect(b.interceptPoint?.date).toBe("2021-01-01");
  });

  it("projects a zero/negative-rate series horizontally with no intercept", () => {
    const geo = calcFanPlotGeometry([
      { ...FAN_LOW, governingRateMmYr: 0 },
      { ...FAN_HIGH, governingRateMmYr: null },
    ], 500, 240, 0.1);
    for (const s of geo.series) {
      expect(s.interceptPoint).toBeNull();
      // Horizontal projection: the segment's end Y equals its start Y.
      const ys = s.trajectoryPath.split(" ").map(Number).filter((n) => !Number.isNaN(n));
      expect(ys[1]).toBeCloseTo(ys[3], 2);
    }
  });

  it("renders a single-point series as one marker with no polyline join", () => {
    const geo = calcFanPlotGeometry(
      [{ ...FAN_LOW, points: [{ date: "2015-06-01", thicknessMm: 5.8 }] }, FAN_HIGH],
      500,
      240,
      0.1,
    );
    expect(geo.series[0].historyPath).not.toContain("L");
    expect(geo.series[0].dataPoints).toHaveLength(1);
  });

  it("keeps a point-less series' t_required band and reference line on the shared axis", () => {
    const geo = calcFanPlotGeometry([{ ...FAN_HIGH, points: [] }, FAN_LOW], 500, 240, 0.1);
    expect(geo.series[0].historyPath).toBe("");
    expect(geo.series[0].trajectoryPath).toBe("");
    expect(geo.series[0].tRequiredY).toBeCloseTo(200 - (14.85 / 15.85) * 180, 2);
    // Both distinct t_required values still produce bands.
    expect(geo.bands).toHaveLength(2);
    // Date axis comes from the series that HAS points.
    expect(geo.xTicks.map((t) => t.label)).toEqual(["2015", "2021", "2026"]);
  });

  it("degrades safely on an empty series array", () => {
    const geo = calcFanPlotGeometry([], 500, 240, 0.1);
    expect(geo.series).toEqual([]);
    expect(geo.bands).toEqual([]);
    expect(geo.xTicks).toEqual([]);
    expect(geo.yTicks).toEqual([]);
  });

  it("never emits NaN or Infinity across degenerate viewports and hostile inputs", () => {
    const hostile: FanSeries[] = [
      { cmlId: "X", points: [], tRequiredMm: Number.NaN, governingRateMmYr: Number.NaN },
      {
        cmlId: "Y",
        points: [
          { date: "garbage", thicknessMm: Number.POSITIVE_INFINITY },
          { date: "2021-01-01", thicknessMm: 5.5 },
        ],
        tRequiredMm: 5.5,
        governingRateMmYr: Number.POSITIVE_INFINITY,
      },
      ...Array.from({ length: 2 }, (_, i) => ({
        ...FAN_LOW,
        cmlId: `Z${i}`,
        tRequiredMm: 5.5, // all-equal thicknesses → zero range fallback
        points: [{ date: "2015-01-01", thicknessMm: 5.5 }],
        governingRateMmYr: 0,
      })),
    ];
    for (const [w, h] of [[10, 10], [1, 240], [500, 1], [500, 240]]) {
      const geo = calcFanPlotGeometry(hostile, w, h, 0.1);
      const numbers = JSON.stringify(geo).match(/-?[\d.]+/g) ?? [];
      for (const n of numbers) {
        expect(Number(n)).not.toBeNaN();
        expect(Number.isFinite(Number(n))).toBe(true);
      }
      // JSON.stringify renders NaN/Infinity as `null`, which the digit scan
      // above would miss — check the numeric fields directly.
      for (const s of geo.series) {
        for (const pt of s.dataPoints) {
          expect(Number.isFinite(pt.x)).toBe(true);
          expect(Number.isFinite(pt.y)).toBe(true);
        }
        expect(Number.isFinite(s.tRequiredY)).toBe(true);
      }
      for (const b of geo.bands) {
        expect(Number.isFinite(b.yTop)).toBe(true);
        expect(Number.isFinite(b.yBottom)).toBe(true);
      }
    }
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
