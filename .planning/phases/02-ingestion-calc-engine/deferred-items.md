# Deferred Items — Phase 2 (out-of-scope discoveries)

Recorded per the executor scope-boundary rule: pre-existing issues in files outside the
current task's changes are logged here, not fixed mid-execution.

| # | Found during | Item | Classification | Evidence | Disposition |
|---|--------------|------|----------------|----------|-------------|
| 1 | 02-02 full-suite run (`npm test`) | `tests/llm/hello-fixture.test.ts` — "extraction model returns Zod-valid JSON" failed once: live model returned prose ("Here's a t...") instead of JSON, exhausting the 1-retry budget | Pre-existing Phase 1 live-LLM test, flaky by nature (real model output; unrelated to any Phase 2 file) | Re-run of the same file: 4/4 pass (~1-2 s per call) | Left as-is; owner: Phase 1 suite. Candidates: relax to tolerate known model prose (not Phase 2 scope). Re-observed during 02-05 phase wrap if the gate re-trips. |
| 2 | 02-03 full-suite verification run (`npm test`, reproduced twice) | Same file as #1 — "forced retry against routed models > extraction model: retry payload carries the assistant's own bad reply" timed out at vitest's 5000 ms testTimeout (live network call to the routed model; survived the configured retry) | Same pre-existing Phase 1 live-LLM test; network-latency flake, unrelated to any Phase 2 file (02-03 touched lib/ingest/session.ts, lib/demo/*, tests/ingest/* only) | All 55 tests/ingest tests green across repeated runs; the failure reproduces only in tests/llm | Left as-is; owner: Phase 1 suite. Roll into #1's 02-05 wrap-up review. |
