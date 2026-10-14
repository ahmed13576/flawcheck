"use client";

import React, { useState } from "react";
import { MapPin, Activity, CheckCircle, AlertTriangle, AlertCircle } from "lucide-react";
import { calcCmlHeatmapGeometry, type CmlHeatmapItem } from "@/lib/analytics/geometry";

export interface CmlHeatmapProps {
  cmls: CmlHeatmapItem[];
  width?: number;
  height?: number;
  className?: string;
}

export function CmlHeatmap({
  cmls,
  width = 600,
  height = 300,
  className = "",
}: CmlHeatmapProps) {
  const [selectedCml, setSelectedCml] = useState<CmlHeatmapItem | null>(null);
  const geo = calcCmlHeatmapGeometry(cmls, width, height);

  const stats = {
    accept: cmls.filter((c) => c.verdict === "accept").length,
    re_check: cmls.filter((c) => c.verdict === "re_check").length,
    reject: cmls.filter((c) => c.verdict === "reject").length,
  };

  return (
    <div className={`p-4 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 ${className}`}>
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-sm tracking-wide">Spatial CML Severity Heatmap</h3>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5" /> Accept ({stats.accept})
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" /> Re-check ({stats.re_check})
          </span>
          <span className="flex items-center gap-1 text-red-400">
            <AlertCircle className="w-3.5 h-3.5" /> Reject ({stats.reject})
          </span>
        </div>
      </div>

      <div className="relative mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${geo.width} ${geo.height}`}
          className="w-full h-auto select-none motion-reduce:transition-none"
        >
          {/* Subtle background coordinate grid */}
          <rect
            x={10}
            y={10}
            width={geo.width - 20}
            height={geo.height - 20}
            fill="#0b1329"
            stroke="#1e293b"
            rx={6}
          />

          {/* Connection lines between sequential CMLs */}
          {geo.items.length > 1 && (
            <polyline
              points={geo.items.map((i) => `${i.pixelX},${i.pixelY}`).join(" ")}
              fill="none"
              stroke="#334155"
              strokeWidth={1.5}
              strokeDasharray="4,4"
            />
          )}

          {/* CML Nodes */}
          {geo.items.map((item) => {
            const isSelected = selectedCml?.cmlId === item.cmlId;
            return (
              <g
                key={item.cmlId}
                onClick={() => setSelectedCml(item)}
                className="cursor-pointer group"
              >
                <circle
                  cx={item.pixelX}
                  cy={item.pixelY}
                  r={isSelected ? 9 : 6}
                  fill={item.color}
                  stroke={isSelected ? "#ffffff" : "#0f172a"}
                  strokeWidth={2}
                  className="transition-all duration-200 group-hover:scale-125"
                />
                <text
                  x={item.pixelX}
                  y={item.pixelY - 10}
                  textAnchor="middle"
                  fill="#cbd5e1"
                  fontSize={8}
                  className="pointer-events-none select-none opacity-80 group-hover:opacity-100"
                >
                  {item.cmlId}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {selectedCml && (
        <div className="mt-3 p-2.5 bg-slate-800/80 rounded border border-slate-700 text-xs flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-sky-400" />
            <span className="font-semibold text-slate-200">{selectedCml.cmlId}</span>
            <span className="text-slate-400">
              t_act: {selectedCml.tActualMm.toFixed(2)}mm / t_req: {selectedCml.tRequiredMm.toFixed(2)}mm
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400">CR: {selectedCml.crMmYr.toFixed(3)} mm/yr</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                selectedCml.verdict === "reject"
                  ? "bg-red-900/60 text-red-300 border border-red-700"
                  : selectedCml.verdict === "re_check"
                  ? "bg-amber-900/60 text-amber-300 border border-amber-700"
                  : "bg-emerald-900/60 text-emerald-300 border border-emerald-700"
              }`}
            >
              {selectedCml.verdict}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
