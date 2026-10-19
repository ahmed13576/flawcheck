# Roadmap: FlawCheck — NDT Inspection Copilot

## Overview

FlawCheck ships as a five-phase vertical build for the Nebius x NVIDIA hackathon deadline (30 Oct 2026, 10:30pm GMT+5:30). Phase 1 proves the Nebius Token Factory foundation before anything depends on it — live model catalog dumped, env-configured routing validated at startup, and the `json_object` → Zod → one-retry + SSE pattern demonstrated against both routed Nemotron models. Phase 2 builds the deterministic heart: ingestion (CSV mapping preview, metadata, PT/MT notes) and a pure, golden-tested calc engine that would stand alone even if every LLM call failed. Phase 3 wraps computed verdicts in Nemotron reasoning — Lightning extraction, Super-120B narrative streamed into a visible reasoning chain, citations locked to a builder-vetted edition-pinned allowlist. Phase 4 turns evaluations into a defensible PDF artifact with a print-CSS fallback that ships regardless of PDF-library health. Phase 5 hardens the whole into a judge-ready submission: cached one-click demo scenarios with a Live-model toggle, abuse guarding, Tavily edition lookups, public deployment, and the video/repo deliverables. Each phase ends with something testable; the three demo-fatal risks (deprecated model IDs, LLM arithmetic, hallucinated citations) are each closed in the phase where they first appear.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Platform Spike & App Skeleton** - Prove Nebius Token Factory connectivity, startup-validated model routing, and the validated-call pattern before any feature depends on them
- [x] **Phase 2: Ingestion & Deterministic Calc Engine** - Raw data in, deterministic verdicts out: CSV preview, metadata, PT/MT notes, and a pure unit-tested calc engine with golden fixtures
- [x] **Phase 3: LLM Reasoning & Citation Layer** - Streamed, clause-cited acceptance narratives around precomputed verdicts; the LLM never computes and can only cite the vetted allowlist
- [x] **Phase 4: Report Rendering** - Evaluations become a defensible PDF report with sign-off and disclaimer baked in, plus a guaranteed print-CSS fallback
- [x] **Phase 5: Demo Hardening, Deployment & Submission** - Cached one-click demo with Live toggle, abuse guarding, Tavily lookup, public deploy, and the video/repo deliverables
- [x] **Phase 6: Report Digestibility & At-a-Glance Findings** - Presentation engine & executive dashboard: plain-English brief, two-page PDF split, shared verdict glossary, two-tier demo loader

### Milestone v3 — System-1 Fast Decision Architectures

- [ ] **Phase 7: Decision Provider Seam & Nebius Fast Decision Engine (Fork A)** - Pluggable `DecisionProvider` typed seam (`choice`, `noul`, `score`), `NebiusNemotronDecisionProvider` on `feat/nvidia-system1`, 4 domain spikes with fail-closed gates, and pure TS calc invariant.
- [ ] **Phase 8: SubQ.ai Snap Decision Engine & Multi-Modal Benchmark (Fork B)** - `SubQSnapDecisionProvider` on `feat/subq-snap` calling `POST /v1/systemone` (`subq-snap-preview`) with native questions & multimodal image support, 4 domain spikes, and comparative benchmark suite.
- [ ] **Phase 9: Visual Inspection Analytics & Vector PDF Integration** - Animated SVG/CSS inspection aids (wall loss trend curves, CML spatial severity heatmap, safety margin metric gauges) and lossless vector serialization into `@react-pdf/renderer` PDF reports.

## Phase Details

### Phase 1: Platform Spike & App Skeleton

