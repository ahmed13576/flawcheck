/**
 * Pure TypeScript Chart Geometry Math — Phase 09 VIS-01
 *
 * Computes coordinate transformations, bounding boxes, scales, ticks, and SVG
 * path strings for shared consumption by interactive web components
 * (components/analytics/*) and certified PDF downloads
 * (components/report/pdf-* via @react-pdf/renderer vector primitives).
 *
 * Invariants:
 *  - Pure TypeScript, zero DOM, zero external chart dependencies (PDF-03).
 *  - Projects PRECOMPUTED values only (from lib/calc evaluate() results);
 *    no engineering arithmetic is performed here (per AGENTS.md).
 *  - Never emits NaN/Infinity; clamps all drawn geometry into the scale domain.
 */

export interface TrendPoint {
  date: string; // ISO date string
  thicknessMm: number;
}

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Tick {
  /** Pixel coordinate along the axis (same value as x for xTicks, y for yTicks). */
  pos: number;
  /** Pixel X coordinate of the tick/label. */
  x: number;
  /** Pixel Y coordinate of the tick/label. */
  y: number;
  label: string;
}

export interface TrendCurveGeometry {
  width: number;
  height: number;
  padding: Padding;
  /** SVG path string for historical readings polyline */
  historyPath: string;
  /** SVG path string for projected degradation line */
  trajectoryPath: string;
  /** Dashed anomaly marker path (CR < 0) — empty string when none. */
  anomalyPath: string;
  /** SVG polygon path for uncertainty envelope (e.g. +/- 0.1mm) */
  uncertaintyPath: string;
  /** Coordinates of the t_required intercept point */
  interceptPoint: { x: number; y: number; date: string } | null;
  /** Y-coordinate of t_required horizontal line */
  tRequiredY: number;
  xTicks: Tick[];
  yTicks: Tick[];
  dataPoints: Array<{ x: number; y: number; date: string; thicknessMm: number }>;
}

export interface CmlHeatmapItem {
  cmlId: string;
  x: number;
  y: number;
  tActualMm: number;
  tRequiredMm: number;
  verdict: "accept" | "re_check" | "reject";
  /** Governing corrosion rate (null when history is insufficient). */
  crMmYr: number | null;
}

export interface CmlHeatmapGeometry {
  width: number;
  height: number;
  /** Uniform square cell size in pixels (0 when there are no items). */
  cellSize: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  items: Array<CmlHeatmapItem & { pixelX: number; pixelY: number; color: string; marginPct: number }>;
}

export interface MetricGaugeGeometry {
  cx: number;
  cy: number;
  radius: number;
  strokeWidth: number;
  circumference: number;
  strokeDashoffset: number;
  percent: number;
  color: string;
}

