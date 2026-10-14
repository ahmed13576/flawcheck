# Phase 9: Visual Inspection Analytics & Vector PDF Integration — Specification

**Created:** 2026-10-14
**Ambiguity score:** 0.08 (gate: ≤ 0.20)
**Requirements:** 8 locked (VIS-01..04, PDF-01..04)

## Goal

Deliver lightweight, animated SVG and CSS visual inspection analytics (wall loss degradation curves, CML spatial severity heatmaps, and safety margin metric gauges) that serialize losslessly into `@react-pdf/renderer` vector primitives for certified PDF inspection reports without installing heavy external charting libraries.

## Background

In Phases 1–6, FlawCheck built a complete deterministic calculation engine, clause-cited LLM reasoning chain, executive findings brief, and two-page certified PDF report. However, thickness data and corrosion projections are currently presented exclusively through tabular grids and text cards (`components/wizard/screen-results.tsx`, `components/report/pdf-document.tsx`).

NDT inspectors, reliability engineers, and plant managers require visual orientation to rapidly grasp piping degradation trajectories, spatial flaw clustering, and safety margins:
1. **Wall Loss Velocity & Trend Curves**: Visualizing historical UT readings alongside the linear degradation slope and the critical intercept where wall thickness crosses $t_{\text{required}}$ (remaining life boundary), flanked by gauge uncertainty envelopes.
2. **CML Spatial Severity Heatmap**: Visualizing piping circuits or tank shell courses spatially to pinpoint localized thinning patterns versus general corrosion.
3. **Animated Safety Margin Gauges**: Radial/arc indicators illustrating operating safety margin percentages above retirement thickness.
4. **Certified PDF Vector Export**: Ensuring visual analytics serialize cleanly into vector paths in generated PDF downloads using `@react-pdf/renderer` primitives rather than blurry canvas bitmaps or raster screenshots.

Phase 9 implements these capabilities across web and PDF surfaces with zero external charting dependencies (no Chart.js, Recharts, or D3), relying purely on functional geometry calculation and native SVG rendering.

## Requirements

1. **VIS-01 (Shared Geometry Engine)**:
   - Current: No visual coordinate projection or path generation logic exists.
   - Target: `lib/analytics/geometry.ts` provides pure, testable geometry functions computing coordinates, viewBox bounds, scales, axes, ticks, and SVG path strings (`d="M... L... Z"`) with zero DOM dependencies.
   - Acceptance: 100% unit-tested arithmetic generating SVG path strings for historical polylines, projection lines, uncertainty polygons, and gauge arcs across various viewport dimensions.

2. **VIS-02 (Animated Wall Loss Velocity & Trend Curves)**:
   - Current: Historical readings and projected remaining life are only displayed in tables.
   - Target: `components/analytics/trend-curve.tsx` renders an interactive SVG time-series chart showing:
     - Historical survey points with inspection dates.
     - Linear corrosion degradation slope ($CR = \frac{t_{\text{prev}} - t_{\text{curr}}}{\Delta \text{Time}}$).
     - Retirement limit line at $t_{\text{required}}$ and remaining life intercept date.
     - Shaded confidence uncertainty envelope ($\pm 0.1\text{ mm}$ gauge uncertainty).
     - GPU-accelerated CSS line-draw animation respecting `prefers-reduced-motion`.
   - Acceptance: Component renders smoothly in browser; handles zero corrosion rate, negative corrosion (thickness gain anomaly), and $t_{\text{actual}} \le t_{\text{required}}$ edge cases without SVG rendering errors.

3. **VIS-03 (CML Spatial Severity Heatmap)**:
   - Current: CML inspection results are listed in flat tabular rows.
   - Target: `components/analytics/cml-heatmap.tsx` renders a color-coded spatial grid representing piping circuits, shell courses, or nozzle orientations:
     - Green (`#16a34a`): ACCEPT ($t_{\text{actual}} \ge t_{\text{required}} + \text{band}$).
     - Amber (`#d97706`): RE-CHECK (borderline thickness within uncertainty band).
     - Red (`#dc2626`): FAIL ($t_{\text{actual}} < t_{\text{required}}$).
     - Interactive hover tooltips displaying CML ID, measured thickness, margin, and governing code clause.
   - Acceptance: Heatmap correctly visualizes all evaluated locations; clicking or hovering highlights the corresponding row in the results table.

