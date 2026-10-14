# Phase 8: SubQ.ai Snap Decision Engine & Multi-Modal Benchmark (Fork B) — Specification

**Created:** 2026-10-14
**Ambiguity score:** 0.09 (gate: ≤ 0.20)
**Requirements:** 8 locked (SUBQ-01..04, BENCH-01..04)

## Goal

Integrate the SubQ.ai Snap Decision API (`POST /v1/systemone`, model `subq-snap-preview`) implementing the unified `DecisionProvider` seam on isolated worktree `../flawcheck-subq-snap` (`feat/subq-snap`) with native question structures and multimodal image evaluation, execute the 4 NDT domain spikes, and produce an automated comparative benchmark suite comparing Nemotron-Lightning against SubQ Snap.

## Background

In Phase 7 (Fork A), the pluggable `DecisionProvider` seam was established and implemented with `nvidia/Nemotron-3_5-Lightning` on Nebius Token Factory. While effective, general-purpose LLMs served through chat completion endpoints require prompt wrapping, temperature tuning, and output recovery mechanisms (`extractBalancedObjects`) to emulate decision primitives, with billing based on both input and generated tokens.

SubQ.ai Snap Decision API (`POST https://api.subq.ai/v1/systemone`) provides a purpose-built System-1 model (`subq-snap-preview`) engineered specifically for fast classification, routing, and guardrails. It natively supports `noul` (calibrated probability), `choice` (categorical selection), and `score` (ordered ratings) with zero output tokens generated (`output_tokens: 0`), up to 384K context tokens, and native multi-modal image evaluation (up to 4 images per request).

Phase 8 implements Fork B on dedicated branch `feat/subq-snap` in worktree `../flawcheck-subq-snap`. It implements `SubQSnapDecisionProvider`, adapts all 4 domain spikes (with multi-modal image support for PT/MT flaw indications and A-scans), and executes a comparative benchmark harness measuring latency, calibration on boundary edge cases, and token/API cost per 1,000 evaluations.

## Requirements

1. **SUBQ-01 (SubQ Snap DecisionProvider Implementation)**:
   - Current: No SubQ client exists; system uses Nebius Token Factory exclusively.
   - Target: `lib/decision/providers/subq-snap.ts` implements `DecisionProvider` targeting `POST https://api.subq.ai/v1/systemone` using model `subq-snap-preview`.
   - Acceptance: Provider maps `choice`, `noul`, and `score` to native SubQ question types, sets `Authorization: Bearer $SUBQ_API_KEY`, handles HTTP 4xx/5xx error envelopes cleanly, and accurately reflects `output_tokens: 0` in usage telemetry.

2. **SUBQ-02 (Multi-Modal Image Evaluation)**:
   - Current: FlawCheck is text-only; visual PT/MT flaw indications and A-scans require manual human transcription.
   - Target: Support up to 4 base64 images per request (`image/png`, `image/jpeg`, `image/webp`) in `SubQSnapDecisionProvider`, stripping any data URI prefixes and enforcing $\le 4\text{ MiB}$ per image and $\le 8\text{ MiB}$ total.
   - Acceptance: Multi-modal test passes sending base64 PNG/JPEG dye penetrant and ultrasonic A-scan images to `subq-snap-preview` to answer defect morphology questions.

3. **SUBQ-03 (Re-Execution of 4 Domain Spikes on SubQ Snap)**:
   - Current: Spikes A–D are implemented for Nebius Nemotron in Phase 7.
   - Target: Execute all 4 Domain Spikes (Fluid Classifier API 570 Table 1, Fleet Triage 4,912 Zenodo readings, ASME B31.3 PT/MT Morphology, and Semantic Guard) using `SubQSnapDecisionProvider`.
   - Acceptance: All 4 spikes pass identical acceptance criteria: Spike A $\ge 95\%$ accuracy with $p < 0.85$ fail-closed trigger; Spike B 4,912 readings screened; Spike C linear indications rejected; Spike D fabricated citations flagged.

