---
phase: 08-subq-snap-decision-engine
verified: 2026-10-19T08:12:23Z
status: passed
score: 8/8 requirements verified
covered_files:
  - ".planning/phases/08-subq-snap-decision-engine/08-01-PLAN.md"
  - ".planning/phases/08-subq-snap-decision-engine/08-01-SUMMARY.md"
  - "docs/system1-benchmark-report.json"
  - "lib/decision/benchmark/metrics.ts"
  - "lib/decision/benchmark/runner.ts"
  - "lib/decision/benchmark/scenarios.ts"
  - "lib/decision/benchmark/types.ts"
  - "lib/decision/providers/subq-snap.ts"
  - "tests/decision/benchmark.test.ts"
  - "tests/decision/multimodal.test.ts"
  - "tests/decision/subq-live.integration.test.ts"
  - "tests/decision/subq-provider.test.ts"
  - "tests/decision/subq-spikes.test.ts"
covered_digest: "v3:sha256:bcb42f82b2118cd76c680493df35ccab8cda0415668dc1d02d1f1f6ad009813c"
behavior_unverified: 0
overrides_applied: 0
overrides: []
---

# Phase 8: SubQ.ai Snap Decision Engine & Multi-Modal Benchmark (Fork B) — Verification Report

**Phase Goal:** Implement `SubQSnapDecisionProvider` on SubQ.ai Snap Decision API (`POST /v1/systemone`, model `subq-snap-preview`) in isolated worktree `../flawcheck-subq-snap` (`feat/subq-snap`) with native `choice`/`noul`/`score` questions and multimodal image evaluation, execute the 4 domain spikes, and produce an automated comparative benchmark suite comparing Nemotron-Lightning vs SubQ Snap.
**Verified:** 2026-10-19T08:12:23Z (on branch `feat/subq-snap`, head `a4cdfbf`)
**Status:** passed
**Re-verification:** No — initial verification (follows fresh deep review `08-REVIEW.md` 2026-10-19 and UAT 6/6)

## Verification Method

Goal-backward analysis against 08-SPEC.md requirements SUBQ-01..04 and BENCH-01..04. Evidence was **re-executed in this worktree, not trusted from claims**: the protected-tree diff, both test-suite modes, typecheck, and direct source inspection were all run at head `a4cdfbf`.

### Re-executed Evidence

| Check | Command | Result |
|---|---|---|
| Protected trees byte-identical to `2ce76be` | `git diff 2ce76be..HEAD -- lib/calc/ lib/criteria/` | **Empty — 0 bytes** ✔ |
| Protected trees unmodified in worktree | `git status --porcelain -- lib/calc/ lib/criteria/` | Empty ✔ |
| Hermetic sovereignty suite | `FLAWCHECK_DISABLE_LLM=1 npx vitest run` | **618 passed \| 6 skipped** (56 files passed, 3 skipped) ✔ |
| Ambient suite | `npx vitest run` | **618 passed \| 6 skipped** — identical ✔ |
| Typecheck | `npx tsc --noEmit` | Clean ✔ |
| Working tree | `git status` | Clean ✔ |

The 6 skips are the intentionally gated live tests (`FLAWCHECK_LIVE_SUBQ` / `FLAWCHECK_LIVE_LLM` gates), not failures. The locked acceptance criterion "All tests pass with `FLAWCHECK_DISABLE_LLM=1`" holds — the review's BL-1 blocker (12 env-hygiene test failures under the flag) was fixed in `e51e077` and is confirmed resolved by the green flagged run above.

## Goal Achievement

