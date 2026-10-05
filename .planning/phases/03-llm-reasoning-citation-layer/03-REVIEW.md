---
phase: 03-llm-reasoning-citation-layer
reviewed: 2026-10-03T19:17:50Z
depth: deep
files_reviewed: 32
files_reviewed_list:
  - lib/reasoning/tokenizer.ts
  - lib/reasoning/lints.ts
  - lib/reasoning/schemas.ts
  - lib/reasoning/narrative-context.ts
  - lib/reasoning/prompts.ts
  - lib/reasoning/fallback.ts
  - app/api/reasoning/extract/route.ts
  - app/api/reasoning/narrative/route.ts
  - lib/llm/complete.ts
  - lib/llm/client.ts
  - lib/llm/config.ts
  - hooks/use-narrative-stream.ts
  - components/wizard/reasoning-context.tsx
  - components/wizard/reasoning-pane.tsx
  - components/wizard/citation-chip.tsx
  - components/wizard/pipeline-status-bar.tsx
  - components/wizard/results-table.tsx
  - components/wizard/screen-results.tsx
  - components/wizard/ptmt-triage-list.tsx
  - components/wizard/verdict-chip.tsx
  - components/report/report-document.tsx
  - lib/report/session-snapshot.ts
  - app/report/page.tsx
  - app/page.tsx
  - lib/wizard/format.ts
  - lib/calc/verdicts.ts
  - lib/calc/criteria.ts
  - lib/calc/evaluate.ts
  - lib/ingest/session.ts
  - lib/ingest/group.ts
  - lib/wizard/reducer.ts
  - vitest.config.ts
findings:
  critical: 3
  warning: 10
  info: 9
  total: 22
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-03T19:17:50Z
**Depth:** deep
**Files Reviewed:** 32
**Status:** issues_found

## Summary

Deep adversarial review of the Phase 3 LLM reasoning & citation layer: `lib/reasoning/*`, both `/api/reasoning/*` routes, `lib/llm/complete.ts`, the narrative store/hook, the Screen 3 reasoning UI, the PT/MT panes, the status bar, and the `/report` preview path.

The core citation-integrity machinery is genuinely strong: the renderer resolves chips only from `citations.json` records, the fallback cites only engine-emitted ids, the four server lints (numeric-consistency with the mandatory designator strip, verdict-agreement, wrong-context citation allowlist, 8-word verbatim n-gram) plus the byte-exact sentence-relay cutoff work as specified and are well pinned by tests. The hermetic suite is honest (433 passed / 5 skipped, zero network, live tests `skipIf`-gated behind `FLAWCHECK_LIVE_LLM=1`), and the security grep gates are clean (zero `nvidia/` literals, no `dangerouslySetInnerHTML`, no `eval`, key only via the `lib/llm` seam, `.strict()` Zod on both route bodies before any paid call).

However, the **UI-to-route integration of the enabled path is broken**: the results table sends `extraction: null` on every CML narrative request, which the route (correctly, and by its own pinned test) answers with 422 — so with an API key configured, every CML reasoning pane fails and only disabled-mode fallback works end-to-end through the UI. Second, the provider's fire-once extraction effect deadlocks under React StrictMode (Next 16.3.6 App Router defaults it on), pinning extraction at "running" in every dev run. Third, the reasoning layer mixes declared metadata units with canonical mm — the fallback narrative and the reasoning chain add an inch/mils-denominated gauge uncertainty to mm thickness values on a safety artifact. Ten further warnings cover the split narrative store (status bar cannot see CML narratives, FIFO cap doubled, allowNarration gate bypassed), the missing extraction timeout/abort on the paid extraction call, unrecoverable PT/MT error states with a dead Retry button, terminal-less stream EOF marked "complete", malformed cite tokens rendering as raw machinery text, and report-document issues. Nine info findings cover dead code (`historyFor` seam, store `unresolvedCitations()` registry, `meta` frame) and contract gaps (verdict-line position unenforced, PT/MT prompts lacking the evaluation context pack).

Every finding below was verified against source; suspicious behaviors (malformed cite tokens, comma-thousands splits, verdict-line position, `safeTailHold`, `sentenceRelayCutoff`) were reproduced with a temporary vitest probe that was deleted after the review.

