# Pitfalls Research

**Domain:** AI copilot for NDT code-compliance inspection reports (ASME-style acceptance from UT thickness / PT-MT data; NVIDIA Nemotron on Nebius Token Factory; 2-week solo hackathon MVP)
**Researched:** 2026-09-24
**Confidence:** HIGH for platform facts (verified against official Nebius docs and live latency measurement); MEDIUM for legal/safety patterns (verified against statute, case law, and comparable products — this is research, not legal advice)

---

## Critical Pitfalls

### Pitfall 1: Assuming the planned Nemotron models exist on Token Factory serverless — they were already removed

**What goes wrong:**
The project plan routes "Nemotron Ultra for acceptance reasoning, Nano for extraction." But Nebius's own deprecation notice lists `nvidia/Llama-3_1-Nemotron-Ultra-253B-v1` and `nvidia/Nemotron-3-Nano-Omni` as **removed from serverless on August 31, 2026** — two months before the hackathon deadline. Requests to removed models are **not auto-rerouted**; they hard-fail. A builder who writes code against a model ID seen in a blog post or tutorial discovers at integration time that the model is gone.

**Why it happens:**
Nebius removes serverless models in waves (11 models in June 2026, 10 more in August 2026). Tutorials, READMEs, and third-party pricing pages keep listing dead model IDs indefinitely. The Token Factory model catalog is a JS portal, so search engines surface stale lists. `Llama-3_1-Nemotron-Ultra-253B-v1` is exactly the kind of ID that circulates in older NVIDIA/Nebius material.

