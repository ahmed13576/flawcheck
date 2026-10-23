# FlawCheck — Testing

FlawCheck's verification strategy is built around one invariant: every number,
verdict, citation, and rendered pixel is decided by deterministic TypeScript
under `lib/calc/`, `lib/report/`, and `lib/ingest/`, loaded from the criteria
JSON allowlists in `lib/criteria/`. The LLM only extracts, structures, and
narrates around those precomputed values — so the test suite is **hermetic**:
zero network, key-independent, and fully runnable offline.

This document describes the test suite as it exists in the repository. Every
path is relative to the repository root. Current counts (verified by a full
`npm test` run): **648 passed / 5 skipped**, across **57 test files passed /
2 skipped** (59 files total).

---

## 1. Test suites overview

The suite runs under **Vitest 5** (`vitest.config.ts`): plain `node`
environment (no jsdom), includes `tests/**/*.test.ts` and `tests/**/*.test.tsx`,
with the `@` alias mapped to the repository root. Tests mirror source paths
one-to-one: a module at `lib/calc/formulas.ts` is tested at
`tests/calc/formulas.test.ts`.

| Suite | Files | What it covers |
|---|---|---|
| `tests/calc/` | 11 | The deterministic engine: formulas, corrosion, intervals, verdicts, outliers, dates, PT/MT, and the golden fixtures G1–G14 + P1–P7, plus the criteria-sovereignty guard and the tracer-pipeline end-to-end. |
| `tests/ingest/` | 8 | CSV tokenize/parse, column auto-mapping, row validation, CML grouping, the units gate, and the committed demo fixtures (4,912 full register + 420-row subset). |
| `tests/reasoning/` | 11 | Four server-side lints, the citation tokenizer, the deterministic fallback contract, narrative context/stream/route behavior, and the offline e2e through the real API routes. |
| `tests/llm/` | 3 | LLM client config validation and the validated-completion retry contract (offline, via fake clients); the live model tests are gate-skipped. |
| `tests/report/` | 7 | The shared content seam, snapshot schema, audit module, report preview, and the PDF route — including the CR-01 top-10 worst ordering. |
| `tests/pdf/` | 2 | PDF vector analytics (SVG primitive tree, zero raster) and the `@react-pdf/renderer` runtime smoke. |
| `tests/analytics/` | 3 | Pure geometry engine, SSR render markup with motion-reduce assertions, and the Screen 3 analytics mount. |
| `tests/wizard/` | 12 | Reducer state machine, session hydration, flowstep chrome, pipeline status bar, reasoning pane UI, and Screen 3 mounts. |
| `tests/api/` | 2 | Rate limiter pins and the Tavily code-edition lookup route (degrade-never-block). |

### 1.1 `tests/calc` — engine golden values

The engine suites are the highest-value tests in the repo. They pin
hand-computed values with exact `toBe` assertions — never relative or
regenerated values.

- `formulas.test.ts` — B31.3 / API 574 thickness shapes: **G1** (ASME B31.3
  eq. 3a, `asme_b31_3_304_1_2`), **G2** (API 574 Barlow in-service,
  `api574_10_5_1_2`), **G3** (governing max selects the structural branch,
  `api574_10_5_1_4`).
- `corrosion.test.ts` — **G4** corrosion rates (API 570 7.1.2, formula-level
  Δt), **G9a** (both rates negative → `negative_cr_policy`), **G9b** (mixed
  signs → flag on either raw rate negative).
- `interval.test.ts` — **G6** (RL < 4 branch, not naive RL/2), **G7**
  (floor/cap interactions).
- `verdicts.test.ts` — **G8** verdict boundary equalities (locked order,
  `ut-criteria` `boundary_convention`).
- `dates.test.ts` — **G13** day-difference convention.
- `evaluate.test.ts` — orchestration over the real reducer seam: **G5**
  (remaining life + interval with class caps), **G10** (insufficient history,
  verdict still computes), **G11** (outliers per CML population), **G12**
  (mils end-to-end through the mm-canonical pipeline), **G14** (immediate
  inspection on negative remaining life), plus the WR-01 fail-closed and
  finiteness scans (no Infinity/NaN, no negative interval).
