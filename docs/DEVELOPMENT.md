# FlawCheck — Development

This document is the working guide for developers and agents in this repository:
how the repo is laid out, how to run the daily loops (dev, typecheck, lint,
test), the load-bearing coding conventions, and how the team's GSD planning
workflow and version control operate. It is the operational companion to
`docs/ARCHITECTURE.md` (what the system is, invariants) and
`docs/CONFIGURATION.md` (environment variables, model routing, verification
flow). Ground truth for everything here is the repository itself: `package.json`
scripts, `tsconfig.json`, `vitest.config.ts`, `eslint.config.mjs`,
`.gitignore`, and the source tree. All paths are relative to the repository
root.

---

## 1. Repository layout

```
app/               Next.js 16 routes (App Router)
components/        React components (wizard, report, analytics, ui)
hooks/             Framework-free client hooks (use-narrative-stream)
lib/               TypeScript library: calc, criteria, ingest, reasoning,
                   llm, report, wizard, analytics, demo, api, tavily
tests/             Vitest suite, mirroring lib/ and components/ paths
scripts/           Node tooling (model-catalog dump, demo subset generator)
docs/              Team/user documentation (this file, ARCHITECTURE, CONFIGURATION)
.planning/        GSD workflow state — internal, not user documentation
scratch/          Gitignored agent scratch — excluded from typecheck
public/            Static assets (favicon, mirrored demo CSVs)
```

### `app/` — Next.js routes

| Path | Role |
|---|---|
| `page.tsx` | The three-screen wizard root (1 Ingest → 2 Review → 3 Results). |
| `report/page.tsx` | The on-screen HTML report page (reads the session snapshot). |
| `api/health/route.ts` | `GET` — cached model-config validation status. |
| `api/reasoning/extract/route.ts` | `POST` — batched structured extraction from inspector notes/indications. |
| `api/reasoning/narrative/route.ts` | `POST` — SSE-streamed, linted acceptance narrative. |
| `api/report/pdf/route.ts` | `POST` — server-rendered certified PDF (sign-off gate). |
| `api/tavily/route.ts` | `POST` — optional code-edition/errata lookup (silent degrade). |
| `api/spike/stream/route.ts` | Reference SSE skeleton (research artifact). |

### `components/` — React components

| Directory | Contents |
|---|---|
| `components/wizard/` | Wizard screens (`screen-ingest.tsx`, `screen-review.tsx`, `screen-results.tsx`), panels (`column-mapping-panel.tsx`, `metadata-form.tsx`, `ptmt-entry.tsx`, `results-table.tsx`, `reasoning-pane.tsx`, `findings-brief.tsx`, …), and chrome (`wizard-context.tsx`, `step-indicator.tsx`, `pipeline-status-bar.tsx`, `demo-banner.tsx`, …). |
| `components/report/` | `report-document.tsx` (HTML report) and the server-side `pdf-document.tsx` plus vector-PDF counterparts `pdf-heatmap.tsx`, `pdf-trend-curve.tsx`. |
| `components/analytics/` | Web SVG renderers: `trend-curve.tsx`, `cml-heatmap.tsx`, `metric-gauge.tsx`. |
| `components/ui/` | Primitive building blocks: `badge.tsx`, `button.tsx`, `card.tsx`. |

### `lib/` — TypeScript library

| Directory | Role |
|---|---|
| `lib/calc/` | The deterministic ground truth: pure TypeScript evaluation engine (formulas, corrosion, remaining life, intervals, verdicts, outlier detection, PT/MT triage, units, rounding, orchestrator). Must never import LLM/React/Next/Node layers. |
| `lib/criteria/` | The single source of truth: `citations.json` (verified allowlist), `ut-criteria.json`, `ptmt-criteria.json`. Nothing in the app hardcodes these values. |
| `lib/ingest/` | CSV tokenizer, header mapping, validation, CML grouping, session model. |
| `lib/reasoning/` | Prompt construction, narrative context (payload + allowlists), the four server-side lints, deterministic fallback, schemas. |
| `lib/llm/` | The single Nebius/OpenAI-compatible client seam: env-only model routing, validated completion with bounded retry, config validation against the live catalog. |
| `lib/report/` | Pure content seam (`content.ts`), session snapshot, audit telemetry, strict PDF-body schema. |
| `lib/wizard/` | Pure wizard state reducer and display formatting. |
| `lib/analytics/` | Pure SVG/PDF geometry engine and adapters (recent addition). |
| `lib/demo/` | Committed demo scenario and fixtures (`demo-scenario.ts`, `Attribution.md`). |
| `lib/api/` | Per-IP fixed-window rate limiter. |
| `lib/tavily/` | Optional Tavily lookup client. |

