# Architecture Research

**Domain:** AI-powered NDT inspection report copilot — Next.js 16 single-app pipeline (ingest → deterministic calc → LLM narrative → clause-cited report), Nemotron on Nebius Token Factory, 2-week solo hackathon MVP
**Researched:** 2026-09-24
**Confidence:** HIGH for platform integration facts (verified same-day against official Nebius/Next.js/react-pdf/Vercel docs); MEDIUM for structural patterns (judgment grounded in verified constraints)

**The one-sentence architecture:** a fixed, code-orchestrated pipeline where TypeScript computes every number, the LLM only narrates and structures text around precomputed results, citations are injected from a builder-owned allowlist at render time, and the server is stateless — session state lives in the browser.

---

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                          BROWSER (client)                               │
│  Wizard UI: upload → parsed-preview (editable) → evaluation review      │
│  (verdict chips + reasoning pane) → report view → PDF download          │
│  Session state: React state + localStorage (the ONLY durable store)     │
│  Demo mode: seeded inputs; "Live model" toggle bypasses cache           │
└───────────────┬────────────────────────────────────────────────────────┘
                │ fetch (JSON in/out; SSE for reasoning stream)
┌───────────────▼────────────────────────────────────────────────────────┐
│              NEXT.JS APP (Vercel functions, nodejs runtime)             │
│  Route handlers (thin I/O orchestration only — no business logic):      │
│  /api/parse   /api/evaluate (SSE)   /api/report/pdf   /api/lookup       │
│  /api/health  (startup model validation surfaces here)                  │
├────────────────────────────────────────────────────────────────────────┤
│  CORE LIB — pure TypeScript, zero I/O, vitest golden-file tested        │
│  parser.ts · units.ts · quality.ts · calc.ts (t-min, CR, RL, interval)  │
│  criteria.ts (criteria config loader) · verdict.ts (banding rules)      │
├────────────────────────────────────────────────────────────────────────┤
│  LLM GATEWAY (the only code that talks to models)                       │
│  routing.ts (model IDs from env) · llm-client.ts (openai SDK factory)   │
│  schemas.ts (Zod contracts) · call-validated.ts (json_object + Zod +    │
│  1 bounded retry) · cache.ts (SHA-256 input-hash, in-memory)            │
├────────────────────────────────────────────────────────────────────────┤
│  CITATION LAYER          │  REPORT LAYER           │  AUDIT LOG        │
│  citations.json          │  ReportView (on-screen) │  append-only      │
│  (allowlist artifact,    │  ReportDocument         │  events (input    │
│  edition-pinned) —       │  (@react-pdf/renderer   │  hash, model,     │
│  renderer ENFORCES       │  renderToBuffer) +      │  tokens per step) │
│  membership              │  print-CSS fallback     │  rendered as      │
│                          │                         │  report appendix  │
└──────┬──────────────────────────────┬──────────────────────┬───────────┘
       │                              │                      │
