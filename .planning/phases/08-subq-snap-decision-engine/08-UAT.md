---
status: complete
phase: 08-subq-snap-decision-engine
source: [08-01-SUMMARY.md]
started: 2026-10-19T13:40:00Z
updated: 2026-10-19T08:09:11.779Z
---

## Current Test

[testing complete]

## Tests

### 1. Fail-closed gate on ambiguous classification
expected: A low-confidence synthetic fluid classification (p < 0.85) routes to manual review — never a forced class assignment.
result: pass
user_note: "Behavior correct — a gate fired and the system stayed safe. Enhancement (explainable review block) deferred to Phase 09."

### 2. Semantic guard rejects narrative mismatch
expected: The semantic-guard spike flags a synthetic narrative that contradicts the precomputed verdict (live run observed: mismatch failed the guard).
result: pass
user_note: "Behavior correct — reasoned guard failure enhancement deferred to Phase 09."

### 3. Benchmark report stays honest when incomplete
expected: docs/system1-benchmark-report.json reads pending_live_measurement with NO provider metrics, winners, or invented pricing — comparisons only become "measured" when both providers complete all attempts.
result: pass
source: automated-orchestrator (verified 2026-10-19: status=pending_live_measurement, winners=None, prices=None)

### 4. Hermetic suite green without network or key
expected: `FLAWCHECK_DISABLE_LLM=1 npm test` passes fully offline (618 tests, current count) with zero external requests.
result: pass
source: automated-orchestrator (verified 2026-10-19: 618 passed / 6 skipped under FLAWCHECK_DISABLE_LLM=1, tsc clean)

### 5. Live SubQ contract on synthetic states
expected: With FLAWCHECK_LIVE_SUBQ=1 and the real key, the gated integration test passes: exactly 5 SubQ requests, native noul/choice/score exercised, no images, no real inspection data.
result: pass
source: automated-orchestrator (verified 2026-10-19: gated test 1/1 passed)

### 6. Calculation sovereignty preserved
expected: `git diff 2ce76be..HEAD -- lib/calc/ lib/criteria/` is empty — the deterministic engine and criteria allowlist are byte-identical to the planning baseline.
result: pass
source: automated-orchestrator (verified 2026-10-19: diff empty, 0 lines)

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Deferred Follow-Ups

- test: 1
  idea: "Explainable manual review block: show the competing classes with their probability distribution (e.g. 'Class 1 at 0.62 vs Class 3 at 0.58'), the input snippet that drove uncertainty, what evidence would disambiguate, and remedial steps ('confirm fluid service class against process datasheet per API 570 §6.3'). Invariant: the explanation layer narrates around the precomputed distribution — it never re-classifies. Fold into Phase 09 scope."
  deferred_at: 2026-10-19
- test: 2
  idea: "Reasoned guard failure report: state what the narrative claimed, what the precomputed verdict actually is, and that the deterministic fallback was served. Keep two audiences distinct — operator/developer remediation (inspect audit log, fix prompt/lint) vs inspector-facing remedial step ('trust the fallback verdict'). Fold into Phase 09 scope."
  deferred_at: 2026-10-19