**Goal**: The Nebius Token Factory foundation is proven before any feature work depends on it — live model catalog committed, env-configured routing validated at startup, and the validated-call pattern (json_object → Zod → one bounded retry, SSE streaming) demonstrated against both routed models (Super-120B and Lightning; Ultra-253B/Nano-Omni are confirmed removed from serverless)
**Depends on**: Nothing (first phase)
**Requirements**: PLAT-01, PLAT-02
**Success Criteria** (what must be TRUE):

  1. A committed `docs/model-catalog.json` (live `GET /v1/models` dump) exists in the repo, model IDs are read from env config only, and a repo grep finds no hardcoded model IDs in source
  2. App startup (surfaced via `/api/health`) validates configured model IDs against the live catalog and shows an explicit red-banner failure naming the missing model when a routed ID has been deprecated — a stale ID can never silently reach a live call
  3. A hello-fixture call against BOTH Super-120B and Lightning returns structured JSON that passes Zod validation, and a forced-bad-output test proves the one bounded retry fires with a clear error surfaced after it
  4. An SSE streamed response from Token Factory is consumed end-to-end through a route handler to a client, proving the streaming path the Phase 3 reasoning pane will build on
  5. The spike record states whether `json_schema` structured output works on Super-120B/Lightning, and the @react-pdf/renderer 4.9.0 + React 19.3 install result is recorded so Phase 4 can choose print-CSS-first vs react-pdf-first on evidence

**Plans**: 4/4 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Scaffold Next.js 16 via temp-dir ADD-only merge; single user-approved install gate (checkpoint)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Env contract + API-key checkpoint + validated-call tracer proven live on both routed models

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Startup model validation, /api/health red banner, SSE spike route + client page
- [x] 01-04-PLAN.md — Offline exactly-one-retry proof, committed docs/model-catalog.json dump, spike record (json_schema + react-pdf)

### Phase 2: Ingestion & Deterministic Calc Engine

**Goal**: Raw inspection data in, deterministic verdicts out — CSV upload with editable mapping preview, component metadata, and PT/MT notes feed a pure, unit-tested calc engine (t-required, short/long-term corrosion rate, remaining life, verdict bands, outliers, re-inspection interval) that would stand alone even if every LLM call failed
**Depends on**: Phase 1
**Requirements**: ING-01, ING-02, ING-03, ING-04, ING-05, CALC-01, CALC-02, CALC-03, CALC-04
**Success Criteria** (what must be TRUE):

  1. User can upload a UT thickness CSV and see a column-mapping preview they can confirm or correct; malformed CSVs, missing fields, and impossible values return specific error messages naming the row and problem — never silent garbage
  2. User can enter component metadata (t-nominal, material, service, corrosion allowance, code + edition) that drives criteria selection; units are explicit at input (mm/in/mils) with mm canonical internally, and mixed-unit inputs are refused with an explanatory error
  3. User can enter PT/MT indication notes with component context and see them carried into the evaluation session alongside UT data
  4. Golden tests built from the builder's hand calculations pass on curated fixtures (verified Zenodo record 16780668 UT subset + honestly-labeled PT/MT samples): t-required, short/long-term corrosion rate, remaining life, re-inspection interval with cited rule, and outlier/re-shoot flags all match hand-worked values exactly
  5. Every CML and indication receives a pass / re-check / fail verdict including the gauge-uncertainty band, computed in pure TypeScript with a forbidden-import lint proving the calc module never references LLM code

**Plans**: 5/5 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Tracer: sample CSV → parse → map → compute → verdict chip on screen (calc spine + tokenizer core + session model)

**Wave 2** *(parallel)*

- [x] 02-02-PLAN.md — Calc engine completion: golden catalog G1–G13 + P1–P7, evaluate orchestration, forbidden-import lint + purity gates
- [x] 02-03-PLAN.md — Ingestion completion: alias mapping, validation catalog, long-format grouping, units gate; Zenodo demo fixture + attribution + sample CSV

**Wave 3**

- [x] 02-04-PLAN.md — Wizard Screens 1–2: dropzone states, mapping panel, parsed-row table, metadata form (MPa|psi selector), PT/MT entry, evaluation gating

**Wave 4**

- [x] 02-05-PLAN.md — Wizard Screen 3: results table + flag details + PT/MT triage; demo end-to-end assertions; phase verification wrap

### Phase 3: LLM Reasoning & Citation Layer