┌──────▼───────────────┐   ┌──────────▼───────────┐   ┌──────▼──────────────┐
│ NEBIUS TOKEN FACTORY │   │ TAVILY API           │   │ BUILD-TIME ASSETS   │
│ Lightning = extract  │   │ 1 fixed basic search │   │ model-catalog.json  │
│ Super-120B = narrate │   │ per evaluation; non- │   │ citations.json      │
│ (OpenAI SDK, SSE,    │   │ blocking; cached;    │   │ criteria configs    │
│ json_object mode)    │   │ degrades to links-off│   │ demo seed data      │
└──────────────────────┘   └──────────────────────┘   └─────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Wizard UI** | Upload, editable parse preview, metadata form, review screen, report view | Next.js App Router pages + client components; no chat interface |
| **`/api/parse`** | Receive CSV + notes + metadata; run parser, unit normalization, data-quality flags; return structured draft + flags + errors | Route handler calling `lib/parser` + `lib/units` + `lib/quality`; Zod row validation; no LLM required to succeed |
| **`/api/evaluate`** | Orchestrate: deterministic calc → verdicts → Super narrative (SSE-streamed) → citation resolution → return complete evaluation object | Route handler; calc results computed BEFORE any model call; streams only the narrative portion |
| **`lib/calc` + `lib/verdict`** | ALL engineering math and verdict banding | Pure TS functions, unit-tested against builder's hand calculations (golden files) |
| **LLM Gateway** | Every model call: routing, schema-validated JSON, retry, cache, token/cost ledger | `openai` SDK with Token Factory `baseURL`; Zod-validated `json_object` responses |
| **Extraction layer (Lightning)** | Convert freeform PT/MT notes into structured indication records; optional column-mapping assist | One batched call per report; extraction only, zero judgment |
| **Reasoning layer (Super-120B)** | Acceptance narrative around precomputed verdicts; recommendation phrasing; caveat surfacing | One call per report; `reasoning_effort: "low"`, `max_completion_tokens` ≈ 2000; receives NO unknown numbers |
| **Citation layer** | Clause references: allowlist artifact + renderer enforcement + edition pinning | `citations.json` static asset; model emits allowlist IDs; renderer resolves; unknown ID → reject/blank |
| **Tavily enrichment** | Live edition/errata verification + outbound links | ONE fixed basic search per evaluation, run AFTER acceptance completes; failure = feature silently absent |
| **Report layer** | On-screen report + PDF + print fallback; sign-off block; disclaimer footer | `@react-pdf/renderer` `renderToBuffer` in nodejs-runtime route; print-CSS `/report/print` as fallback |
| **Audit log** | Per-step evidence trail (input hash, model ID, tokens, latency) | Client-held array rendered into report appendix; server never persists |
| **Demo mode** | One-click seeded scenarios; committed cached LLM responses; live toggle | Static seed JSON (Zenodo subset + builder PT/MT samples) + `cached-responses/` fixtures |

---

## Recommended Project Structure

```
src/
├── app/
│   ├── page.tsx                      # wizard entry (upload + demo button)
│   ├── review/page.tsx               # parsed-preview editor + metadata form
│   ├── evaluation/page.tsx           # verdict chips, reasoning pane, SSE consumer
│   ├── report/page.tsx               # on-screen report
│   ├── report/print/page.tsx         # print-CSS fallback (also the PDF plan B)
│   └── api/
│       ├── parse/route.ts            # POST csv+notes+metadata → DraftEvaluation
│       ├── evaluate/route.ts         # POST draft → SSE: calc done → narrative deltas → final JSON
│       ├── report/pdf/route.ts       # POST evaluation JSON → renderToBuffer → PDF bytes
│       ├── lookup/route.ts           # POST criterion context → Tavily basic search (cached, non-blocking)
│       └── health/route.ts           # GET: model IDs validated? catalog age? config OK?
├── lib/
│   ├── calc/                         # ★ DETERMINISTIC CORE — pure, no I/O, no imports from llm/
│   │   ├── units.ts                  #   mm canonical; mils/inch/mm conversion; refuse mixed inputs
│   │   ├── tmin.ts                   #   t-required per criteria config formula (code-parameterized)
│   │   ├── corrosion.ts              #   CR short/long-term from interval readings
│   │   ├── life.ts                   #   remaining life; re-inspection interval rule
│   │   ├── quality.ts                #   outliers (z-score), range checks, date-gap checks
│   │   └── verdict.ts                #   accept / re-check / reject banding incl. gauge-uncertainty band
│   ├── ingest/
│   │   ├── csv.ts                    # papaparse + Zod row schema; column-mapping heuristics
│   │   └── notes.ts                  # indication-note preprocessing before Lightning call
│   ├── llm/                          # ★ the ONLY code importing the openai SDK
│   │   ├── routing.ts                #   model IDs from env + startup validation vs /v1/models
│   │   ├── client.ts                 #   OpenAI factory (baseURL, key), SSE passthrough
│   │   ├── schemas.ts                #   Zod contracts for every LLM call (see below)
│   │   ├── call-validated.ts         #   json_object → Zod.parse → 1 bounded retry w/ error feedback
│   │   └── cache.ts                  #   SHA-256(model + templateVer + canonical inputs) → response
│   ├── criteria/                     # builder-owned domain ground truth (static JSON + loader)
│   │   ├── citations.json            #   ★ citation allowlist: {id, code, edition, clause, scope}
│   │   ├── ut-criteria.json          #   t-min formulas + FCA + bands, parameterized (NO code text)
│   │   └── ptmt-criteria.json        #   indication acceptance table; linear/crack → escalate rule
│   ├── report/
│   │   ├── assemble.ts               # evaluation JSON → report data model (injects citations)
│   │   ├── ReportDocument.tsx        # react-pdf document component
│   │   └── audit.ts                  # audit-event type + append helpers
│   └── lookup/
│       └── tavily.ts                 # basic-depth search wrapper + cache + timeout + graceful null
├── fixtures/                         # ★ double as golden tests AND demo seed
│   ├── zenodo-ut/                    #   Appendix_A_UT_register.csv subset (CC BY 4.0, attributed)
│   ├── ptmt-samples/                 #   builder-authored sample notes (labeled samples)
│   ├── golden/                       #   expected outputs, hand-computed by the builder (L2 ground truth)
│   └── cached-llm/                   #   committed demo LLM responses keyed by input hash
└── tests/                            # vitest: calc golden files, schema round-trips, citation lint
docs/
└── model-catalog.json                # day-1 GET /v1/models dump, committed (PITFALLS P1)
```

