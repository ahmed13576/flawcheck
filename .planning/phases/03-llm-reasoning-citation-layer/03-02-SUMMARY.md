# 03-02 Plan Summary — Extraction Route + Narrative Enabled Path

**Completed:** 2026-09-28 (inline by orchestrator after repeated provider failures killed executor sessions 4×; all work plan-driven from 03-02-PLAN.md)

## Delivered

- `lib/reasoning/schemas.ts`: `ExtractionRequestSchema` (.strict() with PopulationDigestSchema) + `ExtractionResponse` + `isLlmDisabled()` hoisted as the single definition (narrative route re-exports for 03-01 test compat).
- `app/api/reasoning/extract/route.ts`: Lightning extraction via `runValidatedCompletion` (json_object → Zod → one bounded retry); 400 strict-gate naming first issue; 200 `{disabled:true}` on kill-switch; 502 loud-fail with real usage (tokens via new `usageSink` tap, server-timed latency, runtime-resolved model).
- `app/api/reasoning/narrative/route.ts`: enabled path inserted ahead of the fallback branch — cml without an extraction pack → **422** (Pitfall 5); Super-120B stream relayed through the **sentence-level numeric guard** with byte-exact cutoffs; four final lints decide usage-frame vs rejected-frame (+fallback); upstream abort (req.signal + 30s timeout) → error frame.
- `lib/llm/complete.ts`: additive `usageSink` option (return contract `T` unchanged — Phase 1 pins hold) + tolerant JSON parsing (see findings).
- Tests: 79 hermetic + 1 live-gated (extract-route 6, narrative-route-stream 5, lint-swap 2, narrative-route 6, narrative-context 13, lints 24+, fallback/tokenizer carried).

## Live findings (A11 — recorded honestly, 2026-09-28)

1. **Lightning wraps JSON in prose** ("Here's a t…") despite `response_format: json_object` → transport hardening: `parseJsonLoose` extracts balanced `{…}` blocks, tried LAST-first (CoT replies end with the answer).
2. **Lightning's visible chain-of-thought counts inside `max_completion_tokens`** — 800 truncated mid-thought. Raised extraction to 3000 (documented deviation from the plan's 800).
3. **Nondeterministic derivation slips**: one live run stated "6.45 mm" (t_required + uncertainty — derived arithmetic, forbidden) → numeric lint rejected it → deterministic fallback. A later run stayed verbatim-clean and passed all four lints with `Verdict: ACCEPT.` (790/550 tokens, 3.4 s). **Both outcomes are the design working**; lints + fallback bound the damage. Prompt hardening added ("Output the JSON object ONLY…").

## Resolution notes

- Open-question resolution 1 pinned at the route boundary (lint-swap.test.ts): rejected narrative → exactly one `rejected` frame ending in `FALLBACK_CLOSING_SENTENCE`, no usage frame; the contradicting final line is never relayed (held-back buffer).
- SC5 cost field: rendered `—` by the UI (Phase 3 resolution 2); the route serves real tokens + latency + model.

## Deviations

- `sentenceRelayCutoff` added to lib/reasoning/lints.ts (byte-exact relay cutoff) — `splitSentences` trims and would drop inter-sentence spaces in relayed deltas; the cutoff preserves bytes exactly. New pins for it included in lints.test.ts.
- max_completion_tokens: extraction 800→3000 (live-truncation finding above); narrative 1200 (unchanged; Super-120B stayed within budget live).
