---
phase: 01-platform-spike
plan: 03
subsystem: llm
tags: [startup-validation, health, sse, instrumentation]
requires: [01-02]
provides:
  - "lib/llm/validate-config.ts — validateModelConfig / validateAndCacheModelConfig / getModelValidation (globalThis Symbol.for cache, 60s maxAge)"
  - "instrumentation.ts register() startup validation (NEXT_RUNTIME nodejs gate)"
  - "GET /api/health — 200 ok / 503 degraded naming missing IDs, body whitelist"
  - "POST /api/spike/stream — Token Factory SSE re-encoded as data: frames + [DONE]; 400 at parse boundary"
  - "app/spike/page.tsx client SSE consumer + red degraded banner; simplified landing"
affects: [01-04, phase-3-reasoning-pane]
tech-stack:
  added: []
  patterns: [cache-on-write-no-mutex, exact-match-id-compare, parse-boundary-400, sse-getreader-consumption]
key-files:
  created: [lib/llm/validate-config.ts, instrumentation.ts, app/api/health/route.ts, app/api/spike/stream/route.ts, app/spike/page.tsx, tests/llm/validate-config.offline.test.ts]
  modified: [app/page.tsx (landing rewrite)]
decisions:
  - "models.list() consumed via for-await — works for both the SDK's async-iterable Page and the offline fake's plain array"
  - "Health body whitelist: status/missing/checkedAt/optional error only — never the key, never the catalog"
  - "Complementary-gate split (checker advisory): this plan's source-clean grep covers app/ lib/ tests/ instrumentation.ts; scripts/ covered by plan 01-04's gate"
metrics:
  duration: "~13 min"
  completed: 2026-09-27
status: complete
actuals:
  tokens: 4539
  tasks: 2
  commits: 3
plan_head_before: 318fa54f6395c9cf5b7b5a3e82688dfac7dde0f9
---

# Phase 1 Plan 01-03: Startup Validation + Health + SSE Summary

PLAT-01 startup validation and PLAT-02 streaming are wired end-to-end: startup validates both env-configured IDs against the live catalog without crashing, /api/health reports 200 ok, and SSE flows from Token Factory through the route handler to the browser consumer.

## What was done

- **Task 1:** validate-config.ts (exact-string-match ID compare, cache-on-write on Symbol.for, transport errors -> error shape, missing env -> reject naming the var), instrumentation.ts (nodejs-gated register(), never crashes), health route (force-dynamic, 200/503 + missing[]), 3 offline test cases with injected fake client. Dev server started in background BEFORE the curl verify (explicit step per advisory); instrumentation logged "model routing OK (both configured IDs present in live catalog)" at startup; curl /api/health -> HTTP:200 status ok.
- **Task 2:** SSE route (runtime nodejs, parse-boundary 400 before any paid call, low reasoning_effort, error frames mid-stream, no preferredRegion), spike page ("use client": getReader + \n\n framing + [DONE] stop + incremental render; /api/health poll on mount + 30s interval; fixed red banner naming missing IDs), landing page rewrite. Live curl: data: frames ending in data: [DONE]; empty prompt -> 400.

## Deviations from Plan

1. **[Rule 3 - Blocking] lint error react-hooks/set-state-in-effect** on the deliberate mount-poll (strict new eslint-plugin-react-hooks v7 rule; the setStates resolve post-await). Fixed with a scoped eslint-disable-next-line + justification comment — the mount-poll is plan-mandated behavior.
2. **Advisory applied:** explicit "start dev server, await ready" step before the curl verify; scripts/ dropped from this plan's source-clean grep (plan 01-04 owns it — noted in both summaries); added grep verify asserting the client consumption loop (getReader at line 49, [DONE] handling at line 63, api/health refs == 2).

## Verify results

- Offline validation tests: 3 passed. Typecheck: clean. Lint: clean (after scoped fix). SOURCE-CLEAN (app/ lib/ tests/ instrumentation.ts): clean. Health curl HTTP:200 ok; SSE frames + [DONE]; empty prompt 400.

## Commits

- ab1e344 feat(01-03): startup model validation with health endpoint
- 7c42064 feat(01-03): sse streaming route and spike client page
- 038c209 fix(01-03): scoped lint disable for deliberate mount-poll setState (react-hooks v7 set-state-in-effect)

## Self-Check: PASSED

All files exist; all 3 commit hashes present on build/phase-1.
