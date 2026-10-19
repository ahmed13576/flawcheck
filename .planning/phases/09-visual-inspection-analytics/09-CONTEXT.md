# Phase 9: Visual Inspection Analytics & Vector PDF Integration — Context

**Date:** 2026-10-14
**Status:** Decisions locked — ready for planning

## <domain>

Phase 9 introduces animated visual inspection analytics to FlawCheck, elevating the presentation layer across both interactive web sessions (`components/wizard/screen-results.tsx`) and downloadable certified PDF inspection reports (`components/report/pdf-document.tsx`).

Three distinct visual aids are established:
1. **Wall Loss Velocity & Trend Curves**: Time-series SVG charts projecting thickness degradation over time, remaining life intercept at $t_{\text{required}}$, and $\pm 0.1\text{ mm}$ gauge uncertainty envelopes.
2. **CML Spatial Severity Heatmap**: 2D color-coded layout highlighting localized flaw clusters across inspected piping circuits or tank courses.
3. **Animated Metric Gauges**: Circular SVG arcs visualizing safety margin percentages above retirement limit and corrosion velocity.

### Scope boundary

This phase operates strictly at the presentation and geometry generation layer. It must not touch:
- Pure calculation math in `lib/calc/` (protected, byte-identical).
- Standards criteria in `lib/criteria/`.
- DecisionProvider interface contracts (Phases 7 & 8).
- PDF sign-off verification hash seal mechanics.

</domain>

## <decisions>

### 1. Zero External Chart Library Architecture

- To keep the bundle lightweight, ensure total styling control, and enable 1:1 vector serialization into PDF, NO third-party chart libraries (Recharts, Chart.js, D3) will be installed.
- All visual components are implemented using native SVG `<svg>`, CSS transitions, and `@react-pdf/renderer` primitive components (`Svg`, `Path`, `Line`, `Circle`, `Rect`, `Text`).
- Icons are drawn exclusively from existing `lucide-react` dependency.

### 2. Dual Renderer via Shared Pure Geometry Math

- Projection math is completely decoupled from rendering frameworks:
  - `lib/analytics/geometry.ts` accepts precomputed data points (`TrendPoint[]`, $t_{\text{required}}$, $CR$) and bounding dimensions (`width`, `height`, `padding`).
  - It outputs exact SVG path strings (`d="M... L... Z"`), coordinate tuples, tick labels, and bounding boxes.
- Web component (`components/analytics/trend-curve.tsx`) consumes this geometry and renders standard HTML `<svg>` with CSS transitions.
- PDF component (`components/report/pdf-trend-curve.tsx`) consumes the identical geometry and renders `@react-pdf/renderer` `<Svg>` and `<Path>` components, guaranteeing 100% visual fidelity and zero raster blur.

### 3. Motion Accessibility & GPU Acceleration

- Web SVG animations use hardware-accelerated CSS properties (`stroke-dasharray`, `stroke-dashoffset`, `transform`, `opacity`).
- All animations respect `prefers-reduced-motion: reduce` by zeroing transition durations and rendering final path states immediately.

### 4. Vector PDF Integration Strategy

- PDF Page 1 (executive dashboard) will incorporate the CML spatial severity summary matrix adjacent to the top-10 worst CMLs.
- PDF Page 2 or dedicated Analytics section will render the governing CML degradation trend curve directly above the detailed inspection register.
- All typography inside PDF `<Svg>` elements uses standard system fonts (`Helvetica`, `Courier`) to prevent Next.js SSR font registration issues.

### 5. Explainable Fail-Closed Review Block (from Phase 08 UAT deferred follow-up, test 1 — locked 2026-10-19)

- When a System-1 choice gate fires fail-closed (p < 0.85), the surface that presents it renders an **explainable manual review block**: the competing classes with their full probability distribution (e.g. "Class 1 at 0.62 vs Class 3 at 0.58" — the distribution already travels on the choice result, never leaves the safe side of the seam), the input snippet that drove the uncertainty (e.g. "trace H2S present, operating pressure not stated"), what evidence would disambiguate, and remedial steps ("confirm fluid service class against process datasheet per API 570 §6.3").
- **Invariant preserved**: the explanation layer narrates around the precomputed distribution — it never re-classifies. Same pattern as the System-2 narrative layer on the main repo.

### 6. Reasoned Guard Failure Report (from Phase 08 UAT deferred follow-up, test 2 — locked 2026-10-19)

- When the semantic guard rejects a narrative, the failure report states: what the narrative claimed, what the precomputed verdict actually is, and that the deterministic fallback was served instead.
- **Two audiences kept distinct**: operator/developer remediation (inspect the audit log, fix the prompt or the lint) vs the inspector-facing remedial step, which is simply "trust the fallback verdict".

</decisions>

## <specifics>

- Directory layout:
  - `lib/analytics/geometry.ts`: Pure functional SVG path generator.
  - `components/analytics/trend-curve.tsx`: Interactive web trend curve.
  - `components/analytics/cml-heatmap.tsx`: Interactive web spatial severity heatmap.
  - `components/analytics/metric-gauge.tsx`: Interactive web safety margin gauge.
  - `components/report/pdf-trend-curve.tsx`: `@react-pdf/renderer` vector trend curve.
  - `components/report/pdf-heatmap.tsx`: `@react-pdf/renderer` vector spatial heatmap.
  - `tests/analytics/geometry.test.ts`: Pure geometry calculation unit tests.
  - `tests/analytics/visual-render.test.ts`: React render tests for SVG components.
  - `tests/pdf/pdf-analytics.test.ts`: PDF vector generation test assertions.

</specifics>

## <code_context>

- `components/wizard/screen-results.tsx` — Host screen where interactive analytics components mount above the results table.
- `components/report/pdf-document.tsx` — Existing certified two-page PDF document; hosts the PDF vector components.
- `lib/calc/evaluate.ts` — Precomputes all thickness, corrosion rate, and remaining life numbers consumed by the geometry engine.
- `lib/report/content.ts` — Established content seam for findings briefs and summaries.
- `lib/criteria/ut-criteria.json` — Uncertainty band definitions ($\pm 0.1\text{ mm}$).

</code_context>

## <canonical_refs>

- `.planning/ROADMAP.md` — Phase 9 milestone details and success criteria.
- `AGENTS.md` — Criteria sovereignty, standards invariant, and PDF execution guidelines.
- API 570 (5th Edition) Section 7 — Remaining life and inspection interval calculations.
- API 574 (5th Edition, 2024) Section 10 — Minimum thickness determination.

</canonical_refs>

## <deferred>

- Full 3D C-scan corrosion point clouds (deferred to future hardware integration milestones).
- Real-time animated telemetry streaming from live ultrasonic thickness gauges.
- Interactive dragging or editing of projection lines (inspection math is read-only).

### Promoted from Phase 08 UAT (2026-10-19) — folded into decisions 5 & 6 above

- Explainable manual review block for fail-closed System-1 gates (decision 5).
- Reasoned guard failure report with dual-audience remediation (decision 6).

</deferred>