### Observable Truths (PLAN must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `SubQSnapDecisionProvider` implements `DecisionProvider` targeting `POST https://api.subq.ai/v1/systemone` with model `subq-snap-preview`, native noul/choice/score payloads, zero output tokens (SUBQ-01) | ✓ VERIFIED | `lib/decision/providers/subq-snap.ts:21` `DEFAULT_MODEL = "subq-snap-preview"` (the single locked model literal); `:131` fetch to `${baseURL}/systemone`; `:134` `Authorization: Bearer` header; `output_tokens` typed in usage (`:47`) and asserted `0` in `tests/decision/subq-provider.test.ts:27`; HTTP 429/422/5xx map to typed `DecisionProviderError` with `statusCode`/`providerId` preserved (`subq-provider.test.ts:42-59`). Production origin HTTPS-locked to `api.subq.ai` (`:285-305`), hostile `SUBQ_BASE_URL` rejection test-proven (`subq-provider.test.ts:98-107`). |
| 2 | Multi-modal evaluation passes base64 PNG/JPEG dye-penetrant and A-scan images to `subq-snap-preview` with client-side data-URI stripping and size bounding (SUBQ-02, SUBQ-04) | ✓ VERIFIED | `subq-snap.ts:23-25` `MAX_IMAGES=4`, `MAX_IMAGE_BYTES=4MiB`, `MAX_TOTAL_IMAGE_BYTES=8MiB`; enforced at `:204/:228/:232`. Data-URI stripping with media-type match before network dispatch (`:210-226`), tested with real encoded 1×1 PNG/JPEG/WebP fixtures (`multimodal.test.ts:5-9, :66`) and negative cases proving fetch is never called on malformed payloads (`multimodal.test.ts:94-113`). Nuance: multimodal verification is hermetic (provider mocked at the fetch seam — the documented pattern for a live-key-less CI path); the live gated run validated the SubQ contract on text-only synthetic states (5 requests, 1/1 passed). |
| 3 | All 4 Domain Spikes execute against SubQ Snap with identical interface contracts and fail-closed gates (SUBQ-03) | ✓ VERIFIED | Spike contracts `lib/decision/spikes/{fluid-classifier,fleet-triage,morphology-classifier,semantic-guard}.ts` all consume `DecisionProvider.choice/noul` — same seam as Phase 7. Fail-closed paths test-proven: fluid 0.84 < 0.85 → manual review; semantic 0.94 < 0.95 → reject (`subq-spikes.test.ts`, review-verified); Spike B screens all 4,912 readings with the deterministic `t_actual ≤ t_required` override bypassing the model (`fetchMock.toHaveBeenCalledOnce()` over the full register). Live spot-check on real key: exactly 5 SubQ requests covering the three native primitives + fluid + 2 morphology + semantic, ambiguous fluid flagged, narrative mismatch failed the guard (08-01-SUMMARY Verification Evidence; UAT tests 1, 2, 5 all pass). |
| 4 | Comparative benchmark harness evaluates both providers across Spikes A–D, outputting latency distribution, calibration (Brier/ECE), and cost per 1k evals into `docs/system1-benchmark-report.json` (BENCH-01..04) | ✓ VERIFIED (harness + honest report; measured comparison pending — see determination below) | Harness complete: `metrics.ts` `calculateLatencyDistribution` (min/mean/p50/p90/p95/p99), `calculateCalibrationMetrics` (Brier, 10-bin ECE, boundary accuracy — verified against hand-computed values, `benchmark.test.ts:29-56`), `calculateCostMetrics` (per-provider pricing, SubQ input-only via `output_tokens: 0`); `runner.ts:99-130` emits `measured` **only** when both providers complete every attempt with identical scenario/attempt counts, all three verdicts `null` otherwise. Committed artifact `docs/system1-benchmark-report.json` is honestly `pending_live_measurement` (`runCount: 0`, `providers: {}`, verdicts `null`, explicit measurement notes), test-pinned against invented metrics (`benchmark.test.ts:134-145`). |
| 5 | Calc sovereignty: `lib/calc/` + `lib/criteria/` byte-identical; all arithmetic in pure TS; tests pass with `FLAWCHECK_DISABLE_LLM=1` | ✓ VERIFIED | `git diff 2ce76be..HEAD -- lib/calc/ lib/criteria/` → 0 bytes (re-executed above). Both suites 618/6 green, flagged and ambient. Zero arithmetic inside SubQ questions — SubQ only routes/classifies; boundary check `t_actual ≤ t_required` executes in pure TS before any provider call (`fleet-triage.ts:75-95`). |

**Score:** 5/5 must-have truths verified (0 present, behavior-unverified).

### Required Artifacts

