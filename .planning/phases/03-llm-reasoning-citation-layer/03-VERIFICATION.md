---
phase: 03-llm-reasoning-citation-layer
verified: 2026-10-05T09:58:48Z
status: human_needed
score: 52/52 must-haves verified
behavior_unverified: 0
overrides_applied: 0
covered_files:
  - .planning/phases/03-llm-reasoning-citation-layer/03-00-PLAN.md
  - .planning/phases/03-llm-reasoning-citation-layer/03-00-SUMMARY.md
  - .planning/phases/03-llm-reasoning-citation-layer/03-00b-PLAN.md
  - .planning/phases/03-llm-reasoning-citation-layer/03-00b-SUMMARY.md
  - .planning/phases/03-llm-reasoning-citation-layer/03-01-PLAN.md
  - .planning/phases/03-llm-reasoning-citation-layer/03-01-SUMMARY.md
  - .planning/phases/03-llm-reasoning-citation-layer/03-02-PLAN.md
  - .planning/phases/03-llm-reasoning-citation-layer/03-02-SUMMARY.md
  - .planning/phases/03-llm-reasoning-citation-layer/03-03-PLAN.md
  - .planning/phases/03-llm-reasoning-citation-layer/03-03-SUMMARY.md
  - .planning/phases/03-llm-reasoning-citation-layer/03-04-PLAN.md
  - .planning/phases/03-llm-reasoning-citation-layer/03-04-SUMMARY.md
  - .planning/phases/03-llm-reasoning-citation-layer/03-05-PLAN.md
  - .planning/phases/03-llm-reasoning-citation-layer/03-05-SUMMARY.md
  - .planning/phases/03-llm-reasoning-citation-layer/03-REVIEW.md
  - .planning/phases/03-llm-reasoning-citation-layer/03-UI-SPEC.md
  - app/api/reasoning/extract/route.ts
  - app/api/reasoning/narrative/route.ts
  - components/wizard/reasoning-context.tsx
  - components/wizard/reasoning-pane.tsx
  - components/wizard/results-table.tsx
  - components/wizard/pipeline-status-bar.tsx
  - components/wizard/ptmt-triage-list.tsx
  - components/wizard/citation-chip.tsx
  - components/wizard/screen-results.tsx
  - components/report/report-document.tsx
  - hooks/use-narrative-stream.ts
  - lib/reasoning/tokenizer.ts
  - lib/reasoning/fallback.ts
  - lib/reasoning/lints.ts
  - lib/reasoning/schemas.ts
  - lib/reasoning/prompts.ts
  - lib/reasoning/narrative-context.ts
  - lib/llm/complete.ts
  - lib/report/session-snapshot.ts
  - lib/utils.ts
  - lib/criteria/citations.json
  - tests/reasoning/e2e-offline.test.ts
covered_digest: "v1:sha256:44cb634e467b6e510a33be5aed8e187c69681aa7489aa061da3b70cd511affb3"
human_verification:
  - test: "Enabled-path browser walkthrough: with NEBIUS_API_KEY configured, run an evaluation on / and open a CML pane"
    expected: "Streamed narrative renders incrementally into the pane; [[cite:id]] tokens become chips labeled only from citations.json; the pane and the Pipeline status bar show the runtime-resolved model badge + real tokens/latency (cost —)"
    why_human: "React effects, real SSE over HTTP, StrictMode-on mount behavior, and visual rendering are not observable via grep or SSR markup tests; the enabled UI glue (CR-01 fix) has no browser record yet"
  - test: "Extraction-failure UX (UI-41 / SC1 UI half): force a live extraction failure (or block the network) and observe Screen 3"
    expected: "role=alert banner above the table with the UI-SPEC copy, Extraction step shows FAILED, panes render error state on open, all computed table columns stay fully populated"
    why_human: "Cross-component visual + alert semantics; hermetic tests pin markup fragments, not the live failure flow"
  - test: "PT/MT pane error recovery (review WR-03 — open, UNDISPOSED): trigger a PT/MT narrative error, then press the pane's Retry narrative button and re-toggle the card"
    expected: "KNOWN DEFECT at HEAD: the pane's Retry button is inert (no onRetry passed) and the toggle never re-requests an errored entry — recovery currently requires re-running the evaluation. Human decision: accept and dispose, or fix before merge"
    why_human: "Requires deciding whether the defect ships; a runtime click path grep can only statically confirm"
  - test: "Visual conformance of the Phase 3 reasoning surface vs the 03-UI-SPEC delta (accent reserve, typography scale, chip/badge classes, audit-stamp color)"
    expected: "Orange accent only on primary actions and citation chips; badges/caret never accent-colored; model IDs verbatim (no uppercase transform); amber audit stamps"
    why_human: "Visual appearance is a human judgment item by policy"
