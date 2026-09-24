# Stack Research

**Domain:** AI copilot for NDT code-compliance inspection reports (NVIDIA Nemotron on Nebius Token Factory; solo agent-built hackathon MVP; $25 credits; 2 weeks)
**Researched:** 2026-09-24 (all platform facts verified against live official docs the same day)
**Confidence:** HIGH for Nebius/Tavily/Vercel platform facts (official primary sources, cross-checked); MEDIUM for framework/library comparisons (community sources + registry versions)

---

## Answers to the Six Research Questions (TL;DR)

1. **Token Factory** = Nebius's OpenAI-compatible LLM inference platform (the rebranded Nebius AI Studio — same platform). It is *not* a sandbox runtime; "Sandboxes" is a separate beta product (Contree) for agent code execution that this project does not need. You call it with the standard OpenAI SDK and a different `base_url`. **Confidence: HIGH** (official quickstart + redirect check).
2. **Live Nemotron models (verified 2026-09-24 from the official public model catalog):** `nvidia/nemotron-3-super-120b-a12b` (256K ctx, $0.30/$0.90 per 1M in/out) for reasoning, `nvidia/Nemotron-3_5-Lightning` (30B MoE, 1M ctx, $0.06/$0.24) for extraction/formatting. Aug-2026 removals of Ultra-253B and Nano-Omni confirmed; official replacements match exactly what parallel research predicted. A live Nano (`nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`, $0.06/$0.24) exists as fallback. **Confidence: HIGH.**
3. **Serverless Endpoints vs Serverless Jobs:** the "Jobs" (batch) surface from the AI Studio era is **gone** — not present anywhere in the current Token Factory docs index (exhaustively checked; `docs.nebius.com/studio` 307-redirects to Token Factory). The current choice is: **public serverless inference** (pay-per-token, shared global infra) vs **Dedicated Endpoints** (region-pinned reserved capacity, per-GPU-hour). For a $25 demo there is no decision: public serverless only. **Confidence: HIGH** (verified negative claim).
4. **Tavily free tier: 1,000 credits/month**, no card, resets on the 1st. Basic search = 1 credit, advanced = 2. Use `@tavily/core` (v0.7.13) in the Next.js app or `tavily-python` (0.8.4) for scripts. Nebius even documents an official Token Factory + Tavily integration pattern. **Confidence: HIGH.**
5. **Web app layer: Next.js 16 (App Router, TypeScript)** — one repo, one language, native SSE streaming, free deploy, and the only option of the three that reads as a "product" to judges. PDF via `@react-pdf/renderer` 4.9.0 with a print-CSS fallback. Defense vs Streamlit and FastAPI+HTMX below. **Confidence: MEDIUM-HIGH** (judgment call grounded in verified platform facts).
6. **Hosting: Vercel Hobby** — $0, non-commercial (a hackathon demo qualifies), 100 GB bandwidth, function `maxDuration` up to 300 s on Hobby (verified), deploy on git push. Bonus: hosting the function in the US makes the Vercel→Nebius hop fast; the India RTT penalty (~200 ms) applies to the builder's browser, not the model call. **Confidence: HIGH** for limits; MEDIUM for India-side specifics.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Nebius Token Factory** (public serverless inference) | current (2026-09) | LLM inference — Nemotron models via OpenAI-compatible REST | Hackathon mandate. Base URL `https://api.tokenfactory.nebius.com/v1/`, `Authorization: Bearer $NEBIUS_API_KEY`, standard OpenAI SDK. Supports `stream: true` (SSE, `data: [DONE]`), `reasoning_effort` (`none`…`xhigh`), `max_completion_tokens` (bounds reasoning + visible output; default `max_tokens` is 8192). Public serverless = pay-per-token on shared infra, processing region dynamic/"Global". **HIGH** |
| `nvidia/Nemotron-3_5-Lightning` | live on serverless | Extraction + formatting workhorse (CSV parse assist, narrative cleanup, PT/MT note structuring) | 30B MoE (~3B active), **1M context**, **$0.06 in / $0.24 out per 1M** (official catalog). Cheap enough that a report run costs fractions of a cent. Officially designated replacement for the removed `Nemotron-3-Nano-Omni`. **HIGH** |
| `nvidia/nemotron-3-super-120b-a12b` | live on serverless | Acceptance-reasoning narrative (the "explain the decision" step only) | 120B hybrid MoE (~12B active), **256K context**, **$0.30 in / $0.90 out per 1M** (official catalog; region us-central1). Officially designated replacement for the removed `Llama-3_1-Nemotron-Ultra-253B-v1`. Use `reasoning_effort: "low"` or `"medium"` + `max_completion_tokens` cap to keep reasoning-trace costs down. **HIGH** |
| **Next.js (App Router, TypeScript)** | 16.3.6 (React 19.3.0) | Entire web app + API: upload, editable parse preview, streamed reasoning, report view, PDF route | One repo/language for an agent-built MVP; route handlers do SSE streaming natively; Vercel Hobby `maxDuration` 300 s comfortably covers the slowest reasoning call; strongest "coherent product" look for the judging criterion. **MEDIUM-HIGH** |
| **Vercel Hobby** | 2026 pricing | Hosting | $0, 100 GB bandwidth, Fluid compute default, Hobby max duration **300 s** (official duration docs). Free Postgres not needed (no DB by design). Deploy = git push. **HIGH** |
| **Tavily API** (free Researcher plan) | 1,000 credits/mo | Live code-edition / errata / interpretation lookup at evaluation time | 1 credit per basic search; pin `search_depth: "basic"` explicitly (docs warn `auto_parameters` can silently double to 2 credits); `include_usage: true` to log spend. ~1,000 lookups/month free covers demo + judging. **HIGH** |

