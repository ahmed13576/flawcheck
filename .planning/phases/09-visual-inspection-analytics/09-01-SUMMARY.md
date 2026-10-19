---
phase: 09-visual-inspection-analytics
plan: 01
subsystem: visual-analytics-and-vector-pdf
tags: [analytics, geometry, svg, react-pdf, accessibility, explainability, fail-closed, integration]
dependency-graph:
  requires: [EvaluationResults schema, evaluate() engine, decision spike contracts, existing certified PDF pipeline]
  provides: [shared pure geometry engine, web analytics component trio, vector PDF report components, explainable fail-closed review block, reasoned guard failure report]
  affects: [components/analytics, components/report, components/review, components/wizard/screen-results, app/globals.css]
tech-stack:
  added: []
  patterns: [shared pure-geometry dual-renderer, GPU-compositor animation with reduced-motion fallbacks, narrative-around-distribution explainability, dual-audience remediation, fail-closed presentation layer]
key-files:
  created:
    - tests/analytics/geometry.test.ts (20 unit tests)
    - tests/analytics/visual-render.test.tsx (14 SSR render tests)
    - tests/review/explainable-review.test.tsx (14 tests)
    - tests/pdf/pdf-analytics.test.ts (7 tests)
    - tests/analytics/screen3-mount.test.tsx (3 tests)
  modified:
    - lib/analytics/geometry.ts
    - components/analytics/trend-curve.tsx
    - components/analytics/cml-heatmap.tsx
    - components/analytics/metric-gauge.tsx
    - components/report/pdf-document.tsx
    - components/wizard/screen-results.tsx
decisions:
  - Geometry is the single source of all visual math; web and PDF renderers consume identical path strings, scales, ticks, and bounds from lib/analytics/geometry.ts.
  - Pure calc invariant honored — lib/calc/ and lib/criteria/ remain byte-identical to baseline 2ce76be; lib/analytics/ projects precomputed evaluate() outputs and derives no engineering numbers.
  - Decision 5 honored — the fail-closed review block narrates around the precomputed probability distribution and never re-classifies.
  - Decision 6 honored — operator/developer remediation (audit log, prompt/lint fixes) kept strictly separate from inspector-facing guidance ("trust the fallback verdict").
  - The obsolete Phase-7 stub components/report/pdf-analytics.tsx was removed in favor of the plan-named pdf-trend-curve.tsx / pdf-heatmap.tsx split.
  - Tick interface exposes pos plus x and y for backward compatibility with both component stacks.
  - Zero new npm packages (PDF-03); animations use native CSS keyframes only.
  - No model IDs hardcoded in source or tests; provider routing remains env-only.
metrics:
  duration: single-session
  completed: 2026-10-19
  tasks: 4
  files: 14
  commits: 8
status: complete
actuals:
  new-tests: 58
  commits: 9
  packages-added: 0
---

# Phase 9 Plan 01: Visual Inspection Analytics & Vector PDF Integration — Summary

Implemented a shared pure TypeScript geometry engine powering three animated web analytics components and two @react-pdf/renderer vector report components, integrated into the certified two-page PDF report and the interactive Screen 3 results view — with zero new charting dependencies and byte-identical calculation trees. Decision 5 (explainable fail-closed review block) and Decision 6 (reasoned guard failure report) were implemented as the presentation layer around the existing System-1 fail-closed spike surfaces, without altering provider or spike contracts.

## Completed Work

### Task 1 — Shared pure geometry engine (VIS-01)

`lib/analytics/geometry.ts` rewritten as the single source of all visual math:

- `calcTrendCurveGeometry(points, tRequiredMm, crGoverningMmYr, gaugeUncertaintyMm, width, height)` — projects ISO-dated readings onto the plot area; computes the historical polyline (`historyPath`), the linear degradation projection (`trajectoryPath`), the ±gauge-uncertainty parallelogram envelope (`uncertaintyPath`), the dashed anomaly marker (`anomalyPath`, CR < 0 only), the exact t_required intercept point with a YYYY-MM date, the t_required line Y, first/middle/last axis ticks, and projected data-point pixel coordinates for hover overlays. All drawn geometry is clamped into the scale domain — never emits NaN/Infinity, validated against degenerate viewports (down to 10×10 px) and NaN inputs.
- `calcCmlHeatmapGeometry(cmls, width, height)` — uniform square cells (no distortion), centered fit, verdict band colors #16a34a / #d97706 / #dc2626, `marginPct` projection, graceful degradation for >100-location registers and empty registers (`cellSize: 0`).
- `calcGaugeGeometry(currentMm, tRequiredMm, tNominalMm, radius)` — circumference, clamped dashoffset fill, band coloring (≥20% green, 0–20% amber, <0% red; negative margins render red at zero fill).

Sovereignty honored: the engine projects precomputed evaluate() outputs; no engineering arithmetic, no criteria edits.

### Task 2 — Web analytics components (VIS-02/03/04)