### Structure Rationale

- **`lib/calc/` is dependency-free and imported by everything, but imports nothing from `llm/`** — the "LLM never computes" invariant becomes mechanically checkable in code review (a forbidden-import lint makes it CI-enforceable).
- **`lib/criteria/` as static JSON artifacts, not prompt strings** — the builder's domain edge lives in versioned, diffable files; the same artifact feeds prompts, renderer enforcement, and CI citation checks.
- **`fixtures/` serve three masters** (golden tests, demo seed, cached LLM responses) — one data-authoring effort, per FEATURES/PITFALLS parallel findings.
- **Route handlers stay thin** — all logic in `lib/` so vitest never needs to boot Next.js.

---

## The LLM-vs-Deterministic Boundary (Core Section)

### Ownership of every calculation

| Computation | Owner | Enforcement |
|---|---|---|
| CSV parsing, row typing, header detection | **Code** (papaparse + Zod) | Deterministic; parse errors block the pipeline |
| Column mapping | **Code heuristics** (header-name fuzzy match); LLM assist optional | Mapping shown in preview; user confirms — the confirmation IS the enforcement |
| Unit normalization (mm/inch/mils → canonical mm) | **Code** | Explicit unit field required; mixed-unit input rejected; canonical unit never displayed raw |
| Data-quality flags (outliers, impossible values, date gaps, duplicate CMLs) | **Code** (z-score, range checks) | Flags computed pre-LLM; shown in preview |
| t-min / t-required (incl. FCA) | **Code** (formula from criteria config) | Pure function + golden test; the substituted-formula "show your work" view is generated from the same function's trace |
| Corrosion rate, short- and long-term | **Code** | `CR_ST = (t_prev − t_actual)/Δt`; interval Δt validated > 0 in code |
| Remaining life | **Code** | `RL = (t_actual − t_required)/CR_governing`; governing-rate selection rule coded (builder confirms rule in criteria config) |
| Re-inspection interval | **Code** | Deterministic rule (e.g., half-RL, capped by criteria-config max interval) |
| **Accept/re-check/reject verdict** | **Code** | Banding from criteria config, including the gauge-uncertainty re-check band. **The LLM never decides pass/fail — it is told the verdict.** |
| PT/MT indication verdicts | **Code** (against `ptmt-criteria.json` table) | Crack-suspect/linear indications hard-coded to escalate to inspector — never routed by any model |
| PT/MT note structuring (freeform → structured indication records) | **LLM (Lightning)** | Extraction only; output schema carries no verdict field; Zod-validated |
| Column-mapping assist on ambiguous headers | **LLM (Lightning)** | Optional fallback; suggestion only; user confirms |
| Acceptance narrative / explanation / recommendation phrasing / caveat surfacing | **LLM (Super-120B)** | Receives inputs + ALL computed values + verdict; may not emit numbers absent from its input (numeric-consistency lint below) |
| Citation selection | **LLM proposes, renderer decides** | Model emits allowlist IDs; renderer resolves ID → `{code, edition, clause}` or rejects |
| Report assembly and rendering | **Code** | Deterministic template; numbers interpolated by the renderer, never typed by the model |

### Structured-output contracts (Zod) for each LLM call

