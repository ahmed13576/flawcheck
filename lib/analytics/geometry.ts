/**
 * Pure TypeScript chart geometry math — Phase 09 VIS-01.
 *
 * Every visual projection (trend curves, heatmaps, gauges) is computed here as
 * plain functions over precomputed numbers: coordinates, viewBox bounds,
 * scales, axis ticks, and SVG path strings (`d="M... L... Z"`). Zero DOM, zero
 * React, zero external chart dependencies (PDF-03) — the identical output is
 * consumed by:
 *   - interactive web components (components/analytics/*.tsx, HTML <svg>), and
 *   - certified PDF renderers (components/report/pdf-trend-curve.tsx and
 *     pdf-heatmap.tsx, @react-pdf/renderer vector primitives).
 *
 * Sovereignty: these functions only PROJECT values that lib/calc/evaluate.ts
 * already computed (thickness, t_required, governing CR). No engineering
 * number is ever derived here — geometry concerns only.
 *
 * Edge coverage (09-SPEC): CR = 0 (horizontal line, no intercept), CR < 0
 * (measurement anomaly — trajectory suppressed), single reading, t_actual
 * <= t_required (intercept already due — clamped to last survey year),
 * degenerate viewports (min plot clamps, no NaN/Infinity anywhere).
 */

export interface TrendPoint {
  /** ISO date string of the UT survey (e.g. "2023-04-15"). */
  date: string;
  /** Thickness measured at that date, mm. */
  thicknessMm: number;
}

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface AxisTick {
  /** Pixel coordinate of the tick along its axis. */
  x: number;
  y: number;
  label: string;
}

export interface TrendDataPoint {
  x: number;
  y: number;
  /** ISO date of the reading (echoed for hover tooltips). */
  date: string;
  thicknessMm: number;
}

export interface TrendCurveGeometry {
  width: number;
  height: number;
  padding: Padding;
  /** SVG path string for the historical readings polyline. */
  historyPath: string;
  /** SVG path string for the projected degradation line. */
  trajectoryPath: string;
  /** Dashed anomaly marker path (CR < 0) — empty string when none. */
  anomalyPath: string;
  /** SVG polygon path for the gauge-uncertainty envelope (± uncertainty). */
  uncertaintyPath: string;
  /** Exact t_required intercept point, or null when no crossing exists. */
  interceptPoint: { x: number; y: number; date: string } | null;
  /** Y pixel of the t_required horizontal limit line. */
  tRequiredY: number;
  xTicks: AxisTick[];
  yTicks: AxisTick[];
  /** Projected data points with pixel coordinates for interactive overlays. */
  dataPoints: TrendDataPoint[];
}

export interface CmlHeatmapItem {
  cmlId: string;
  /** Layout grid position (1-based cell coordinates). */
  x: number;
  y: number;
  tActualMm: number;
  tRequiredMm: number;
  verdict: "accept" | "re_check" | "reject";
  crMmYr: number | null;
}

export interface CmlHeatmapGeometry {
  width: number;
  height: number;
  /** Cell size in px after the uniform scale (max-dimensized fit). */
  cellSize: number;
  /** Data bounding box in layout cells. */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  items: Array<
    CmlHeatmapItem & {
      pixelX: number;
      pixelY: number;
      color: string;
      /** Safety margin percent above t_required (precomputed projection). */
      marginPct: number;
    }
  >;
}

export interface MetricGaugeGeometry {
  cx: number;
  cy: number;
  radius: number;
  strokeWidth: number;
  /** Full-circle stroke length (2·π·r) used as strokeDasharray. */
  circumference: number;
  /** strokeDashoffset that reveals the `percent` fraction of the arc. */
  strokeDashoffset: number;
  /** Clamped safety-margin percent (may be negative — never NaN). */
  percent: number;
  color: string;
}

const TICK_FRACTION = 1 / 6;

function safeNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Time-series wall-loss trend geometry (VIS-01/VIS-02/PDF-01).
 *
 * Accepts PRECOMPUTED thickness history + governing CR + t_required and
 * produces all path strings, scales, ticks, and the exact t_required
 * intercept. Pure — throws nothing, never yields NaN/Infinity.
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
  const firstDate = sorted[0].date;
  const last = sorted[sorted.length - 1];

  const toYear = (date: string): number => {
    const parsed = Date.parse(date);
    if (!Number.isNaN(parsed)) {
      // Fractional Gregorian years keep tick labels readable (e.g. 2025.21).
      return new Date(parsed).getUTCFullYear() + new Date(parsed).getUTCMonth() / 12;
    }
    const y = Number.parseFloat(date.slice(0, 4));
    return Number.isNaN(y) ? 0 : y;
  };

  const firstYear = toYear(firstDate);
  const lastYear = toYear(last.date);
  // Projection headroom: show 10 years of future degradation.
  const maxYear = lastYear + 10;
  const yearRange = Math.max(1, maxYear - firstYear);

  const finiteThicknesses = sorted
    .map((p) => p.thicknessMm)
    .filter((t) => Number.isFinite(t));
  const thicknessMin =
    finiteThicknesses.length > 0 ? Math.min(...finiteThicknesses) : tRequiredMm;
  const thicknessMax =
    finiteThicknesses.length > 0 ? Math.max(...finiteThicknesses) : tRequiredMm;
  const minThickness = Math.min(tRequiredMm - 0.5, thicknessMin);
  const maxThickness = Math.max(tRequiredMm + 1.0, thicknessMax);
  const thicknessRange = Math.max(0.1, maxThickness - minThickness);

  const scaleX = (year: number): number =>
    padding.left + ((year - firstYear) / yearRange) * plotWidth;
  const scaleY = (thickness: number): number =>
    padding.top + plotHeight - ((thickness - minThickness) / thicknessRange) * plotHeight;

  // Historical polyline.
  const dataPoints = sorted.map((p) => ({
    x: scaleX(toYear(p.date)),
    y: scaleY(safeNumber(p.thicknessMm, tRequiredMm)),
    date: p.date,
    thicknessMm: p.thicknessMm,
  }));
  const historyPath = dataPoints.reduce(
    (acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
    "",
  );

  const cr = Number.isFinite(crGoverningMmYr) ? crGoverningMmYr : 0;
  const startX = scaleX(lastYear);
  const startY = scaleY(last.thicknessMm);

  // Degradation projection + t_required intercept (VIS-02/PDF-01). The
  // intercept date resolves exactly where the trajectory crosses t_required:
  //   - future crossing: within the 10-year projection window;
  //   - t_actual <= t_required (immediate failure): clamped to the last
  //     survey date — the marker renders red AT today, never in the past
  //     beyond the data (SPEC edge "Immediate Failure");
  //   - CR <= 0: horizontal trajectory, no crossing exists (SPEC edges
  //     "Zero Corrosion" — indefinite; "Thickness Gain" — anomaly stub).
  let interceptDate: string | null = null;
  let endYear = maxYear;
  if (cr > 0) {
    const yearsToReq = (last.thicknessMm - tRequiredMm) / cr;
    if (Number.isFinite(yearsToReq)) {
      if (yearsToReq < 0) {
        // Already at/below t_required — intercept at the last survey.
        interceptDate = last.date;
        endYear = lastYear;
      } else if (yearsToReq <= maxYear - lastYear) {
        const crossYear = lastYear + yearsToReq;
        const crossYearInt = Math.floor(crossYear);
        const crossMonth = Math.min(11, Math.round((crossYear - crossYearInt) * 12));
        interceptDate = `${crossYearInt}-${String(crossMonth + 1).padStart(2, "0")}`;
        endYear = crossYear;
      }
    }
  }
  // Clamp the projected segment into the viewBox (never paints outside).
  endYear = Math.max(firstYear, Math.min(maxYear, endYear));
  const endX = scaleX(endYear);
  const rawEndThickness = last.thicknessMm - cr * (endYear - lastYear);
  // A negative CR projects thickness ABOVE the y-axis max — clamp the drawn
  // thickness into the scale domain so every coordinate stays inside bounds.
  const endThickness = Math.max(minThickness, Math.min(maxThickness, rawEndThickness));
  const endY = scaleY(endThickness);
  const trajectoryPath = `M ${startX} ${startY} L ${endX} ${endY}`;

  // Measurement-anomaly flag (thickness gain, CR < 0): dashed stub path.
  const anomalyPath = cr < 0 ? `M ${startX} ${startY} L ${endX} ${endY}` : "";

  // Gauge-uncertainty envelope: parallelogram around the projection (± u).
  const upperStartY = scaleY(last.thicknessMm + gaugeUncertaintyMm);
  const lowerStartY = scaleY(last.thicknessMm - gaugeUncertaintyMm);
  const upperEndY = scaleY(endThickness + gaugeUncertaintyMm);
  const lowerEndY = scaleY(endThickness - gaugeUncertaintyMm);
  const uncertaintyPath = `M ${startX} ${upperStartY} L ${endX} ${upperEndY} L ${endX} ${lowerEndY} L ${startX} ${lowerStartY} Z`;

  const tRequiredY = scaleY(tRequiredMm);

  const interceptPoint =
    interceptDate !== null
      ? { x: endX, y: tRequiredY, date: interceptDate }
      : null;

  // Ticks — first / middle / last of each axis.
  const midYear = firstYear + (maxYear - firstYear) * TICK_FRACTION * 3;
  const fmtYear = (y: number): string => String(Math.round(y));
  const xTicks: AxisTick[] = [
    { x: scaleX(firstYear), y: height - 10, label: fmtYear(firstYear) },
    { x: scaleX(midYear), y: height - 10, label: fmtYear(midYear) },
    { x: scaleX(maxYear), y: height - 10, label: fmtYear(maxYear) },
  ];
  const midThickness = minThickness + (maxThickness - minThickness) * 0.5;
  const fmtMm = (t: number): string => `${t.toFixed(1)}mm`;
  const yTicks: AxisTick[] = [
    { x: padding.left - 6, y: scaleY(minThickness), label: fmtMm(minThickness) },
    { x: padding.left - 6, y: scaleY(midThickness), label: fmtMm(midThickness) },
    { x: padding.left - 6, y: scaleY(maxThickness), label: fmtMm(maxThickness) },
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

/** Web heatmap palette (VIS-03) — distinct from the PDF-compact palette. */
export const CML_VERDICT_COLORS = {
  accept: "#16a34a",
  re_check: "#d97706",
  reject: "#dc2626",
} as const;

/**
 * CML spatial severity heatmap geometry (VIS-03/PDF-02).
 *
 * Layout cells (x, y in 1-based grid coordinates) scale uniformly so every
 * cell stays square; the grid is centered in the viewBox. Margins clamp to
 * ±200% (only |margin| beyond that saturates the gauge band colors — VIS-04
 * parity). Registers > 100 locations: the caller may pass all — layout is
 * derived purely from cells and stays O(n).
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
  const bounds = {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
  const spanX = Math.max(1, bounds.maxX - bounds.minX + 1);
  const spanY = Math.max(1, bounds.maxY - bounds.minY + 1);

  // Uniform cell size keeps cells square (no distortion) — the smaller of
  // width/height fits, the larger axis is centered.
  const cellSize = Math.max(4, Math.floor(Math.min(width / spanX, height / spanY)));
  const offsetX = (width - spanX * cellSize) / 2;
  const offsetY = (height - spanY * cellSize) / 2;

  const items = cmls.map((cml) => {
    const marginMm = cml.tActualMm - cml.tRequiredMm;
    const marginPct =
      cml.tRequiredMm > 0 ? safeNumber((marginMm / cml.tRequiredMm) * 100, 0) : 0;
    const pixelX = offsetX + (cml.x - bounds.minX) * cellSize + cellSize / 2;
    const pixelY = offsetY + (cml.y - bounds.minY) * cellSize + cellSize / 2;
    const color = CML_VERDICT_COLORS[cml.verdict] ?? CML_VERDICT_COLORS.accept;
    return { ...cml, pixelX, pixelY, color, marginPct };
  });

  return { width, height, cellSize, bounds, items };
}

/**
 * Circular safety-margin gauge geometry (VIS-04) — plan-name:
 * `calcGaugeGeometry(currentMm, tRequiredMm, tNominalMm, radius)`.
 *
 * `percent` is the precomputed safety margin ((t_actual − t_required) /
 * t_required × 100). The arc shows the |clamped| value (a gauge cannot paint
 * a negative fraction of a circle); the COLOR carries the sign: negative
 * margins render red at zero fill. Acceptance band: ≥ 20% green, 0–20%
 * amber, < 0% red (09-CONTEXT decision on gauge banding). `tNominalMm`
 * bounds the reference circumference end-stop (gauge saturates at nominal).
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

  const refMm = tNominalMm > tRequiredMm ? tNominalMm : tRequiredMm + 1;
  const rawPercent =
    refMm > 0 ? safeNumber(((currentMm - tRequiredMm) / (refMm - tRequiredMm)) * 100, 0) : 0;
  const percent = safeNumber(rawPercent, 0);
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
