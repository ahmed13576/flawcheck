# Phase 3: LLM Reasoning & Citation Layer - Research

**Researched:** 2026-09-27
**Domain:** Two-model LLM pipeline (Lightning extraction → Super-120B streamed narrative) with allowlist-enforced citation rendering, deterministic fallback, and consistency lints — composed on Phase 1 `lib/llm/*` primitives and Phase 2's `ReadingResult` data model
**Confidence:** HIGH for architecture (every primitive verified in-repo this session) and API contracts (official Token Factory docs fetched today); MEDIUM for prompt-design behavior (needs live fixture test); tuning values are tagged [ASSUMED]

<user_constraints>
## User Constraints (from CONTEXT.md)

### Implementation Decisions (locked — copied verbatim from 03-CONTEXT.md)

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

### Specific Ideas (from CONTEXT.md)
- Cost discipline: lazy per-pane streaming, session-cached narratives; extraction runs once per evaluation (batch), narrative per expanded row on demand.
- The fallback narrative must be genuinely usable (an inspector reading only the fallback still gets a defensible, cited rationale).

### Deferred Ideas (OUT OF SCOPE)
- Column-mapping value preview (adversarial_review_ui H2) — v1.x
- Fleet triage, trend charts, excerpt reasoning (v2 per REQUIREMENTS.md)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REAS-01 | Lightning extracts/structures readings and notes into validated JSON (schema + Zod + one bounded retry) | Batched per-evaluation extraction via `runValidatedCompletion` (lib/llm/complete.ts:15-64, already implements assistant-turn retry replay); schema + prompt contract designed below (Pattern R2); failure = loud banner (UI-41) |
| REAS-02 | Super-120B produces acceptance narrative around precomputed values — never computes | Narrative prompt contract + numeric-consistency/verdict-agreement lints (Patterns R3, R7); SSE streaming route extends app/api/spike/stream/route.ts pattern; `reasoning_effort: "low"` recommended |
| REAS-03 | Citations from the builder-vetted allowlist only, renderer-enforced | `[[cite:<id>]]` tokenizer + renderer over the 15-entry `lib/criteria/citations.json`; `citationIdExists()` already exists (lib/calc/criteria.ts:21-23); unknown-ID → zero glyphs + audit stamp (Pattern R4) |
| REAS-04 | Visible reasoning chain (inputs → clause → limit → verdict) per decision | Chain renders deterministically from `ReadingResult` (UI-26/27), independent of LLM state; pane layout contract fully specified in 03-UI-SPEC |
| REAS-05 | PT/MT indications evaluated against structured criteria config with per-indication verdicts the narrative references | `PtmIndicationResult` (lib/ingest/session.ts:145-149) carries verdict + detail + citationId; criteria thresholds (1.5/3×/5.0 mm/cluster) load from ptmt-criteria.json via lib/calc/criteria.ts — injected into the narrative prompt as precomputed values |
| PLAT-05 | Model badges show which Nemotron model handled each step | Runtime-resolved env IDs via existing `getReasoningModel()`/`getExtractionModel()` (lib/llm/config.ts:19-25); per-step tokens from gateway usage metadata (`stream_options.include_usage` — verified today); latency measured server-side around the upstream call |
</phase_requirements>

## Project Constraints (from AGENTS.md)

