# Phase 8: SubQ.ai Snap Decision Engine & Multi-Modal Benchmark (Fork B) — Context

**Date:** 2026-10-14
**Status:** Decisions locked — ready for planning

## <domain>

Fork B implements the alternative System-1 architecture using the SubQ Decisions API (`POST /v1/systemone`, model `subq-snap-preview`) on a dedicated git worktree (`../flawcheck-subq-snap` on `feat/subq-snap`).

Three major capabilities are evaluated in Fork B:
1. **SubQ Snap DecisionProvider**: Client adapter mapping typed primitives directly into native SubQ question structures (`noul`, `choice`, `score`).
2. **Multi-Modal Visual Evaluation**: Support for up to 4 base64 images per request for evaluating dye penetrant bleed-out and ultrasonic A-scan indications.
3. **Comparative Benchmark Suite**: Head-to-head empirical comparison of Fork A (Nemotron-3.5-Lightning on Nebius Token Factory) vs Fork B (SubQ Snap) on latency, calibration, and token/API cost.

### Scope boundary

This phase operates strictly inside isolated worktree `../flawcheck-subq-snap` on branch `feat/subq-snap`. It must not touch:
- Application source code on root `master` (`6764cbe`).
- Deterministic calculation formulas in `lib/calc/` (protected, byte-identical).
- Standards criteria in `lib/criteria/` (single source of truth).
- Fork A worktree (`../flawcheck-nvidia-system1`).

</domain>

## <decisions>

### 1. SubQ Native Protocol Mapping

- **Endpoint & Auth**: Calls `POST https://api.subq.ai/v1/systemone` with header `Authorization: Bearer $SUBQ_API_KEY`.
- **Question Structure**:
  - `noul`: `{ type: "noul", instructions: string, criteria?: { true?: string, false?: string } }`. Returns `{ noul: number }`.
  - `choice`: `{ type: "choice", instructions: string, criteria: Record<string, string | null> }`. Returns `{ choice: string, probabilities: Record<string, number>, confidence: number }`.
  - `score`: `{ type: "score", instructions: string, criteria: string[] }`. Returns `{ score: number, legend: Record<string, string>, probabilities: Record<string, number>, confidence: number }`.
- **Output Token Invariant**: `output_tokens` is always 0 in SubQ Snap API responses. Pricing is strictly input tokens plus image tokens.

### 2. Multi-Modal Image Payload

- SubQ accepts up to 4 images per request in `images: Array<{ mediaType: string, base64: string }>`.
- Valid media types: `image/png`, `image/jpeg`, `image/webp`.
- Images must be single-line base64 without data URI scheme (`data:image/jpeg;base64,`). Decoded size must be $\le 4\text{ MiB}$ each and $\le 8\text{ MiB}$ total.
- The client sanitizes strings before sending, rejecting invalid formats with `DecisionValidationError` to avoid HTTP 422 errors.

### 3. Re-Execution of 4 Domain Spikes

- The 4 Domain Spikes (Fluid Classifier, Fleet Triage, PT/MT Morphology, Semantic Guard) consume the same `DecisionProvider` interface implemented in Phase 7.
- In Fork B, `SubQSnapDecisionProvider` is injected into the spikes.
- Spike C (PT/MT Morphology) is extended with multi-modal tests evaluating dye penetrant photos.

### 4. Comparative Benchmark Suite (R3)

- Implemented under `lib/decision/benchmark/`.
- Scenarios cover all 4 spikes, testing both typical cases and boundary edge cases.
- Metrics recorded:
  - Latency: min, max, mean, p50, p90, p95, p99 ms across 50 iterations per scenario.
  - Calibration: Brier score and Expected Calibration Error (ECE) comparing confidence against ground truth.
  - Cost: Input tokens, output tokens, and calculated cost per 1,000 evaluations.
- Output: Generated artifact `docs/system1-benchmark-report.json`.

</decisions>

## <specifics>

- Directory layout for Fork B:
  - `lib/decision/providers/subq-snap.ts`: SubQ Decisions API adapter.
  - `lib/decision/benchmark/runner.ts`: Comparative benchmark harness.
  - `lib/decision/benchmark/scenarios.ts`: Evaluation scenarios across Spikes A–D.
  - `lib/decision/benchmark/metrics.ts`: Calibration and latency statistics math.
  - `tests/decision/subq-provider.test.ts`: Unit tests with mocked HTTP responses.
  - `tests/decision/multimodal.test.ts`: Multi-modal image payload tests.
  - `tests/decision/benchmark.test.ts`: Benchmark execution assertions.

</specifics>

## <code_context>

- `lib/decision/types.ts` — Pluggable `DecisionProvider` interface established in Phase 7.
- `lib/decision/providers/nebius-nemotron.ts` — Fork A baseline for benchmark comparison.
- `lib/decision/spikes/` — Domain spike logic consuming `DecisionProvider`.
- `lib/criteria/citations.json` — Vetted allowlist for regulatory citations.
- `lib/criteria/ptmt-criteria.json` — ASME B31.3 morphology rules.
- `lib/criteria/ut-criteria.json` — API 570 / API 574 wall thickness criteria.

</code_context>

## <canonical_refs>

- `.planning/ROADMAP.md` — Phase 8 milestone details and success criteria.
- `https://docs.subq.ai/endpoints/decisions-api/` — Authoritative SubQ Decisions API documentation.
- `AGENTS.md` — Standards hierarchy, criteria sovereignty, and deterministic calculation invariants.
- API 570 (5th Edition) Section 6.3.4 & Table 1 — Piping Service Classes.
- ASME B31.3-2024 §344.3.2 & §344.4.2 — MT and PT acceptance criteria.

</canonical_refs>

## <deferred>

- Full production swap of default provider (evaluated after benchmark review).
- Fine-tuning or private deployment of custom SubQ models.
- Animated SVG and PDF trend visualization (Phase 9).

</deferred>