**Platform constraint that shapes all of this (verified against official docs, HIGH):** the Token Factory API reference states `response_format` supports **only `json_object` or `text`** (the `json_schema` enum value exists in the schema and is documented in their JSON guide as model-dependent via a "JSON mode" model-card tag). Therefore: schema goes **in the prompt text**, `response_format: {type: "json_object"}` goes in the request, and **Zod validation with one bounded retry** (feeding the validation error back) is mandatory regardless. Test `json_schema` per-model in the Phase 1 spike; if it works for Super/Lightning, enable it as defense-in-depth — never as the only defense.

```typescript
// lib/llm/schemas.ts — every model response is parsed through one of these
import { z } from "zod";

// Call 1 — Lightning: PT/MT note structuring (extraction only, no judgment fields)
export const NotesStructuring = z.object({
  indications: z.array(z.object({
    id: z.string(),                    // model-assigned stable ref back into narrative
    method: z.enum(["PT", "MT"]),
    location: z.string(),              // e.g. "weld W-3, 3 o'clock, HAZ" (verbatim-ish capture)
    morphology: z.enum(["linear", "rounded", "porosity", "crack_suspect", "other"]),
    orientation: z.string().optional(),
    dimensions_mm: z.string().optional(), // string on purpose: keep as captured, code re-parses
    remarks: z.string().optional(),
  })),
  unparsed_segments: z.array(z.string()), // anything the model couldn't structure — surfaced in UI
});

// Call 2 — Lightning (optional): ambiguous CSV column mapping
export const ColumnMapping = z.object({
  mapping: z.array(z.object({ column: z.string(), field: z.enum([
    "location", "thickness", "date", "component", "reading_id", "unknown" ]), confidence: z.number() })),
});

// Call 3 — Super-120B: acceptance narrative. NOTE: no verdict field, no numeric fields
// other than string references to computed keys. The model EXPLAINS; it does not DECIDE.
export const AcceptanceNarrative = z.object({
  summary: z.string(),                 // plain-language overview of the evaluation
  per_cml: z.array(z.object({
    cml_id: z.string(),                // must exist in computed results (validated post-parse)
    verdict_ref: z.enum(["accept", "re_check", "reject"]), // must EQUAL computed verdict (lint)
    explanation: z.string(),           // engineering logic in original words — no code text
    citation_ids: z.array(z.string()), // must ∈ citations.json allowlist (renderer-enforced)
    recommendation: z.string(),        // phrasing, e.g. "re-measure at 90° orientation"
  })),
  overall_recommendation: z.string(),
  caveats: z.array(z.string()),        // data-quality-driven honesty the narrative must carry
});
```

**Two belt-and-suspenders number guards** (post-parse, in `call-validated.ts`):
1. **Verdict agreement lint** — every `verdict_ref` must equal the computed verdict for that CML; mismatch = retry once, then fail loud (never silently ship a disagreeing narrative).
2. **Numeric-consistency lint** — regex-extract number tokens from narrative strings; any number not present in the model's input payload (within tolerance for unit-echoes) flags the report with a visible "narrative contains unverified figure" warning, or re-runs the call. Headline numbers (t-min, RL, verdicts) are **always interpolated by the renderer from computed values**, so the worst case is prose blemish, never a wrong decision number.

### The prompt contract (what the LLM actually receives)

Super-120B `evaluate` prompt = system template (versioned, ~600 tokens: role, rules — "you explain, you never compute; you never quote code text verbatim; citations only as IDs from the provided list") + user payload (~5K tokens): component metadata, criteria-config entries (parameterized facts, not code paragraphs), per-CML computed table (t_actual, t_min, CR, RL, verdict, DQ flags), indication records, and the Zod schema as text. Output: ≤2000 `max_completion_tokens`, `reasoning_effort: "low"`.

---

## Guardrails

### 1. Hallucinated-citation prevention (the product's credibility)

