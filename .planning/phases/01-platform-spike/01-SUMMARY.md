---
phase: 01-platform-spike
plan: all (01-01, 01-02, 01-03, 01-04 — waves 1-3, executed sequentially by one executor)
subsystem: platform
tags: [nextjs16, token-factory, sse, validated-calls, startup-validation, spike]
requires: []
provides:
  - "Working Next.js 16.3.6 + React 19.3.0 repo-root app with Tailwind v4 and ESLint 9"
  - "lib/llm/*: env-only model routing, single-seam OpenAI client, runValidatedCompletion (json_object -> Zod -> exactly one bounded retry), live startup validation + /api/health, SSE route + client consumer"
  - "npm run catalog -> committed docs/model-catalog.json (25 models, live dump 2026-09-27)"
  - "Completed docs/spike-record.md: json_schema live result, react-pdf install+runtime results, Phase 4 evidence"
  - "UNINSTALL.md package ledger (Phase 1 entry)"
  - "Test suite: 9 tests passing (3 offline retry, 3 offline validation, 1 react-pdf smoke, 2 live fixtures)"
affects: [phase-2-calc-engine, phase-3-reasoning-pane, phase-4-reporting, phase-5-deploy]
tech-stack:
  added: [next@16.3.6, react@19.3.0, react-dom@19.3.0, zod@4.6.5, openai@7.23.0, "@react-pdf/renderer@4.9.0", "typescript@5.9.3", "vitest@5.0.2", "@types/node@24.19.0", "tailwindcss@4.3.3", "@tailwindcss/postcss@4.3.3", "eslint@9.39.5", "eslint-config-next@16.3.6"]
  patterns: [temp-dir-scaffold-additive-merge, single-install-approval-gate, uninstall-ledger, env-only-model-config, single-secrets-seam, bounded-retry-contract, cache-on-write-globalthis, parse-boundary-400, committed-live-artifact]
key-files:
  created: [package.json, package-lock.json, tsconfig.json, next.config.ts, eslint.config.mjs, postcss.config.mjs, app/layout.tsx, app/page.tsx, app/globals.css, app/api/health/route.ts, app/api/spike/stream/route.ts, app/spike/page.tsx, instrumentation.ts, vitest.config.ts, lib/llm/config.ts, lib/llm/client.ts, lib/llm/schemas.ts, lib/llm/complete.ts, lib/llm/validate-config.ts, lib/calc/README.md, tests/llm/hello-fixture.test.ts, tests/llm/validate-config.offline.test.ts, tests/llm/validated-call.retry.test.ts, tests/pdf/react-pdf-smoke.test.ts, scripts/dump-model-catalog.mjs, docs/model-catalog.json, docs/spike-record.md, .env.example, AGENTS.nextjs.md, UNINSTALL.md, .gitignore (merged)]
  modified: []
decisions:
  - "Single executor ran all four plans sequentially in wave order (orchestrator one-subagent policy for wave 3)"
  - "Production stays on documented json_object + Zod + bounded retry; json_schema (live-verified working on both models) is an optional future tightening"
  - "Complementary-gate split (checker advisory): 01-03 source-clean grep covers app/ lib/ tests/ instrumentation.ts; 01-04's covers app/ lib/ scripts/ tests/"
metrics:
  duration: "~43 min (05:45Z-06:28Z)"
  completed: 2026-09-27
status: complete
actuals:
  tokens: 87900
  tasks: 11
  commits: 11
plan_head_before: 69c23c194507df33a16b22ad6197ce1b50b76092
---

# Phase 1: Platform Spike & App Skeleton — Execution Summary

Working Next.js 16.3.6 app at the repo root with env-configured Token Factory routing proven live on both models (validated calls, startup validation + health, SSE streaming end-to-end), the exactly-one-retry contract locked offline, a committed live model catalog, and a completed spike record giving Phase 4 dated evidence.

## Per-plan status

| Plan | Status | Commits | Key verify results |
|------|--------|---------|--------------------|
| 01-01 scaffold + approved install | COMPLETE | 4b708b0, e8ce116, 8af12b5 | npm ls clean at all 14 pins; .gitignore gates pass; AGENTS.md byte-identical |
| 01-02 env contract + tracer | COMPLETE | 3b23b96, 318fa54 | live fixture 2 passed / 0 skipped on BOTH routed models; SOURCE-CLEAN |
| 01-03 validation + health + SSE | COMPLETE | ab1e344, 7c42064, 038c209 | offline 3/3; health HTTP:200 ok live; SSE data: frames + [DONE]; empty prompt 400 |
| 01-04 retry + catalog + spike record | COMPLETE | a2c7890, fd3571f, d38899a | retry 3/3 offline; CATALOG-OK 25 (exit 0); react-pdf smoke %PDF buffer; RECORD-OK/DOCS-CLEAN |

