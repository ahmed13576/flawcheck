"use client";

/**
 * VIS-03 — CML spatial severity heatmap (web).
 *
 * Renders the 2D layout grid of the inspected circuit from the pure
 * geometry engine: each cell is color-coded by the PRECOMPUTED verdict
 * (accept #16a34a / re_check #d97706 / reject #dc2626 — the engine banding,
 * never recomputed). Clicking a cell selects it and reports the CML identity
 * upward via onSelect so the host table can highlight the row; a plain-DOM
 * tooltip surfaces CML ID, measured thickness, margin, and governing clause.
 * Motion utilities carry motion-reduce: variants (PDF-04).
 */
import React, { useState } from "react";
import { Activity, CheckCircle, AlertTriangle, AlertCircle } from "lucide-react";
import { calcCmlHeatmapGeometry, type CmlHeatmapItem } from "@/lib/analytics/geometry";

export interface CmlHeatmapProps {
  cmls: CmlHeatmapItem[];
  width?: number;
  height?: number;
  /** Governing code clause for the tooltip (display only — no invention). */
  governingClause?: string;
  /** Click/select relay for host-side table-row highlight. */
  onSelect?: (cml: CmlHeatmapItem | null) => void;
  /** Externally controlled selection (host-driven highlight). */
  selectedCmlId?: string | null;
  className?: string;
}

export function CmlHeatmap({
  cmls,
  width = 600,
  height = 300,
  governingClause = "API 570 §4.3 — thickness monitoring",
  onSelect,
  selectedCmlId = null,
  className = "",
}: CmlHeatmapProps) {
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const geo = calcCmlHeatmapGeometry(cmls, width, height);

  const selectedId = selectedCmlId ?? localSelected;
  const selected = cmls.find((c) => c.cmlId === selectedId) ?? null;
  const hoveredItem = geo.items.find((c) => c.cmlId === hovered) ?? null;

  const stats = {
    accept: cmls.filter((c) => c.verdict === "accept").length,
    re_check: cmls.filter((c) => c.verdict === "re_check").length,
    reject: cmls.filter((c) => c.verdict === "reject").length,
  };

  const choose = (item: CmlHeatmapItem | null) => {
    setLocalSelected((prev) => {
      const next = item === null || prev === item.cmlId ? null : item.cmlId;
      onSelect?.(next === null ? null : item);
      return next;
    });
  };

  return (
    <div
      className={`rounded-lg border border-border bg-card p-4 text-card-foreground ${className}`}
    >
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-accept" aria-hidden="true" />
          <h3 className="text-sm font-semibold tracking-wide">
            Spatial CML Severity Heatmap
          </h3>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1 text-accept">
            <CheckCircle className="size-3.5" aria-hidden="true" /> Accept ({stats.accept})
          </span>
          <span className="flex items-center gap-1 text-recheck">
            <AlertTriangle className="size-3.5" aria-hidden="true" /> Re-check ({stats.re_check})
          </span>
          <span className="flex items-center gap-1 text-fail">
            <AlertCircle className="size-3.5" aria-hidden="true" /> Fail ({stats.reject})
          </span>
        </div>
      </div>

      <div className="relative mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${geo.width} ${geo.height}`}
          role="img"
          aria-label={`Spatial severity heatmap of ${cmls.length} CML locations: ${stats.accept} accept, ${stats.re_check} re-check, ${stats.reject} fail`}
          className="w-full h-auto select-none"
        >
          {/* Cell fill backgrounds — the "spatial grid" */}
          {geo.items.map((item) => (
            <rect
              key={`cell-${item.cmlId}`}
              x={item.pixelX - geo.cellSize / 2}
              y={item.pixelY - geo.cellSize / 2}
              width={geo.cellSize}
              height={geo.cellSize}
              fill={item.color}
              opacity={0.25}
              stroke="#00000000"
              className="motion-reduce:transition-none"
            />
          ))}

          {/* CML nodes */}
          {geo.items.map((item) => {
            const isSelected = selectedId === item.cmlId;
            return (
              <g
                key={item.cmlId}
                onClick={() => choose(item)}
                onMouseEnter={() => setHovered(item.cmlId)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-pointer motion-reduce:transition-none"
              >
                <circle
                  cx={item.pixelX}
                  cy={item.pixelY}
                  r={isSelected ? 10 : 7}
                  fill={item.color}
                  stroke={isSelected ? "#ffffff" : "transparent"}
                  strokeWidth={2}
                  className="motion-reduce:transition-none"
                />
                <text
                  x={item.pixelX}
                  y={item.pixelY - geo.cellSize / 2 + 12}
                  textAnchor="middle"
                  fontSize={9}
                  className="fill-muted-foreground pointer-events-none select-none"
                >
                  {item.cmlId}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover tooltip — plain DOM, assertable in the node suite */}
        {hoveredItem ? (
          <div
            data-testid="heatmap-tooltip"
            role="status"
            className="pointer-events-none absolute z-10 rounded border border-border bg-background px-2 py-1 text-xs shadow"
          >
            <span className="font-semibold">{hoveredItem.cmlId}</span>
            {` — t_act ${hoveredItem.tActualMm.toFixed(2)} · t_req ${hoveredItem.tRequiredMm.toFixed(2)} · margin ${hoveredItem.marginPct.toFixed(1)}% · ${verdictCopy(hoveredItem.verdict)} · ${governingClause}`}
          </div>
        ) : null}
      </div>

      {/* Governing clause caption — always visible, citation composed by the host. */}
      <p className="mt-2 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
        Governing clause: {governingClause}
      </p>

      {/* Selected CML detail block */}
      {selected ? (
        <div
          data-testid="heatmap-selected"
          className="mt-3 flex items-center justify-between rounded border border-border bg-secondary/40 px-3 py-2 text-xs"
        >
          <span className="flex items-center gap-2">
            <span className="font-semibold">{selected.cmlId}</span>
            <span className="text-muted-foreground">
              t_act {selected.tActualMm.toFixed(2)} / t_req{" "}
              {selected.tRequiredMm.toFixed(2)}
            </span>
          </span>
          <span className="flex items-center gap-3">
            <span className="font-mono text-muted-foreground">
              {selected.crMmYr === null ? "CR —" : `CR ${selected.crMmYr.toFixed(3)} mm/yr`}
            </span>
            <span className="font-semibold uppercase">{verdictCopy(selected.verdict)}</span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => choose(null)}
            >
              Clear
            </button>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function verdictCopy(verdict: CmlHeatmapItem["verdict"]): string {
  return verdict === "accept" ? "ACCEPT" : verdict === "re_check" ? "RE-CHECK" : "FAIL";
}