### `tests/` — Vitest suite

Test files are colocated under `tests/` mirroring source paths: `tests/calc/`
↔ `lib/calc/`, `tests/ingest/` ↔ `lib/ingest/`, `tests/reasoning/` ↔ `lib/reasoning/`
+ `app/api/reasoning/`, `tests/llm/` ↔ `lib/llm/`, `tests/report/` ↔ `lib/report/`
+ `app/api/report/`, `tests/wizard/` ↔ `components/wizard/` + `lib/wizard/`,
`tests/analytics/` ↔ `lib/analytics/` + `components/analytics/`, plus
`tests/api/` (rate limiter, Tavily route) and `tests/pdf/` (react-pdf smoke).

### `.planning/` — GSD workflow state (not user documentation)

The team plans in the GSD workflow: `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`,
`PROJECT.md`, `config.json`, and per-phase artifacts under `phases/<N-name>/`.
This directory is internal working state, not end-user documentation — see
Section 5 for how new phases work.

### `scratch/` — agent scratch

Gitignored working area for throwaway scripts, probes, and one-off experiments.
It is excluded from typecheck (`tsconfig.json` `exclude`: `node_modules`,
`flowstep-gui`, `scratch`) so anything in here may freely be TypeScript
sketching that would not compile. Never put committed work here.

---

## 2. Daily development workflow

All commands run from the repository root. Node.js ≥ 24 is the prerequisite.

### Run the app

```bash
npm run dev          # next dev → http://localhost:3000
```

Standard Next.js lifecycle: `npm run build` / `npm run start` (start requires a
production build). There is no custom build wiring — `next.config.ts` is
minimal.

### Typecheck gate

```bash
npm run typecheck    # next typegen && tsc --noEmit
```

`tsc --noEmit` with `strict: true` is the gate. Note the `next typegen` prefix:
it regenerates Next's route type declarations before the full compile, so the
typecheck exercises the app's typed routes. This must be clean before any merge
to `master`.

### Lint

```bash
npm run lint         # eslint .
```

The bar is **zero lint errors**. `eslint.config.mjs` composes
`eslint-config-next` core-web-vitals + typescript and adds the load-bearing
**R8 forbidden-import gate**: any file under `lib/calc/**` is lint-error
forbidden from importing `lib/llm`, `react`, `react-dom`, `next`, or `node:*`
(see Section 3). Do not weaken the bar; add exceptions only with a reason that
survives review.

### Tests

```bash
npm test                 # vitest run (hermetic suite)
npm run test:watch       # vitest watch mode
```

The default suite is **hermetic**: zero network, zero provider calls, no API
key required. `vitest.config.ts` loads `.env.local` into `process.env` with a
zero-dependency parser, and ambient environment variables always win — so an
already-set var is never overwritten. That is why a flag passed on the command
line takes precedence over `.env.local`:

```bash
FLAWCHECK_DISABLE_LLM=1 npm test   # explicit hermetic mode (default behavior)
FLAWCHECK_LIVE_LLM=1 npm test      # opt-in live LLM tests (real paid calls)
```

- Hermetic mode is the invariant: `FLAWCHECK_DISABLE_LLM=1` forces the
  deterministic fallback engine (`isLlmDisabled()` in `lib/reasoning/schemas.ts`)
  so the app and all tests run end-to-end with zero LLM calls.
- Live LLM tests (`tests/llm/hello-fixture.test.ts`, `tests/reasoning/live-pipeline.test.ts`)
  gate with `describe.skipIf(!LIVE_READY)` where `LIVE_READY = hasKey && liveGate`
  (`FLAWCHECK_LIVE_LLM` = `1`/`true`, plus `NEBIUS_API_KEY` present). A key in
  `.env.local` alone does **not** activate them — the flag is the gate. These
  make real paid provider calls and prove real-model behavior; a live-test
  failure is a prompt-tuning finding, not a reason to loosen a lint.

