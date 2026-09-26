# Phase 1: Platform Spike & App Skeleton - Research

**Researched:** 2026-09-26 (all versions verified against the npm registry and official docs TODAY; see Sources)
**Domain:** Next.js 16 App Router scaffold + Nebius Token Factory OpenAI-compatible integration (validated LLM calls, SSE streaming, startup model validation)
**Confidence:** HIGH for package versions and API contracts (npm registry + official primary sources, same-day); MEDIUM for Vercel-runtime behavioral details and single-source official-doc claims

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — infrastructure phase. CONTEXT.md records:

> ### Claude's Discretion
> All implementation choices are at Claude's discretion — infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Claude's Discretion
Entire implementation of Phase 1 (scaffold shape, library versions, file layout) is at Claude's discretion, constrained by: ROADMAP Phase 1 success criteria 1–5, REQUIREMENTS PLAT-01/PLAT-02, AGENTS.md guardrails, and the builder constraints below.

### Deferred Ideas (OUT OF SCOPE)
None — infrastructure phase.

### Builder constraints (from orchestrator — hard)
- Solo builder; domain expert (NDT Level 2), not a professional coder; **all code agent-written**
- $25 Nebius credits total
- **Every package install requires explicit user approval before running** — the plan must gate each `npm install` behind a human-approve checkpoint
- Grounded facts only: versions verified against npm registry / official docs (done in this document, dated 2026-09-26)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAT-01 | All model calls via Token Factory OpenAI-compatible API; env-configured IDs validated against live `/v1/models` at startup | Verified base URL + Bearer auth + `/v1/models` (OpenAPI spec, fetched today); `instrumentation.ts` `register()` startup hook (official docs); `/api/health` route pattern; `scripts/dump-model-catalog.mjs` + `docs/model-catalog.json` for the committed dump; both routed model IDs re-verified live today |
| PLAT-02 | LLM responses stream (SSE); structured output enforced (`json_object` + Zod + one bounded retry) | Verified `response_format: {type:"json_object"}`, `stream: true` SSE with `data:[DONE]`, `reasoning_effort` (low/medium/high ONLY — see correction), `max_completion_tokens`; official Next.js ReadableStream route-handler streaming pattern; vitest 5 `skipIf` for CI-safe live tests; injectable-client retry unit test |
</phase_requirements>

## Summary

Phase 1 is a greenfield Next.js 16 scaffold plus four proofs: (1) a committed live model catalog, (2) startup-validated env-configured model routing, (3) the validated-call pattern (`json_object` → Zod → exactly one bounded retry) against both routed models, and (4) SSE streaming end-to-end through a route handler. Every package version in this document was verified against the npm registry today (2026-09-26), and every API contract against official Token Factory / Next.js docs fetched today.

Three corrections to `.planning/research/STACK.md` (2026-09-24) were discovered and matter for the plan:

1. **`reasoning_effort` enum is `low | medium | high` ONLY.** STACK.md said "`none`…`xhigh`" — the live OpenAPI spec (version 20260506-297d05704, fetched today) defines only `low`, `medium`, `high`. Sending `"none"` would 422. There is no documented way to disable reasoning via this parameter; control reasoning-token cost with `low` + `max_completion_tokens`.
2. **TypeScript 7.0.2 is now `latest` on npm** (the Go-native compiler, published this week). Next.js 16 officially requires "TypeScript 5.1 minimum", and create-next-app 16.3.6 itself injects `typescript: "^5"` into generated projects. **Pin `typescript@^5.9.3`** (5.x latest); do not hand-upgrade to 7.
3. **vitest is at 5.0.2** (STACK.md said 3.x) and `@types/node` should be `^24` (STACK.md era default `^20` no longer matches the machine's Node 24.14.1 or vitest 5's peer range).

The scaffold cannot be generated in-place: `create-next-app@16.3.6` refuses non-empty directories (verified from its bundled `isFolderEmpty` allowlist — the repo root contains `.planning/`, `lib/`, `AGENTS.md`, PDFs, none of which are tolerated). The plan must scaffold into a temp dir with `--disable-git --skip-install`, merge files into the repo root, preserve the workspace `AGENTS.md` (create-next-app generates its own), merge `.gitignore`, then run one approved `npm install`.

**Primary recommendation:** Scaffold Next.js 16.3.6 (App Router, TS 5.9, Tailwind v4, ESLint 9) via temp-dir + merge; build `lib/llm/` (config → client → validate-config → complete with one-retry), `app/api/health` + `app/api/spike/stream` + `app/spike` demo page, `instrumentation.ts` startup validation, `scripts/dump-model-catalog.mjs` → committed `docs/model-catalog.json`, and vitest 5 tests (offline retry test + `skipIf`-gated live fixture tests against both models).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| LLM calls to Token Factory | API / Backend (`lib/llm/*` in Node runtime route handlers) | — | API key must never reach the client tier; all model I/O is server-side |
| Model routing config + startup validation | API / Backend (`lib/llm/config.ts`, `instrumentation.ts`) | Frontend display via `/api/health` | Env vars are server-only; the client tier only sees the health result |
| Validated structured output (json_object → Zod → retry) | API / Backend (`lib/llm/complete.ts`) | — | Zod runs server-side on model output before anything reaches the client |
| SSE streaming to browser | API / Backend (route handler `ReadableStream`) → Browser (fetch + `ReadableStream` reader) | — | Route handler re-encodes SDK stream chunks; client tier only renders tokens |
| Model catalog dump | Build-time script (`scripts/dump-model-catalog.mjs`) | Committed artifact (`docs/model-catalog.json`) | One-off npm script, needs key from `.env.local`, output committed |
| Health/red-banner UI | Browser (React client component polling `/api/health`) | API (`/api/health`) | Browser owns rendering; API owns the check |

