# Phase 7: Decision Provider Seam & Nebius Fast Decision Engine (Fork A) — Context

**Date:** 2026-10-14
**Status:** Decisions locked — ready for planning

## <domain>

Fork A introduces System-1 fast decisioning to FlawCheck on a dedicated git worktree (`../flawcheck-nvidia-system1` on `feat/nvidia-system1`). The objective is to evaluate `nvidia/Nemotron-3_5-Lightning` on Nebius Token Factory for low-latency operational classification, fleet triage, morphology analysis, and semantic guardrails without compromising engineering calculation integrity.

Three core components are established:
1. **DecisionProvider seam**: Pluggable interface (`lib/decision/types.ts`) specifying typed primitives (`choice`, `noul`, `score`, `batch`).
2. **Nebius Token Factory Adapter**: Single-pass, zero-temperature JSON provider (`lib/decision/providers/nebius-nemotron.ts`) with balanced-brace parsing.
3. **4 Domain Spikes**: Concrete implementations of Fluid Classification (API 570), Fleet Triage (Zenodo 4,912 readings), PT/MT Morphology (ASME B31.3), and Semantic Guardrails.

### Scope boundary

This phase operates strictly inside isolated worktree `../flawcheck-nvidia-system1` on branch `feat/nvidia-system1`. It must not touch:
- Application source code on root `master` (`6764cbe`).
- Deterministic calculation formulas in `lib/calc/` (protected, byte-identical).
- Standards criteria in `lib/criteria/` (single source of truth).
- SubQ Snap Decision API (reserved for Fork B / Phase 8).

</domain>

## <decisions>

### 1. DecisionProvider Primitive Contract

- **Primitives**:
  - `choice`: Enum selection among 2–255 options. Returns selected key, probability distribution, and confidence.
  - `noul`: Calibrated binary probability gate returning float $p \in [0.0, 1.0]$ and boolean verdict relative to an optional threshold.
  - `score`: Ordered rating across 2–10 discrete criteria strings. Returns continuous probability-weighted score and winning level label.
  - `batch`: Atomic evaluation of 1–16 heterogeneous questions against a single evaluated context state.
- **Zero-Text Leakage**: Business callers never receive raw completion strings. All returns are Zod-parsed into typed objects. If the model outputs non-conforming JSON, the adapter retries once or fails closed.

### 2. Fork A Adapter & Nebius Transport

- **Model Target**: `nvidia/Nemotron-3_5-Lightning` via OpenAI-compatible endpoint at `https://api.tokenfactory.nebius.com/v1/`.
- **Inference Configuration**: Temperature set to 0.0 for deterministic, single-pass decisioning. `response_format: { type: "json_object" }` enforced on all calls.
- **Prose Preamble Recovery**: `lib/llm/complete.ts` contains `extractBalancedObjects` to extract JSON from conversational preambles (e.g. `"Here's the result: {...}"`). The adapter reuses this parser before throwing syntax errors.

### 3. Fail-Closed Thresholds & Spikes

- **Spike A (Fluid Classifier)**:
  - Regulatory source: API 570 (5th Edition) Section 6.3.4 & Table 1.
  - Fail-closed gate: If `confidence < 0.85`, the system emits `inspector_review_required: true`. Borderline toxic or ambiguous streams (e.g. $H_2S$, boiling hydrocarbons) are never silently assigned lower-risk classes.
- **Spike B (High-Throughput Fleet Triage)**:
  - Dataset: Zenodo 16780668 (4,912 ballast tank ultrasonic readings).
  - Tiers: Tier 1 (Routine), Tier 2 (Re-Check), Tier 3 (Critical).
  - Pre-filter: Readings with $t_{\text{actual}} < t_{\text{required}}$ are instantly hardwired to Tier 3 in pure TypeScript before model invocation.
- **Spike C (PT/MT Morphology)**:
  - Regulatory source: ASME B31.3-2024 §344.4.2 & §344.3.2.
  - Boundary: $L > 3W$ is linear (REJECT). $L \le 3W$ is rounded. The model classifies indication descriptions into linear vs rounded; linear indications trigger automatic rejection in `lib/calc/ptmt.ts`.
- **Spike D (Semantic Guard)**:
  - Evaluates narrative reports for hallucinated numbers or non-allowlisted citations.
  - Fail-closed gate: Requires $p \ge 0.95$ to pass. Any fabricated standard or numeric deviation fails the gate.

### 4. Arithmetic Sovereignty Invariant

- Pure TypeScript (`lib/calc/`) computes 100% of arithmetic ($t_{\text{required}}$, corrosion rates, remaining life, inspection intervals).
- LLMs and System-1 decision providers strictly classify, triage, and guard.
- When `FLAWCHECK_DISABLE_LLM=1`, all calculations and tests run hermetically with 0 model calls.

</decisions>

## <specifics>

- Directory layout for Fork A:
  - `lib/decision/types.ts`: Interface definitions.
  - `lib/decision/index.ts`: Provider registry and factory.
  - `lib/decision/providers/nebius-nemotron.ts`: Nebius Token Factory adapter.
  - `lib/decision/spikes/fluid-classifier.ts`: Spike A implementation.
  - `lib/decision/spikes/fleet-triage.ts`: Spike B implementation.
  - `lib/decision/spikes/morphology-classifier.ts`: Spike C implementation.
  - `lib/decision/spikes/semantic-guard.ts`: Spike D implementation.
- `tests/decision/`: Comprehensive test suites covering types, adapter, and all 4 spikes.

</specifics>

## <code_context>

- `lib/llm/client.ts` — Existing OpenAI client factory pointing to Nebius Token Factory.
- `lib/llm/config.ts` — Environment variable validation (`NEBIUS_BASE_URL`, `NEBIUS_API_KEY`, `NEBIUS_MODEL_EXTRACTION`).
- `lib/llm/complete.ts` — `extractBalancedObjects` helper for extracting JSON from prose preambles.
- `lib/criteria/citations.json` — Vetted allowlist for regulatory citations.
- `lib/criteria/ptmt-criteria.json` — ASME B31.3 threshold and morphology definitions.
- `lib/criteria/ut-criteria.json` — API 570 / API 574 wall thickness criteria and verdict banding.
- `tests/ingest/boundary-imports.test.ts` — Architectural boundary tests ensuring `lib/calc/` does not import LLM modules.

</code_context>

## <canonical_refs>

- `.planning/ROADMAP.md` — Phase 7 milestone details and success criteria.
- `AGENTS.md` — Standards hierarchy, criteria sovereignty, and deterministic calculation invariants.
- API 570 (5th Edition) Section 6.3.4 & Table 1 — Piping Service Classes.
- API 574 (5th Edition, 2024) Section 10 & Annex D — Minimum thickness determination.
- ASME B31.3-2024 §344.3.2 & §344.4.2 — MT and PT acceptance criteria.

</canonical_refs>

## <deferred>

- SubQ Snap Decision API integration (Fork B / Phase 8).
- Multi-modal image analysis for PT/MT indication photos (Fork B / Phase 8).
- Comparative benchmark suite across providers (Fork B / Phase 8).
- Animated SVG and PDF trend visualization (Phase 9).

</deferred>
