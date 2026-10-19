/**
 * PDF-01 — vector trend curve for the certified report.
 *
 * Consumes the IDENTICAL pure geometry engine as the web TrendCurve
 * (lib/analytics/geometry.ts) and renders @react-pdf/renderer vector
 * primitives only (Svg, Path, Line, Circle, Rect, G, Text) — zero raster
 * bitmaps, zero DPI pixelation at any zoom. Typography inside the Svg is
 * strictly standard Helvetica/Courier (no Font.register; server-safe).
 * SERVER module — no "use client".
 */
import React from "react";
import { Svg, Path, Line, Circle, Rect, G, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { TrendCurveGeometry } from "@/lib/analytics/geometry";
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
});

export interface PdfTrendCurveProps {
  geometry: TrendCurveGeometry;
  title?: string;
  /** Sub-caption line (e.g. governing CR + uncertainty), display only. */
  caption?: string;
}

export function PdfTrendCurve({
  geometry,
  title = "Wall Loss Velocity & Degradation Projection",
  caption,
}: PdfTrendCurveProps) {
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

        {/* Gauge-uncertainty envelope polygon */}
        {geometry.uncertaintyPath ? (
          <Path d={geometry.uncertaintyPath} fill="#bae6fd" opacity={0.4} />
        ) : null}

        {/* t_required retirement limit */}
        <Line
          x1={geometry.padding.left}
          y1={geometry.tRequiredY}
          x2={geometry.width - geometry.padding.right}
          y2={geometry.tRequiredY}
          stroke="#ef4444"
          strokeWidth={1}
          strokeDasharray="3,3"
        />
        <SvgText
          x={geometry.width - geometry.padding.right}
          y={geometry.tRequiredY - 3}
          textAnchor="end"
          fill="#ef4444"
          fontSize={6}
          fontFamily="Helvetica-Bold"
        >
          t_required
        </SvgText>

        {/* Degradation trajectory (dashed) */}
        {geometry.trajectoryPath ? (
          <Path
            d={geometry.trajectoryPath}
            stroke="#f87171"
            strokeWidth={1.2}
            strokeDasharray="3,2"
            fill="none"
          />
        ) : null}

        {/* Historical polyline */}
        {geometry.historyPath ? (
          <Path d={geometry.historyPath} stroke="#0369a1" strokeWidth={1.5} fill="none" />
        ) : null}

        {/* Historical points */}
        {geometry.dataPoints.map((pt, i) => (
          <Circle
            key={`pt-${i}`}
            cx={pt.x}
            cy={pt.y}
            r={2}
            fill="#0369a1"
            stroke="#ffffff"
            strokeWidth={0.5}
          />
        ))}

        {/* t_required intercept marker + date label */}
        {geometry.interceptPoint ? (
          <G>
            <Circle cx={geometry.interceptPoint.x} cy={geometry.interceptPoint.y} r={3.5} fill="#dc2626" />
            <SvgText
              x={Math.min(geometry.interceptPoint.x, geometry.width - geometry.padding.right - 30)}
              y={Math.max(geometry.interceptPoint.y - 6, 10)}
              textAnchor="middle"
              fill="#dc2626"
              fontSize={7}
              fontFamily="Helvetica-Bold"
            >
              {`t_req: ${geometry.interceptPoint.date}`}
            </SvgText>
          </G>
        ) : null}

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
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}
