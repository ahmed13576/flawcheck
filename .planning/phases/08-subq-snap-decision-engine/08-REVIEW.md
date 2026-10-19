---
phase: 08-subq-snap-decision-engine
reviewed: 2026-10-19T13:05:00Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - agent-handoff.md
  - docs/system1-benchmark-report.json
  - lib/decision/benchmark/metrics.ts
  - lib/decision/benchmark/runner.ts
  - lib/decision/benchmark/scenarios.ts
  - lib/decision/benchmark/types.ts
  - lib/decision/providers/subq-snap.ts
  - tests/decision/benchmark.test.ts
  - tests/decision/multimodal.test.ts
  - tests/decision/subq-live.integration.test.ts
  - tests/decision/subq-provider.test.ts
  - tests/decision/subq-spikes.test.ts
status: issues_found
issues_found: 8
critical: 1
warning: 3
info: 4
---

# Phase 08: Deep Code Review Report (post-fix verification)

**Reviewed:** 2026-10-19T13:05:00Z
**Depth:** deep (cross-file: import graph, spike↔provider↔test seams, git evidence)
**Files Reviewed:** 12 required + supporting context (`08-SPEC.md`, `08-01-PLAN.md`, prior `REVIEW.md`, `lib/decision/types.ts`, `lib/decision/spikes/*.ts`, `eslint.config.mjs`, `vitest.config.ts`)
**Status:** issues_found

## Summary

The six findings from the prior 2026-10-15 adversarial review were **all genuinely fixed in commit `52e0a6e`** — verified against current source, not against its claims: choice confidence/probabilities are now bounds-and-key validated server-response-side, the endpoint is HTTPS-locked with production pinned to the `api.subq.ai` origin, the benchmark reports `measured` only when both providers complete every attempt, image padding/data-URI validation is strict, scenario/run counts are separated, and multimodal tests use real encoded images. `lib/calc/` and `lib/criteria/` are byte-identical to baseline `2ce76be` (empty `git diff 2ce76be..HEAD` on both trees, clean working tree, boundary-imports test green); no hardcoded `nvidia/` or SubQ model IDs outside the single locked `DEFAULT_MODEL` constant; the committed benchmark report remains honestly `pending_live_measurement` with zero invented metrics or prices.

One new blocker was found: with `FLAWCHECK_DISABLE_LLM=1` set, **12 Phase-08 tests fail** because the provider's kill switch fires before the (already-stubbed) fetch and the new test files never clear the ambient flag — violating the locked 08-SPEC acceptance criterion "All tests pass with `FLAWCHECK_DISABLE_LLM=1`" and the repo's own established per-test env-management pattern. Three warnings (no default request timeout, ignored `batchSize` in fleet triage, the `NODE_ENV=test` origin-override escape hatch) and four info-level notes round out the report.

---

## Verifications of Critical Invariants

1. **Protected trees byte-identical** — `git diff 2ce76be..HEAD -- lib/calc/ lib/criteria/` is empty (0 bytes), working tree clean for both paths; `tests/ingest/boundary-imports.test.ts` passes (3/3). ✔
2. **Env-only routing, no hardcoded model IDs** — `grep -rniE "nemotron|nvidia/"` over `lib/` hits only a doc comment in `benchmark/types.ts:5`; the only model literal is `DEFAULT_MODEL = "subq-snap-preview"` (`subq-snap.ts:21`), which is the locked API invariant (SUBQ-01). ✔
3. **Provider security** — API key never appears in error messages or logs (`subq-snap.ts:140-149` uses network-error `message` / server `detail.message` only); `readErrorBody` tolerates non-JSON bodies (try/catch, `subq-snap.ts:275-282`); probability/confidence/distribution validated on the server-response side (`mapAnswer`, `subq-snap.ts:236-273`); fetch honors `context.signal` (`subq-snap.ts:138`). See WR-1 for the timeout gap. Mostly ✔
4. **Benchmark honesty** — `runner.ts:99-130`: status `measured` only when both providers have `successCount === attemptCount` and zero failures for identical scenario/attempt counts; all three verdicts `null` otherwise; failure counts + sliced diagnostics included. `docs/system1-benchmark-report.json` is `pending_live_measurement`, `runCount: 0`, `providers: {}`, no pricing claims, and `benchmark.test.ts:134-145` guards the committed artifact against invented measurements. ✔
5. **Multi-modal validation** — charset regex `^[A-Za-z0-9+/]*={0,2}$`, CRLF rejection, length-%-4 and padding-congruence checks, decoded-size bounds per image (4 MiB) and total (8 MiB), data-URI media-type match before stripping (`subq-snap.ts:202-234`). ✔
6. **Hermeticity** — default hermetic run (no flag set; `.env.local` has `FLAWCHECK_DISABLE_LLM=` empty) passes 34/35 decision tests with zero network (fetch stubbed; live test skip-gated). However `FLAWCHECK_DISABLE_LLM=1` breaks 12 tests — see BL-1. Live test correctly `describe.skipIf(!FLAWCHECK_LIVE_SUBQ)` and uses only synthetic states (`subq-live.integration.test.ts:8-79`). Partial ✔
7. **Cross-file seam consistency** — spike contracts (`choice`/`noul` over `DecisionProvider`) match provider `batch()`-backed implementations; benchmark `scenarios.ts` question shapes match `DecisionBatchQuestions`; benchmark runner's score-probability key convention (`String(index)`) matches the provider's `mapAnswer` legend keys. No type drift found at any seam. ✔
8. **Error envelopes** — HTTP 429/422 map to typed `DecisionProviderError` with `statusCode`/`providerId` preserved (`subq-provider.test.ts:42-59`); no `JSON.parse` on untrusted error bodies (provider uses `Response.json()` inside try/catch); `output_tokens: 0` telemetry honored (`subq-snap.ts:176`, asserted in tests). ✔