- `components/analytics/trend-curve.tsx`: responsive SVG, GPU-compositor line-draw animation (strokeDashoffset driven by a CSS keyframe + custom property), plain-DOM hover tooltip (date, thickness, delta vs previous reading), accessibility role/aria-label, measurement-anomaly badge, motion-reduce utilities.
- `components/analytics/cml-heatmap.tsx`: verdict-band cell fills, click-to-select relay (`onSelect`) enabling host table-row highlight, plain-DOM hover tooltip (CML ID, measured thickness, margin percent, governing clause), always-visible governing-clause caption, per-verdict count legend.
- `components/analytics/metric-gauge.tsx`: circular SVG arc with animated dashoffset on mount, band coloring from the geometry engine, aria-label with margin percent, CR sub-caption.
- `app/globals.css`: added the `trend-draw` keyframe plus a global `@media (prefers-reduced-motion: reduce)` fallback that forces final states instantly.

### Task 3 — Vector PDF integration (PDF-01/PDF-02)

- `components/report/pdf-trend-curve.tsx`: server-safe @react-pdf/renderer vector trend curve consuming the identical geometry output; typography strictly Helvetica/Courier via a single typed `SvgText` helper (the v4 TS overload narrows SVG Text props to SVGPresentationAttributes while the runtime honors fontSize/fontFamily props — the helper keeps the narrowing honest at one site).
- `components/report/pdf-heatmap.tsx`: compact vector severity matrix for page 1, with a one-line Courier acceptance/re-check/fail legend; dense registers (>100 locations) degrade by shrinking uniform cells rather than overflowing the viewBox.
- `components/report/pdf-document.tsx`: heatmap mounted adjacent to the top-10 table on page 1; governing-CML trend curve mounted above the detail register on page 2. Added pure exported adapters `buildGoverningTrendPoints` and `toHeatmapItems`. Sign-off hash seal mechanics untouched.

### Task 4 — Screen 3 integration and explainability layer (Decisions 5 & 6)

- **Web mount (implemented late — correction)**: the three web components are hosted in a collapsible "Visual Inspection Analytics" panel in Screen 3 (`components/wizard/screen-results.tsx`, `VisualAnalyticsPanel`, default-expanded with an aria-expanded disclosure), mounted above the findings tabs/table. The heatmap receives one item per evaluated CML via the shared `lib/analytics/adapters.ts` `buildLatestPerCml` adapter (latest reading wins per `cml ?? location` identity — NOT the local `pdf-document.tsx` adapters, which stay PDF-owned); the trend curve receives the governing CML's dated history + t_required via `buildGoverningTrendPoints`; the gauge receives the governing CML's safety margin (t-actual vs t-required against unit-converted t-nominal via `lib/calc/units.toMm`) and governing CR. The heatmap's `onSelect` relay drives the results-table row highlight: the panel state `selectedCmlId` flows into `ResultsTable` as `highlightedCmlId`, and matching rows (`cml ?? location` identity) swap the row token class to `bg-secondary` and carry the `data-testid="results-row-highlighted"` hook (`ROW_HIGHLIGHTED_TESTID`). Zero readings render the `visual-analytics-empty` friendly empty state — never an empty SVG shell. Focused suite: `tests/analytics/screen3-mount.test.tsx` (3 tests). NOTE: the pre-correction claim of a Screen 3 mount was FALSE — screen-results.tsx was untouched on this branch until commit `e30965b`; the gauges/panel derive no engineering number.
- **Decision 5 — Explainable Fail-Closed Review Block** (`components/review/fail-closed-review-block.tsx`): rendered when a System-1 choice gate fires fail-closed (p < 0.85, the fluid-classifier threshold). It renders the full precomputed probability distribution verbatim as a descending bar list (e.g. "class_1 at 62.0% vs class_3 at 58.0%"), marks the selected class, quotes the input snippet that drove the uncertainty ("trace H2S present, operating pressure not stated"), lists what evidence would disambiguate (process datasheet composition, operating pressure/temperature), and lists remedial steps (confirm fluid service class against the process datasheet per API 570 §6.3; route to the Level 2 inspector of record). The layer narrates around the precomputed distribution — it never re-classifies.
- **Decision 6 — Reasoned Guard Failure Report** (`components/review/guard-failure-report.tsx`): rendered when the semantic guard rejects a narrative. States what the narrative claimed, what the precomputed verdict actually is, and that the deterministic fallback was served. Two audiences kept strictly distinct: operator/developer remediation (inspect the audit log; fix the prompt or the numeric/citation lint — internal diagnostics only) versus inspector-facing guidance ("The deterministic fallback verdict was served and is fully authoritative. Trust the fallback verdict."), with prompt/lint internals deliberately excluded from the inspector-facing block.
- **PDF-03**: zero new packages added; verified via package.json/package-lock.json diff.
- **PDF-04**: motion-reduce utilities on all animated elements plus a global reduced-motion media query.

## Decisions

