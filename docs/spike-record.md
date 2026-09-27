# Phase 1 Spike Record

**Date:** 2026-09-27
**Phase:** 1 — Platform Spike & App Skeleton
**Purpose:** Captures the recorded evidence Phase 4 (reporting/PDF) and Phase 2+ (LLM layer) build on. Every result below is the actual observed outcome of a re-runnable command — never an assumption.

## react-pdf install result

**Date:** 2026-09-27
**Command:** `npm install next@16.3.6 react@19.3.0 react-dom@19.3.0 zod@4.6.5 openai@7.23.0 @react-pdf/renderer@4.9.0`

**Outcome: clean install — no ERESOLVE conflict, no peer-dependency warnings emitted.**

- Resolved versions (from `npm ls --depth=0`):
  - `@react-pdf/renderer@4.9.0`
  - `react@19.3.0` / `react-dom@19.3.0` (deduped through the whole tree, including `@react-pdf/reconciler@2.0.0`)
- `@react-pdf/renderer` 4.9.0's registry `peerDependencies` declare `react: "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"` — React 19.3.0 satisfies `^19.0.0`, so npm resolved the pair without intervention (`--legacy-peer-deps` / `--force` were NOT used).
- Install summary: `added 418 packages ... found 0 vulnerabilities`; the dev-dep follow-up (`npm install -D typescript@^5.9.3 vitest@5.0.2 @types/node@^24.19.0 @types/react@^19.3.0 @types/react-dom@^19.3.0`) added 26 more, `found 0 vulnerabilities`.
- Re-check: `npm ls @react-pdf/renderer react` shows `@react-pdf/renderer@4.9.0` with `react@19.3.0 deduped` — no peer mismatch lines.

The runtime render half (renderToBuffer smoke) is a separate probe — see below.

## json_schema structured output result

**Date:** 2026-09-27
**Probe command:** `node --env-file=.env.local scratch/json-schema-probe.mjs` (probe reads both model IDs from env; script retained in gitignored `scratch/`)
**Probe request shape (per model):** `chat.completions.create` with `response_format: { type: "json_schema", json_schema: { name: "probe", schema: <minimal object with required ok:boolean + note:string, additionalProperties:false>, strict: true } }`, `max_completion_tokens: 300`

**Actual outcome — `json_schema` WORKS on BOTH routed models:**

| Model (env-configured) | Result |
|------------------------|--------|
| reasoning model (NEBIUS_MODEL_REASONING) | SUCCESS — returned `{"ok": true, "note": "schema probe"}`, parsed as JSON |
| extraction model (NEBIUS_MODEL_EXTRACTION) | SUCCESS — returned `{"ok": true, "note": "schema probe"}`, parsed as JSON |

No error was returned by either model — the API accepted the `json_schema` response_format without a 422 or rejection.

**Interpretation against Correction C2 (one line):** the live OpenAPI spec's parameter description ("only json_object/text supported") is stale relative to its own enum — `json_schema` is accepted and honored by both routed models today, but since this is undocumented behavior it can change without notice; production calls still default to the documented `json_object` + Zod + bounded-retry contract, with `json_schema` available as an optional tightening.

**Re-runnable:** the probe script lives at `scratch/json-schema-probe.mjs` (gitignored) and reads the model IDs from `.env.local` — rerun with `node --env-file=.env.local scratch/json-schema-probe.mjs`.

## react-pdf runtime render result

**Date:** 2026-09-27
**Test command:** `npx vitest run tests/pdf/react-pdf-smoke.test.ts`
**Outcome: PASSED** — `renderToBuffer` produced a Buffer of length > 100 starting with the `%PDF` magic bytes under React 19.3.0 (test builds a one-page Document/Page/Text tree via `React.createElement`).

- Resolved versions at test time: `@react-pdf/renderer@4.9.0`, `react@19.3.0` (from `npm ls`).
- This is the runtime half of Assumption A1: registry peer range was satisfied at install (see above), and the renderer also WORKS at runtime under React 19.3.0 — no runtime crash, no empty buffer.

## Routing corrections applied

- **Correction C1 — `reasoning_effort` enum:** implemented as the 3-value union `"low" | "medium" | "high"` ONLY in `lib/llm/complete.ts` (ValidatedCallOptions) and used as `"low"` in the SSE route. No `none`/`xhigh` values anywhere (a stale value would 422).
- **Correction C6 — serving regions / preferredRegion:** `preferredRegion` is NOT set anywhere (deprecated in Next 16 route segment config). The live catalog dump (`docs/model-catalog.json`, 25 models, dumped 2026-09-27) records the current serving data; per the catalog, the reasoning model serves from us-central1 and the extraction model from eu-north1 — the US→EU hop for extraction calls is accepted (A2), no architectural impact.

## Phase 4 input (evidence only — the print-CSS-first vs react-pdf-first decision belongs to Phase 4)

| Evidence | Result (2026-09-27) | Implication for Phase 4 |
|----------|---------------------|-------------------------|
| `@react-pdf/renderer` 4.9.0 install under React 19.3.0 | Clean — no ERESOLVE, no peer warnings | react-pdf-first has no dependency-level blocker |
| `@react-pdf/renderer` runtime `renderToBuffer` smoke | PASSED — real `%PDF` buffer | Runtime rendering works in the Node/Next 16/vitest 5 environment |
| `json_schema` response_format on both routed models | Accepted live (undocumented but honored) | Structured report metadata could be schema-enforced server-side before any PDF step |
| Standards-compliance constraint (AGENTS.md) | All arithmetic comes from `lib/calc/` + `lib/criteria/`; PDF is presentation only | Whichever renderer is chosen, report numbers must originate from the deterministic engine — this constrains template architecture, not renderer choice |

The record deliberately makes no Phase 4 decision: print-CSS vs react-pdf tradeoffs (styling control, pagination, standards-report layout fidelity, Vercel cold-start cost) are Phase 4's call, on this evidence plus Phase 2/3 output shape.