## Standard Stack

### Core

| Library | Version (verified 2026-09-26) | Purpose | Why Standard |
|---------|------------------------------|---------|--------------|
| `next` | **16.3.6** | App Router, route handlers, Turbopack | Current stable (`dist-tags.latest`, modified 2026-09-26); engines `node >=20.9.0` ✓ on Node 24.14.1 [VERIFIED: npm registry] |
| `react` / `react-dom` | **19.3.0** | UI (App Router) | create-next-app 16.3.6 pins `^19`; resolves 19.3.0 [VERIFIED: npm registry + create-next-app bundle] |
| `typescript` | **^5.9.3** (5.9.3 = latest 5.x) | Type safety; `strict: true` | **Do NOT use latest 7.0.2** (new Go compiler — Next.js officially requires "TypeScript 5.1 minimum" and tests the 5.x line; create-next-app 16.3.6 itself injects `^5`) [VERIFIED: npm registry + nextjs.org v16 upgrade guide + create-next-app bundle] |
| `zod` | **4.6.5** | Schema validation of model output + later all input boundaries | Current latest; satisfies `openai` peer `^3.25 \|\| ^4.0` [VERIFIED: npm registry] |
| `openai` | **7.23.0** | Typed client for Token Factory (`baseURL` override), streaming | Current latest; engines `node >=22.0.0` ✓; `stream: true` + `for await` documented in SDK README [VERIFIED: npm registry + openai-node README] |
| `vitest` | **5.0.2** (+ `vite` 8.3.1 auto-installed required peer) | Unit tests (offline retry logic) + `skipIf`-gated live fixture tests | Current latest; engines `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` ✓ Node 24.14.1 [VERIFIED: npm registry] |
| `tailwindcss` + `@tailwindcss/postcss` | **^4.3.3** / `^4` | Styling (wizard UI in Phases 2–4) | create-next-app default; v4 CSS-first (`@import "tailwindcss"`), zero config cost [VERIFIED: npm registry + create-next-app bundle] |
| `eslint` + `eslint-config-next` | **^9** / **16.3.6** | Lint; base for Phase 2 forbidden-import lint (`no-restricted-imports`) | create-next-app 16.3.6 injects exactly this pair; peers `eslint >=9, typescript >=3.3.1` ✓ [VERIFIED: npm registry + create-next-app bundle] |
| `@types/node` / `@types/react` / `@types/react-dom` | **^24.19.0** / **^19.3.0** / **^19.3.0** | Types | `@types/node` must be overridden from create-next-app's `^20` to `^24` to match Node 24.14.1 and vitest 5's peer `^22.0.0 \|\| >=24.0.0` [VERIFIED: npm registry] |
| `@react-pdf/renderer` | **4.9.0** | Phase 4 PDF — installed NOW to record the peer-dep result (roadmap success criterion 5) | peerDependencies declare `react: "^16.8.0 \|\| ^17.0.0 \|\| ^18.0.0 \|\| ^19.0.0"` → **React 19.3.0 satisfies `^19.0.0` at the registry level; npm install will not conflict**. Runtime render smoke test still required in Phase 1. No `engines` field; no postinstall script. Node-runtime route handlers only [VERIFIED: npm registry, today] |

**Registry-verified today but NOT installed in Phase 1** (later phases, recorded to avoid re-research): `papaparse` (Phase 2 CSV), `@tavily/core` (Phase 5).

### Installation (single approved gate)

```bash
# 1. Scaffold into temp dir (NEVER in repo root — create-next-app refuses non-empty dirs)
npx create-next-app@latest flawcheck-scaffold --ts --app --tailwind --eslint --use-npm --disable-git --skip-install --yes
# 2. Merge generated files into repo root (see Scaffold Merge Procedure below)
# 3. One approved install (requires explicit user approval):
npm install next@16.3.6 react@19.3.0 react-dom@19.3.0 zod openai @react-pdf/renderer
npm install -D typescript@^5.9.3 vitest@5.0.2 @types/node@^24.19.0 @types/react@^19.3.0 @types/react-dom@^19.3.0
#    (tailwindcss/@tailwindcss/postcss/postcss/eslint/eslint-config-next come from the merged scaffold package.json — same single approval)
```

**Version verification method:** `npm view <pkg> version dist-tags.latest engines peerDependencies` for every row above, run 2026-09-26 against `registry.npmjs.org`.

## Package Legitimacy Audit

> Gate run 2026-09-26 via `gsd-tools query package-legitimacy check --ecosystem npm` on all 14 scaffold packages.