---

## Prior Review Resolution

Verification of the 2026-10-15 `REVIEW.md` findings against current source at `10a3fdc` (fix commit: `52e0a6e`). Claims were **not** trusted — each was re-checked in code and re-executed in tests.

| Finding | Resolved? | Evidence |
|---|---|---|
| CR-01 Unvalidated choice confidence can bypass fail-closed review | **yes** | `lib/decision/providers/subq-snap.ts:250-253` — choice answers now require `isProbability(raw.confidence)` (finite, [0,1]), exact key match of `probabilities` against requested criteria, and every probability in [0,1] with sum within ±0.02 (`hasValidDistribution`, lines 311-320). Out-of-range confidence, NaN confidence, mismatched keys, non-summing distributions, and unrequested choices all raise `DecisionProviderError` (502). Direct tests: `tests/decision/subq-provider.test.ts:79-96` (8 malformed-answer cases, all passing). Fail-closed chain verified: `fluid-classifier.ts:54` `confidence < 0.85` can no longer be skipped by an out-of-range value. |
| CR-02 Configurable endpoint can disclose the bearer key | **yes** | `lib/decision/providers/subq-snap.ts:285-305` — `resolveBaseURL` rejects non-HTTPS, embedded URL credentials, query, and fragment; non-test `NODE_ENV` locks the origin to `https://api.subq.ai` with path `/` or `/v1` and forces the default base URL. Tests: `subq-provider.test.ts:98-107` proves `http://`, `https://attacker.example`, and a hostile `SUBQ_BASE_URL` env all throw. Residual test-env override is narrowed to a warning (WR-2 below). |
| CR-03 Failed provider runs reported as measured benchmark results | **yes** | `lib/decision/benchmark/runner.ts:99-101,176-180` — `complete` requires both providers `isComplete` (every attempt succeeded, zero failures) with equal scenario and attempt counts; otherwise status is `incomplete_measurement` with failure diagnostics or `pending_live_measurement` without a baseline; all verdicts are `null` unless complete. Test `benchmark.test.ts:110-132` proves a failing Nebius keeps status `incomplete_measurement`, verdicts null, and surfaces the `HTTP 429` diagnostic. |
| WR-01 Image validation accepts malformed padding / mismatched data URI types | **yes** | `lib/decision/providers/subq-snap.ts:210-226` — data-URI media type must equal declared `mediaType` (line 214); padding congruence computed explicitly (lines 218-223); charset regex, CRLF ban, `%4 === 1` ban, and full `malformedPadding` check on line 224. Tests `multimodal.test.ts:94-109` cover `A=`, `%%%`, mismatched data URI, and unsupported media type with fetch never called. |
| WR-02 `scenarioCount` counts repeated runs rather than scenarios | **yes** | `runner.ts:63-69` — `scenarioCount: scenarios.length` is now distinct from `attemptCount: scenarios.length * iterations`; the report writes both separately (`runner.ts:119-121`). Test `benchmark.test.ts:104-106` asserts `scenarioCount: 2, attemptCount: 6` with iterations 3. |
| WR-03 Multimodal tests label non-image bytes as images | **yes** | `tests/decision/multimodal.test.ts:5-9` — real encoded 1×1 PNG, JPEG, and WebP fixtures replace `aGVsbG8=`; the malformed-payload cases were kept as separate negative tests (`multimodal.test.ts:94-109`). |

---

## Blockers

