"use client";

import React from "react";
import { Gauge, ShieldCheck, AlertTriangle } from "lucide-react";
import { calcMetricGaugeGeometry } from "@/lib/analytics/geometry";

export interface MetricGaugeProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function MetricGauge({
  label,
  value,
  min = 0,
  max = 100,
  unit = "%",
  size = 120,
  strokeWidth = 10,
  className = "",
}: MetricGaugeProps) {
  const geo = calcMetricGaugeGeometry(value, min, max, size, strokeWidth);

  return (
    <div
      className={`flex flex-col items-center justify-center p-3 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 ${className}`}
    >
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90 select-none">
          {/* Background circle */}
          <circle
            cx={geo.cx}
            cy={geo.cy}
            r={geo.radius}
            stroke="#1e293b"
            strokeWidth={geo.strokeWidth}
            fill="none"
          />
          {/* Animated value arc */}
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
            className="transition-all duration-700 ease-out motion-reduce:transition-none"
          />
        </svg>

        {/* Center metric display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold tracking-tight text-slate-100">
            {Math.round(value)}
            <span className="text-xs font-normal text-slate-400 ml-0.5">{unit}</span>
          </span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5 flex items-center gap-1">
            {geo.percent >= 50 ? (
              <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
            )}
            Margin
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-slate-300">
        <Gauge className="w-3.5 h-3.5 text-sky-400" />
        <span>{label}</span>
      </div>
    </div>
  );
}