Current suite state: 648 passing tests (57 files) hermetic, 5 live-only tests
skipped by default. `npm run typecheck` and `npm run lint` are clean.

### Model catalog check

```bash
npm run catalog    # node --env-file=.env.local scripts/dump-model-catalog.mjs
```

Dumps the live Nebius model catalog to stdout. Use it to re-verify configured
model IDs (`.env.example`) before a deprecation notice bites — model IDs
deprecate and are env-only by design (Section 3).

---

## 3. Coding conventions

### 3.1 Calculation sovereignty (the invariant)

**TypeScript computes every number; the LLM never touches arithmetic.** All
evaluation is pure TypeScript under `lib/calc/`; the LLM only extracts,
structures, and narrates around precomputed values. This is enforced by:

- **Forbidden-import lint** (`eslint.config.mjs`): `lib/calc/**` may not import
  `lib/llm`, `react`, `react-dom`, `next`, or `node:*`.
- **Mechanical boundary test** (`tests/ingest/boundary-imports.test.ts`):
  walks every file under `lib/calc` and asserts no import/export resolves into
  the LLM layer (alias, relative, or dynamic) and that no source contains
  `Date.now(` or `Math.random(` — no time-of-day or randomness may enter the
  engine. This runs in `npm test` even when lint is skipped.
- **Criteria-sovereignty test** (`tests/calc/criteria-sovereignty.test.ts`):
  asserts the guarded criteria values (gauge uncertainty 0.1, PT/MT relevance
  1.5, rounded limit 5.0, class maxima 10.0/5) appear only in
  `lib/criteria/*.json` — never as numeric literals in `verdicts.ts`,
  `interval.ts`, or `ptmt.ts`. `lib/calc/criteria.ts` is the one sanctioned
  access point.

### 3.2 Criteria and citations load from `lib/criteria/` JSON only

All formula coefficients, thresholds, maxima, uncertainties, and citation IDs
load from the three committed JSON files in `lib/criteria/`; `lib/calc`
implements formula *shapes* only, never hard-coded constants. `citations.json`
is the **verified allowlist** — the only source of citation text anywhere in
the app. The guidance from `AGENTS.md` applies: LLMs (and developers) must
never invent clause citations or alter acceptance limits; if a rule needs to
change, it changes in the JSON — never in code.

### 3.3 No hardcoded model IDs in source

Model IDs are **env-only**. `lib/llm/config.ts` resolves
`NEBIUS_MODEL_REASONING` / `NEBIUS_MODEL_EXTRACTION` from the environment at
request time via `requiredEnv()` — there is no code-level fallback and no
literal model ID in any route, prompt, or test. Test fixtures use neutral IDs
(`test-reasoning-model`, …) — never real vendor IDs. `.env.example` carries the
currently recommended IDs (research-verified); re-verify them against the live
catalog with `npm run catalog` before relying on them.

### 3.4 Pure-module discipline

Modules under `lib/calc/`, `lib/analytics/geometry.ts`, `lib/reasoning/lints.ts`,
and `lib/report/content.ts` are pure TypeScript: no DOM, no React, no
Next.js server context, no Node builtins in production code (tests may use
`node:fs`). This keeps the same code runnable in the vitest node environment
and the browser/server unchanged. New pure modules should follow the same
boundary discipline — if a new module is deterministic math, it belongs under
`lib/calc/` (or `lib/analytics/` for visualization geometry) and carries the
same guards.

---

## 4. Testing conventions

### 4.1 Mirror layout

Vitest files are colocated under `tests/` mirroring the source path: a change
to `lib/calc/formulas.ts` lands a test at `tests/calc/formulas.test.ts`; a
route at `app/api/reasoning/narrative/route.ts` lands its test at
`tests/reasoning/narrative-route.test.ts`. Test files are `.test.ts` or
`.test.tsx` (component render tests); `vitest.config.ts` runs `environment:
"node"` over `tests/**/*.test.ts` and `tests/**/*.test.tsx` with the `@/` alias
resolved.

### 4.2 Golden values are pinned exactly