4. **SUBQ-04 (Zero Data URI & Payload Validation Handling)**:
   - Current: Image upload inputs often contain `data:image/jpeg;base64,...` browser prefixes.
   - Target: SubQ client automatically strips data URI prefixes, validates image byte length against decoded limits, and verifies question criteria formatting prior to network dispatch to prevent HTTP 422 `validation_error`.
   - Acceptance: Unit tests verify data URI stripping and client-side rejection of images $> 4\text{ MiB}$ without network calls.

5. **BENCH-01 (Comparative Latency Distribution Suite)**:
   - Current: No latency benchmarking harness exists.
   - Target: Automated benchmark harness in `lib/decision/benchmark/` executes Spikes A–D across both providers, measuring min, mean, p50, p90, p95, and p99 latency in milliseconds under identical network conditions.
   - Acceptance: Benchmark suite records distribution metrics for both engines into structured JSON.

6. **BENCH-02 (Calibration & Boundary Edge-Case Analysis)**:
   - Current: Model confidence calibration is unmeasured.
   - Target: Benchmark suite evaluates model calibration across boundary edge cases (toxic fluid thresholds, $L = 3W$ morphology boundaries, borderline thickness readings) calculating Brier score and Expected Calibration Error (ECE).
   - Acceptance: Benchmark outputs calibration metrics demonstrating whether model probabilities reflect empirical frequencies.

7. **BENCH-03 (Token & API Cost per 1,000 Evaluations)**:
   - Current: Cost calculations are limited to Nebius Token Factory estimates.
   - Target: Benchmark suite tracks total input tokens and output tokens across runs, computing estimated cost per 1,000 evaluations based on published pricing models (Nebius per-token vs SubQ input-only token pricing).
   - Acceptance: Benchmark report produces comparative cost breakdown per 1,000 decisions.

8. **BENCH-04 (Automated Benchmark Report Generation)**:
   - Current: No benchmark reporting artifact exists.
   - Target: Running `npm run benchmark` outputs `docs/system1-benchmark-report.json` and a formatted summary table comparing Fork A vs Fork B.
   - Acceptance: Artifact is committed in `docs/` and verifies both providers on identical evaluation fixtures.

## Boundaries

**In scope:**
- Git worktree scaffolding: `../flawcheck-subq-snap` on branch `feat/subq-snap`.
- `lib/decision/providers/subq-snap.ts`: SubQ Decisions API adapter.
- Multi-modal image payload formatting and validation.
- Execution of Spikes A, B, C, D using SubQ Snap.
- Comparative benchmark harness in `lib/decision/benchmark/`.
- Generated benchmark report in `docs/system1-benchmark-report.json`.

**Out of scope:**
- Modifying main repository application source code (`master` at `6764cbe`).
- Modifying `lib/calc/` or `lib/criteria/` (strictly byte-identical).
- Live video generation or public production deployment of Fork B.

## Constraints

- **Worktree Isolation**: Worktree must be rooted in `../flawcheck-subq-snap` on branch `feat/subq-snap`.
- **API Model Invariant**: Must target model `subq-snap-preview` on endpoint `https://api.subq.ai/v1/systemone`.
- **Protected Trees**: `lib/calc/` and `lib/criteria/` must remain byte-identical; zero arithmetic formulas allowed in SubQ questions.
- **Fail-Closed Threshold**: Spike A fluid classification must require $p \ge 0.85$ confidence; Spike D semantic guard requires $p \ge 0.95$.
- **Test Baseline**: All 504 (or 583) hermetic tests must continue to pass in the worktree.

## Acceptance Criteria