- `evaluate.demo.test.ts` — the flagship end-to-end: the committed 4,912-row
  Zenodo fixture flows load → validate → group → evaluate through the **real**
  reducer with zero network.
- `ptmt.test.ts` — **P1–P7** golden catalog (PT/MT, `ptmt-criteria.json`
  verbatim limits): relevance thresholds, rounding, cluster rules, crack-
  suspect mapping, and strict boundary comparisons.
- `tracer-pipeline.test.ts` — the TRACER metadata preset pipeline, including
  corrosion-rate, days/ISO-date, and verdict boundary checks.
- `criteria-sovereignty.test.ts` — the research Pitfall 9 guard: class
  maxima, gauge uncertainty, and PT/MT limits must load from
  `lib/criteria/*.json` via `lib/calc/criteria.ts` — never duplicated as bare
  numeric literals in engine code.
- `boundary-imports.test.ts` (in `tests/ingest/`) walks every file under
  `lib/calc/` and asserts none imports the LLM layer, React, `next`, or Node
  builtins — the calc layer is a pure island.

### 1.2 `tests/ingest` — CSV parse / map / group

- `validate.test.ts` — the strict numeric grammar (`parseNumericCell` never
  bare `Number()`), error/warning catalog, hard limits (`MAX_ROWS =
  50_000`, 25 MB file cap), and `tokenize`/`buildCells` CSV behavior.
- `map.test.ts` — header normalization, auto-guess against the UI-SPEC alias
  table, thickness-unit auto-guess, and the CR-02 nominal-scantling exclusion.
- `group.test.ts` — CML grouping, history derivation (`t_initial`/`t_previous`),
  unit canonicalization to mm, and the unmapped-Tank degradation policy.
- `units-gate.test.ts` — ING-05: undeclared units refuse evaluation loudly;
  declared-but-different units convert to canonical mm.
- `demo-fixture.test.ts` — the full register fixture: exactly 4,912 rows, and
  the locked verdict split **301 accept / 538 re-check / 4,073 fail**.
- `demo-subset-fixture.test.ts` — the primary demo subset: exactly 420 rows
  (one tank, every CML multi-campaign), flowing through the same session shape.
- `sample-register.test.ts` — the register path via the wizard reducer
  (blocking checks, tracer metadata preset).
- `boundary-imports.test.ts` — see §1.1 (purity guard).

### 1.3 `tests/reasoning` — lints, prompts, fallback, narrative route

- `lints.test.ts` — the four server-side lints: `numericConsistency`,
  `verdictAgreement`, `citationAllowlistLint`, `verbatimNgramLint`, plus
  `splitSentences` and `runFinalLints`.
- `tokenizer.test.ts` — all allowlist citation IDs resolve; invented IDs
  resolve to `false`; unclosed `[[cite:…` tokens; `safeTailHold` trims
  partial tokens without touching complete prose.
- `fallback.test.ts` — the deterministic fallback contract: every
  `[[cite:id]]` is a member of the engine's own citation set; the closing
  sentence is byte-exact; no Infinity/NaN or invented numerals anywhere.
- `narrative-context.test.ts` — context building, numeric allowlist, and the
  extraction schema hints.
- `narrative-stream.test.ts` — store-level fetch behavior: one fetch per open,
  zero on cache hit, FIFO cap.
- `narrative-route.test.ts` / `narrative-route-stream.test.ts` — the
  fallback-first route slices: the DISABLED branch streams one fallback frame
  then `[DONE]` with `text/event-stream`; ambient LLM presence is never
  relied on (kill-switch forced, see §2.2).
- `extract-route.test.ts` — extract route: disabled → 200 `{disabled:true}`,
  unknown field → 400.
- `lint-swap.test.ts` — a narrative that passes the sentence-guard mid-stream
  but fails a final lint swaps to the fallback with no usage frame.
