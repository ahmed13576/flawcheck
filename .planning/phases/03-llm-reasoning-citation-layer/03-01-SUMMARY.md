---
phase: 03-llm-reasoning-citation-layer
plan: 01
subsystem: llm-reasoning-layer
tags: [tracer, fallback-first, sse-protocol, citation-allowlist, reasoning-pane, 11-column-table]
requires: [03-00b (restyled Screen 3 + sticky cluster), 02 engine (ReadingResult/citations emission)]
provides:
  - lib/reasoning module spine (tokenizer segment model + safeTailHold, deterministic fallback narratives, Zod v4 strict schemas + NarrativeFrame protocol + parseNarrativeFrame)
  - POST /api/reasoning/narrative with the full typed-frame SSE protocol (fallback-frame narration this plan; 03-02 inserts the upstream stream at the marked branch)
  - CitationChip (record-field labels, inline toggleable detail) + ReasoningPane (deterministic chain in 5 states, renderer-enforced allowlist, audit stamps)
  - 11-column results table: Reasoning column, sticky CML/Verdict/Reasoning cluster, per-row toggles, colSpan-11 panes, one-shot narrative fetch glue
  - NarrativeEntryState — the 03-03 store contract
affects: [03-02 (upstream stream + lints + extraction), 03-03 (streaming hook/cache), 03-04 (PT/MT panes), 03-05 (sweep)]
tech-stack:
  added: []
  patterns: [SSE typed-frame protocol, renderer-enforced allowlist (zero-glyph + audit stamp), discriminated-union strict schemas, synchronous SSR-safe audit derivation]
key-files:
  created:
    - lib/reasoning/tokenizer.ts
    - lib/reasoning/fallback.ts
    - lib/reasoning/schemas.ts
    - app/api/reasoning/narrative/route.ts
    - components/wizard/citation-chip.tsx
    - components/wizard/reasoning-pane.tsx
    - tests/reasoning/tokenizer.test.ts
    - tests/reasoning/fallback.test.ts
    - tests/reasoning/narrative-route.test.ts
    - tests/wizard/reasoning-pane.test.ts
  modified:
    - components/wizard/results-table.tsx (11-column contract + glue)
    - components/wizard/screen-results.tsx (Rule 3: passes metadata/evaluatedAt to the table)
    - tests/wizard/flowstep-restyle.test.ts (renderResults harness metadata prop)
decisions:
  - "Fallback cites ONLY engine-emitted ids: the cite() helper returns '' unless the id ∈ reading.citations — the renderer allowlist is the second gate behind it"
  - "The cml request variant's history block is defined once in schemas.ts; 03-02's route and 03-03's builder consume it, never re-declare it (checker round 1 schemas race)"
  - "Audit stamps derive SYNCHRONOUSLY from the text (unresolvedCitationIds pure export) — SSR-safe; onUnresolvedCitation notification is a client effect mirroring the rendered stamps"
  - "Verdict labels for the fallback map through VERDICT_LABELS, pinned byte-identical to VerdictChip via verdictLabel() in tests — one source for the ACCEPT/RE-CHECK/FAIL strings"
  - "Chip labels never synthesize § — {code} {clause} verbatim per the Citation Chip Contract (03-00b's report document keeps its own §-joined ref, a different surface)"
metrics:
  duration: ~55 min
  completed: 2026-09-28
status: complete
plan_head_before: 617a1d0ae8abd3d88aedfbd24dcd14f36356ab37
commits: 2
actuals:
  tokens: 63000
  tasks: 2
  commits: 2
---

# Phase 3 Plan 01: Tracer — Fallback-First Cited Reasoning Slice Summary

**One-liner:** the reasoning architecture proven end-to-end with the LLM disabled — strict-schema SSE route speaking the full typed-frame protocol with deterministic cited fallback narration, an allowlist-enforced chip renderer with zero-glyph audit stamps, and the 11-column sticky results table with per-row reasoning panes.

## What Was Built

