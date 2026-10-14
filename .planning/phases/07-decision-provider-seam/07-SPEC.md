# Phase 7: Decision Provider Seam & Nebius Fast Decision Engine (Fork A) — Specification

**Created:** 2026-10-14
**Ambiguity score:** 0.08 (gate: ≤ 0.20)
**Requirements:** 8 locked (DEC-01..04, SPIKE-01..04)

## Goal

Implement a pluggable `DecisionProvider` typed primitive seam (`choice`, `noul`, `score`) and a Nebius Token Factory adapter (`nvidia/Nemotron-3_5-Lightning`) in isolated worktree `../flawcheck-nvidia-system1` (`feat/nvidia-system1`), proving 4 NDT domain spikes with fail-closed gates while enforcing pure TypeScript calculation sovereignty with zero LLM arithmetic.

## Background

FlawCheck currently utilizes Nebius Token Factory for two distinct autoregressive LLM roles (`lib/llm/client.ts`, `lib/llm/complete.ts`):
1. `nvidia/Nemotron-3_5-Lightning` for structured reading and metadata extraction (`/api/reasoning/extract`).
2. `nvidia/nemotron-3-super-120b-a12b` for streaming clause-cited narrative generation (`/api/reasoning/narrative`).

While powerful for narrative generation, autoregressive generation introduces multi-second token latency, unconstrained text risk, and complex prompt scaffolding when making high-speed operational decisions, routing inspections, or verifying guardrails. System-1 fast decision architectures replace freeform text generation with single-pass typed decision primitives (`choice`, `noul`, `score`).

To evaluate this paradigm in Fork A (`feat/nvidia-system1`), Phase 7 introduces the `DecisionProvider` interface and implements `NebiusNemotronDecisionProvider` using `nvidia/Nemotron-3_5-Lightning` on Nebius Token Factory with zero-temperature JSON mode and balanced-brace recovery. Phase 7 proves this architecture across 4 critical NDT domain spikes (Fluid Classifier, Fleet Triage, PT/MT Morphology, and Semantic Guard) while maintaining absolute calculation purity in `lib/calc/`.

## Requirements

1. **DEC-01 (Unified DecisionProvider Interface)**:
   - Current: No unified fast decision interface exists; calls directly instantiate OpenAI clients with raw prompt completions.
   - Target: `lib/decision/types.ts` defines `DecisionProvider` exporting typed primitive methods:
     - `choice<T>(context, options)`: Categorical selection among 2–255 options with probability distribution and scalar confidence.
     - `noul(context, criteria, threshold?)`: Calibrated binary probability gate returning $p \in [0.0, 1.0]$ and boolean verdict.
     - `score(context, levels)`: Ordered multi-level rating (2–10 levels) returning weighted continuous score and discrete level index.
     - `batch(context, questions)`: Multi-question atomic evaluation across a single state context.
   - Acceptance: TypeScript interfaces compile cleanly with no `any` types; unit test proves mock provider fulfills all four signatures.

2. **DEC-02 (Nebius Nemotron-3.5-Lightning Adapter)**:
   - Current: `lib/llm/complete.ts` is coupled to chat completion schemas and narrative streaming.
   - Target: `lib/decision/providers/nebius-nemotron.ts` implements `DecisionProvider` targeting `nvidia/Nemotron-3_5-Lightning` on Nebius Token Factory (`https://api.tokenfactory.nebius.com/v1/`) with zero-temperature, single-pass evaluation, and JSON schema constraints.
   - Acceptance: Provider handles successful responses, maps completion JSON into `ChoiceResult`, `NoulResult`, and `ScoreResult`, and applies `extractBalancedObjects` to recover from leading prose preambles without throwing syntax errors.

3. **DEC-03 (Zero-Text-Leakage & Typed Returns)**:
   - Current: LLM outputs contain unstructured markdown and conversational phrasing.
   - Target: Decision primitives return strictly typed numerical probabilities, integer levels, enum keys, and booleans. No freeform markdown or unconstrained text is returned to calling business logic.
   - Acceptance: Zod runtime validation rejects any provider output containing non-whitelisted text keys or malformed probability distributions ($\sum p \approx 1.0$).

4. **DEC-04 (Pure TypeScript Arithmetic Sovereignty)**:
   - Current: `lib/calc/` computes all wall thickness math ($t_{\text{required}}$, $CR$, $RL$, intervals) independently of the LLM.
   - Target: System-1 models strictly classify, triage, and guard; models NEVER calculate arithmetic formulas ($t = \frac{P \cdot D}{2(SEW + PY)}$, Barlow, remaining life). Pure TypeScript calculates 100% of arithmetic.
   - Acceptance: When `FLAWCHECK_DISABLE_LLM=1`, 100% of calculation test suites pass hermetically with 0 model calls; eslint boundary rules in `eslint.config.mjs` and `boundary-imports.test.ts` forbid `lib/calc/` from importing `lib/decision/`.

