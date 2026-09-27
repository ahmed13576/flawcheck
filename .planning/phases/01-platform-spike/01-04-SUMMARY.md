---
phase: 01-platform-spike
plan: 04
subsystem: llm
tags: [retry-contract, model-catalog, spike-record, react-pdf]
requires: [01-02]
provides:
  - "tests/llm/validated-call.retry.test.ts — offline exactly-one-retry contract lock (3 cases)"
  - "npm run catalog -> committed docs/model-catalog.json (live /v1/models dump, 25 models, sorted, headered)"
  - "tests/pdf/react-pdf-smoke.test.ts — renderToBuffer proof under React 19.3.0"
  - "docs/spike-record.md completed — json_schema result per model, react-pdf runtime result, corrections applied, Phase 4 input"
affects: [phase-2-calc, phase-4-reporting]
tech-stack:
  added: []
  patterns: [offline-fake-client-contract-test, committed-live-artifact, evidence-only-spike-record]
key-files:
  created: [tests/llm/validated-call.retry.test.ts, scripts/dump-model-catalog.mjs, docs/model-catalog.json, tests/pdf/react-pdf-smoke.test.ts, scratch/json-schema-probe.mjs (gitignored)]
  modified: [package.json (catalog script), docs/spike-record.md (completed), .planning/phases/01-platform-spike/01-04-PLAN.md (files_modified advisory), .planning/phases/01-platform-spike/01-RESEARCH.md (Open Questions advisory)]
decisions:
  - "models.list() payload consumed via .data (SDK Page is async-iterable but NOT sync-spreadable — A5 shape corrected)"
  - "win32/Node 24.14: 500ms socket settle before process.exit avoids a libuv teardown assertion that made exit codes nonzero after successful runs"
  - "json_schema probe: production stays on documented json_object + Zod + bounded retry; json_schema available as optional tightening (undocumented behavior)"
metrics:
  duration: "~12 min"
  completed: 2026-09-27
status: complete
actuals:
  tokens: 4056
  tasks: 3
  commits: 3
plan_head_before: 038c209829d5414f6c30600797c0115619547105
---

# Phase 1 Plan 01-04: Retry Contract + Catalog + Spike Record Summary

The exactly-one-retry contract is locked offline, the live model catalog is a committed regenerable artifact, and the spike record carries dated, re-runnable evidence for Phase 4.

## What was done

- **Task 1 (tdd):** wrote tests/llm/validated-call.retry.test.ts FIRST, ran as a contract audit — passed on first run, so complete.ts was NOT modified (conditional write unused; advisory frontmatter update applied). 3 cases: bad->good = exactly 2 calls + correction message; always-bad = exactly 2 calls (never 3) + rejection naming model AND Zod issue text (computed independently by parsing the bad payload with the same schema); immediate success = exactly 1 call. Fully offline.
- **Task 2:** scripts/dump-model-catalog.mjs + `catalog` npm script (node --env-file, no dotenv); live run wrote docs/model-catalog.json (25 models, CATALOG-OK, TRUE-EXIT=0 after the win32 fix). Source-clean grep gate incl. scripts/ passed; .env.local provably ignored.
- **Task 3:** scratch/json-schema-probe.mjs (env-configured IDs only) — LIVE RESULT: json_schema ACCEPTED on BOTH routed models (returns schema-conforming JSON; no 422). tests/pdf/react-pdf-smoke.test.ts PASSED (%PDF buffer >100 bytes under React 19.3.0). Spike record completed with per-model outcomes, exact commands, corrections applied (C1/C6), and the evidence-only Phase 4 input section.

## Deviations from Plan

1. **[Rule 3 - Blocking] A5 wrong: SDK Page not sync-spreadable** — `[...list]` threw "list is not iterable"; adapted to `[...page.data]` with a shape note in the script (plan pre-authorized minimal adaptation).
2. **[Rule 1 - Bug] win32 libuv teardown assertion (win/async.c) made `npm run catalog` exit 127 after successful work** — root cause: undici keep-alive socket racing process teardown on Node 24.14/win32. Fixed in-script with a 500ms settle before process.exit; true exit now 0.
3. **Checker advisories applied:** 01-04-PLAN.md files_modified += lib/llm/complete.ts (conditional); 01-RESEARCH.md Open Questions marked RESOLVED with Q1 annotated "answered by 01-04 Task 3".

## Verify results

- Retry test: 3 passed (grep "create" count = 5). Catalog: npm run catalog exit 0 + confirmation line; CATALOG-OK 25; git-tracked. Source-clean incl. scripts/: clean. Smoke: 1 passed. RECORD-OK / DOCS-CLEAN / SCRATCH-IGNORED all printed.

## Commits

- a2c7890 test(01-04): lock exactly-one-retry contract offline
- fd3571f feat(01-04): committed live model catalog dump
- d38899a docs(01-04): spike record with json_schema and react-pdf results

## Self-Check: PASSED

All files exist; all 3 commit hashes present on build/phase-1.