### Model Routing (the AI core of the stack)

| Step | Model | Why this model | Cost control |
|------|-------|----------------|--------------|
| CSV extraction assist + PT/MT note structuring | `nvidia/Nemotron-3_5-Lightning` | 30×–90× cheaper than Super; extraction is pattern work, not judgment | Hard cap `max_completion_tokens` |
| Acceptance reasoning narrative (after deterministic calc) | `nvidia/nemotron-3-super-120b-a12b` | Strongest live reasoning tier; official Ultra-253B replacement | `reasoning_effort: "low"`, `max_completion_tokens` ~2000, cache by input hash |
| Fallback if Lightning is removed (watch weekly) | `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` | Live sibling at identical $0.06/$0.24, 262K ctx | Same |

**Naming correction for the roadmap (matches PITFALLS.md P1):** PROJECT.md's "Ultra for acceptance reasoning, Nano/Super for extraction" is obsolete. The routing becomes **Super-120B for reasoning, Lightning for extraction**. Note a new `nvidia/Nemotron-3-Ultra-550b-a55b` exists ($1.00/$3.00, 1M ctx) — do **not** use it: 3.3× Super's input price for zero demo benefit.

**Budget sanity check (HIGH — arithmetic from catalog prices):** a full report ≈ one Lightning call (~4K in / 1K out ≈ $0.0005) + one Super reasoning call (~6K in / 2K out ≈ $0.0036) ≈ **$0.004–0.005 per report**. $25 ≈ **5,000+ complete report runs**. Even 10× sloppier routing is affordable. Credit exhaustion is a rate-limit/bot-abuse risk (PITFALLS), not a volume risk.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `openai` (npm) | 7.23.0 | Typed client for Token Factory (`baseURL` override) | Always — official docs show exactly this pattern |
| `@tavily/core` | 0.7.13 | Tavily search from route handlers | Code-edition/errata lookup step |
| `@react-pdf/renderer` | 4.9.0 | Server-side PDF report generation (React-style declarative components) | The `/api/report/pdf` route. Node runtime only (not Edge). Register fonts explicitly server-side — known gotcha (react-pdf GH issue #2402) |
| `papaparse` | 9.x (registry-current) | CSV parsing with header/type tolerance | UT thickness CSV ingest; pair with Zod row validation |
| `zod` | 4.x (registry-current) | Schema validation for uploads, component metadata, model outputs | Every parse boundary |
| `ai` + `@ai-sdk/openai-compatible` | 7.0.113 / 3.0.55 | Optional streaming helpers (`streamText`, `useChat`) | Optional convenience. Token Factory is OpenAI-compatible so this works, but Nebius does not officially document the AI SDK — plain `fetch` + SSE over the `openai` SDK is equally fine and has fewer layers |
| `vitest` | 3.x (registry-current) | Golden-file tests for the calc engine | Phase 2 invariant (PITFALLS P2) — non-negotiable, trivially cheap |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Token Factory playground (tokenfactory.nebius.com) | Prompt prototyping before writing code | Free of app-code risk; verify model IDs here first |
| `GET /v1/models` startup dump | Day-1 model-availability spike (PITFALLS P1) | Commit output to `docs/model-catalog.json`; validate configured IDs at app startup |
| `https://tokenfactory.nebius.com/model-catalog.md` | Public Markdown catalog (IDs, context, prices) | Primary source used for this research; re-check weekly during the hackathon |
| Vercel env vars | Secrets | `NEBIUS_API_KEY`, `TAVILY_API_KEY` server-side only; `.env.example` in repo |

## Installation

```bash
# App scaffold
npx create-next-app@latest flawcheck --typescript --app --tailwind

# Core dependencies
npm install openai @tavily/core @react-pdf/renderer papaparse zod

# Optional streaming helpers
npm install ai @ai-sdk/openai-compatible

# Dev
npm install -D vitest
```

```python
# For offline scripts/notebooks (prompt prototyping, fixture generation) only
pip install openai tavily-python   # tavily-python 0.8.4 on PyPI
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js 16 single repo | **Streamlit** | Never for this project. Fastest to prototype, but its rerun-everything model fights streaming + multi-step wizard state, PDF control is weak, and the "data-science demo" aesthetic scores against the "coherent product experience" judging criterion. Judges have seen hundreds of Streamlit AI demos |
| Next.js 16 single repo | **FastAPI + HTMX** | If the builder were personally investing in Python engineering skills. Costs: two runtimes/languages, more deploy surface, PDF via ReportLab/WeasyPrint, SSE plumbing by hand. All achievable, but strictly more moving parts for the same demo — and the agent writes TS just as well |
| `openai` SDK + raw SSE | Vercel AI SDK (`ai` 7) | If the team wants `useChat` UI conveniences. Works via the OpenAI-compatible provider but is not officially documented by Nebius — an unlisted integration is one more thing to debug at 2 a.m. before deadline |
| `@react-pdf/renderer` | Print-CSS page + browser "Save as PDF" | Keep this as the zero-dependency fallback (and demo backup). If react-pdf font issues eat >half a day, ship the print view — judges download a PDF either way |
| `@react-pdf/renderer` | `pdf-lib` 1.17.1 | If the report is mostly fixed-layout text/tables and you want zero React-render dependency — but you lose declarative composition, which matters for a clause-cited multi-section report |
| Vercel Hobby | Render free tier | Only if Next.js were dropped. Render's 2026 free tier: 5 GB bandwidth, **spin-down after 15 min inactivity** — a judge hitting a cold-started app mid-demo is the worst possible failure mode |
| Public serverless inference | Dedicated Endpoints | Never for this budget. Dedicated capacity is billed per-GPU-hour (a single H100-class day exceeds $25) and solves problems (region pinning, throughput guarantees) a demo doesn't have |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `nvidia/Llama-3_1-Nemotron-Ultra-253B-v1`, `nvidia/Nemotron-3-Nano-Omni` | **Removed from serverless 2026-08-31**; requests hard-fail, no auto-reroute (official deprecation notice) | `nemotron-3-super-120b-a12b` / `Nemotron-3_5-Lightning` |
| `nvidia/Nemotron-3-Ultra-550b-a55b` ($1.00/$3.00) | 3.3×–10× the cost of Super/Lightning for reasoning quality this demo doesn't need | Super-120B with `reasoning_effort` cap |
| Token Factory Sandboxes (Contree) | Beta code-execution product for agents (VM isolation, branching) — solves a problem this app doesn't have; adds cost and complexity | Deterministic TypeScript calc functions (PITFALLS P2) |
| "Serverless Jobs" / batch API | **No longer exists** on Token Factory — verified absent from the entire docs index; old AI Studio docs redirect away | Public serverless `/v1` API (batching here = one call per report, which is what the app does anyway) |
| LangChain / LlamaIndex agent frameworks | Agentic loops burn tokens unpredictably against a $25 budget; hide the deterministic pipeline the product's credibility depends on; agent-written code gets harder to audit | Plain `openai` SDK calls in a fixed pipeline (parse → compute → narrate) |
| Model-initiated Tavily tool loops (the pattern in Nebius's own integration doc) | Letting the model decide when to search = unbounded token + credit burn and unreliable retrieval timing | Fixed pipeline step: one `search_depth:"basic"` lookup per evaluation, results shown as outbound links |
| Puppeteer / Chromium HTML-to-PDF on Vercel free | ~300 MB+ Chromium in a serverless function; memory/time flakiness on Hobby; slow cold starts | `@react-pdf/renderer` (or print-CSS fallback) |
| Client-side Nebius/Tavily API calls | Public repo + hosted demo = keys scraped within hours; $25 drained before judging (PITFALLS security table) | All model/search calls in route handlers; keys in server env only |
| Hardcoded model IDs | Removal waves (June + Aug 2026) will happen again inside the hackathon window | Env-config IDs + startup validation against `/v1/models` (PITFALLS P1) |

## Stack Patterns by Variant

**If the calc engine and report render must never share a failure domain (recommended):**
- Keep parse/compute in pure TS modules (`lib/calc.ts`) with vitest golden files; route handlers only orchestrate I/O. Because it makes the "LLM never computes" invariant enforceable in code review and lets the report render offline from a JSON result object.

**If a reasoning call risks exceeding ~60 s (long Super traces on bad-network demo day):**
- Stream `reasoning_content` deltas to the UI as a "thinking" indicator, and set `max_completion_tokens` ≤ 2000. Because the 300 s Hobby limit is headroom, not a target; perceived latency (India RTT ~200 ms, TTFB 0.6–1.2 s per PITFALLS measurements) is the real demo risk, and streaming is the only fix.

**If Lightning or Super disappears mid-hackathon:**
- Swap the env-configured ID to the fallback (Lightning→Nano-30B-A3B at identical pricing; Super→re-check catalog for the current reasoning tier), rerun golden tests. Because startup validation makes this a 10-minute fix instead of a demo-day catastrophe.

**If PDF generation stalls on fonts/React-version friction:**
- Ship the print-optimized `/report/[id]/print` route + browser save-as-PDF, keep react-pdf as a stretch goal. Because the deliverable is "a downloadable formatted report," not a specific library.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next` 16.3.6 | `react` 19.3.0 | Create-next-app pins these; don't hand-upgrade React independently |
| `@react-pdf/renderer` 4.9.0 | Node runtime route handlers only | Will not run on Edge runtime. Register fonts server-side before render (GH issue #2402). Verify React 19 peer-dep acceptance at install time (MEDIUM — test in week 1) |
| `openai` 7.23.0 | Token Factory `/v1` | `new OpenAI({ baseURL: "https://api.tokenfactory.nebius.com/v1/", apiKey: process.env.NEBIUS_API_KEY })` |
| `ai` 7.0.113 | `@ai-sdk/openai-compatible` 3.0.55 | Optional; keep behind a thin wrapper so it can be removed without touching pipeline logic |
| `-fast` model flavor suffix | Same model ID | Official docs: identical outputs, lower latency via smaller batches + speculative decoding. **Pricing delta for `-fast` variants UNVERIFIED** — check the catalog line item before enabling for interactive calls |

## Cost & Latency Posture (what the roadmap should assume)

- **Per-report cost ~$0.004–0.005** (Lightning extraction + Super reasoning at catalog prices) → $25 ≈ 5,000+ runs. Volume is a non-issue; abuse and rate limits are (PITFALLS integration gotchas).
- **Streaming is mandatory, not optional** (measured 200 ms RTT / 0.6–1.2 s TTFB from India; SSE verified in Token Factory API reference). Next.js route handler + `stream:true` + client-side SSE reader.
- **India-to-model RTT is mostly neutralized by hosting choice:** the Vercel function (default US region) calls Nebius US-side; the builder's browser only needs India→Vercel, served via CDN/edge. The 0.6–1.2 s TTFB measured from India applies to local dev, not the hosted demo. (MEDIUM — directionally certain, magnitude unverified.)

## Sources

Official primary sources (fetched 2026-09-24) — **HIGH** confidence:
- Token Factory quickstart + docs index (base URL, OpenAI SDK auth, platform scope): https://docs.tokenfactory.nebius.com/ and https://docs.tokenfactory.nebius.com/llms.txt
- Official public model catalog (model IDs, context windows, regions, pricing): https://tokenfactory.nebius.com/model-catalog.md (JSON companion: `https://tokenfactory.nebius.com/api/public/models_info`)
- August 2026 deprecation notice (removals + official replacements, no auto-reroute): https://docs.tokenfactory.nebius.com/august-2026-deprecation-notice.md
- Chat-completions API reference (`stream` SSE, `reasoning_effort`, `max_completion_tokens`, default `max_tokens` 8192): https://docs.tokenfactory.nebius.com/api-reference/inference/create-chat-completion.md
- Public serverless vs dedicated endpoints (dynamic "Global" region): https://docs.tokenfactory.nebius.com/public-serverless.md
- AI Studio→Token Factory rebrand: docs.nebius.com/studio 307-redirects to docs.tokenfactory.nebius.com; Nebius announcement "Nebius AI Studio is now Nebius Token Factory" (nebius.com)
- Sandboxes overview (Contree, beta, code execution): https://docs.tokenfactory.nebius.com/sandboxes/overview.md
- Tavily pricing (1,000 free credits/mo, tier costs): https://www.tavily.com/pricing; credit costs + `auto_parameters` warning: https://docs.tavily.com/documentation/api-reference/endpoint/search
- Nebius's own Token Factory + Tavily tool-calling integration doc: https://docs.tokenfactory.nebius.com/integrations/search/tavily
- Vercel function duration limits (Hobby default & max = 300 s, Fluid compute): https://vercel.com/docs/functions/configuring-functions/duration
- npm registry / PyPI (versions, 2026-09-24): `next` 16.3.6, `react` 19.3.0, `openai` 7.23.0, `@react-pdf/renderer` 4.9.0, `pdf-lib` 1.17.1, `ai` 7.0.113, `@ai-sdk/openai-compatible` 3.0.55, `@tavily/core` 0.7.13, `tavily-python` 0.8.4

Community/third-party sources — **MEDIUM** confidence:
- 2026 AI-MVP stack patterns (FastAPI+Next.js dominant; Streamlit absent from product-facing lists): buildmvpfast.com, jaqpot.org, dev.to streaming guides
- PDF library comparisons (react-pdf server-side font gotcha GH #2402): nutrient.io, apryse.com, github.com
- 2026 free-tier landscape (Render 5 GB/15-min spin-down; Railway/Fly no free tier): render.com, codecapsules.io, northflank.com comparisons; Vercel Hobby terms: vercel.com/docs/plans/hobby

Cross-check note: model pricing here matches the parallel PITFALLS findings ($0.30/$0.90 Super; ~$0.08/1M blended Lightning ≈ official $0.06/$0.24) — two independent verification paths agree.

---
*Stack research for: FlawCheck — NDT inspection copilot (Nebius x NVIDIA Global AI Hackathon)*
*Researched: 2026-09-24*