5. **SPIKE-01 (Spike A: API 570 Fluid Classifier)**:
   - Current: Process service class is manually entered or defaulted.
   - Target: Classify raw piping process descriptions into API 570 Table 1 (Class 1, 2, 3, or 4) with calibrated confidence. If confidence $p < 0.85$, trigger a fail-closed `inspector_review_required` flag.
   - Acceptance: Evaluation over 20 curated NDT process fluid cases achieves $\ge 95\%$ classification accuracy on clear cases and correctly trips the fail-closed review flag on borderline/toxic edge cases ($H_2S > 3\%$, HF acid).

6. **SPIKE-02 (Spike B: High-Throughput Fleet Triage)**:
   - Current: Inspection results table displays all readings linearly without automated priority triage.
   - Target: Batch-evaluate 4,912 Zenodo UT readings into Tiers 1–3 routing:
     - Tier 1 (Routine): $t_{\text{actual}} \ge t_{\text{required}} + \text{uncertainty}$ and $RL > 10\text{ yr}$.
     - Tier 2 (Re-Check): Borderline thickness or $4\text{ yr} \le RL \le 10\text{ yr}$.
     - Tier 3 (Critical Escalation): $t_{\text{actual}} < t_{\text{required}}$ or $RL < 4\text{ yr}$ or statistical MAD outlier.
   - Acceptance: Entire 4,912-reading register screens without rate-limit abortion, memory leaks, or non-finite arithmetic errors; deterministic failures ($t_{\text{actual}} < t_{\text{required}}$) are 100% routed to Tier 3.

7. **SPIKE-03 (Spike C: ASME B31.3 PT/MT Morphology Classifier)**:
   - Current: PT/MT indications rely on manual dimension comparisons in `lib/calc/ptmt.ts`.
   - Target: Classify textual flaw indications into linear ($L > 3W$) versus rounded ($L \le 3W$) per ASME B31.3 §344.4.2 and §344.3.2.
   - Acceptance: Rejects 100% of linear indications (cracks, lack of fusion) with zero false negatives; boundary cases with $L = 3W$ classified as rounded per code definition.

8. **SPIKE-04 (Spike D: Semantic Guardrail)**:
   - Current: Narrative lints rely on brittle regex substring matching (`lib/reasoning/lints.ts`).
   - Target: Fast non-autoregressive semantic guard verifying that generated reports cite only allowlisted standards from `lib/criteria/citations.json` and accurately state computed calculation values.
   - Acceptance: Gate returns `isGrounded: false` ($p < 0.05$) when unallowlisted standards or mismatched numbers are injected, and `isGrounded: true` ($p \ge 0.95$) on verified clean reports.

## Boundaries

**In scope:**
- Git worktree scaffolding: `../flawcheck-nvidia-system1` on branch `feat/nvidia-system1`.
- `lib/decision/types.ts`: TypeScript contracts for `DecisionProvider`, `ChoiceResult`, `NoulResult`, `ScoreResult`.
- `lib/decision/providers/nebius-nemotron.ts`: Nebius Token Factory adapter for `nvidia/Nemotron-3_5-Lightning`.
- `lib/decision/spikes/`: Implementation and tests for Spikes A, B, C, D.
- Verification tests proving pure TS calc independence under `FLAWCHECK_DISABLE_LLM=1`.

**Out of scope:**
- SubQ Snap API integration (reserved for Phase 8 / Fork B).
- Modifying main repository application source code (`lib/calc/`, `lib/criteria/`, `components/`, `app/`).
- Multi-modal image uploading on Nebius (Nemotron-3.5-Lightning on Token Factory is text-only).
- Modifying existing narrative generation routes (`/api/reasoning/narrative`).

## Constraints

- **Worktree Isolation**: Worktree must be rooted in `../flawcheck-nvidia-system1` off branch `feat/nvidia-system1`, leaving `master` at commit `6764cbe`.
- **Protected Trees**: `lib/calc/` and `lib/criteria/` must remain byte-identical; zero arithmetic formulas allowed in LLM prompts.
- **Fail-Closed Threshold**: Spike A fluid classification must require $p \ge 0.85$ confidence; any score below 0.85 requires manual inspector disposition.
- **Test Baseline**: All 504 (or 583) hermetic tests must continue to pass in the worktree.

