# Project Research Summary

**Project:** FlawCheck (working title) — NDT Inspection Copilot (Nebius x NVIDIA Global AI Hackathon)
**Domain:** Vertical AI workflow app — engineering-document generation with a deterministic computation core (NDT code-compliance reporting against ASME/API-style criteria)
**Researched:** 2026-09-24 (all four research files verified platform facts against live official docs the same day)
**Confidence:** HIGH for platform/stack facts (official primary sources, cross-checked); MEDIUM for features and legal positioning

## Executive Summary

FlawCheck turns raw NDT inspection data — ultrasonic (UT) thickness CSVs, PT/MT indication notes, and component metadata — into defensible, clause-cited acceptance reports. The research converges on one controlling idea, stated independently by three of the four files: **TypeScript computes every number; the LLM only extracts, structures, and narrates around precomputed results.** Expert practice for safety-adjacent engineering tools is a fixed code-orchestrated pipeline (parse → compute → narrate), never a chat wrapper or agentic loop, and never LLM arithmetic — multi-step math is where models confidently fail, and a single wrong digit flips a pass into a fail on a pressure-retaining component. The winning product shape is a wizard (upload → editable parse preview → verdict table with reasoning pane → PDF report), not chat, because the hackathon explicitly judges "complete, coherent product experience — not just a technical proof of concept" and judges discount GPT-wrappers on sight.

The recommended stack is Next.js 16 (App Router, TypeScript) deployed free on Vercel Hobby, calling NVIDIA Nemotron models on Nebius Token Factory through the standard OpenAI SDK: `nvidia/nemotron-3-super-120b-a12b` ($0.30/$0.90 per 1M in/out) for the acceptance-reasoning narrative and `nvidia/Nemotron-3_5-Lightning` ($0.06/$0.24, 1M context) for extraction/structuring, with Tavily's free 1,000 credits/month doing non-blocking code-edition/errata verification after acceptance completes. At ~$0.004–0.005 per full report, $25 covers 5,000+ runs — volume is a non-issue; the binding constraints are rate limits, credit abuse, and model-ID deprecation. **One correction to PROJECT.md before roadmap:** the planned routing ("Ultra for reasoning, Nano/Super for extraction") is obsolete — `nvidia/Llama-3_1-Nemotron-Ultra-253B-v1` and `nvidia/Nemotron-3-Nano-Omni` were removed from serverless on 2026-08-31, requests hard-fail with no auto-reroute, and "Serverless Jobs" (batch) no longer exists. Build against a day-1 `GET /v1/models` dump with env-configured IDs and startup validation; another removal wave inside the hackathon window is plausible.

The top risks: (1) hallucinated clause citations in a product whose pitch is defensible citations — mitigated by a builder-owned citation allowlist enforced at the renderer (the model may only emit allowlist IDs); (2) copyright exposure from ASME/API text — mitigated by a cite-don't-quote architecture (clause numbers and formula parameters are unprotectable methods; verbatim standard text never enters repo, prompts, or output, and Tavily links out instead of serving text); (3) liability positioning — every verdict renders as "acceptable per [criterion] — pending inspector sign-off" with a disclaimer footer and hard-coded escalation of crack-suspect indications to the inspector; (4) demo credibility — solved by a verified real dataset (Zenodo record 16780668: 4,912 real UT readings, 12 tanks, 11 annual campaigns, CC BY 4.0 — downloaded and inspected during research) plus builder-authored piping/PT-MT samples honestly labeled; and (5) demo-day fragility — solved by committed cached LLM responses for seeded scenarios plus a "Live model" toggle proving real Nemotron usage.

## Key Findings

### Recommended Stack

Full detail in [STACK.md](./STACK.md). The platform facts were verified same-day against official Nebius/Vercel/Tavily docs; framework choices are judgment calls grounded in those verified facts.

