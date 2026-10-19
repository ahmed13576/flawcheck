"use client";

/**
 * VIS-02 — animated wall-loss velocity & degradation trend curve (web).
 *
 * Consumes ONLY the pure geometry from lib/analytics/geometry.ts: every
 * coordinate, path string, and tick is projected there from precomputed
 * evaluate() values — this component derives no engineering number.
 *
 * Motion: the history line draws in via GPU-accelerated stroke-dashoffset
 * CSS; `motion-reduce:animate-none motion-reduce:transition-none` (PDF-04)
 * renders the final state immediately under prefers-reduced-motion: reduce.
 */
import React, { useState } from "react";
import { TrendingDown, Calendar, Info, ShieldAlert } from "lucide-react";
import { calcTrendCurveGeometry, type TrendPoint } from "@/lib/analytics/geometry";

export interface TrendCurveProps {
  points: TrendPoint[];
  tRequiredMm: number;
  crGoverningMmYr: number;
  gaugeUncertaintyMm?: number;
  width?: number;
  height?: number;
  /** Unit suffix for the metadata form (display only). */
  unit?: string;
  className?: string;
}

const DRAW_DURATION_S = 1.2;

export function TrendCurve({
  points,
  tRequiredMm,
  crGoverningMmYr,
  gaugeUncertaintyMm = 0.1,
  width = 500,
  height = 240,
  unit = "mm",
  className = "",
}: TrendCurveProps) {
  const [hover, setHover] = useState<number | null>(null);
  const geo = calcTrendCurveGeometry(
    points,
    tRequiredMm,
    crGoverningMmYr,
    gaugeUncertaintyMm,
    width,
    height,
  );

  // Line-draw animation: dash length covers the longest path; the negative
  // offset slides the visible window along. Reduced motion renders the full
  // path instantly (animate-none below).
  const drawLength = width + height;
  const isAnomaly = crGoverningMmYr < 0;
  const hovered = hover !== null ? geo.dataPoints[hover] : null;
  const previous = hover !== null && hover > 0 ? geo.dataPoints[hover - 1] : null;
  const delta =
    hovered && previous ? hovered.thicknessMm - previous.thicknessMm : null;

  return (
    <div
      className={`rounded-lg border border-border bg-card p-4 text-card-foreground ${className}`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <TrendingDown className="size-5 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold tracking-wide">
            Wall Loss Velocity &amp; Degradation Curve
          </h3>
        </div>
        {isAnomaly ? (
          <span className="flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
            <ShieldAlert className="size-3.5" aria-hidden="true" />
            Measurement anomaly — thickness gain
          </span>
        ) : null}
      </div>

      <div className="relative mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${geo.width} ${geo.height}`}
          role="img"
          aria-label={`Thickness trend chart: ${points.length} readings, governing corrosion rate ${crGoverningMmYr.toFixed(3)} mm per year, required thickness ${tRequiredMm.toFixed(2)} mm`}
          className="w-full h-auto select-none"
        >
          {/* Y-axis ticks + grid lines */}
          {geo.yTicks.map((tick, i) => (
            <g key={`y-${i}`}>
              <line
                x1={geo.padding.left}
                y1={tick.y}
                x2={geo.width - geo.padding.right}
                y2={tick.y}
                stroke="currentColor"
                className="text-border"
                strokeDasharray="2,2"
                strokeWidth={0.75}
              />
              <text
                x={tick.x}
                y={tick.y + 3}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize={9}
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Uncertainty envelope (± gauge uncertainty) */}
          {geo.uncertaintyPath ? (
            <path
              d={geo.uncertaintyPath}
              fill="currentColor"
              className="text-primary"
              opacity={0.12}
            />
          ) : null}

          {/* t_required retirement limit line */}
          <line
            x1={geo.padding.left}
            y1={geo.tRequiredY}
            x2={geo.width - geo.padding.right}
            y2={geo.tRequiredY}
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="4,4"
          />
          <text
            x={geo.width - geo.padding.right}
            y={geo.tRequiredY - 4}
            textAnchor="end"
            fill="#ef4444"
            fontSize={9}
          >
            t_required
          </text>

          {/* Degradation trajectory projection (dashed) */}
          {geo.trajectoryPath ? (
            <path
              d={geo.trajectoryPath}
              stroke="#f87171"
              strokeWidth={2}
              strokeDasharray="3,3"
              fill="none"
              className="motion-reduce:transition-none"
            />
          ) : null}

          {/* Historical measurements — line-draw animation (GPU compositor) */}
          {geo.historyPath ? (
            <path
              d={geo.historyPath}
              stroke="#0284c7"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={drawLength}
              strokeDashoffset={0}
              style={
                {
                  animation: `trend-draw ${DRAW_DURATION_S}s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                  "--trend-draw-length": drawLength,
                } as React.CSSProperties
              }
              className="trend-draw-animated motion-reduce:animate-none"
            />
          ) : null}

          {/* Historical data points with hover targets */}
          {geo.dataPoints.map((pt, i) => (
            <g key={`pt-${i}`}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={hover === i ? 6 : 4}
                fill="#0284c7"
                stroke="#ffffff"
                strokeWidth={1.5}
                className="cursor-pointer motion-reduce:transition-none"
              />
              <circle
                cx={pt.x}
                cy={pt.y}
                r={12}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                role="button"
                aria-label={`${pt.date}: ${pt.thicknessMm.toFixed(2)} ${unit}`}
              />
            </g>
          ))}

          {/* t_required intercept marker (remaining-life boundary) */}
          {geo.interceptPoint ? (
            <g>
              <circle
                cx={geo.interceptPoint.x}
                cy={geo.interceptPoint.y}
                r={6}
                fill="#ef4444"
                stroke="#fecaca"
                strokeWidth={2}
              />
              <text
                x={Math.min(geo.interceptPoint.x, geo.width - geo.padding.right - 40)}
                y={Math.max(geo.interceptPoint.y - 10, 12)}
                textAnchor="middle"
                fill="#ef4444"
                fontSize={10}
                fontWeight="bold"
              >
                t_req: {geo.interceptPoint.date}
              </text>
            </g>
          ) : null}

          {/* X-axis labels */}
          {geo.xTicks.map((tick, i) => (
            <text
              key={`x-${i}`}
              x={tick.x}
              y={tick.y}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize={9}
            >
              {tick.label}
            </text>
          ))}
        </svg>

        {/* Hover tooltip — plain DOM so the jsdom suite can assert content */}
        {hovered ? (
          <div
            data-testid="trend-tooltip"
            role="status"
            className="pointer-events-none absolute z-10 rounded border border-border bg-background px-2 py-1 text-xs shadow"
            style={{ left: `${(hovered.x / geo.width) * 100}%`, top: 0 }}
          >
            <span className="font-mono">{hovered.date}</span>
            {": "}
            <span className="font-mono font-semibold">
              {hovered.thicknessMm.toFixed(2)} {unit}
            </span>
            {delta !== null ? (
              <span className="font-mono text-muted-foreground">
                {" "}
                ({delta >= 0 ? "+" : ""}
                {delta.toFixed(2)})
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Calendar className="size-3.5" aria-hidden="true" />
          Projected CR: {crGoverningMmYr.toFixed(3)} {unit}/yr
        </span>
        <span className="flex items-center gap-1.5">
          <Info className="size-3.5" aria-hidden="true" />
          Uncertainty: ±{gaugeUncertaintyMm.toFixed(2)} {unit}
        </span>
      </div>
    </div>
  );
}