---

# Phase 3: LLM Reasoning & Citation Layer — Verification Report

**Phase Goal:** Every computed verdict gains a streamed, clause-cited acceptance narrative — Lightning structures the raw inputs, Super-120B narrates strictly around precomputed values, and citations resolve only against the builder-vetted, edition-pinned allowlist, with a deterministic fallback narrative shipped first.
**Verified:** 2026-10-05T09:58:48Z (branch `build/phase-3` @ 834a822, review fixes merged)
**Status:** human_needed
**Re-verification:** No — initial verification (no prior VERIFICATION.md)

## Goal Achievement

### Gate Chain (run by this verifier, not trusted from summaries)

| Gate | Command | Result |
|------|---------|--------|
| Typecheck | `npm run typecheck` | PASS (0 errors) |
| Lint | `npm run lint` | PASS (0 errors, 16 warnings — all pre-existing unused-var warnings in tests) |
| Hermetic suite | `npm test` | **449 passed / 5 skipped** (42 files; live tests skipIf-gated) — matches the expected count exactly |
| Production build | `npm run build` | PASS — `/api/reasoning/extract`, `/api/reasoning/narrative`, `/report` all present |
| Byte-identity | `git diff a1d0b2a -- lib/calc lib/criteria` | PASS — calc engine + criteria frozen vs the phase-start ref |
| Model-ID grep | `grep -rn "nvidia/" app lib scripts tests instrumentation.ts` | CLEAN (0 matches; UI-38 holds) |
| dangerouslySetInnerHTML | `grep -rn app components` | CLEAN (0 matches) |
| Dependency ledger | UNINSTALL.md Phase 3 section + package.json | All 5 user-approved Flowstep packages present and ledgered |
| Purity/boundary tests | within suite | PASS (lib/calc never imports lib/llm; criteria sovereignty green) |

### Review-Fix Regressions (re-verified in source, not from the merge message)

