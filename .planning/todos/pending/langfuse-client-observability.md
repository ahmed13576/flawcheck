---
title: Wire Langfuse direct SDK observability into lib/llm
date: 2026-10-23
priority: high
---

# Langfuse observability

Instrument the Nebius Token Factory calls with the Langfuse **direct client SDK**
(`@langfuse/client`) — not the OTel exporter path (Netlify serverless OTel is
unverified; see `.planning/research/questions.md`).

## Tasks

- [ ] Install `@langfuse/client`; add env vars `LANGFUSE_SECRET_KEY`,
      `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_BASE_URL` to `.env.example` (EU/US/JP/HIPAA
      regions documented).
- [ ] Wrap `runValidatedCompletion` (`lib/llm/complete.ts`) with a trace per call:
      capture dispatch time, token usage (reuse the existing `usageSink`), Zod retry
      count, and fallback trigger (when `isLlmDisabled` / degrade path engages).
- [ ] Ensure SDK init is side-effect-safe in tests (no network in hermetic runs)
      and fails soft (no crash if keys absent).
- [ ] Demo asset: run a live extraction + narrative, screenshot the Langfuse trace
      waterfall (token latency + retry counters) for the Q&A.
- [ ] Optional: `@langfuse/otel` only if the smoke-test checkpoint on Netlify
      passes and Node runtime ≥ 22.