## Acceptance Criteria

- [ ] Worktree `../flawcheck-nvidia-system1` exists on branch `feat/nvidia-system1` and builds cleanly (`npm run build`).
- [ ] `lib/decision/types.ts` exports `DecisionProvider`, `ChoiceResult`, `NoulResult`, `ScoreResult` with 0 TypeScript compiler errors.
- [ ] `NebiusNemotronDecisionProvider` executes single-pass decisions against Nebius Token Factory using zero temperature and JSON mode.
- [ ] `extractBalancedObjects` successfully recovers JSON payloads when Nemotron outputs conversational preambles.
- [ ] Spike A (Fluid Classifier) achieves $\ge 95\%$ accuracy on API 570 Table 1 test suite and triggers fail-closed review on $p < 0.85$.
- [ ] Spike B (Fleet Triage) processes the 4,912 Zenodo readings without memory leaks or crash.
- [ ] Spike C (PT/MT) accurately identifies linear vs rounded indications per ASME B31.3 §344 with 0 false negatives on crack notes.
- [ ] Spike D (Semantic Guard) rejects hallucinated citations and falsified calculation numbers.
- [ ] All tests pass with `FLAWCHECK_DISABLE_LLM=1` verifying pure TypeScript calculation sovereignty.

## Edge Coverage

**Coverage:** 6/6 applicable edges resolved · 0 unresolved

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| Boundary Inputs | DEC-01 | ✅ covered | Empty options `{}` or >255 options throws `DecisionValidationError`. |
| Ambiguous Text | SPIKE-01 | ✅ covered | Stream notes with mixed fluids trigger $p < 0.85$ fail-closed inspector flag. |
| Non-finite Data | SPIKE-02 | ✅ covered | Readings with `NaN` or `Infinity` rejected before triage call by pure TS guard. |
| Critical Flaw | SPIKE-02 | ✅ covered | Readings with $t_{\text{actual}} < t_{\text{required}}$ hardwired to Tier 3 regardless of AI score. |
| Geometric Boundary | SPIKE-03 | ✅ covered | Indication with $L = 3W$ classified as rounded ($L \le 3W$) per ASME B31.3. |
| Model Preamble | DEC-02 | ✅ covered | `extractBalancedObjects` extracts JSON object if model outputs leading conversational text. |

## Prohibitions (must-NOT)

**Coverage:** 5/5 applicable prohibitions resolved · 0 unresolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| MUST NOT perform arithmetic calculations inside the LLM | DEC-04 | resolved | Boundary tests verify `lib/calc/` has 0 LLM dependencies and performs 100% of math. |
| MUST NOT return freeform unparsed text to business logic | DEC-03 | resolved | Zod schema validation ensures only typed primitive objects are returned. |
| MUST NOT modify `lib/calc/` or `lib/criteria/` files | DEC-04 | resolved | Git status check verifies byte-identity of protected trees. |
| MUST NOT fail open on uncertain fluid classifications | SPIKE-01 | resolved | Test asserts that $p < 0.85$ sets `inspector_review_required: true`. |
| MUST NOT make live network calls during unit test runs | DEC-02 | resolved | `FLAWCHECK_DISABLE_LLM=1` triggers hermetic test mocks with 0 network calls. |

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                              |
|--------------------|-------|------|--------|------------------------------------|
| Goal Clarity       | 0.95  | 0.75 | ✓      | Clear objective and worktree target |
| Boundary Clarity   | 0.92  | 0.70 | ✓      | Fork A isolated to feat/nvidia-system1 |
| Constraint Clarity | 0.96  | 0.65 | ✓      | Protected trees and fail-closed thresholds defined |
| Acceptance Criteria| 0.94  | 0.70 | ✓      | All 9 criteria are falsifiable checkboxes |
| **Ambiguity**      | 0.08  | ≤0.20| ✓      | Specification is unambiguous       |

## Interview Log

| Round | Perspective    | Question summary                                 | Decision locked                    |
|-------|----------------|--------------------------------------------------|------------------------------------|
| 1     | Researcher     | Which model on Nebius Token Factory should be used? | `nvidia/Nemotron-3_5-Lightning` at zero temperature. |
| 2     | Simplifier     | How should binary decisions be represented?      | `noul` primitive returning calibrated probability float $p \in [0.0, 1.0]$. |
| 3     | Boundary Keeper| Can Nemotron compute corrosion rates or $t_{\text{req}}$? | Absolutely forbidden. 100% of arithmetic remains in `lib/calc/`. |
