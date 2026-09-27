---
phase: "02"
plan: "03"
subsystem: ingestion
tags: [ingest, mapping, validation-catalog, grouping, units-gate, demo-fixture, zenodo, attribution]
requires:
  - lib/ingest/csv.ts tokenizer (02-01) — ParsedRow / null-prototype cells
  - lib/ingest/session.ts EvaluationInput seam (02-01 R7)
  - lib/calc/evaluate.ts + lib/calc/units.ts + lib/calc/dates.ts (02-01/02-02)
  - lib/criteria/ut-criteria.json (unit_system block)
provides:
  - lib/ingest/map.ts (normalizeHeader + autoGuess + csvThicknessUnitFromHeader — UI-SPEC alias table verbatim)
  - lib/ingest/validate.ts (rowIssues catalog, locked 'Row {n}: {field} — {problem} ({value}).' formatter; InputLimitError caps T-02-06)
  - lib/ingest/group.ts (groupByCml — R6 campaign-history derivation, wide-format precedence, EvaluationInput[] emission)
  - lib/ingest/session.ts assertUnitsDeclared + EvaluationInputError (ING-05 engine-side gate)
  - lib/demo/fixtures/zenodo-16780668-ut-register.json (4,912 real readings, CC BY 4.0) + ATTRIBUTION.md + demo-scenario.ts
  - public/sample-ut-register.csv (sample download asset, _mm suffix drives unit auto-guess)
affects:
  - 02-04 (wizard wiring: dropzone caps, mapping panel re-validation, Run Evaluation gate call, demo loader)
  - 02-05 (Screen 3 rendering of ReadingResult incl. cml identity; ~447 first-campaign INSUFFICIENT HISTORY rows asserted there)
tech-stack:
  added: []
  patterns: [single-formatter-error-catalog, null-prototype-cells, derived-campaign-history, static-json-fixture-import]
key-files:
  created:
    - lib/ingest/map.ts
    - lib/ingest/validate.ts
    - lib/ingest/group.ts
    - lib/demo/fixtures/zenodo-16780668-ut-register.json
    - lib/demo/ATTRIBUTION.md
    - lib/demo/demo-scenario.ts
    - public/sample-ut-register.csv
    - tests/ingest/map.test.ts
    - tests/ingest/validate.test.ts
    - tests/ingest/group.test.ts
    - tests/ingest/demo-fixture.test.ts
    - tests/ingest/units-gate.test.ts
  modified:
    - lib/ingest/session.ts (assertUnitsDeclared + EvaluationInputError appended; types untouched)
    - lib/calc/evaluate.ts (outlier population keyed by cml ?? location; cml passed through to ReadingResult; summary.locations = distinct mapped tanks)
decisions:
  - "Fixture assertion numbers are the OBSERVED values, not the research anticipations: real register spans 18.88–20.0 mm (research guessed 19.0–19.98) and source dates were DD/MM/YYYY (normalized to ISO in the transform, documented in ATTRIBUTION.md) — research table rows were MEDIUM-confidence pre-download guesses, marked 'eyeball names at download'; all hard counts (4,912 / 12 tanks / 11 years / 6 columns / scantling 20) held exactly"
  - "Demo mapping deliberately leaves tInitial/tPrevious null — Original_Scantling_mm is a constant nominal design scantling (20), never a measured t-initial; R6 derived campaign history governs the demo (makes 02-05's ~447 insufficient-history assertion well-defined)"
  - "Demo smoke pins the exact observed verdict split 301 accept / 538 re_check / 4,073 fail against t_required 19.85 ± 0.1 gauge — all three bands exercised by real data"
  - "evaluate.ts summary.locations counts distinct mapped-Tank locations (UI-SPEC '4,912 readings · 12 locations'); CML identities (tank + grid) stay finer-grained and only key the outlier population"
metrics:
  duration: ~40 min (two sessions — Task 1 + fixture download landed in the prior session killed by a provider captcha; this session verified on-disk state, committed Task 2, ran Task 3)
  completed: 2026-09-27
  tasks: 3
status: complete
actuals:
  tokens: 200500 # chars/4 over 1,456 changed lines; 745,409 chars is the fixture data file — code-only share ≈ 15,000 tokens
  tasks: 3
  commits: 3
  plan_head_before: b75b4978d9eefa8cd21dadcf8f962f32220e8712
---

# Phase 2 Plan 03: Ingest Library + Zenodo Demo Fixture Summary

Ingestion library complete — alias auto-guess, the locked row-error catalog, R6 campaign-history grouping, the ING-05 units gate — plus the real 4,912-reading Zenodo fixture (CC BY 4.0) committed offline with attribution and a validated demo scenario.

## Tasks Executed

