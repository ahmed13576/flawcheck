# 03-03 Plan Summary — Narrative Store + Store-Backed Results Table

**Completed:** 2026-09-28 (inline orchestrator execution)

## Task 1 — `hooks/use-narrative-stream.ts` (framework-free, node-tested)
- `createNarrativeStore()`: cache keyed `${evaluatedAt}::${kind}::${id}` (re-evaluation → fresh evaluatedAt → stale entries unreachable, UI-45); one AbortController per key; FIFO cap 3 concurrent fetches (A3); frame-driven transitions matching `NarrativeEntryState` exactly (loading/streaming/complete/error/fallback); `open` no-ops on complete/streaming/loading (UI-31); `retry` aborts + resets; `allowNarration=false` → error entry `EXTRACTION_SKIPPED_REASON` + ZERO fetches (UI-41); `totals()` sums complete entries only; `fallbackServed()`; `unresolvedCitations()` registry for 03-04's audit footnote.
- `consumeNarrativeStream`: TextDecoder + `data:` frame buffering + `safeTailHold` (a partial `[[cite:` token is never released to onDelta — pinned with a split-token test); non-200 → JSON error body's message; terminal frames (usage/rejected/fallback/error) stop dispatch.
- `useNarrativeStream(store)`: `useSyncExternalStore` WITH the `getServerSnapshot` third arg (SSR markup tests + RSC render — its absence broke 11 flowstep-restyle/pane tests under renderToStaticMarkup).

## Task 2 — Results table rewired
- One-shot tracer fetch removed; module-level store consumed via `useNarrativeStream`; first open fetches, re-opens hit cache (zero fetches); `Retry narrative` button in the error detail row → `store.retry`.
- reasoning-pane untouched (already 03-01-correct); Flowstep restyle + sticky cluster preserved.
- `tests/wizard/reasoning-stream-ui.test.tsx`: five state-markup contracts via renderToStaticMarkup (exact copy strings, aria-busy, motion-reduce caret, `tokens 1,842 · 3.2 s · —` em-dash badge).

## Notes
- vitest.config.ts include extended to `tests/**/*.test.tsx` (additive; JSX tests otherwise unreachable).
- Fetch-count assertions must count per-stub: `vi.stubGlobal` REPLACES the counter (retry test asserts 1 call on the retry stub, not 2 across stubs).

## Gates
- Hermetic: **422 passed / 5 skipped** (was 280 after Phase 2; Phase 3 added 142). Typecheck + `npm run build` green.
