---
title: Write hackathon demo narrative + script
date: 2026-10-23
priority: high
---

# Demo narrative & script

Judging is **live demo + Q&A**. The five-minute story must be planned and rehearsed —
this is the highest-leverage missing artifact.

## Shape (draft)

1. **Hook (30s):** raw UT/PT/MT technician notes in → one click → a code-cited
   accept/reject decision, deterministically computed, audit-stamped.
2. **The invariant (60s):** TypeScript computes every number; the LLM never does
   arithmetic; criteria load from `lib/criteria/*.json`; citations are allowlist-locked.
3. **Live adversarial demo (60s):** feed a prompt-injection-laden technician note
   (or show the promptfoo red-team table) → the cite-allowlist lint catches it and
   the decision stays correct.
4. **Observability proof (45s):** Langfuse trace showing token latency + retries on
   a real Nebius call.
5. **Close (45s):** PDF report out; the audit trail; what's next (System-1).

## Tasks

- [ ] Write the full script with exact click-path, sample inputs, and expected seams.
- [ ] Prepare the "hallucination defense" answer for Q&A — this is the question most
      likely to be asked of any LLM app.
- [ ] Rehearse the live path (network hiccups, fallback path) at least twice.
- [ ] Collect the exact demo data input (realistic UT/PT/MT note).
