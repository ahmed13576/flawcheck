"use client";

import React from "react";
import { TrendingDown, AlertTriangle, Calendar, Info } from "lucide-react";
import { calcTrendCurveGeometry, type TrendPoint } from "@/lib/analytics/geometry";

export interface TrendCurveProps {
  points: TrendPoint[];
  tRequiredMm: number;
  crGoverningMmYr: number;
  gaugeUncertaintyMm?: number;
  width?: number;
  height?: number;
  className?: string;
}

export function TrendCurve({
  points,
  tRequiredMm,
  crGoverningMmYr,
  gaugeUncertaintyMm = 0.1,
  width = 500,
  height = 240,
  className = "",
}: TrendCurveProps) {
  const geo = calcTrendCurveGeometry(
    points,
    tRequiredMm,
    crGoverningMmYr,
    gaugeUncertaintyMm,
    width,
    height
  );

  return (
    <div className={`p-4 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 ${className}`}>
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-sky-400" />
          <h3 className="font-semibold text-sm tracking-wide">Wall Loss Velocity & Degradation Curve</h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" /> Historical Readings
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> t_required Intercept
          </span>
        </div>
      </div>

      <div className="relative mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${geo.width} ${geo.height}`}
          className="w-full h-auto select-none motion-reduce:transition-none"
        >
          {/* Grid lines and ticks */}
          {geo.yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={geo.padding.left}
                y1={tick.y}
                x2={geo.width - geo.padding.right}
                y2={tick.y}
                stroke="#334155"
                strokeDasharray="2,2"
                strokeWidth={0.75}
              />
              <text x={geo.padding.left - 6} y={tick.y + 3} textAnchor="end" fill="#94a3b8" fontSize={9}>
                {tick.label}
              </text>
            </g>
          ))}

          {/* Uncertainty envelope */}
          {geo.uncertaintyPath && (
            <path d={geo.uncertaintyPath} fill="#0284c7" opacity={0.15} className="transition-opacity" />
          )}

          {/* t_required limit line */}
          <line
            x1={geo.padding.left}
            y1={geo.tRequiredY}
            x2={geo.width - geo.padding.right}
            y2={geo.tRequiredY}
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="4,4"
          />

          {/* Degradation trajectory projection */}
          {geo.trajectoryPath && (
            <path
              d={geo.trajectoryPath}
              stroke="#38bdf8"
              strokeWidth={2}
              strokeDasharray="3,3"
              fill="none"
              className="animate-pulse"
            />
          )}

          {/* Historical measurements line */}
          {geo.historyPath && (
            <path
              d={geo.historyPath}
              stroke="#0284c7"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
            />
          )}

          {/* Historical data points */}
          {geo.dataPoints.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={4}
              fill="#38bdf8"
              stroke="#0f172a"
              strokeWidth={1.5}
              className="cursor-pointer hover:scale-125 transition-transform"
            />
          ))}

          {/* Intercept marker */}
          {geo.interceptPoint && (
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
                x={geo.interceptPoint.x}
                y={geo.interceptPoint.y - 10}
                textAnchor="middle"
                fill="#fca5a5"
                fontSize={10}
                fontWeight="bold"
              >
                t_req: {geo.interceptPoint.year}
              </text>
            </g>
          )}

          {/* X-axis labels */}
          {geo.xTicks.map((tick, i) => (
            <text key={i} x={tick.x} y={geo.height - 10} textAnchor="middle" fill="#94a3b8" fontSize={9}>
              {tick.label}
            </text>
          ))}
        </svg>
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>Projected CR: {crGoverningMmYr.toFixed(3)} mm/yr</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          <span>Uncertainty: ±{gaugeUncertaintyMm.toFixed(2)} mm</span>
        </div>
      </div>
    </div>
  );
}