- `e2e-offline.test.ts` — the full offline e2e through the real routes in
  fallback mode (kill-switch + `NEBIUS_API_KEY` deleted).
- `live-pipeline.test.ts` — **gated**: skipped unless `FLAWCHECK_LIVE_LLM=1`
  (§2.3).

### 1.4 `tests/llm` — config / client

- `validate-config.offline.test.ts` — model catalog validation against a fake
  OpenAI client (only `models.list` is exercised).
- `validated-call.retry.test.ts` — `runValidatedCompletion` offline contract:
  forced bad output → exactly 2 `create()` calls then resolves with the parsed
  value; persistent bad output → exactly 2 calls (never 3), then a clear
  rejection.
- `hello-fixture.test.ts` — **gated** live hello fixtures against routed
  models (§2.3).

### 1.5 `tests/report` — content seam, snapshot, PDF route

- `findings-brief.test.ts` — the content seam contracts (`lib/report/content.ts`):
  `buildFindingsBrief` (REPT-04), `buildCodeBreakdown`, `VERDICT_GLOSSARY`
  (REPT-06), and the locked dashboard copy builders — deterministic templates
  with zero `[[cite:` tokens, no LLM/telemetry/Date input.
- `report-contract.test.ts` — report session contract: optional validated
  sign-off round-trip (sessionStorage stubbed in node), degrade-to-absent on
  corrupt shapes, and content-seam exports (unknown citation IDs render zero
  glyphs).
- `snapshot-schema.test.ts` — WR-10: every enumerated trust-boundary surface
  throws a ZodError; the valid fixture parses.
- `report-audit.test.ts` — `computeInputHash` determinism and input
  sensitivity, `buildAuditSteps` null-passthrough, and the audit
  sessionStorage round-trip.
- `report-preview.test.ts` — FS-12 locked preview: pending-sign-off chip,
  "—" for nulls (never Infinity/NaN), citations composed only from
  `citations.json` fields, and disabled Download/Print while generation is
  gated.
- `pdf-route.test.ts` — includes the **CR-01 top-10 ordering**:
  `getTop10Worst` returns exactly 10 rows from the true worst set
  (RL-ascending, nulls last, verified against shuffled input so order never
  depends on input order), plus the locked page-1 order (banner → summary
  card → code-breakdown → top-10).
- `report-integration.test.ts` — the full chain: evaluation session → snapshot
  + audit → strict schema → the real PDF route POST → a genuine `%PDF`
  buffer, with no Phase 4 code mocked.

### 1.6 `tests/pdf` — PDF analytics vector trees

- `pdf-analytics.test.ts` — pins the vector element hierarchy: the trend
  curve renders `<Svg>` with `<Path>`/`<Line>`/`<Circle>` primitives and the
  severity matrix renders its `<Rect>` grid — **zero raster images anywhere**;
  also pins the pure adapter seam (`buildGoverningTrendPoints` /
  `toHeatmapItems`).
- `react-pdf-smoke.test.ts` — `@react-pdf/renderer` 4.9.0 renders a real
  non-trivial Buffer under React 19.3.0 (Assumption A1 runtime half).

### 1.7 `tests/analytics` — geometry, visual render, mount

- `geometry.test.ts` — the pure geometry engine: exact SVG path strings,
  scale arithmetic, tick generation, and every SPEC edge (zero CR, negative
  CR/thickness gain, immediate failure, single reading, **degenerate
  viewports**) with `toBe` on hand-computed values. Zero DOM.
- `visual-render.test.tsx` — SSR markup checks (`renderToStaticMarkup`):
  every component renders its geometry-derived SVG paths, carries
  accessibility labels, and includes the **motion-reduce utility classes**
  (`motion-reduce:animate-none`, `motion-reduce:transition-none`) in the DOM
  output (PDF-04). Components consume only geometry-engine output — no
  engineering number is derived in the component.
- `screen3-mount.test.tsx` — the master-native Screen 3 mount: the panel
  renders with readings; the heatmap `onSelect` relay highlights exactly the
  matching results-table rows (identity `cml ?? location`); empty readings
  render the empty state.