1. **Standards hierarchy:** API 570 (5th ed.) governs in-service inspection/corrosion/remaining life; API 574 (5th ed., 2024 §10 & Annex D) governs required thickness/Barlow/structural minimums; ASME B31.3-2024 governs design formula and weld NDE acceptance (MT §344.3.2, PT §344.4.2). All formulas/coefficients/acceptance rules load from `lib/criteria/*.json` — **LLMs never do arithmetic or invent citations**; arithmetic lives in pure TS under `lib/calc/`. Phase 3 must not modify `lib/criteria/`.
2. **PDFs:** never file-view `.pdf`; use `pypdf` via scratch scripts with UTF-8 output (only relevant if prompt work consults standards PDFs).
3. **Windows scripting:** no complex multiline inline Python in PowerShell; scripts to `scratch/`, force UTF-8, sanitize Unicode (−, ', °).

Additional standing repo invariants that bind this phase (verified in-repo):
- `lib/calc` must never import `lib/llm` (forbidden-import lint, Phase 2) — keep the reasoning modules OUTSIDE `lib/calc/`.
- Hardcoded model IDs forbidden in source: `grep -rn "nvidia/" app/ lib/ scripts/ tests/ instrumentation.ts` must stay zero (01-RESEARCH.md Pattern 1). A pricing table keyed by model-ID literals in `.ts` would violate this — see Pitfall 7.
- Every package install requires explicit user approval; Phase 3 adds **zero** packages (03-UI-SPEC Registry Safety).
- Verbatim-text rule: "Reports and UI copy **must not reproduce verbatim text from API 570, API 574, or ASME B31.3**. UI can cite clause numbers (e.g. `API 570 §6.3.3`) and describe their meaning in plain English, but cannot quote paragraphs." [VERIFIED: docs/flowstep-handoff.md:430-434]

## Summary

Phase 3 composes two LLM calls around Phase 2's already-deterministic verdicts. **The key architectural realization: almost nothing the narrative needs is missing from the repo.** `ReadingResult` (lib/ingest/session.ts:107-143) already carries every chain number (t-actual, t-pressure, t-structural, t-required, CR_LT/ST/governing, RL, flags, verdict, citations[]); `PtmIndicationResult` carries per-indication verdict + engine detail + clause ID; `lib/criteria/citations.json` carries the 15-entry allowlist with display fields (code, clause, title, edition, scope_note, verified). Lightning's extraction therefore has exactly ONE genuine job: structure the only unstructured inputs — the free-text PT/MT notes and component/service context — into a small Zod-validated "evaluation context pack" that is computed **once per evaluation** and shared by every pane. Per-reading LLM structuring would be 50× the cost and double the per-pane latency for zero benefit.

Super-120B then narrates per opened pane: the route handler builds a prompt whose ONLY numeric surface is a JSON block of precomputed values (reading chain + criteria thresholds + indication dims), mandates a `[[cite:<id>]]`-only citation grammar and an exact final `Verdict: ACCEPT|RE-CHECK|FAIL.` line, and streams through a typed-SSE route modeled on the proven `app/api/spike/stream/route.ts` (abort propagation, closed-guard, error-frame-then-DONE). Two server-side lints (numeric-consistency against the injected value set; verdict-agreement against the engine verdict) plus the renderer-side allowlist gate reject bad output into the deterministic fallback, which itself is a cited, templated paragraph built purely from `ReadingResult` — shippable and demo-able with the LLM disabled.

The one genuine design tension is UI-29 ("narrative text renders incrementally") vs UI-42 ("rejected text never partially renders"): lints are only fully decidable at stream completion. The recommended resolution is streaming with a **sentence-level incremental numeric guard** (contradictions are caught within one sentence of appearing) and a final verdict guard, with the client swapping the pane to the fallback state on a `rejected` frame — plus a planner checkpoint if the strict buffer-then-serve reading is preferred. Cost is a non-issue at verified catalog prices: a worst-case judging session (extraction + 50 panes streamed) costs ≈ **$0.044**, i.e. ~570 such sessions inside the $25 budget.

**Primary recommendation:** Build `lib/reasoning/` (pure: schemas, prompt builders, tokenizer, lints, fallback template — all vitest-offline-testable) + two route handlers (`/api/reasoning/extract` non-streaming via `runValidatedCompletion`; `/api/reasoning/narrative` streaming via typed SSE frames), a client `useNarrativeStream` hook with per-rowKey abort + `evaluatedAt`-keyed session cache, and three hand-rolled components (`ReasoningPane`, `CitationChip`, `PipelineStatusBar`) per 03-UI-SPEC. Zero new packages.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Extraction (notes/context → Zod JSON) | API/Backend (`app/api/reasoning/extract/route.ts` + `lib/reasoning/*`) | — | API key server-only; Zod runs server-side before anything reaches the client |
| Narrative generation + lints | API/Backend (`app/api/reasoning/narrative/route.ts`) | — | Lints must gate text before/while serving; usage metadata captured at the gateway hop |
| Citation token resolution + chip rendering | Browser (`lib/reasoning/tokenizer` + `components/wizard/citation-chip`) | — | Renderer-enforced allowlist is a display-time guarantee (SC3); must also run for the deterministic fallback |
| Reasoning chain (inputs → clause → limit → verdict) | Browser (pure render from `ReadingResult`) | — | UI-26: chain is visible in every state including error/fallback — never an LLM product |
| Session narrative cache + concurrency guard | Browser (React state/ref keyed by `evaluatedAt`) | — | Session lives in the wizard reducer; serverless functions are stateless by design |
| Pipeline status metrics (tokens/latency/model) | API → Browser | Browser aggregation | Tokens from gateway usage frames; latency measured server-side; client only aggregates + renders |
| Fallback narrative | API/Backend (`lib/reasoning/fallback.ts` — pure) | Browser renders it | Must work with LLM disabled; generated deterministically from `ReadingResult`, cited, rendered through the same chip pipeline |

## Standard Stack

**Zero new packages.** Everything below is already installed and verified in Phase 1/2 (package.json verified this session): `next` ^16.3.6, `react` ^19.3.0, `zod` ^4.6.5, `openai` ^7.23.0, `vitest` ^5.0.2, `typescript` ^5.9.3. The UI adds three hand-rolled local components (no radix/shadcn — 03-UI-SPEC Design System table).

### Core (all in-repo, verified this session)

| Asset | Location | Purpose in Phase 3 |
|-------|----------|--------------------|
| `runValidatedCompletion` | `lib/llm/complete.ts:15-64` | Extraction call contract: `json_object` → Zod → exactly one bounded retry **with assistant-turn replay** (the model sees its own bad output before the correction, WR-02). `reasoningEffort` union is `"low" \| "medium" \| "high"` [VERIFIED: lib/llm/complete.ts:12 — "low\|medium\|high ONLY (verified 2026-09-26) — anything wider 422s"] |
| `getClient()` | `lib/llm/client.ts:6-12` | Single server-side seam for the OpenAI client + API key |
| Model accessors | `lib/llm/config.ts:19-25` | `getReasoningModel()` / `getExtractionModel()` — env-only, throws naming the missing var; feeds runtime-resolved model badges (PLAT-05) |
| SSE route pattern | `app/api/spike/stream/route.ts:1-93` | The exact pattern to clone: `runtime = "nodejs"`, parse-boundary validation before paid calls, `req.signal` abort propagation, closed-guard around every enqueue/close, mid-stream error frame then `data: [DONE]` |
| `ReadingResult` / `EvaluationSession` | `lib/ingest/session.ts:69-143` | The narrative's ONLY numeric source. Verbatim field names [VERIFIED: lib/ingest/session.ts:107-143]: `readingId`, `location`, `cml?`, `date`, `tActualMm`, `tPressureMm`, `tStructuralMm`, `tRequiredMm`, `crLtMmYr`, `crStMmYr`, `rawCrLtMmYr`, `rawCrStMmYr`, `crGoverningMmYr`, `rlYears`, `nextInspection`, `flags`, `outlier?`, `verdict`, `citations`. Verdict union [VERIFIED: lib/ingest/session.ts:13]: `export type Verdict = "accept" \| "re_check" \| "reject";` Flag union [VERIFIED: lib/ingest/session.ts:101-105]: `"outlier" \| "measurement_inconsistency" \| "insufficient_history" \| "immediate_inspection"` |
| `PtmIndicationResult` | `lib/ingest/session.ts:145-149` | `{ ...PtmIndication, verdict, detail, citationId }` — the PT/MT narrative slice |
| Citation allowlist | `lib/criteria/citations.json` (15 entries) | Sole resolution source. Verbatim IDs [VERIFIED: lib/criteria/citations.json:3,14,24,34,45,56,69,81,93,104,115,126,137,148,159]: `asme_b31_3_304_1_2`, `api574_10_5_1_2`, `api574_10_5_1_3`, `api574_10_5_1_4`, `api574_annex_d`, `api570_7_6`, `api570_7_1_2_lt`, `api570_7_1_2_st`, `api570_7_1_2_governing`, `api570_7_2`, `api570_6_3_3_halflife`, `api570_table1`, `api570_6_3_4`, `asme_b31_3_344_3_2`, `asme_b31_3_344_4_2`. Each record carries `code`, `edition`, `clause`, `title`, `scope_note`, `verified` — chip labels render ONLY from these fields (UI-34) |
| `citationIdExists()` / `criteria` | `lib/calc/criteria.ts:13-23` | Typed import point for criteria JSONs; `criteria.ptmt` exposes the loaded thresholds for the PT/MT narrative slice |
| `VerdictChip` / `flagChipFor` | `components/wizard/verdict-chip.tsx:11-24,53-55` | Reused as-is. Chip labels [VERIFIED: components/wizard/verdict-chip.tsx:11-24]: `accept → "ACCEPT"`, `re_check → "RE-CHECK"`, `reject → "FAIL"` — the verdict-agreement lint must use exactly these strings |
| `resultRowKey(readingId, index)` | `components/wizard/results-table.tsx:36-38` | `` `${readingId}-${index}` `` — WR-04 duplicate-reading-ID namespacing; pane DOM ids are `reasoning-${rowKey}` (UI-SPEC) |
| `formatFixed(value, dp)` | `lib/wizard/format.ts:13-16` | `null`/non-finite → `"—"`, else `toFixed(dp)`. Use THE SAME formatter in prompt payload, chain render, and fallback so narrative numbers match display byte-for-byte |
| `verdictBand()` boundary semantics | `lib/calc/verdicts.ts:21-32` | `t_actual < t_required → reject; < t_required + unc → re_check; else accept` — the LIMIT segment and fallback prose must restate these comparisons, never re-derive them |

### Supporting (external API facts, verified today)

| Fact | Value | Provenance |
|------|-------|------------|
| Streaming usage metadata | `stream_options: { include_usage: true }` returns the Usage object in the **last SSE chunk** (fields `prompt_tokens`, `completion_tokens`, `total_tokens`) — the final chunk may carry empty `choices` | [VERIFIED: docs.tokenfactory.nebius.com/api-reference/inference/create-chat-completion.md — fetched 2026-09-27: "the fields `prompt_tokens`, `completion_tokens`, and `total_tokens` are provided"; non-streaming responses carry the same `usage` object] |
| `max_completion_tokens` semantics | "upper bound for the number of visible output tokens and reasoning tokens" — reasoning traces are billed inside it | [VERIFIED: same spec page, fetched 2026-09-27] |
| `reasoning_effort` | Enum `low \| medium \| high` only (matches the in-code union) | [VERIFIED: same spec page + lib/llm/complete.ts:12] |
| `response_format` | Enum contains `json_schema`; the Phase 1 spike proved it is **accepted live on BOTH routed models** — but production calls stay on the documented `json_object` + Zod + bounded-retry contract per the locked decision | [VERIFIED: docs/spike-record.md:23-40; enum on the spec page] |
| Rate limits | Token Bucket: per-request limits, "Model tokens limit — counted against the total number of tokens (input + output) submitted in a given minute", plus a client-level token limit | [CITED: docs.tokenfactory.nebius.com/ai-models-inference/rate-limits.md — fetched 2026-09-27] |
| Prices (catalog) | Super-120B $0.30/$0.90 per 1M in/out; Lightning $0.06/$0.24 | [VERIFIED: tokenfactory.nebius.com/model-catalog.md as recorded in .planning/research/STACK.md (verified 2026-09-24) and re-verified in 01-RESEARCH.md (2026-09-26)] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Batch extraction once per evaluation | Per-pane extraction (row + metadata → JSON → narrative) | 50× extraction cost (~$0.01 vs ~$0.0002), doubles per-pane TTFB, and breaks UI-41's screen-level extraction banner (a per-pane failure could not raise one banner). Batch wins decisively. |
| `json_schema` response_format for extraction | `json_object` + Zod (locked contract) | `json_schema` verified working live (spike record), but undocumented → can change without notice; the locked decision names `runValidatedCompletion`. Optionally record a follow-up probe; do not switch the default. |
| Vercel AI SDK `useChat` for the client stream | Plain `fetch` + `ReadableStream` reader (Phase 1 pattern) | New package (forbidden without checkpoint); typed custom SSE frames carry usage/lints/fallback — `useChat`'s message protocol doesn't. Keep Phase 1 pattern. |
| Client-side numeric lint | Server-side lints (recommended) | Client lint alone would let contradicted text reach the DOM first; server lints + a `rejected` frame keep one enforcement point and match "before they reach the client" (UI-SPEC verbatim-guard wording). |

**Installation:** none — `npm install` is forbidden this phase without an explicit user checkpoint.

## Package Legitimacy Audit

> Gate not run: this phase installs **zero** external packages (03-UI-SPEC Registry Safety; CONTEXT locked "Phase 3 adds zero packages"). All dependencies were legitimacy-gated in Phase 1 (01-RESEARCH.md §Package Legitimacy Audit) and remain pinned in package.json.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none new) | — | — | — | — | — | No installs this phase |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 [Browser — Screen 3]
   run-evaluation completes (reducer sets results + evaluatedAt)
        |
        |-- POST /api/reasoning/extract            (automatic, once per evaluation)
        |      body: { metadata, ptmtNotes, indications, populationDigest }
        |      -> runValidatedCompletion (Lightning, json_object -> Zod -> 1 retry)
        |      <- 200 { extraction, usage{prompt,completion,latencyMs,model} }
        |           |failure -> 4xx/5xx {error} => screen banner (UI-41) + panes error on open
        v
   [Pipeline status bar]  Extraction: pending -> running -> complete/FAILED
   [Results table 11 cols] [PT/MT cards]
        |
        |-- user clicks "View reasoning" on row N (first open only)
        |-- POST /api/reasoning/narrative           (lazy, per pane, abortable)
        |      body: { reading | indication, metadata, extraction, criteriaSlice }
        |      Zod-validated (V5) -> disabled? -> {type:"fallback"} frame immediately
        |      -> Super-120B stream:true + stream_options.include_usage
        |      <- typed SSE frames:
        |            {"type":"meta","model":"<env-resolved>"}
        |            {"type":"delta","text":"..."}            (incremental narrative)
        |            {"type":"usage","promptTokens":n,"completionTokens":n,"latencyMs":ms}
        |            {"type":"rejected","reason":"numeric_lint|verdict_lint|citation_lint|verbatim_lint","fallback":"<deterministic text>"}
        |            {"type":"error","message":"..."}
        |            data: [DONE]
        |      server lints: sentence-level numeric guard mid-stream + verdict-agreement
        |      + citation-allowlist + verbatim-ngram at completion
        v
   [ReasoningPane]  chain (deterministic) | narrative segments | CitationChips
        |              tokenizer: [[cite:<id>]] -> resolved | unresolved (zero glyphs + audit stamp)
        |-- completed narrative cached client-side, key = evaluatedAt::kind::id
        |-- re-evaluation -> new evaluatedAt -> cache cold, panes closed, status bar pending (UI-45)