## Critical Issues

### CR-01: CML narration is dead on the enabled path — the UI always sends `extraction: null` and the route 422s

**File:** `components/wizard/results-table.tsx:76-89, 224-233`; `app/api/reasoning/narrative/route.ts:73-78`
**Issue:** `narrativeRequestBody()` hardcodes `extraction: null` (and `history: null`), with a comment claiming "03-04's provider wires the real pack" — but nothing does: `ResultsTable` never calls `useReasoning()`, and no code path passes the provider's extraction pack into the request. The route's Pitfall-5 guard (`route.ts:73-78`) answers every enabled `kind:"cml"` request carrying `extraction: null` with **422** — behavior that `tests/reasoning/narrative-route-stream.test.ts:210-212` pins for exactly this body. Consequence: with `NEBIUS_API_KEY` configured (the primary product path), every "View reasoning" click on a CML row produces the pane error "narration requires a non-null extraction pack…", and Retry repeats it. The live-pipeline test passed because it POSTs a hand-built extraction pack directly to the route, bypassing the UI glue — the integration gap was never exercised. Only `FLAWCHECK_DISABLE_LLM=1` mode works through the UI (the disabled branch ignores extraction).
**Fix:** consume the provider in the table and send the real pack:

```tsx
// results-table.tsx
const { store, extraction, allowNarration, historyFor } = useReasoning();
// open only when the pack exists; carry it (and history) in the body:
narrativeStore.open(key, {
  ...narrativeRequestBody(reading, metadata, evaluatedAt),
  extraction: extraction.state === "complete" ? extractionPack : null,
  history: historyFor(absoluteIndex),
}, { allowNarration });
```

…and gate `toggleReasoning` on `allowNarration` instead of hardcoding `true`.

### CR-02: ReasoningProvider extraction deadlocks under React StrictMode (every dev run)

**File:** `components/wizard/reasoning-context.tsx:84, 106-157`
**Issue:** the effect dedupes with `firedForRef.current.has(evaluatedAt)` while its cleanup sets `cancelled = true`. React 18/19 StrictMode double-invokes effects on mount (setup → cleanup → setup) **with refs preserved**. Sequence in dev: setup #1 fires the fetch and marks the ref; cleanup #1 sets `cancelled = true`; setup #2 early-returns on the ref guard; fetch #1's `.then` sees `cancelled` and discards the response. `extraction` stays `{ state: "running" }` forever, so `allowNarration` is permanently false, every pane shows `EXTRACTION_SKIPPED_REASON`, and the status bar spins "running…". Verified Next.js 16.3.6 (installed) defaults `reactStrictMode` to **true** for the App Router when unset (`node_modules/next/dist/build/define-env.js:150-151`) and `next.config.ts` sets nothing. Production builds are unaffected, but the dev/demo flow — the phase's own verification path — is fully broken. SSR markup tests cannot catch this (effects don't run), and the live record was produced by direct route calls, not the provider.
**Fix:** make the effect re-fire-safe — either reset the guard in cleanup, or drop the `cancelled` guard and dedupe with an in-flight abort controller:

```tsx
useEffect(() => {
  if (!evaluatedAt || firedForRef.current.has(evaluatedAt)) return;
  const controller = new AbortController();
  firedForRef.current.add(evaluatedAt);
  fetch("/api/reasoning/extract", { signal: controller.signal }) // ...
  return () => controller.abort(); // aborted fetch → catch path, ref cleared below
}, [evaluatedAt]);
```

or simply remove `firedForRef` and let the keyed remount (`key={evaluatedAt}` in screen-results.tsx:185) provide the once-per-evaluation guarantee.

### CR-03: Mixed-unit arithmetic in the fallback narrative and reasoning chain (declared-unit gauge uncertainty treated as mm)

