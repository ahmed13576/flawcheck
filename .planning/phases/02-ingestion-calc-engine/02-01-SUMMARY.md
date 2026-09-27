---
phase: "02"
plan: "01"
subsystem: calc-engine-wizard-shell
tags: [calc, ingest, tracer, wizard, golden-tests]
requires:
  - lib/criteria/ut-criteria.json (machine ground truth)
  - lib/criteria/citations.json (citation allowlist)
  - lib/criteria/ptmt-criteria.json (loaded via criteria.ts; ptmt.ts lands in 02-02)
provides:
  - lib/calc/* pure spine (criteria, round, units, dates, formulas, corrosion, remaining-life, verdicts) + index barrel
  - lib/ingest/csv.ts RFC 4180 tokenizer (BOM/quotes/CRLF/delimiter-sniff/null-prototype cells)
  - lib/ingest/session.ts R7 JSON-serializable contract incl. EvaluationInput seam + immediate_inspection flag
  - lib/demo/fixtures/tracer-sample.ts 6-row fixture
  - lib/wizard/reducer.ts pure wizard reducer (load-sample / run-evaluation / reset placeholder)
  - components/wizard/{wizard-context,step-indicator,verdict-chip}
  - app/page.tsx wizard root; app/globals.css forced-dark theme
affects:
  - 02-02 (evaluate.ts consumes EvaluationInput; interval/outliers/ptmt extend the barrel; purity gates)
  - 02-03 (group.ts replaces the inline grouping; validate/map replace validate-lite)
  - 02-04 (reducer action expansion; Screen 1/2 components)
  - 02-05 (Screen 3 renders ReadingResult; flag chips extend verdict-chip)
tech-stack:
  added: [] # zero new packages
  patterns: [pure-calc-spine, criteria-json-single-source, null-prototype-csv-cells, canonical-round-at-exit, pure-reducer]
key-files:
  created:
    - lib/calc/criteria.ts
    - lib/calc/round.ts
    - lib/calc/units.ts
    - lib/calc/dates.ts
    - lib/calc/formulas.ts
    - lib/calc/corrosion.ts
    - lib/calc/remaining-life.ts
    - lib/calc/verdicts.ts
    - lib/calc/index.ts
    - lib/ingest/csv.ts
    - lib/ingest/session.ts
    - lib/demo/fixtures/tracer-sample.ts
    - lib/wizard/reducer.ts
    - components/wizard/wizard-context.tsx
    - components/wizard/step-indicator.tsx
    - components/wizard/verdict-chip.tsx
    - tests/calc/tracer-pipeline.test.ts
    - tests/wizard/reducer.test.ts
  modified:
    - app/page.tsx
    - app/globals.css
decisions:
  - "daysToYears rounds to 6 dp at the exit so G13's 10.001369 asserts exactly (toBe)"
  - "requiredThickness returns rounded tPressureMm/tStructuralMm/tRequiredMm + per-branch citations; api574_annex_d added when the structural branch is non-zero"
  - "Tracer grouping/validation lives inline in the reducer + a test-only helper until 02-02/02-03 land evaluate.ts/group.ts (plan-sanctioned thin slice)"
  - "body font switched from the scaffold's Arial stack to var(--font-geist-sans) per UI-SPEC typography contract (Geist Sans is the UI font)"
metrics:
  duration: ~18 min
  completed: 2026-09-27
  tasks: 2
status: complete
actuals:
  tokens: 41600 # chars/4 over 1647 insertions / 21 deletions across 20 files
  tasks: 2
  commits: 2
  plan_head_before: 16cb625740f04901a617ca3ac17cf7cdf26c4c54
---

# Phase 2 Plan 01: Calc Spine Tracer Summary

**One-liner:** 6-row tracer flows tokenize -> group -> pure-calc per-reading t_required/CR/RL -> verdict chips on screen, with 39 golden assertions pinning G1/G2/G4/G8/G9b/G13 values.

## What Was Built

- **lib/calc spine (9 modules):** criteria.ts (single typed import point for the three criteria JSONs; `maxIntervalByClass` narrows typeof-number so Class 4 "optional" cannot reach arithmetic — Pitfall 10), round.ts (roundTo canonicalization), units.ts (exact 25.4 / 0.0254), dates.ts (strict-ISO parse with manual leap-aware validation, daysBetweenUtc, daysToYears = days/365.25 @6dp, addYearsUtc with Feb 29 clamp), formulas.ts (B31.3 eq. 3a + Barlow shapes + governing max(t_pressure, t_structural)), corrosion.ts (rateOutcome per OQ2 — flag on EITHER negative raw rate, floor at 0), remaining-life.ts (null, never Infinity), verdicts.ts (locked boundary order verbatim, uncertainty from criteria), index.ts (public barrel).
- **lib/ingest/csv.ts:** quote-aware RFC 4180 state machine — BOM strip, doubled-quote escapes, CRLF/LF/CR, quoted commas + embedded newlines, delimiter sniff, fully-empty-record skip, trim of unquoted fields, `buildCells` null-prototype row cells (T-02-02 prototype-pollution guard).
- **lib/ingest/session.ts:** the full R7 JSON-serializable contract verbatim + Amendment 1 (EvaluationInput seam) + Amendment 2 (`immediate_inspection` reading flag, G14).
- **Wizard shell:** pure reducer (all logic in the reducer; only the calc barrel + tokenizer imported), 'use client' context, step indicator ("1 Ingest · 2 Review & Metadata · 3 Results", accent/muted), verdict chips (locked base class + ACCEPT/RE-CHECK/FAIL per-verdict classes), wizard root page with Load sample data + per-reading results table (font-mono tabular-nums), forced-dark globals.css (#0a0a0a/#171717/#262626; the scaffold's media-query flip removed).

## Verification (actual results)

- `npx vitest run tests/calc/tracer-pipeline.test.ts` — **31/31 pass** (G1 2.637536; G2 2.656522; G4 0.08/0.3/0.3; G8 rows incl. arithmetic-constructed accept boundary; G9b mixed-sign; G13 3653 days / 10.001369 yr; tokenizer BOM/quoted-CRLF/trailing-newline/sniff/null-proto; pipeline CR_LT **0.029996** exact, summary 2/2/2, finiteness scan, insufficient-history verdicts).
- `npx vitest run tests/wizard/reducer.test.ts` — **8/8 pass** (6 rows, metadata preset, summary {total 6, locations 3, accept 2, reCheck 2, fail 2}, JSON round-trip, reset no-op).
- `npm run typecheck` — exit 0. `npm run build` — exit 0 (6 routes; / prerenders).
- Greps: `lib/llm`, `Date.now(`, `Math.random(` in lib/calc/*.ts → 0; `Object.create(null)` in csv.ts → 1; `prefers-color-scheme` in app/globals.css → 0; chip labels + base-class fragment present; `'use client'` first line of wizard-context.
- Tracer gate (browser): browser-use MCP tooling is **not exposed to this executor session** — verified instead via served-page evidence: live server HTML contains the heading/CTA/step indicator (and not the Phase 1 spike page); compiled CSS carries #0a0a0a/#171717/#262626. The visual click-through (chips visible on screen) is **deferred to the end-of-phase human check** (end-of-phase verify mode; automated verify re-run green before expansion).

## Deviations from Plan

None — plan executed as written. (TDD flow followed: RED run produced import-resolution failures, GREEN after implementation.)

### Auto-fixed Issues

**1. [Rule 1 - Bug] daysInMonth treated the regex month (1-based) as 0-based**
- **Found during:** Task 1 (RED run of the golden test)
- **Issue:** February validated 31 days, so parseIsoUtc('2026-02-31') returned 2026-03-03 instead of null — exactly Pitfall 1's rollover trap, caught by the test before it could ship.
- **Fix:** switched cases to 1-based months (case 2 = Feb; 4/6/9/11 = 30).
- **Files modified:** lib/calc/dates.ts
- **Commit:** a72ce25

**2. [Rule 1 - Bug] Comment text tripped purity/acceptance greps**
- **Found during:** Tasks 1-2 (acceptance greps)
- **Issue:** "lib/llm" appeared in a lib/calc docstring (would fail 02-02's boundary-imports string guard); "prefers-color-scheme" appeared in a globals.css comment (acceptance gate requires count 0).
- **Fix:** reworded both comments.
- **Files modified:** lib/calc/index.ts, app/globals.css
- **Commit:** a72ce25 / 6646b79 (amended)

## Deferred Issues

- Browser human-check for the tracer (click Load sample data, see 6 rows with mixed chips) deferred to end-of-phase — browser automation unavailable to this session; evidence captured via served HTML + compiled CSS instead.

## Known Stubs

None. The reducer's inline grouping/validation is plan-sanctioned temporary scope (replaced by 02-02 evaluate.ts / 02-03 group.ts+validate.ts), not a stub: it computes real results with catalog-exact values today.

## Self-Check: PASSED

- Files: all 18 created + 2 modified verified present on disk.
- Commits: a72ce25, 6646b79 both found in git log.