### 1.8 `tests/wizard` — reducer, hydration, flowstep, status bar

- `reducer.test.ts` — the largest single test file (53 tests): the wizard
  state machine, blocking checks, session validation, and the demo
  load/evaluate flows.
- `session-hydration.test.ts` — **CR-03**: the reference pattern for testing
  restored state. The provider's initial state is always
  `createInitialState()`; a saved session is applied from a post-hydration
  effect via the "restore-session" action, never inside a lazy initializer.
  Tests stub `globalThis.sessionStorage` with an in-memory map and assert the
  full demo scope restores 4,912 rows (not 420), PT/MT preservation
  round-trips, and unevaluated-screen-2 restore.
- `flowstep-restyle.test.ts` — the flowstep visual contract (FS-01..FS-12):
  SSR markup for the chrome, the locked Report step, Screen 1 reassurance/
  provenance/25 MB copy, Screen 2 hero chips and six mapping targets, Screen 3
  hero card + KPI cards + sticky strips, and the locked footer nav.
- `pipeline-status-bar.test.tsx` — UI-38..UI-43: pending digits-free, running…,
  complete with runtime-resolved badge + cost, FAILED badge, disabled
  "fallback mode", and the deterministic-fallback chip; the store is primed
  via the real narrative route contract with stubbed `fetch`.
- `reasoning-pane.test.ts` / `reasoning-stream-ui.test.tsx` — all five
  `NarrativeEntryState` states render their exact spec copy/classes; the
  streaming container carries `aria-busy` and the reduced-motion caret; the
  error state offers Retry narrative.
- `reasoning-strictmode.test.ts` — the CR-02 StrictMode double-invoke
  regression: the extraction effect must not deadlock under React 18/19
  StrictMode (setup → cleanup → setup with refs preserved).
- `color-scheme.test.ts` — the dark token block must set `color-scheme: dark`
  so native select popups, date pickers, and scrollbars stay legible.
- `results.test.ts` — formatting helpers (`formatFixed`, `formatCaption`,
  `nextInspectionCell`, `rlCell`, flag chips, verdict-chip class mapping).
- `screen3-brief.test.tsx`, `screen3-cta.test.tsx`,
  `screen3-integration.test.tsx` — Screen 3 brief/CTA mounts and the PT/MT
  pane + 4-step chrome integration.

### 1.9 `tests/api` — rate limit, Tavily route