- **`citations.json` allowlist** — builder-vetted artifact, 10–20 entries covering implemented criteria only:
```json
{ "id": "api570_7_3", "code": "API 570", "edition": "3rd ed. w/ Addendum",
  "clause": "7.3", "title": "Corrosion rate determination",
  "scope_note": "Short/long-term rate from thickness readings", "verified": "2026-09" }
```
- **Enforcement point is the renderer, not the model** — `assemble.ts` resolves `citation_ids` → full citation objects; an unknown ID blanks the citation, stamps the audit log, and marks the report "citation rejected" rather than shipping a plausible fake.
- **Edition pinning** — every rendered citation carries code + edition + verification date; the model never generates edition strings.
- **CI check** — a vitest pass renders every fixture evaluation and asserts every emitted citation ∈ allowlist (per PITFALLS P3).
- **Tavily never generates citations** — it verifies editions/errata and provides outbound links only (per PITFALLS P4: link out, never cache-and-serve standard text).

### 2. Human-in-the-loop confirmation

- **Parsed-preview gate:** acceptance never runs until the user confirms the editable preview table (bad row → fix, don't poison the run).
- **Review gate:** the evaluation screen shows verdict chips + reasoning + "show your work" formula traces; the report renders each decision as *"Acceptable per [criterion] — pending inspector sign-off"* (PITFALLS P5); the report carries an inspector acknowledgement/sign-off block and a decision-support disclaimer footer.
- **Hard-coded escalation:** any `crack_suspect` or linear PT/MT indication routes to inspector review regardless of any model or rule output.

### 3. Startup model-ID validation (PITFALLS P1)

- Day-1: `GET https://api.tokenfactory.nebius.com/v1/models` dump committed to `docs/model-catalog.json`.
- `next.config` `instrumentation.ts` (or first `/api/health` hit): validate `NEBIUS_REASONING_MODEL` and `NEBIUS_EXTRACT_MODEL` against the live list; mismatch → `/api/health` returns red status and every model-touching route returns a clear 503 banner ("configured model X not served; catalog suggests Y") instead of a mysterious 404 mid-demo.
- Model IDs live only in env config; the committed catalog is the offline-dev fallback and the swap menu when Nebius ships another removal wave.

### 4. Rate limiting the public demo (layered, all free)

| Layer | Mechanism | Notes |
|---|---|---|
| 1 | **Vercel Firewall rate-limit rule** on `/api/evaluate` + `/api/lookup` | Verified available on Hobby (first 1M allowed rate-limited requests/month included; ~1 custom rule on Hobby — spend it on the model path) |
| 2 | **In-app per-IP token bucket** (in-memory Map) | Imperfect across instances (verified) but free and second-line; tuned ~5 evaluations/IP/hour |
| 3 | **Token budget caps** | `max_completion_tokens` per call + one batched call per report — the real credit guard (per-report cost ~$0.004) |
| 4 | **Unguessable demo path** + honest 429 handling (`Retry-After`, "retrying" UI state) | Pitfalls integration gotchas |
| Optional | Upstash Redis free tier (~10K commands/day) | Only if the in-memory layer visibly fails; skip otherwise — fewer moving parts |

---

## Caching & Credit Strategy

### What is precomputed at build time (committed to repo)

| Asset | Why build-time |
|---|---|
| `docs/model-catalog.json` | P1 mitigation; startup validation fallback |
| `lib/criteria/*.json` (allowlist + criteria configs) | Domain ground truth, diffable, no runtime cost |
| Demo seed data (Zenodo UT subset + PT/MT samples) | Zero-latency demo entry; fixtures double as golden tests |
| **Committed demo LLM responses** (`fixtures/cached-llm/`, keyed by input hash) | The demo scenarios run end-to-end with ZERO live model calls and zero 429/credit risk; a "Live model" toggle bypasses the cache to prove real Nemotron usage in the video — reliability and authenticity both covered |
| Golden expected outputs | Builder's hand calculations as ground truth |

### Runtime caches (best-effort, in-memory)

- **LLM response cache:** `SHA-256(model + prompt-template-version + canonicalized inputs)` → validated JSON response. Instance resets are acceptable: worst case is a re-billed call (~$0.004); the committed demo responses are the reliable layer.
- **Tavily cache:** query-hash → results, 24h TTL. `search_depth: "basic"` pinned (1 credit; `auto_parameters` can silently double it), `include_usage: true` logged. Well under the 1,000/month free tier.

### Expected tokens & cost per report run

| Call | Model | In / out tokens | Cost |
|---|---|---|---|
| UT extraction + notes structuring (batched, whole dataset) | Lightning | ~4K / ~1K | ~$0.0005 |
| Acceptance narrative | Super-120B (`reasoning_effort: low`, cap 2000) | ~5–6K / ≤2K | ~$0.0036 |
| Tavily verification lookup | — | 1 credit | free tier |
| **Full report** | | | **~$0.004–0.005** |

$25 ≈ 5,000+ runs — volume is a non-issue; the levers that matter are per-call caps, one-call-per-step batching, caching, and the rate-limit layers above. Log tokens + cents per run in the audit trail (also a judges-visible transparency feature).

---

## Data Flow with Failure Modes

```
Upload (CSV + notes + metadata)
  │  ✗ oversized/malformed file → 400 with specific per-row message
  ▼
/api/parse ──► lib/ingest (papaparse + Zod rows) ──► lib/units (→ canonical mm)
  │                    ✗ unparseable rows → row flags + hard errors       ✗ mixed/missing units → reject, never guess
  │                    ▼
  │              [optional] Lightning column-mapping assist (ambiguous headers only)
  │                    ✗ LLM fail → proceed with heuristics + "confirm mapping" UI (non-blocking)
  ▼
Parsed-preview (client) ── user edits & confirms ──►  [quality flags shown: outliers, gaps]
  ▼
POST /api/evaluate (SSE opens)
  ├─► lib/calc + lib/verdict  ── ALL math here, pure functions
  │        ✗ invariant violation (Δt≤0, CR≤0, t>t_nominal) → 422 with the exact CML
  │  ✅ progress event: "computed 12 CMLs" — deterministic part CANNOT fail from AI
  ├─► [batched] Lightning notes-structuring (PT/MT path)
  │        ✗ schema fail → 1 retry w/ error feedback → still fail → indications marked
  │          "unstructured — manual review" (pipeline continues, PT/MT verdicts manual)
  ├─► Super-120B narrative (streams reasoning_content + content deltas to UI)
  │        ✗ 429/timeout → Retry-After backoff, honest "retrying" state
  │        ✗ schema/verdict-lint fail → 1 retry → still fail → deterministic template
  │          narrative ("Computed acceptance per [criterion]; review required") — the
  │          NUMBERS AND VERDICTS ARE ALREADY DONE AND UNAFFECTED
  ├─► citation resolution (allowlist) ✗ unknown ID → blank + audit-stamp (never fake)
  ├─► Tavily enrichment (fire-and-forget AFTER acceptance completes)
  │        ✗ any failure → feature absent; links section omitted; ZERO impact on verdicts
  ▼
Complete evaluation JSON ──► stored in browser session (localStorage) — server keeps nothing
  │
  ▼
Report view ──► /api/report/pdf (POST evaluation JSON → assemble → renderToBuffer)
  │        ✗ react-pdf fail → print-CSS /report/print fallback (browser Save-as-PDF)
  ▼
PDF + audit appendix (input hashes, models, tokens, per-step latencies)
```

**The controlling design idea:** every failure left of the narrative step blocks loudly (bad data must not proceed); every failure at or right of the narrative step degrades gracefully to a deterministic fallback (the acceptance result itself is already safe). Tavily sits furthest right — it decorates, never decides.

---

## Build Order (2-week MVP)

### Dependency graph

```
P1 Platform spike ──► P2 Calc engine + fixtures ──► P3 Reasoning + citations ──► P4 Report ──► P5 Demo/deploy/video
 (models live,         (golden tests = demo seed,     (Lightning + Super +        (PDF + print +    (Tavily, rate limits,
  routing, schemas)     one effort, two payoffs)        allowlist + streaming)      sign-off)          cached demo, rehearsal)
                                                  └── Tavily enrichment is OFF this path ──► (plugin into P5)
```

### Phase breakdown

**Phase 1 — Platform spike & skeleton (days 1–2).** Live `GET /v1/models` dump committed; env-configured routing + startup validation; `llm-client` + `call-validated` (json_object → Zod → retry) proven against both models with a hello-fixture; Phase-1 spike also tests whether `json_schema` works on Super/Lightning (record result); scaffold wizard pages + `/api/health`; repo hygiene rules (no code text anywhere; secrets scan) set as CI checks from commit one.
*Produces:* proof the models respond, the schema pattern works, and the failure banner works.

**Phase 2 — Deterministic core + fixtures (days 2–5).** `lib/calc` complete (units, t-min, CR ST/LT, RL, interval, quality flags, verdict banding incl. re-check band); Zenodo subset + builder-authored PT/MT samples curated; golden tests written from builder hand calculations; `/api/parse` + preview table UI.
*Produces:* the entire product's math, proven, with the demo dataset already in test form. **The LLM could never ship and this would still be a calculators-with-tests.**

**Phase 3 — LLM reasoning + citation layer (days 5–8).** `citations.json` authored (10–20 entries); `ptmt-criteria.json` acceptance tables; Lightning structuring call wired; Super narrative call with verdict-lint + numeric-lint + retry + SSE streaming into the reasoning pane; renderer-side citation enforcement; model/tokens status line in UI.
*Produces:* the demo's centerpiece — computed verdicts with streamed, cited, constrained narratives.

**Phase 4 — Report rendering (days 8–11).** `assemble.ts` (injects interpolated numbers + resolved citations + audit log); on-screen report; `renderToBuffer` PDF route (fonts registered server-side); print-CSS fallback; sign-off block + disclaimer footer baked into the template.
*Produces:* the deliverable artifact judges download.

**Phase 5 — Demo, guardrails, submission (days 11–14).** Committed cached-LLM demo runs + Live toggle; Tavily lookup route (basic depth, cached, timeout → null); Vercel Firewall rule + per-IP bucket; deploy + cold-start check from incognito; cost ledger review; README (setup path + disclaimer + attribution) + LICENSE; rehearsal; record ≤3-min video showing real CSV → real report with model badges visible.
*Produces:* the submittable thing.

### Week split & stubs

- **Week 1 = Phases 1–2 + start 3** (calc engine + fixtures are the non-negotiable week-1 outcome; reasoning lands late week 1 / early week 2).
- **Week 2 = finish 3, all of 4–5.**
- **Stub list:** narrative fallback template (Phase 3 start — write it FIRST so Super failures degrade from day one); print-CSS report before react-pdf (PDF is an upgrade to a working fallback, never the reverse); Tavily last; fleet-triage and trend charts only if everything else is done (P2 features per FEATURES.md).

---

## Anti-Patterns (domain-specific — what kills this build)

### Anti-Pattern 1: The mega-prompt (extract + compute + narrate in one call)
**What people do:** one big Super call: "here's the CSV, compute acceptance and write the report."
**Why it's wrong:** untestable, per-reading token storms, LLM arithmetic, no streaming boundary, 429 exposure — every PITFALLS critical item at once.
**Do this instead:** fixed pipeline, one batched call per step, math in code between calls.

### Anti-Pattern 2: Trusting `json_schema` because the enum exists
**What people do:** ship `response_format: {type: "json_schema", strict: true}` and never parse defensively.
**Why it's wrong:** the API reference explicitly documents only `json_object`/`text` as supported; the guide marks schema-following model-dependent. A silent fallback to prose breaks `JSON.parse` mid-demo.
**Do this instead:** prompt-carried schema + `json_object` + Zod parse + one bounded retry (verified pattern), with `json_schema` as a tested-if-available extra.

### Anti-Pattern 3: Server-side session persistence
**What people do:** a database or server store for uploads/evaluations ("real app" instinct).
**Why it's wrong:** inspection data is client-confidential; Vercel Hobby has no free DB worth adding; retention is a credibility negative for this exact audience.
**Do this instead:** stateless server; evaluation JSON lives in the browser; the PDF route receives it per-request.

### Anti-Pattern 4: Tavily inside the acceptance loop
**What people do:** model-initiated tool loops (Nebius's own integration doc pattern) or lookup-before-verdict.
**Why it's wrong:** unbounded credit/token burn, retrieval latency inside the critical path, and a search outage becomes an acceptance outage.
**Do this instead:** one fixed basic lookup after acceptance completes; cached; failure = omitted links section.

### Anti-Pattern 5: Demo that depends on live model calls
**What people do:** demo mode = same endpoint, fingers crossed.
**Why it's wrong:** 429s, credits, or a deprecation mid-judging are all plausible inside the window.
**Do this instead:** committed cached responses for seeded scenarios + Live toggle; recorded backup video.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes / gotchas |
|---|---|---|
| Nebius Token Factory | `openai` SDK, `baseURL: https://api.tokenfactory.nebius.com/v1/`, env key; SSE `stream: true`; `json_object` + Zod; `max_completion_tokens`; `reasoning_effort: "low"` on Super | `json_schema` documented as model-dependent — verify per model; handle 429 + `Retry-After`; read `x-ratelimit-remaining-*` headers; watch weekly deprecation notices |
| Tavily | `@tavily/core`, pin `search_depth: "basic"`, `include_usage: true`, query-hash cache, hard timeout → null | 1,000 credits/mo free; `auto_parameters` can silently double credit cost; results are links/verification only — never citations, never cached-and-served text |
| Vercel | git-push deploy; `runtime = "nodejs"` on PDF + evaluate routes; Firewall rate-limit rule on model paths; env vars server-only | react-pdf will not run on Edge; 300 s maxDuration is headroom, not target — stream everything |

### Internal Boundaries

| Boundary | Communication | Rule |
|---|---|---|
| `app/api/*` → `lib/calc` | direct function calls | Calc is pure; handlers own I/O only |
| `lib/calc` → `lib/llm` | **FORBIDDEN import** (lint-enforced) | The invariant, mechanically checked |
| Pipeline → models | only through `lib/llm` gateway | One client factory; one cache; one ledger |
| LLM output → report | only through Zod + lints + `assemble.ts` | Renderer injects numbers + citations; model prose is the only free-form content |
| Evaluation → PDF | POST evaluation JSON, stateless | Session lives client-side; server retains nothing |

## Scaling Considerations

| Scale | Architecture adjustments |
|---|---|
| Demo (1–10 concurrent judges) | Everything above is already sufficient; rate limits + caps are the only real controls |
| Post-hackathon pilot (single plant, real users) | Add Upstash-backed cache + auth; per-org rate limits; durable audit storage; PDF rendering unchanged |
| SaaS (multi-tenant) | Dedicated Nebius endpoints (region-pinned), queue-based report jobs, real DB + audit retention — all deferred by design |

**First bottleneck: not compute — abuse.** Per-report cost is trivial; the constraints that bind are rate limits, credit abuse, and model-ID deprecations. Every guardrail above targets those. **Second bottleneck: perceived latency from India** — already neutralized by streaming + US-hosted function-to-model hop (STACK.md).

## Sources

Official, fetched 2026-09-24 — HIGH confidence:
- Nebius Token Factory API reference, `create-chat-completion.md` — response_format supports only `json_object`/`text` (request-level note; schema enum lists `json_schema`); `reasoning_effort` enum; `max_completion_tokens` semantics — https://docs.tokenfactory.nebius.com/api-reference/inference/create-chat-completion.md
- Nebius Token Factory "Structured output & JSON" guide — json_schema documented as model-dependent ("JSON mode" model-card tag); schema-in-prompt recommendation — https://docs.tokenfactory.nebius.com/ai-models-inference/json.md
- Next.js 16 route.js reference (16.3.6) — ReadableStream streaming pattern, nodejs runtime segment config, params-as-Promise, GET dynamic by default, Cache Components/`use cache` — https://nextjs.org/docs/app/api-reference/file-conventions/route
- react-pdf Node API (v4) — `renderToBuffer`/`renderToStream`/`renderToFile`, Node-only constraint, `Font.register` — https://react-pdf.org/node
- Zod 4 native `z.toJSONSchema()` (zod-to-json-schema superseded) — https://zod.dev
- Stack/Pitfalls/Features parallel research files (this document builds on their verified platform facts without re-deriving them)

Community, cross-checked — MEDIUM confidence:
- Vercel Firewall rate limiting on all plans incl. Hobby (1M allowed requests/mo; ~1 custom rule Hobby; DDoS mitigation default) — vercel.com blog + community.vercel.com
- In-memory Map unreliable for rate limiting/caching across serverless instances; Upstash Redis HTTP free tier (~10K commands/day) as the standard serverless alternative — upstash.com, dev.to, community reports

---
*Architecture research for: FlawCheck — NDT inspection copilot (Nebius x NVIDIA Global AI Hackathon)*
*Researched: 2026-09-24*
