---
phase: 07-decision-provider-seam
plan: 01
subsystem: system1-decision-provider
tags: [nebius, nemotron, system1, decision-provider, fail-closed, baseline-metrics]
dependency-graph:
  requires: [DecisionProvider interface, four domain spike contracts, lib/calc criteria seam]
  provides: [NebiusNemotronDecisionProvider, 4 executed domain spikes, measured nebius baseline metrics artifact]
  affects: [lib/decision, lib/llm/complete.ts, docs]
tech-stack:
  added: []
  patterns: [temperature-0 strict json_object micro-decisions, parseJsonLoose preamble recovery, Zod wire validation, bounded retry fail-closed, env-only model routing]
key-files:
  created:
    - tests/decision/types.test.ts (6 contract-lock tests)
    - tests/decision/provider.test.ts (13 adapter tests)
    - tests/decision/spikes.test.ts (19 spike tests)
    - docs/system1-baseline-metrics.json (measured Nebius baseline)
  modified:
    - lib/decision/providers/nebius-nemotron.ts
    - lib/decision/spikes/fluid-classifier.ts
    - lib/decision/spikes/fleet-triage.ts
    - lib/decision/spikes/morphology-classifier.ts
    - lib/decision/spikes/semantic-guard.ts
    - lib/llm/complete.ts (parseJsonLoose export)
decisions:
  - parseJsonLoose exported from lib/llm/complete.ts (module-private extractBalancedObjects was plan-named; co-located parser reused rather than duplicated — lib/llm is not a protected tree)
  - Provider kill-switch fails closed on the network path; injected clients bypass it so hermetic tests need no env setup
  - Choice distributions normalized to sum ≈ 1.0 (DEC-03)
  - Morphology thresholds de-literalized — spike C loads relevance/max-rounded thresholds from ptmt-criteria.json via lib/calc/criteria.ts instead of hardcoding 1.5/5.0
  - Semantic guard gains a deterministic grounding layer (citations.json allowlist resolution + verbatim/rounded number checks) beneath the p ≥ 0.95 noul gate — zero model dependence for hallucination catching
  - max_completion_tokens default raised 2048 → 6000 (verified live: guard-style evaluations exhaust 2048 and return EMPTY content with finish_reason 'length'; fail-closed retry cannot recover)
  - gsd-execute-phase subagent dispatch was unavailable in the executing runtime — executed sequentially inline with equivalent rigor (the workflow's documented fallback)
metrics:
  duration: single-session
  completed: 2026-10-19
  tasks: 4
  files: 12
  commits: 5
status: complete
actuals:
  new-tests: 38
  commits: 5
  live-calls: 24
---

# Phase 7 Plan 01: Decision Provider Seam & Nebius Fast Decision Engine — Summary

Implemented `NebiusNemotronDecisionProvider` (temperature-0, strict `json_object`, env-only `NEBIUS_MODEL_*` routing) behind the existing `DecisionProvider` seam, executed all 4 domain spikes with fail-closed gates, and produced a measured baseline metrics artifact from 24 live single-pass calls — the datum Fork B's comparative benchmark consumes.

## Completed Work

- **DEC-01 contract lock** (`2ca0a2b`): a mock provider proves all four `DecisionProvider` primitive signatures (`choice`, `noul`, `score`, `batch`) with zero freeform text leakage.
- **DEC-02/DEC-03 provider** (`ba0c081`): env-only model routing (no `nvidia/` literals — grep gate), temperature 0 with strict `json_object`, `parseJsonLoose` preamble recovery (Lightning wraps JSON in prose), Zod wire validation, one bounded retry that fails closed, kill-switch hard-fail. Hermetic injected-client tests.
- **SPIKE-01..04** (`f0c4b96`): fluid classifier (p < 0.85 → inspector review; 20-case suite ≥ 95%), fleet triage (deterministic Tier-3 pre-filter — zero model calls on deterministic failure), morphology (pure-TS L > 3W override from ptmt-criteria.json thresholds; 0 false negatives), semantic guard (deterministic citations.json allowlist + number grounding beneath the p ≥ 0.95 noul gate).
- **Measured baseline** (`86fe917`): 24 live single-pass calls — 100% clear-case fluid accuracy, 2/2 ambiguous cases fail-closed, Brier 0.0047, ECE 0.042, latency p50 4.4 s / p95 15.9 s, $0.772 per 1k evals (public Token Factory pricing, source noted in artifact). Artifact shape mirrors Fork B's `ProviderBenchmarkMetrics` exactly (verified against `flawcheck-subq-snap/lib/decision/benchmark/types.ts`).
- **Live-verified quirk** (`73c96ab`): guard-style reasoning exhausts a 2048-token budget (empty content, `finish_reason: length`); provider default raised to 6000. A 17-minute upstream stall was observed once — transport timeouts + bounded retry are mandatory.

## Verification Evidence

- `npx tsc --noEmit`: clean (exit 0) at every checkpoint and final state.
- Full suite: **621 passed / 5 skipped** (57 files) — +38 new hermetic tests over the inherited 583; zero network by default; `FLAWCHECK_DISABLE_LLM=1` green.
- `git diff master..HEAD -- lib/calc/ lib/criteria/`: **empty** — protected trees byte-identical.
- Grep gate: zero `nvidia/` model-ID literals in source/tests; routing exclusively via `NEBIUS_MODEL_EXTRACTION`.
- Boundary-imports gate passes (3/3); `lib/decision/` imports `lib/calc/criteria.ts` (criteria → decision direction only).
- `.env.local` never printed/committed; scratch measurement scripts live in git-ignored `scratch/`.

## Deviations from 07-01-PLAN.md

1. Executed inline (no `gsd-execute-phase` subagent dispatch available in the runtime) — the workflow's documented fallback; plan files on disk were the recovery source.
2. `parseJsonLoose` export instead of the plan-referenced private `extractBalancedObjects` — same parser, CoT-aware last-first order.
3. Provider hardening beyond plan: network-path kill-switch fail-closed; choice distributions normalized to sum ≈ 1.0.
4. Morphology thresholds de-literalized via ptmt-criteria.json.
5. Deterministic grounding layer added beneath the semantic-guard noul gate.
6. `max_completion_tokens` 2048 → 6000 (live-verified necessity).
7. `--no-transition` honored at execution time: STATE.md position was untouched then; this summary and the STATE/ROADMAP transition are being written now (back-fill at verification, 2026-10-19).

## Remaining Limits

- Two of four live guard cases returned p = 0 from the model (one documented model false-negative on a clean narrative — the deterministic layer accepts it; fail-closed costs recall, never precision).
- Measured latency (p50 4.4 s) far exceeds the ideation-era 100–300 ms estimate — visible CoT counts inside `max_completion_tokens` and dominates latency. The "System-1 latency" thesis for Nemotron-Lightning is materially weakened; SubQ's zero-output-token model is the latency hypothesis to beat.
- Pricing is public Token Factory list, not negotiated; cost per 1k is a planning datum, not a contract.

## Commits

| Commit | Description |
| --- | --- |
| `2ca0a2b` | test(decision): DEC-01 contract lock — mock provider proves all four primitive signatures |
| `ba0c081` | feat(decision): DEC-02/DEC-03 — NebiusNemotronDecisionProvider (env-only routing, strict json_object, parseJsonLoose, Zod, bounded retry) |
| `f0c4b96` | feat(decision): SPIKE-01..04 — 4 domain spikes with fail-closed gates |
| `86fe917` | docs(metrics): measured nebiusMetrics baseline artifact (24 live calls) |
| `73c96ab` | fix(decision): max_completion_tokens 2048 → 6000 (live-verified) |
