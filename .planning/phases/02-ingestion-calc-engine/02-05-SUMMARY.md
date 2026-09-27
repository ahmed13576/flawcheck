---
phase: "02"
plan: "05"
subsystem: wizard-ui
tags: [screen-3, results-table, flag-chips, ptmt-triage, demo-e2e, g14, phase-wrap, uninstall]
requires:
  - lib/calc/evaluate.ts ReadingResult + interval immediate-inspection state (02-02)
  - lib/wizard/reducer.ts run-evaluation (02-04)
  - lib/demo fixture + demo-scenario (02-03)
provides:
  - components/wizard/screen-results.tsx (Screen 3 composition, zero-result edge, footnotes)
  - components/wizard/results-table.tsx (ten locked columns, 50-row pagination, toggleable flag details)
  - components/wizard/summary-strip.tsx + ptmt-triage-list.tsx + flag-detail-row.tsx
  - components/wizard/verdict-chip.tsx FlagChip (rounded-rect data-quality chips)
  - lib/wizard/format.ts (pure precision/degradation formatters — node-testable render path)
  - tests/calc/evaluate.demo.test.ts (the flagship 4,912-row end-to-end proof)
  - UNINSTALL.md Phase 2 zero-install note
affects:
  - Phase 3 (session JSON posts to the LLM routes; verdicts are already rendered-grade)
  - Phase 4 (report inherits ReadingResult fidelity + provenance footnote)
tech-stack:
  added: []
  patterns: [pure-render-helpers, cell-model-formatters, aria-expanded-flag-details, observed-number-pinning]
key-files:
  created:
    - components/wizard/screen-results.tsx
    - components/wizard/results-table.tsx
    - components/wizard/summary-strip.tsx
    - components/wizard/ptmt-triage-list.tsx
    - components/wizard/flag-detail-row.tsx
    - lib/wizard/format.ts
    - tests/wizard/results.test.ts
    - tests/calc/evaluate.demo.test.ts
  modified:
    - components/wizard/verdict-chip.tsx (FlagChip + pure flagChipFor mapping)
    - lib/wizard/reducer.ts (ui.evaluatedAt capture; unused-param hygiene)
    - app/page.tsx (Screen 3 composition + max-w-6xl container)
    - UNINSTALL.md (Phase 2 section)
decisions:
  - "Observed-number pinning over research anticipations: 480 CMLs / 480 first-campaign rows (research guessed ~447); 2,030 insufficient-history rows — 480 true no-history + 1,550 clamp-to-zero from the register's noisy apparent gains (real gauge data); documented as the honest reading of negative_cr_policy"
  - "G14 on real data fires for both reject AND the re_check equality band — RL rounds to 0 at 4 dp for readings exactly at t_required; consistent with the builder decision 'RL <= 0 → immediate'"
  - "lib/wizard/format.ts added (outside the plan's files_modified list) so precision/null/degradation rendering is a pure, node-testable render path — the Infinity/NaN render-scan pins the only route computed numbers take to the DOM"
  - "step-indicator.tsx required no change — current={ui.screen} already activates step 3"
metrics:
  duration: ~35 min
  completed: 2026-09-27
  tasks: 3
status: complete
actuals:
  tokens: 26000 # chars/4 over 984 insertions / 88 deletions (12 files)
  tasks: 3
  commits: 3
  plan_head_before: 7e2f301e0859dd93a302b74054a29342b35479ee
---

# Phase 2 Plan 05: Screen 3 + Demo End-to-End + Phase Wrap Summary

Screen 3 renders every computed quantity with honest degradation states (— / chips / expandable details) at locked precision; the flagship end-to-end test proves the phase goal — raw data in, deterministic cited verdicts out — on all 4,912 real readings; the phase gates close green with the zero-install ledger note.

## Tasks Executed

| Task | Name | Commit | Result |
| ---- | ---- | ------ | ------ |
| 1 | Screen 3 — strip, results table, flag details, PT/MT triage, footnotes | 31e662e | 13 results tests green; typecheck + build green |
| 2 | Demo end-to-end assertions on the real 4,912-row pipeline | 95f8d61 | 12 e2e tests green in ~2s |
| 3 | Phase wrap — full gate, UI sweep, UNINSTALL note | 3fa3cf9 | gate exit 0: 242/242 tests, lint 0 errors, build compiled |

## Verification Evidence

- **Full gate (Task 3, chained):** `npm run typecheck && npm run lint && npm test && npm run build` → **exit 0** — 23 test files, **242/242 tests** (calc golden catalog G1–G14 + P1–P7, ingest suites, wizard reducer/results, demo e2e, boundary + sovereignty guards; the live-LLM network test passed this run), eslint 0 errors (2 pre-existing test-file warnings ledgered), Next build compiled successfully
- **Demo end-to-end (Task 2):** 4,912 readings · 12 locations · 301 accept / 538 re_check / 4,073 fail; non-finite scan over every numeric field of every reading; citationsUsed ⊆ citations.json (in-test walker); PT/MT 1 reject + 1 accept with method-pinned clause ids; CR-degradation (Tank unmapped → every row its own CML → CR null, verdicts still compute)
- **Security sweep:** zero `dangerouslySetInnerHTML` under app/ + components/; zero `eval(`/`new Function(` under lib/ + components/; filenames render as React text nodes only (no shell/filesystem interpolation anywhere)
- **UNINSTALL.md:** Phase 2 no-new-packages section appended (grep 'Phase 2' ≥ 1)

