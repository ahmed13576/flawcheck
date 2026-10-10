---
phase: 02-ingestion-calc-engine
verified: 2026-10-10T08:56:56Z
status: passed
score: 50/50 must-haves verified (0 failed)
behavior_unverified: 0
overrides_applied: 0
covered_files:
  - .planning/phases/02-ingestion-calc-engine/02-01-PLAN.md
  - .planning/phases/02-ingestion-calc-engine/02-01-SUMMARY.md
  - .planning/phases/02-ingestion-calc-engine/02-02-PLAN.md
  - .planning/phases/02-ingestion-calc-engine/02-02-SUMMARY.md
  - .planning/phases/02-ingestion-calc-engine/02-03-PLAN.md
  - .planning/phases/02-ingestion-calc-engine/02-03-SUMMARY.md
  - .planning/phases/02-ingestion-calc-engine/02-04-PLAN.md
  - .planning/phases/02-ingestion-calc-engine/02-04-SUMMARY.md
  - .planning/phases/02-ingestion-calc-engine/02-05-PLAN.md
  - .planning/phases/02-ingestion-calc-engine/02-05-SUMMARY.md
  - UNINSTALL.md
  - app/globals.css
  - app/layout.tsx
  - app/page.tsx
  - components/wizard/column-mapping-panel.tsx
  - components/wizard/confirm-dialog.tsx
  - components/wizard/dropzone.tsx
  - components/wizard/flag-badge.tsx
  - components/wizard/flag-detail-row.tsx
  - components/wizard/metadata-form.tsx
  - components/wizard/parsed-row-table.tsx
  - components/wizard/ptmt-entry.tsx
  - components/wizard/ptmt-triage-list.tsx
  - components/wizard/results-table.tsx
  - components/wizard/screen-ingest.tsx
  - components/wizard/screen-results.tsx
  - components/wizard/screen-review.tsx
  - components/wizard/step-indicator.tsx
  - components/wizard/summary-strip.tsx
  - components/wizard/unit-segmented.tsx
  - components/wizard/verdict-chip.tsx
  - components/wizard/wizard-context.tsx
  - eslint.config.mjs
  - lib/calc/corrosion.ts
  - lib/calc/criteria.ts
  - lib/calc/dates.ts
  - lib/calc/evaluate.ts
  - lib/calc/formulas.ts
  - lib/calc/index.ts
  - lib/calc/interval.ts
  - lib/calc/outliers.ts
  - lib/calc/ptmt.ts
  - lib/calc/remaining-life.ts
  - lib/calc/round.ts
  - lib/calc/units.ts
  - lib/calc/verdicts.ts
  - lib/demo/ATTRIBUTION.md
  - lib/demo/demo-scenario.ts
  - lib/demo/fixtures/tracer-sample.ts
  - lib/demo/fixtures/zenodo-16780668-ut-register.json
  - lib/ingest/csv.ts
  - lib/ingest/group.ts
  - lib/ingest/map.ts
  - lib/ingest/session.ts
  - lib/ingest/validate.ts
  - lib/wizard/format.ts
  - lib/wizard/reducer.ts
  - public/sample-ut-register.csv
  - tests/calc/corrosion.test.ts
  - tests/calc/criteria-sovereignty.test.ts
  - tests/calc/dates.test.ts
  - tests/calc/evaluate.demo.test.ts
  - tests/calc/evaluate.test.ts
  - tests/calc/formulas.test.ts
  - tests/calc/interval.test.ts
  - tests/calc/outliers.test.ts
  - tests/calc/ptmt.test.ts
  - tests/calc/tracer-pipeline.test.ts
  - tests/calc/verdicts.test.ts
  - tests/ingest/boundary-imports.test.ts
  - tests/ingest/demo-fixture.test.ts
  - tests/ingest/group.test.ts
  - tests/ingest/map.test.ts
  - tests/ingest/units-gate.test.ts
  - tests/ingest/validate.test.ts
  - tests/wizard/color-scheme.test.ts
  - tests/wizard/reducer.test.ts
  - tests/wizard/results.test.ts