```

### Recommended Project Structure (delta on existing tree)

```
lib/
├── reasoning/                    # NEW — pure, offline-testable; NEVER imported by lib/calc
│   ├── schemas.ts                # ExtractionResultSchema, NarrativeRequestSchema, SSE frame schemas
│   ├── narrative-context.ts      # builds the precomputed-values payload + numeric allowlist from ReadingResult/metadata/criteria
│   ├── prompts.ts                # system/user prompt skeletons (extraction + narrative), schemaHint strings
│   ├── tokenizer.ts              # [[cite:<id>]] segmentation (text | cite-resolved | cite-unresolved | incomplete)
│   ├── lints.ts                  # numeric-consistency, verdict-agreement, citation-allowlist, verbatim-ngram
│   └── fallback.ts               # deterministic cited narrative from ReadingResult + metadata
├── llm/                          # EXISTING — unchanged (config, client, complete, validate-config, schemas)
├── calc/                         # EXISTING — DO NOT MODIFY; must never import lib/llm or lib/reasoning
└── criteria/                     # EXISTING — DO NOT MODIFY (builder-vetted ground truth)
app/api/reasoning/
├── extract/route.ts              # NEW — POST, non-streaming, runValidatedCompletion
└── narrative/route.ts            # NEW — POST, streaming typed SSE (clone spike route guards)
components/wizard/
├── reasoning-pane.tsx            # NEW — chain + narrative regions, 5 states (UI-SPEC)
├── citation-chip.tsx             # NEW — resolved chip + inline detail; unresolved = zero glyphs
└── pipeline-status-bar.tsx       # NEW — Extraction/Narrative rows, badges + metrics
lib/wizard/ or hooks/
└── use-narrative-stream.ts       # NEW — fetch reader, chunk-boundary buffer, abort map, session cache
tests/reasoning/                  # NEW — offline tokenizer/lint/fallback/context tests + skipIf live e2e
```

### Pattern R1: Extraction = one batched "evaluation context pack" per evaluation

**What:** A single Lightning call that structures the only unstructured inputs the narrative needs: the free-text PT/MT notes, component/service context, and a compact population digest. Its output is cached for the whole session and injected into every pane's narrative prompt.

**Why batch (locked cost discipline + UI-41):** per-row extraction would cost ~50× more (math below), double per-pane TTFB, and a per-row failure could never raise the single screen-level extraction banner UI-41 requires. The reading rows themselves are already structured (`ReadingResult`) — re-extracting them with an LLM would add a numeric-drift surface for zero value.

**Schema (Zod, `lib/reasoning/schemas.ts`) — output shape:**

```ts
// ExtractionResultSchema — LLM-worded glue ONLY; every number stays in code.
export const ExtractionResultSchema = z.object({
  componentContext: z.object({
    serviceDescription: z.string().min(1).max(600), // plain-language component + service, from metadata + notes
    notableFacts: z.array(z.string().max(200)).max(5), // qualitative facts; prompt forbids digits
  }),
  ptmtNotesSummary: z.object({
    relevant: z.boolean(),
    points: z.array(z.string().max(200)).max(5),   // distilled inspector-note points, no digits
  }).nullable(),                                    // null when notes empty
  cautions: z.array(z.string().max(200)).max(5),    // e.g. crack-suspect escalation wording
});
```

**Request slice (what the client POSTs):** `metadata: ComponentMetadata`, `notes: string`, `indications: PtmIndication[]`, and a deterministic population digest the CLIENT computes (counts by verdict, location count, date range, units) — all already in `EvaluationSession`/`EvaluationResults`. Zod-validated with `.strict()` at the route (ASVS V5).

**Token + cost estimate (catalog prices, arithmetic shown):**
- Input ≈ system 300 + metadata 250 + notes 300 + indications 150 + digest 150 + criteria framing 250 ≈ **1.4K tokens**
- Output ≈ **350 tokens**
- Cost = (1,400/1,000,000 × $0.06) + (350/1,000,000 × $0.24) = $0.000084 + $0.000084 ≈ **$0.0002 per evaluation**
- Per-row alternative (50 panes): 50 × (1.3K in + 0.5K out) = 65K in + 25K out → (65,000/1M × $0.06) + (25,000/1M × $0.24) = $0.0039 + $0.0060 ≈ **$0.0099** — ~50× the batch cost, plus +1 full Lightning RTT of latency before each pane's narrative can even start.

**Failure path:** `runValidatedCompletion` throws after its one retry → route returns 502 `{error}` → client sets `extractionFailed` → `role="alert"` banner (UI-41 copy verbatim from 03-UI-SPEC Copywriting table), Extraction step shows `FAILED`, panes render error state on open, computed table columns unaffected. Narration never starts (SC1).

### Pattern R2: Narrative prompt contract (Super-120B)

**Input blocks (all deterministic code, no LLM):** (1) system rules; (2) `PRECOMPUTED VALUES` — the reading chain (same fields, same `formatFixed` precision the table shows), history values (t-initial/t-previous/Δt from the grouping seam — inject only if the narrative should mention them; recommended: yes, they explain CR), metadata numerics (gauge uncertainty, design pressure, allowable stress), PT/MT thresholds loaded from `criteria.ptmt` (relevance threshold, rounded max, cluster count/separation), indication dims + engine verdict/detail; (3) `ALLOWED CITATIONS` — the reading's `citations[]` (or indication's `citationId`) with `code + clause + title` from citations.json; (4) `EVALUATION CONTEXT` — the extraction pack; (5) output contract.

**System prompt skeleton (wording is Claude's discretion; structure is the contract):**

```
You are the narration step of a pipe-thickness acceptance pipeline.
The verdict and every number were computed in code. You explain; you never calculate.

