/**
 * Pure TypeScript Chart Geometry Math
 * 
 * Computes coordinate transformations, bounding boxes, and SVG path strings
 * for shared consumption by both interactive web components (HTML <svg>)
 * and certified PDF downloads (@react-pdf/renderer vector primitives).
 */

export interface TrendPoint {
  date: string;
  year: number;
  thicknessMm: number;
}

export interface TrendCurveGeometry {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  /** SVG Path string for historical readings polyline */
  historyPath: string;
  /** SVG Path string for projected degradation line */
  trajectoryPath: string;
  /** SVG Polygon path for uncertainty envelope (e.g. +/- 0.1mm) */
  uncertaintyPath: string;
  /** Coordinates of the t_required intercept point */
  interceptPoint: { x: number; y: number; year: number } | null;
  /** Y-coordinate of t_required horizontal line */
  tRequiredY: number;
  /** Axis ticks and labels */
  xTicks: Array<{ x: number; label: string }>;
  yTicks: Array<{ y: number; label: string }>;
  dataPoints: Array<{ x: number; y: number; readingId: string; thicknessMm: number }>;
}

export interface CmlHeatmapItem {
  cmlId: string;
  x: number;
  y: number;
  tActualMm: number;
  tRequiredMm: number;
  verdict: "accept" | "re_check" | "reject";
  crMmYr: number;
}

export interface CmlHeatmapGeometry {
  width: number;
  height: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  items: Array<
    CmlHeatmapItem & {
      pixelX: number;
      pixelY: number;
      color: string;
    }
  >;
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

/**
 * Calculates time-series wall loss velocity and degradation trajectory geometry.
 */
export function calcTrendCurveGeometry(
  points: TrendPoint[],
  tRequiredMm: number,
  crGoverningMmYr: number,
  gaugeUncertaintyMm = 0.1,
  width = 500,
  height = 240
): TrendCurveGeometry {
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };
  const plotWidth = Math.max(10, width - padding.left - padding.right);
  const plotHeight = Math.max(10, height - padding.top - padding.bottom);

  if (points.length === 0) {
    return {
      width,
      height,
      padding,
      historyPath: "",
      trajectoryPath: "",
      uncertaintyPath: "",
      interceptPoint: null,
      tRequiredY: padding.top + plotHeight / 2,
      xTicks: [],
      yTicks: [],
      dataPoints: [],
    };
  }

  const sortedPoints = [...points].sort((a, b) => a.year - b.year);
  const minYear = sortedPoints[0].year;
  const lastPoint = sortedPoints[sortedPoints.length - 1];
  const maxYear = lastPoint.year + 10;

  const minThickness = Math.min(tRequiredMm - 0.5, ...points.map((p) => p.thicknessMm));
  const maxThickness = Math.max(tRequiredMm + 1.0, ...points.map((p) => p.thicknessMm));
  const thicknessRange = Math.max(0.1, maxThickness - minThickness);
  const yearRange = Math.max(1, maxYear - minYear);

  const scaleX = (year: number) => padding.left + ((year - minYear) / yearRange) * plotWidth;
  const scaleY = (thickness: number) =>
    padding.top + plotHeight - ((thickness - minThickness) / thicknessRange) * plotHeight;

  // Historical path
  const dataPoints = sortedPoints.map((p, idx) => ({
    x: scaleX(p.year),
    y: scaleY(p.thicknessMm),
    readingId: `pt-${idx}`,
    thicknessMm: p.thicknessMm,
  }));

