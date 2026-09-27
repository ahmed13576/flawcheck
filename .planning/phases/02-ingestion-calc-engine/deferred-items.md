# Deferred Items — Phase 2 (out-of-scope discoveries)

Recorded per the executor scope-boundary rule: pre-existing issues in files outside the
current task's changes are logged here, not fixed mid-execution.

| # | Found during | Item | Classification | Evidence | Disposition |
|---|--------------|------|----------------|----------|-------------|
| 1 | 02-02 full-suite run (`npm test`) | `tests/llm/hello-fixture.test.ts` — "extraction model returns Zod-valid JSON" failed once: live model returned prose ("Here's a t...") instead of JSON, exhausting the 1-retry budget | Pre-existing Phase 1 live-LLM test, flaky by nature (real model output; unrelated to any Phase 2 file) | Re-run of the same file: 4/4 pass (~1-2 s per call) | Left as-is; owner: Phase 1 suite. Candidates: relax to tolerate known model prose (not Phase 2 scope). Re-observed during 02-05 phase wrap if the gate re-trips. |
