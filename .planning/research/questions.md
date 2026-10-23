# Open Research Questions

Appended by `/gsd:explore` sessions; chronological, newest last.

---

## Q-001: Does OpenTelemetry work on Netlify Functions (Next.js 16)?

- **Date:** 2026-10-23
- **Context:** FlawCheck hardening — evaluating `@langfuse/otel` / OpenLLMetry
  auto-instrumentation in `instrumentation.ts` on Netlify serverless.
- **Known (unresolved):** Netlify observability docs contain no OTel support
  (Log Drains only) — neither Langfuse nor Traceloop primary docs cover OTel-on-
  Netlify. Cold-start overhead, bundling, and Node runtime version are unverified.
- **Why it matters:** If OTel is impractical, use the direct `@langfuse/client`
  SDK instead (already the chosen fallback).
- **Proposed resolution:** timeboxed spike — deploy a minimal OTel-instrumented
  route to Netlify, measure cold start + trace delivery; or accept the direct-SDK
  path without the spike.