Rules:
1. State ONLY numbers that appear verbatim in PRECOMPUTED VALUES, with their units.
   Never derive, round, convert, or invent any number. Do not state dates.
2. Follow the chain in order: measured inputs -> governing clause (code + clause
   number) -> the limit -> the verdict.
3. Cite by emitting [[cite:<citation_id>]] using ONLY ids from ALLOWED CITATIONS.
   Cite each claim once. Paraphrase clause meaning; NEVER quote standard text.
4. End with exactly one final line: "Verdict: ACCEPT." or "Verdict: RE-CHECK." or
   "Verdict: FAIL." — matching VERDICT below, spelled exactly.
5. 120–180 words of plain prose. No markdown, headings, or lists. No preamble.
```

**Constraining the model to precomputed numbers (three layers):**
1. *Prompt:* only the injected JSON block contains numbers; rule 1 + "do not restate classification rules" keep criteria ratios out of the prose where they aren't injected (inject PT/MT thresholds deliberately — they ARE repo-vetted values).
2. *Lint:* numeric-consistency rejects anything else (Pattern R6).
3. *Renderer:* citations render only from citations.json regardless of prose.

**`reasoning_effort` recommendation: `"low"` + `max_completion_tokens: 1200`.** The narrative is constrained paraphrase — the model never computes, so deep reasoning buys nothing; reasoning traces delay the first visible token (the demo-sensitive TTFB) and bill at the 3× output price inside `max_completion_tokens` [VERIFIED spec semantics]. ~300 narrative tokens + low-effort reasoning fits 1200 with headroom. If the live fixture test shows thin narratives, bump to `"medium"`: worst case 50 panes ≈ (55K in × $0.30/1M) + (45K out × $0.90/1M) ≈ $0.057 — still trivial. Note `reasoning_effort: "none"` does not exist (422).

**Per-pane cost (shown):** input ≈ 1.1K (system 250 + values 350 + citations ~120 + extraction 200 + contract 150); output ≈ 600 (narrative ~300 + reasoning). Per pane = (1,100/1M × $0.30) + (600/1M × $0.90) = $0.00033 + $0.00054 ≈ **$0.00087**.

### Pattern R3: Citation token pipeline (tokenizer → renderer → chips)

**Grammar:** `[[cite:<id>]]` with `<id>` constrained to `[a-z0-9_]+` (all 15 allowlist IDs match — see verbatim list above). One regex: `/\[\[cite:([a-z0-9_]+)\]\]/g`.

**Tokenizer (pure, `lib/reasoning/tokenizer.ts`) — segment model:**

```ts
export type Segment =
  | { kind: "text"; value: string }
  | { kind: "cite"; id: string; resolved: boolean }   // resolved against citations.json
  | { kind: "incomplete" };                            // unterminated "[[cite:..." — strip + audit