4. **VIS-04 (Animated Safety Margin Metric Gauges)**:
   - Current: Safety margins are displayed as plain numerical percentages.
   - Target: `components/analytics/metric-gauge.tsx` renders circular SVG arc gauges displaying:
     - Safety margin percentage: $\frac{t_{\text{actual}} - t_{\text{required}}}{t_{\text{required}}} \times 100\%$.
     - Governing corrosion velocity ($CR$ in mm/yr).
     - Fluid CSS transitions on mount with animated `strokeDashoffset`.
   - Acceptance: Gauges clamp accurately to $[0\%, 100\%+]$; respect `prefers-reduced-motion` by disabling transitions when requested.

5. **PDF-01 (Vector PDF Trend Curve Component)**:
   - Current: PDF report contains only text and tabular cells.
   - Target: `components/report/pdf-trend-curve.tsx` consumes the shared geometry engine and renders the degradation curve using `@react-pdf/renderer` primitive components (`Svg`, `Path`, `Line`, `Circle`, `Rect`, `Text`).
   - Acceptance: Trend curve renders into PDF page 1 or 2 as vector art; text renders in standard Helvetica/Courier; zero DPI pixelation at any zoom level.

6. **PDF-02 (Vector PDF Spatial Heatmap Summary)**:
   - Current: PDF page 1 contains top-10 worst CML table only.
   - Target: `components/report/pdf-heatmap.tsx` renders a compact vector spatial severity matrix summarizing passing, re-check, and failing locations across inspected component zones.
   - Acceptance: Heatmap renders into PDF layout without page overflow or clipping; handles large CML registers (> 100 locations) gracefully.

7. **PDF-03 (Zero External Charting Dependency Rule)**:
   - Current: Project uses `lucide-react`, `tw-animate-css`, and `@react-pdf/renderer`.
   - Target: Visual analytics implementation adds 0 npm packages. All visualizations are built with standard SVG, CSS, and `@react-pdf/renderer` primitives.
   - Acceptance: `git diff master..HEAD -- package.json` shows no new chart libraries installed (no Chart.js, Recharts, Victory, D3).

8. **PDF-04 (Accessibility & Motion Sensitivity)**:
   - Current: CSS animations use standard transitions.
   - Target: All SVG and CSS animations in web components include `@media (prefers-reduced-motion: reduce)` fallbacks rendering final states immediately without transition delays.
   - Acceptance: CSS rules include `motion-reduce:transition-none` and `motion-reduce:animate-none`; axe accessibility scan passes with 0 motion contrast errors.

## Boundaries

**In scope:**
- `lib/analytics/geometry.ts`: Pure functional SVG path generator.
- Web interactive components: `components/analytics/trend-curve.tsx`, `cml-heatmap.tsx`, `metric-gauge.tsx`.
- PDF vector components: `components/report/pdf-trend-curve.tsx`, `pdf-heatmap.tsx`.
- Integration into Screen 3 (`screen-results.tsx`) and PDF report (`pdf-document.tsx`).
- Unit tests verifying geometry math, boundary clipping, and PDF rendering.

**Out of scope:**
- 3D point cloud or mesh rendering (prohibited in PROJECT.md: "Point readings only; fake 3D damages credibility").
- Adding third-party charting libraries (Chart.js, Recharts, D3).
- Modifying deterministic calculation formulas in `lib/calc/`.
- Changing PDF document sign-off hash seal mechanics.

## Constraints

- **Dependency Invariant**: Zero new charting libraries installed in `package.json`.
- **Pure Math Sovereignty**: All projection math and geometry paths generated in pure TypeScript (`lib/analytics/`).
- **PDF Compatibility**: Must use only `@react-pdf/renderer` supported SVG primitives (`Svg`, `Path`, `Line`, `Circle`, `Rect`, `G`). No unsupported web SVG attributes (`style="..."`, `@keyframes`).
- **Font Restrictions**: PDF text elements must use standard fonts (`Helvetica`, `Courier`) to avoid Server Component font registration failures.
- **Performance**: Trend curve SVG rendering must complete in $< 16\text{ ms}$ (60 FPS) on client.