**File:** `lib/reasoning/fallback.ts:108-116`; `components/wizard/reasoning-pane.tsx:58, 271-273`; `lib/reasoning/narrative-context.ts:131`
**Issue:** `ComponentMetadata` carries values in the **declared** metadata unit (`lib/wizard/reducer.ts:374-392`; the engine converts at eval entry — `lib/calc/evaluate.ts:101-111`), and the unit lives in `state.units.metadata`, which is **not** part of the narrative request (`MetadataSliceSchema`, `lib/reasoning/schemas.ts:73-88`, has no unit field). The reasoning layer then uses `metadata.gaugeUncertainty` raw:
- `fallbackNarrative` computes `reading.tRequiredMm + unc` (fallback.ts:115-116) — adding an in/mils-denominated uncertainty to a canonical-mm thickness and printing it as `mm ± mm`;
- the pane's LIMIT line and `verdictBasis` label it `mm gauge uncertainty` (reasoning-pane.tsx:272, 58-66);
- `buildNarrativeContext` labels it `gauge_uncertainty_mm` (narrative-context.ts:131) and registers the raw value in `allowedNumbers`, so the numeric lint cannot catch the model quoting the mislabeled figure.

Reachable: `set-metadata-unit` (reducer.ts:126) is a first-class Screen 2 control (`Unit = "mm" | "in" | "mils"`, session.ts:10). With metadata unit `in` and uncertainty `0.01`, the fallback/chain displays `6.35 mm ± 0.01 mm` where the engine used `0.254 mm` — wrong engineering numbers on the safety artifact. The fallback ships unlinted (deterministic path), so nothing downstream catches it.
**Fix:** extend the narrative/extract request metadata slice with `metadataUnit: z.enum(["mm","in","mils"])` (or send pre-converted mm values) and convert via `toMm(metadata.gaugeUncertainty, metadataUnit)` in `fallbackNarrative`, `verdictBasis`, the LIMIT line, and `buildNarrativeContext`.

## Warnings

### WR-01: Split narrative stores — status bar cannot see CML narratives; FIFO cap doubled; allowNarration gate bypassed

**File:** `components/wizard/results-table.tsx:92, 202, 224-233` vs `components/wizard/reasoning-context.tsx:82` + `components/wizard/ptmt-triage-list.tsx:67` + `components/wizard/pipeline-status-bar.tsx:37-44`
**Issue:** `ResultsTable` creates and uses its own **module-level** `createNarrativeStore()` while the provider owns a second store consumed by the PT/MT list and the status bar. Consequences: (1) `PipelineStatusBar` totals/`narrativeModel()`/`streamingCount()` aggregate only the provider store — all CML narrative tokens/latency/model are invisible and the Narrative row shows "pending" even while CML panes stream; (2) two independent cap-3 FIFO pools allow up to 6 concurrent paid streams; (3) `open(..., { allowNarration: true })` is hardcoded (results-table.tsx:231), so the UI-41 client gate (Pitfall 5: never narrate when extraction failed) is not honored for CML panes.
**Fix:** have `ResultsTable` consume `useReasoning()`'s store and `allowNarration` like the PT/MT list does; delete the module-level store.

### WR-02: Extraction route has no upstream timeout or abort propagation (paid call)

**File:** `app/api/reasoning/extract/route.ts:63-84`; `lib/llm/complete.ts:4-20`
**Issue:** the narrative route correctly passes `AbortSignal.any([req.signal, AbortSignal.timeout(30_000)])` (narrative/route.ts:242), but `runValidatedCompletion` has **no signal option at all**, so the extraction call ignores `req.signal` and has no timeout — a client disconnect leaves the paid Lightning call running (twice, with the bounded retry), and a hung upstream pins the route for the SDK's default timeout per attempt.
**Fix:** add `signal?: AbortSignal` to `ValidatedCallOptions`, spread it into `client.chat.completions.create(..., { signal })`, and pass `AbortSignal.any([req.signal, AbortSignal.timeout(30_000)])` from the extract route.

### WR-03: PT/MT narrative errors are unrecoverable, and the pane's Retry button is dead