export function tokenize(narrative: string): Segment[];
```

**Edge cases (each is a named test):**
- **Unknown ID** (not in citations.json): segment `{kind:"cite", resolved:false}` → renderer emits **zero glyphs** (UI-35); the pane collects the ID for the amber audit stamp `Unresolved citation blocked: '{id}' — rendered blank (audit {HH:mm:ss}).` and the footnote counter `Citation audit: {n} unresolved citation(s) blocked at renderer.`
- **Well-formed-but-wrong-context ID** (exists in the allowlist but unrelated to this reading): UI-34's letter resolves against the full allowlist, so it renders a real chip. Recommended tightening: the prompt only lists the reading's citations, AND a lint hard-rejects any cited ID outside `reading.citations ∪ evaluation citationsUsed` — a plausible-but-irrelevant clause chip is exactly the credibility failure SC3 exists to prevent. If live testing shows over-rejection, downgrade to an audit-stamp warning (planner's call — see Open Questions).
- **Token inside/adjacent to a number** (`4.20[[cite:api570_7_2]] mm`): tokenizer just segments; the numeric lint strips tokens BEFORE scanning digits so the chip position can't corrupt matching. Prompt asks for a space before the token for clean prose.
- **Unclosed token** (`[[cite:api570_7_2` — typically `finish_reason: "length"` truncation): tokenizer emits `{kind:"incomplete"}` → stripped, counted as unresolved for the audit stamp. The truncated narrative will also fail verdict-agreement (no final line) → fallback. Both paths converge: truncated output never reaches the reader as machinery text.
- **Resolution source:** `lib/calc/criteria.ts:21-23` already exports `citationIdExists(id)`; the renderer resolves records via `criteria.citations`. Keep the renderer module pure (plain segment data + resolved records) so Phase 4's PDF can reuse it (CONTEXT integration point).

**Chunk-boundary safety (client buffer):** SSE deltas can split `[[cite:api` across frames. Since narratives are ~1.5 KB, re-tokenize the accumulator each frame and hold back a trailing partial open:

```ts
// hold back an unterminated "[[cite:…" tail so machinery never flashes
const safeForRender = (acc: string) => acc.replace(/\[\[cite:[a-z0-9_]*$/, "");
```

On `done`, render the full accumulator; any residual partial becomes `incomplete` → stripped + audit. Server-side lints run only on complete sentences / the completed text — partial tokens never reach them.

### Pattern R4: Deterministic fallback narrative (ships FIRST)

**What:** a pure function `fallbackNarrative(reading, metadata): string` restating inputs → clause → limit → verdict as prose, cited with `[[cite:<id>]]` tokens chosen **only from `reading.citations[]`** (engine-emitted, therefore always resolvable), ending with the locked closing sentence. CONTEXT: "the fallback narrative must be genuinely usable — an inspector reading only the fallback still gets a defensible, cited rationale."

**Template shape (prose at Claude's discretion; structure locked by the pane contract):** conditionally assembled per available data — pressure/structural branches per `citations` membership, rates only when non-null (`insufficient_history` wording for null), `immediate_inspection` per the G14 flag, gauge-uncertainty band restated via the locked comparison order from `lib/calc/verdicts.ts:29-31`. Always ends: `Verdict: {ACCEPT|RE-CHECK|FAIL}. All verdicts are computed in code and unaffected.` (the final sentence is UI-33's locked copy; the Verdict line means the fallback satisfies the same verdict-agreement lint — a testable symmetry).

**Activation conditions (mutually exclusive with the error state, per UI-SPEC):**
1. LLM layer disabled/absent — missing `NEBIUS_API_KEY`, degraded `/api/health` result, or an explicit kill-switch env (proposed `FLAWCHECK_DISABLE_LLM=1` [ASSUMED name — planner may prefer reusing the health result alone]).
2. Narrative upstream failure after SDK retries, or a server-side timeout (proposed `AbortSignal.timeout(30_000)` around the upstream call [ASSUMED value]).
3. Any lint rejection → server emits `{type:"rejected", reason, fallback}` and the client swaps to the fallback pane state (UI-42, UI-33).

**Not** for extraction failure — that is the loud banner + per-pane error state (UI-41), because narration without structured context is exactly the garbage-in failure SC1 forbids.

**UI distinguishing (locked):** `DETERMINISTIC FALLBACK` chip + metrics `— · — · —` — never fabricated usage numbers (UI-33). The fallback flows through the SAME tokenizer/chip pipeline, which conveniently exercises the citation renderer without any LLM.

### Pattern R5: Streaming, caching, concurrency

**Route skeleton (`app/api/reasoning/narrative/route.ts`)** — clone the spike route's guards verbatim: `runtime = "nodejs"`, Zod body validation before any paid call, `req.signal` wired into `client.chat.completions.create(..., { signal })` so a browser disconnect aborts the paid upstream call (credit-burn guard), closed-guard around every enqueue, mid-stream error frame then `data: [DONE]`. Add: `stream_options: { include_usage: true }` → emit a `usage` frame from the final chunk; server-side latency measured around the upstream call (tokens come from gateway usage; latency is "not client timing" per UI-SPEC).

**Client hook (`use-narrative-stream.ts`):**
- State per pane: `loading → streaming → complete | error | fallback` (UI-SPEC state machine).
- **Cache:** module/context-level `Map<`${evaluatedAt}::${kind}::${id}`, NarrativeEntry>` where `kind ∈ {"cml","ptmt"}` and `id` is the reading's `resultRowKey`-namespaced key or the indication id. `evaluatedAt` is set fresh by `run-evaluation` (lib/wizard/reducer.ts:814 `evaluatedAt: new Date().toISOString()`) → every re-run invalidates all entries automatically (UI-45); `reset` action clears the map. Re-opening a completed pane renders from cache with **no request** (UI-31).
- **Concurrency:** one AbortController per pane key, stored in a ref map; `Retry` aborts that pane's prior stream; panes are independent (multiple may stream at once per UI-SPEC). Recommend a small client-side FIFO queue capping concurrent narrative requests at ~3 [ASSUMED] to smooth TTFB under the Token Bucket limits (rate-limits page: request + model-tokens + client-tokens per-minute buckets) — correctness-neutral, drop it if it complicates Retry semantics.
- **Aggregate metrics:** the status bar's Narrative row sums `promptTokens/completionTokens/latencyMs` across completed panes in the session; Extraction row shows the extraction call's usage. Cost rendering — see Pitfall 7.

**Server-side vs client-side split (summary):** server = prompt building, all LLM I/O, lints, usage capture, fallback generation; client = chain rendering (deterministic), token buffering, chip resolution (pure functions, browser-safe), cache, aggregation. The server never needs session state — the client sends the (small, typed) per-pane payload; serverless functions stay stateless.

### Pattern R6: Lints (server-side, `lib/reasoning/lints.ts`)

**1. numeric-consistency.** Build the allowed set from the SAME object injected into the prompt (single source — `narrative-context.ts` returns `{payload, allowedNumbers}` together, so drift is impossible by construction):

```ts
// allowed = raw value (6dp) ∪ 1dp/2dp/3dp display variants of every injected number
// scan: strip [[cite:...]] tokens, strip code designators, extract literals, all must match
const stripped = text
  .replace(/\[\[cite:[a-z0-9_]+\]\]/g, " ")
  .replace(/ASME B31\.3|API 570|API 574|B31\.3/g, " "); // "B31.3" would scan as 31.3 and 3!
const literals = stripped.match(/-?\d+(?:\.\d+)?/g) ?? [];
const ok = literals.every((l) => allowed.has(roundTo(parseFloat(l), 6)));
```

The designator strip is mandatory — "ASME B31.3" contains 31.3 and 3, neither of which is a precomputed chain value; without it every narrative mentioning the code name fails. Allowlist policy [ASSUMED, tunable]: raw 6-dp value plus 1/2/3-dp roundings of each injected number, so "4.2" matches t-required 4.19834→4.20 but "4.198" does not (the model was told to use supplied values verbatim). Incremental variant: run the same scan on each completed sentence during streaming for reject-as-soon-as-detected.

**2. verdict-agreement.** The prompt mandates exactly one final line. Lint: `text.match(/Verdict:\s*(ACCEPT|RE-CHECK|FAIL)\.?\s*$/m)` must match exactly once and the captured label must equal `VerdictChip`'s mapping for `reading.verdict` (`accept→ACCEPT`, `re_check→RE-CHECK`, `reject→FAIL` — verbatim labels verified at components/wizard/verdict-chip.tsx:11-24). Missing/extra/mismatched → reject.

**3. citation-allowlist (server supplement to the renderer gate).** Every `[[cite:id]]` ID must satisfy `citationIdExists()` — reject (the renderer would blank it anyway; the lint keeps known-bad narratives from being served at all). Plus the wrong-context tightening from Pattern R3.

**4. verbatim-text guard (cite-don't-quote).** Grounded rule [VERIFIED: docs/flowstep-handoff.md:430-434]: no verbatim standard text; paraphrase only. Practical implementation: 8-word n-gram overlap check of the narrative against `title`+`scope_note` strings in citations.json (the only standard-derived text in the repo) → reject on any hit. Honest scope note: this catches parroting of repo-held criteria text and gross quoting; it cannot prove absence of memorized standard paragraphs — the real defense is the short-length prompt contract plus human review of the live fixture output.

**Rejection handling:** server stops relaying (mid-stream case), emits `{type:"rejected", reason, fallback}`, logs `console.warn` with reason + reading id (the "audit event"), and the client renders the fallback pane state. Rejected model text is discarded, never stored in cache.

### Pattern R7: Pipeline status bar data

| Step | Source of truth |
|------|-----------------|
| Extraction | `/api/reasoning/extract` 200 body: `{usage:{promptTokens, completionTokens, latencyMs, model}}` — non-streaming `res.usage` + server-side timer; model badge = env-resolved `NEBIUS_MODEL_EXTRACTION` at call time |
| Narrative | aggregated `usage` frames across the session's completed panes; model badge = env-resolved `NEBIUS_MODEL_REASONING`; `DETERMINISTIC FALLBACK` chip replaces badge when the fallback path served narratives |
| States | `pending` on Screen-3 arrival → `running…` → complete / `FAILED` / fallback chip (UI-40); FAILED on Extraction additionally raises the UI-41 banner |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OpenAI-compatible SSE + abort + retries | Custom fetch/EventSource parsing to Token Factory | `openai` SDK stream (`for await`) + Phase 1 route pattern | SDK handles SSE framing, `[DONE]`, typed errors, 429 backoff; the spike route already proves the relay pattern |
| JSON retry-on-invalid | Ad-hoc retry at the extraction call site | `runValidatedCompletion` (lib/llm/complete.ts) | One bounded retry with assistant-turn replay is a locked contract (PLAT-02, WR-02) — single tested implementation |
| Citation ID existence check | A new resolver/lookup table | `citationIdExists()` + `criteria.citations` (lib/calc/criteria.ts) | The typed import point already exists; a second list would drift from citations.json |
| Chain + fallback numbers | Any recomputation or reformatting logic beyond `formatFixed` | `ReadingResult` fields + `lib/wizard/format.ts` | The engine already computed everything; recomputing risks narrative-vs-table mismatch (UI-27 requires byte-equal values) |
| Number formatting variants | Custom rounding in prompts | `formatFixed` + `roundTo` (lib/calc/round.ts) | Same formatters in payload, chain, and fallback keep the lint allowlist and display in lockstep |
| Verdict label mapping | A second accept/reject enum | `VerdictChip`'s mapping (or import the type + map once in lints) | The lint must match the exact rendered labels — one mapping, one test |

**Key insight:** the product's credibility rests on the LLM touching as little as possible. Every number, verdict, citation, and threshold already exists in repo-vetted form; the LLM's entire job is gluing them into prose — so the architecture should make the glue cheap, replaceable (fallback), and policed (lints + renderer).

## Common Pitfalls

### Pitfall 1: "ASME B31.3" breaks numeric-consistency
**What goes wrong:** the literal code name contains 31.3 and 3; a naive digit scan rejects every narrative that names the code — 100% fallback rate in the demo.
**Why:** regex number extraction has no notion of code designators.
**How to avoid:** strip the fixed designator strings (`ASME B31.3`, `API 570`, `API 574`, `B31.3`) before scanning (Pattern R6); test this case explicitly.
**Warning signs:** all live narratives rejected with `numeric_lint`.

### Pitfall 2: Streaming vs "rejected text never partially renders" (UI-29 vs UI-42)
**What goes wrong:** full lints are decidable only at stream end; naive pass-through shows contradicted text that must then vanish, violating UI-42's letter.
**Why:** streaming and post-hoc rejection pull in opposite directions.
**How to avoid:** sentence-level incremental numeric guard mid-stream + final verdict/verbatim lints; on rejection send the `rejected` frame + fallback and swap the pane. Surface the residual tension to the planner (Open Question 1) — the strict alternative (buffer everything, lose streaming) contradicts locked UI-29 instead.
**Warning signs:** planner writes a task that streams raw deltas without a server-side guard, or one that buffers silently for 10+ seconds.

### Pitfall 3: `finish_reason: "length"` produces machinery text
**What goes wrong:** a truncated narrative ends mid `[[cite:api` and the raw token would render as visible text.
**Why:** `max_completion_tokens` bounds reasoning + visible output; low caps can truncate.
**How to avoid:** `incomplete` segment handling (strip + audit stamp) AND the verdict lint (missing final line → fallback). Keep `max_completion_tokens: 1200` so truncation is rare.
**Warning signs:** `[[cite:` fragments in the pane; rejected-reason `verdict_lint` spike.

### Pitfall 4: Dates and ratio language trip the number lint
**What goes wrong:** "measured 2026-09-15" extracts 2026/9/15; "3× the width" injects a rule constant — both reject.
**Why:** allowlist contains only injected chain values.
**How to avoid:** prompt forbids dates and restating classification rules; inject PT/MT thresholds deliberately (they are repo-vetted values) so legitimate limit-mentioning passes.
**Warning signs:** fallback rate rises on PT/MT panes specifically.

### Pitfall 5: Extraction failures reaching narration
**What goes wrong:** narrative calls proceed with a missing/malformed extraction pack → generic prose with hallucinated context.
**Why:** client fires pane streams before extraction resolves.
**How to avoid:** narrative route Zod-requires the extraction pack (reject 422 without it); client gates pane requests on extraction success; failure = banner + pane error states (UI-41), never fallback-for-narration.
**Warning signs:** narratives with no extraction-derived context; 422s in the console.

### Pitfall 6: Cache survives re-evaluation
**What goes wrong:** stale narratives shown for new verdicts after re-running the evaluation — a credibility-destroying mismatch.
**Why:** module-level caches outlive React state.
**How to avoid:** key every cache entry by `evaluatedAt` (fresh ISO on every `run-evaluation`, reducer.ts:814); re-run closes panes and resets the status bar (UI-45); `reset` clears the map.
**Warning signs:** pane text contradicting the freshly rendered verdict chip.

### Pitfall 7: Cost display vs the hardcoded-ID grep gate
**What goes wrong:** a pricing map keyed by `nvidia/...` IDs in `.ts` fails the Phase 1 invariant grep (`grep -rn "nvidia/" app/ lib/ scripts/ tests/ instrumentation.ts` must be zero); conversely the Token Factory API returns tokens, never dollars.
**Why:** UI-SPEC says cost comes from the LLM layer and the UI never computes or estimates it.
**How to avoid:** default the cost field to `—` (spec-compliant), and optionally let the builder supply per-model prices via env vars (e.g. `NEBIUS_PRICE_REASONING_IN/OUT`, `NEBIUS_PRICE_EXTRACTION_IN/OUT`) read in `lib/llm/config.ts` so the status bar can show real dollars after a catalog check [ASSUMED env names]. Decide in planning (Open Question 2).
**Warning signs:** any model-ID literal added to source; cost rendering invented client-side.

### Pitfall 8: Forgetting lib/calc purity
**What goes wrong:** importing `lib/llm` or `lib/reasoning` from `lib/calc` (or modifying criteria files to "help" the narrative) breaks the forbidden-import lint and the ground-truth invariant.
**How to avoid:** all reasoning code lives in `lib/reasoning/`, which may import `lib/criteria` (read-only), `lib/ingest` types, and `lib/wizard/format` — never the reverse; `lib/criteria/` untouched.
**Warning signs:** new imports under lib/calc; eslint no-restricted-imports failures.

## Code Examples

### Narrative request payload (server → prompt, deterministic)

```ts
// lib/reasoning/narrative-context.ts (sketch — shape, not final code)
// Source: ReadingResult fields verbatim from lib/ingest/session.ts:107-143;
// formatting via lib/wizard/format.ts formatFixed (table precision: 2dp thickness,
// 3dp rates, 1dp years — 03-UI-SPEC INPUTS contract).
export function buildNarrativeContext(
  reading: ReadingResult, metadata: ComponentMetadata,
  extraction: ExtractionResult, thresholds: PtmtThresholds,
): { payload: string; allowedNumbers: Set<number> } {
  const values = {
    reading: { location: reading.location, cml: reading.cml ?? null,
      t_actual_mm: formatFixed(reading.tActualMm, 2),
      t_pressure_mm: formatFixed(reading.tPressureMm, 2),
      t_structural_mm: formatFixed(reading.tStructuralMm, 2),
      t_required_mm: formatFixed(reading.tRequiredMm, 2),
      cr_lt_mm_yr: formatFixed(reading.crLtMmYr, 3),
      cr_st_mm_yr: formatFixed(reading.crStMmYr, 3),
      cr_governing_mm_yr: formatFixed(reading.crGoverningMmYr, 3),
      rl_years: formatFixed(reading.rlYears, 1),
      gauge_uncertainty_mm: formatFixed(toMm(metadata.gaugeUncertainty, /*unit*/), 2),
      verdict: VERDICT_LABEL[reading.verdict] },        // ACCEPT | RE-CHECK | FAIL
    thresholds,                                          // from criteria.ptmt — repo-vetted
    // + indication slice when narrating a PT/MT card: dims, engine verdict, detail
  };
  // numbers → allowlist (raw 6dp + 1/2/3dp variants); strings pass through
  return { payload: JSON.stringify(values, null, 1), allowedNumbers: collectNumbers(values) };
}
```

### Streaming route core (delta vs Phase 1 spike route)

```ts
// app/api/reasoning/narrative/route.ts — the ONLY deltas from app/api/spike/stream/route.ts
const stream = await getClient().chat.completions.create({
  model: getReasoningModel(),
  messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPayload }],
  stream: true,
  max_completion_tokens: 1200,
  reasoning_effort: "low",                    // 3-value enum ONLY (lib/llm/complete.ts:12)
  stream_options: { include_usage: true },    // usage arrives in the FINAL chunk (verified today)
}, { signal: req.signal });                   // browser disconnect aborts the paid call

// per-chunk: enqueue {"type":"delta"} frames; sentence-boundary numeric guard;
// final chunk: emit {"type":"usage", ...}; then run full lints ->
//   pass: {"type":"complete"} | reject: {"type":"rejected", reason, fallback}
//   then data: [DONE]  (same closed-guard + error-frame structure as the spike route)
```

### Fallback narrative (pure, cited, testable)

```ts
// lib/reasoning/fallback.ts (sketch)
export function fallbackNarrative(r: ReadingResult, m: ComponentMetadata): string {
  const parts: string[] = [];
  const cites = (id: string) => r.citations.includes(id) ? `[[cite:${id}]]` : "";
  parts.push(
    `CML ${r.cml ?? r.location}: t-actual ${formatFixed(r.tActualMm, 2)} mm against ` +
    `t-required ${formatFixed(r.tRequiredMm, 2)} mm` +
    (r.citations.includes("api574_10_5_1_4") ? `, the greater of pressure design ` +
      `${formatFixed(r.tPressureMm, 2)} mm and structural minimum ` +
      `${formatFixed(r.tStructuralMm, 2)} mm ${cites("api574_10_5_1_4")}` : "") + ".",
  );
  // rates (only when non-null) with api570_7_1_2_lt/st/governing; RL with api570_7_2;
  // gauge-uncertainty band restated per lib/calc/verdicts.ts comparison order.
  parts.push(`Verdict: ${VERDICT_LABEL[r.verdict]}. All verdicts are computed in code and unaffected.`);
  return parts.join(" ");
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| STACK.md's `reasoning_effort` range `none…xhigh` | Enum `low \| medium \| high` only | Verified 2026-09-26 (01-RESEARCH C1); re-confirmed on the live spec today | Never send `none`; cost/latency control = `low` + `max_completion_tokens` |
| `json_schema` assumed unsupported | **Verified working live on both routed models** (undocumented) | 2026-09-27 spike record | Available as an optional tightening for extraction; locked contract stays `json_object` + Zod |
| Per-row LLM structuring of table data | Batch extraction of only the unstructured glue (notes/context) | This research | 50× cost reduction on extraction; per-pane TTFB halved (one call, not two) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | UI-29 (stream incrementally) and UI-42 (rejected text never partially renders) are best reconciled by sentence-level mid-stream numeric guard + final lints, with pane-swap to fallback on rejection | Pitfall 2 / Pattern R6 | If the planner reads UI-42 strictly, narrative must buffer fully — slower demo, simpler code; a one-task change either way |
| A2 | Narrative upstream timeout = `AbortSignal.timeout(30_000)` | Pattern R4 | Too low → spurious fallbacks on slow streams; too high → judge waits. Env-tunable is easy |
| A3 | Client concurrency cap of ~3 parallel narrative streams | Pattern R5 | Cosmetic (TTFB smoothing); wrong value has no correctness impact |
| A4 | LLM kill-switch env name `FLAWCHECK_DISABLE_LLM=1` (or rely on degraded health alone) | Pattern R4 | Naming only; the fallback-first behavior is locked regardless |
| A5 | `openai` SDK auto-retries 429s (2 attempts default) under Token Bucket limits | Pattern R5 | Extra 429s would surface as pane error + Retry — acceptable; verify behavior in live test |
| A6 | Numeric allowlist policy: raw 6-dp + 1/2/3-dp variants of injected values | Pattern R6 | Too strict → over-rejection to fallback; too loose → undetected drift. Tunable in one function + tests |
| A7 | "Latency … not client timing" is satisfied by server-side timing around the upstream call | Pattern R5 / R7 | If the planner reads it as gateway-reported only, latency has no source (API returns tokens, not latency) → field would render `—` |
| A8 | Wrong-context citation lint as hard reject (downgrade path: audit stamp) | Pattern R3 | Over-rejection on legitimately broad clauses; downgrade is a one-line change |
| A9 | Cost display: default `—`; optional env-var pricing (`NEBIUS_PRICE_*`) for real dollars | Pitfall 7 | Wrong price shown would be a credibility bug; `—` is always safe |
| A10 | zod 4.6.5 exposes `z.toJSONSchema()` for auto-generating schemaHint | Pattern (extraction) | If absent, keep the Phase 1 hand-written hint + key-coverage test (planned regardless) |
| A11 | Prompt-design specifics (wording, 120–180 words, final-line contract) produce lint-passing narratives from Super-120B at `low` effort | Patterns R2/R6 | Behavioral — must be proven by the skipIf-gated live fixture test before the demo; lints + fallback bound the damage if not |

## Open Questions (RESOLVED — see plans' open-question resolution 1..4)

All four questions were resolved during planning and are implemented as numbered resolutions in the phase plans: **1** streaming with the sentence-level mid-stream guard + swap-to-fallback (03-02 server, 03-03 client), **2** cost renders the unavailable-pricing em-dash always (03-01 pane, 03-04 status bar, restated in 03-05's wrap summary), **3** disabled-mode Extraction row renders `—` + a `fallback mode` note (03-04), **4** history values (t-initial/t-previous/Δt) ARE injected into the narrative prompt with the schema field defined in 03-01 (03-02 consumes). The original questions are retained below for provenance only.

1. **UI-29 vs UI-42 reconciliation (streaming vs never-partially-render).**
   - What we know: lints fully decidable only at stream end; both UI items are locked/inferred-locked.
   - What's unclear: whether "never partially renders" forbids showing pre-rejection chunks.
   - Recommendation: mid-stream sentence guard + swap-to-fallback (A1); planner records the decision explicitly.
2. **Cost field: `—` default vs env-supplied pricing.**
   - What we know: API returns tokens only; UI must never compute cost; hardcoded-ID grep forbids price maps keyed by model IDs in `.ts`.
   - Recommendation: `—` by default, optional `NEBIUS_PRICE_*` envs for the demo (A9).
3. **Extraction row's status-bar presentation when the LLM layer is disabled** (UI-SPEC defines the fallback chip on the Narrative row only).
   - Recommendation: Extraction row renders the fallback chip too (or muted `—`) — small copy decision for the planner.
4. **History values (t-initial/t-previous/Δt) in the narrative prompt.**
   - What we know: `ReadingResult` doesn't carry them; the grouping seam does; they make CR narration coherent but widen the numeric surface.
   - Recommendation: inject them (they're precomputed), allowlist them; planner confirms.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | route handlers, vitest | ✓ | 24.14.1 | — |
| `next`/`react`/`zod`/`openai`/`vitest` | everything | ✓ (package.json) | 16.3.6 / 19.3.0 / 4.6.5 / 7.23.0 / 5.0.2 | — |
| `NEBIUS_API_KEY` + model env IDs | extraction + narrative routes, live tests | ✓ (`.env.local` existed at Phase 1 close — live probes ran) | — | Fallback-first design: full flow works without it (fallback state) |
| Vercel account/deploy | NOT this phase (Phase 5) | n/a | — | — |
| Any new npm package | nothing — zero-package phase | — | — | not needed |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Security Domain

> `security_enforcement: true`, ASVS level 1 (config.json).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No user auth (out of scope by REQUIREMENTS) |
| V3 Session Management | no | No sessions; "session cache" is client-side wizard state |
| V4 Access Control | partial | `/api/reasoning/*` unauthenticated by design; abuse guarding is Phase 5 (PLAT-04, proxy.ts). Do not deploy publicly before Phase 5 |
| V5 Input Validation | yes | Zod `.strict()` on BOTH route bodies (`ExtractionRequestSchema`, `NarrativeRequestSchema`) before any paid call; unknown fields rejected; per-pane payloads are typed repo types, never raw CSV strings |
| V6 Cryptography | no | No crypto operations |
| V14 Configuration | yes | API key only inside `lib/llm/*`; routes never echo env or prompt internals; model IDs env-resolved only |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via PT/MT notes text (user-controlled input reaches the narrative prompt) | Tampering | Notes are summarized by Lightning under a schema that caps lengths and forbids digits; narrative numbers are lint-gated to precomputed values and the verdict line must match the engine — a successful injection can only produce a **fallback**, never a fake verdict or a fake citation |
| Unauthenticated endpoint burns credits | DoS | Phase 1 spike-route posture carries over: fine locally; Phase 5 adds proxy.ts rate limiting + token caps. Per-pane payloads are small (~2-4 KB), one upstream call per request |
| Data round-trip exposure | Information Disclosure | The narrative route processes the user's own session slice and returns narrative only; no persistence server-side; nothing logged beyond reason + reading id on lint rejection |
| Fabricated citations | Tampering (integrity of the safety artifact) | Renderer allowlist gate (SC3, zero-glyph + audit stamp) + server citation lint — defense in depth |

## Sources

### Primary (HIGH confidence)
- In-repo (read this session, quoted with line ranges above): `lib/llm/complete.ts`, `lib/llm/client.ts`, `lib/llm/config.ts`, `app/api/spike/stream/route.ts`, `lib/ingest/session.ts`, `lib/calc/evaluate.ts`, `lib/calc/verdicts.ts`, `lib/calc/ptmt.ts`, `lib/calc/corrosion.ts`, `lib/calc/criteria.ts`, `lib/criteria/citations.json`, `lib/wizard/format.ts`, `lib/wizard/reducer.ts`, `components/wizard/results-table.tsx`, `components/wizard/verdict-chip.tsx`, `components/wizard/flag-detail-row.tsx`, `components/wizard/ptmt-triage-list.tsx`, `components/wizard/screen-results.tsx`, `package.json`, `docs/spike-record.md`, `docs/flowstep-handoff.md`, `.planning/phases/03-*`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`
- `https://docs.tokenfactory.nebius.com/api-reference/inference/create-chat-completion.md` — fetched 2026-09-27: `stream_options.include_usage` (usage in last chunk), `max_completion_tokens` bounding "visible output tokens and reasoning tokens", `reasoning_effort` enum, `response_format` enum, `finish_reason`
- `https://docs.tokenfactory.nebius.com/ai-models-inference/rate-limits.md` — fetched 2026-09-27: Token Bucket; "Model tokens limit — … total number of tokens (input + output) … in a given minute"; client tokens limit
- `https://docs.tokenfactory.nebius.com/ai-models-inference/json.md` — fetched 2026-09-27: structured-output guidance; `finish_reason: length` warning for JSON outputs
- `https://tokenfactory.nebius.com/model-catalog.md` — fetched 2026-09-27: catalog confirms both routed models live; prices as recorded in STACK.md ($0.30/$0.90 Super-120B, $0.06/$0.24 Lightning)

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` (2026-09-24) — pricing/streaming posture; `docs/spike-record.md` (2026-09-27) — `json_schema` live probe; `01-RESEARCH.md` (2026-09-26) — reasoning_effort correction C1, grep-gate wording

### Tertiary (LOW confidence)
- `classify-confidence` seam rates the webfetch provider LOW by class; claims above are tagged by the stricter claim-provenance rules (tool-confirmed + authoritative source), matching the precedent in 01-RESEARCH.md §Sources

## Metadata

**Confidence breakdown:**
- Reuse architecture + data contracts: HIGH — every named primitive read in-repo this session with line ranges
- API contracts (usage frames, reasoning_effort, rate limits): HIGH — official docs fetched today, cross-confirmed by Phase 1 research
- Prompt design + lint tuning: MEDIUM — behavioral, must be proven by the skipIf-gated live fixture test (A11); lints + fallback bound the failure
- Cost math: HIGH — arithmetic from catalog prices recorded in two prior verified documents

**Research date:** 2026-09-27
**Valid until:** 2026-10-04 (model catalog moves weekly; re-verify model IDs and prices if planning slips past one week)