## Real spike results (observed 2026-09-27, never assumed)

- **json_schema response_format:** ACCEPTED live on BOTH routed models (reasoning + extraction env-configured IDs) — schema-conforming JSON returned, no 422. The OpenAPI spec's description ("only json_object/text supported") is stale relative to its own enum. Recorded with exact commands; probe script (env-configured IDs only) retained in gitignored scratch/.
- **@react-pdf/renderer 4.9.0 under React 19.3.0:** install CLEAN (no ERESOLVE, no peer warnings, react deduped through @react-pdf/reconciler); runtime renderToBuffer smoke PASSED (real %PDF buffer). Both halves of Assumption A1 now verified.
- **Startup validation:** instrumentation register() ran at dev-server start and logged "model routing OK (both configured IDs present in live catalog)" against the LIVE /v1/models; /api/health re-validates when stale (verified fresh checkedAt across requests).
- **Full suite at phase end:** 9 passed / 0 skipped / 0 failed; typecheck clean; lint clean.

## UNINSTALL.md ledger

Created per user requirement after the approved install (commit 8af12b5): Phase 1 section records the date, phase, all direct packages (prod: next 16.3.6, react/react-dom 19.3.0, zod 4.6.5, openai 7.23.0, @react-pdf/renderer 4.9.0; dev: typescript 5.9.3, vitest 5.0.2, @types/node 24.19.0, @types/react(-dom) 19.3.0; scaffold-injected: tailwindcss 4.3.3, @tailwindcss/postcss, eslint 9.39.5, eslint-config-next 16.3.6), the 559M node_modules footprint at install time, and the exact reverse commands. Future phases append `## Phase N` sections.

## Deviations from Plan (all Rules 1-3, none architectural)

1. **[Rule 3] vitest does not load .env.local** (01-02): added a ~10-line zero-dep .env.local loader in vitest.config.ts (ambient env wins) so the plan's exact verify command works.
2. **[Rule 3] Next 16 scaffold typegen** (01-02): scaffold layout uses typegen'd `LayoutProps`; ran `npx next typegen` (dev setup, no code change) instead of modifying scaffold code.
3. **[Rule 3] next-env.d.ts is gitignored by the Next 16 scaffold's own .gitignore** (01-01): merged as-is (auto-generated file convention); exists on disk, not tracked — files_modified intent adjusted.
4. **[Rule 3] react-hooks/set-state-in-effect lint error** (01-03): scoped eslint-disable with justification on the deliberate mount-poll (setStates resolve post-await; plan-mandated behavior).
5. **[Rule 3] A5 wrong — SDK models.list() Page is async-iterable but NOT sync-spreadable** (01-04): adapted dump script to `[...page.data]` with a shape note (plan pre-authorized minimal adaptation).
6. **[Rule 1] win32/Node 24.14 libuv teardown assertion** (01-04): `npm run catalog` exited 127 after successful work (undici keep-alive socket racing teardown); fixed with a 500ms socket settle before process.exit; true exit now 0.
7. **Checker advisories applied:** 01-04-PLAN.md files_modified += lib/llm/complete.ts (conditional, unused); 01-03 explicit dev-server-ready step + consumption-loop grep verify (getReader/[DONE]); scripts/ dropped from 01-03's grep (gate split noted in both summaries); 01-RESEARCH.md Open Questions marked RESOLVED (Q1 answered by 01-04 Task 3).
8. **UNINSTALL.md** added per orchestrator builder constraint 6 (new requirement beyond plan file lists).

## Notes

- NEBIUS_API_KEY was written to .env.local from the ambient environment programmatically; the key value was never printed, echoed, logged, or committed (verified by boolean/shape checks only; .env.local provably gitignored).
- Security posture held: no NEXT_PUBLIC_ on the key; single key seam in lib/llm/client.ts; health body whitelist; source-clean grep clean across app/ lib/ scripts/ tests/ instrumentation.ts; DOCS-CLEAN grep proves no key assignment in committed docs.
- No stubs or known gaps: all planned artifacts are implemented and verified; no deferred issues; lib/criteria/ untouched.
- `next dev` did NOT append a managed block to the workspace AGENTS.md (A3 behavior not triggered; AGENTS.md diff-empty throughout).

## Self-Check: PASSED

- All 30+ created/modified files exist on disk (verified per-plan).
- All 11 commit hashes present in `git log` on build/phase-1 (4b708b0, e8ce116, 8af12b5, 3b23b96, 318fa54, ab1e344, 7c42064, 038c209, a2c7890, fd3571f, d38899a).
- Commits measured from ledger: `git rev-list --count 69c23c1..HEAD` = 11. Nothing merged to master; branch is build/phase-1 throughout.
