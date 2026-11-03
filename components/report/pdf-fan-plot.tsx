/**
 * PDF-03 — Phase 09 fan plot: the limiting CMLs' degradation histories and
 * projections on ONE shared thickness axis and ONE shared date axis.
 *
 * Consumes the pure geometry engine (calcFanPlotGeometry in
 * lib/analytics/geometry.ts) and renders @react-pdf/renderer vector
 * primitives only (Svg, Path, Line, Circle, Rect, G, Text) — zero raster
 * bitmaps, zero DPI pixelation at any zoom. Hook-free by contract: the
 * tests/pdf walkers invoke component functions directly with no React
 * dispatcher, so a useState/useEffect here would throw there. Typography
 * inside the Svg is strictly standard Helvetica/Courier (no Font.register;
 * server-safe). SERVER module — no "use client".
 */
import React from "react";
import { Svg, Path, Line, Circle, Rect, G, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { FanPlotGeometry } from "@/lib/analytics/geometry";
/**
 * SVG <Text> typography helper. The renderer runtime reads fontSize and
 * fontFamily straight off the SVG element props (layout getFragments), but the
 * v4 TS overload narrows to SVGPresentationAttributes — this helper keeps the
 * narrowing honest at ONE site. Standard fonts only (Helvetica/Courier).
 */
type SvgTextProps = React.ComponentProps<typeof Text> & {
  fontSize: number;
  fontFamily: string;
};
const SvgText = ({ ...props }: SvgTextProps) => <Text {...(props as React.ComponentProps<typeof Text>)} />;

const styles = StyleSheet.create({
  container: { marginVertical: 6 },
  header: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 3 },
  caption: { fontSize: 7, fontFamily: "Courier", color: "#555555", marginTop: 2 },
  legend: { flexDirection: "row", flexWrap: "wrap", marginTop: 3 },
  legendItem: { flexDirection: "row", alignItems: "center", marginRight: 10 },
  swatch: { width: 9, height: 5, marginRight: 3 },
  legendText: { fontSize: 6.5, fontFamily: "Courier", color: "#333333" },
});

export interface PdfFanPlotProps {
  geometry: FanPlotGeometry;
  title?: string;
  /** Sub-caption line (e.g. horizon + governing-rate rule), display only. */
  caption?: string;
}

export function PdfFanPlot({
  geometry,
  title = "Limiting CML degradation fan",
  caption,
}: PdfFanPlotProps) {
  const plotW = geometry.width - geometry.padding.left - geometry.padding.right;
  const plotH = geometry.height - geometry.padding.top - geometry.padding.bottom;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{title}</Text>
      <Svg
        width={geometry.width}
        height={geometry.height}
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      >
        {/* Plot background */}
        <Rect
          x={geometry.padding.left}
          y={geometry.padding.top}
          width={plotW}
          height={plotH}
          fill="#f8fafc"
          stroke="#cbd5e1"
          strokeWidth={0.5}
        />

        {/* Y-axis ticks + grid lines */}
        {geometry.yTicks.map((tick, i) => (
          <G key={`y-${i}`}>
            <Line
              x1={geometry.padding.left}
              y1={tick.y}
              x2={geometry.width - geometry.padding.right}
              y2={tick.y}
              stroke="#e2e8f0"
              strokeWidth={0.5}
            />
            <SvgText
              x={geometry.padding.left - 4}
              y={tick.y + 2}
              textAnchor="end"
              fill="#64748b"
              fontSize={7}
              fontFamily="Courier"
            >
              {tick.label}
            </SvgText>
          </G>
        ))}

        {/* RE-CHECK guardband (t_required .. t_required + gauge) per distinct
            t_required — amber wash so the verdict bands read on the shared axis. */}
        {geometry.bands.map((band, i) => (
          <G key={`band-${i}`}>
            <Rect
              x={geometry.padding.left}
              y={band.yTop}
              width={plotW}
              height={Math.max(0, band.yBottom - band.yTop)}
              fill="#d97706"
              opacity={0.12}
            />
            {/* t_required retirement limit (dashed) */}
            <Line
              x1={geometry.padding.left}
              y1={band.yBottom}
              x2={geometry.width - geometry.padding.right}
              y2={band.yBottom}
              stroke="#ef4444"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            <SvgText
              x={geometry.width - geometry.padding.right}
              y={band.yBottom - 3}
              textAnchor="end"
              fill="#ef4444"
              fontSize={6}
              fontFamily="Helvetica-Bold"
            >
              {`t_req ${band.tRequiredMm.toFixed(2)}`}
            </SvgText>
          </G>
        ))}

        {/* Per-series trajectories (dashed) then histories — all series on
            the SAME scales, so a reader compares CMLs directly. */}
        {geometry.series.map((s) => (
          <G key={`traj-${s.cmlId}`}>
            {s.trajectoryPath ? (
              <Path
                d={s.trajectoryPath}
                stroke={s.color}
                strokeWidth={0.9}
                strokeDasharray="3,2"
                fill="none"
                opacity={0.85}
              />
            ) : null}
          </G>
        ))}
        {geometry.series.map((s) => (
          <G key={`hist-${s.cmlId}`}>
            {s.historyPath ? (
              <Path d={s.historyPath} stroke={s.color} strokeWidth={1.3} fill="none" />
            ) : null}
            {s.dataPoints.map((pt, i) => (
              <Circle
                key={`pt-${s.cmlId}-${i}`}
                cx={pt.x}
                cy={pt.y}
                r={1.7}
                fill={s.color}
                stroke="#ffffff"
                strokeWidth={0.4}
              />
            ))}
          </G>
        ))}

        {/* t_required intercept markers (no per-series date labels — the fan
            stays legible; retirement dates live in the register's RL column). */}
        {geometry.series.map((s) =>
          s.interceptPoint ? (
            <Circle
              key={`icept-${s.cmlId}`}
              cx={s.interceptPoint.x}
              cy={s.interceptPoint.y}
              r={2.6}
              fill={s.color}
              stroke="#111111"
              strokeWidth={0.5}
            />
          ) : null,
        )}

        {/* X-axis labels */}
        {geometry.xTicks.map((tick, i) => (
          <SvgText
            key={`x-${i}`}
            x={tick.x}
            y={tick.y}
            textAnchor="middle"
            fill="#64748b"
            fontSize={7}
            fontFamily="Courier"
          >
            {tick.label}
          </SvgText>
        ))}
      </Svg>
      {/* Legend — one swatch per series, rendered OUTSIDE the Svg so each
          CML id prints once (the register already names every CML). */}
      <View style={styles.legend}>
        {geometry.series.map((s) => (
          <View key={`legend-${s.cmlId}`} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>{s.cmlId}</Text>
          </View>
        ))}
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}