### BL-1: `FLAWCHECK_DISABLE_LLM=1` fails 12 Phase-08 tests (locked hermetic invariant broken)

**File:** `lib/decision/providers/subq-snap.ts:117-120` (correct behavior) vs `tests/decision/subq-provider.test.ts:13-118`, `tests/decision/subq-spikes.test.ts:36-91`, `tests/decision/multimodal.test.ts:25-110` (missing env hygiene)
**Evidence:** Executed `FLAWCHECK_DISABLE_LLM=1 npx vitest run tests/decision/` → **12 failed / 22 passed / 1 skipped**. Every failure is `DecisionProviderError: [subq] 503: SubQ requests are disabled by FLAWCHECK_DISABLE_LLM` thrown at `subq-snap.ts:119` before the stubbed `fetch` is ever reached. The new test files never unset or stub the ambient flag, unlike the established repo pattern (`tests/reasoning/extract-route.test.ts:84` deletes it in `beforeEach`; `vitest.config.ts` loads `.env.local` but ambient env always wins). The 08-SPEC acceptance criterion explicitly locks "All tests pass with `FLAWCHECK_DISABLE_LLM=1`", and agent-handoff §2.5/§9 name this flag as a remaining hermetic gate — so the gate as scripted would go red.
**Why the code is right:** the kill switch firing before any fetch is exactly the fail-closed intent (invariant 5); the defect is test-side.
**Fix:** In all three test files, add `beforeEach(() => { vi.stubEnv("FLAWCHECK_DISABLE_LLM", ""); })` (or `delete process.env.FLAWCHECK_DISABLE_LLM`) with `afterEach(() => vi.unstubAllEnvs())`, mirroring `tests/reasoning/extract-route.test.ts:84`. Then add one positive fail-closed test asserting that with the flag `=1` the provider throws the typed 503 `DecisionProviderError` without calling fetch — turning the kill switch into specified behavior instead of an accident.

---

## Warnings

### WR-1: No default request timeout — a missing `signal` can hang the provider indefinitely

**File:** `lib/decision/providers/subq-snap.ts:129-139`
**Issue:** `fetch` receives only `context.signal`; nothing imposes a per-request timeout. `DecisionContext.signal` is optional, so any caller (including `BenchmarkRunner.runProviderSuite`, which passes bare `scenario.context`) can block forever on a stalled socket, and the SPEC acceptance item "handles … timeout fallbacks cleanly" is only satisfied when callers remember to wire `AbortSignal.timeout` themselves.
**Fix:** In `batch()`, coalesce the caller signal with a default deadline, e.g. `const signal = context.signal ? AbortSignal.any([context.signal, AbortSignal.timeout(DEFAULT_TIMEOUT_MS)]) : AbortSignal.timeout(DEFAULT_TIMEOUT_MS);` with `DEFAULT_TIMEOUT_MS ≈ 15_000` (guard for Node ≥ 17.3), so timeout aborts surface through the existing catch at lines 140-143 as a typed `DecisionProviderError` with `statusCode: 0`.

### WR-2: `NODE_ENV=test` allows pointing the bearer key at any HTTPS host

**File:** `lib/decision/providers/subq-snap.ts:296-300`
**Issue:** The prior review's fix made production airtight, but the escape hatch keys off the **ambient** `process.env.NODE_ENV === "test"`: whenever that env is `test`, `SUBQ_BASE_URL` or `options.baseURL` may target **any** HTTPS origin and the key is sent there. `NODE_ENV` is a shared ecosystem convention (vitest sets it automatically), so the override can be selected accidentally rather than deliberately — the prior fix explicitly asked for a channel "that cannot be selected by production environment configuration".
**Fix:** Require an explicit dedicated gate instead of (or in addition to) `NODE_ENV`: e.g. allow a non-SubQ HTTPS host only when `process.env.FLAWCHECK_ALLOW_MOCK_SUBQ_ORIGIN === "1"` is set alongside `NODE_ENV === "test"`; keep HTTP and URL-credential rejection unconditional (already the case).

### WR-3: `triageFleetBatch` ignores `batchSize` and issues 4,912 sequential provider calls

**File:** `lib/decision/spikes/fleet-triage.ts:123-152` (cross-ref `lib/decision/types.ts:80-114`, `subq-snap.ts:114-180`)
**Issue:** The function accepts `options.batchSize` but never uses it (only `options?.signal` is read) and loops `for (const reading of readings) await triageReading(...)` — one HTTP round trip per reading. On the real 4,912-reading Zenodo register (Spike B / BENCH-01) this is 4,912 serial requests; the provider's `batch()` (1–16 atomic questions over the same state) exists precisely for this fan-out and would cut both wall-clock latency and connection overhead. The dead `batchSize` parameter is an interface-vs-implementation seam the prior spec assumed would be honored.
**Fix:** Chunk readings into groups of ≤16 and dispatch one `provider.batch()` per group mapping each question to a reading ID (guarding against per-question 502 aborts), or remove the `batchSize` option and document the sequential design in the contract docblock so BENCH-01 latency claims are not overstated.

