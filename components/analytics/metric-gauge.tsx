"use client";

/**
 * VIS-04 — animated circular safety-margin gauge (web).
 *
 * The arc reveals the PRECOMPUTED safety-margin percent via an animated
 * strokeDashoffset (GPU-accelerated transform-free paint). The color band
 * carries the code semantics: ≥ 20% margin green, 0–20% amber, < 0% red —
 * the banding is computed in the geometry engine, never here. All motion
 * utilities include motion-reduce: variants so prefers-reduced-motion
 * renders the final state immediately (PDF-04).
 */
import React from "react";
import { Gauge, ShieldCheck, AlertTriangle, ShieldAlert } from "lucide-react";
import { calcGaugeGeometry } from "@/lib/analytics/geometry";

export interface MetricGaugeProps {
  label: string;
  /** Precomputed thickness measurement (t_actual), mm. */
  currentMm: number;
  /** Precomputed required thickness (t_required), mm. */
  tRequiredMm: number;
  /** Nominal thickness — the gauge's 100% reference, mm. */
  tNominalMm: number;
  /** Governing corrosion velocity for the sub-caption, mm/yr. */
  crMmYr?: number | null;
  radius?: number;
  className?: string;
}

export function MetricGauge({
  label,
  currentMm,
  tRequiredMm,
  tNominalMm,
  crMmYr = null,
  radius = 40,
  className = "",
}: MetricGaugeProps) {
  const geo = calcGaugeGeometry(currentMm, tRequiredMm, tNominalMm, radius);
  const size = radius * 2 + geo.strokeWidth * 2;
  const negative = geo.percent < 0;

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-border bg-card p-3 text-card-foreground ${className}`}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          role="img"
          aria-label={`${label}: ${geo.percent.toFixed(1)}% safety margin`}
          className="select-none -rotate-90 motion-reduce:transition-none"
        >
          {/* Background track */}
          <circle
            cx={geo.cx}
            cy={geo.cy}
            r={geo.radius}
            stroke="currentColor"
            className="text-border"
            strokeWidth={geo.strokeWidth}
            fill="none"
          />
          {/* Animated value arc — dashoffset transition on mount */}
          <circle
            cx={geo.cx}
            cy={geo.cy}
            r={geo.radius}
            stroke={geo.color}
            strokeWidth={geo.strokeWidth}
            fill="none"
            strokeDasharray={geo.circumference}
            strokeDashoffset={geo.strokeDashoffset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none motion-reduce:animate-none"
          />
        </svg>

        {/* Center metric display */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-bold tracking-tight">
            {geo.percent.toFixed(0)}
            <span className="ml-0.5 text-xs font-normal text-muted-foreground">%</span>
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {negative ? (
              <ShieldAlert className="size-2.5 text-fail" aria-hidden="true" />
            ) : geo.percent >= 50 ? (
              <ShieldCheck className="size-2.5 text-accept" aria-hidden="true" />
            ) : (
              <AlertTriangle className="size-2.5 text-recheck" aria-hidden="true" />
            )}
            Margin
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
        <Gauge className="size-3.5 text-primary" aria-hidden="true" />
        <span>{label}</span>
      </div>
      {crMmYr !== null ? (
        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          CR {crMmYr.toFixed(3)} mm/yr
        </div>
      ) : null}
    </div>
  );
}