**How to avoid:**
- On day one of the build, call `GET https://api.tokenfactory.nebius.com/v1/models` with the API key and dump the live model list to a file in the repo (`docs/model-catalog.json`). Build only against IDs from that dump.
- Current verified serverless Nemotron lineup (post-Aug-2026): `nvidia/nemotron-3-super-120b-a12b` ($0.30/$0.90 per 1M in/out, 262K context — Nebius's own designated replacement for Ultra-253B) and `nvidia/Nemotron-3_5-Lightning` (~$0.08/1M blended — the cheap extraction/formatting workhorse). Confirm the exact current IDs from the live list; do not trust this file's snapshot blindly.
- Put model IDs in environment config, not inline in code, and add a startup check that validates configured IDs against `/v1/models` so the app fails loudly with a clear message.
- Watch `docs.tokenfactory.nebius.com` deprecation notices weekly during the hackathon — another removal wave inside the 5-week window is plausible.

**Warning signs:**
404/"model not found" errors on first API call; demo working yesterday and failing today with no code change; any tutorial or example referencing `Llama-3_1-Nemotron-Ultra-253B-v1` or `Nemotron-3-Nano-Omni`.

**Phase to address:**
Phase 1 (Foundation) — the model-availability spike must be the first technical task, before any routing logic is written. The routing design ("Ultra for reasoning") needs renaming to what actually exists (Super-120B for reasoning, Lightning for extraction).

---

### Pitfall 2: Letting the LLM do the engineering math (t-min, corrosion rate, remaining life)

**What goes wrong:**
The app's core value is acceptance decisions. If the LLM computes `remaining life = (t_actual − t_min) / corrosion_rate`, it will sometimes produce a confident, plausible, wrong number. Multi-step arithmetic is where LLMs fail: they pattern-match rather than calculate (documented simple-multiplication errors like 200 × 197), and a single digit error flips a pass into a fail on a pressure-retaining component. Worse: models with tool access often **fail to invoke the tool unprompted** — they answer from "memory" even when a calculator is available. Clinical-calculator research (arXiv 2026) reached the same conclusion for medicine: LLM-generated numbers in safety calculations are unacceptable; deterministic solvers must wrap the model.

**Why it happens:**
Agentic builds default to "the model handles it." Numeric output *looks* fluent and correct — errors are statistically rare per-token but catastrophic when they occur, so demos pass and production fails. Testing with round numbers (t=10.0mm) hides the problem; real readings (7.94mm, 0.31 in) expose it.

**How to avoid:**
- Hard architectural rule: **every number in the acceptance path is computed by deterministic code** (TypeScript/Python functions), never by the model. The LLM may *route*, *extract*, and *explain* — it may not *calculate*.
- The prompt contract: model receives inputs + computed results and writes the reasoning narrative around them; the computation is a pure function with unit tests (t-min per the chosen code formula, corrosion rate from interval readings, remaining life, MAWP if used).
- Force the flow in code (deterministic pipeline: parse → compute → generate narrative), not via "you must use the calculator tool" instructions the model can ignore.
- Golden-file tests: a fixtures directory of CSVs with hand-computed expected outputs (the builder is NDT Level 2 — their hand calculations are the ground truth). Any change to the calc layer re-runs the suite.

**Warning signs:**
Model output containing arithmetic; numbers in the report that don't trace to a function in the codebase; test data with conveniently round values; "the model got it right" in one-off manual checks instead of regression tests.

**Phase to address:**
Phase 2 (Deterministic calculation engine) — this is the phase that must exist before any LLM narrative work. Roadmap should treat "LLM never computes" as an architectural invariant, not a prompt guideline.

---

### Pitfall 3: Hallucinated clause citations in a product whose entire pitch is defensible citations

**What goes wrong:**
The report cites "ASME B31.3, Para. 341.3.2" or "API 510, 7.4.2" — and the number is invented or attached to the wrong requirement. Measured rates: 56% of AI-generated citations contain errors and roughly 1 in 5 is fully hallucinated (Resnik 2026, peer-reviewed). The most dangerous mode (from legal-AI sanctions cases like the Mata v. Avianca pattern) is a **real clause number attached to wrong content** — it survives casual review and destroys credibility with the one audience (NDT experts) able to catch it. For this product, one visibly wrong clause in the demo is fatal: "defensible, code-cited acceptance" is the core value claim.

**Why it happens:**
Clause numbers are exactly the kind of high-plausibility, low-verifiability token sequence LLMs confabulate. Training data contains ASME paraphrases, forum posts, and older editions, so the model blends editions (citing a clause that moved between B31.3 editions) with total confidence.

**How to avoid:**
- **Citation lockdown:** the model may only emit clause references from a curated, builder-vetted allowlist (a JSON map: `{criterion → code, edition, clause, one-line scope note}` maintained by the NDT Level 2 builder). The report renderer injects citations from this map; if the model outputs a clause not in the map, the pipeline rejects or blanks it.
- Build the map as an explicit artifact early (10–20 entries covering the t-min / remaining-life / indication-assessment criteria actually implemented). This is the builder's domain edge — no competitor can fake this map.
- Edition pinning: every citation carries the code edition it was verified against (e.g., "API 570, 3rd ed. addition, verified against IBR read-only source, 2026-09"). Never let the model guess editions.
- Tavily's role is *live errata/edition verification and linking*, not citation generation. Verify clause numbers against official read-only sources (see Pitfall 4 for the legitimate free sources) — never against model memory.
- Golden tests: every report template's citations validated against the allowlist in CI.

**Warning signs:**
Citations appearing in output that no one can find in the allowlist; different runs citing different clauses for the same criterion; citations lacking an edition; "close enough" paraphrases of clause titles.

**Phase to address:**
Phase 3 (Citation grounding layer) — allowlist built in the same phase as the calc engine; renderer enforcement before any report generation begins.

---

### Pitfall 4: Embedding or having the LLM reproduce ASME/API code text (copyright exposure)

**What goes wrong:**
The fastest-looking paths — pasting code excerpts into prompts/repo, letting RAG chunk a pirated PDF, or asking the LLM to "output the relevant clause text" — all create copyright risk. ASME BPVC and API standards are copyrighted and actively enforced (pirated PDFs circulate; they're still infringing). The subtle variant: a RAG pipeline fed with code text will *quote* that text in generated reports, meaning the deployed app redistributes protected expression on every run.

**Why it happens:**
Judges ask "but which clause says that?" and quoting the clause is the lazy answer. Builders assume engineering standards are like laws (public). Partly true, but only via a narrow doctrine (see below) that does **not** cover a product redistributing text.

**How to avoid:**
Legally safer architecture (research-informed pattern used by code-calculation vendors, not legal advice):
- **Cite, don't quote.** Clause numbers and formula parameters are facts/methods — under 17 U.S.C. § 102(b), copyright never extends to "procedures, processes, systems, methods of operation" regardless of how they're described. Implementing the t-min formula in code and citing "API 570 §7.3" is fundamentally different from reproducing the paragraph around it.
- **User-provided excerpts only.** If the report needs code language, the user pastes it from their licensed copy (client-side, transient, not stored or redistributed by the app). Label this explicitly in the UI.
- **Use official free read-only sources for verification, not redistribution.** API's IBR Reading Room gives free public read-only access to ~200 standards incorporated by reference into US federal regulation; PHMSA provides free viewable copies under 49 U.S.C. § 60102(p) (relevant to API 510/570/653-adjacent pipeline standards); ANSI's IBR portal covers many others. The ASTM v. Public.Resource.Org line of cases (D.C. Cir. 2020) and the government-edicts doctrine (Georgia v. Public.Resource.Org, 2020) support public *access* to law-incorporated standards — but that protects a non-commercial library, **not** a product embedding or re-serving the text. Link out; never cache-and-serve.
- **Repo hygiene:** no code PDFs, no clause-text fixtures, no prompt containing "reproduce the requirements of clause X." A copyright takedown or licensing complaint against the public repo mid-hackathon is an unrecoverable submission failure.
- Have the LLM explain the *engineering logic* ("why C-factor drives t-min") in original words, then attach the clause number from the allowlist.

**Warning signs:**
Verbatim standard-English sentences appearing in model output ("The minimum required thickness shall be…"); any .pdf of a code in the repo; prompts longer than a page of code requirements; RAG index built from scraped standard text.

**Phase to address:**
Phase 1 (Foundation) — the rule "no code text in repo, prompts, RAG index, or output" is an architectural invariant set before the first prompt is written; Phase 3 re-verifies it at the citation layer; Phase 5 (submission) does a final repo audit.

---

### Pitfall 5: Missing safety/liability positioning on an inspection acceptance tool

**What goes wrong:**
An AI tool that tells a real inspector "ACCEPT" on a pressure-retaining component, with no framing of its epistemic status, reads as unauthorized engineering judgment. For a hackathon this costs credibility (a judge asking "is this certified?" with no answer); post-hackathon (portfolio → job hunting) it marks the builder as not understanding professional-responsibility context — the exact opposite of the "domain expert" brand.

**Why it happens:**
Demo energy rewards confident outputs ("PASS/FAIL" badges). Builders copy chatbot disclaimer patterns ("AI can make mistakes") instead of domain-appropriate engineering-software positioning.

**How to avoid:**
Adopt the standard engineering-software positioning pattern (verified from comparable structural/engineering tools: STATIX — "the software is not a copy of, and does not replace, any standard; the official standards remain the controlling documents"; professional-review clauses — "not a substitute for the judgment of a licensed Professional Engineer"; NIST-style safety-critical exclusion):
1. UI framing: "Draft acceptance evaluation — for review and sign-off by a certified Level 2/3 inspector or engineer." Every decision rendered as *recommendation pending sign-off*, with a visible inspector-acknowledgement field in the report output.
2. Report footer (generated into every PDF): decision-support disclaimer + "official code editions control; verify against your licensed copy" + edition/date of the criteria used.
3. README/disclaimer page: consistent wording across UI, report, README, and any Terms — contradictory disclaimers create their own legal risk.
4. Output language: "Evaluate as acceptable per [criterion] — verify" rather than bare "PASS" where the criterion is judgment-dependent (PT/MT indication assessment especially: linear vs rounded, crack-suspect indications must always route to the inspector).

**Warning signs:**
Any screen that says only "PASS"; demo script narrating "the AI decides acceptance"; missing edition/date on report outputs; disclaimers living only in the README where judges never look.

**Phase to address:**
Phase 4 (Report generation) — disclaimer/sign-off elements are part of the report template, not an afterthought; Phase 5 verifies README/UI/report consistency.

---

### Pitfall 6: The chat-wrapper / proof-of-concept trap (what loses this specific hackathon)

**What goes wrong:**
The Nebius × NVIDIA hackathon explicitly judges "complete, coherent product experience — not just a technical proof of concept" (Devpost judging criteria; demo video must include ≥1 minute of the working solution). Two known failure archetypes from judge-perspective writeups:
- **The GPT-wrapper:** an upload box + chat + "ask anything about your data" — judges see dozens of these per hackathon now and discount them heavily.
- **The mocked POC:** impressive UI held together with hardcoded data and mocked model calls (Semgrep's "AI Hackathon Effect" critique) — collapses when a judge pokes it or asks to see the repo.

**Why it happens:**
Chat is the default app shape AI tooling makes easy; hardcoding gets a flaky pipeline "demo-ready" the night before deadline. Solo builders with agent-written code are especially tempted because the agent can fake a UI faster than a real pipeline.

**How to avoid:**
- Product shape = **wizard/pipeline, not chat**: upload → parsed-reading table (editable) → computed acceptance table with visible criteria → report. Chat-style Q&A may exist as a secondary panel, never the primary interface.
- End-to-end realness: the video demo must show a real CSV entering and a real formatted report exiting, on the deployed URL, with the actual Nemotron calls visible (a small "model: nemotron-3-super-120b-a12b · tokens · latency" status line is cheap and powerfully anti-wrapper).
- Show the domain depth judges can't fake: the citation allowlist, the deterministic calc trace (formula substituted with the user's numbers — "show your work" view), unit handling. This is the "genuine problem-space understanding" scoring axis.
- Coherence beats features: a tight loop that always works > five half-features. Judges' own advice: overlong/broken demos are scope problems — cut features, rehearse.

**Warning signs:**
Repo README with no working setup path ("API key left as exercise"); UI states no real data can traverse; the demo script avoids showing the middle of the pipeline; more time spent on styling than the calc/acceptance core.

**Phase to address:**
Cross-cutting: Phase 1 fixes the pipeline-first product shape; Phase 5 (submission) is a rehearsal + recording phase with the "would a judge call this a wrapper?" audit.

---

### Pitfall 7: Demo data that looks fake to expert judges

**What goes wrong:**
Public UT-thickness inspection data essentially doesn't exist — searches across Kaggle/Zenodo/academic repositories surface signal-waveform datasets (Bristol UNDT guided-wave arrays, Maack 2022 pulse-echo recordings, thermography images), not inspection-logging thickness grids with component metadata. So demo CSVs must be synthesized — and NDT-literate judges will instantly recognize synthetic data written by someone (or some model) who has never held a thickness gauge. Fake-looking input data invalidates the entire demo's credibility: if the inputs are wrong, the acceptance decisions are theater.

**Why it happens:**
Uniform random numbers, perfectly even reading grids, all-pass scenarios, round metric values, components with no line/loop/isometric references — the fingerprint of generated data. Real inspection data is messy in *specific, learned ways*.

**How to avoid:**
The builder is the mitigation — generate demo data from real field knowledge, and include these realism features:
- **CML/point-grid structure:** multiple condition monitoring locations per component, 3–5 readings per CML (like a T-grid), with a plausible *spread* (±0.1–0.5 mm gauge repeatability/coating-coupling noise), not identical values.
- **Physically sensible patterns:** wall loss concentrated where it actually occurs (bottom of horizontal runs for liquid service, top for wet-gas; deadlegs; injection points); t_actual mostly slightly-below nominal with a few localized deep readings; a corrosion *rate* consistent between two inspection intervals.
- **Real component identity:** line numbers, isometric references, OD/schedule/material combos that exist (e.g., 6" NPS Sch 40 A106-B → 7.11 mm nominal wall), service fluid, design conditions.
- **Units discipline:** pick mm (Indian practice) and stay consistent; if inches appear anywhere, use proper decimal-inch readings (0.312", not 0.3").
- **A mixed outcome set:** at least one clear accept, one marginal/re-check (within gauge uncertainty of t-min — showcase the "re-check" decision), one fail with next-inspection-date computed from remaining life. All-pass datasets scream fake.
- Label it honestly in the repo ("synthetic demo dataset generated from typical field patterns by the author, NDT Level 2") — honesty here converts a weakness into a domain-credibility signal.
- PT/MT demo: indication notes with real morphology language ("linear indication, 8 × 1 mm, axially oriented, at 3 o'clock, HAZ"), including at least one crack-suspect linear indication that must route to inspector judgment (ties into Pitfall 5).

**Warning signs:**
Reviewing the demo CSV and seeing uniform values, no CML structure, all-pass results, impossible OD/wall combinations, or values a gauge wouldn't display (3-decimal mm readings).

**Phase to address:**
Phase 1 or 2 (data fixtures built alongside the calc engine — the same fixtures become the golden-file tests from Pitfall 2; one effort, two payoffs).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| LLM computes acceptance "for now," deterministic layer "later" | Working demo in days | Core value is un-verifiable; one wrong number in judging = dead; retrofit means rewriting the pipeline | Never for this project — this IS the product |
| Citation strings inline in prompts/model output | Faster report generation | Hallucinated clauses; edition drift; no verification path | Never — allowlist from day one |
| Hardcoded model IDs in code | One less config file | Model removal breaks app silently (see Pitfall 1) | Never — env config + startup validation |
| Single mega-prompt doing extract+compute+narrate | Fewer moving parts | Un-testable; number errors; higher token burn; rate-limit exposure | Never — split pipeline |
| Skipping golden-file tests | Faster iteration | Any prompt/model change can silently alter decisions; impossible to swap Nemotron tiers safely | Never for calc layer; acceptable for narrative prose |
| Synthetic all-pass demo data | Clean demo narrative | Expert judges read it as fake (Pitfall 7) | Never |
| Auth-less open demo endpoint | Zero friction for judges | Someone's bot burns your $25 credits the night before deadline | Only with a lightweight guard (obscure path + rate cap); never fully open |
| No streaming; full-completion waits | Simpler client code | 200 ms RTT + long reasoning traces = perceived hangs; 429s cascade | MVP-acceptable only if each request stays short |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Nebius Token Factory (models) | Trusting tutorials/blog IDs; assuming Ultra exists | Day-1 `GET /v1/models` dump committed to repo; build against live list; re-check deprecation notices weekly |
| Nebius Token Factory (rate limits) | Bursting many sequential calls per report (per-reading calls) | Baseline ~60 req/min, ~400K tok/min with dynamic 15-min scaling; handle HTTP 429 + `Retry-After` header; batch readings; read `x-ratelimit-remaining-*` headers and surface headroom in logs |
| Nebius Token Factory (region) | Assuming serverless serves from a nearby region | Serverless is Global region with no region guarantee; latency-sensitive deployments should consider dedicated endpoints — for the hackathon, serverless + streaming is fine (measured from builder's machine in India: TCP RTT ~200 ms, full TLS+TTFB 0.6–1.2 s) |
| Nebius billing | Assuming credits auto-renew or auto-top-up works from India | $25 minimum manual top-up; international card with international usage enabled; RBI rules can block recurring e-mandates — plan manual one-time top-ups a few days before deadlines; check balance daily in the final week |
| Tavily | Letting search results flow into reports as citations | Tavily = live edition/errata verification and outbound links only; citations come from the builder allowlist (Pitfall 3); never paste retrieved standard text into reports (Pitfall 4) |
| LLM + math tools | Hoping the model calls a calculator when needed | Deterministic pipeline forces computation order in code; model never sees "please compute" tasks (Pitfall 2) |
| CSV ingestion | Assuming gauge export format | Support a documented sample format (the demo fixture IS the contract); parse defensively; show a parsed-preview table the user can edit before acceptance runs — this is also a product feature judges reward |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-reading LLM calls | Minutes per report; 429 storms; credit burn | Batch the whole dataset into one extraction call (UT readings are small); deterministic loop for per-CML math | Immediately — even a 50-reading report trips it |
| Non-streaming UI on long reasoning calls | 30–60 s frozen screen; demo looks broken | Stream tokens; show staged progress ("parsing → computing → drafting"); India RTT ~200 ms makes streaming essential | During the demo, always |
| Reasoning model for everything | $0.90/1M output adds up on long traces; slow | Route: Lightning for extraction/formatting, Super-120B only for acceptance narrative; cap max_tokens; cache results for identical inputs (aggressive caching is already the plan) | With $25 total budget and careless routing |
| No 429 handling | First heavy judge session throttles | Retry with `Retry-After` backoff; queue report jobs; surface "retrying" state honestly in UI | Any burst usage |
| Credit exhaustion mid-demo | 402/403 errors on the public URL during judging | Daily balance checks; a cost budget per report (log tokens/cents per run); a saved offline recording as the fallback deliverable; top-up card tested in week 1 | Final week |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Nebius/Tavily API keys in the public repo or client-side calls | Key scraped within hours; credits drained before judging | Keys only in server env; repo is public per rules — scan for secrets before every push; use a `.env.example` |
| Open unauthenticated demo endpoint | Bot/scraper traffic burns $25 credits; judges' traffic competes with abusers | Lightweight guard: unguessable demo path or simple rate cap per IP; keep token budgets small per request |
| Storing user inspection data on the server | Inspection data is client-confidential (plant integrity data); even for a demo, showing data retention is a bad look for an inspection product | Process transiently; no DB of uploads; state this in the README — it's a selling point for the domain audience |
| Letting user-pasted code excerpts persist (logs, RAG index) | Turns a safe "user-provided excerpt" pattern (Pitfall 4) into redistribution | Excerpts live only in the request lifecycle; never logged at full fidelity, never indexed |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Bare "PASS/FAIL" verdicts | Reads as unauthorized judgment; expert users distrust instantly | "Acceptable per [criterion] — pending inspector sign-off" + which numbers drove it |
| Hidden math | Inspector can't defend the report to their client | "Show your work" view: formula with the user's values substituted (this is both UX and anti-hallucination) |
| Unit ambiguity (mm vs inch) | Silent 25.4× catastrophes in t-min comparisons | Explicit unit field, one canonical internal unit, display in user's unit; refuse mixed-unit inputs |
| Un-editable parse results | One bad CSV row poisons the whole evaluation | Parsed-preview table with per-row validation flags (out-of-range, missing CML) and edit before running acceptance |
| PT/MT linear indication auto-accepted | Crack-suspect indications routed by an algorithm — the single worst possible product behavior | Any linear/crack-suspect indication always escalates to inspector review, hard-coded |

## "Looks Done But Isn't" Checklist

- [ ] **Acceptance engine:** often missing the *re-check* outcome band (readings within gauge uncertainty of t-min) — verify a fixture produces all three outcomes: accept / re-check / reject
- [ ] **Remaining life / next inspection date:** often missing corrosion-rate-from-two-intervals logic — verify a two-inspection-history fixture computes interval and next due date
- [ ] **Citations:** often missing edition pinning — verify every citation in output carries code + edition + allowlist presence
- [ ] **Report:** often missing inspector sign-off block and disclaimer footer — verify the generated PDF/print view contains both
- [ ] **Demo deployment:** often missing a cold-start check — verify the deployed URL works from a fresh browser/incognito the morning of deadline, not just your session
- [ ] **Repo:** often missing OSS license (a hackathon rule) and setup README — verify LICENSE file and a from-clone-to-running path that actually works
- [ ] **Demo video:** often missing audio or the ≥1-minute working-solution clip (both explicit rules) — verify before upload; rehearse to ≤3 minutes
- [ ] **Model status:** often missing proof the app really uses NVIDIA models (judges check) — verify the UI or logs surface model IDs `nvidia/...`

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Model ID removed mid-build | LOW | Swap env config to replacement (e.g., Ultra→`nemotron-3-super-120b-a12b`), rerun golden tests; startup validation makes this a 10-minute fix |
| Hallucinated citation shipped in demo video | MEDIUM | Re-generate report with allowlist enforcement; re-record affected segment; keep raw generation out of reports permanently |
| Wrong number in a demo report | MEDIUM | Trace to missing deterministic path; add fixture + test; re-generate; if caught pre-submission it's a strong war story ("we caught it because the calc layer is tested") |
| Credits exhausted near deadline | MEDIUM | Manual top-up (test card in week 1); fallback to pre-recorded full run; static cached report as last resort for the video only — live URL risk disclosed |
| Code-text accidentally in repo/prompts | MEDIUM | Audit and strip; replace with clause-number allowlist entries; verify no RAG index contains standard text |
| Live demo fails during judging | LOW (if prepared) | Recorded backup video ready; judges explicitly allow video as the demonstration artifact |
| Demo data mocked as fake-looking | MEDIUM | Regenerate fixtures with field-realistic patterns (Pitfall 7 list); rerun golden tests since fixtures feed them |

## Pitfall-to-Phase Mapping

(Suggested phase names — roadmap should preserve these prevention points even if renamed.)

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| P1 Model availability (deprecated IDs) | Phase 1: Foundation & Platform Spike | `/v1/models` dump committed; config validated at startup; routing uses only live IDs |
| P2 LLM math | Phase 2: Deterministic Calc Engine | Golden-file tests pass; code review confirms no arithmetic in prompts; numbers in reports trace to functions |
| P3 Citation hallucination | Phase 3: Citation & Grounding Layer | CI check: every citation in output ∈ allowlist, edition pinned |
| P4 Code copyright | Phase 1 (rule set) + Phase 5 (audit) | Repo + prompt + RAG audit finds zero standard text; user-excerpt flow is transient-only |
| P5 Liability positioning | Phase 4: Report Generation | Sign-off block + disclaimer in every report; UI shows "pending sign-off" framing |
| P6 Wrapper/POC trap | Phase 1 (shape) + Phase 5 (rehearsal) | Demo script shows CSV→report end-to-end on deployed URL; model-status line visible; "wrapper audit" passes |
| P7 Fake demo data | Phase 1–2 (fixtures with calc engine) | NDT-expert self-review against realism checklist; fixtures double as golden tests |
| Credit exhaustion | Phase 5 (submission week) | Daily balance log; per-report cost logged; top-up card tested; backup recording done |

## Sources

Official platform (HIGH confidence):
- Nebius Token Factory, August 2026 deprecation notice (removal of `nvidia/Llama-3_1-Nemotron-Ultra-253B-v1`, `nvidia/Nemotron-3-Nano-Omni`; no auto-reroute): https://docs.tokenfactory.nebius.com/august-2026-deprecation-notice.md
- Nebius Token Factory, June 2026 deprecation notice (11 models removed): https://docs.tokenfactory.nebius.com/june-2026-deprecation-notice.md
- Nebius Token Factory, rate limits (429/Retry-After, dynamic scaling, headers): https://docs.tokenfactory.nebius.com/ai-models-inference/rate-limits
- Nebius, Nemotron 3 Super on Token Factory announcement (Mar 2026): https://nebius.com
- Artificial Analysis, Nemotron 3 Super 120B pricing across providers (Nebius $0.30/$0.90): https://artificialanalysis.ai
- Measured latency from builder machine (2026-09-24): TCP RTT ~200 ms, TLS+TTFB 0.6–1.2 s to api.tokenfactory.nebius.com (curl timing, 3 runs)
- Hackathon rules/judging ("complete, coherent product experience"; ≥1-min working-solution video clip): https://nebiusglobalaihackathon.devpost.com

Legal/copyright (MEDIUM — research, not legal advice; US-centric):
- 17 U.S.C. § 102(b), idea-expression dichotomy (methods/procedures/formulas unprotectable): https://www.law.cornell.edu/uscode/text/17/102
- ASTM v. Public.Resource.Org, 954 F.3d 425 (D.C. Cir. 2020) (IBR fair use, non-commercial): https://law.justia.com and https://fairuse.stanford.edu
- Georgia v. Public.Resource.Org (government edicts doctrine) analysis: https://www.arl.org
- API IBR Reading Room (free read-only access to ~200 IBR standards): https://www.api.org ; PHMSA IBR access under 49 U.S.C. § 60102(p): https://phmsa.dot.gov ; NIST on IBR read-only access: https://www.nist.gov

LLM reliability & citations (MEDIUM):
- Resnik (2026), hallucinated AI citations — 56% error rate, 1-in-5 fabricated (peer-reviewed): https://www.tandfonline.com
- Legal-citation hallucination failure mode (real cite, wrong content): https://www.haqq.ai
- LLMs are Bad at Math (tool-invocation failure): https://dev.to ; HN discussion "Why don't LLMs ask for calculators?": https://news.ycombinator.com
- Deterministic math solver for clinical language, arXiv (Sep 2026): https://arxiv.org

Liability positioning (MEDIUM):
- STATIX engineering disclaimer ("does not replace any standard"): https://statix.engineering ; NIST software disclaimer pattern: https://pages.nist.gov ; professional-review clause example: https://hlcengineering.com

Hackathon judge perspectives (MEDIUM):
- Semgrep, "The AI Hackathon Effect" (mocked-interface demos): https://semgrep.dev
- JetBrains, "How to Win a Hackathon: Notes From the Judging Table": https://blog.jetbrains.com
- HackerNoon, judge's-seat perspective on GPT-wrapper flood: https://hackernoon.com

NDT datasets (MEDIUM):
- University of Bristol UNDT datasets (guided-wave signals, not thickness logs): https://research-information.bris.ac.uk
- Maack et al. 2022, pulse-echo ultrasonic dataset (civil NDT): https://pmc.ncbi.nlm.nih.gov

---
*Pitfalls research for: AI NDT inspection-report copilot (Nebius x NVIDIA hackathon)*
*Researched: 2026-09-24*