---

## Info

### NF-1: Score-probability wire convention is implicit

**File:** `lib/decision/providers/subq-snap.ts:256` ↔ `lib/decision/benchmark/runner.ts:167-169` ↔ `tests/decision/subq-provider.test.ts:18`
**Issue:** Score distributions are keyed by zero-based stringified indices (`"0".."N-1"`) in the provider's `mapAnswer`, the runner's calibration lookup (`probabilities[String(scenario.expectedAnswer)]`), and the SubQ response fixtures. Consistent today, but nowhere documented as the contract.
**Fix:** Document the index-key convention on `ScoreLevels`/`ScoreResult` in `lib/decision/types.ts` and in `benchmark/types.ts`.

### NF-2: Live-gate env var naming drifts from the repo convention

**File:** `tests/decision/subq-live.integration.test.ts:8` vs `tests/llm/hello-fixture.test.ts:19` and agent-handoff §6.3
**Issue:** The live SubQ test gates on `FLAWCHECK_LIVE_SUBQ === "1"` while the documented repo convention is `FLAWCHECK_LIVE_LLM=1`. The gating itself is correct (`describe.skipIf`, synthetic-only states, 30 s timeout), but two gate names invite confusion.
**Fix:** Either align the name or document `FLAWCHECK_LIVE_SUBQ` explicitly in the agent handoff §6.3 alongside the Nebius gate.

### NF-3: Committed report cosmetics (intentionally honest)

**File:** `docs/system1-benchmark-report.json`
**Issue:** `generatedAt` is date-only (`"2026-10-15"`) whereas `createPendingReport`/`generateComparisonReport` emit full ISO timestamps, and the artifact predates measurement by design. The honesty contract holds: `pending_live_measurement`, `runCount: 0`, empty `providers`, no pricing claims, synthetic-fixture disclosure in the notes — and `benchmark.test.ts:134-145` keeps the artifact pinned to that shape.
**Fix (optional):** Regenerate via `BenchmarkRunner.createPendingReport` at wrap-up so the timestamp format matches the runner output exactly.

### NF-4: Placeholder API key is indistinguishable from a real credential

**File:** `lib/decision/providers/subq-snap.ts:60` (cross-ref agent-handoff §3a, §6.2)
**Issue:** `.env.local` carries `SUBQ_API_KEY=your-subq-api-key-here`; the provider treats any non-empty string as a credential, so a live run with the placeholder will fail with a clean 401 `DecisionProviderError` (correct envelope mapping) rather than a clear "key not configured" signal.
**Fix (optional):** Reject the literal `your-subq-api-key-here` sentinel in the constructor with `DecisionValidationError`, or leave as-is and rely on the live-gate test's `expect(apiKey).toBeTruthy()` assertion.

---

## What Was Checked and Found Correct (no action)

- **Calibration math**: Brier score, 10-bin ECE (clamped `min(9, floor(p*10))` covers p=1.0), boundary accuracy, nearest-rank percentiles — all verified against hand-computed test expectations (`benchmark.test.ts:29-56`).
- **Runner observation mapping**: noul inversion for `expectedAnswer: false`, choice probability-of-expected-answer, score tolerance compare (`runner.ts:154-173`).
- **Scenario honesty**: all 30 fixtures are labeled `synthetic_fixture`; expected answers are internally consistent with the spike criteria strings (hydrogen→class_2, chlorine→class_1, lube oil→class_3 per `API_570_TABLE_1_CRITERIA`).
- **Fail-closed paths exercised**: fluid 0.84 < 0.85 triggers review; semantic guard 0.94 < 0.95 rejects grounding; deterministic `t_actual ≤ t_required` overrides bypass the model entirely (`fleet-triage.ts:75-95`, proven by `fetchMock.toHaveBeenCalledOnce()` over 4,912 rows).
- **No app/client import path** reaches `lib/decision` (grep over `app/`, `components/`, `hooks/`, and sibling `lib/` subsystems is clean), so the missing `server-only` guard remains theoretical; note the previous review's same conclusion.
- **Hermetic default run**: `npx vitest run tests/decision/` → 34 passed / 1 skipped, zero network (all fetch stubbed).

---

_Reviewed: 2026-10-19T13:05:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
_Do not commit — orchestrator handles the commit._