| Fix | Evidence at HEAD | Status |
|-----|------------------|--------|
| CR-01 dead enabled path | `results-table.tsx` consumes `useReasoning()`; `narrativeRequestBody()` carries `extraction: extractionPack` (null only while pending/failed, when `allowNarration=false` blocks `open()` from fetching at all) + `history: historyFor(dataIndex)`; route 422 guard (route.ts:73-78) can no longer fire from the UI glue | VERIFIED |
| CR-02 StrictMode deadlock | `reasoning-context.tsx` effect registers NO cleanup/cancellation channel; `runExtractionRequest` is pure async; `firedForRef` keyed by evaluatedAt keeps fire-once; pinned by `tests/wizard/reasoning-strictmode.test.ts` (setup→cleanup→setup simulation, 3 tests) | VERIFIED |
| CR-03 mixed-unit arithmetic | `metadataUnit: z.enum(["mm","in","mils"])` in the strict `MetadataSliceSchema`; `toMm()` applied in `fallback.ts:118`, `narrative-context.ts:143` (payload + allowlist), `prompts.ts:111`, pane LIMIT (line 287) and `verdictBasis` (line 70); fixtures across 10+ test files carry `metadataUnit` | VERIFIED |
| WR-05 malformed cite tokens | `tokenizer.ts` widened charset `([^\]\n]*)` — ANY `[[cite:…]]` shape is a token; malformed id → `resolved:false` → zero glyphs + audit stamp; `citationAllowlistLint` machinery-scan rejects leftovers; local fresh regexes fix the lastIndex state bug; named pins in tokenizer/lints/pane tests | VERIFIED |
| WR-01 single store | Module-level store in results-table deleted (grep: only provider-owned store + the non-provider fallback singleton); status bar sees CML narratives; FIFO cap 3 app-wide | VERIFIED |
| WR-02 paid-call abort/timeout | `complete.ts` `signal?: AbortSignal` forwarded on EVERY attempt (+ retry replays the model's own bad reply); extract route: `AbortSignal.any([req.signal, AbortSignal.timeout(60_000)])`; narrative route keeps 30s; named pin "WR-02: forwards the abort signal as request options on EVERY attempt" | VERIFIED |
| WR-04 stream EOF | `consumeNarrativeStream`: `if (!settled) handlers.onError("narrative stream ended without a terminal frame")` — truncated text can never settle complete; named store test | VERIFIED |
| WR-06 report reject citations | `buildConclusions` reject branch now prefers the reading's own engine-emitted citation (hardcoded clause only as fallback) — commit mislabels this "WR-08" | VERIFIED |

### Observable Truths

**ROADMAP success criteria (the contract):**

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| SC1 | Lightning extraction via json_object → Zod → exactly one bounded retry; bad input fails loudly (502/422) before narration | ✓ VERIFIED | `lib/llm/complete.ts` (exactly 2 attempts, `parseJsonLoose` transport hardening); extract route 400 strict-gate / 502 loud / 422 narrative refusal; `extract-route.test.ts` + `narrative-route-stream.test.ts` pins; live A11 record (2026-09-28) |
| SC2 | Super-120B narrates strictly around precomputed values, streamed SSE into the visible pane; numeric-consistency + verdict-agreement lints reject contradictions | ✓ VERIFIED | `narrative-context.ts` single source (payload ≡ allowlist); sentence-level mid-stream guard + `runFinalLints` (4 lints); rejected frame swaps to fallback, offending bytes never relayed (`lint-swap.test.ts`); streaming state machine test-pinned (`narrative-stream.test.ts`, `reasoning-stream-ui.test.tsx`); live record: 790/550 tokens, all lints passed, `Verdict: ACCEPT.` |
| SC3 | Citations render only from the 15-entry edition-pinned `citations.json` allowlist; fabricated ID renders zero glyphs + audit stamp, renderer-enforced, CI-checked | ✓ VERIFIED | `citations.json`: 15 records, every `edition` populated; renderer resolves only record fields; `e2e-offline.test.ts` "(d) REAS-03 end-to-end" proves zero-glyph + audit stamp through the real pipeline; malformed tokens hard-rejected (WR-05) |
| SC4 | PT/MT indications evaluated against builder's structured criteria config with per-indication verdicts the narrative references | ✓ VERIFIED | `lib/calc/ptmt.ts` loads `criteria.ptmt`; engine verdict is ground truth injected into prompt context; pane indication chain renders thresholds verbatim + `indication.detail`; `fallbackNarrativeForIndication` cites only `indication.citationId`; screen3-integration tests |
| SC5 | Status line with model badges shows which Nemotron model (plus tokens) handled each step | ✓ VERIFIED | `pipeline-status-bar.tsx` renders runtime-resolved badges from server usage frames; zero hardcoded IDs (grep clean); tokens/latency real, cost honestly `—`; single store makes CML narratives visible after WR-01 fix |

**Plan must-have truths — 52 total across 7 plans, all VERIFIED. Grouped disposition:**

| Plan | Truths | Status | Key evidence |
|------|--------|--------|--------------|
| 03-00 (6) | Flowstep chrome baseline; 280 Phase-2 tests stay green; Screen 1 parity + 25 MB cap; Screen 2 six mapping targets; 5 packages ledgered; phase-start ref recorded | 6/6 ✓ | flowstep-restyle (21 tests), validate.ts MAX_FILE_BYTES, reducer.test, UNINSTALL.md, phase-start-ref.txt + byte-identity PASS |
| 03-00b (4) | Screen 3 real-data restyle; FS-12 locked /report preview; FS-01..12 pinned; contracts byte-identical | 4/4 ✓ | report-preview.test, FS-01..12 enumerated in named tests (verified by grep) |
| 03-01 (11) | UI-25 11-column table; UI-26 chain-first; UI-27 chain≡table values; UI-33 fallback chip/closing/metrics; UI-34 record-only chip labels; UI-35 zero-glyph + stamp; UI-36 detail toggle; binding C1/C3 sticky; UI-46/47/48 backstops | 11/11 ✓ | results-table.tsx, reasoning-pane.tsx, citation-chip.tsx + reasoning-pane/narrative-stream/e2e tests; backstops pinned by class assertions in the pane suite |
| 03-02 (8) | REAS-01/SC1; UI-41 server 422; REAS-02/SC2 lints; UI-42 server rejected→fallback; REAS-05/SC4; resolution 4 history injected; PLAT-05 server usage; UI-33 server single narration source | 8/8 ✓ | routes + narrative-context/lints/fallback + test pins; history seam now wired through the UI (CR-01 fix closed former IN-01) |
| 03-03 (8) | UI-28 loading; UI-29 streaming caret/aria-busy; UI-30 complete badge/metrics; UI-31 cache no-refetch; UI-32 error + working CML retry; UI-42 client rejected discarded; UI-44 lazy per-pane; UI-45 evaluatedAt keying | 8/8 ✓ | `use-narrative-stream.ts` store contracts test-pinned (cache, FIFO 3, abort/retry, stale-key invisibility, safeTailHold); CML retry wired via `results-table.tsx` outer button (PT/MT retry caveat → warning below) |
| 03-04 (10) | UI-37 audit footnote; UI-38 no hardcoded IDs; UI-39 status bar; UI-40 status states; UI-41 banner+FAILED; UI-43 PT/MT panes; resolution 2 cost `—`; resolution 3 fallback mode; binding C4; UI-45 screen reset | 10/10 ✓ | screen-results.tsx (banner line 358-368, footnote 299), pipeline-status-bar.tsx, ptmt-triage-list.tsx + integration tests; five narrative states identical across pane kinds (WR-03 retry defect recorded as warning) |
| 03-05 (5) | REAS-03 e2e final proof; fallback-first end-to-end; UI-25..48 + FS-01..12 accounted; SC1-5 mapped; repo invariants hold | 5/5 ✓ | e2e-offline (4 tests, real routes); grep/byte-identity/ledger gates re-run by this verifier |

No must_haves.prohibitions blocks exist in any of the 7 plans — no prohibition-tier items to route.

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| results-table.tsx | /api/reasoning/narrative | `store.open(narrativeRequestBody(…))` with real extraction pack + history + allowNarration | WIRED |
| reasoning-context.tsx | /api/reasoning/extract | one POST per evaluatedAt (metadata+metadataUnit, notes, indications, client digest) | WIRED |
| narrative route | narrative-context.ts | `buildNarrativeContext` returns payload + allowlists together | WIRED |
| narrative route | lib/reasoning/lints.ts | mid-stream `numericConsistency` + `runFinalLints` on the single context object | WIRED |
| narrative route | lib/llm/client.ts | Super-120B stream, `AbortSignal.any([req.signal, timeout(30s)])`, `include_usage` | WIRED |
| extract route | lib/llm/complete.ts | `runValidatedCompletion` + usageSink + WR-02 signal | WIRED |
| store | lib/reasoning/tokenizer.ts | `safeTailHold` chunk-boundary hold-back | WIRED |
| pipeline-status-bar | narrative store | `totals()`/`streamingCount()`/`narrativeModel()`/`fallbackServed()` on the ONE provider store | WIRED |
| reasoning pane | citations.json | `recordFor(id)` — labels from record fields only | WIRED |
| fallback.ts | lib/calc (criteria/units) | `citationIdExists` + `toMm` — never re-implements criteria | WIRED |
| screen-results | session-snapshot + /report | `writeReportSnapshot` auto-write/Save; `/report` reads same key | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data? | Status |
|----------|------|--------|-----------|--------|
| Status-bar / pane model badges | `model` | usage frames ← env-resolved accessors at call time | yes, runtime-resolved | FLOWING |
| Pane narrative | deltas / fallback text | Super-120B SSE (enabled) or deterministic fallback (disabled/rejected) | yes | FLOWING |
| Chain INPUTS/LIMIT/VERDICT | ReadingResult | pure-TS `evaluate()` | yes | FLOWING |
| Cost field | — | no price map exists; never estimated | by-design `—` | HONEST-DASH |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full hermetic suite | `npm test` | 449 passed / 5 skipped | PASS |
| WR-05 malformed-cite pins exist | `npx vitest list` (tokenizer/stream/strictmode) | 3 WR-05/CR-02/WR-04 named tests enumerated | PASS (ran inside full suite) |
| CR-02 strictmode simulation exists | `tests/wizard/reasoning-strictmode.test.ts` | 3 tests, pass | PASS |
| WR-02 signal pin exists | `validated-call.retry.test.ts` | "WR-02: forwards the abort signal … EVERY attempt", pass | PASS |
| Live suite (key present — honest run) | `FLAWCHECK_LIVE_LLM=1 npx vitest run tests/llm/hello-fixture.test.ts tests/reasoning/live-pipeline.test.ts` | **2/5 pass**. Super-120B: both tests PASS. Lightning: 2 tests hit the vitest 5s test-timeout; live pipeline 502 when the route's 60s extraction timeout fired | KNOWN FLAKINESS (see note) |
| Direct Lightning probe (same env model ID) | `node scratch/live-probe.mjs` (deleted after) | HTTP 200 in 4.8s from `nvidia/Nemotron-3_5-Lightning` | ENDPOINT ALIVE |

**Live-suite note (recorded, not a gap):** the failures are provider latency, not code defects — Lightning's visible chain-of-thought now routinely exceeds the vitest 5s default test timeout (the product route uses 60s), and one full-pipeline run exhausted the route's own 60s timeout (WR-02's timeout working as designed). This is the same class the 03-02/03-05 summaries recorded ("known live flakiness — lints reject → fallback"). Hermetic suite remains key-independent and fully green. Advisory for Phase 5: Lightning latency under load can approach the 60s extraction timeout — consider a larger demo-mode budget.

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|--------------|--------|----------|
| REAS-01 | 03-02 | SATISFIED | extract route + validated-call contract + loud 502/422 tiering (test-pinned) |
| REAS-02 | 03-02, 03-03 | SATISFIED | precomputed-values-only prompt surface, 4 lints + sentence guard, fallback swap; streaming store |
| REAS-03 | 03-01, 03-02, 03-05 | SATISFIED | renderer-enforced 15-entry edition-pinned allowlist; e2e zero-glyph proof; WR-05 hardening |
| REAS-04 | 03-01, 03-04 | SATISFIED | INPUTS/CLAUSE/LIMIT/VERDICT chain visible in all five pane states |
| REAS-05 | 03-02, 03-04 | SATISFIED | criteria.ptmt ground truth; engine verdicts injected/referenced by narratives |
| PLAT-05 | 03-02, 03-04 | SATISFIED | runtime-resolved model badges per step + real tokens/latency; zero hardcoded IDs |

Orphaned requirements: none — REQUIREMENTS.md maps exactly REAS-01..05 + PLAT-05 to Phase 3; all claimed by plans. (REQUIREMENTS.md status column still reads "Pending" — stale bookkeeping to flip at phase close.)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| components/wizard/ptmt-triage-list.tsx | 120-124 | PT/MT toggle never re-opens an `error` entry (`store.get(...) === undefined` guard) | ⚠️ Warning (review WR-03 — open, UNDISPOSED) | PT/MT error recovery requires re-evaluation |
| components/wizard/reasoning-pane.tsx | 372-378 | Error-state "Retry narrative" button renders even when `onRetry` is absent → inert button on PT/MT panes; duplicate inert button inside CML detail rows | ⚠️ Warning (review WR-03 — open, UNDISPOSED) | Broken control on a triage surface |
| components/report/report-document.tsx | 244 | `key={reading.readingId}` not namespaced by index | ⚠️ Warning (review WR-07 — open, UNDISPOSED) | Duplicate React keys only when duplicate reading IDs exist (warning-level data) |
| app/report/page.tsx | 24 | `readReportSnapshot()` during hydration render — no mount gate | ⚠️ Warning (review WR-08 — open, UNDISPOSED) | Recoverable hydration mismatch whenever a snapshot exists |
| hooks/use-narrative-stream.ts | 183-188 | `retry` cannot cancel a FIFO-queued (not-yet-started) request | ⚠️ Warning (review WR-09 — open, UNDISPOSED) | Duplicate-stream race only under cap saturation + retry |
| lib/report/session-snapshot.ts | 56 | `metadata as unknown as ComponentMetadata` with partial shape-check | ⚠️ Warning (review WR-10 — open, UNDISPOSED) | Corrupted sessionStorage can crash the report preview instead of degrading |

Debt-marker gate: zero TBD/FIXME/XXX/HACK/PLACEHOLDER markers in any phase file. No stubs: every grep-flagged empty default is initial state overwritten by fetch/store before render (verified per file).

**Review disposition audit:** the fix branch closed all 3 criticals + 5 of 10 warnings (WR-01, WR-02, WR-04, WR-05, WR-06). **WR-03, WR-07, WR-08, WR-09, WR-10 are NOT fixed and NO disposition record exists anywhere in .planning, git history, or STATE.md** — the claim "dispositions recorded" does not hold for these five. They are all warning-level, outside every must-have truth, so they do not block the goal — but they need explicit accept/fix dispositions before merge to master.

### Anti-Slop Assessment

The reasoning layer is **real machinery, not theater**:

1. **Lints genuinely enforce** — four pure, import-free lints (numeric-consistency with the mandatory ASME B31.3 designator strip, verdict-agreement, wrong-context citation allowlist, 8-word verbatim n-gram) gate BOTH the mid-stream relay (a contradicting sentence is never relayed — byte-exact `sentenceRelayCutoff`) and the final text; 24+ lint tests, and `lint-swap.test.ts` pins rejected→fallback with no usage frame.
2. **Fallback works with the LLM fully disabled** — `e2e-offline.test.ts` drives the REAL route handlers and the client's real frame consumer under `FLAWCHECK_DISABLE_LLM=1`: deterministic cited narratives, locked closing sentence, zero fabricated usage frames.
3. **Citations are locked** — the renderer resolves only `citations.json` record fields (15 entries, all edition-pinned); the fallback additionally cites only engine-emitted ids; malformed `[[cite:FOO]]`/`[[cite:]]` now hard-reject (WR-05) and the e2e suite proves a fabricated id renders zero glyphs + audit stamp.
4. **Nothing fabricated** — no hardcoded model IDs (grep-gated), usage `null` renders `—` not 0, cost is never estimated (no price map in .ts), the LLM touches no arithmetic (`lib/calc` byte-frozen + forbidden-import lint).

### Human Verification Required

See the four `human_verification` items in the frontmatter — enabled-path browser walkthrough (SC2/SC5 UI level), extraction-failure banner UX, the WR-03 PT/MT error-recovery accept-or-fix decision, and visual conformance vs the 03-UI-SPEC delta. These mirror the per-phase browser walkthrough step recorded for Phases 1-2.

### Gaps Summary

No goal-blocking gaps: all 52 plan must-have truths and all 5 ROADMAP success criteria are verified with wired, test-backed evidence; all gates green; all six review-fix regressions hold at HEAD. The phase is **human_needed** only: the enabled path has never been walked in a browser, and five warning-level review findings remain open without dispositions. Bookkeeping to fix at close: ROADMAP.md still shows Phase 3 "2/7 plans executed" with 03-01..03-05 unchecked (stale — all 7 executed with summaries on disk).

---

_Verified: 2026-10-05T09:58:48Z_
_Verifier: Claude (gsd-verifier)_