- `rate-limit.test.ts` — PLAT-04 pins: the first 20 requests per IP are
  allowed; request 21 returns not-allowed with a `Retry-After` (1–60s); IPs
  are isolated (one IP's burst never affects another). Tests use unique IPs
  per test to keep module state fresh.
- `tavily-route.test.ts` — PLAT-03 pins: 400 on missing/oversized
  `designCode`/`evaluatedAt`; `{ results: null }` when `TAVILY_API_KEY` is
  unset (degrade, never block); results + `cached=false` on a mocked upstream
  success; `cached=true` on the second call with the same `evaluatedAt`
  (per-evaluation cache). Uses `vi.stubEnv("TAVILY_API_KEY", …)`.

The `app/api/health/route.ts` route has no dedicated unit test file in master;
its degraded/ok behavior is pinned indirectly through `validate-config` and
exercised by the spike page.

---

## 2. Running tests

### 2.1 Hermetic default: `npm test`

```bash
npm test
```

Runs the full suite (`vitest run`). It is **hermetic**: zero network,
key-independent, and green on a clean checkout with an empty `.env.local`.

How hermeticity is enforced:

- **Vitest loads `.env.local`** at startup (`vitest.config.ts`): the file is
  parsed into `process.env` before the suite runs, so ambient keys like
  `NEBIUS_API_KEY` are present in every run. Ambient variables never
  overwrite existing `process.env` values.
- **The fallback-contract tests force the kill-switch.** Tests that must stay
  on the deterministic path set `process.env.FLAWCHECK_DISABLE_LLM = "1"`
  in `beforeEach` and `delete process.env.FLAWCHECK_DISABLE_LLM` in
  `afterEach` (see `tests/reasoning/narrative-route.test.ts`,
  `tests/reasoning/e2e-offline.test.ts`, `tests/reasoning/extract-route.test.ts`).
  This is never left ambient — an ambient key would route those tests to the
  live path and break hermeticity. `tests/reasoning/e2e-offline.test.ts`
  additionally deletes `NEBIUS_API_KEY`.
- `tests/api/tavily-route.test.ts` stubs `TAVILY_API_KEY` per test with
  `vi.stubEnv` and unstubs in `afterEach`.

### 2.2 Targeting a single file

```bash
npx vitest run tests/calc/formulas.test.ts
```

Use the same command for watch mode: `npx vitest` (or `npm run test:watch`).

### 2.3 Live LLM tests (opt-in): `FLAWCHECK_LIVE_LLM=1 npm test`

Two files are **gate-skipped by default** via `describe.skipIf(!LIVE_READY)`:

- `tests/llm/hello-fixture.test.ts` — 4 tests skipped by default
- `tests/reasoning/live-pipeline.test.ts` — 1 test skipped by default

These are the only 5 skipped tests in the suite. Enable them explicitly:

```bash
FLAWCHECK_LIVE_LLM=1 npm test
```

This requires a real `NEBIUS_API_KEY` in `.env.local` and hits the live models.
A failure here is a prompt-tuning finding — never a reason to loosen a lint.
The skip file in the default run is what keeps `npm test` green and
key-independent.

---

## 3. Gate hierarchy

The standing gates run in order before any merge or milestone:

```bash
npm run typecheck   # next typegen && tsc --noEmit (strict TS)
npm run lint        # eslint . (0 errors)
npm test            # hermetic suite
npm run build       # production build — at milestones
```

- `npm run typecheck` — runs `next typegen` then `tsc --noEmit`; catches
  type drift across the app and test code.
- `npm run lint` — `eslint .` must produce 0 errors. Notably, the eslint
  config carries the `no-restricted-imports` block that keeps `lib/calc/`
  free of LLM/React/next/Node imports (belt-and-braces with
  `tests/ingest/boundary-imports.test.ts`).
- `npm test` — the hermetic suite (§2.1).
- `npm run build` — verified at milestones over the full route set: 3 pages
  (`/`, `/report`, `/spike`) and 6 API handlers (`/api/health`,
  `/api/reasoning/extract`, `/api/reasoning/narrative`,
  `/api/report/pdf`, `/api/spike/stream`, `/api/tavily`).

---

## 4. Golden / hard values

The following values are **never adjusted** to make tests pass. They are the
catalog the engine is pinned to; any change to them is a deliberate,
reviewed criteria change, not a test tweak.

| Fixture | Meaning | Where pinned |
|---|---|---|
| **G1** | ASME B31.3 eq. 3a required thickness | `tests/calc/formulas.test.ts` |
| **G2** | API 574 Barlow in-service | `tests/calc/formulas.test.ts` |
| **G3** | Governing max selects structural branch | `tests/calc/formulas.test.ts` |
| **G4** | Corrosion rates (API 570 7.1.2, formula-level Δt) | `tests/calc/corrosion.test.ts` |
| **G5** | Remaining life + interval with class caps | `tests/calc/evaluate.test.ts` |
| **G6** | RL < 4 branch (not naive RL/2) | `tests/calc/interval.test.ts` |
| **G7** | Floor/cap interactions | `tests/calc/interval.test.ts` |
| **G8** | Verdict boundary equalities (locked order) | `tests/calc/verdicts.test.ts` |
| **G9a/b** | Both-negative / mixed-sign corrosion rates | `tests/calc/corrosion.test.ts` |
| **G10** | Insufficient history (verdict still computes) | `tests/calc/evaluate.test.ts` |
| **G11** | Outliers per CML population | `tests/calc/evaluate.test.ts` |
| **G12** | Mils end-to-end through the mm-canonical pipeline | `tests/calc/evaluate.test.ts` |
| **G13** | Day-difference convention | `tests/calc/dates.test.ts` |
| **G14** | Immediate inspection on negative remaining life | `tests/calc/evaluate.test.ts` |
| **P1–P7** | PT/MT golden catalog (verbatim `ptmt-criteria.json` limits) | `tests/calc/ptmt.test.ts` |
| Demo split | Full register: **301 accept / 538 re-check / 4,073 fail** over 4,912 readings | `tests/ingest/demo-fixture.test.ts` |
| Demo subset | **420 rows** (one tank, every CML multi-campaign) | `tests/ingest/demo-subset-fixture.test.ts` |

Assertions on these values use exact `toBe`/`toEqual` — never ranges, never
regenerated golden files. The demo split is asserted as a whole-results
rollup (`total: 4912`, `accept: 301`, `reCheck: 538`, `fail: 4073`), and the
subset test asserts exactly 420 rows through the same session shape.

---

## 5. Writing tests

Follow the established patterns to keep the suite coherent:

- **Mirror source paths.** A module at `lib/…/x.ts` gets `tests/…/x.test.ts`
  (`.tsx` for anything rendering React elements). Group by area, not by
  feature of the moment.
- **Keep hermetic.** Never hit the network. LLM routes are exercised only in
  fallback mode via the `FLAWCHECK_DISABLE_LLM=1` kill-switch (§2.1), or with
  fake clients (`tests/llm/validate-config.offline.test.ts`).
- **Mock fetch for API route tests.** Route tests stub `globalThis.fetch`
  (or `vi.stubEnv` for env-dependent behavior) — see
  `tests/api/tavily-route.test.ts` and `tests/wizard/pipeline-status-bar.test.tsx`
  (which primes the store via the real narrative route contract with stubbed
  fetch).
- **Use `renderToStaticMarkup` for SSR/snapshot assertions.** The vitest
  environment is `node` — there is no jsdom. Component markup is asserted via
  `renderToStaticMarkup` from `react-dom/server` with `createElement` (see
  `tests/analytics/visual-render.test.tsx`, `tests/wizard/flowstep-restyle.test.ts`).
- **SessionStorage stubbing.** Browser storage is stubbed per test with an
  in-memory map on `globalThis.sessionStorage` (`tests/wizard/session-hydration.test.ts`
  is the canonical example).
- **Testing restored state.** `tests/wizard/session-hydration.test.ts` is the
  reference pattern: assert the provider's initial state is always
  `createInitialState()`, that a saved session is applied from a
  post-hydration effect via the "restore-session" action, and that the
  restored state round-trips through `serializeWizardState` /
  `readSavedWizardState`.
- **Name fixtures meaningfully.** Golden fixtures carry their catalog id in
  the test name (e.g. `"G1 ASME B31.3 eq. 3a"`, `"P1: MT L 4.2 W 0.8 …"`).
- **Never relax a pinned value.** If a golden value no longer matches, the
  criteria change must be reviewed against the standards documents first
  (§4).

---

## 6. Coverage / edge policy

- **Degenerate inputs must render safely.** NaN, empty arrays, extreme
  viewports, zero CR, negative CR/thickness gain, immediate failure, and
  single-reading histories are first-class test cases — see
  `tests/analytics/geometry.test.ts`, the WR-01 fail-closed and finiteness
  scans in `tests/calc/evaluate.test.ts`, and the "—" null rendering in
  `tests/report/report-preview.test.ts`.
- **Motion-reduce classes are asserted in analytics SSR tests.** The visual
  render tests assert `motion-reduce:animate-none` and
  `motion-reduce:transition-none` appear in the DOM output
  (PDF-04) — see `tests/analytics/visual-render.test.tsx`.
- **Infinity/NaN never appear in output.** The fallback pins
  (`tests/reasoning/fallback.test.ts`), the finiteness scan, and report
  rendering tests all assert the strings `Infinity`/`NaN` never occur.
