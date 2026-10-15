---
phase: 08-subq-snap-decision-engine
plan: 01
subsystem: decision-provider-and-benchmark
tags: [subq, system1, multimodal, benchmark, verification]
dependency-graph:
  requires: [DecisionProvider interface, four domain spike contracts]
  provides: [SubQ Snap provider, image payload validation, benchmark harness, gated live integration test]
  affects: [lib/decision/providers, lib/decision/benchmark, tests/decision, docs]
tech-stack:
  added: []
  patterns: [typed native provider payloads, fail-closed response validation, explicitly gated live integration]
key-files:
  created:
    - lib/decision/benchmark/metrics.ts
    - lib/decision/benchmark/scenarios.ts
    - tests/decision/subq-provider.test.ts
    - tests/decision/multimodal.test.ts
    - tests/decision/subq-spikes.test.ts
    - tests/decision/benchmark.test.ts
    - tests/decision/subq-live.integration.test.ts
    - docs/system1-benchmark-report.json
  modified:
    - lib/decision/providers/subq-snap.ts
    - lib/decision/benchmark/runner.ts
    - lib/decision/benchmark/types.ts
decisions:
  - Keep production SubQ requests on https://api.subq.ai/v1 and lock model to subq-snap-preview.
  - Reject malformed choice, score, image MIME, and base64 responses before returning them to callers.
  - Keep comparative benchmark measurements pending until both providers and verified pricing are available.
metrics:
  duration: multi-session
  completed: 2026-10-15
  tasks: 4
  files: 11
  commits: 6
status: complete
actuals:
  tokens: 19550
  tasks: 4
  commits: 6
---

# Phase 8 Plan 01: SubQ Snap Decision Engine Summary

Implemented the SubQ Decisions provider with strict answer and multimodal payload validation, added a synthetic benchmark harness that refuses incomplete comparisons, and verified a small live SubQ integration using synthetic inputs only.

## Completed Work

- Implemented the `subq-snap-preview` provider at `POST https://api.subq.ai/v1/systemone`, including native `noul`, `choice`, and `score` mapping, zero output token usage, and typed error handling.
- Restricted production bearer-key requests to the verified SubQ HTTPS origin. HTTPS mock overrides are accepted only when `NODE_ENV=test`.
- Added fail-closed validation for requested choice keys, confidence/probability bounds and distributions, and score bounds/distributions.
- Enforced image count, decoded size, MIME agreement, supported formats, single-line base64, and valid padding.
- Added 30 synthetic benchmark scenarios and latency, calibration, and optional caller-priced cost calculations. Comparisons report winners only after both providers complete all attempts.
- Kept `docs/system1-benchmark-report.json` in `pending_live_measurement`: this fork has no Nebius provider baseline and no verified token prices.
- Added a live test gated by `FLAWCHECK_LIVE_SUBQ=1`. It reads `SUBQ_API_KEY`, sends no images or real inspection data, and counts its requests without logging credentials or raw provider responses.

## Verification Evidence

- Live gated integration: **1 test passed**. It made exactly **5 SubQ requests**: one batch for the three native primitives, one fluid classification, two morphology decisions, and one semantic check. The fleet critical-thickness path used its deterministic override and made no request. The ambiguous synthetic fluid triggered the `p < 0.85` review gate; the synthetic narrative mismatch failed the semantic guard.
- Phase 08 hermetic suite: **34 passed, 1 skipped**. The skipped test is the intentionally gated live integration.
- `npx tsc --noEmit`: passed.
- `git diff --check`: passed.
- Protected trees: `lib/calc/` and `lib/criteria/` have no differences from the Phase 08 planning baseline `340de94`.
- No packages were installed. No live comparative benchmark was run.

## Commits

| Commit | Description |
| --- | --- |
| `241607a` | Implement SubQ Decisions provider |
| `01fcbbe` | Cover SubQ image validation |
| `aa4bd6b` | Exercise SubQ decision spikes with hermetic mocks |
| `735a4e8` | Add benchmark harness and pending report |
| `71f1fed` | Close adversarial review findings |
| Closeout commit | Add gated live integration test and this summary |

## Remaining Limits

- No Phase 07 Nebius provider is present in this fork, so the comparative benchmark has no second provider and makes no performance or winner claims.
- Per-token prices were not verified, so cost-per-1,000 remains unavailable.
- The live run validates the SubQ contract and selected spike gates on synthetic states. It is not an accuracy study or a benchmark dataset result.