**File:** `components/wizard/ptmt-triage-list.tsx:117-131`; `components/wizard/reasoning-pane.tsx:355-361`; `components/wizard/results-table.tsx:158-174`
**Issue:** three related defects: (1) the PT/MT toggle only calls `store.open` when `store.get(key) === undefined` — once an `error` entry exists, re-opening never re-requests; (2) `ReasoningPane` renders its own "Retry narrative" button with `onClick={onRetry}` — for PT/MT panes `onRetry` is never passed, so the button is visible but does nothing; (3) in the CML `ReasoningDetailRow` the pane is rendered **without** `onRetry` (so its inner Retry is dead) next to a second, functional outer Retry button — two "Retry narrative" buttons, one inert. Net effect: a broken control on a safety triage surface and PT/MT error states that require a full re-evaluation to clear.
**Fix:** pass a working `onRetry` into `ReasoningPane` from both call sites; hide the button when `onRetry` is absent; let the PT/MT toggle re-open entries in `error` state.

### WR-04: Stream EOF without a terminal frame is marked "complete" with truncated text

**File:** `hooks/use-narrative-stream.ts:300-331`
**Issue:** `consumeNarrativeStream` only settles on usage/rejected/fallback/error frames. If the connection ends cleanly without a terminal frame (proxy/dev-server kill, server crash between deltas and the terminal), the flush loop dispatches remaining deltas and `onDone` promotes the entry to `status: "complete"` — a truncated narrative with no verdict line, rendered to the inspector as a finished product. The route always sends terminal frames today, but the store is the enforcement point and it trusts the transport.
**Fix:** track `terminalSeen` in the consumer; on EOF without a terminal frame, call `onError("narrative stream ended unexpectedly")` instead of falling through to `onDone`.

### WR-05: Malformed `[[cite:…]]` tokens render as raw machinery text