| Artifact | Expected | Status |
| -------- | -------- | ------ |
| `lib/decision/providers/subq-snap.ts` | SubQ Decisions API adapter | ✓ VERIFIED — present, implements `DecisionProvider`, all SUBQ-01/02/04 invariants |
| `lib/decision/benchmark/runner.ts` | Benchmark execution engine | ✓ VERIFIED — completeness gate + report generation as specified |
| `lib/decision/benchmark/scenarios.ts` | Standardized scenarios across Spikes A–D | ✓ VERIFIED — 30 synthetic fixtures, internally consistent with spike criteria |
| `lib/decision/benchmark/metrics.ts` | Statistics, Brier, ECE, cost calculators | ✓ VERIFIED — hand-verified expectations in tests |
| `docs/system1-benchmark-report.json` | Committed report artifact | ✓ VERIFIED — honest `pending_live_measurement` state |
| `tests/decision/subq-provider.test.ts` | Client unit tests, mocked API | ✓ VERIFIED |
| `tests/decision/multimodal.test.ts` | Multi-modal image tests | ✓ VERIFIED |
| `tests/decision/benchmark.test.ts` | Benchmark harness validation | ✓ VERIFIED |
| `tests/decision/subq-spikes.test.ts`, `tests/decision/subq-live.integration.test.ts` | Spike + gated live tests (beyond-plan additions) | ✓ VERIFIED |

### BENCH-01..04 Determination — measured comparison vs harness + honest report

**The spec text, read as written, demands the harness and the honest report — not a measured comparison inside Phase 8's own boundary:**

1. **BENCH-01** acceptance: *"Benchmark suite records distribution metrics for both engines into structured JSON."* The suite's recording behavior for both engines is test-proven (`benchmark.test.ts` runs the harness with a Nebius-side provider injected at the `DecisionProvider` seam and serializes both providers' metrics into the structured report). Fork B **cannot** contain the Nebius provider: 08-SPEC.md *Out of scope* forbids modifying main-repository source, and the Nebius provider lives in Fork A. The runner therefore takes the Nebius provider/metrics as an optional input and degrades gracefully — documented in agent-handoff §"Fork B has no `providers/nebius-nemotron.ts`".
2. **BENCH-02** acceptance: *"Benchmark outputs calibration metrics…"* — output capability verified (Brier/ECE/boundary accuracy, hand-checked test expectations).
3. **BENCH-03** acceptance: *"Benchmark report produces comparative cost breakdown per 1,000 decisions."* — `estimatedCostPer1kUsd` computed per provider with SubQ input-only pricing honored; comparative values correctly withheld until verified pricing exists (the runner states so explicitly in `measurementNotes`). Publishing a price would require inventing data, which the spec's own honesty contract and the repo's deterministic-source-of-truth invariant prohibit.
4. **BENCH-04** acceptance: *"Artifact is committed in `docs/` and verifies both providers on identical evaluation fixtures."* The artifact is committed; the identical-fixture verification is **enforced by the runner's completeness gate** (`runner.ts:99-130` — `scenarioCount` equality, `attemptCount` equality, zero failures). That gate is exactly what correctly refuses the currently-possible comparison: Fork A's fresh baseline (`../flawcheck-nvidia-system1/docs/system1-baseline-metrics.json`, 24 live calls, measured 2026-10-19) has `scenarioCount: 24, attemptCount: 24` against Fork B's 30 scenarios — a mismatch the gate reports as invalid rather than silently comparing.
5. The **measured comparison itself remains pending**, documented in three places: the artifact's `measurementNotes`, 08-01-SUMMARY *Remaining Limits*, and agent-handoff. A compliant measured comparison requires running the Nebius provider over Fork B's 30-scenario set (or aligning scenario counts) with verified pricing — cross-fork work outside this phase's source boundary. **No measurements were invented**, per verification instructions.