## Acceptance Criteria

- [ ] `lib/analytics/geometry.ts` calculates SVG path strings for trend curves and radial arcs with 0 DOM dependencies.
- [ ] Animated SVG trend curve component renders time-series readings, linear trajectory, $t_{\text{required}}$ intercept, and uncertainty band.
- [ ] CML spatial heatmap renders color-coded grid with interactive tooltips and location highlighting.
- [ ] Metric gauges illustrate safety margin above $t_{\text{required}}$ with smooth CSS transitions.
- [ ] Web components respect `prefers-reduced-motion` by disabling CSS animations.
- [ ] `@react-pdf/renderer` components render vector trend curves and spatial heatmaps into the PDF export without rasterization.
- [ ] PDF generation test passes cleanly verifying `<Svg>`, `<Path>`, `<Line>` element hierarchy.
- [ ] Zero new charting dependencies installed in `package.json`.

## Edge Coverage

**Coverage:** 6/6 applicable edges resolved · 0 unresolved

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| Zero Corrosion | VIS-02 | ✅ covered | If $CR = 0$, degradation line is horizontal; remaining life labeled "Indefinite (>50 yr)". |
| Thickness Gain | VIS-02 | ✅ covered | If $CR < 0$, trajectory rendered dashed with "Measurement Anomaly" flag. |
| Immediate Failure | VIS-02 | ✅ covered | If $t_{\text{actual}} \le t_{\text{required}}$, intercept point is highlighted red at date $\le$ today. |
| Single Reading | VIS-02 | ✅ covered | CML with 1 reading displays point with dashed horizontal line and "Insufficient History". |
| Large Register | VIS-03 | ✅ covered | Registers with > 100 CMLs display dense grid or worst-100 governing view. |
| Motion Disabled | PDF-04 | ✅ covered | `prefers-reduced-motion` media query forces instantaneous path draw. |

## Prohibitions (must-NOT)

**Coverage:** 5/5 applicable prohibitions resolved · 0 unresolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| MUST NOT install external charting libraries | PDF-03 | resolved | Verification checks `package.json` diff is clean of charting packages. |
| MUST NOT render blurry canvas/raster bitmaps in PDF | PDF-01 | resolved | Uses `@react-pdf/renderer` native `<Svg>` and `<Path>` vector primitives. |
| MUST NOT recompute engineering numbers inside UI components | VIS-01 | resolved | Geometry generator only projects precomputed values from `evaluate()`. |
| MUST NOT produce 3D corrosion meshes or fake isometric views | VIS-01 | resolved | Strictly 2D time-series SVG curves and 2D spatial severity grids. |
| MUST NOT use non-standard web fonts inside PDF SVG elements | PDF-01 | resolved | Restricts PDF SVG typography to `Helvetica` and `Courier`. |

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                              |
|--------------------|-------|------|--------|------------------------------------|
| Goal Clarity       | 0.95  | 0.75 | ✓      | Clear visualization & PDF vector goals |
| Boundary Clarity   | 0.94  | 0.70 | ✓      | In-scope SVG components vs out-of-scope 3D |
| Constraint Clarity | 0.96  | 0.65 | ✓      | Zero-chart-lib & PDF SVG primitive constraints |
| Acceptance Criteria| 0.94  | 0.70 | ✓      | All 8 criteria are falsifiable checkboxes |
| **Ambiguity**      | 0.08  | ≤0.20| ✓      | Specification is unambiguous       |

## Interview Log

| Round | Perspective    | Question summary                                 | Decision locked                    |
|-------|----------------|--------------------------------------------------|------------------------------------|
| 1     | Researcher     | Which chart library should be added?             | None. Pure SVG and CSS to prevent bundle bloat and PDF incompatibility. |
| 2     | Simplifier     | How should web and PDF renderers share geometry? | Shared pure functional math in `lib/analytics/geometry.ts`. |
| 3     | Boundary Keeper| Can we render 3D pipe models?                    | No. Point-based 2D time-series and 2D spatial heatmaps only. |