- **Task 1 (tracer):** `lib/reasoning/` spine — tokenizer (single `[[cite:id]]` grammar, resolved/incomplete segments, safeTailHold chunk-boundary helper), fallback narratives (conditional assembly per Pattern R4: structural branch on engine citation membership, rates only when non-null, G14 immediate-inspection wording without dates, gauge band in verdicts.ts locked order, locked closing sentence with chip-identical labels; numbers only through formatFixed), schemas (Zod v4 `.strict()` discriminated requests with the HERE-defined history block, final-shape ExtractionResultSchema, the complete meta/delta/usage/rejected/fallback/error frame union, parseNarrativeFrame), and the narrative route (Node runtime, 400 on malformed/strict-invalid bodies naming the first Zod issue, isLlmDisabled() kill-switch/key gate exported for 03-02, closed-guard SSE emitting exactly one fallback frame + [DONE] — nothing fabricated).
- **Tracer feedback gate:** Task 1's automated verify re-run end-to-end (25 reasoning pins + typecheck) green before any expansion — foundation proven on the safest path.
- **Task 2:** CitationChip (labels solely from citations.json record fields; orange-primary remap of the Phase-2 blue accent — hue only, flagged to the UI auditor), ReasoningPane (chain visible in all five states; UI-46/47/48 class + copy pins; renderer-enforced zero-glyph rule with amber audit stamps; `— · — · —` fallback metrics; cost always `—`), and the 11-column table (locked first-ten order untouched; sticky cluster extended: CML left-0 / Verdict right-[9.5rem] / Reasoning right-0 on opaque token backgrounds; per-row toggles with rotating chevron + aria wiring; colSpan-11 detail rows; one-shot fetch glue with narrativeRequestBody exported and schema-validated by test).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] screen-results.tsx passes metadata/evaluatedAt to the table**
- **Found during:** Task 2
- **Issue:** the plan's tracer glue lives in results-table.tsx but needs the session's metadata slice + evaluatedAt for the request body; screen-results.tsx (the caller) was not in files_modified, so the glue could never fire in the demo path.
- **Fix:** added a `metadata` prop to ScreenResultsContentProps (passed from `state.metadata` in ScreenResults) and forwarded `metadata` + `evaluatedAt` to ResultsTable. Presentational contract otherwise unchanged.
- **Files modified:** components/wizard/screen-results.tsx
- **Commit:** 3626c83

**2. [Rule 1 - Bug] Audit stamps were effect-driven and invisible in SSR**
- **Found during:** Task 2 (own test failure — renderToStaticMarkup does not run effects)
- **Issue:** unresolved-id collection lived in NarrativeText's useEffect, so the audit stamp (a UI-35 must-have) rendered nothing during SSR and was fragile under hydration.
- **Fix:** extracted the pure `unresolvedCitationIds(text)` (includes truncated tokens as "(truncated token)"); the pane derives stamps synchronously and notifies onUnresolvedCitation from a mirrored effect.
- **Files modified:** components/wizard/reasoning-pane.tsx
- **Commit:** 3626c83

**3. [Rule 3 - Blocking] Glue body omits the schema-required history key**
- **Found during:** Task 2
- **Issue:** the plan's literal glue body `{ kind, evaluatedAt, reading, metadata, extraction: null }` lacks `history`, which the schema (correctly, per the plan's own must-haves) requires as nullable — strict parse would 400 on the plan's own glue call.
- **Fix:** `narrativeRequestBody` sends `history: null`; a route test pins that omitting the key is a 400, and a pane test pins the glue body schema-valid.
- **Commit:** 3626c83

### UI-auditor flags (per plan instruction)
- CitationChip accent: Phase-2 blue-600 chip remapped to the Flowstep orange primary (hue change only; data contract untouched).
- Sticky cluster extension: Verdict now pins at right-[9.5rem] (the Reasoning column's fixed width) so both right columns stay visible during horizontal scroll — 03-01's extension of 03-00b's C1/C3 cluster.

## Auth Gates

None (hermetic — the route's isLlmDisabled() gate is exported but this plan never calls upstream).

## Known Stubs

- The route serves ONLY the fallback frame this plan (by design — fallback-first); meta/usage frames and the upstream Super-120B stream land in 03-02 at the marked branch. Not a stub: the plan's own done-criterion.
- The table's narrative glue is one-shot (no cache/abort/incremental) — Plan 03-03's truths, per plan instruction.

## Self-Check: PASSED

- 828a4d4, 3626c83 present on build/phase-3
- Created files exist (10 files across lib/route/components/tests)
- Full hermetic suite 359 passed / 4 skipped (314 → +45); typecheck + build green
- `git diff lib/calc lib/criteria lib/wizard/reducer.ts` empty; zero lib/llm imports from lib/reasoning (grep-verified)