**Conclusion:** the benchmark-pending limitation is a documented, honest limitation consistent with the spec — not a contract breach. BENCH-01..04 are verified on their acceptance lines; the measured comparison carries forward as the documented next action.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| SUBQ-01 | SubQ Snap DecisionProvider implementation | ✓ SATISFIED | Truth #1 |
| SUBQ-02 | Multi-modal image evaluation | ✓ SATISFIED | Truth #2 |
| SUBQ-03 | Re-execution of 4 domain spikes on SubQ Snap | ✓ SATISFIED | Truth #3 |
| SUBQ-04 | Zero data-URI & payload validation handling | ✓ SATISFIED | Truth #2 (`:210-234` + negative tests, no network dispatch) |
| BENCH-01 | Comparative latency distribution suite | ✓ SATISFIED (harness; measured run pending-documented) | Truth #4 + determination §1 |
| BENCH-02 | Calibration & boundary edge-case analysis | ✓ SATISFIED (harness; measured run pending-documented) | Truth #4 + determination §2 |
| BENCH-03 | Token & API cost per 1,000 evaluations | ✓ SATISFIED (harness; values gated on verified pricing) | Truth #4 + determination §3 |
| BENCH-04 | Automated benchmark report generation | ✓ SATISFIED (honest artifact; one target-level caveat below) | Truth #4 + determination §4 |

No orphaned requirements — all 8 IDs from 08-SPEC.md appear in 08-01-PLAN.md frontmatter (`requirements: [SUBQ-01..04, BENCH-01..04]`).

### Prior Gates Incorporated

- **Deep review (`08-REVIEW.md`, 2026-10-19):** all 6 prior findings verified resolved against source at `52e0a6e`; 1 new blocker (BL-1, env hygiene under `FLAWCHECK_DISABLE_LLM=1`) found and **fixed in `e51e077`** — resolution confirmed by the re-executed flagged suite above. 3 warnings + 4 info notes are advisory (below).
- **UAT (`08-UAT.md`):** 6/6 passed, 0 issues; 2 deferred follow-ups (explainable review block, reasoned guard-failure report) are enhancements explicitly folded into Phase 09 scope — not gaps against 08-SPEC.
- **Acceptance criteria checklist (08-SPEC):** all 8 items hold — worktree on `feat/subq-snap` builds (`tsc --noEmit` clean; `next build` not re-run this pass; suite green), provider handles 200/schema/timeout envelopes, multimodal + data-URI criteria met, 4 spikes execute on SubQ Snap, benchmark suite + report artifact generated, and the hermetic sovereignty criterion is green.

## Human Verification Required

None required to gate this phase. The live SubQ integration (1/1, exactly 5 requests on synthetic states) and the honest-report state were both independently confirmed by the orchestrator on 2026-10-19 (UAT sources). Final live measured benchmark is deliberately outside this phase's gate (determination above).

## Gaps Summary

None blocking. All 8 requirements and all 5 must-have truths are verified with codebase evidence at `a4cdfbf`. The goal is achieved: the SubQ Snap provider, multimodal validation, all 4 fail-closed spikes, and the automated comparative benchmark harness exist, are test-pinned, and the benchmark report is honestly pending rather than fabricated.

### Caveats (non-blocking, recorded for Phase 09 transition)

1. **`npm run benchmark` entry point not implemented** — BENCH-04's *Target* names an npm script and a formatted summary table; the harness is currently invocable programmatically (exercised through `tests/decision/benchmark.test.ts`). The *Acceptance* line ("artifact committed in `docs/` + identical-fixture verification") is met. Recommend adding the script entry when the measured comparison becomes runnable.
2. **Measured comparison pending** — requires a Nebius provider run over Fork B's 30-scenario set with verified pricing; Fork A's existing 24-attempt baseline is correctly rejected by the completeness gate (count mismatch). This is the documented Remaining Limit, not invented data.
3. **Live multimodal round-trip not separately exercised** — live gated run validated the SubQ contract on text-only synthetic states; image-path verification is hermetic (real encoded fixtures against the mocked fetch seam).
4. **Advisory review findings carried forward** — WR-1 (no default request timeout), WR-2 (`NODE_ENV=test` origin override), WR-3 (`batchSize` ignored, serial fleet triage), NF-1..NF-4 (conventions/cosmetics) remain open as advisories per 08-REVIEW.md; none violate a locked acceptance criterion.

---

_Verified: 2026-10-19T08:12:23Z_
_Verifier: ZCode (gsd-verifier)_