/** Sanitize to a finite number, clamping NaN/Infinity to a fallback. */
function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/** Round to fixed decimals without float noise. */
function round(value: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

/**
 * Parse an ISO date (YYYY-MM-DD or full ISO timestamp) to a fractional year.
 * Month m maps to (m - 1) / 12 of a year elapsed since Jan 1 of that year,
 * so 2024-06 maps to 2024 + 5/12.
 */
function parseFractionalYear(date: string): number {
  const m = /^(\d{4})-(\d{2})/.exec(date);
  if (!m) return NaN;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  return year + (month - 1) / 12;
}

/**
 * Calculates time-series wall loss velocity and degradation trajectory geometry.
 * Pure: deterministic given (points, tRequiredMm, crGoverningMmYr, u, w, h).
 */
export function calcTrendCurveGeometry(
  points: TrendPoint[],
  tRequiredMm: number,
  crGoverningMmYr: number,
  gaugeUncertaintyMm = 0.1,
  width = 500,
  height = 240,
): TrendCurveGeometry {
  const padding: Padding = { top: 20, right: 30, bottom: 40, left: 50 };
  const plotWidth = Math.max(10, width - padding.left - padding.right);
  const plotHeight = Math.max(10, height - padding.top - padding.bottom);

  // Degenerate/safe defaults for hostile inputs.
  const tReq = finite(tRequiredMm, 0);
  const cr = finite(crGoverningMmYr, 0);
  const u = finite(gaugeUncertaintyMm, 0);

  if (points.length === 0) {
    return {
      width,
      height,
      padding,
      historyPath: "",
      trajectoryPath: "",
      anomalyPath: "",
      uncertaintyPath: "",
      interceptPoint: null,
      tRequiredY: padding.top + plotHeight / 2,
      xTicks: [],
      yTicks: [],
      dataPoints: [],
    };
  }

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const firstYear = finite(parseFractionalYear(sorted[0].date), 0);
  const last = sorted[sorted.length - 1];
  const lastYear = finite(parseFractionalYear(last.date), firstYear + 1);

  // Projection window extends 10 years beyond the last survey.
  const windowEnd = lastYear + 10;
  const yearRange = Math.max(1, windowEnd - firstYear);
  const thicknesses = sorted.map((p) => finite(p.thicknessMm, tReq));
  const minT = Math.min(tReq - 0.5, ...thicknesses);
  const maxT = Math.max(tReq + 1, ...thicknesses);
  const tRange = Math.max(0.1, maxT - minT);

  const scaleX = (year: number) =>
    padding.left + ((year - firstYear) / yearRange) * plotWidth;
  const scaleY = (t: number) =>
    padding.top + plotHeight - ((finite(t, tReq) - minT) / tRange) * plotHeight;

  const dataPoints = sorted.map((p) => ({
    x: round(scaleX(parseFractionalYear(p.date)), 2),
    y: round(scaleY(finite(p.thicknessMm, tReq)), 2),
    date: p.date,
    thicknessMm: finite(p.thicknessMm, tReq),
  }));

  const historyPath = dataPoints.reduce(
    (acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
    "",
  );

  const lastPoint = dataPoints[dataPoints.length - 1];
  const startX = lastPoint.x;
  const startY = lastPoint.y;

  // Degradation projection + t_required intercept (VIS-02/PDF-01). The
  // intercept date resolves exactly where the trajectory crosses t_required:
  //   - future crossing: within the 10-year projection window;
  //   - t_actual <= t_required (immediate failure): clamped to the last
  //     survey date — the marker renders red AT today (SPEC "Immediate
  //     Failure" edge);
  //   - CR <= 0: horizontal trajectory, no crossing exists (SPEC edges
  //     "Zero Corrosion" — indefinite; "Thickness Gain" — anomaly stub).
  let interceptDate: string | null = null;
  let endYear = windowEnd;
  if (cr > 0) {
    const yearsToReq = (last.thicknessMm - tReq) / cr;
    if (Number.isFinite(yearsToReq)) {
      if (yearsToReq < 0) {
        // Already at/below t_required — intercept at the last survey date.
        interceptDate = last.date;
        endYear = lastYear;
      } else if (yearsToReq <= windowEnd - lastYear) {
        const crossYear = lastYear + yearsToReq;
        const crossYearInt = Math.floor(crossYear);
        const crossMonth = Math.min(11, Math.round((crossYear - crossYearInt) * 12));
        interceptDate = `${crossYearInt}-${String(crossMonth + 1).padStart(2, "0")}`;
        endYear = crossYear;
      }
    }
  }
  // Clamp the projected segment into the viewBox (never paints outside).
  endYear = Math.max(firstYear, Math.min(windowEnd, endYear));
  const endX = round(scaleX(endYear), 2);
  const rawEndThickness = last.thicknessMm - cr * (endYear - lastYear);
  // A negative CR projects thickness ABOVE the y-axis max — clamp the drawn
  // thickness into the scale domain so every coordinate stays inside bounds.
  const endThickness = Math.max(minT, Math.min(maxT, rawEndThickness));
  const endY = round(scaleY(endThickness), 2);
  const trajectoryPath = `M ${startX} ${startY} L ${endX} ${endY}`;

  // Measurement-anomaly flag (thickness gain, CR < 0): dashed stub path.
  const anomalyPath = cr < 0 ? `M ${startX} ${startY} L ${endX} ${endY}` : "";

  // Gauge-uncertainty envelope: parallelogram around the projection (± u).
  const uTopStart = round(scaleY(last.thicknessMm + u), 2);
  const uTopEnd = round(scaleY(endThickness + u), 2);
  const uBotStart = round(scaleY(last.thicknessMm - u), 2);
  const uBotEnd = round(scaleY(endThickness - u), 2);
  const uncertaintyPath = `M ${startX} ${uTopStart} L ${endX} ${uTopEnd} L ${endX} ${uBotEnd} L ${startX} ${uBotStart} Z`;

  // Unrounded — callers needing pixel-grid alignment may round for display.
  const tRequiredY = scaleY(tReq);

  const interceptPoint =
    interceptDate !== null
      ? { x: endX, y: tRequiredY, date: interceptDate }
      : null;

  // Ticks — first / middle / last of each axis.
  const midYear = firstYear + (windowEnd - firstYear) * 0.5;
  const fmtYear = (y: number): string => String(Math.round(y));
  const xTicks: Tick[] = [
    { pos: round(scaleX(firstYear), 2), x: round(scaleX(firstYear), 2), y: height - 10, label: fmtYear(firstYear) },
    { pos: round(scaleX(midYear), 2), x: round(scaleX(midYear), 2), y: height - 10, label: fmtYear(midYear) },
    { pos: round(scaleX(windowEnd), 2), x: round(scaleX(windowEnd), 2), y: height - 10, label: fmtYear(windowEnd) },
  ];
  const midThickness = minT + (maxT - minT) * 0.5;
  const fmtMm = (t: number): string => `${t.toFixed(1)}mm`;
  const yTicks: Tick[] = [
    { pos: round(scaleY(minT), 2), x: padding.left - 6, y: round(scaleY(minT), 2), label: fmtMm(minT) },
    { pos: round(scaleY(midThickness), 2), x: padding.left - 6, y: round(scaleY(midThickness), 2), label: fmtMm(midThickness) },
    { pos: round(scaleY(maxT), 2), x: padding.left - 6, y: round(scaleY(maxT), 2), label: fmtMm(maxT) },
  ];

  return {
    width,
    height,
    padding,
    historyPath,
    trajectoryPath,
    anomalyPath,
    uncertaintyPath,
    interceptPoint,
    tRequiredY,
    xTicks,
    yTicks,
    dataPoints,
  };
}

/**
 * Phase 09 fan-plot input — one limiting CML's full (date, thickness)
 * history plus its precomputed t_required and governing corrosion rate.
 * Produced by buildLimitingSeries (lib/analytics/adapters.ts); every value
 * flows through VERBATIM from lib/calc output.
 *
 * (Interfaces placed beside TrendPoint so adapters.ts can import them
 * without a cycle: geometry.ts imports nothing from the adapters.)
 */
export interface FanSeries {
  cmlId: string;
  points: TrendPoint[];
  tRequiredMm: number;
  /** Governing rate (null/<= 0 → horizontal projection, no intercept). */
  governingRateMmYr: number | null;
}

/** One series' projected geometry on the fan plot's SHARED scales. */
export interface FanPlotSeriesGeometry {
  cmlId: string;
  color: string;
  /** SVG polyline through the series' historical readings. */
  historyPath: string;
  /** SVG projected degradation segment ("" when the series has no points). */
  trajectoryPath: string;
  /** Circle-marker coordinates for the historical readings. */
  dataPoints: Array<{ x: number; y: number }>;
  /** Where this series' projection crosses its own t_required (if ever). */
  interceptPoint: { x: number; y: number; date: string } | null;
  tRequiredMm: number;
  /** Pixel Y of this series' t_required retirement limit. */
  tRequiredY: number;
}

/**
 * The RE-CHECK guardband (t_required .. t_required + gauge uncertainty) for
 * one DISTINCT t_required value — deduplicated across series.
 */
export interface FanPlotBand {
  tRequiredMm: number;
  /** Pixel Y of the band's top edge (t_required + gauge = ACCEPT boundary). */
  yTop: number;
  /** Pixel Y of the band's bottom edge (t_required = FAIL boundary). */
  yBottom: number;
}

export interface FanPlotGeometry {
  width: number;
  height: number;
  padding: Padding;
  /** Per-series paths/markers, all mapped by the ONE shared scale pair. */
  series: FanPlotSeriesGeometry[];
  /** Distinct t_required reference bands (amber guardband + dashed limit). */
  bands: FanPlotBand[];
  xTicks: Tick[];
  yTicks: Tick[];
}

/**
 * Fan-plot series palette (plan 09-01): the heatmap's three severity hues for
 * the 1st/2nd/3rd limiting CML, then two slate neutrals — the report's
 * existing grey family — for the 4th/5th. Indexed by limiting rank so the
 * five series stay distinguishable even when every CML shares a disposition.
 */
const FAN_SERIES_COLORS: readonly string[] = [
  "#dc2626",
  "#d97706",
  "#16a34a",
  "#475569",
  "#94a3b8",
];

/**
 * Calculates the multi-CML degradation fan on ONE shared thickness axis and
 * ONE shared date axis (plan 09-01 Task 2). calcTrendCurveGeometry is wrong
 * for this: it derives its y-domain from ONE series' own t_required and its
 * x-domain from ONE series' first date — five calls yield five incompatible
 * scales. Here the shared y-domain spans every series' thicknesses AND every
 * series' t_required; the shared x-domain runs from the earliest first survey
 * to the latest last survey plus the same 10-year projection window the trend
 * curve uses. Pure and hostile-input safe, mirroring the trend-curve edge
 * conventions (immediate failure clamps to the last survey; CR <= 0 projects
 * horizontal with no intercept).
 */
export function calcFanPlotGeometry(
  series: FanSeries[],
  width = 470,
  height = 200,
  gaugeUncertaintyMm = 0.1,
): FanPlotGeometry {
  const padding: Padding = { top: 20, right: 30, bottom: 40, left: 50 };
  const plotWidth = Math.max(10, width - padding.left - padding.right);
  const plotHeight = Math.max(10, height - padding.top - padding.bottom);
  const u = finite(gaugeUncertaintyMm, 0);

  const empty: FanPlotGeometry = {
    width,
    height,
    padding,
    series: [],
    bands: [],
    xTicks: [],
    yTicks: [],
  };
  if (series.length === 0) return empty;

  // ---- ONE shared y-domain: every thickness AND every t_required ----
  let minT = Number.POSITIVE_INFINITY;
  let maxT = Number.NEGATIVE_INFINITY;
  for (const s of series) {
    const tReq = finite(s.tRequiredMm, 0);
    minT = Math.min(minT, tReq - 0.5);
    maxT = Math.max(maxT, tReq + 1);
    for (const p of s.points) {
      const t = finite(p.thicknessMm, tReq);
      minT = Math.min(minT, t);
      maxT = Math.max(maxT, t);
    }
  }
  const tRange = Math.max(0.1, maxT - minT);

  // ---- ONE shared x-domain: earliest first date .. latest last date + 10 yr ----
  let firstYear = Number.POSITIVE_INFINITY;
  let lastYear = Number.NEGATIVE_INFINITY;
  let anyPoints = false;
  for (const s of series) {
    if (s.points.length === 0) continue;
    anyPoints = true;
    const sorted = [...s.points].sort((a, b) => a.date.localeCompare(b.date));
    firstYear = Math.min(firstYear, finite(parseFractionalYear(sorted[0].date), 0));
    lastYear = Math.max(lastYear, finite(parseFractionalYear(sorted[sorted.length - 1].date), 0));
  }
  if (!anyPoints) {
    // No dated history at all: keep the bands (t_required lines still draw)
    // but no axis ticks — there is no date span to label.
    const scaleYBands = (t: number) => padding.top + plotHeight - ((t - minT) / tRange) * plotHeight;
    return {
      ...empty,
      bands: distinctBands(series, u, scaleYBands),
      series: series.map((s, i) => ({
        cmlId: s.cmlId,
        color: FAN_SERIES_COLORS[i % FAN_SERIES_COLORS.length],
        historyPath: "",
        trajectoryPath: "",
        dataPoints: [],
        interceptPoint: null,
        tRequiredMm: finite(s.tRequiredMm, 0),
        tRequiredY: scaleYBands(finite(s.tRequiredMm, 0)),
      })),
    };
  }
  const windowEnd = lastYear + 10;
  const yearRange = Math.max(1, windowEnd - firstYear);

  const scaleX = (year: number) => padding.left + ((year - firstYear) / yearRange) * plotWidth;
  const scaleY = (t: number) => padding.top + plotHeight - ((finite(t, minT) - minT) / tRange) * plotHeight;

  // ---- Per-series paths on the shared scales (trend-curve conventions) ----
  const out: FanPlotSeriesGeometry[] = series.map((s, i) => {
    const color = FAN_SERIES_COLORS[i % FAN_SERIES_COLORS.length];
    const tReq = finite(s.tRequiredMm, 0);
    const tRequiredY = scaleY(tReq);
    if (s.points.length === 0) {
      return {
        cmlId: s.cmlId,
        color,
        historyPath: "",
        trajectoryPath: "",
        dataPoints: [],
        interceptPoint: null,
        tRequiredMm: tReq,
        tRequiredY,
      };
    }

    const sorted = [...s.points].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1];
    const lastYearS = finite(parseFractionalYear(last.date), firstYear);
    const dataPoints = sorted.map((p) => ({
      // Module invariant: never emit NaN — an unparseable mid-series date
      // clamps to the domain start so the marker stays inside the scale.
      x: round(scaleX(finite(parseFractionalYear(p.date), firstYear)), 2),
      y: round(scaleY(finite(p.thicknessMm, tReq)), 2),
    }));
    const historyPath = dataPoints.reduce(
      (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
      "",
    );

    // Projection + t_required intercept — identical conventions to
    // calcTrendCurveGeometry, but against this series' OWN t_required.
    // A null governing rate (insufficient history) behaves like zero: a
    // horizontal projection with no intercept.
    const cr = finite(s.governingRateMmYr ?? 0, 0);
    let interceptDate: string | null = null;
    let endYear = windowEnd;
    if (cr > 0) {
      const yearsToReq = (last.thicknessMm - tReq) / cr;
      if (Number.isFinite(yearsToReq)) {
        if (yearsToReq < 0) {
          // Already at/below t_required — intercept at the last survey date.
          interceptDate = last.date;
          endYear = lastYearS;
        } else if (yearsToReq <= windowEnd - lastYearS) {
          const crossYear = lastYearS + yearsToReq;
          const crossYearInt = Math.floor(crossYear);
          const crossMonth = Math.min(11, Math.round((crossYear - crossYearInt) * 12));
          interceptDate = `${crossYearInt}-${String(crossMonth + 1).padStart(2, "0")}`;
          endYear = crossYear;
        }
      }
    }
    endYear = Math.max(firstYear, Math.min(windowEnd, endYear));
    const endX = round(scaleX(endYear), 2);
    const rawEndThickness = last.thicknessMm - cr * (endYear - lastYearS);
    const endThickness = Math.max(minT, Math.min(maxT, rawEndThickness));
    const endY = round(scaleY(endThickness), 2);
    const lastPoint = dataPoints[dataPoints.length - 1];
    const trajectoryPath = `M ${lastPoint.x} ${lastPoint.y} L ${endX} ${endY}`;

    return {
      cmlId: s.cmlId,
      color,
      historyPath,
      trajectoryPath,
      dataPoints,
      interceptPoint:
        interceptDate !== null ? { x: endX, y: round(tRequiredY, 2), date: interceptDate } : null,
      tRequiredMm: tReq,
      tRequiredY: round(tRequiredY, 2),
    };
  });

  // ---- Ticks: first/middle/last of each SHARED axis ----
  const midYear = firstYear + (windowEnd - firstYear) * 0.5;
  const fmtYear = (y: number): string => String(Math.round(y));
  const xTicks: Tick[] = [
    { pos: round(scaleX(firstYear), 2), x: round(scaleX(firstYear), 2), y: height - 10, label: fmtYear(firstYear) },
    { pos: round(scaleX(midYear), 2), x: round(scaleX(midYear), 2), y: height - 10, label: fmtYear(midYear) },
    { pos: round(scaleX(windowEnd), 2), x: round(scaleX(windowEnd), 2), y: height - 10, label: fmtYear(windowEnd) },
  ];
  const midThickness = minT + (maxT - minT) * 0.5;
  const fmtMm = (t: number): string => `${t.toFixed(1)}mm`;
  const yTicks: Tick[] = [
    { pos: round(scaleY(minT), 2), x: padding.left - 6, y: round(scaleY(minT), 2), label: fmtMm(minT) },
    { pos: round(scaleY(midThickness), 2), x: padding.left - 6, y: round(scaleY(midThickness), 2), label: fmtMm(midThickness) },
    { pos: round(scaleY(maxT), 2), x: padding.left - 6, y: round(scaleY(maxT), 2), label: fmtMm(maxT) },
  ];

  return {
    width,
    height,
    padding,
    series: out,
    bands: distinctBands(series, u, scaleY),
    xTicks,
    yTicks,
  };
}

/** Deduplicated t_required guardbands keyed at the lib/calc 6-dp convention. */
function distinctBands(
  series: FanSeries[],
  gaugeUncertaintyMm: number,
  scaleY: (t: number) => number,
): FanPlotBand[] {
  const seen = new Map<string, FanPlotBand>();
  for (const s of series) {
    const tReq = finite(s.tRequiredMm, 0);
    const key = tReq.toFixed(6);
    if (!seen.has(key)) {
      seen.set(key, {
        tRequiredMm: tReq,
        yTop: round(scaleY(tReq + gaugeUncertaintyMm), 2),
        yBottom: round(scaleY(tReq), 2),
      });
    }
  }
  return [...seen.values()];
}

/**
 * Calculates spatial piping severity heatmap coordinates and color mapping.
 * Colors: accept #16a34a, re_check #d97706, reject #dc2626.
 */
export function calcCmlHeatmapGeometry(
  cmls: CmlHeatmapItem[],
  width = 600,
  height = 300,
): CmlHeatmapGeometry {
  if (cmls.length === 0) {
    return {
      width,
      height,
      cellSize: 0,
      bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
      items: [],
    };
  }

  const xs = cmls.map((c) => c.x);
  const ys = cmls.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const spanX = Math.max(1, maxX - minX + 1);
  const spanY = Math.max(1, maxY - minY + 1);

  // Uniform square cells (no distortion); the smaller dimension governs fit
  // and the larger axis is centered in the viewBox. Dense registers (>100
  // locations) shrink cells instead of overflowing the viewBox.
  const cellSize = Math.max(4, Math.floor(Math.min(width / spanX, height / spanY)));
  const offsetX = (width - spanX * cellSize) / 2;
  const offsetY = (height - spanY * cellSize) / 2;

  const items = cmls.map((cml) => {
    const pixelX = round(offsetX + (cml.x - minX) * cellSize + cellSize / 2, 2);
    const pixelY = round(offsetY + (cml.y - minY) * cellSize + cellSize / 2, 2);
    const color =
      cml.verdict === "reject"
        ? "#dc2626"
        : cml.verdict === "re_check"
        ? "#d97706"
        : "#16a34a";

    return {
      ...cml,
      pixelX,
      pixelY,
      color,
      marginPct:
        cml.tRequiredMm > 0
          ? ((cml.tActualMm - cml.tRequiredMm) / cml.tRequiredMm) * 100
          : 0,
    };
  });

  return {
    width,
    height,
    cellSize,
    bounds: { minX, maxX, minY, maxY },
    items,
  };
}

/**
 * Calculates circular metric gauge arc and stroke offsets. `currentMm` is the
 * precomputed t_actual; `tRequiredMm` the precomputed t_required; the arc's
 * 100% reference is tNominalMm. `percent` may exceed [0, 100] (the raw
 * margin relative to nominal); the arc FILL is clamped to [0, 100] while the
 * COLOR carries the sign: negative margins render red at zero fill.
 * Bands: >= 20% green, 0-20% amber, < 0% red.
 */
export function calcGaugeGeometry(
  currentMm: number,
  tRequiredMm: number,
  tNominalMm: number,
  radius = 40,
): MetricGaugeGeometry {
  const strokeWidth = 10;
  const size = radius * 2 + strokeWidth * 2;
  const circumference = 2 * Math.PI * radius;

  const cur = finite(currentMm, tRequiredMm > 0 ? tRequiredMm : 0);
  const refMm = tNominalMm > tRequiredMm ? tNominalMm : tRequiredMm + 1;
  const rawPercent =
    refMm > tRequiredMm ? ((cur - tRequiredMm) / (refMm - tRequiredMm)) * 100 : 0;
  const percent = finite(rawPercent, 0);
  const fillPct = Math.max(0, Math.min(100, percent));
  const strokeDashoffset = circumference - (fillPct / 100) * circumference;

  const color = percent < 0 ? "#dc2626" : percent < 20 ? "#d97706" : "#16a34a";

  return {
    cx: size / 2,
    cy: size / 2,
    radius,
    strokeWidth,
    circumference,
    strokeDashoffset,
    percent,
    color,
  };
}