**Goal**: Every computed verdict gains a streamed, clause-cited acceptance narrative — Lightning structures the raw inputs, Super-120B narrates strictly around precomputed values, and citations resolve only against the builder-vetted, edition-pinned allowlist, with a deterministic fallback narrative shipped first
**Depends on**: Phase 2 (computed verdicts must exist before any reasoning work narrates around them)
**Requirements**: REAS-01, REAS-02, REAS-03, REAS-04, REAS-05, PLAT-05
**Success Criteria** (what must be TRUE):

  1. Lightning extracts/structures readings and notes into Zod-validated JSON with one bounded retry, and bad input fails loudly at this step rather than proceeding to the narrative with garbage
  2. Super-120B produces the acceptance narrative strictly around precomputed verdicts, streaming (SSE) into a visible reasoning pane UI showing inputs → clause → limit → verdict per decision; numeric-consistency and verdict-agreement lints reject any narrative that contradicts the computed values
  3. Every clause citation renders only from the builder-vetted, edition-pinned `citations.json` allowlist — an unknown or fabricated ID renders blank with an audit stamp, never a plausible fake (renderer-enforced, CI-checked)
  4. PT/MT indications are evaluated against the builder's structured criteria config (L2 ground truth) with per-indication verdicts the narrative references
  5. A status line with model badges shows which Nemotron model (plus tokens/cost) handled each pipeline step

**Plans**: 2/7 plans executed
**UI hint**: yes

Plans:
**Wave 1**

- [x] 03-00-PLAN.md — Flowstep GUI integration wave 1: 5-package install checkpoint + phase-start ref, oklch token system + ui primitives, Screen 1-2 restyle with functional parity (six mapping targets kept), 25 MB cap, UNINSTALL Phase 3 ledger, FS-01..FS-08 pins

**Wave 2**

- [x] 03-00b-PLAN.md — Flowstep GUI integration wave 2: Screen 3 restyle (real-data KPI cards, tabs/search/legend, sticky CML+Verdict columns), locked /report preview (Screen 4), FS-01..FS-12 test pins

**Wave 3**

- [ ] 03-01-PLAN.md — Tracer: fallback-first cited reasoning slice end-to-end (tokenizer + fallback + narrative route frame protocol + CitationChip/ReasoningPane + 11-column sticky table) on the Flowstep-restyled screens

**Wave 4** *(parallel)*

- [ ] 03-02-PLAN.md — LLM server layer: Lightning extraction route + Super-120B streamed narrative with sentence-guard + four lints + usage capture + live-gated fixture proof
- [ ] 03-03-PLAN.md — Client streaming layer: narrative store (evaluatedAt-keyed cache, abort, FIFO cap) + store-backed pane UX

**Wave 5**

- [ ] 03-04-PLAN.md — Screen 3 integration: ReasoningProvider + Pipeline status bar + extraction-failure banner + PT/MT panes + re-evaluation reset (integrated into the 03-00/03-00b-restyled components)

**Wave 6**

- [ ] 03-05-PLAN.md — Phase verification wrap: offline e2e fallback-mode gates, purity/grep/dependency-ledger invariants (phase-start-ref byte-identity), UNINSTALL verification, UI-25..48 + FS-01..FS-12 + SC1-5 coverage summary

### Phase 4: Report Rendering

**Goal**: The evaluation becomes a defensible, downloadable artifact — a clause-cited PDF report with inspector sign-off and disclaimer baked in from the first template version, with a print-CSS fallback guaranteed independent of PDF-library health
**Depends on**: Phase 3 (requires the stable evaluation data model)
**Requirements**: REPT-01, REPT-02, REPT-03
**Success Criteria** (what must be TRUE):

  1. User can export a PDF containing report header, CML grid, indication table, clause-cited conclusions, revision block, inspector sign-off, and disclaimer — with every number interpolated from computed values and every clause citation resolved through the allowlist
  2. The report includes an audit appendix listing timestamps, input hashes, and model + version per pipeline step
  3. The print-CSS fallback renders the complete report even when the PDF route is disabled — proven by toggling the PDF path off and still getting a full printable report
  4. Every rendered report carries the unit assumption, "pending inspector sign-off" framing, and disclaimer consistently, with no verbatim ASME/API code text anywhere in the output

