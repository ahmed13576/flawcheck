---
title: Scaffold promptfoo live evals (extraction + citation allowlist)
date: 2026-10-23
priority: high
---

# Promptfoo live evals scaffold

Add a `promptfooconfig.yaml` targeting the extraction pipeline (`lib/reasoning/prompts.ts`
prompts, `buildExtractionUserPrompt`, `EXTRACTION_SYSTEM_PROMPT`) and the citation
allowlist lints (`lib/reasoning/lints.ts`).

## Tasks

- [ ] Create `promptfooconfig.yaml` with two providers (Nemotron-3-super-120b-a12b
      and Nemotron-3_5-Lightning via env-driven model IDs, or a GitHub Actions
      strategy matrix over two jobs).
- [ ] Write a local TS/JS provider (`file://` path) that calls FlawCheck's in-process
      extraction logic rather than raw HTTP — run against `lib/reasoning` directly.
- [ ] Add an adversarial test set: prompt injections inside raw PT/MT technician notes
      (HUS, or "ignore prior instructions and…"), targeting `EXTRACTION_SCHEMA_HINT`
      and the citation allowlist.
- [ ] Wire `promptfoo/promptfoo-action` into `.github/workflows/` to run on every PR
      (uses `NEBIUS_API_KEY` passed as action input / env).
- [ ] Document run commands: `FLAWCHECK_LIVE_LLM=1 npx promptfoo eval --env-file .env`
      and `npx promptfoo view`.

## Constraints

- Keep the 643 hermetic tests green and key-independent (live evals only under
  `FLAWCHECK_LIVE_LLM=1`).
- Never let evals mutate `lib/calc/` or `lib/criteria/*.json` — read-only harness.
