# Phase 1 Spike Record

**Date:** 2026-09-27
**Phase:** 1 — Platform Spike & App Skeleton
**Purpose:** Captures the recorded evidence Phase 4 (reporting/PDF) and Phase 2+ (LLM layer) build on. Every result below is the actual observed outcome of a re-runnable command — never an assumption.

## react-pdf install result

**Date:** 2026-09-27
**Command:** `npm install next@16.3.6 react@19.3.0 react-dom@19.3.0 zod@4.6.5 openai@7.23.0 @react-pdf/renderer@4.9.0`

**Outcome: clean install — no ERESOLVE conflict, no peer-dependency warnings emitted.**

- Resolved versions (from `npm ls --depth=0`):
  - `@react-pdf/renderer@4.9.0`
  - `react@19.3.0` / `react-dom@19.3.0` (deduped through the whole tree, including `@react-pdf/reconciler@2.0.0`)
- `@react-pdf/renderer` 4.9.0's registry `peerDependencies` declare `react: "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"` — React 19.3.0 satisfies `^19.0.0`, so npm resolved the pair without intervention (`--legacy-peer-deps` / `--force` were NOT used).
- Install summary: `added 418 packages ... found 0 vulnerabilities`; the dev-dep follow-up (`npm install -D typescript@^5.9.3 vitest@5.0.2 @types/node@^24.19.0 @types/react@^19.3.0 @types/react-dom@^19.3.0`) added 26 more, `found 0 vulnerabilities`.
- Re-check: `npm ls @react-pdf/renderer react` shows `@react-pdf/renderer@4.9.0` with `react@19.3.0 deduped` — no peer mismatch lines.

The runtime render half (renderToBuffer smoke) is a separate probe — see below.

## json_schema structured output result

(filled by plan 01-04 Task 3 — live probe of `response_format: { type: "json_schema" }` against both routed models)

## react-pdf runtime render result

(filled by plan 01-04 Task 3 — renderToBuffer smoke test under React 19.3.0)