1. Geometry is the single source of visual math; web and PDF renderers consume identical path strings, scales, ticks, and bounds from lib/analytics/geometry.ts (decisions 1–2 of 09-CONTEXT).
2. Pure calc invariant honored: lib/analytics/ projects precomputed evaluate() outputs only; lib/calc/ and lib/criteria/ remain byte-identical to baseline 2ce76be.
3. Decision 5 honored: the fail-closed review block narrates around the precomputed distribution and never re-classifies; the distribution never leaves the safe side of the seam.
4. Decision 6 honored: operator/developer remediation (audit log, prompt/lint fixes) kept strictly separate from inspector-facing guidance ("trust the fallback verdict"); prompt/lint internals deliberately excluded from the inspector-facing block.
5. The obsolete Phase-7 stub `components/report/pdf-analytics.tsx` was removed in favor of the plan-named `pdf-trend-curve.tsx` / `pdf-heatmap.tsx` split.
6. Tick interface exposes `pos` plus `x` and `y` for backward compatibility with both component stacks.
7. Zero new npm packages (PDF-03): animations use native CSS keyframes; charts use native SVG and @react-pdf/renderer primitives only.
8. No model IDs hardcoded in source or tests; provider routing remains env-only.

## Verification Evidence

- `npx tsc --noEmit`: clean (zero errors) at completion.
- Full hermetic suite under `FLAWCHECK_DISABLE_LLM=1 npm test`: **676 passed / 6 skipped** (64 test files) after the Screen 3 mount correction (commit `e30965b`), up from the pre-Phase-09 baseline of **618 passed / 6 skipped** — +58 hermetic tests total, zero regressions, zero network.
- New suites: `tests/analytics/geometry.test.ts` (20 tests), `tests/analytics/visual-render.test.tsx` (14 tests), `tests/review/explainable-review.test.tsx` (14 tests), `tests/pdf/pdf-analytics.test.ts` (7 tests), `tests/analytics/screen3-mount.test.tsx` (3 tests) = 58 hermetic tests.
- `npx vitest run tests/analytics tests/review tests/pdf/pdf-analytics.test.ts`: 58 passed / 0 failed (5 files).
- `git diff 2ce76be..HEAD -- lib/calc/ lib/criteria/ lib/analytics/ components/analytics/`: empty — protected trees and the tested analytics components byte-identical (integration-only mount).
- `git diff 2ce76be..HEAD -- lib/calc/ lib/criteria/`: empty (0 bytes) — byte-identical protected trees.
- `git diff HEAD -- package.json package-lock.json`: empty — zero new packages (PDF-03).
- Grep gate: no hardcoded model IDs (`nvidia/`, `meta-llama/`, `openai/gpt`) anywhere in lib/, components/, tests/, or app/.
- Edge coverage verified: zero CR, negative CR, immediate failure, single reading, >100-location registers, degenerate viewports (no NaN/Infinity), reduced motion.

## Commits

| Commit | Description |
| --- | --- |
| `43afc51` | Implement shared pure geometry engine and web/PDF analytics (VIS-01..04, PDF-01..02) |
| `769d54e` | Build animated web analytics components (VIS-02/03/04) |
| `3a7ed27` | Add vector PDF analytics and integrate into report (PDF-01/02) |
| `7ffed8b` | Fix audit fixture type and PDF tree assertions |
| `d17925a` | Point shared-geometry scan at pdf-trend-curve/pdf-heatmap (stub removed) |
| `e30965b` | Mount visual analytics panel in Screen 3 — heatmap onSelect row-highlight relay (closes VIS-03 integration gap) |

Correction note: an earlier draft of this table referenced commits `9d4c21f` and `b2f810c` — neither exists on `feat/subq-snap` (verified via `git cat-file`); they were phantom entries and are removed. The only Screen 3 mount commit is `e30965b`.

## Remaining Limits

- `next build` cannot complete in this worktree because node_modules is an NTFS junction to the root repo's install, which the Next.js/Turbopack resolver rejects as out-of-root; `npx tsc --noEmit` and the hermetic suite are the operative gates, and a full `next build` should be run from the root repo checkout before the submission freeze.
- Decision-5 blocks present the full distribution from ChoiceResults verbatim; ChoiceResults without an attached distribution degrade to a distribution-free alert. Deep links into the decision audit log and automated prompt-fix suggestions are not yet wired.
- Decision-6 report renders only the information supplied by the guard result; automatic audit-log deep linking and lint-fix suggestions remain unwired.
- Decision 5/6 presentation is validated on synthetic distributions only, not on measured live benchmark data; the comparative System-1 benchmark remains pending a Fork A baseline and verified pricing.
- No internationalization; axis labels follow ISO YYYY-MM / mm conventions.
- 3D visualization and live telemetry streaming remain out of scope per SPEC.
- Browser-based motion verification (actual prefers-reduced-motion behavior in a real browser) was approximated by DOM class assertions per the established environment caveat.