covered_digest: "v3:sha256:560f20da39adf749116fce45b86ad28156b7a1016ceed4f2513be977ca6ac3a4"
re_verification:
  previous_status: passed (after orchestrator browser walkthrough 2026-09-27)
  previous_score: 50/50
  gaps_closed: []
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "API 570 §7.1.1 RL clamp in lib/calc/remaining-life.ts (t_actual <= t_required → 0.0 yr) is implemented and the G14 demo loop pins rlYears <= 0 over real rows, but no test discriminates the clamp value itself — the <= 0 assertion also held under the pre-clamp negative RL, and no unit test asserts remainingLife(...) === 0 for a below-t_required reading"
    category: other
    reason: "New-scope behavior merged with adversarial review after the 2026-09-27 verification; a one-line exact pin (remainingLife(19.45, 19.85, 0.3049) === 0) would close it"
    evidence_status: "grep of tests/calc + tests/wizard found no === 0 RL-clamp assertion; no test fails"
---

# Phase 2: Ingestion & Deterministic Calc Engine — Verification Report (REGENERATED)

**Phase Goal:** Raw inspection data in, deterministic verdicts out — CSV upload with editable mapping preview, component metadata, and PT/MT notes feed a pure, unit-tested calc engine (t-required, short/long-term corrosion rate, remaining life, verdict bands, outliers, re-inspection interval) that would stand alone even if every LLM call failed.
**Verified:** 2026-10-10T07:16:48Z
**Status:** passed
**Re-verification:** Yes — regeneration. The 2026-09-27 report was stale: covered files drifted after legitimate post-milestone fixes (lib/calc/remaining-life.ts RL clamp, lib/wizard/format.ts rlCell/formatFlagLabel, app/globals.css color-scheme, plus uncovered Phase 3+ work in lib/reasoning and components). Must-haves are reused verbatim from the prior report and re-checked against current code.

## Regeneration Summary

The prior report's 50 must-have truths were re-verified against the CURRENT codebase. All still hold. The three post-verification drifts are implemented, test-pinned, and non-breaking:

1. **lib/calc/remaining-life.ts — API 570 §7.1.1/§7.2 RL clamp** (`t_actual <= t_required → 0`): implemented at lines 24-28 with the standard cited. All G-catalog and demo tests green — no golden value regressed (no test pinned a negative RL). See advisory: the clamp's exact-0 value is not discriminated by any test (advisory only — no must-have covers it).
2. **lib/wizard/format.ts — `rlCell()` RETIRED subtext + `formatFlagLabel`**: both implemented and pinned by `tests/wizard/results.test.ts` (lines 113-151: rlCell `<= 0 → { years: "0.0", subText: "RETIRED / IMMEDIATE ACTION" }`, formatFlagLabel uppercase labels).
3. **app/globals.css — `color-scheme` declarations**: `color-scheme: light` (line 21) and `color-scheme: dark` (line 82) present; directly pinned by the new `tests/wizard/color-scheme.test.ts` (3 tests, green) which asserts the dark token block declares `color-scheme: dark` so native select popups stay legible in the forced-dark theme.

