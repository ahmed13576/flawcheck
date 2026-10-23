---
title: Add CI + pre-commit verification gate
date: 2026-10-23
priority: medium
---

# CI / pre-commit verification gate

No CI exists today (no `.github/`, no husky). Add a minimal gate so every PR runs
the existing verification commands.

## Tasks

- [ ] `.github/workflows/ci.yml`: `npm ci` → `npm run typecheck` → `npm run lint`
      → `npm test` (hermetic, no keys) on push + PR.
- [ ] Optional husky pre-commit (same commands, scoped to changed files if lint-staged
      is worth the setup).
- [ ] Wire promptfoo action PR eval (see `promptfoo-live-evals-scaffold` todo) so
      the live-LLM matrix runs in CI when `FLAWCHECK_LIVE_LLM=1` is set for the job.
- [ ] Never require live keys for the default path — keep default CI green without
      `NEBIUS_API_KEY`.

## Success criteria

- `git push` / PR shows: typecheck, lint, 643 hermetic tests passing; live evals run
  only where secrets are configured.