## 24-Row UI Considerations Sweep (all verified, zero unverified)

| Row | Verification |
|-----|--------------|
| UI-01 | dropzone.tsx border-blue-500 + bg-blue-500/5 + border-gray-700 greps; SSR markup; drag visual at UI gate |
| UI-02 | reducer parse-invalid test (rows unchanged) + invalid-file copy grep |
| UI-03 | reducer stage/cancel/confirm tests; confirm-dialog initial focus Cancel + Esc handler |
| UI-04 | start-parse action; role=status 'Parsing {filename}…' grep |
| UI-05 | reducer parse-failure test (CsvParseError list) + 'line {n} — {problem}' panel + Try another file |
| UI-06 | reducer zero-rows test + locked copy |
| UI-07 | reducer set-mapping revalidation tests (missing-value flip); map.test.ts alias suite (02-03) |
| UI-08 | blockingChecks.unmappedRequired flip tests + role=alert banner with locked copy |
| UI-09 | validate.test.ts exact catalog (18) + row-edit badge clearing + border-l-2 border-l-red-500/60 |
| UI-10 | reducer metadataProblems locked copies + metadata-form FieldError rendering |
| UI-11 | reducer P/S gates + E/W/Y inside `<details>` (grep ≥ 1) |
| UI-12 | units-gate.test.ts (02-03) + reducer undeclared-units gate-ordering test |
| UI-13 | review: 4,912-row validate+selector < 1s + 50-row page slicing; results: formatCaption test 'Showing 1–50 of 4,912' |
| UI-14 | truncate + title identity cells; NUMERIC_CELL font-mono tabular-nums whitespace-nowrap |
| UI-15 | screen-results zero-result branch (empty-state copy); demo yields 480 CML rows |
| UI-16 | VerdictChip word labels; boundary equality by engine G8 (verdicts.test.ts) |
| UI-17 | flagChipFor MEASUREMENT INCONSISTENCY + raw-vs-clamped detail + apparent-gain sentence; demo clamp-to-zero rows |
| UI-18 | flagChipFor OUTLIER + re-shoot detail; outlier engine tests (02-02) |
| UI-19 | rlCell/nextInspectionCell dash + 'insufficient corrosion history' sub-text tests; Infinity/NaN render-scan |
| UI-20 | PtmtTriageList locked empty-state copy (grep) |
| UI-21 | DemoBanner conditional on screens 2–3 + verbatim copy |
| UI-22 | page focus effect on [data-screen-heading]; h1 tabIndex -1 |
| UI-23 | reducer evaluation-start/run/failure tests + 'Evaluating…' + evaluation-failure copy greps |
| UI-24 | results.test precision pins (2/3/1 dp) + ten-column order grep |

## Observed Numbers (pinned over anticipations, per the plan's validate-then-record rule)

| Quantity | Research anticipated | Actually observed |
| -------- | -------------------- | ----------------- |
| CMLs (tank + grid) | ~447 | **480** |
| First-campaign (no-history) rows | ~447 (≈9%) | **480** (9.8%) |
| insufficient_history rows | ~447 | **2,030** — 480 no-history + 1,550 clamp-to-zero (noisy apparent gains in the real register) |
| Verdict split | all bands | **301 / 538 / 4,073** |
| Immediate-inspection rows | exists on real data | **present, > 0** (reject + re_check equality band, RL rounds to 0) |

## Deviations from Plan

1. **[Documented data-semantics discovery]** The insufficient-history population is richer than the research's "~447 first-campaign" model: the register's noisy per-campaign apparent gains drive 1,550 additional rows through the negative-CR clamp (governing 0, raw rates surfaced verbatim). Tests document both populations explicitly; the negative_cr_policy handling is the engine's 02-02 contract working as written.
2. **[lib/wizard/format.ts added]** Not in the plan's files_modified list — added as the pure node-testable render path (precision/null/degradation formatters + cell models), satisfying the render-scan acceptance criterion that Infinity/NaN can never reach the DOM.
3. **[Browser human-check approximated]** As in 02-04: SSR markup checks + the 242-test suite stand in for the interactive walkthrough (browser-use MCP unavailable in this executor context; zero-new-packages forbids an automation driver). Ledgered as unrun-verify in WINDOWS.md; the interactive pass belongs to the end-of-phase UI safety gate.
4. **[Lint hygiene]** Two unused-param warnings in lib/wizard/reducer.ts and one unused import in flag-detail-row.tsx fixed in Task 3; two PRE-EXISTING unused-vars in tests/ingest/group.test.ts (02-03's file) left per the scope-boundary rule and ledgered as lint-warnings (lint still exits 0).

## Auth Gates

None.

## Known Stubs

None — Screen 3 is fully wired: real results from the pure engine, real triage cards, real provenance footnotes. The wizard has no placeholder surfaces.