  const historyPath = dataPoints.reduce(
    (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
    ""
  );

  // Trajectory projection
  const startX = scaleX(lastPoint.year);
  const startY = scaleY(lastPoint.thicknessMm);
  const endYear = crGoverningMmYr > 0 ? lastPoint.year + (lastPoint.thicknessMm - tRequiredMm) / crGoverningMmYr : maxYear;
  const clampedEndYear = Math.min(maxYear, Math.max(minYear, endYear));
  const endX = scaleX(clampedEndYear);
  const endThickness = lastPoint.thicknessMm - crGoverningMmYr * (clampedEndYear - lastPoint.year);
  const endY = scaleY(endThickness);

  const trajectoryPath = `M ${startX} ${startY} L ${endX} ${endY}`;

  // Uncertainty envelope polygon
  const upperStartY = scaleY(lastPoint.thicknessMm + gaugeUncertaintyMm);
  const lowerStartY = scaleY(lastPoint.thicknessMm - gaugeUncertaintyMm);
  const upperEndY = scaleY(endThickness + gaugeUncertaintyMm);
  const lowerEndY = scaleY(endThickness - gaugeUncertaintyMm);

  const uncertaintyPath = `M ${startX} ${upperStartY} L ${endX} ${upperEndY} L ${endX} ${lowerEndY} L ${startX} ${lowerStartY} Z`;

  // Intercept point with t_required
  let interceptPoint: { x: number; y: number; year: number } | null = null;
  if (crGoverningMmYr > 0 && endYear <= maxYear) {
    interceptPoint = {
      x: scaleX(endYear),
      y: scaleY(tRequiredMm),
      year: Math.round(endYear * 10) / 10,
    };
  }

  const tRequiredY = scaleY(tRequiredMm);

  // Ticks
  const xTicks = [
    { x: scaleX(minYear), label: String(Math.floor(minYear)) },
    { x: scaleX(lastPoint.year), label: String(Math.floor(lastPoint.year)) },
    { x: scaleX(maxYear), label: String(Math.floor(maxYear)) },
  ];

  const yTicks = [
    { y: scaleY(minThickness), label: `${minThickness.toFixed(1)}mm` },
    { y: tRequiredY, label: `${tRequiredMm.toFixed(1)}mm (req)` },
    { y: scaleY(maxThickness), label: `${maxThickness.toFixed(1)}mm` },
  ];

  return {
    width,
    height,
    padding,
    historyPath,
    trajectoryPath,
    uncertaintyPath,
    interceptPoint,
    tRequiredY,
    xTicks,
    yTicks,
    dataPoints,
  };
}

/**
 * Calculates spatial piping severity heatmap coordinates and color mapping.
 */
export function calcCmlHeatmapGeometry(
  cmls: CmlHeatmapItem[],
  width = 600,
  height = 300
): CmlHeatmapGeometry {
  if (cmls.length === 0) {
    return {
      width,
      height,
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

  const padding = 30;
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  const items = cmls.map((cml) => {
    const pixelX = padding + ((cml.x - minX) / spanX) * (width - 2 * padding);
    const pixelY = padding + ((cml.y - minY) / spanY) * (height - 2 * padding);
    const color =
      cml.verdict === "reject"
        ? "#ef4444"
        : cml.verdict === "re_check"
        ? "#f59e0b"
        : "#10b981";

    return {
      ...cml,
      pixelX,
      pixelY,
      color,
    };
  });

  return {
    width,
    height,
    bounds: { minX, maxX, minY, maxY },
    items,
  };
}

/**
 * Calculates circular metric gauge arc and stroke offsets.
 */
export function calcMetricGaugeGeometry(
  value: number,
  min = 0,
  max = 100,
  size = 120,
  strokeWidth = 10
): MetricGaugeGeometry {
  const cx = size / 2;
  const cy = size / 2;
  const radius = cx - strokeWidth;
  const circumference = 2 * Math.PI * radius;

  const clampedVal = Math.max(min, Math.min(max, value));
  const percent = max > min ? ((clampedVal - min) / (max - min)) * 100 : 0;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  const color = percent < 25 ? "#ef4444" : percent < 50 ? "#f59e0b" : "#10b981";

  return {
    cx,
    cy,
    radius,
    strokeWidth,
    circumference,
    strokeDashoffset,
    percent,
    color,
  };
}
