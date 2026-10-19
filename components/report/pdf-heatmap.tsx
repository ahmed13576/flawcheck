/**
 * PDF-02 — compact vector CML severity matrix for the certified report.
 *
 * Renders the SAME pure geometry engine output as the web heatmap in a
 * space-efficient matrix form sized for PDF Page 1 (executive dashboard):
 * each CML is one color-coded cell of the uniform grid plus a one-line
 * count legend. Large registers (> 100 locations) stay graceful: cells
 * scale down with the grid span; the caller may pass the governing slice.
 * SERVER module — no "use client".
 */
import React from "react";
import { Svg, Rect, G, Text, View, StyleSheet } from "@react-pdf/renderer";
import { calcCmlHeatmapGeometry, type CmlHeatmapItem } from "@/lib/analytics/geometry";

const styles = StyleSheet.create({
  container: { marginVertical: 6 },
  header: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 3 },
  legend: { fontSize: 7, fontFamily: "Courier", color: "#555555", marginTop: 2 },
});

export interface PdfHeatmapProps {
  cmls: CmlHeatmapItem[];
  width?: number;
  height?: number;
  title?: string;
}

export function PdfHeatmap({
  cmls,
  width = 300,
  height = 150,
  title = "Spatial CML Severity Matrix",
}: PdfHeatmapProps) {
  const geo = calcCmlHeatmapGeometry(cmls, width, height);
  const counts = {
    accept: cmls.filter((c) => c.verdict === "accept").length,
    re_check: cmls.filter((c) => c.verdict === "re_check").length,
    reject: cmls.filter((c) => c.verdict === "reject").length,
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{title}</Text>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        {/* Cell fills — the severity matrix body */}
        {geo.items.map((item) => (
          <Rect
            key={`cell-${item.cmlId}`}
            x={item.pixelX - geo.cellSize / 2}
            y={item.pixelY - geo.cellSize / 2}
            width={geo.cellSize}
            height={geo.cellSize}
            fill={item.color}
            opacity={0.3}
          />
        ))}
        {/* Node dots — compact identity-free grid for page-1 density */}
        {geo.items.map((item) => (
          <G key={`dot-${item.cmlId}`}>
            <Rect
              x={item.pixelX - geo.cellSize * 0.18}
              y={item.pixelY - geo.cellSize * 0.18}
              width={geo.cellSize * 0.36}
              height={geo.cellSize * 0.36}
              fill={item.color}
            />
          </G>
        ))}
      </Svg>
      <Text style={styles.legend}>
        {`${counts.accept} Accept · ${counts.re_check} Re-check · ${counts.reject} Fail · ${cmls.length} locations`}
      </Text>
    </View>
  );
}