Engine tests assert exact golden outputs (e.g., `tests/calc/evaluate.test.ts`,
`evaluate.demo.test.ts`, `tests/calc/formulas.test.ts`). **Never adjust
numbers to make a test pass** — a changed assertion is a change of behavior and
must be reviewed as such. If an upstream standard revision legitimately changes
a result, the change flows through `lib/criteria/*.json` and the golden specs
are updated deliberately, not bent.

### 4.3 Hermetic by default; `beforeEach` stubEnv pattern

Every new test must run hermetic under `FLAWCHECK_DISABLE_LLM=1` — no network,
no provider calls, no reliance on a real API key. Where a test touches module
configuration, use the save/restore env pattern from
`tests/llm/validate-config.offline.test.ts`: capture `process.env` values in
`beforeEach`, set test values (neutral IDs, fake keys), and restore in
`afterEach`. Live-only behavior goes behind `describe.skipIf(!LIVE_READY)` as
in `tests/llm/hello-fixture.test.ts` — never run a live call unconditionally.

### 4.4 SSR / snapshot rendering

Component tests run in the node environment (no jsdom). SSR/snapshot assertions
use `renderToStaticMarkup` from `react-dom/server` (with `createElement` from
`react`) — see `tests/analytics/visual-render.test.tsx`,
`tests/wizard/screen3-cta.test.tsx`, `tests/wizard/pipeline-status-bar.test.tsx`.
There is no jsdom in the project; do not add a browser-like test environment
without a strong reason.

### 4.5 Demo-fixture integrity

The committed demo fixtures are load-bearing: `tests/ingest/demo-fixture.test.ts`
and `demo-subset-fixture.test.ts` pin their shape and row counts (420-row
subset, 4,912-row full register). Regenerating them via
`scripts/generate-demo-subset.mjs` must keep those pins green.

---

## 5. Adding a new requirement or phase (GSD workflow)

The project plans with the GSD workflow; state lives in `.planning/` and is
**not user documentation**:

- `STATE.md` — current phase, status, progress, velocity.
- `ROADMAP.md` — phase list and details; `REQUIREMENTS.md` — requirement
  catalogue; `PROJECT.md` — project reference.
- Per-phase artifacts live in `.planning/phases/<N-name>/` (e.g.,
  `phases/06-report-digestibility/`): `NN-PLAN.md`, `NN-SUMMARY.md`,
  `CONTEXT.md`, `REVIEW.md`, `VERIFICATION.md`, `RESEARCH.md`, `UI-SPEC.md`.
- The continuity doc is `agent-handoff.md` (repo root) — read it first when
  picking up work; it carries the blocking constraints learned from failures
  (e.g., NDT standards ground truth, no LLM arithmetic). Phase after phase, the
  workflow is: plan in `.planning/`, implement, verify (doc + tests), review,
  and record a summary in the phase directory.

When adding a new phase: create `.planning/phases/<N-name>/`, update `STATE.md`
and `ROADMAP.md`, and carry the invariant checks (typecheck, lint, hermetic
tests) as the phase's verification gate.

---

## 6. Version control

- **`master` is the stable submission branch.** It must always be green:
  typecheck clean, lint clean, hermetic suite passing. Merges to `master` are
  the release surface.
- **Working branches per change.** The repo's convention is prefixed branches:
  `build/phase-N`, `fix/<topic>`, `feat/<topic>`, `audit/<topic>`, `prop/<topic>`,
  `redesign/<topic>`. A change is developed on its own branch and merged when it
  clears the gates.
- **Never commit:** `.env.local` (the `.gitignore` ignores `.env*` except the
  committed `.env.example` template), `.next/` build output, and `scratch/`
  agent working files. API keys belong only in `.env.local`.
- Standards PDFs (API 570, API 574, ASME B31.3, hackathon brief) are
  gitignored and never published — they are licensed/© materials.

---

## 7. Related reading

- `docs/ARCHITECTURE.md` — system design, data flow, and the Section 9
  Invariants (the load-bearing engineering guarantees).
- `docs/CONFIGURATION.md` — environment variables, model selection/validation,
  and the full verification flow (hermetic vs. live).
- `AGENTS.md` — workspace guardrails for agents: NDT standards hierarchy (API
  570 / API 574 / ASME B31.3-2024), the `lib/criteria/` single source of truth,
  and Windows/PowerShell PDF-handling guidance.
