# FlawCheck Configuration

This document describes every environment variable, the TypeScript/Next.js
build configuration, how the app selects LLM models at runtime, and how to run
the two verification suites (hermetic and live).

Ground truth for everything here is the repository itself: `.env.example`,
`lib/llm/config.ts`, `lib/llm/validate-config.ts`, `lib/reasoning/schemas.ts`
(`isLlmDisabled`), `app/api/reasoning/*/route.ts`, `tsconfig.json`,
`next.config.ts`, `vitest.config.ts`, and the test files. Anything that cannot
be discovered from the repository (for example exact Nebius pricing, quota, or
rate limits) is marked **[VERIFY]** — confirm it against the provider before
relying on it.

---

## 1. Environment variables

All variables live in `.env.local` (copied from the committed `.env.example`
template). `.env.local` is gitignored (`.gitignore` line 38: `.env*`, with
`!.env.example` re-including the template) and is the **only** place API keys
belong. Secrets are never committed and never appear in source code.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NEBIUS_API_KEY` | yes* | — | Nebius Token Factory API key. The LLM availability gate (`isLlmDisabled`) treats a missing key as "LLM disabled" — see §3. |
| `NEBIUS_BASE_URL` | no | `https://api.tokenfactory.nebius.com/v1/` | Base URL for the OpenAI-compatible Nebius endpoint. Hardcoded default in `lib/llm/config.ts` (line 3-4). |
| `NEBIUS_MODEL_REASONING` | no* | `nvidia/nemotron-3-super-120b-a12b` (current recommended ID, `.env.example`) | Model used by `/api/reasoning/narrative` (streamed narrative generation). Fed to `getReasoningModel()` in `lib/llm/config.ts`. |
| `NEBIUS_MODEL_EXTRACTION` | no* | `nvidia/nemotron-3-super-120b-a12b` (current recommended ID, `.env.example`) | Model used by `/api/reasoning/extract` (structured field extraction). Fed to `getExtractionModel()` in `lib/llm/config.ts`. |
| `TAVILY_API_KEY` | no | (unset) | Optional Tavily key for the post-acceptance code-edition/errata lookup (`/api/tavily`). Absent key degrades silently (`{ results: null }`) — never blocks the report, never errors. |
| `FLAWCHECK_DISABLE_LLM` | no | (unset) | LLM kill-switch. `1` or `true` forces the deterministic fallback engine with zero Nebius calls (`isLlmDisabled` in `lib/reasoning/schemas.ts`). |
| `FLAWCHECK_LIVE_LLM` | no | (unset) | Test-only gate (not in `.env.example` — documented in the test files). `1` or `true` enables the live LLM tests under `npm test`; the default suite skips them. See §4. |

\* **Required vs. default nuance:** `NEBIUS_MODEL_REASONING`,
`NEBIUS_MODEL_EXTRACTION`, and `NEBIUS_API_KEY` are read through `requiredEnv()`
in `lib/llm/config.ts` — there is **no code-level fallback** for any of them;
the accessor throws naming the missing variable if the live LLM path is
exercised without them. The "defaults" above are the *currently recommended*
IDs carried by `.env.example` (research-verified 2026-09-26; see
`.planning/phases/01-platform-spike/01-RESEARCH.md`). Only
`NEBIUS_BASE_URL` has a true hardcoded default in source. In disabled/demo
mode (`FLAWCHECK_DISABLE_LLM=1` or no key) none of these accessors are ever
invoked, so the app runs with `.env.local` containing only
`FLAWCHECK_DISABLE_LLM=1`.

### Security rules

- **API keys live ONLY in `.env.local`** (gitignored) — never in source, never
  in committed files. The health endpoint's body whitelist explicitly excludes
  the API key and the model catalog.
- **Model IDs are env-only** — `lib/llm/config.ts` begins with the invariant
  "No model-ID literals may appear in this file — model IDs come from env
  only." Model IDs are resolved at request time from the environment, never
  hardcoded in routes or prompts.
- Model IDs deprecate. Re-verify against the live catalog before trusting them:
  `npm run catalog` (runs `scripts/dump-model-catalog.mjs`). A snapshot dump
  also lives at `docs/model-catalog.json` (dumped 2026-09-27, 25 models).

---

## 2. TypeScript / Next.js configuration

### `tsconfig.json`

- Standard Next.js strict config: `strict: true`, `moduleResolution:
  "bundler"`, `jsx: "react-jsx"`, `incremental: true`, `@/*` path alias →
  repo root.
- **`include`**: `next-env.d.ts`, `**/*.ts`, `**/*.tsx`,
  `.next/types/**/*.ts`, `.next/dev/types/**/*.ts`, `**/*.mts`.
- **`exclude`**: `node_modules`, `flowstep-gui`, and **`scratch`** — scratch
  scripts are intentionally kept out of typecheck (noted in `README.md`).

### `next.config.ts`

- Empty/minimal config (no plugins, no rewrites, no env injection). The Next
  version is 16.3.6; see `node_modules/next/dist/docs/` for this version's
  conventions before changing build behavior.