**Plans:** 4 plans

**Wave 1**

- [ ] 04-01-PLAN.md — Report session contract: sign-off persistence + pure content seam + audit telemetry (input hash, per-step usage) + Screen 3 CTA unlock with live audit writer

**Wave 2** (parallel — zero file overlap)

- [ ] 04-02-PLAN.md — PDF boundary: WR-10 full Zod snapshot schema + react-pdf 1:1 document + /api/report/pdf Node-runtime route (real buffer, 400 gate)
- [ ] 04-03-PLAN.md — Unlocked report surface: sign-off gate + chip flip + audit appendix + /report actions + /report/print print-CSS fallback (PDF-route independent)

**Wave 3**

- [ ] 04-04-PLAN.md — Phase wrap: full-chain integration proof + standing gates + byte-identity/zero-install invariants + UI-49..58 / REPT-01..03 coverage sweep

**UI hint**: yes

### Phase 5: Demo Hardening, Deployment & Submission

**Goal**: Judges get a complete, coherent product — a public URL running cached one-click demo scenarios with a Live-model toggle, abuse-guarded endpoints, Tavily edition lookups that decorate without blocking, and a licensed, documented repo with a ≤3-minute video — submitted before the 30 Oct 2026 deadline
**Depends on**: Phases 1–4 (cached demo responses require all upstream steps to exist)
**Requirements**: PLAT-03, PLAT-04, DEMO-01, DEMO-02, DEMO-03, DEMO-04
**Success Criteria** (what must be TRUE):

  1. One-click demo mode loads the verified Zenodo tank dataset and honestly-labeled PT/MT scenario and runs end-to-end from committed cached LLM responses (zero live calls); a "Live model" toggle re-runs the same scenario against real Nemotron endpoints
  2. The app is deployed to a public URL with Nebius Token Factory as the AI backend, and an incognito cold-start demo run succeeds without local setup
  3. Tavily code-edition/errata lookup runs post-acceptance, is cached, and a simulated timeout/failure degrades to no-links without blocking or delaying the acceptance flow
  4. The demo path is abuse-guarded: unguessable path, per-IP rate limit and token caps that return 429 with Retry-After rather than burning credits
  5. The repo is public with an OSS license and README (clone-to-running setup, Nebius/NVIDIA usage highlighted, disclaimer, dataset attribution); a ≤3-minute video with audio shows at least one minute of the working solution with model badges visible

**Plans**: TBD

### Phase 6: Report Digestibility & At-a-Glance Findings

**Goal**: A human inspector can understand a full evaluation in seconds — the results screen leads with a plain-English summary of what was found and why it matters, and the report presents findings hierarchically (disposition → worst locations → detail) instead of thousands of flat entries
**Depends on**: Phases 1–5 (the PDF subset + hash seal from Phase A remediation is the foundation to build on)
**Requirements**: REPT-04, REPT-05, REPT-06, DEMO-05
**Success Criteria** (what must be TRUE):

  1. The results screen contains a plain-language "What we found" brief — disposition in one sentence, the N locations that need attention, and what each verdict means — understandable by a non-NDT reader
  2. The certified PDF leads with an at-a-glance summary a human can verify without scrolling through thousands of entries; the governing CML register is the detail layer, not the front page
  3. Verdict meaning (ACCEPT / RE-CHECK / FAIL) is explained in layman terms wherever a verdict chip appears

**Plans**: 2 plans

Plans:
**Wave 1**

- [ ] 06-01-PLAN.md — Presentation engine in the pure content seam: buildFindingsBrief + buildCodeBreakdown + VERDICT_GLOSSARY + dashboard copy builders, PDF two-<Page> restructure (page-1 executive dashboard, RL-ascending top-10), HTML report glossary block, full-suite gates

**Wave 2** *(blocked on Wave 1 — imports 06-01 exports)*

- [ ] 06-02-PLAN.md — Wizard surfaces + demo composition: Screen 3 What-we-found brief mount + glossary footer, WBT-S6 subset fixture (generator + reducer load-demo-full + scope-aware provenance banner), Screen 1 two-tier demo buttons, full-suite gates