**Core technologies:**
- **Nebius Token Factory (public serverless inference)** — OpenAI-compatible `/v1` API, `openai` SDK 7.23.0 with `baseURL` override; supports `stream: true` (SSE), `reasoning_effort` (`none`…`xhigh`), `max_completion_tokens`. Guaranteed structured output is `json_object` only (`json_schema` is documented as model-dependent) — always pair with prompt-carried schema + Zod + one bounded retry.
- **Model routing (corrected):** `nemotron-3-super-120b-a12b` for the acceptance narrative (`reasoning_effort: "low"`, ~2000-token cap); `Nemotron-3_5-Lightning` for extraction/structuring; `Nemotron-3-Nano-30B-A3B` as identical-price fallback. Do NOT use `Nemotron-3-Ultra-550b-a55b` (3.3× input cost, zero demo benefit) or the removed Ultra-253B/Nano-Omni.
- **Next.js 16.3.6 + React 19.3.0** — one repo/language, native SSE streaming in route handlers, the strongest "coherent product" look. Rejected: Streamlit (fights streaming/wizard state, demo aesthetic scores against judging), FastAPI+HTMX (two runtimes for the same demo).
- **Vercel Hobby** — $0, 300 s function maxDuration (verified headroom), git-push deploy, Firewall rate limiting available. Node runtime required for PDF routes (react-pdf won't run on Edge).
- **Tavily free tier** — 1,000 credits/mo; pin `search_depth: "basic"` explicitly (1 credit; `auto_parameters` can silently double it), `include_usage: true`, one fixed lookup per evaluation, failure degrades gracefully to no-links.
- **Supporting:** `@react-pdf/renderer` 4.9.0 (Node-only, register fonts server-side — known gotcha), `papaparse` + `zod` at every parse boundary, `vitest` for golden files. Notably NOT: LangChain/LlamaIndex (agentic token burn), Puppeteer HTML-to-PDF (Chromium on Hobby), client-side API keys (public repo = keys scraped in hours), Token Factory Sandboxes (solves a problem this app doesn't have).

**Cost/latency posture:** ~$0.004–0.005 per report → 5,000+ runs on $25; abuse, not volume, is the risk. Streaming is mandatory (measured India RTT ~200 ms, TTFB 0.6–1.2 s) — but the US-hosted Vercel function calls Nebius US-side, so the penalty applies mainly to local dev.

### Expected Features

Full detail in [FEATURES.md](./FEATURES.md). No scanned competitor (DocuMatrix OCR, Sonatest/Zetec instrument software, Spectora home-inspection AI) combines CSV ingestion + deterministic code acceptance + clause-cited reasoning — that intersection is open.

**Must have (table stakes):**
- CSV upload with column-mapping preview + editable parse table (instrument exports vary; fixed schema fails on first contact)
- Explicit units handling (mm canonical internally; mm/inch/mils displayed; mixed units refused — the classic 25.4× NDT blunder)
- Component metadata form (OD, t-nominal, corrosion allowance, material, service, code + edition)
- Deterministic acceptance math (t-required, CR short/long-term, remaining life) as pure unit-tested functions
- Verdict chips per CML/indication: accept / **re-check** / reject (re-check band is the outcome every amateur build misses)
- CML reading table with stats; PDF export with header, revision block, signature block; audit trail (timestamp, input hash, model + tokens per step); junk-input validation; one-click demo mode

**Should have (differentiators):**
- Clause-cited acceptance decisions (citation IDs + computed limits, never verbatim code text) — the moat and the "genuine problem-space understanding" scoring axis
- Visible reasoning chain per decision (inputs → clause → limit → verdict) with SSE-streamed narrative
- Data-quality flagging before acceptance (outliers, re-shoot flags — grounded in the real dataset's QC columns)
- Re-inspection interval suggestion; Nemotron model badges + token/cost meter (prize alignment, cheap)
- Tavily live edition/errata lookup; user-pasted code excerpts for personalized reasoning (transient, never stored)

**Defer (v1.x → v2+):** fleet triage table and CML trend charts (P2 — build only as read-only views over completed evaluations); vision defect triage on radiographs (v2; GDXray is research-only licensed — never bundle images); OCR of legacy reports; auth/teams/multi-tenant; fine-tuning; 3D C-scan viz; native instrument binary formats.

**Demo data verdict:** 5 end-to-end scenarios are covered — 3 on the verified real Zenodo tank register, 1 on builder-authored piping/PT-MT samples traceable to published worked examples (no public piping CML dataset exists — verified absence), 1 v2 vision. Video should run scenario 1 (single-tank acceptance, real data) and scenario 4 (piping + PT/MT, clause citations), with the fleet table as closing shot.

### Architecture Approach

Full detail in [ARCHITECTURE.md](./ARCHITECTURE.md). The one-sentence architecture: a fixed, code-orchestrated pipeline where TypeScript computes every number, the LLM only narrates around precomputed results, citations are injected from a builder-owned allowlist at render time, and the server is stateless — session state lives in the browser (no DB, by design; inspection data is client-confidential and retention is a credibility negative for this audience).

**Major components:**
1. **`lib/calc/`** — pure, dependency-free TS (units, t-min, corrosion rate, remaining life, quality flags, verdict banding); a forbidden-import lint (`calc` may never import `llm`) makes the "LLM never computes" invariant CI-enforceable
2. **LLM Gateway (`lib/llm/`)** — the only code touching the OpenAI SDK: env-configured routing, Zod schema contracts, `json_object` + parse + one bounded retry, verdict-agreement and numeric-consistency lints, SHA-256 input-hash cache
3. **Thin route handlers** — `/api/parse`, `/api/evaluate` (SSE), `/api/report/pdf`, `/api/lookup`, `/api/health` (startup model validation surfaces here); orchestrate I/O only
4. **Citation layer** — `citations.json` allowlist (10–20 builder-vetted entries, edition-pinned); renderer resolves or rejects; unknown ID → blank + audit stamp, never a plausible fake
5. **Report layer** — `assemble.ts` interpolates all numbers from computed values; `@react-pdf/renderer` route + print-CSS fallback; sign-off block + disclaimer baked into the template
6. **Demo mode** — committed cached LLM responses keyed by input hash (zero live-call demo runs) + "Live model" toggle

**Controlling failure philosophy:** every failure left of the narrative step blocks loudly (bad data must not proceed); every failure at or right of the narrative degrades gracefully to a deterministic fallback (the acceptance result is already safe). Tavily sits furthest right — it decorates, never decides.

### Critical Pitfalls

Full detail in [PITFALLS.md](./PITFALLS.md), including warning signs, integration gotchas, and a "looks done but isn't" checklist.

1. **Deprecated model IDs (P1, CRITICAL)** — the planned Ultra/Nano-Omni were removed 2026-08-31; no auto-reroute. Day-1 `GET /v1/models` dump committed to repo, IDs in env only, startup validation against the live list, weekly deprecation-notice watch. Phase 1, first technical task.
2. **LLM does the engineering math (P2, CRITICAL)** — confident plausible wrong numbers flip verdicts; models often skip calculator tools even when offered. Architectural invariant, not a prompt guideline: deterministic pipeline forces computation order in code; golden-file tests from the builder's hand calculations. Phase 2.
3. **Hallucinated citations (P3, CRITICAL)** — measured ~56% citation error rates, 1-in-5 fabricated; the dangerous mode is a real clause number on wrong content. Allowlist + renderer enforcement + CI check; edition pinning; the allowlist IS the builder's domain moat. Phase 3.
4. **Copyright exposure from code text (P4, CRITICAL)** — cite, don't quote; § 102(b) protects formulas/methods, not the paragraph around them; user-pasted excerpts transient-only; verify via API IBR Reading Room / PHMSA (read-only, link out); zero standard text in repo/prompts/RAG. Rule set in Phase 1, audit in Phase 5.
5. **Liability positioning (P5)** — "pending inspector sign-off" framing everywhere; disclaimers consistent across UI, report, README; crack-suspect indications hard-coded to escalate. Phase 4.
6. **The wrapper/POC trap (P6)** — wizard shape from day one; demo shows real CSV → real report on the deployed URL with model-status line visible; rehearsed ≤3-min video with audio. Phase 1 (shape) + Phase 5 (rehearsal).
7. **Fake-looking demo data (P7)** — CML grid structure, plausible spread, wall-loss patterns, mixed accept/re-check/fail outcomes, honest labeling. Mitigated heavily by the real Zenodo dataset. Phases 1–2.
8. **Credit/key/abuse posture** — keys server-only; unguessable demo path + Vercel Firewall rule + per-IP bucket + token caps; 429/`Retry-After` handling; test top-up card in week 1 (RBI recurring-mandate blocks are plausible from India); daily balance checks final week.

## Implications for Roadmap

All four files independently converge on the same 5-phase structure (ARCHITECTURE.md's build order matches PITFALLS.md's pitfall-to-phase mapping). Suggested roadmap — a 2-week MVP inside the hackathon window (deadline 30 Oct 2026, 10:30pm GMT+5:30):

### Phase 1: Platform Spike & Skeleton (days 1–2)
**Rationale:** Everything downstream depends on knowing which models actually exist and proving the schema-validated-call pattern; PITFALLS P1 explicitly demands the model-availability spike as the first technical task, and the copyright/wrapper rules must be set before the first prompt is written.
**Delivers:** Committed `docs/model-catalog.json` (live `/v1/models` dump); env-configured model routing + startup validation with red-banner `/api/health`; `llm-client` + `call-validated` (json_object → Zod → 1 retry) proven against both models with a hello-fixture; Phase-1 spike records whether `json_schema` works on Super/Lightning; wizard page scaffold; CI hygiene from commit one (no-code-text rule, secrets scan).
**Addresses:** demo-mode entry, audit-log groundwork, model-badge groundwork; PROJECT.md routing decision corrected to Super-120B/Lightning.
**Avoids:** P1 (deprecated IDs), P4 (rules before first prompt), P6 (pipeline-first shape fixed from day one).

### Phase 2: Deterministic Calc Engine + Fixtures (days 2–5)
**Rationale:** The calc engine is the core value and the dependency for every differentiator (clause-cited acceptance, re-inspection interval, fleet triage). Fixtures are built alongside because one data-authoring effort pays off three times (golden tests + demo seed + cached-LLM keys) — flagged independently by both FEATURES and ARCHITECTURE research.
**Delivers:** `lib/calc/` complete (units, t-min, CR ST/LT, remaining life, interval rule, quality flags, verdict banding including the re-check band); curated Zenodo UT subset + builder-authored PT/MT samples; vitest golden tests from the builder's hand calculations; `/api/parse` + editable preview-table UI.
**Uses:** papaparse + zod, vitest, pure-TS module boundary with forbidden-import lint.
**Avoids:** P2 (LLM math — the invariant becomes testable here), P7 (realism checklist applied to fixtures).
**Note:** "The LLM could never ship and this would still be a calculator-with-tests" — this phase is the non-negotiable week-1 outcome.

### Phase 3: LLM Reasoning + Citation Layer (days 5–8)
**Rationale:** Depends on computed verdicts existing to narrate around; this is the demo's centerpiece and where three critical pitfalls (P2 verification, P3, mega-prompt anti-pattern) are contained.
**Delivers:** `citations.json` allowlist (10–20 edition-pinned entries) + `ptmt-criteria.json`; Lightning notes-structuring call (extraction-only schema); Super narrative call with verdict-agreement lint, numeric-consistency lint, 1 bounded retry, and SSE streaming into the reasoning pane; renderer-side citation enforcement; model/tokens/cost status line in UI. Write the deterministic fallback narrative FIRST so Super failures degrade from day one.
**Addresses:** clause-cited decisions, reasoning pane, PT/MT indication acceptance, data-quality-flag surfacing.
**Avoids:** P3 (citation hallucination), Anti-Pattern 1 (mega-prompt), Anti-Pattern 2 (trusting `json_schema`).

### Phase 4: Report Rendering (days 8–11)
**Rationale:** The deliverable artifact judges download; requires the stable evaluation data model from Phase 3. Print-CSS fallback comes before react-pdf so PDF generation is an upgrade to a working path, never the reverse.
**Delivers:** `assemble.ts` (renderer interpolates numbers + resolves citations + appends audit log); on-screen report; `renderToBuffer` PDF route with fonts registered server-side; print-CSS `/report/print` fallback; inspector sign-off block + disclaimer footer baked into the template.
**Addresses:** PDF export, audit-trail appendix, liability framing (P5).
**Avoids:** P5 (positioning in the template, not an afterthought), PDF-library time sink (fallback ships regardless).

### Phase 5: Demo Hardening, Deployment & Submission (days 11–14)
**Rationale:** Everything judges touch lives here; the hackathon rewards coherence and explicitly allows recorded video — reliability theater is a legitimate phase of its own.
**Delivers:** Committed cached-LLM demo runs + Live toggle; Tavily lookup route (basic depth, cached, timeout → null); Vercel Firewall rule + per-IP bucket; deploy + incognito cold-start check; per-run cost ledger review; README (from-clone-to-running path, disclaimer, dataset attribution) + OSS LICENSE; rehearsal; ≤3-min video with audio and ≥1 minute of the working solution, model badges visible.
**Addresses:** one-click demo mode, Tavily lookup, rate limiting, submission deliverables.
**Avoids:** credit exhaustion mid-demo, P4 final repo audit, P6 wrapper audit ("would a judge call this a wrapper?").

### Phase Ordering Rationale

- **Dependency-driven:** models proven → math proven → narrative around math → report from evaluation → demo of the whole. Each phase's output is the next phase's input; nothing can be reordered without breaking a dependency discovered in research (e.g., clause-cited acceptance requires calc results; PDF requires the evaluation data model; cached demo responses require all upstream steps).
- **Risk-driven:** the three demo-fatal pitfalls (P1, P2, P3) are each closed in the phase where they're introduced, and each phase ends with something testable — no phase's failure is discovered after Phase 5.
- **Fallback-first stubs:** narrative fallback template, print-CSS report, and Tavily-as-decorator mean every LLM/PDF/search failure mode has a deterministic floor — the acceptance verdict itself can never be lost to an AI failure.
- **P2 features (fleet triage, trend charts, pasted excerpts) slot in only if Phases 1–4 finish early** — they are read-only views/enhancements over completed evaluations, never new workflows.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3:** structured-output behavior per model is only partially verified — `json_schema` support is documented as model-dependent (test in the Phase 1 spike, never rely on it), and `reasoning_effort`/token-cap tuning on Super-120B needs empirical prompt iteration. Plan a `--research-phase` pass for prompt contracts and streaming consumer details.
- **Phase 4:** `@react-pdf/renderer` 4.9.0 ↔ React 19.3 peer-dependency acceptance is UNVERIFIED (STACK flags it MEDIUM — test at install in week 1), and server-side font registration is a known gotcha (GH #2402). If friction exceeds half a day, ship print-CSS.

Phases with standard patterns (skip research-phase):
- **Phase 1:** the spike IS the research — all platform facts (base URL, auth, SSE, `reasoning_effort`, `max_completion_tokens`, `/v1/models`) were verified same-day against official docs.
- **Phase 2:** pure functions + vitest golden files; no external integration; the formulas are 4+-source-confirmed and the ground truth is the builder's own hand calculations.
- **Phase 5:** standard Vercel git-push deploy + Tavily REST integration; both documented and pattern-verified.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Nebius Token Factory, Tavily, and Vercel facts verified against official primary sources the same day (including verified-negative claims: Jobs API gone, Ultra/Nano-Omni removed). Framework choice (Next.js) is MEDIUM-HIGH judgment, grounded in verified constraints. |
| Features | MEDIUM | Flagship dataset verified by direct download and CSV inspection (highest web-source tier); competitor analysis MEDIUM; report-template links LOW/unverified — but irrelevant since the builder authors their own template. |
| Architecture | HIGH for integration facts, MEDIUM for structural patterns | API constraints (json_object-only guarantee, Node-runtime PDF, 300 s maxDuration) officially verified; component structure is expert judgment consistent across two independent research files. |
| Pitfalls | HIGH for platform facts, MEDIUM for legal/safety patterns | Deprecations, rate limits, and measured latency verified against official docs/live measurement; copyright/liability patterns grounded in statute, case law, and comparable products — research, not legal advice. |

**Overall confidence:** HIGH — the decisions that bind the roadmap (platform capabilities, model IDs, cost math, failure modes) rest on same-day-verified official sources with two independent research paths agreeing on pricing; the MEDIUM areas (features/legal) do not change the phase structure.

### Gaps to Address

- **PROJECT.md drift:** the Key Decisions row "Ultra for acceptance reasoning, Nano/Super for extraction" is obsolete and should be corrected to "Super-120B for reasoning, Lightning for extraction" before/at roadmap creation (STACK + PITFALLS agree).
- **react-pdf ↔ React 19 compatibility:** unverified; test at install in Phase 1, decide print-CSS-first vs react-pdf-first early in Phase 4 based on the result.
- **`json_schema` per-model support:** model-dependent per official docs; test in the Phase 1 spike and record the result; `json_object` + Zod remains the guaranteed path.
- **`-fast` model-variant pricing delta:** unverified; check the catalog line item before enabling for interactive calls.
- **Governing corrosion-rate selection rule (short-term vs long-term):** a builder (NDT L2) domain decision not settled by research; encode in `ut-criteria.json` during Phase 2.
- **Nebius credit top-up from India:** RBI recurring-mandate blocks are plausible; test the card and a manual top-up in Phase 1, plan manual top-ups days before deadlines, daily balance checks in the final week.
- **Vercel Hobby Firewall custom-rule count (~1 on Hobby):** verify at Phase 5 deploy; spend the rule on the model path.
- **Tavily report-template links (LOW/unverified):** accepted gap — the builder authors an original template informed by public-domain government formats, so no validation needed.

## Sources

### Primary (HIGH confidence — official, fetched 2026-09-24)
- Nebius Token Factory docs — quickstart, docs index/llms.txt, chat-completions API reference (SSE, `reasoning_effort`, `max_completion_tokens`, json_object-only guarantee), structured-output guide (json_schema model-dependent), public-serverless page, June + August 2026 deprecation notices, rate limits, Sandboxes overview, official Tavily integration doc — docs.tokenfactory.nebius.com
- Official public model catalog (IDs, context, pricing) — tokenfactory.nebius.com/model-catalog.md (+ JSON companion endpoint)
- Vercel — function duration limits (Hobby 300 s), plans/Hobby terms, Firewall rate limiting — vercel.com/docs
- Tavily — pricing (1,000 free credits/mo), search endpoint docs (credit costs, `auto_parameters` warning) — tavily.com / docs.tavily.com
- Next.js 16 route.js reference; react-pdf v4 Node API (`renderToBuffer`, Font.register); Zod 4 docs — nextjs.org, react-pdf.org, zod.dev
- Zenodo record 16780668 (RBM PoF UT register, CC BY 4.0) — **verified by direct download + CSV inspection**; GDXray+ repo — verified by direct fetch (license terms read)

### Secondary (MEDIUM confidence)
- npm/PyPI registry versions (2026-09-24): next 16.3.6, react 19.3.0, openai 7.23.0, @react-pdf/renderer 4.9.0, @tavily/core 0.7.13, ai 7.0.113
- Legal/IBR: 17 U.S.C. § 102(b); ASTM v. Public.Resource.Org (D.C. Cir. 2020); Georgia v. Public.Resource.Org; API IBR Reading Room; PHMSA 49 U.S.C. § 60102(p)
- LLM reliability: Resnik 2026 (56% citation error, 1-in-5 fabricated); LLM-math/tool-invocation failure research (dev.to, HN, arXiv 2026)
- Domain formulas: Inspectioneering calculator, MSTS worked example, iFactory, engineeringexcelspreadsheets (4+ independent agreeing sources)
- Competitors: DocuMatrix/SPA Innovision, Sonatest, Zetec, Spectora (vendor sites, multi-source)
- Judge perspectives: Semgrep "AI Hackathon Effect", JetBrains judging writeup, Devpost judging criteria

### Tertiary (LOW confidence — needs validation or accepted as irrelevant)
- Report-template layout links (CorrView PDF moved, Maptrack/Sitemate unfetched, PA DEP/NRC/BNL/FHWA search-derived) — irrelevant: original template authored instead
- Secondary datasets (quay-wall corrosion, A-1210 gauge study, SWRD weld radiographs) — metadata-only confirmation; v2 relevance at most
- Render free-tier spin-down and serverless in-memory-cache caveats — community comparisons, directionally reliable

---
*Research completed: 2026-09-24*
*Ready for roadmap: yes*
