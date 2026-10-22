/**
 * Phase 09 VIS-02/03/04 — web analytics component render tests.
 *
 * Node-suite SSR checks (the flowstep renderToStaticMarkup pattern — vitest
 * environment is `node`, no jsdom): every component renders its SVG with the
 * geometry-derived paths, carries the accessibility labels, and includes the
 * motion-reduce utility classes (PDF-04) in the DOM output. Components
 * consume ONLY geometry engine output — no engineering number is derived in
 * the render path (pinned by the source-scan assertion).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TrendCurve } from "@/components/analytics/trend-curve";
import { CmlHeatmap } from "@/components/analytics/cml-heatmap";
import { MetricGauge } from "@/components/analytics/metric-gauge";
import type { TrendPoint, CmlHeatmapItem } from "@/lib/analytics/geometry";

const POINTS: TrendPoint[] = [
  { date: "2022-06-01", thicknessMm: 9.0 },
  { date: "2023-06-01", thicknessMm: 8.7 },
  { date: "2024-06-01", thicknessMm: 8.4 },
];

const CMLS: CmlHeatmapItem[] = [
  { cmlId: "CML-1", x: 1, y: 1, tActualMm: 9.0, tRequiredMm: 6.35, verdict: "accept", crMmYr: 0.1 },
  { cmlId: "CML-2", x: 2, y: 1, tActualMm: 6.4, tRequiredMm: 6.35, verdict: "re_check", crMmYr: 0.3 },
  { cmlId: "CML-3", x: 1, y: 2, tActualMm: 5.9, tRequiredMm: 6.35, verdict: "reject", crMmYr: 0.4 },
];

describe("TrendCurve (VIS-02)", () => {
  it("renders an SVG with viewBox, history path, t_required line, and envelope", () => {
    const html = renderToStaticMarkup(
      createElement(TrendCurve, {
        points: POINTS,
        tRequiredMm: 6.35,
        crGoverningMmYr: 0.3,
      }),
    );
    expect(html).toContain('viewBox="0 0 500 240"');
    expect(html).toContain("<path");
    // t_required limit line renders in the rejection red.
    expect(html).toContain('stroke="#ef4444"');
    // Accessibility label composes the real precomputed values.
    expect(html).toContain('role="img"');
    expect(html).toContain("required thickness 6.35 mm");
  });

  it("renders the intercept marker when the trajectory crosses t_required", () => {
    const html = renderToStaticMarkup(
      createElement(TrendCurve, {
        points: POINTS,
        tRequiredMm: 6.35,
        crGoverningMmYr: 0.3,
      }),
    );
    expect(html).toContain("t_req: 2031-04");
  });

  it("renders the measurement-anomaly badge for negative CR without crashing", () => {
    const html = renderToStaticMarkup(
      createElement(TrendCurve, {
        points: POINTS,
        tRequiredMm: 6.35,
        crGoverningMmYr: -0.2,
      }),
    );
    expect(html).toContain("Measurement anomaly");
    expect(html).not.toContain("t_req: ");
  });

  it("renders the line-draw animation with motion-reduce fallback classes (PDF-04)", () => {
    const html = renderToStaticMarkup(
      createElement(TrendCurve, {
        points: POINTS,
        tRequiredMm: 6.35,
        crGoverningMmYr: 0.3,
      }),
    );
    expect(html).toContain("trend-draw-animated");
    expect(html).toContain("motion-reduce:animate-none");
  });

  it("handles the zero-point edge without throwing", () => {
    const html = renderToStaticMarkup(
      createElement(TrendCurve, {
        points: [],
        tRequiredMm: 6.35,
        crGoverningMmYr: 0.3,
      }),
    );
    expect(html).toContain("<svg");
  });
});

describe("CmlHeatmap (VIS-03)", () => {
  it("renders color-coded cells for every verdict band", () => {
    const html = renderToStaticMarkup(
      createElement(CmlHeatmap, { cmls: CMLS }),
    );
    expect(html).toContain("#16a34a");
    expect(html).toContain("#d97706");
    expect(html).toContain("#dc2626");
    expect(html).toContain("CML-1");
    expect(html).toContain("CML-3");
  });

  it("exposes counts and a real aria-label instead of a bare grid", () => {
    const html = renderToStaticMarkup(
      createElement(CmlHeatmap, { cmls: CMLS }),
    );
    expect(html).toContain("Accept (1)");
    expect(html).toContain("Re-check (1)");
    expect(html).toContain("Fail (1)");
    expect(html).toContain("3 CML locations");
  });

  it("renders the governing clause in the tooltip copy", () => {
    const html = renderToStaticMarkup(
      createElement(CmlHeatmap, {
        cmls: CMLS,
        governingClause: "API 570 §4.3.2",
      }),
    );
    expect(html).toContain("API 570 §4.3.2");
  });

  it("renders an empty register without throwing", () => {
    const html = renderToStaticMarkup(createElement(CmlHeatmap, { cmls: [] }));
    expect(html).toContain("<svg");
  });
});

describe("MetricGauge (VIS-04)", () => {
  it("renders the arc with dasharray/dashoffset from the geometry engine", () => {
    const html = renderToStaticMarkup(
      createElement(MetricGauge, {
        label: "Safety margin",
        currentMm: 7.9,
        tRequiredMm: 6.35,
        tNominalMm: 10.31,
        crMmYr: 0.3,
      }),
    );
    expect(html).toContain("stroke-dasharray");
    expect(html).toContain("stroke-dashoffset");
    expect(html).toContain("Safety margin");
    expect(html).toContain("39");
  });

  it("carries the motion-reduce utilities on the animated arc (PDF-04)", () => {
    const html = renderToStaticMarkup(
      createElement(MetricGauge, {
        label: "Margin",
        currentMm: 7.9,
        tRequiredMm: 6.35,
        tNominalMm: 10.31,
      }),
    );
    expect(html).toContain("motion-reduce:transition-none");
    expect(html).toContain("motion-reduce:animate-none");
  });

  it("renders a negative margin in the red band without crashing", () => {
    const html = renderToStaticMarkup(
      createElement(MetricGauge, {
        label: "Margin",
        currentMm: 5.9,
        tRequiredMm: 6.35,
        tNominalMm: 10.31,
      }),
    );
    expect(html).toContain('stroke="#dc2626"');
  });
});

describe("geometry sovereignty (source scan)", () => {
  const ROOT = resolve(__dirname, "../..");

  it("components never import lib/calc or lib/criteria — geometry is the only seam", () => {
    for (const file of [
      "components/analytics/trend-curve.tsx",
      "components/analytics/cml-heatmap.tsx",
      "components/analytics/metric-gauge.tsx",
    ]) {
      const src = readFileSync(resolve(ROOT, file), "utf8");
      expect(src).not.toContain('from "@/lib/calc');
      expect(src).not.toContain('from "@/lib/criteria');
      expect(src).not.toContain('from "lib/calc');
    }
  });

  it("web and PDF components import the SAME geometry engine module", () => {
    const web = readFileSync(
      resolve(ROOT, "components/analytics/trend-curve.tsx"),
      "utf8",
    );
    const pdfTrend = readFileSync(
      resolve(ROOT, "components/report/pdf-trend-curve.tsx"),
      "utf8",
    );
    const pdfHeatmap = readFileSync(
      resolve(ROOT, "components/report/pdf-heatmap.tsx"),
      "utf8",
    );
    expect(web).toContain("lib/analytics/geometry");
    expect(pdfTrend).toContain("lib/analytics/geometry");
    expect(pdfHeatmap).toContain("lib/analytics/geometry");
  });
});
