---
phase: "02"
plan: "04"
subsystem: wizard-ui
tags: [wizard, screen-1, screen-2, reducer, dropzone, mapping-panel, pagination, metadata-form, ptmt, ui-gating]
requires:
  - lib/ingest/* (map auto-guess, validate catalog, group seam, session types — 02-03)
  - lib/calc evaluate barrel (02-02)
  - lib/demo/demo-scenario.ts + fixture (02-03)
  - components/wizard/step-indicator + verdict-chip (02-01)
provides:
  - lib/wizard/reducer.ts (complete action surface: ingest pipeline with T-02-06 caps, demo load, replace-confirm, mapping/row-edit/page, metadata draft, PT/MT, gated run-evaluation)
  - components/wizard/screen-ingest.tsx (six Screen-1 states per contract)
  - components/wizard/{dropzone,confirm-dialog,column-mapping-panel,parsed-row-table,flag-badge,screen-review,metadata-form,ptmt-entry,unit-segmented}.tsx
  - app/page.tsx (full wizard composition, UI-21 banner, UI-22 focus)
  - app/layout.tsx (title FlawCheck / NDT Inspection Copilot)
affects:
  - 02-05 (Screen 3 full locked column set; results fidelity UI-15..20, UI-24; XSS sweep)
  - Phase 3 (the wizard store posts the JSON-serializable session)
tech-stack:
  added: []
  patterns: [reducer-owned-validation-path, string-draft-metadata, page-slice-pagination, hand-rolled-focus-trap, gate-chain-run-evaluation]
key-files:
  created:
    - components/wizard/screen-ingest.tsx
    - components/wizard/dropzone.tsx
    - components/wizard/confirm-dialog.tsx
    - components/wizard/screen-review.tsx
    - components/wizard/column-mapping-panel.tsx
    - components/wizard/parsed-row-table.tsx
    - components/wizard/flag-badge.tsx
    - components/wizard/metadata-form.tsx
    - components/wizard/ptmt-entry.tsx
    - components/wizard/unit-segmented.tsx
  modified:
    - lib/wizard/reducer.ts (complete rewrite of the action surface; state extends EvaluationSession)
    - components/wizard/wizard-context.tsx
    - app/page.tsx
    - app/layout.tsx
    - lib/ingest/session.ts (UNITS_DECLARED_COPY exported)
    - tests/wizard/reducer.test.ts (92 → ~490 lines; 22 → 38 tests)
decisions:
  - "WizardState extends EvaluationSession (additive ui field) — the R7 session contract stays flat + JSON-serializable and 02-01 tests kept their assertions verbatim"
  - "Locked metadata error copies live in the reducer's metadataProblems (single source) and render through the form's FieldError — the plan's grep gate is satisfied at lib/wizard/reducer.ts, not metadata-form.tsx, so the copy can never drift between validation and display"
  - "TRACER_MAPPING.tInitial -> null and tracer preset tNominal -> 8.0: the constant-20 Original_Scantling_mm is a design scantling, not a measured t-initial (demo decision applied); golden values (rawCrLt 0.029996 etc.) preserved exactly"
  - "Run Evaluation gate chain: blockingChecks refuses BEFORE assertUnitsDeclared BEFORE groupByCml/evaluate — reducer test proves a null-unit session never reaches the engine"
  - "CSV unit re-guesses only while the user has not manually overridden it (ui.csvThicknessUnitManual)"
metrics:
  duration: ~55 min
  completed: 2026-09-27
  tasks: 3
status: complete
actuals:
  tokens: 52000 # chars/4 over 2,609 insertions / 230 deletions (16 files)
  tasks: 3
  commits: 3
  plan_head_before: 00327cf9347a6cce126d1cd054b732b0a95fedb6
---

# Phase 2 Plan 04: Wizard Screens 1-2 + Full Reducer Surface Summary

Screens 1-2 built to the UI-SPEC contract — every dropzone state, auto-guessed overridable mapping with loud per-row errors at 4,912-row scale, full metadata form with the OQ1 MPa|psi selector, PT/MT entry, and a Run Evaluation gate that chains blockers → units gate → pure engine.

## Tasks Executed

| Task | Name | Commit | Result |
| ---- | ---- | ------ | ------ |
| 1 | Screen 1 — landing, dropzone states, replace-confirm, demo provenance | b086f3d | typecheck + build + 22 reducer tests green |
| 2 | Screen 2 — mapping panel, parsed-row table, footer gating | 9df719d | 29 reducer tests green; build green |
| 3 | Screen 2 — metadata form, MPa\|psi, PT/MT entry, evaluation gating | 2592e6d | 38 reducer tests green; typecheck + build green |

## Verification Evidence

- `npx vitest run tests/wizard/reducer.test.ts` → **38/38 passed** (ingest pipeline, demo 4,912-row load, replace flow, navigation, mapping revalidation, row-edit badge clearing, blocking-selector flips, metadata locked copies, PT/MT round-trip + JSON contract, run-evaluation success/failure/units-gate ordering, pagination speed < 1s at 4,912 rows)
- `npm run typecheck` → exit 0; `npm run build` → exit 0
- `npm test` → 216/217 (the single failure is the pre-existing Phase 1 live-LLM network flake in tests/llm — deferred items #1/#2, unrelated files)
- Grep gates: Screen-1 copy set + dragover classes + confirm-dialog contract + mapping-panel required fields + table caption/border classes + Evaluating…/evaluation-failure copy — all present
- SSR markup verification (production `next start`): page renders the full Screen 1 contract — header, step indicator, dropzone copy, Load Demo Scenario + sub-caption, sample CSV link (serves 200 text/csv with the exact alias headers), format guide; no Phase 3/4 affordances (no "Download PDF")

## Acceptance Highlights

- **UI-01..06**: dragover accent classes, invalid-file copy naming the file, focus-trapped replace-confirm (initial focus Cancel, Esc = Cancel), parsing role=status, parse-failure panel with `line {n} — {problem}` + Try another file, zero-rows copy — all state paths reducer-tested
- **UI-07..09**: auto-guess preselection, overridable `— not mapped —`, revalidation on every mapping/cell change (missing-value flip asserted), locked `Row {n}: …` messages rendered verbatim with aria-invalid/aria-describedby
- **UI-10..12**: metadata copies verbatim; P/S + E/W/Y in a collapsed details; units gate wired into the disable chain (UI-12 disable behavior is belt-and-braces — the segmented controls always declare mm by default)
- **UI-13**: pagination by 50-row slicing (useMemo page slice + memoized rows); caption composition `Showing 1–50 of 4,912`
- **UI-21/22/23**: demo banner persists on Screens 2-3; focus lands on the screen heading (tabIndex -1) after transitions; Evaluating… state + evaluation-failure banner with button re-enable

## Deviations from Plan

1. **[Documented single-source choice]** The plan's grep gate expects the three locked metadata error copy strings inside metadata-form.tsx. They live in `lib/wizard/reducer.ts`'s `metadataProblems` (the single validation source) and render through the form's `FieldError`. Grep in metadata-form.tsx returns 0 by design — duplicating the strings in the component would create a drift path the 02-03 validation-catalog work explicitly engineered away. All three strings are asserted verbatim by reducer tests.
2. **[Rule 1 - bug carried from tracer]** TRACER_MAPPING.tInitial was `Original_Scantling_mm` (constant 20). The new groupByCml wide-format precedence would feed that constant into CR_LT and break the golden tracer values (rawCrLt 0.029996). Fixed by nulling tInitial/tPrevious (the demo's own documented decision) — golden values now pass through the groupByCml seam unchanged; tracer preset tNominal 0 → 8.0 so the preset passes the new metadata gate (tNominal is form context, never used by engine formulas).
3. **[Browser human-check approximated]** The plan's browser GUI human-check items could not run interactively: the browser-use MCP (`node_repl`) is not available in this executor context and zero-new-packages forbids installing an automation driver. Substituted verification: SSR markup checks against the production build (full Screen 1 contract, sample CSV asset, prohibition sweep) + the 38 reducer tests covering every interactive state path. The interactive walkthrough (dragover visuals, focus trap feel, focus transitions) remains for the end-of-phase UI safety gate (`workflow.ui_safety_gate: true`).
4. **[UI-12 note]** `EvaluationSession.units` types are non-nullable (R7), so the "undeclared" state is unreachable through normal UI flow — the segmented controls always declare mm by default. The gate is wired at the engine boundary exactly as 02-03 planned ("wiring proof lands in Plan 02-04"): reducer refuses on `unitsUndeclared` and `assertUnitsDeclared` runs before any calc call, proven by the cast-based reducer test.

## Auth Gates

None.

## Known Stubs

None. Screen 3 currently renders the tracer's working results view (summary strip + verdict chips) carried forward from 02-01 — Plan 02-05 owns the full locked column set; nothing on Screens 1-2 is a placeholder.
