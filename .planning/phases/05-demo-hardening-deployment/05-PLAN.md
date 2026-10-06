# Phase 5: Demo Hardening, Deployment & Submission - Plan

**Plans consolidated into one execution pass** (solo builder, all prior infrastructure proven). Three sequential plans.

## 05-01: Cached Demo + Live Toggle + Tavily (wave 1)
**requirements:** PLAT-03, DEMO-01, DEMO-02
**files:** lib/demo/cached-responses.ts, lib/demo/cached-extraction.json, lib/demo/cached-narrative.json, components/wizard/pipeline-status-bar.tsx, lib/tavily/lookup.ts, app/api/tavily/lookup/route.ts, tests/demo/cached-responses.test.ts, tests/tavily/lookup.test.ts

### Tasks
1. **Cached LLM responses**: Capture real extraction + narrative responses for the demo scenario (from the live run already proven in Phase 3). Commit as `lib/demo/cached-responses.ts` exporting `getCachedResponse(kind, id)` returning `{ extraction: ExtractionResult | null, narrative: string, model: string }` or null. The demo path (when `isDemoSession`) checks the cache BEFORE calling the live API; cache hit → serve committed response with a `cached` badge on the status bar (replacing the model badge text with `committed fixture` + the REAL model name in parentheses). Cache miss → fall through to live.
2. **Live-model toggle**: Screen 3's Finding controls gain a "Live model" switch (default off = cached). When on, the demo path bypasses the cache and calls the real API. The toggle renders as a labeled checkbox in the Finding controls region (UI-44 pattern). Status bar shows `cached (committed fixture)` vs the runtime model badge — honest about which mode served the response.
3. **Tavily post-acceptance lookup** (PLAT-03): `lib/tavily/lookup.ts` — one basic search per evaluation (`{ query: "API 570 7th edition thickness evaluation", max_results: 3 }`), cached by evaluatedAt, 3-second timeout, degrades to `null` on any failure/absent key. Route: `/api/tavily/lookup` (POST {query}) → `{ results: [{title, url}] | null }`. The report footer gains a "Further reading" block when results exist (links out, never code text). TAVILY_API_KEY env-only; absent → skip silently.
4. **Tests**: cached responses serve identical frames to live (same shape); toggle switches between cached and live; Tavily degrades on timeout/absent key; cache hit issues no fetch.

## 05-02: Rate Limiting + Abuse Guarding (wave 2)
**requirements:** PLAT-04
**files:** lib/api/rate-limit.ts, middleware applied in reasoning + pdf routes, tests/api/rate-limit.test.ts

### Tasks
1. **Per-IP token bucket**: `lib/api/rate-limit.ts` — `checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number }` — in-memory Map (20 req/min/IP, refills continuously), returns 429 + Retry-After header when exceeded. Applied to /api/reasoning/narrative, /api/reasoning/extract, /api/report/pdf.
2. **Tests**: burst over 20 → 429 with Retry-After; recovery after the window; per-IP isolation.

## 05-03: README + Video Script + Repo Audit (wave 3)
**requirements:** DEMO-03, DEMO-04
**files:** README.md (rewrite), LICENSE (MIT), VIDEO_SCRIPT.md, .env.production.example

### Tasks
1. **README**: clone-to-running (Node ≥24, `.env.local` setup, `npm install && npm run dev`), architecture summary (Parse → Calculate → Narrate → Render), Nebius Token Factory + Nemotron model usage, Tavily, dataset attribution (Zenodo CC BY 4.0), MIT license, disclaimer.
2. **LICENSE**: MIT, copyright 2026 Mohammed Ahmed.
3. **VIDEO_SCRIPT.md**: ≤3-minute script with timestamps — 0:00-0:30 problem statement, 0:30-1:00 demo load + evaluation, 1:00-2:00 reasoning pane (streaming, cited, model badges), 2:00-2:30 PDF download, 2:30-3:00 architecture + Nebius/NVIDIA credit.
4. **.env.production.example**: all env vars documented (NEBIUS_API_KEY, NEBIUS_MODEL_REASONING, NEBIUS_MODEL_EXTRACTION, TAVILY_API_KEY optional).
5. **Repo audit**: verify .env.local gitignored, no secrets in git history (`git log --all --full-history -- .env.local` empty), LICENSE exists, README complete.
