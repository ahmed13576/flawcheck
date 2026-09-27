# Phase 2: Ingestion & Deterministic Calc Engine - Context

**Gathered:** 2026-09-27
**Status:** Ready for planning
**Mode:** Smart-discuss (prior decisions cover the grey areas — locked in handoff.md §5, grilling_decisions, and lib/criteria)

<domain>
## Phase Boundary

Raw inspection data in, deterministic verdicts out — CSV upload with editable mapping preview, component metadata, and PT/MT notes feed a pure, unit-tested calc engine (t-required, short/long-term corrosion rate, remaining life, verdict bands, outliers, re-inspection interval) that would stand alone even if every LLM call failed. No LLM reasoning in this phase (Phase 3 owns narrative); the calc engine and its wizard screens (1-2) are the deliverable.

</domain>

<decisions>
## Implementation Decisions

### Wizard Screens (locked — handoff.md §5)
- Screen 1 — Landing & Ingestion: CSV dropzone + prominent "Load Demo Scenario" button (preloaded Zenodo ballast-tank subset, 4,912 real readings) + sample CSV download template + format guide.
- Screen 2 — Data Review & Component Metadata: editable parsed-row table with per-row validation badges and column-mapping dropdowns; metadata form: OD, t-nominal, FCA, Design Code, Piping Class (1-3), Gauge Uncertainty (±0.1 mm default, user-configurable), optional PT/MT notes.

### Calculation Rules (locked — lib/criteria/ut-criteria.json, machine source of truth)
- `t_required = max(t_pressure, t_structural)` — governing rule added 2026-09-27 (API 574 §10.5.1.4, verified); t_pressure via ASME B31.3 Eq. 3a `t = (P*OD)/(2*(S*E*W + P*Y)) + FCA` or API 574 Barlow in-service `t = (P*OD)/(2*S*E)`; t_structural from API 574 Annex D tables.
- Corrosion rates: CR_LT and CR_ST per API 570 §7.1.2; governing = max(LT, ST), both surfaced. Negative CR → clamp to 0 for RL + "measurement inconsistency" warning flag (negative_cr_policy).
- Remaining life: RL = (t_actual − t_required) / CR_governing; zero/negative CR after clamp → "insufficient corrosion history" state, never Infinity.
- Inspection interval: min(RL/2, class max); RL < 4 yr → min(RL, 2.0). Class maxima (VERIFIED against API 570 5th Ed. Table 1 p.52 on 2026-09-27): Class 1 = 5 yr, Class 2 = 10 yr, Class 3 = 10 yr, Class 4 = optional. (adversarial_review_v2's "Class 2 = 5 yr" claim was REFUTED — that value is the visual-external column.)
- Verdict bands (with boundary_convention, implement in exactly this order): `if (t_actual < t_required) reject; else if (t_actual < t_required + gauge_uncertainty) re_check; else accept`. Gauge uncertainty ±0.1 mm default.
- PT/MT indication acceptance per lib/criteria/ptmt-criteria.json (ASME B31.3 §344.3.2/§344.4.2): >1.5 mm relevance; linear (L>3W) strict reject; rounded reject if >5.0 mm or ≥4 in a line separated by ≤1.5 mm.

### Engineering Constraints (locked)
- `lib/calc/` = pure TypeScript, zero imports from `lib/llm/` — enforced by forbidden-import lint. LLM never computes.
- Units: mm canonical internally; explicit at input (mm/in/mils); mixed units refused; unit assumption surfaced.
- Deterministic math is unit-tested pure functions — golden tests double as demo seed (Zenodo record 16780668 subset) and cached-LLM keys later.
- CSV parsing: column-mapping preview with confirm/correct; row-level specific validation errors; malformed/missing/impossible values rejected loudly. Prefer a zero-dependency parser unless the planner justifies a new package — ANY new package requires explicit user approval (checkpoint).

### Claude's Discretion
Internal calc-engine module structure, fixture file format, table/grid UI component choices, exact validation-error wording — all within the constraints above.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Next.js 16 App Router scaffold (Phase 1): app/, lib/llm/* (validated-call pattern, config), vitest 5 configured with .env.local loader, tsconfig paths, health endpoint pattern
- `lib/criteria/*.json` — ground truth (ut-criteria now includes governing_t_required, boundary_convention, negative_cr_policy, unit_system; citations.json includes api574_10_5_1_4 + api574_annex_d)
- UNINSTALL.md ledger (append Phase 2 section if any install happens)
- Zenodo record 16780668 (CC BY 4.0): Appendix_A_UT_register.csv — 4,912 real readings, 12 tanks, 11 campaigns (columns: Reading_ID, Tank, Grid_Position, Original_Scantling_mm, Measured_Thickness_mm, Measurement_Date)

### Established Patterns
- Phase 1 conventions: env-only config accessors that throw naming the missing var; central validated functions; three-tier error conventions (config throws / calls retry-then-throw / health 503 degraded body)
- `npm run typecheck` runs `next typegen && tsc --noEmit` (fresh-clone safe)

### Integration Points
- Screen 1/2 feed an evaluation-session data model that Phase 3 (reasoning) and Phase 4 (report) consume — design the session state shape deliberately
- No new API routes should call Token Factory in this phase

</code_context>

<specifics>
## Specific Ideas

- Demo data: use the Zenodo tank register as the flagship fixture; builder-authored piping/PT-MT sample CSVs are allowed but MUST be labeled "sample data" in the UI and trace to published worked examples (MSTS/API 570 formulas).
- The demo "Load Scenario" button must work with zero network beyond page load.

</specifics>

<deferred>
## Deferred Ideas

- Fleet triage table, CML trend charts (v2 per REQUIREMENTS.md)
- User-pasted code-excerpt reasoning (v2)

</deferred>
