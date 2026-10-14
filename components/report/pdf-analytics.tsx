/**
 * Vector PDF Inspection Analytics Components
 * 
 * Renders vector trend curves and spatial heatmaps using @react-pdf/renderer
 * primitive SVG elements (Svg, Path, Line, Circle, Rect, G, Text, View).
 * Server-safe module without "use client".
 */

import React from "react";
import { Svg, Path, Line, Circle, Rect, G, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { TrendCurveGeometry, CmlHeatmapGeometry } from "@/lib/analytics/geometry";

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    backgroundColor: "#ffffff",
  },
  header: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 4,
  },
});

export interface PdfTrendCurveProps {
  geometry: TrendCurveGeometry;
  title?: string;
}

export function PdfTrendCurve({ geometry, title = "Wall Loss Velocity & Degradation Projection" }: PdfTrendCurveProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>{title}</Text>
      <Svg width={geometry.width} height={geometry.height} viewBox={`0 0 ${geometry.width} ${geometry.height}`}>
        {/* Background bounding rect */}
        <Rect
          x={geometry.padding.left}
          y={geometry.padding.top}
          width={geometry.width - geometry.padding.left - geometry.padding.right}
          height={geometry.height - geometry.padding.top - geometry.padding.bottom}
          fill="#f8fafc"
          stroke="#cbd5e1"
          strokeWidth={0.5}
        />

        {/* Y-axis grid ticks */}
        {geometry.yTicks.map((tick, i) => (
          <G key={`ytick-${i}`}>
            <Line
              x1={geometry.padding.left}
              y1={tick.y}
              x2={geometry.width - geometry.padding.right}
              y2={tick.y}
              stroke="#e2e8f0"
              strokeWidth={0.5}
            />
            <Text
              x={geometry.padding.left - 4}
              y={tick.y + 2}
              textAnchor="end"
              fill="#64748b"
            >
              {tick.label}
            </Text>
          </G>
        ))}

        {/* Uncertainty envelope polygon */}
        {geometry.uncertaintyPath && (
          <Path d={geometry.uncertaintyPath} fill="#bae6fd" opacity={0.4} />
        )}

        {/* t_required threshold limit */}
        <Line
          x1={geometry.padding.left}
          y1={geometry.tRequiredY}
          x2={geometry.width - geometry.padding.right}
          y2={geometry.tRequiredY}
          stroke="#ef4444"
          strokeWidth={1}
          strokeDasharray="3,3"
        />

        {/* Trajectory path */}
        {geometry.trajectoryPath && (
          <Path d={geometry.trajectoryPath} stroke="#0284c7" strokeWidth={1.5} strokeDasharray="3,2" fill="none" />
        )}

        {/* Historical line path */}
        {geometry.historyPath && (
          <Path d={geometry.historyPath} stroke="#0369a1" strokeWidth={2} fill="none" />
        )}

        {/* Historical data points */}
        {geometry.dataPoints.map((pt, i) => (
          <Circle key={`pt-${i}`} cx={pt.x} cy={pt.y} r={2.5} fill="#0284c7" stroke="#ffffff" strokeWidth={0.5} />
        ))}

        {/* Intercept point */}
        {geometry.interceptPoint && (
          <G>
            <Circle cx={geometry.interceptPoint.x} cy={geometry.interceptPoint.y} r={4} fill="#dc2626" />
            <Text
              x={geometry.interceptPoint.x}
              y={geometry.interceptPoint.y - 6}
              textAnchor="middle"
              fill="#dc2626"
            >
              {`t_req: ${geometry.interceptPoint.year}`}
            </Text>
          </G>
        )}

        {/* X-axis labels */}
        {geometry.xTicks.map((tick, i) => (
          <Text
            key={`xtick-${i}`}
            x={tick.x}
            y={geometry.height - geometry.padding.bottom + 10}
            textAnchor="middle"
            fill="#64748b"
          >
            {tick.label}
          </Text>
        ))}
      </Svg>
    </View>
  );
}

export interface PdfCmlHeatmapProps {
  geometry: CmlHeatmapGeometry;
  title?: string;
}

export function PdfCmlHeatmap({ geometry, title = "Spatial CML Distribution Map" }: PdfCmlHeatmapProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>{title}</Text>
      <Svg width={geometry.width} height={geometry.height} viewBox={`0 0 ${geometry.width} ${geometry.height}`}>
        <Rect
          x={10}
          y={10}
          width={geometry.width - 20}
          height={geometry.height - 20}
          fill="#f8fafc"
          stroke="#cbd5e1"
          strokeWidth={0.5}
        />

        {/* Sequential connections */}
        {geometry.items.length > 1 && (
          <Path
            d={geometry.items.reduce(
              (acc, item, i) => (i === 0 ? `M ${item.pixelX} ${item.pixelY}` : `${acc} L ${item.pixelX} ${item.pixelY}`),
              ""
            )}
            stroke="#94a3b8"
            strokeWidth={1}
            strokeDasharray="2,2"
            fill="none"
          />
        )}

        {/* CML Nodes */}
        {geometry.items.map((item) => (
          <G key={item.cmlId}>
            <Circle cx={item.pixelX} cy={item.pixelY} r={4} fill={item.color} stroke="#ffffff" strokeWidth={0.5} />
            <Text
              x={item.pixelX}
              y={item.pixelY - 6}
              textAnchor="middle"
              fill="#334155"
            >
              {item.cmlId}
            </Text>
          </G>
        ))}
      </Svg>
    </View>
  );
}
