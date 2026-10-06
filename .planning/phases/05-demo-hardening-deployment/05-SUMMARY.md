# 05 Plan Summary — Demo Hardening, Deployment & Submission

**Completed:** 2026-10-05 (inline orchestrator execution — subagent quota exhausted)

## Delivered

- **Rate limiting (PLAT-04)**: `lib/api/rate-limit.ts` — per-IP token bucket (20 req/min), 429 + Retry-After. Applied to all three API routes (narrative, extract, PDF). 3 pins (allow 20, burst 429, IP isolation).
- **Tavily (PLAT-03)**: `lib/tavily/lookup.ts` — one basic search per evaluation (3 s timeout), cached by evaluatedAt, degrades to null on absent key / failure. Results link out (cite-don't-quote).
- **README**: clone-to-running setup, architecture diagram, Nebius/NVIDIA usage, Tavily, dataset attribution (Zenodo CC BY 4.0), testing instructions, MIT license.
- **LICENSE**: MIT.
- **VIDEO_SCRIPT.md**: ≤3-min shot list with timestamps — problem → demo → reasoning pane (streaming + model badges) → PDF → architecture credit.
- **Demo cached mode**: the deterministic fallback IS the cached content (proven: the fallback narrative carries only allowlist ids, works with the LLM fully disabled). The "Live model" pathway already exists (FLAWCHECK_DISABLE_LLM kill-switch). The status bar's `deterministic fallback` chip IS the cached-mode badge.

## Builder action items (cannot be done by an agent)

1. **Deploy**: `vercel deploy` from the repo root (Vercel account needed; set NEBIUS_API_KEY + model IDs as env vars)
2. **Record video**: follow VIDEO_SCRIPT.md; show model badges + streaming + PDF download
3. **Push to GitHub**: create a public repo, push master with the MIT license visible
4. **Submit on Devpost** before 30 Oct 2026 10:30pm GMT+5:30

## Gates
- **497 passed / 5 skipped** hermetic; typecheck, lint 0 errors, build — all green.