| Package | Registry | Age signal | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----------|-----------|-------------|---------|-------------|
| next | npm | published 2026-09-22 | 65.6M/wk | github.com/vercel/next.js | SUS ("too-new") | Approved — heuristic false positive; canonical package |
| react / react-dom | npm | 2026-09-09 | 201.7M / 159.7M /wk | github.com/react/react | SUS ("too-new") | Approved — heuristic false positive |
| typescript | npm | 2026-07-08 | 325.7M/wk | github.com/microsoft/TypeScript | OK | Approved (pin ^5.9.3) |
| zod | npm | 2026-09-13 | 274.1M/wk | github.com/colinhacks/zod | SUS ("too-new") | Approved — heuristic false positive |
| openai | npm | recent | 36.0M/wk | github.com/openai/openai-node | SUS ("too-new") | Approved — heuristic false positive |
| vitest | npm | recent | 96.7M/wk | github.com/vitest-dev/vitest | SUS ("too-new") | Approved — heuristic false positive |
| tailwindcss / @tailwindcss/postcss | npm | recent | 145.8M / 41.5M /wk | github.com/tailwindlabs/tailwindcss | OK | Approved |
| @types/node, @types/react, @types/react-dom | npm | recent | 494.9M / 186.5M / 158.4M /wk | github.com/DefinitelyTyped/DefinitelyTyped | SUS ("too-new") | Approved — heuristic false positive |
| eslint / eslint-config-next | npm | recent | 153.5M / 30.6M /wk | github.com/eslint/eslint, vercel/next.js | SUS ("too-new") | Approved — heuristic false positive |
| @react-pdf/renderer | npm | 2026-08-27 | 6.4M/wk | github.com/diegomura/react-pdf | SUS ("too-new") | Approved — heuristic false positive; **install result recorded as roadmap deliverable** |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** all of the above, solely on the gate's `too-new` recency reason. Signal quality is unambiguous (36M–495M weekly downloads, canonical upstream repos, `postinstall: null` on every package). The builder constraint "every package install requires explicit user approval" already provides the `checkpoint:human-verify` the SUS verdict demands — the plan's install task(s) MUST still be gated on explicit user approval.

## STACK.md Corrections (read before planning)

| # | STACK.md said (2026-09-24) | Verified today (2026-09-26) | Source |
|---|---------------------------|------------------------------|--------|
| C1 | `reasoning_effort` (`none`…`xhigh`) | **Enum is `low \| medium \| high` only.** No `none`, no `xhigh`. Control reasoning cost via `low` + `max_completion_tokens` | Live OpenAPI spec `20260506-297d05704` [VERIFIED] |
| C2 | `json_schema` "model-dependent" | Spec enum *contains* `json_schema`, but the parameter description states **"Only {'type': 'json_object'} or {'type': 'text'} is supported"** — the Phase 1 spike record must capture the actual result | Live OpenAPI spec [VERIFIED] |
| C3 | vitest 3.x | **5.0.2** current (engines Node ^22.12/^24/>=26) | npm registry [VERIFIED] |
| C4 | create-next-app pins `@types/node ^20` | True of the generator, but must be overridden to **^24** for vitest 5 peer compat and Node 24 match | npm registry + vitest peerDependencies [VERIFIED] |
| C5 | — (new fact) | TypeScript 7.0.2 is npm `latest` (new compiler); scaffold must pin **^5.9.3** | npm registry + nextjs.org upgrade guide ("TypeScript 5+ minimum") [VERIFIED] |
| C6 | — (new fact) | Lightning serves from **eu-north1**; Super-120B from **us-central1** — extraction calls get US→EU hop when the Vercel function is US-hosted. Acceptable; do not use `preferredRegion` (deprecated in route segment config) | model-catalog.md [VERIFIED] |

Both routed model IDs re-verified live today, verbatim from the official catalog:
- `nvidia/nemotron-3-super-120b-a12b` — $0.30/$0.90 per 1M in/out, 256K ctx, us-central1
- `nvidia/Nemotron-3_5-Lightning` — $0.06/$0.24 per 1M in/out, 1M ctx, eu-north1
(Ultra-253B and Nano-Omni remain dedicated-endpoint-only; no new serverless deprecation notice exists beyond June/August 2026.)

## Architecture Patterns

### System Architecture Diagram

```
 [Browser: app/spike page]                [Next.js server (Node runtime, Vercel function)]
   |  fetch('/api/spike/stream')   --->  app/api/spike/stream/route.ts
   |                                       |  lib/llm/config.ts  (reads env model IDs; NO defaults in code)
   |                                       |  lib/llm/client.ts  (new OpenAI({ baseURL, apiKey }))
   |                                       v
   |                                  api.tokenfactory.nebius.com/v1  (SSE stream:true, json_object)
   |                                       |
   |  reader.read() loop          <---  ReadableStream + TextEncoder re-encode (data: {...}\n\n)
   |
   |  fetch('/api/health')        --->  app/api/health/route.ts
   |  red banner on failure             |  reads cached validation result (globalThis singleton)
                                       |       ^
 [server start]                        |       |
   instrumentation.ts register() ------+------- lib/llm/validate-config.ts
   (once per server instance)                  GET /v1/models -> compare env IDs -> {ok, missing[]}

 [Build-time, manual] scripts/dump-model-catalog.mjs  --node --env-file=.env.local-->
                                       GET /v1/models -> writes committed docs/model-catalog.json
```

### Recommended Project Structure (exact target tree)