- [ ] Worktree `../flawcheck-subq-snap` exists on branch `feat/subq-snap` and builds cleanly (`npm run build`).
- [ ] `SubQSnapDecisionProvider` handles 200 responses, schema errors, and timeout fallbacks cleanly.
- [ ] Multi-modal image evaluation passes sending base64 PNG/JPEG dye penetrant and A-scan indications to `subq-snap-preview`.
- [ ] Client automatically strips `data:image/...;base64,` prefixes and rejects images exceeding 4 MiB decoded.
- [ ] All 4 Domain Spikes (Fluid Classifier, Fleet Triage, PT/MT Morphology, Semantic Guard) execute successfully on SubQ Snap.
- [ ] Comparative benchmark suite runs across Spikes A–D and generates `docs/system1-benchmark-report.json`.
- [ ] Benchmark report includes latency distribution (p50/p95/p99), calibration metrics (Brier score), and token/API cost per 1k evals.
- [ ] All tests pass with `FLAWCHECK_DISABLE_LLM=1` verifying pure TypeScript calculation sovereignty.

## Edge Coverage

**Coverage:** 6/6 applicable edges resolved · 0 unresolved

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| Payload Overflow | SUBQ-02 | ✅ covered | Image > 4 MiB rejected client-side before network dispatch. |
| Malformed URI | SUBQ-04 | ✅ covered | Regex strips `data:image/...;base64,` prefix cleanly. |
| Empty Images | SUBQ-02 | ✅ covered | Image array undefined or length 0 omitted from JSON payload. |
| Questions Bound | SUBQ-01 | ✅ covered | More than 16 questions in batch chunked into sub-batches. |
| API Rate Limit | SUBQ-01 | ✅ covered | HTTP 429 maps to `DecisionProviderError` with Retry-After handling. |
| Boundary Failure | SUBQ-03 | ✅ covered | $t_{\text{actual}} < t_{\text{required}}$ routed to Tier 3 in pure TS before SubQ call. |

## Prohibitions (must-NOT)

**Coverage:** 5/5 applicable prohibitions resolved · 0 unresolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| MUST NOT send data URI prefixes in `images.base64` | SUBQ-04 | resolved | Client sanitizes base64 string, preventing HTTP 422. |
| MUST NOT exceed 4 images or 8 MiB decoded total payload | SUBQ-02 | resolved | Client asserts length <= 4 and checks decoded byte sizes. |
| MUST NOT perform arithmetic calculations inside SubQ questions | SUBQ-03 | resolved | `lib/calc/` computes 100% of arithmetic; SubQ only routes and classifies. |
| MUST NOT modify `lib/calc/` or `lib/criteria/` files | SUBQ-03 | resolved | Git status check verifies byte-identity of protected trees. |
| MUST NOT leak unparsed provider response text to callers | SUBQ-01 | resolved | Answers are parsed and typed directly to `NoulResult`, `ChoiceResult`, `ScoreResult`. |

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                              |
|--------------------|-------|------|--------|------------------------------------|
| Goal Clarity       | 0.96  | 0.75 | ✓      | SubQ Snap client and benchmark harness defined |
| Boundary Clarity   | 0.94  | 0.70 | ✓      | Fork B isolated to feat/subq-snap |
| Constraint Clarity | 0.97  | 0.65 | ✓      | Native SubQ parameters & limits documented |
| Acceptance Criteria| 0.95  | 0.70 | ✓      | Explicit pass/fail checks across all features |
| **Ambiguity**      | 0.09  | ≤0.20| ✓      | Specification is unambiguous       |

## Interview Log

| Round | Perspective    | Question summary                                 | Decision locked                    |
|-------|----------------|--------------------------------------------------|------------------------------------|
| 1     | Researcher     | What model and endpoint does SubQ Decisions API use? | `POST /v1/systemone` using model `subq-snap-preview`. |
| 2     | Simplifier     | How are images passed to SubQ?                   | In `images` array with `mediaType` and raw base64 (no data URI prefix). |
| 3     | Boundary Keeper| How is the benchmark comparison structured?      | Harness evaluates both providers on identical scenarios for latency, calibration, and cost. |