### `vitest.config.ts`

- Loads `.env.local` into `process.env` for tests with a zero-dependency
  parser, **ambient variables always win** — an already-set env var is never
  overwritten. This is why `FLAWCHECK_DISABLE_LLM=1 npm test` and
  `FLAWCHECK_LIVE_LLM=1 npm test` work: the flag you pass on the command line
  takes precedence over anything in `.env.local`.
- `environment: "node"`, includes `tests/**/*.test.ts` / `tests/**/*.test.tsx`,
  resolves the `@` alias.

---

## 3. Runtime model selection

### Startup validation against the live catalog

- On server startup, Next.js runs the `register()` hook in `instrumentation.ts`
  (Node runtime only — `NEXT_RUNTIME === "nodejs"`), which calls
  `validateAndCacheModelConfig()` from `lib/llm/validate-config.ts`. It never
  crashes startup — a validation failure is logged (`console.warn`/`console.error`)
  and cached.
- Validation reads the two configured model IDs from env, lists the live
  catalog via `client.models.list()` (`GET /v1/models` on the base URL), and
  checks for **exact string membership** — no trim, no case folding, no
  aliasing. Result: `{ ok, missing[], checkedAt }`.
- `GET /api/health` returns the cached validation via `getModelValidation()`
  (cache max age 60 s; re-validates after expiry). `200 { status: "ok" }` when
  both configured IDs are present in the catalog, `503 { status: "degraded",
  missing: [...] }` otherwise.

### Request-time model resolution

- Routes never hardcode a model. `/api/reasoning/extract` calls
  `getExtractionModel()` and `/api/reasoning/narrative` calls
  `getReasoningModel()` at request time, inside the handler (so the disabled
  branch never touches them).
- Both routes set `reasoning_effort` / `reasoningEffort` to `"low"` today.
  `lib/llm/complete.ts` restricts the option to `"low" | "medium" | "high"`
  (verified against the provider 2026-09-26); anything wider is rejected.
- The narrative route streams with `stream: true`, `max_completion_tokens:
  4000`, and `stream_options: { include_usage: true }`; the extract route uses
  `runValidatedCompletion` with `maxCompletionTokens: 3000`, a bounded single
  retry, and Zod schema validation of every reply.

### The LLM availability gate

`isLlmDisabled()` (`lib/reasoning/schemas.ts`) is the single definition and
returns true when:

1. `FLAWCHECK_DISABLE_LLM` is `"1"` or `"true"` (explicit kill-switch), or
2. `NEBIUS_API_KEY` is absent.

When disabled: `/api/reasoning/extract` returns `200 { extraction: null,
usage: null, disabled: true }`, and `/api/reasoning/narrative` streams a
fallback frame (`{ type: "fallback", reason: "llm_disabled" }`) then `[DONE]`
— zero network, zero Nebius calls.

---

## 4. Verification flow

### Hermetic suite (default) — 648 passed / 5 skipped

```
FLAWCHECK_DISABLE_LLM=1 npm test
```

Runs the entire suite with no provider calls and no API key needed. Verified
result (2026-10-23): **57 test files passed, 2 skipped (59 total); 648 tests
passed, 5 skipped (653 total)**. The 5 skipped are the live-only tests:

- `tests/llm/hello-fixture.test.ts` — 4 tests skipped (reasoning model, extraction
  model, plus two forced-retry fixtures).
- `tests/reasoning/live-pipeline.test.ts` — 1 test skipped.

Both files gate with `describe.skipIf(!LIVE_READY)` where
`LIVE_READY = hasKey && liveGate`. Because `vitest.config.ts` loads `.env.local`,
a key present in `.env.local` alone does **not** activate these tests — the
`FLAWCHECK_LIVE_LLM` flag is the gate.

### Live LLM tests (opt-in) — real provider calls

```
FLAWCHECK_LIVE_LLM=1 npm test
```

Runs the same suite plus the 5 live tests (requires `NEBIUS_API_KEY` from
`.env.local`). These make real paid calls: one batched extraction + one
streamed narrative at `reasoning_effort "low"` (the live-pipeline test comments
estimate ~$0.001 per run — **[VERIFY] current pricing and quota limits against
Nebius before assuming cost**). They prove real-model behavior: Zod-valid JSON
from both routed models, the bounded retry self-correction path, and the live
extract→narrative pipeline. Live test failures are prompt-tuning findings, not
a reason to loosen a lint.

### Related scripts

- `npm run test:watch` — `vitest` watch mode.
- `npm run typecheck` — `next typegen && tsc --noEmit`.
- `npm run lint` — `eslint .`.
- `npm run catalog` — dump the live model catalog to stdout (`node --env-file=.env.local scripts/dump-model-catalog.mjs`); use it to re-verify model
  IDs before a deprecation notice bites.
- `npm run dev` / `npm run build` / `npm run start` — standard Next.js
  lifecycle; `npm run start` requires a production build.
