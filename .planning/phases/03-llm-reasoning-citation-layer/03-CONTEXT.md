# Phase 3: LLM Reasoning & Citation Layer - Context

**Gathered:** 2026-09-27
**Status:** Ready for planning
**Mode:** Smart-discuss (decisions locked via handoff.md, criteria configs, 03-UI-SPEC, and the adversarial-UI-review dispositions below)

<domain>
## Phase Boundary

Every computed verdict gains a streamed, clause-cited acceptance narrative — Lightning structures the raw inputs, Super-120B narrates strictly around precomputed values, and citations resolve only against the builder-vetted, edition-pinned allowlist, with a deterministic fallback narrative shipped first. UI work is confined to the reasoning pane, citation chips, pipeline status bar, and the chrome adjustments listed below; no PDF, no demo caching.

</domain>

<decisions>
## Implementation Decisions

### Reasoning architecture (locked — handoff.md §2, ROADMAP SC1-5, 03-UI-SPEC)
- Lightning extracts/structures inputs into Zod-validated JSON via the Phase 1 `runValidatedCompletion` contract (json_object → Zod → exactly one bounded retry); extraction failure fails LOUDLY before any narrative (SC1).
- Super-120B narrates strictly around precomputed values from Phase 2's `ReadingResult` — it NEVER computes. Numeric-consistency and verdict-agreement lints reject contradicting narratives (SC2).
- Citations: model emits `[[cite:<id>]]` tokens only; renderer resolves against `lib/criteria/citations.json` — unknown/fabricated ID renders zero glyphs + amber audit stamp + footnote counter (SC3). No verbatim standard text anywhere (cite-don't-quote).
- PT/MT indications: per-indication verdicts from the Phase 2 criteria engine are what the narrative references (SC4).
- Pipeline status bar: runtime-resolved model badges (never hardcoded IDs), tokens/latency/cost per step (SC5, PLAT-05).
- Deterministic fallback narrative ships FIRST — full flow works with LLM disabled (fallback state).

### Chrome + table adjustments (binding — adversarial_review_ui.md dispositions, verified empirically)
- **Sticky columns (C1/C3, confirmed at 1366×768: table 1221px in 1086px container):** keep the horizontal scroll wrapper; make the first column (CML/Location) and last column (Verdict) sticky during horizontal scroll; compact-width contract tuned for 1366×768 as the minimum demo viewport.
- **4-step wizard indicator (C4, decided now):** steps become `1 Ingest · 2 Review & Metadata · 3 Results · 4 Report` with Step 4 rendered locked/greyed in Phase 3 — Phase 4 unlocks it. No destructive refactor later.
- **Mapping preview (H2):** deferred to v1.x — recorded as a deferred idea, not Phase 3 scope.
- **Progressive population (H4):** reasoning panes stream lazily per expanded row with session cache (03-UI-SPEC decision) — no eager narration of 4,912 rows.

### Claude's Discretion
Prompt templates' exact wording, gateway module structure, cache key design, fallback narrative prose (code-cited), lint implementation details — within the invariants above.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 1: `lib/llm/*` (runValidatedCompletion with injectable client + bounded retry, env-only config, SSE route pattern, health gate), live-proven on both routed models
- Phase 2: `ReadingResult`/`EvaluationSession` data model (the narrative's ONLY numeric source), results surface with FlagDetailRow aria pattern, verdict chips, PT/MT triage cards, `resultRowKey` namespacing
- `lib/criteria/citations.json` — 15 verified entries (incl. api574_10_5_1_4 + api574_annex_d added this session)

### Established Patterns
- Fail-loud three-tier error conventions; hermetic test suite (280 offline) with `FLAWCHECK_LIVE_LLM` opt-in for live tests
- Agentic commits on build/phase-3; forbidden-import lints as architectural invariants

### Integration Points
- Extend `screen-results.tsx` (11th trailing Reasoning column + colSpan detail rows); pipeline status bar between summary strip and table
- Phase 4 (report) will consume the same narrative + citation resolution — keep the renderer module pure and reusable

</code_context>

<specifics>
## Specific Ideas

- Cost discipline: lazy per-pane streaming, session-cached narratives; extraction runs once per evaluation (batch), narrative per expanded row on demand.
- The fallback narrative must be genuinely usable (an inspector reading only the fallback still gets a defensible, cited rationale).

</specifics>

<deferred>
## Deferred Ideas

- Column-mapping value preview (adversarial_review_ui H2) — v1.x
- Fleet triage, trend charts, excerpt reasoning (v2 per REQUIREMENTS.md)

</deferred>