```
C:/Users/moham/Documents/Nebuis/            (repo root = app root; NO src/ dir)
├── .gitignore                              # MERGE create-next-app's (adds .next/, .env*, node_modules/) with existing .planning rules
├── .env.local                              # NEBIUS_API_KEY etc. — gitignored (create-next-app gitignore covers .env*)
├── .env.example                            # COMMITTED: var names + recommended current model IDs, no key
├── AGENTS.md                               # EXISTING workspace guardrails — do NOT overwrite (next dev appends its managed block below existing content; keep it)
├── docs/
│   ├── model-catalog.json                  # committed live /v1/models dump (regenerate: npm run catalog)
│   └── spike-record.md                     # Phase 1 spike record: json_schema result, react-pdf install result
├── lib/
│   ├── criteria/                           # EXISTING — builder-vetted ground truth; DO NOT MODIFY this phase
│   ├── calc/                               # reserved for Phase 2 (empty dir or placeholder README)
│   └── llm/
│       ├── config.ts                       # env accessors: NEBIUS_MODEL_REASONING / NEBIUS_MODEL_EXTRACTION / NEBIUS_API_KEY / NEBIUS_BASE_URL — throws naming the missing var
│       ├── client.ts                       # OpenAI SDK client factory (baseURL default https://api.tokenfactory.nebius.com/v1/)
│       ├── validate-config.ts              # validateModelConfig(): GET /v1/models, compare env IDs, returns {ok, missing[], checkedAt}
│       ├── complete.ts                     # runValidatedCompletion(): json_object → Zod → exactly one bounded retry; injectable client
│       └── schemas.ts                      # spike Zod schemas (hello fixture schema)
├── scripts/
│   └── dump-model-catalog.mjs              # plain .mjs (node --env-file; no tsx dep)
├── app/
│   ├── layout.tsx  page.tsx  globals.css   # from scaffold
│   ├── spike/
│   │   └── page.tsx                        # SSE demo client + red-banner component
│   └── api/
│       ├── health/route.ts                 # GET: runs/reads validation; 503 + degraded JSON naming missing IDs
│       └── spike/stream/route.ts           # POST: streams Super-120B (or env-selected model) through ReadableStream
├── instrumentation.ts                      # register() → NEXT_RUNTIME==='nodejs' gate → dynamic import validation → cache result
├── tests/
│   ├── llm/validated-call.retry.test.ts    # OFFLINE: injected fake client proves exactly-one-retry + clear final error
│   └── llm/hello-fixture.test.ts           # LIVE: it.skipIf(!process.env.NEBIUS_API_KEY) against BOTH models
├── vitest.config.ts
├── next.config.ts  tsconfig.json  eslint.config.mjs  postcss.config.mjs  next-env.d.ts
└── package.json
```

Conventions: import alias `@/*` → `./*` (create-next-app default tsconfig paths) — use `@/lib/llm/client` etc. `lib/calc/` must never import `lib/llm/` (invariant enforced by lint in Phase 2; do not violate it from day one).

### Pattern 1: Env-configured model routing (no hardcoded model IDs)

**What:** Model IDs come from env only; config accessors throw naming the missing var; `.env.example` documents recommended current IDs.
**When to use:** Every model call, everywhere.
**Rule for roadmap success criterion 1:** `grep -rn "nvidia/" app/ lib/ scripts/ tests/ instrumentation.ts` must find zero hits. `.env.example` is a dotfile, not source — the grep targets `*.ts *.tsx *.mjs *.mts` only.

```bash
# .env.example (committed — recommended current IDs, verified 2026-09-26)
NEBIUS_API_KEY=your-key-here
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1/
NEBIUS_MODEL_REASONING=nvidia/nemotron-3-super-120b-a12b
NEBIUS_MODEL_EXTRACTION=nvidia/Nemotron-3_5-Lightning
```

```ts
// lib/llm/config.ts
export const NEBIUS_BASE_URL = process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1/";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}. Copy .env.example to .env.local and fill it in.`);
  return v;
}

export function getApiKey() { return requiredEnv("NEBIUS_API_KEY"); }
export function getReasoningModel() { return requiredEnv("NEBIUS_MODEL_REASONING"); }
export function getExtractionModel() { return requiredEnv("NEBIUS_MODEL_EXTRACTION"); }
```

### Pattern 2: Validated-call pattern (json_object → Zod → exactly one bounded retry)

**What:** One function all future LLM calls go through. Injects the OpenAI client (enables offline retry tests). Asks for `json_object`, injects the schema shape into the prompt (schema-in-prompt is required — `json_object` mode has no schema enforcement), Zod-parses, retries exactly once appending the parse error, then throws a clear error.
**When to use:** Every structured extraction/structured-output call in Phases 2–3.

```ts
// lib/llm/complete.ts
import type { OpenAI } from "openai";
import type { ZodType } from "zod";

export interface ValidatedCallOptions<T> {
  client: OpenAI;                      // injected — offline tests pass a fake
  model: string;                       // env-configured ID
  system: string;
  user: string;
  schema: ZodType<T>;                  // used for validation + serialized into the prompt
  schemaHint: string;                  // human-readable JSON shape to include in the prompt
  maxCompletionTokens?: number;        // e.g. 2000 for Super reasoning calls
  reasoningEffort?: "low" | "medium" | "high";  // NOTE: low|medium|high ONLY (verified 2026-09-26)
}