Uncovered drift (lib/reasoning/*, components/wizard/reasoning-pane.tsx, tests/reasoning/*, tests/report/*, Phase 3+ artifacts) is out of scope for this phase and does not touch any covered file.

## 1. Gates (run by this verifier, this session)

| Gate | Command | Result | Status |
| ---- | ------- | ------ | ------ |
| Full hermetic suite | `NEBIUS_API_KEY="" FLAWCHECK_LIVE_LLM="" npx vitest run` | **513 passed / 5 skipped** (49 files passed, 2 skipped = live-gated tests/llm + tests/reasoning), 7.0 s, zero network | PASS |
| Typecheck | `npm run typecheck` | exit 0 | PASS |
| Lint (covered files) | `npx eslint lib/calc lib/ingest lib/wizard lib/demo components/wizard app/page.tsx` | 0 errors (3 warnings, all in `components/wizard/reasoning-pane.tsx` — a Phase 3+ file outside the covered set) | PASS |
| Lint (workspace) | `npm run lint` | 0 errors, 14 warnings — all in uncovered Phase 3+ test files except the pre-existing, ledgered unused-var warnings in covered `tests/ingest/group.test.ts` | PASS |
| Decision coverage | `gsd_run query check.decision-coverage-verify` | skipped — no trackable decisions in 02-CONTEXT.md (non-blocking gate) | N/A |

Suite growth since the prior verification (280 → 513 tests) reflects Phase 3+ work; every Phase 2 golden and logic pin (G1-G14, P1-P7, reducer, validate catalog, purity guards) remains green unchanged.

## 2. Covered-File Drift Audit

| Covered file | Drift since 2026-09-27 | Must-have impact | Status |
| ------------ | ---------------------- | ---------------- | ------ |
| `lib/calc/remaining-life.ts` | RL clamp added (API 570 §7.1.1: t_actual <= t_required → 0.0 yr) | Strengthens the G14 truth ("never a negative interval / past date") — no golden value regressed, all G1-G14 green | HOLDING (drift noted) |
| `lib/wizard/format.ts` | `rlCell()` + `formatFlagLabel()` added; existing helpers untouched | UI-19/'—' + sub-text truth extended with the RETIRED subtext — pinned in results.test.ts | HOLDING (drift noted) |
| `app/globals.css` | `color-scheme: light/dark` declarations added | Wizard-shell forced-dark truth unchanged — new pin in color-scheme.test.ts | HOLDING (drift noted) |
| All other 68 covered files | Untouched (fingerprint diff; suite green) | — | HOLDING |

## 3. Must-Have Re-verification (50 truths — reuse from prior report)

Full per-truth evidence tables are in the prior report body (sections 2-7) and remain valid: the truth-supporting files either did not drift, or drifted in the three documented ways above with the supporting test pins green this session. Spot re-checks run this session:

- **Purity:** `tests/ingest/boundary-imports.test.ts` + `tests/calc/criteria-sovereignty.test.ts` green — zero lib/llm/react/node imports, zero Date.now/Math.random, no bare criteria literals.
- **Golden calc:** all G-catalog exact-`toBe` pins green (tracer-pipeline, formulas, corrosion, verdicts, interval, ptmt, outliers, dates, evaluate).
- **Ingestion:** validate catalog, map, group, units-gate, demo-fixture, sample-register tests green — including the CR-01/CR-02 regression pins.
- **Wizard logic:** reducer (38 tests) and results formatter pins green.
- **Drift pins:** color-scheme.test.ts (3), results.test.ts rlCell/formatFlagLabel — green.

**Score:** 50/50 truths verified. No truth FAILED, no artifact MISSING/STUB, no key link NOT_WIRED, no blocker anti-pattern.

## 4. Requirements Coverage

| Requirement | Status | Evidence |
| ----------- | ------ | -------- |
| ING-01..05, CALC-01..04 (all 9 mapped to Phase 2 in REQUIREMENTS.md) | SATISFIED | Same evidence base as the prior report (§7 there); all supporting test files green in this session's 513-test run. No orphaned requirements. |

## 5. Human Verification

All 4 browser-interactive residues from the prior report were resolved by the recorded orchestrator browser walkthrough of 2026-09-27 (drag-hover, interactive walkthrough, visual table contract at 4,912 rows, zero-CML empty state) — see that section in the report history. The three post-walkthrough drifts are additive and logic/CSS-contract-test-pinned; they introduce no new interactive residue. **human_verification: []** — no open human items.

## 6. Anti-Patterns (this pass)

No TBD/FIXME/XXX/HACK debt markers in any covered file (grep this session: zero matches). Covered phase-2 sources lint clean (0 errors). One advisory finding recorded in frontmatter (unpinned RL-clamp value).

---

_Verified: 2026-10-10T07:16:48Z_
_Verifier: Claude (gsd-verifier) — regeneration run; fingerprint computed via gsd-tools verification.fingerprint over the 79-file covered set_
