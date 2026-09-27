---
phase: "02"
plan: "02"
subsystem: calc-engine
tags: [calc, golden-tests, purity-gates, ptmt, outliers, interval]
requires:
  - lib/calc/* spine from 02-01
  - lib/criteria/*.json (ut, ptmt, citations)
provides:
  - lib/calc/interval.ts (API 570 6.3.3 half-life rule + G14 immediate-inspection state)
  - lib/calc/outliers.ts (Iglewicz-Hoaglin modified z, OUTLIER_Z_THRESHOLD)
  - lib/calc/ptmt.ts (ASME B31.3 344.3.2/344.4.2 triage, thresholds from JSON)
  - lib/calc/evaluate.ts (the group->results orchestration; EvaluationInput[] + metadata -> EvaluationResults)
  - eslint no-restricted-imports gate over lib/calc + boundary-imports + criteria-sovereignty guard tests
affects:
  - 02-03 (group.ts emits EvaluationInput for evaluate; validate/catalog)
  - 02-04 (Run Evaluation calls evaluate through the reducer)
  - 02-05 (Screen 3 renders ReadingResult; results-table renders nextInspection/flags)
tech-stack:
  added: []
  patterns: [eslint-forbidden-imports, comment-stripping-sovereignty-grep, module-specifier-purity-scan]
key-files:
  created:
    - lib/calc/interval.ts
    - lib/calc/outliers.ts
    - lib/calc/ptmt.ts
    - lib/calc/evaluate.ts
    - tests/calc/interval.test.ts
    - tests/calc/outliers.test.ts
    - tests/calc/ptmt.test.ts
    - tests/calc/dates.test.ts
    - tests/calc/corrosion.test.ts
    - tests/calc/formulas.test.ts
    - tests/calc/verdicts.test.ts
    - tests/calc/evaluate.test.ts
    - tests/ingest/boundary-imports.test.ts
    - tests/calc/criteria-sovereignty.test.ts
  modified:
    - lib/calc/index.ts
    - lib/calc/dates.ts
    - eslint.config.mjs
decisions:
  - "MAD canonicalized to 6 dp at the modifiedZScores exit (R4) — the |a-b| subtraction drift broke G11's MAD 0.01 toBe; score arithmetic unchanged"
  - "Boundary-imports guard matches module SPECIFIERS (segment 'llm' or 'lib/llm'), not raw substrings — the negative proof showed '../llm/config' evaded a naive 'lib/llm' match"
  - "Sovereignty scan strips block comments, line comments, and string/template literals before checking 0.1/1.5/5.0/10.0/5; ptmt detail copy renders loaded criteria values via templates so no literal leaks"
  - "PT/MT detail strings use max_rounded_dimension_mm.toFixed(1) so the UI copy renders '5.0 mm' exactly as the UI-SPEC contract states"
metrics:
  duration: ~25 min
  completed: 2026-09-27
  tasks: 3
status: complete
actuals:
  tokens: 33500 # chars/4 over 1348 insertions / 1 deletion
  tasks: 3
  commits: 3
  plan_head_before: ab65a48a58675394f465a6a1d95f1d65af983ff3
---

# Phase 2 Plan 02: Full Calc Engine + Golden Suites Summary

**One-liner:** The engine stands alone — interval (API 570 6.3.3 + Table 1 caps), modified-z outliers, PT/MT triage, and the evaluate() orchestration, all golden-tested G1-G13 + P1-P7 with eslint/test purity and criteria-sovereignty gates.

## What Was Built

- **lib/calc/interval.ts** — `nextInterval(rlYears, pipeClass)`: min(RL/2, class max); RL < 4 -> min(RL, 2.0); class maxima (5/10/10) loaded through criteria.ts with typeof-number narrowing; G14 builder decision verbatim — RL <= 0 returns `{ intervalYears: 0, state: "immediate-inspection" }`, never a negative interval.
- **lib/calc/outliers.ts** — median/MAD modified z per Iglewicz-Hoaglin; `OUTLIER_Z_THRESHOLD = 3.5` named constant with the OQ4 rationale; n >= 4 gate; MAD-0 degenerate guard; MAD canonicalized at the exit.
- **lib/calc/ptmt.ts** — relevance (strict >), linear (strict L > 3W), aligned cluster (count >= 4 AND sep <= max, Infinity default), oversized-rounded (strict >), crack-suspect re_check; all thresholds from ptmt-criteria.json; clause ids from the method map; detail copy renders loaded values (5.0 via toFixed(1)).
- **lib/calc/evaluate.ts** — per-reading orchestration (OQ5 granularity): metadata canonicalized via toMm at entry, governing t_required, rateOutcome with raw rates surfaced, RL null-never-Infinity, nextInterval anchored to the measurement date via addYearsUtc, outliers per CML population (n >= 4), verdict band, summary {total, locations, accept, reCheck, fail}, deduped citationsUsed, PT/MT indication triage. G14: immediate-inspection sets the flag, nextInspection null.
- **Gates** — eslint `no-restricted-imports` scoped to lib/calc (LLM layer + react/next/node:*); boundary-imports vitest guard (module-specifier LLM scan + Date.now(/Math.random( source scan); criteria-sovereignty guard (comment/string-stripped scan for 0.1/1.5/5.0/10.0/5 in verdicts.ts/interval.ts/ptmt.ts).

## Verification (actual results)

- Task 1 suites: interval 9 + outliers 5 + ptmt 11 + dates 11 + corrosion 6 = **42/42** (G4 0.080/0.300/0.300; G6 = 2.00 NOT 1.50; G7 = 1.00 and 5.00; G5 caps 5.00/10.00/10.00; G9a floored-to-zero + flag + null RL; G9b governing 0.100 + flag; G11 |z| 60.705 / 0.6745 with MAD 0.01; G13 3653 d / 10.001369 yr + 366 d / 1.002053 yr; G14 both 0 and -1.5 -> immediate-inspection; P1-P7 all catalog-exact; citation ids resolve against citations.json).
- Task 2 suites: formulas 3 + verdicts 6 + evaluate 17 = **26/26** (G1 2.637536; G2 2.656522; G3 6.0 with tPressureMm 2.637536 reported; all five G8 rows incl. the arithmetic accept boundary and zero-width band; G10 nulls-with-verdict; G12 mils RL exactly 5.0 (raw double toBeCloseTo 5.0 @ 9dp) with Class-1 interval 2.50 and nextInspection 2027-07-17; G14 end-to-end; outliers through orchestration {z -60.705, median 9.2, mad 0.01}; finiteness scan: every numeric field finite-or-null, no negative intervalYears).
- Task 3: `npm run lint` exit 0 with the restriction block active (grep no-restricted-imports = 1); guards 3 + 4 green. **Negative proof:** injecting `import { LLM_TIMEOUT_MS } from "../llm/config"` into lib/calc/round.ts failed eslint ("'../llm/config' import is restricted from being used by a pattern. The calc engine is deterministic ground truth — LLM imports forbidden") AND — after the guard was strengthened — the boundary test ("no lib/calc module imports the LLM layer (alias or relative)"); reverted, both green.
- `npm run typecheck` exit 0; `npm test` 124/125 — the single failure is the pre-existing Phase 1 live-LLM fixture test flaking on a real model call (passes on re-run; logged to `deferred-items.md`, out of scope); `npm run build` exit 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MAD float drift broke G11's surfaced median/MAD detail**
- **Found during:** Task 1 (outliers suite)
- **Issue:** `|9.19 - 9.2|` computes 0.009999999999997868; the surfaced MAD failed `toBe(0.01)` — exactly Pitfall 2's drift class.
- **Fix:** canonicalize the surfaced MAD to 6 dp at the modifiedZScores exit (R4); score arithmetic unchanged (it rounds at its own 4-dp exit).
- **Files modified:** lib/calc/outliers.ts
- **Commit:** c9aa65b

**2. [Rule 2 - Missing critical functionality] Boundary guard missed relative LLM imports**
- **Found during:** Task 3 (negative proof)
- **Issue:** the planned guard matched the literal "lib/llm"; the injected relative import `../llm/config` passed it while eslint correctly failed — the belt-and-braces layer had a hole.
- **Fix:** guard now extracts module specifiers from static/side-effect/dynamic imports and flags any specifier with an `llm` path segment; negative proof re-run: both gates fail, revert green.
- **Files modified:** tests/ingest/boundary-imports.test.ts
- **Commit:** 6a3db51

**3. [Rule 1 - Bug] prefer-const lint error in lib/calc/dates.ts** (`let year` never reassigned) — fixed to const during Task 3 (commit 6a3db51).

**4. [Rule 1 - Bug] Two test-construction bugs in evaluate.test.ts** (Class-3 input lacked history; no input computed a real RL so api570_7_2 was never cited) — fixed in the tests; engine verified correct (commit f4bc303).

## Deferred Issues

- `tests/llm/hello-fixture.test.ts` (Phase 1 live-LLM test) flaked once during the full-suite run: model returned prose instead of JSON, exhausting the 1-retry budget; passes on re-run. Logged in `deferred-items.md` — pre-existing, unrelated to Phase 2 files.

## Known Stubs

None.

## Self-Check: PASSED

- Commits c9aa65b, f4bc303, 6a3db51 found in git log; all 14 created + 3 modified files present on disk.
