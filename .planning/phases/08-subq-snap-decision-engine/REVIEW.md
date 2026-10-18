---
phase: 08-subq-snap-decision-engine
reviewed: 2026-10-15T10:16:15Z
depth: deep
files_reviewed: 10
files_reviewed_list:
  - docs/system1-benchmark-report.json
  - lib/decision/benchmark/metrics.ts
  - lib/decision/benchmark/runner.ts
  - lib/decision/benchmark/scenarios.ts
  - lib/decision/benchmark/types.ts
  - lib/decision/providers/subq-snap.ts
  - tests/decision/benchmark.test.ts
  - tests/decision/multimodal.test.ts
  - tests/decision/subq-provider.test.ts
  - tests/decision/subq-spikes.test.ts
findings:
  critical: 3
  warning: 3
  info: 0
  total: 6
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-10-15T10:16:15Z  
**Depth:** deep  
**Files Reviewed:** 10  
**Status:** issues_found

## Summary

Adversarial review of the Phase 08 provider, benchmark implementation, report, and associated tests found three blockers and three warnings. Choice confidence is trusted without bounds validation, the configurable endpoint can receive the bearer key over HTTP or at an unrelated host, and the comparison runner can report a measured result when every request failed. The committed benchmark report itself is appropriately marked pending and makes no live-measurement or pricing claims. I found no current app/client import path for the provider, so this review does not establish an existing browser credential leak; the provider remains exported through the shared decision index without a server-only guard.

## Critical Issues

### CR-01: Unvalidated choice confidence can bypass fail-closed review

**Severity:** BLOCKER  
**File:** `lib/decision/providers/subq-snap.ts:227-231`  
**Issue:** Choice answers are accepted when `confidence` is any JavaScript number, including values below 0, above 1, or `NaN`, and the probabilities map is accepted without checking its entries. The exported `choice()` method then passes this confidence to domain callers. For example, `classifyFluidService` only requests review when confidence is below 0.85, so an upstream value such as 1.2 skips the fail-closed review. The `noul` parser already enforces the [0, 1] range, but the choice parser does not.
**Fix:** Validate that `confidence` and every probability are finite and in [0, 1], that the probability keys match the requested choice criteria, and that the selected choice is one of those criteria before returning a result. Reject malformed answers with `DecisionProviderError`.

### CR-02: Configurable endpoint can disclose the bearer key

**Severity:** BLOCKER  
**File:** `lib/decision/providers/subq-snap.ts:60-61`  
**Issue:** `options.baseURL` and `SUBQ_BASE_URL` are accepted without checking the scheme or host, then the client sends `Authorization: Bearer ${this.apiKey}` on every request (line 131). A mistaken or compromised configuration can direct the SubQ secret to an unrelated server or send it over cleartext HTTP.
**Fix:** Require HTTPS and restrict the production endpoint to the verified SubQ origin. If a test endpoint override is required, make it an explicit test-only transport/path that cannot be selected by production environment configuration.

### CR-03: Failed provider runs can be reported as measured benchmark results

**Severity:** BLOCKER  
**File:** `lib/decision/benchmark/runner.ts:49-50, 88-100`  
**Issue:** Provider exceptions are swallowed into `failureCount`, but report status is set to `measured` solely because a Nebius metrics object was supplied. If both providers fail every run, latency distributions contain zeros for both and the report can claim a latency tie; if only SubQ fails, its zero p95 can be declared the winner. The report therefore presents invalid measurements as comparative results.
**Fix:** Mark a comparison measured only when both providers have successful observations for the required scenarios. Otherwise keep it pending/failed, set affected verdicts to null, and include failure counts and actionable failure diagnostics in the report.

## Warnings

### WR-01: Image validation accepts malformed padding and mismatched data URI types

**Severity:** WARNING  
**File:** `lib/decision/providers/subq-snap.ts:207-214`  
**Issue:** The base64 check accepts invalid padding such as `A=` because it only rejects lengths congruent to 1 and does not require padding to align to a four-character block. It also strips any supported data URI prefix without checking that its embedded MIME type matches `image.mediaType`. Invalid bytes can consequently pass local validation or valid PNG data can be sent labeled as JPEG.
**Fix:** Validate base64 padding and length according to the accepted encoding, and when a data URI prefix is present require its media type to equal the declared `mediaType` before stripping it.

### WR-02: `scenarioCount` counts repeated runs rather than scenarios

**Severity:** WARNING  
**File:** `lib/decision/benchmark/runner.ts:55-59, 96`  
**Issue:** `totalRuns` is `scenarios.length * iterations`, and `generateComparisonReport` writes that value to `scenarioCount`. With multiple iterations, the report overstates the number of distinct scenarios and conflates fixture coverage with sample count.
**Fix:** Pass the unique scenario count into report generation and expose iteration/run count separately.

### WR-03: Multimodal tests label non-image bytes as images

**Severity:** WARNING  
**File:** `tests/decision/multimodal.test.ts:8-15, 28-32, 70`  
**Issue:** The test payload `aGVsbG8=` decodes to the text `hello`, yet the tests send it as PNG, JPEG, and WebP. These tests verify field serialization and limits, but do not exercise a valid image payload and may not reflect what the API accepts.
**Fix:** Use a small valid encoded image fixture for each MIME type being tested, while retaining separate malformed-payload tests.

## Info

---

_Reviewed: 2026-10-15T10:16:15Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: deep_