| Task | Name | Commit | Result |
| ---- | ---- | ------ | ------ |
| 1 | Mapping auto-guess, validation catalog, long-format grouping (ING-01 + ING-02 core) | 1ad1d8f | 38 tests green (map 9, validate 18, group 11); typecheck 0 |
| 2 | Zenodo fixture acquisition, transformation, attribution + demo scenario builder | 90be9b0 | 14 tests green; md5-verified download; all bands exercised |
| 3 | Unit-declaration gate + conversion hardening (ING-05 engine side) | 98b744b | 10 tests green (TDD RED→GREEN); toMm constants exact |

## Verification Evidence

- `npx vitest run tests/ingest` → **55/55 passed** (boundary-imports 3, map 9, group 11, validate 18, demo-fixture 14, units-gate 10)
- `npm run typecheck` → exit 0
- `npm run build` → exit 0 (route table rendered)
- `npm test` → 186/187; the single failure is the known Phase 1 live-LLM network flake in `tests/llm/hello-fixture.test.ts` (out of scope, re-logged as deferred item #2)
- Zip integrity: `md5sum scratch/zenodo/RBM_PoF_Model.zip` → `4735bbeca392636f9b2ba91b2c2b42fc` (matches the research-verified checksum; re-verified this session before committing)
- Zip and non-Appendix-A files NOT committed (scratch/ gitignored; `git status` shows only the five intended artifacts)

## Observed Fixture Numbers (real data, gated forever by demo-fixture.test.ts)

| Assertion | Research anticipated | Actually observed |
| --------- | -------------------- | ----------------- |
| Data rows | exactly 4,912 | **4,912** |
| Distinct tanks | 12 (names to eyeball) | **12** — WBT-P1..P6, WBT-S1..S6 |
| Campaign years | 11 (2015–2025) | **11** — 2015–2025 |
| Columns | the exact six | **the exact six** |
| Original_Scantling_mm | 20 constant | **20 constant** |
| Measured_Thickness_mm | 19.0–19.98 (guess) | **18.88–20.0** (observed; test pins the real range) |
| Date format | ISO | **ISO in fixture** (source was DD/MM/YYYY; normalized in transform) |
| Demo verdict split | all three bands present | **301 accept / 538 re_check / 4,073 fail** (exact-pinned) |

## Demo Session Binding Decisions (verified in committed code)

- `mapping.tInitial = null`, `mapping.tPrevious = null` — derived R6 campaign history governs; the constant-20 design scantling never masquerades as a measured t-initial
- `tStructural: 19.85` mm governs (pressure branch non-governing at 0.05 MPa), gauge 0.1 mm, pipeClass 2, isDemo true
- Two structured PT/MT indications: linear MT (L 4.2 × W 0.8) → `reject`; rounded PT (L 1.2 × W 0.9) → `accept` — both triage paths demonstrated
- Smoke assertion: ≥1 ACCEPT, ≥1 RE-CHECK, ≥1 FAIL (plus the exact 301/538/4073 split)

## Deviations from Plan

1. **[Documented data divergence — research anticipation vs observed reality]** The research demo-fixture table's `Measured_Thickness_mm 19.0–19.98` and implied ISO source dates were MEDIUM-confidence pre-download claims. The real register spans 18.88–20.0 mm and ships DD/MM/YYYY dates. Per the plan's own validation instruction ("validate against the research assertion table BEFORE committing… record actual"), the transform normalizes dates to ISO (the only transformation; thickness values verbatim) and the committed test pins the REAL observed range. No golden calc value (G1–G14 / P1–P7) was touched — those all pass unchanged. Files: tests/ingest/demo-fixture.test.ts, lib/demo/ATTRIBUTION.md.
2. **[Session continuation]** The prior executor session was killed by a provider captcha mid-Task-2 (after the download/transform, before commit). This session re-verified every on-disk artifact against the plan's acceptance criteria (md5 re-run, fixture numbers re-computed independently via node, test suite re-executed) before committing. No work was redone blindly and none discarded.
3. **[Rule 3 - Blocking]** None needed. Task 1's evaluate.ts seam amendment (cml-keyed outlier populations + distinct-tank locations count) was already committed with 1ad1d8f and is recorded above under key-files.

## Auth Gates

None (zenodo.org download required no auth).

## Known Stubs

None — every artifact is fully wired: the fixture is real data, the demo scenario builds a complete EvaluationSession consumed end-to-end by `evaluate()` in the smoke test, and the units gate is exported for 02-04's reducer wiring (its UI disable behavior is intentionally deferred to 02-04 by the plan, not stubbed).

## Self-Check: PASSED

- 12 created + 2 modified files all present on disk and committed across 1ad1d8f / 90be9b0 / 98b744b
- 3 commits measured from plan ledger base b75b4978 (`git rev-list --count` → 3)
- 55/55 ingest tests, typecheck, and build all green at SUMMARY time