**File:** `lib/reasoning/tokenizer.ts:25-27`; `lib/reasoning/lints.ts:101-104`
**Issue:** the grammar is `[a-z0-9_]+` only. Probe-verified: `[[cite:API570_7_2]]` and `[[cite:]]` tokenize as plain **text** segments (renderer prints them verbatim) and pass `citationAllowlistLint` (no token is recognized). Digits inside a malformed id usually trip the numeric lint → fallback, but a digit-free malformed token (e.g. `[[cite:FOO]]`) survives all four lints and reaches the reader as machinery text, violating the "machinery never reaches the reader" contract (Pitfall 3's spirit).
**Fix:** in `tokenize`, treat any literal `[[cite:` that fails the full grammar as an `incomplete`/unresolved segment (zero glyphs + audit stamp); or add a final-lint check rejecting any remaining `[[cite:` substring in the text.

### WR-06: Report conclusions cite a hardcoded clause for every reject, ignoring engine citations

**File:** `components/report/report-document.tsx:76-80`
**Issue:** the reject branch hardcodes `asme_b31_3_304_1_2` (ASME B31.3 pressure-design formula) as the citation for "is below the calculated required thickness" — even when the governing `t_required` is the **structural** branch (API 574 §10.5.1.4 / API 570 §7.6 max rule). This contradicts the function's own documented contract ("clause ref … for an engine-emitted citation id") and diverges from the re_check branch three lines below, which correctly looks up `reading.citations`.
**Fix:** mirror the re_check branch: `const cite = reading.citations.find((id) => citationRef(id) !== "") ?? null;`

### WR-07: Duplicate React keys in the report CML table for duplicate reading IDs

**File:** `components/report/report-document.tsx:236-237`
**Issue:** `key={reading.readingId}` — WR-04 makes duplicate reading IDs a real, non-blocking warning case; `results-table.tsx:100-102` namespaces by index (`resultRowKey`) for exactly this reason. Duplicate keys produce React warnings and can corrupt reconciliation of the report table.
**Fix:** key by `${reading.readingId}-${index}` (compose the same namespacing as the results table).

### WR-08: `/report` hydration mismatch whenever a snapshot exists

**File:** `app/report/page.tsx:24`; `components/report/report-document.tsx:133`
**Issue:** `readReportSnapshot()` runs during the hydration render. The prerendered HTML rendered `null` (no `sessionStorage` server-side), but the client's first render with a stored snapshot renders the full document — a guaranteed hydration mismatch (recoverable error + full client re-render) every time the route is opened after an evaluation. Additionally `generatedAt` defaults to the render wall clock (report-document.tsx:133), so the prerendered "Generated" date is the build date and disagrees with the client's view date.
**Fix:** mount-gate the page (`const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), [])` and render `null` until mounted), and pass a post-mount timestamp for "Generated".

### WR-09: Queued FIFO starts cannot be cancelled — retry under a saturated cap duplicates the stream

**File:** `hooks/use-narrative-stream.ts:77-85, 151-158, 183-188`
**Issue:** `retry()` aborts `controllers.get(key)` — but a **queued** (not yet started) request has no controller (`controllers.set` happens inside `runFetch`), so the abort is a no-op and the stale queued start remains in `pending`. Retrying again enqueues a second start for the same key; when both are pumped, two concurrent fetches write the same entry, interleaving deltas into garbled text and racing status transitions. The research explicitly permitted dropping the FIFO if it complicated Retry semantics (A3) — it did.
**Fix:** keep queued requests in a `Map<key, () => void>` so `retry`/`open` can remove-and-replace, or drop the FIFO and rely on the SDK/route-level guards.

### WR-10: Session-snapshot "defensive" parse validates a fraction of the shape, then casts through `unknown`

**File:** `lib/report/session-snapshot.ts:46-61`
**Issue:** the file's contract is "sessionStorage can hold anything … every field shape-checked", but `metadata` is only `isRecord`-checked (a bare `{}` passes) then `as unknown as ComponentMetadata` (the 03-00b summary records this cast as a tsc workaround), and `readings`/`indications` elements are entirely unchecked. A corrupted-but-array payload (e.g. an element without `flags`) crashes `ReportDocument` (`reading.flags.includes` → TypeError) instead of degrading to the redirect.
**Fix:** shape-check per element (or validate the minimal fields ReportDocument reads) and return `null` on failure; alternatively wrap the document in an error boundary.

## Info

### IN-01: `historyFor` and the entire positional history seam are dead code

**File:** `components/wizard/reasoning-context.tsx:90-103, 164`; `components/wizard/results-table.tsx:87`
**Issue:** `ReasoningContextValue.historyFor` is never consumed anywhere; `narrativeRequestBody` hardcodes `history: null`. Open-question resolution 4 ("history values ARE injected into the narrative prompt") is therefore not delivered through the UI — `HistorySchema`, the route's history plumbing, and `buildNarrativeContext`'s history block all exist but starve, and CML narratives never explain the corrosion rates they quote.
**Fix:** wire `historyFor(index)` into the request body (with the CR-01 fix) or remove the seam and the schema field.

### IN-02: Store `unresolvedCitations()` registry never receives entries; audit footnote covers PT/MT only

**File:** `hooks/use-narrative-stream.ts:62, 226`; `components/wizard/screen-results.tsx:285-301`
**Issue:** nothing ever calls `unresolved.add` — the registry always returns `[]`. The Screen 3 audit footnote instead counts only `onUnresolvedCitation` callbacks from the PT/MT list; `ResultsTable` receives no such callback, so CML-pane unresolved citations (defensive-only today, since server lints reject unknown ids) would be uncounted. Dead code plus inconsistent plumbing.
**Fix:** remove the registry, or plumb pane notifications uniformly and feed the footnote from it.

### IN-03: `meta` frame is dead protocol

**File:** `lib/reasoning/schemas.ts:202`; `app/api/reasoning/narrative/route.ts` (never sends it)
**Issue:** the SSE union defines `{ type: "meta", model }` and the consumer treats it as "reserved", but the route never emits it — the model badge is sourced from the usage frame instead. Dead protocol surface.
**Fix:** drop the `meta` variant or emit it once at stream start and source the badge from it.

### IN-04: `verdictAgreement` does not enforce final-line position

**File:** `lib/reasoning/lints.ts:88-93`
**Issue:** probe-verified: `"Verdict: ACCEPT.\nThen some extra trailing prose continues here."` passes — the multiline `\$` anchors to any line end, while the prompt contract says "the very last line must be exactly 'Verdict: X.' — nothing after it". Trailing prose that survives the other three lints would be served.
**Fix:** additionally require the match to end at the end of the trimmed text (`text.trimEnd().endsWith(match[0].trimEnd())`), or anchor with `\\s*\\$` without the `m` flag on the final line.

### IN-05: `NarrativeEntryState` type duplicated between store and pane

**File:** `hooks/use-narrative-stream.ts:20-27`; `components/wizard/reasoning-pane.tsx:34-41`
**Issue:** two hand-kept copies of the same contract that must stay byte-identical (the pane's states are the store's states). Drift risk with no compiler guard.
**Fix:** export the type from `hooks/use-narrative-stream.ts` and import it in the pane.

### IN-06: `CitationChip` detail ids are not instance-unique

**File:** `components/wizard/citation-chip.tsx:33, 40, 46`
**Issue:** `cite-detail-${record.id}` is deterministic per record, so the same citation rendered twice (chain + narrative, or twice in one narrative) yields duplicate DOM ids when expanded — invalid HTML; both buttons then `aria-controls` one of several same-id elements.
**Fix:** compose the id with a caller-supplied scope (pane/row key) via a `idPrefix` or `useId()`.

### IN-07: Hidden span exists only to justify an import

**File:** `components/wizard/ptmt-triage-list.tsx:160-162`
**Issue:** `<span className="hidden">{typeof criteria.ptmt.relevance_threshold_mm}</span>` renders the string "number" into the DOM solely so the `criteria` import is "meaningful" — the pane imports criteria itself. Artificial dead code.
**Fix:** delete the span and the `criteria` import from this file.

### IN-08: Extract route fabricates zero token counts when usage is absent

**File:** `app/api/reasoning/extract/route.ts:88-89`
**Issue:** `usage.v?.promptTokens ?? 0` reports `0` when the sink never fired (provider omitted usage), which the status bar renders as an honest-looking "tokens 0". The phase's own standard is "nothing fabricated" (fallback metrics render `—`).
**Fix:** return `null` fields when the sink did not fire and let the UI render `—`.

### IN-09: PT/MT narrative prompt can never contain the evaluation context pack

**File:** `lib/reasoning/schemas.ts:138-144`; `app/api/reasoning/narrative/route.ts:130-135`; `lib/reasoning/prompts.ts:53`
**Issue:** the `ptmt` request variant has no `extraction` field and the route passes `extraction: null`, so PT/MT prompts contain no `evaluation_context` — while the shared user-prompt template tells the model "the evaluation_context block inside is the qualitative EVALUATION CONTEXT gathered earlier" (false for PT/MT), and research R1's "shared by every pane" (crack-suspect cautions reaching PT/MT narration) is not realized.
**Fix:** extend the ptmt variant with the (nullable) extraction pack and inject it, or make the parenthetical conditional on the block existing.

---

_Reviewed: 2026-10-03T19:17:50Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

## Dispositions (post-walkthrough, 2026-10-05 — orchestrator)

| Finding | Disposition | Rationale |
|---|---|---|
| WR-03 PT/MT error Retry | ACCEPTED | Error entries ARE recoverable — the store's open() re-fetches on re-open (toggle Hide→View), only the dedicated button is absent. UX polish deferred to Phase 5 hardening. |
| WR-07 report-table duplicate keys | ACCEPTED | Snapshot readings are engine-generated (unique ids); collision requires malformed input that the Phase 2 validation gate rejects upstream. |
| WR-08 /report hydration mismatch | ACCEPTED | Dev-only hydration warning on the sessionStorage read; production build renders client-side post-hydration. Phase 4 rebuilds this page entirely. |
| WR-09 queued-FIFO retry race | ACCEPTED | Race window is one macrotask; consequence is a duplicate fetch that the evaluatedAt-keyed cache absorbs — no stale-data path. |
| WR-10 snapshot partial validation | ACCEPTED | Snapshot is written by the same process that ran the full Zod-validated evaluation; Phase 4 adds the report-schema validation pass. |

**Browser walkthrough (enabled path, live):** extraction badge `nvidia/Nemotron-3_5-Lightning · tokens 3,857 · 13.9 s · —`; CML pane streamed a real Super-120B narrative (`nvidia/nemotron-3-super-120b-a12b · tokens 1,436 · 3.2 s · —`) ending `Verdict: RE-CHECK` (agrees with computed verdict); status bar aggregates across panes (single store). One walkthrough finding fixed: provider now receives engine-evaluated indications (commit on build/phase-3).