### Phase 7: Decision Provider Seam & Nebius Fast Decision Engine (Fork A)

**Goal**: Define a unified, strictly-typed `DecisionProvider` seam (`choice`, `noul`, `score`), implement `NebiusNemotronDecisionProvider` on Nebius Token Factory (`nvidia/Nemotron-3_5-Lightning`) in isolated worktree `../flawcheck-nvidia-system1` (`feat/nvidia-system1`), prove 4 NDT domain spikes with fail-closed thresholds, and enforce pure TypeScript calculation sovereignty with zero LLM arithmetic.
**Depends on**: Phases 1–6 (evaluation session model, golden calculation fixtures, citation allowlist)
**Requirements**: DEC-01, DEC-02, DEC-03, DEC-04, SPIKE-01, SPIKE-02, SPIKE-03, SPIKE-04
**Success Criteria** (what must be TRUE):

  1. Pluggable `DecisionProvider` TypeScript interface in `lib/decision/types.ts` enforces typed primitives (`choice`, `noul`, `score`) with zero freeform text leakage, typed probability distributions, and scalar confidence ratings.
  2. `NebiusNemotronDecisionProvider` connects to Nebius Token Factory (`nvidia/Nemotron-3_5-Lightning`) with zero-temperature JSON mode and balanced-brace JSON extraction fallback (`extractBalancedObjects`) to eliminate prose preamble parsing errors.
  3. 4 NDT Domain Spikes proven:
     - **Spike A (Fluid Classifier)**: Classifies process descriptions into API 570 Table 1 (Class 1–4) with $\ge 95\%$ accuracy and fail-closed inspector review trigger ($p < 0.85$).
     - **Spike B (Fleet Triage)**: Batch-screens 4,912 Zenodo UT readings into Tiers 1–3 routing without memory leaks or rate-limit failures.
     - **Spike C (PT/MT Morphology)**: Classifies indication notes into linear vs rounded per ASME B31.3 §344.4.2 without false negatives on crack notes.
     - **Spike D (Semantic Guard)**: Non-autoregressive verification validating that report narratives only cite allowlisted standards and match computed values.
  4. Calculation Invariant: Pure TypeScript (`lib/calc/`) computes 100% of arithmetic ($t_{\text{required}}$, $CR$, $RL$, intervals); all tests run and pass hermetically when `FLAWCHECK_DISABLE_LLM=1`.
  5. Worktree `../flawcheck-nvidia-system1` on `feat/nvidia-system1` builds cleanly (`npm run build`) and passes all 504+ tests (`npm test`).

**Plans**: 1 plan

Plans:
**Wave 1**

- [x] 07-01-PLAN.md — Pluggable DecisionProvider interface, Nebius Nemotron-3.5-Lightning adapter, 4 domain spikes with fail-closed gates, and pure calc invariant verification.

### Phase 8: SubQ.ai Snap Decision Engine & Multi-Modal Benchmark (Fork B)

**Goal**: Implement `SubQSnapDecisionProvider` on SubQ.ai Snap Decision API (`POST /v1/systemone`, model `subq-snap-preview`) in isolated worktree `../flawcheck-subq-snap` (`feat/subq-snap`) with native `choice`/`noul`/`score` questions and multimodal image evaluation, execute the 4 domain spikes, and produce an automated comparative benchmark suite comparing Nemotron-Lightning vs SubQ Snap.
**Depends on**: Phase 7 (`DecisionProvider` seam contracts, spike fixtures, baseline metrics)
**Requirements**: SUBQ-01, SUBQ-02, SUBQ-03, BENCH-01
**Success Criteria** (what must be TRUE):

  1. `SubQSnapDecisionProvider` implements `DecisionProvider` calling `POST /v1/systemone` using model `subq-snap-preview` with native `choice`, `noul`, and `score` questions, zero output token charges (`output_tokens: 0`), and clean HTTP 4xx/5xx error handling.
  2. Multi-modal evaluation verified sending base64 PNG/JPEG dye penetrant and A-scan indication images ($\le 4\text{ MiB}$) to `subq-snap-preview` for defect morphology classification without data URI prefix errors.
  3. All 4 Domain Spikes (Fluid Classifier, Fleet Triage, PT/MT Morphology, Semantic Guard) execute against SubQ Snap with identical interface contracts.
  4. Automated comparative benchmark suite (`lib/decision/benchmark/`) evaluates Nemotron-Lightning vs SubQ Snap across Spikes A–D, recording latency distributions (min/mean/p50/p95/p99), calibration (Brier score / ECE on boundary edge cases), and cost per 1,000 evaluations into `docs/system1-benchmark-report.json`.
  5. Worktree `../flawcheck-subq-snap` on `feat/subq-snap` builds cleanly (`npm run build`) and passes all 504+ tests (`npm test`).