export async function runValidatedCompletion<T>(o: ValidatedCallOptions<T>): Promise<T> {
  const messages = [
    { role: "system" as const, content: `${o.system}\nRespond ONLY with JSON matching this shape:\n${o.schemaHint}` },
    { role: "user" as const, content: o.user },
  ];
  const call = (extra: object) => o.client.chat.completions.create({
    model: o.model,
    messages,
    response_format: { type: "json_object" },
    ...(o.maxCompletionTokens ? { max_completion_tokens: o.maxCompletionTokens } : {}),
    ...(o.reasoningEffort ? { reasoning_effort: o.reasoningEffort } : {}),
    ...extra,
  });

  let lastError: string = "";
  for (let attempt = 0; attempt < 2; attempt++) {          // exactly one bounded retry
    const res = await call(attempt === 1
      ? { messages: [...messages, { role: "user" as const, content: `Your previous reply failed validation: ${lastError}. Reply again with corrected JSON only.` }] }
      : {});
    const raw = res.choices[0]?.message?.content ?? "";
    try {
      return o.schema.parse(JSON.parse(raw));
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`Validated call failed after 1 retry (model=${o.model}): ${lastError}`);
}
```

### Pattern 3: SSE streaming through a route handler (official ReadableStream pattern)

**What:** Route handler calls the SDK with `stream: true`, re-encodes each chunk as SSE `data:` lines, returns `new Response(stream)`. Client consumes with `fetch` + `response.body.getReader()`.
**When to use:** `/api/spike/stream` now; the Phase 3 reasoning pane builds directly on this.

```ts
// app/api/spike/stream/route.ts  (Node runtime is default; do not set edge)
import { getClient } from "@/lib/llm/client";
import { getReasoningModel } from "@/lib/llm/config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const client = getClient();
  const model = getReasoningModel();
  const encoder = new TextEncoder();

  const stream = await client.chat.completions.create({
    model, messages: [{ role: "user", content: prompt }],
    stream: true, max_completion_tokens: 2000, reasoning_effort: "low",
  });

  const sse = new ReadableStream({
    async pull(controller) {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(sse, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}
```

```ts
// app/spike/page.tsx (client consumption — the "end-to-end" half of success criterion 4)
"use client";
async function runSpike(prompt: string) {
  const res = await fetch("/api/spike/stream", { method: "POST", body: JSON.stringify({ prompt }) });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    for (const line of buf.split("\n\n")) {          // SSE events are \n\n-separated
      if (line.startsWith("data: ")) {
        const payload = line.slice(6);
        if (payload === "[DONE]") return;
        appendText(JSON.parse(payload).text);        // render incrementally
      }
    }
    buf = buf.slice(buf.lastIndexOf("\n\n") + 2);
  }
}
```

### Pattern 4: Startup validation (instrumentation.ts + /api/health)

**What:** `instrumentation.ts` `register()` runs **once when a new Next.js server instance initiates, and must complete before the server handles requests** (official contract). It validates env model IDs against live `/v1/models` and caches the result on `globalThis`. `/api/health` reads the cache (or triggers validation) and returns 503 + `degraded: true` + `missing[]` — the red-banner failure mode. On Vercel serverless each cold instance re-runs `register()`; there is no build-time check, so `/api/health` is the always-current entry point (poll from the UI).
**When to use:** Exactly as the roadmap success criterion 2 requires.

```ts
// instrumentation.ts  (repo root — Next.js calls register() in all runtimes; gate node-only code)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateAndCacheModelConfig } = await import("./lib/llm/validate-config");
    await validateAndCacheModelConfig();   // logs explicitly naming any deprecated ID; never crashes startup
  }
}
```

```ts
// app/api/health/route.ts
import { getModelValidation } from "@/lib/llm/validate-config";
export const dynamic = "force-dynamic";       // GET handlers are dynamic by default in 16, but be explicit

export async function GET() {
  const v = await getModelValidation();       // reads globalThis cache; re-validates if stale (>60s) or absent
  const status = v.ok ? 200 : 503;
  return Response.json({
    status: v.ok ? "ok" : "degraded",
    missing: v.missing,                       // e.g. ["nvidia/Nemotron-3_5-Lightning"] — names the dead ID
    checkedAt: v.checkedAt,
  }, { status });
}
```

The red-banner UI is a small client component that polls `/api/health` on mount and, on `status === "degraded"`, renders a fixed red banner: `Model routing invalid — missing: <ids>. Update .env.local / Vercel env vars.` (success criterion 2).

### Pattern 5: Model catalog dump (committed artifact)

**What:** Plain `.mjs` script (no TS runner dependency) using the OpenAI SDK; npm script writes `docs/model-catalog.json`. Node's built-in `--env-file` flag loads `.env.local` (Node ≥20.6; machine is 24.14.1).

```js
// scripts/dump-model-catalog.mjs
import { writeFileSync } from "node:fs";
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1/",
  apiKey: process.env.NEBIUS_API_KEY,
});
const list = await client.models.list();
const models = [...list].sort((a, b) => a.id.localeCompare(b.id));
writeFileSync("docs/model-catalog.json", JSON.stringify({ dumpedAt: new Date().toISOString(), count: models.length, models }, null, 2));
console.log(`Wrote docs/model-catalog.json (${models.length} models)`);
```

```jsonc
// package.json scripts
{ "catalog": "node --env-file=.env.local scripts/dump-model-catalog.mjs",
  "test": "vitest run", "test:watch": "vitest", "typecheck": "tsc --noEmit", "lint": "eslint ." }
```

### Pattern 6: Test setup (vitest 5, CI-safe live tests)

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

```ts
// tests/llm/hello-fixture.test.ts — LIVE tests skip gracefully without a key (CI-safe), run for real locally
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { runValidatedCompletion } from "@/lib/llm/complete";
import { getClient } from "@/lib/llm/client";
import { getExtractionModel, getReasoningModel } from "@/lib/llm/config";

const HAS_KEY = !!process.env.NEBIUS_API_KEY;
const HelloSchema = z.object({ ok: z.literal(true), model_note: z.string() });
const CALL = { system: "You are a test fixture.", user: 'Reply with {"ok": true, "model_note": "hello"}',
               schema: HelloSchema, schemaHint: '{ "ok": true, "model_note": string }',
               maxCompletionTokens: 300, reasoningEffort: "low" as const };

