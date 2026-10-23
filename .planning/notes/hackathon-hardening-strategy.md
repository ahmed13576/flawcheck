---
title: Hackathon Hardening Strategy (pre-submission)
date: 2026-10-23
context: /gsd:explore session — five proposed integration tracks vs. live-demo judging, 7 days to Oct 30 deadline
---

# Hackathon Hardening Strategy

## Decision

For the Nebius × NVIDIA hackathon (deadline 2026-10-30, live demo + Q&A judging),
pursue **exactly two engineering toppings** — adversarial evals (promptfoo) and
observability (Langfuse client) — **plus** a CI verification gate and a written
demo narrative. Skip BAML, Upstash, and the System-1 fork work until after the
hackathon.

## Why (context that drove the decision)

- **Judging is live demo + Q&A.** What scores is what appears on screen and what
  the developer can credibly answer. The repo is unlikely to be browsed in depth.
- **The demo narrative is unwritten** — it is the highest-leverage missing artifact.
- **The milestone v1 is complete** (all 6 phases verified, 643 hermetic tests).
  The app works; the remaining risk is narrative and live-LLM robustness, not
  missing functionality.
- **Time:** 7 days. Each track competes with demo rehearsal.

## Track evaluation

| Track | Demo visibility | Q&A value | Feasibility risk | Verdict |
|---|---|---|---|---|
| Adversarial evals (promptfoo) | High (matrix table, live injection attempt) | High (hallucination defense) | Low–medium | **DO** |
| Observability (Langfuse client) | Medium (trace waterfall screenshot) | High (token latency, retry proof) | Medium (serverless OTel unknown) | **DO** (direct SDK, not OTel-first) |
| CI/pre-commit gate | Low (no screen time) | Low | Very low | **DO** (cheap, protects the other two) |
| Upstash rate-limit | None | Low | Low | Skip — in-memory limiter already exists (`lib/api/rate-limit.ts`); serverless cross-instance need is marginal for demo |
| BAML structured extraction | None | Medium | **High** — rewrites battle-tested `runValidatedCompletion` path a week before deadline | Skip |
| System-1 fork work | — | — | High (large scope) | Park until post-hackathon |

## Grounded facts (via Context7 primary-source fetches)

- **Langfuse JS/TS SDK** exists: `@langfuse/client`; env vars `LANGFUSE_SECRET_KEY`,
  `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_BASE_URL` (EU `cloud.langfuse.com`, US
  `us.cloud.langfuse.com`, JP, HIPAA regions); OTel path adds `@opentelemetry/sdk-node`
  (+ `@langfuse/otel`, requires Node ≥ 22). Direct SDK usage avoids the OTel exporter
  path entirely — lower risk for Netlify serverless.
- **promptfoo** supports local providers referenced via `file://` paths (e.g.
  `file://providers/**/*.py`, `file://validators/check.js`), enabling in-process
  testing of TypeScript modules; config file is `promptfooconfig.yaml`; `--env-file .env`
  supported.
- **promptfoo-action** exists; it reads config/providers/prompts/tests and runs
  evaluations on pull requests. No matrix input — use a GitHub Actions strategy matrix
  over two jobs or two providers in one config for the two-model comparison.

## Research ledger (Unresolved — not admitted)

Per tier-floor discipline (researcher tier could not be verified = `inherit`), the
following from the spawned research pass are recorded as **unresolved**, not as
settled fact:

- **OpenTelemetry on Netlify Functions is unverified.** Netlify's observability docs
  contain no OTel support (Log Drains only); neither Langfuse nor Traceloop docs
  cover OTel-on-Netlify. Cold-start / bundling behavior unknown — gate any OTel
  approach behind a smoke test, or avoid via direct SDK. (Also unresolved: whether
  OpenLLMetry auto-instruments a custom-baseURL OpenAI client and Tavily fetches.)
- **promptfoo redteam plugin cost** is unverified (some plugins generate probes via
  your own LLM provider; token cost range not confirmed).
- **Netlify function timeout / Node runtime version** on the deployed app is
  unverified (no `netlify.toml` found; `< 22 runtime would block `@langfuse/otel`).

## Refs / materials

- `.planning/ROADMAP.md` (v1 complete), `PROJECT.md` (System-1 fork, parked),
  `Walkthrough FlawCheck.md` (post-hoc completion record),
  `implementation_plan_adversarial.md` (remediation plan, not an eval harness).
- Existing live-LLM harness: `FLAWCHECK_LIVE_LLM=1 npm test` gates
  `tests/reasoning/live-pipeline.test.ts`.
- LLM client: `lib/llm/complete.ts` (`runValidatedCompletion`, 1 bounded retry,
  Zod parse), prompts in `lib/reasoning/prompts.ts`, citation allowlist enforced by
  `lib/reasoning/lints.ts`.