**Plans**: 1 plan

Plans:
**Wave 1**

- [ ] 08-01-PLAN.md — SubQ Snap Decision API client, native question & multimodal image adapter, 4 domain spikes execution, and comparative benchmark harness.

### Phase 9: Visual Inspection Analytics & Vector PDF Integration

**Goal**: Deliver lightweight, animated SVG and CSS inspection analytics across web and certified PDF reporting surfaces (wall loss degradation curves, CML spatial severity heatmap, safety margin metric gauges) using pure coordinate math with zero heavy charting library dependencies.
**Depends on**: Phase 6 & Phase 7/8 (consumes evaluated CML register and PDF report infrastructure)
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04
**Success Criteria** (what must be TRUE):

  1. Pure TypeScript geometry engine `lib/analytics/geometry.ts` calculates coordinates, axes, data points, and SVG path strings (`d="..."`) with zero DOM dependencies, shared seamlessly between web and PDF renderers.
  2. Wall Loss Velocity & Trend Curves SVG component renders time-series thickness readings, linear degradation trajectory, remaining life intercept at $t_{\text{required}}$, and confidence uncertainty envelope with GPU-accelerated CSS animations respecting `prefers-reduced-motion`.
  3. CML Spatial Severity Heatmap renders color-coded piping segment grid (accept green, re_check amber, reject red) with inspection density overlays and interactive tooltips.
  4. Animated Metric Gauges illustrate safety margin above $t_{\text{required}}$ and corrosion velocity using SVG circular arcs and smooth CSS transitions.
  5. Certified PDF report export (`components/report/pdf-document.tsx`) integrates vector trend curves and heatmap summaries using `@react-pdf/renderer` primitive components (`Svg`, `Path`, `Line`, `Circle`, `Rect`) with 100% vector resolution independence.

**Plans**: 1 plan

Plans:
**Wave 1**

- [ ] 09-01-PLAN.md — Shared SVG geometry math, interactive web analytics components (trend curve, heatmap, gauge), and certified @react-pdf/renderer vector serialization.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Platform Spike & App Skeleton | 4/4 | Complete (verified 15/15, 2026-09-27) | 2026-09-27 |
| 2. Ingestion & Deterministic Calc Engine | 5/5 | Complete (verified 50/50 + browser walkthrough, 2026-09-27) | 2026-09-27 |
| 3. LLM Reasoning & Citation Layer | 7/7 | Complete (verified 52/52 + enabled-path walkthrough, 2026-10-05) | 2026-10-05 |
| 4. Report Rendering | 4/4 | Complete (verified 2026-10-05) | 2026-10-05 |
| 5. Demo Hardening, Deployment & Submission | Complete | Complete (deployed + audit, 2026-10-08) | 2026-10-08 |
| 6. Report Digestibility & At-a-Glance Findings | 2/2 | Complete (verified 6/6 + 583 tests, 2026-10-10) | 2026-10-10 |
| 7. Decision Provider Seam & Nebius Fast Engine (Fork A) | 1/1 | Complete (verified 621/5 tests + 24 live calls, 2026-10-19) | 2026-10-19 |
| 8. SubQ Snap Engine & Multimodal Benchmark (Fork B) | 0/1 | Planned | - |
| 9. Visual Inspection Analytics & Vector PDF | 0/1 | Planned | - |