describe.skipIf(!HAS_KEY)("hello fixture against routed models", () => {
  it("Super-120B returns Zod-valid JSON", async () => {
    const out = await runValidatedCompletion({ ...CALL, client: getClient(), model: getReasoningModel() });
    expect(out.ok).toBe(true);
  });
  it("Lightning returns Zod-valid JSON", async () => {
    const out = await runValidatedCompletion({ ...CALL, client: getClient(), model: getExtractionModel() });
    expect(out.ok).toBe(true);
  });
});
```

The retry proof (roadmap success criterion 3) is the OFFLINE test: inject a fake client whose first reply is invalid JSON / schema-violating and second is valid — assert `runValidatedCompletion` made exactly 2 API attempts and returned the parsed value; a second fake that always fails asserts the thrown error names the model and contains the Zod message after exactly 2 attempts.

Also record in `docs/spike-record.md`: (a) a one-off live `json_schema` `response_format` attempt against both models (expected unsupported per the API description — capture the actual error), (b) the `@react-pdf/renderer` 4.9.0 install result + a minimal `renderToBuffer()` smoke test.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OpenAI-compatible HTTP + SSE parsing | Custom fetch/EventSource parsing of Token Factory responses | `openai` SDK (`stream: true` async iterable, typed errors, retries built in) | SDK handles SSE framing, `[DONE]`, error typing; Token Factory is OpenAI-compatible by contract |
| JSON retry-on-invalid loop | Ad-hoc retry sprinkled per call site | `runValidatedCompletion` (Pattern 2) — one implementation | One bounded retry is a contract (PLAT-02); a single tested implementation prevents drift |
| Startup/config checks | Custom "check at import time" side effects | `instrumentation.ts` `register()` (official lifecycle hook) | Runs once per server instance before serving; import-time side effects break under Turbopack/vitest module graphs |
| Env loading in scripts | `dotenv` package or hand-rolled parser | `node --env-file=.env.local` | Built into Node ≥20.6; zero dependencies |
| Test skipping by env | `if (!key) return;` inside test bodies | vitest `it.skipIf(condition)` | Marks tests as skipped in CI output instead of silently passing (vitest-documented API) |
| Lint config | Hand-written ESLint rules from scratch | `eslint-config-next@16.3.6` flat config; Phase 2 forbidden-import via built-in `no-restricted-imports` | Config generated by the scaffold; no custom plugins needed |

**Key insight:** every custom piece in this phase is the *product's* logic (config validation, retry contract, catalog artifact) — the transport, lifecycle hooks, and test mechanics are all provided primitives.

## Common Pitfalls

### Pitfall 1: Sending `reasoning_effort: "none"` (STACK.md's stale range)
**What goes wrong:** 422 — the live enum is `low | medium | high` only.
**Why it happens:** older docs/blog posts show a wider range.
**How to avoid:** type the parameter as the 3-value union in `lib/llm/complete.ts` (Pattern 2 does this).
**Warning signs:** 422 on first Super call.

### Pitfall 2: Running `create-next-app .` in the repo root
**What goes wrong:** refuses — `isFolderEmpty` tolerates only `.git`, `docs`, `LICENSE`, editor dirs, etc.; `.planning/`, `lib/`, `AGENTS.md`, PDFs all conflict.
**How to avoid:** temp-dir scaffold + merge procedure (see Pitfall 3 / Architecture Patterns).
**Warning signs:** "contains files that could conflict" error.

### Pitfall 3: Merge clobbers workspace guardrails or existing gitignore
**What goes wrong:** scaffold's `AGENTS.md` overwrites the NDT guardrails; scaffold `.gitignore` drops `.planning` rules.
**How to avoid:** copy generated `AGENTS.md` to `AGENTS.nextjs.md` for reference instead; append scaffold `.gitignore` entries to the existing file; `next dev` will append its own managed block to the workspace `AGENTS.md` — keep it (it points agents at version-matched Next.js docs) but verify existing content survives.
**Warning signs:** lost `.planning` ignores; `git diff` touching `AGENTS.md` head.

### Pitfall 4: TypeScript 7.0.2 sneaks in
**What goes wrong:** `npm install typescript@latest` pulls the new Go compiler; Next.js 16 officially requires "TypeScript 5.1 minimum" and the ecosystem (eslint-config-next, zod, next typegen) is validated against 5.x.
**How to avoid:** pin `typescript@^5.9.3` explicitly (create-next-app's own injected range is `^5` — keep it).
**Warning signs:** `typescript@7.0.2` in `npm ls typescript`.

### Pitfall 5: `@types/node` left at create-next-app's `^20`
**What goes wrong:** vitest 5's peer range is `^22.0.0 || >=24.0.0` → npm peer warning/mismatch; types don't match Node 24 runtime.
**How to avoid:** override to `@types/node@^24.19.0` in the merged package.json.
**Warning signs:** ERESOLVE warnings during install.

### Pitfall 6: Hardcoded model IDs anywhere in source
**What goes wrong:** roadmap success criterion 1 requires a clean grep; removal waves (June + Aug 2026) will recur.
**How to avoid:** env-only config (Pattern 1); `.env.example` holds recommended IDs; grep gate: `grep -rn "nvidia/" app/ lib/ scripts/ tests/ instrumentation.ts` → zero hits.
**Warning signs:** any `nvidia/…` string in a `.ts/.tsx/.mjs` file.

### Pitfall 7: Assuming `register()` is a build-time check on Vercel
**What goes wrong:** validation never ran at build; a stale ID sails through until a request happens.
**How to avoid:** `/api/health` is the always-current check (runs/refreshes validation); the spike page polls it on mount. `register()` is the per-instance fast-fail, not the only gate.
**Warning signs:** health route returning stale `checkedAt`.

### Pitfall 8: Forgetting the key is absent until the builder provides it
**What goes wrong:** live tests fail confusingly instead of skipping; health route errors are unclear.
**How to avoid:** `.env.local` creation is an explicit early task in the plan (builder supplies `NEBIUS_API_KEY`); all live tests use `it.skipIf(!process.env.NEBIUS_API_KEY)`; config accessor errors name the missing var.
**Warning signs:** `Missing required env var: NEBIUS_API_KEY`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js 15 + Turbopack opt-in | Next 16: **Turbopack default for dev AND build** (`--webpack` opt-out; `--rspack` alternative bundler option) | Next 16 (16.3.6 current) | No `--turbopack` flag needed; don't add custom webpack config (build fails if webpack config present) |
| `middleware.ts` | Deprecated → **`proxy.ts`** (Node runtime only) | Next 16 | Phase 5 rate-limit guard should use `proxy.ts`, not `middleware.ts` |
| Sync `params`/`searchParams` compat | **Fully removed** — async only, `RouteContext<'/path'>` type helper | Next 16 | Route handlers use `await ctx.params` |
| `next lint` | **Removed**; `next build` no longer lints; ESLint flat config default | Next 16 | Lint runs via `eslint .` script only |
| `serverRuntimeConfig`/`publicRuntimeConfig` | **Removed** — env vars + `NEXT_PUBLIC_` prefix | Next 16 | Secrets are plain `process.env` reads in server code |
| `experimental.turbopack` config | Top-level `turbopack` in `next.config.ts` | Next 16 | Not needed for this app |
| `reasoning_effort` wide range (per earlier research) | Enum `low \| medium \| high` | verified 2026-09-26 | Correction C1 |
| TypeScript 5.x latest | TS 7.0.2 (Go compiler) is npm `latest` but Next.js ecosystem standardizes on 5.x | 2026-09 (TS7 release week) | Pin ^5.9.3 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@react-pdf/renderer` 4.9.0 renders correctly at runtime under React 19.3.0 (registry peer range is satisfied, but runtime render is unverified until the Phase 1 smoke test) | Standard Stack | Phase 4 falls back to print-CSS-first (already the plan's safety net); Phase 1 spike record captures the result by design |
| A2 | Vercel Hobby function default region is US — Lightning's eu-north1 hop adds ~80–100 ms to extraction calls (directionally certain; magnitude not measured this session) | STACK.md Corrections C6 | Cosmetic latency; no architectural impact |
| A3 | `next dev` appends its managed agent-docs block to the repo-root `AGENTS.md` without clobbering existing content (behavior verified in the upgrade guide's managed-block description; exact merge behavior on a pre-existing AGENTS.md is inferred from `generate-agent-files.js` description) | Pitfall 3 | Minor: block might need manual merge — cosmetic |
| A4 | Vite 8.3.1 (vitest 5's resolved peer) works for pure Node-env unit tests in this repo | Standard Stack | Swap to `vite@^7` pin if any oddity — trivial, isolated to dev tooling |
| A5 | The `/v1/models` response shape matches `client.models.list()` OpenAI typing (OpenAI-compatible contract; verified for chat completions parameters, the models list endpoint is part of the same compat surface) | Patterns 4–5 | Trivial fix if the dump script needs a shape tweak; script is 15 lines |

## Open Questions

1. **Does `json_schema` response_format actually work on Super-120B/Lightning?**
   - What we know: the spec enum includes it; the parameter description says only `json_object`/`text` are supported.
   - What's unclear: whether the description is stale or authoritative.
   - Recommendation: the Phase 1 spike record (success criterion 5) answers this with one live call per model; plan a 30-minute task.
2. **Which npm registry mirror/resolution the builder's network uses** (India-side npm latency) — non-blocking; `npm view` worked normally during research.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | next (≥20.9), openai (≥22), vitest (^24) | ✓ | 24.14.1 | — |
| npm | install (registry verified reachable) | ✓ | 11.11.0 | — |
| git | scaffold merge, commits | ✓ | 2.53.0.windows.2 | — |
| `NEBIUS_API_KEY` | catalog dump, live fixture tests, health validation, SSE spike | ✗ (no `.env`/`.env.local` exists in repo) | — | Builder must obtain/create `.env.local` early in the phase; all live paths degrade/skip gracefully without it |
| Vercel account | NOT this phase (Phase 5) | n/a | — | — |

**Missing dependencies with no fallback:** none (the key is a builder-supplied prerequisite, not installable software; without it Phase 1's live criteria cannot be demonstrated — plan the key setup as the first execution task).

## Security Domain

> `security_enforcement: true`, ASVS level 1 (config.json). Phase 1 attack surface is small but sets the secret-handling precedent.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No user auth in this app (out of scope by REQUIREMENTS) |
| V3 Session Management | no | No sessions |
| V4 Access Control | partial (V14-adjacent) | No user data yet; `/api/health` and `/api/spike/*` are unauthenticated by design in Phase 1 — abuse guarding is Phase 5 (PLAT-04); do not add ad-hoc auth now |
| V5 Input Validation | yes | Zod at every parse boundary (model output via `runValidatedCompletion`; later all uploads); `request.json()` bodies validated before use |
| V6 Cryptography | no | No crypto operations in this phase |
| V14 Configuration | yes | Secrets server-side only; `.env*` gitignored, `.env.example` committed; never `NEXT_PUBLIC_` prefix on `NEBIUS_API_KEY` |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key leakage to client bundle | Information Disclosure | Key read only inside `lib/llm/*` (server code); no route returns it; health response returns booleans + missing IDs only — never the key or full catalog |
| Secret committed to public repo | Information Disclosure | `.gitignore` covers `.env*` before first install; scan `git diff --staged` before every push (repo becomes public in Phase 5) |
| Health endpoint information leak | Information Disclosure | `/api/health` exposes validation status + configured IDs (public catalog knowledge) but not key, not full model list |
| Unauthenticated SSE endpoint burns credits | DoS | Accepted for Phase 1 local dev; Phase 5 adds proxy.ts rate limit + token caps (PLAT-04). Do not deploy the spike route publicly before Phase 5 guarding |

## Project Constraints (from AGENTS.md)

1. **Standards hierarchy:** API 570 (5th ed.) governs in-service inspection/corrosion/remaining life; API 574 (5th ed., 2024 §10 & Annex D) governs required thickness/Barlow/structural minimums; ASME B31.3-2024 governs design formula and weld NDE acceptance (MT §344.3.2, PT §344.4.2). All formulas/coefficients/acceptance rules load from `lib/criteria/*.json` — LLMs never do arithmetic or invent citations; arithmetic lives in pure TS under `lib/calc/`. Phase 1 must not modify `lib/criteria/`.
2. **PDFs:** never use file-view tools on `.pdf`; use `pypdf` via Python scripts; avoid `pdfplumber` for whole-document scans. (Irrelevant to scaffold work but binding if the phase touches standards PDFs.)
3. **Windows scripting:** no complex multiline inline Python in PowerShell; write scripts to `scratch/`, force UTF-8 (`sys.stdout.reconfigure(encoding='utf-8')`); sanitize Unicode (−, ', °) before console output. Applies to any Phase 1 helper scripts.

## Sources

### Primary (HIGH confidence — official sources fetched 2026-09-26)
- npm registry (`npm view`, registry.npmjs.org): next 16.3.6, react/react-dom 19.3.0, typescript (7.0.2 latest / 5.9.3 latest-5.x), zod 4.6.5, openai 7.23.0, vitest 5.0.2, vite 8.3.1, tailwindcss 4.3.3, @types/node 24.19.0 (24.x line), @types/react(-dom) 19.3.0, @react-pdf/renderer 4.9.0 (peerDeps + deps + no engines), eslint-config-next 16.3.6, postcss 8.5.28
- create-next-app 16.3.6 tarball (downloaded + inspected): generated template versions (`typescript ^5`, `@types/node ^20`, `@types/react ^19`, tailwind `^4` pair, `eslint ^9` + pinned eslint-config-next), CLI flags (`--disable-git`, `--skip-install`, `--eslint`, no `--turbopack` flag, `--rspack`, `--agents-md` default), `isFolderEmpty` allowlist, AGENTS.md generation default
- Nebius Token Factory live OpenAPI spec (`https://docs.tokenfactory.nebius.com/api-reference/inference/create-chat-completion.md`, spec version 20260506-297d05704): `response_format` enum + description, `reasoning_effort` enum, `max_completion_tokens`, `stream_options.include_usage`, `reasoning_content`, SSE `[DONE]`
- Official model catalog (`https://tokenfactory.nebius.com/model-catalog.md` + `api/public/models_info`): both routed model IDs verbatim, prices, context, regions; docs index (`llms.txt`): no deprecation notice newer than August 2026
- Next.js official docs (version 16.3.6 pages): "How to upgrade to version 16" (Turbopack default, proxy rename, async APIs, Node ≥20.9/TS ≥5.1, removals), "Route Handlers" + "route.js" reference (streaming `iteratorToStream`/`ReadableStream`/`TextEncoder` pattern, `runtime='nodejs'`, GET-not-cached default, `RouteContext`), "How to set up instrumentation" (`register()` once-per-instance contract, `NEXT_RUNTIME` gate)

### Secondary (MEDIUM confidence)
- openai-node README (master, fetched 2026-09-26): `stream: true` + `for await` pattern, `baseURL` client option
- vitest.dev API (fetched 2026-09-26): `test.skipIf` / `runIf` / `context.skip` signatures

### Tertiary (LOW confidence — noted for awareness)
- classify-confidence seam output (context7 MEDIUM; webfetch/websearch LOW even with `--verified`): the seam rates by provider class, not source authority; claims above are tagged by the stricter claim-provenance rules (tool-confirmed + authoritative source). Single-source behavioral details carried as MEDIUM (A2, A3, A5).

## Metadata

**Confidence breakdown:**
- Package versions: HIGH — every row verified via `npm view` the same day; scaffold-injected ranges verified from the create-next-app tarball
- API contracts (Token Factory, Next.js patterns): HIGH — live OpenAPI spec + official Next.js 16.3.6 docs fetched today
- Runtime behavior on Vercel (per-instance register, regions/latency): MEDIUM — official docs + inference, not measured
- Pitfalls: HIGH for verified landmines (TS7, create-next-app refusal, reasoning_effort enum); MEDIUM for merge-behavior details

**Research date:** 2026-09-26
**Valid until:** 2026-10-03 (model catalog and npm `latest` move weekly; re-verify model IDs + `reasoning_effort` spec against live sources if planning slips past one week)
