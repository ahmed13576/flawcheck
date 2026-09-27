---
phase: 01-platform-spike
plan: 02
subsystem: llm
tags: [env-contract, token-factory, validated-calls, tracer]
requires: [01-01]
provides:
  - "lib/llm/{config,client,schemas,complete}.ts — env-only model routing + runValidatedCompletion (json_object -> Zod -> exactly one bounded retry, injectable client)"
  - ".env.example committed env contract with research-verified model IDs"
  - "vitest.config.ts with @ alias and .env.local loader"
  - "live hello-fixture proof on both routed models (2 passed, 0 skipped)"
affects: [01-03, 01-04]
tech-stack:
  added: []
  patterns: [env-only-model-config, single-secrets-seam, bounded-retry-contract, skipIf-live-tests]
key-files:
  created: [.env.example, .env.local (gitignored), lib/llm/config.ts, lib/llm/client.ts, lib/llm/schemas.ts, lib/llm/complete.ts, vitest.config.ts, tests/llm/hello-fixture.test.ts]
  modified: []
decisions:
  - "Model IDs env-only; accessors throw naming the missing var; no model-ID literals in source (SOURCE-CLEAN grep verified)"
  - "API key touched only inside lib/llm/client.ts via config accessors"
  - "reasoning_effort typed as the 3-value union low|medium|high ONLY (Correction C1)"
metrics:
  duration: "~11 min"
  completed: 2026-09-27
status: complete
actuals:
  tokens: 1614
  tasks: 3
  commits: 2
plan_head_before: e8ce11681f2458e528549452d1870d9b36526bfc
---

# Phase 1 Plan 01-02: Env Contract + Validated-Call Tracer Summary

The env-only routing contract is committed and the validated-call pattern (json_object -> Zod -> exactly one bounded retry) is proven LIVE against both routed Token Factory models.

## What was done

- **Task 1:** .env.example committed with exactly the 4 documented variables, model IDs copied verbatim from RESEARCH.md (byte-identical), re-verification pointer comment. .env.local created as a copy (gitignored, verified).
- **Task 2 (human-action checkpoint):** satisfied per builder constraint 5 — the REAL key from the ambient environment was written into .env.local programmatically; the value was never printed/echoed/logged; KEY-SET check passed with only shape checks (length=235, non-placeholder).
- **Task 3 (tracer):** lib/llm/config.ts (requiredEnv throws naming the var), client.ts (getClient() single key seam), schemas.ts (HelloSchema), complete.ts (runValidatedCompletion per Pattern 2: injectable client, 2-attempt loop, correction message on attempt 2, final error `Validated call failed after 1 retry (model=<id>): <last error>`), vitest.config.ts, hello-fixture.test.ts.

## Tracer feedback gate

End-of-phase mode + automated-only verify: re-ran typecheck + fixture end-to-end — green. `⚡ Tracer verified end-to-end — expanding.`

## Deviations from Plan

1. **[Rule 3 - Blocking] vitest does not load .env.local** — the ambient env had the key but not the model-ID vars, so the plan's exact verify command failed on `getExtractionModel`. Fixed with a ~10-line .env.local loader in vitest.config.ts (zero deps; ambient env wins). Documented in the commit.
2. **Transient first fixture run:** one live call failed transiently on the first post-config run; the re-run (the tracer gate's verify) passed 2/2 cleanly. All subsequent runs green.

## Verify results

- npm run typecheck: clean (after `npx next typegen` generated the scaffold's LayoutProps types — one-time dev setup, not a code change)
- npx vitest run tests/llm/hello-fixture.test.ts: **2 passed, 0 skipped** (both routed models live)
- SOURCE-CLEAN grep: no vendor model-ID literals in app/ lib/ tests/ vitest.config.ts

## Commits

- 3b23b96 feat(01-02): committed env contract for token factory routing
- 318fa54 feat(01-02): validated-call tracer proven live on both routed models

## Self-Check: PASSED

All files exist; both commit hashes present on build/phase-1; .env.local provably ignored.
