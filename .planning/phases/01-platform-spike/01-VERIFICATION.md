---
phase: 01-platform-spike
verified: 2026-09-27T07:10:51Z
status: passed
score: 15/15 must-haves verified
covered_files: [".env.example", ".gitignore", "UNINSTALL.md", "app/api/health/route.ts", "app/api/spike/stream/route.ts", "app/page.tsx", "app/spike/page.tsx", "docs/model-catalog.json", "docs/spike-record.md", "instrumentation.ts", "lib/llm/client.ts", "lib/llm/complete.ts", "lib/llm/config.ts", "lib/llm/schemas.ts", "lib/llm/validate-config.ts", "package.json", "scripts/dump-model-catalog.mjs", "tests/llm/hello-fixture.test.ts", "tests/llm/validate-config.offline.test.ts", "tests/llm/validated-call.retry.test.ts", "tests/pdf/react-pdf-smoke.test.ts", "vitest.config.ts"]
covered_digest: "v1:sha256:07f9b47b16a7d5df77e10f0d8e535fe9d905f84bec6996d9983c828d72c5c58f"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 1: Platform Spike & App Skeleton — Verification Report

**Phase Goal:** The Nebius Token Factory foundation is proven before any feature work depends on it — live model catalog committed, env-configured routing validated at startup, and the validated-call pattern (json_object → Zod → one bounded retry, SSE streaming) demonstrated against both routed models (Super-120B and Lightning; Ultra-253B/Nano-Omni confirmed removed from serverless).
**Verified:** 2026-09-27T07:10:51Z
**Status:** PASSED
**Re-verification:** No — initial verification
**Method:** Goal-backward. Every gate command was run by the verifier in this session (not trusted from SUMMARY). Live proofs were re-executed by the verifier, including the WR-01 disconnect check the executor had left unverified.

## Goal Achievement

### Roadmap Success Criteria (1-5) — per-criterion evidence

| # | Criterion | Verdict | Evidence (verifier-run, 2026-09-27) |
|---|-----------|---------|-------------------------------------|
| 1 | Committed live `docs/model-catalog.json`; model IDs env-only; no hardcoded model IDs in source | VERIFIED | `docs/model-catalog.json` tracked (git ls-files), header `dumpedAt 2026-09-27T06:23:52Z, count 25`; `node -e` check → `CATALOG-OK` exit 0; `grep -rn "nvidia/" app/ lib/ scripts/ tests/ instrumentation.ts` → SOURCE-CLEAN (zero hits); IDs read only via `lib/llm/config.ts` accessors; `.env.example` is the sole committed file recommending IDs |
| 2 | Startup validates configured IDs against live catalog; red-banner failure names the missing model; stale ID can never silently reach a live call | VERIFIED | Verifier started `next dev` and observed first-hand: `[validate-config] model routing OK (both configured IDs present in live catalog)` logged at boot against the LIVE /v1/models; `curl /api/health` → HTTP:200 `{"status":"ok","missing":[],"checkedAt":"2026-09-27T07:05:57Z"}`; degraded path transition proven offline (`validate-config.offline.test.ts` case 2 asserts `missing` names the absent ID verbatim → ok:false); red banner (`app/spike/page.tsx:86-94`) renders `missing: <ids>` and, after the WR-03 fix, `health.error` when the missing list is empty; health body is a strict 4-field whitelist |
| 3 | Hello-fixture call against BOTH Super-120B and Lightning passes Zod; forced-bad-output test proves one bounded retry with clear error | VERIFIED | `npm test` run by verifier: 11 passed / 0 skipped / 0 failed, including live `reasoning model returns Zod-valid JSON` (1577ms) and `extraction model returns Zod-valid JSON` (1108ms) through `runValidatedCompletion`; forced-retry locked offline (exactly-2-attempts, never-3, rejection names model + Zod issue text) AND proven live on both models via the WR-02 trap fixtures (`calls.length === 2`, verbatim assistant replay asserted) |
| 4 | SSE streamed response consumed end-to-end through a route handler to a client | VERIFIED | Verifier ran live: `curl -N POST /api/spike/stream` → `data: {"text":"\n\nstreaming"}`, `data: {"text":" ok"}`, `data: [DONE]`; empty prompt → 400 (before any paid call); client consumer in `app/spike/page.tsx` inspected: `getReader` + `\n\n` framing + incremental render + `[DONE]` stop; route sets `runtime = "nodejs"` |
| 5 | Spike record states json_schema result on both routed models + react-pdf 4.9.0/React 19.3 install result for Phase 4's evidence-based choice | VERIFIED | `docs/spike-record.md` read in full: dated per-model json_schema results (ACCEPTED live on both env-configured models, exact probe command recorded), react-pdf install result (clean, no ERESOLVE/peer warnings, versions from npm ls), runtime renderToBuffer smoke (passing test in the verifier's `npm test` run), routing corrections C1/C6, and an evidence-only "Phase 4 input" section that makes no Phase 4 decision |

### must_haves disposition (truth-by-truth, all four plans)

| # | Plan | Truth | Verdict | Evidence |
|---|------|-------|---------|----------|
| 1.1 | 01-01 | Working Next.js 16.3.6 + React 19.3.0 workspace at verified pins; zero pre-existing tracked files lost | verified | typecheck (exit 0), lint (exit 0), full test suite (exit 0) in verifier's session; package.json pins match the approved list; `.gitignore` retains its 3 original planning lines at top; AGENTS.md git history shows only the pre-phase commit (untouched during Phase 1); untracked PDFs/.planning intact |
| 1.2 | 01-01 | No package-adding command ran without the explicit approval checkpoint | verified | UNINSTALL.md ledger records the single approved gate + exact commands; package.json dependencies are exactly the approved 14 (next 16.3.6, react 19.3.0, zod 4.6.5, openai 7.23.0, @react-pdf/renderer 4.9.0, ts ^5.9.3, vitest 5.0.2, @types/node ^24.19.0, + scaffold-injected tailwind/eslint); no extra direct deps in package-lock |
| 1.3 | 01-01 | `.env*` gitignored, `.env.example` committable, before any secret existed | verified | `git check-ignore .env.local` → exit 0; `.env.example` tracked; `.gitignore` ordering correct (`.env*` then `!.env.example`); repo-wide grep finds only placeholder key assignments in tracked files |
| 2.1 | 01-02 | Every model ID from env accessors; unset variable throws naming that variable | verified | `lib/llm/config.ts` read: `requiredEnv()` throws `Missing required env var: ${name}`; no model-ID literals in the file; offline test case 3 asserts rejection matches `/NEBIUS_MODEL_REASONING/` |
| 2.2 | 01-02 | Structured hello call via runValidatedCompletion returns Zod-valid JSON from BOTH routed models live | verified | Both live fixture tests passed in the verifier's `npm test` run (see SC3) — real Token Factory calls through config → client → complete → Zod |
| 2.3 | 01-02 | OpenAI client injectable; validated-call loop testable offline with a fake | verified | `ValidatedCallOptions.client: OpenAI` (complete.ts:5); offline retry + validation tests inject fake clients with zero network |
| 2.4 | 01-02 | API key read in exactly one place; never in client code, responses, or logs | verified | `getClient()` (lib/llm/client.ts) is the sole reader of `getApiKey()`; `grep NEXT_PUBLIC` → no hits; health body whitelist (status/missing/checkedAt/error only); SSE route emits delta text only; no key-like literals in tracked files |
| 3.1 | 01-03 | App startup validates both env IDs against live catalog and never crashes on validation problems | verified | Verifier observed the live startup log (model routing OK against live catalog); `register()` gated on `NEXT_RUNTIME === "nodejs"`; `validateAndCacheModelConfig()` swallows + logs inside try/catch |
| 3.2 | 01-03 | GET /api/health returns 200 ok or 503 degraded; degraded NAMES the missing configured model ID | verified | Live 200 ok observed by verifier; 503 branch + body shape code-inspected (route.ts:9-18); the missing-ID transition is proven offline (case 2: `missing` equals `[EXTRACTION_ID]` verbatim, ok:false); WR-03 fix renders `error` when missing list empty |
| 3.3 | 01-03 | SSE flows Token Factory → route handler → browser page, rendered incrementally until [DONE] | verified | Verifier's live curl: data frames + `[DONE]` sentinel (see SC4); consumer code inspected (getReader/`\n\n`/incremental setState/[DONE]); route/runtime/parse-boundary all present |
| 3.4 | 01-03 | No API response ever contains the API key or the full model list | verified | Health body builder includes only the 4 whitelisted fields; stream route forwards only `{text}` delta frames; both code-inspected; no key material anywhere in tracked files |
| 4.1 | 01-04 | Forced-bad-output test proves exactly one bounded retry and a clear error naming the model with the Zod message after exactly 2 attempts | verified | 3 offline tests pass: bad→good resolves with exactly 2 create() calls + correction message; always-bad rejects with `Validated call failed after 1 retry (model=test-model)` + independently-computed Zod issue text + exactly 2 calls (never 3); first-try-valid → exactly 1 call |
| 4.2 | 01-04 | Committed docs/model-catalog.json holds the live dump, regenerated via `npm run catalog` | verified | Verifier ran `npm run catalog` → `Wrote docs/model-catalog.json (25 models)`, exit 0 (win32 libuv fix confirmed working), then restored the committed artifact; artifact tracked, header sorted, `CATALOG-OK` check exit 0 |
| 4.3 | 01-04 | Repo grep of source directories finds zero vendor-prefixed model-ID literals | verified | `grep -rn "nvidia/" app/ lib/ scripts/ tests/ instrumentation.ts` → SOURCE-CLEAN in verifier's session |
| 4.4 | 01-04 | Spike record states actual json_schema result on both routed models + react-pdf runtime result | verified | Record read in full (see SC5); react-pdf smoke test passed in the verifier's `npm test` run |

**Score: 15/15 must-haves verified** (0 present-behavior-unverified, 0 abstained, 0 failed)

### Flagged Assumptions FA-01..FA-06 — confirmed recorded, not silently resolved

All six spec-less probe edges are recorded as `flagged_assumptions` with `status: unverified` in the plan frontmatter exactly as planned (FA-01, FA-02, FA-04, FA-06 in 01-02-PLAN.md and 01-03-PLAN.md; FA-03, FA-05 in 01-02-PLAN.md and 01-04-PLAN.md). They are assumptions, not failures. The conservative behaviors they describe are implemented in code (exact string match, throw-naming-variable, localeCompare sort, cache-on-write no mutex, 2-attempt max, no stream resume), and two of them acquired incidental test evidence during the phase: FA-02 is directly exercised by the offline env-unset test, FA-05's never-exceed-2 contract by the offline + live retry tests. None were flipped to "verified" in plan frontmatter — correctly left flagged.

### Prohibitions — still flagged-unverified (NOT silently passed)

Per protocol, the 8 `status: flagged-unverified` prohibitions across the four plans remain formally flagged-unverified in plan frontmatter. This verification did NOT convert them to verified. The verifier's independent negative checks support them but are grep/judgment evidence, not wired enforcement:

- No vendor-prefixed model-ID literals in source — supporting check: SOURCE-CLEAN grep clean (verifier-run).
- API key never in bundles/responses/logs/git — supporting checks: no NEXT_PUBLIC hits, health body whitelist, placeholder-only key grep, .env.local ignored.
- No verbatim ASME/API standards text enters the repo — supporting check: Phase 1 created no standards-quotes files; lib/criteria/ (pre-existing, pre-phase commit) untouched; the standards PDFs in the working tree are untracked builder references, never committed.

**Unverified-prohibition — human review recommended:** these judgment-tier items have no wired test enforcement; they are guarded by repeatable greps documented in the plans and re-run clean by this verification.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PLAT-01 | 01-01..01-04 | All model calls via Token Factory OpenAI-compatible API; env-configured IDs validated against live /v1/models at startup | SATISFIED | getClient() with Token Factory baseURL; env-only accessors; startup validation observed live by verifier (boot log + health 200) |
| PLAT-02 | 01-01..01-04 | LLM responses stream (SSE); structured output enforced (json_object + Zod + one bounded retry) | SATISFIED | complete.ts contract locked offline + live; SSE route → client proven live by verifier (frames + [DONE]) |

No orphaned requirements: REQUIREMENTS.md maps exactly PLAT-01 + PLAT-02 to Phase 1; both are claimed by all four plans and both are implemented. (REQUIREMENTS.md already marks them Complete — consistent with this evidence.)

### Behavioral Spot-Checks (verifier-run, live)

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Typecheck | `npm run typecheck` | exit 0 (next typegen + tsc --noEmit clean) | PASS |
| Lint | `npm run lint` | exit 0 | PASS |
| Full test suite | `npm test` | 11 passed / 0 skipped / 0 failed, incl. 4 live (2 hello fixtures + 2 forced-retry, both models) | PASS |
| Catalog artifact | `node -e` require + shape check | CATALOG-OK, exit 0 | PASS |
| Catalog regeneration | `npm run catalog` (then restored) | `Wrote docs/model-catalog.json (25 models)`, exit 0 | PASS |
| .env.local ignored | `git check-ignore .env.local` | exit 0; `.env.example` NOT ignored (exit 1) | PASS |
| Source-clean | `grep -rn "nvidia/" app/ lib/ scripts/ tests/ instrumentation.ts` | zero hits (SOURCE-CLEAN) | PASS |
| Startup validation | `npm run dev` (verifier-started) | `model routing OK (both configured IDs present in live catalog)` at boot | PASS |
| Health endpoint | `curl /api/health` | HTTP:200 `{"status":"ok","missing":[],"checkedAt":"2026-09-27T07:05:57Z"}` | PASS |
| SSE stream | `curl -N -X POST .../api/spike/stream` | `data: {"text":"\n\nstreaming"}`, `data: {"text":" ok"}`, `data: [DONE]` | PASS |
| Parse boundary | empty-prompt POST | 400 | PASS |
| **WR-01 client disconnect → upstream abort** | `curl --max-time 1` mid-stream kill | Request ended at 1002ms (disconnect time — a full 2000-token generation would run far longer, so the upstream stream terminated with the client); server log shows NO TypeError/unhandled rejection (the pre-fix double-throw is gone); subsequent health request 200 | PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| scripts/*/tests/probe-*.sh | — | none declared and none conventional in this repo | N/A (none exist) |
| scratch/json-schema-probe.mjs | documented in spike-record.md | one-off probe, deliberately gitignored (verified: check-ignore exit 0); its live result is recorded with exact commands in docs/spike-record.md and its claims are consistent with the verifier's own live results | N/A (by-design one-off) |

The phase's runnable-check obligations were carried by the vitest suites and npm scripts, all re-run by the verifier above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| app/spike/page.tsx | 105 | `placeholder="Prompt"` (HTML input attribute) | Info | Not a stub — standard input UX attribute |
| scripts/dump-model-catalog.mjs | 21 | console.log | Info | Plan-mandated confirmation line ("output lacks the confirmation line" is a fails_when) |
| lib/llm/validate-config.ts | 52 | console.log | Info | Plan-mandated explicit startup log (Pattern 4) |
| app/layout.tsx | 15-18 | Scaffold metadata "Create Next App" | Info | Known review finding IN-06, dispositioned accepted-for-now; Phase 5 owns branding restyle |

No TBD/FIXME/XXX/HACK markers, no empty implementations, no hardcoded-empty props, no console.log-only handlers in any phase file. Tracked tree clean apart from a pre-existing `.planning/HANDOFF.json` deletion that predates this verification.

### Anti-Slop Verdict

This is a **real foundation, not demo-ware**. Each load-bearing claim survives code-level inspection plus live re-execution: the validated-call seam (`runValidatedCompletion`) enforces json_object → Zod parse → exactly one bounded retry with the model's own bad reply replayed (WR-02), locked by offline contract tests AND forced live on both routed models through a recorder-wrapped real client; the health gate validates against the live catalog at startup (observed in the verifier's own server boot) and re-validates on staleness; the SSE contract emits real `data:` frames ending in `[DONE]` from the real provider; the catalog is a faithful, regenerable live dump (25 models). The only placeholder-shaped artifact (`lib/calc/README.md`) is a deliberate Phase 2 reservation marker carrying the never-import-llm invariant — plan-specified, not an unfinished component.

### Deferred Items (informational — recorded review dispositions, not gaps)

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | IN-01 upstream error text passthrough on unauthenticated routes | Phase 5 | 01-REVIEW.md disposition: "generic-message + server-side detail logging lands with Phase 5 error-handling hardening" |
| 2 | IN-02 SSE prompt length uncapped before paid call | Phase 5 | 01-REVIEW.md disposition: "Phase 5 owns request guarding, which subsumes the one-line cap" |
| 3 | IN-03 register() dynamic import outside try | Phase 5 | 01-REVIEW.md disposition: "module-load failure handling is owned by Phase 5 hardening" |
| 4 | IN-06 scaffold metadata in root layout (observed still present) | Phase 5 | 01-REVIEW.md disposition: "branding/copy is owned by the Phase 5 restyle" |

### Human Verification Required

None. The single candidate item — the WR-01 live-disconnect check (close browser tab mid-stream → upstream abort) — was verified by the verifier directly: a `curl --max-time 1` mid-stream disconnect ended the server-side request at the disconnect moment (1002ms, log-confirmed), produced no enqueue-after-cancel TypeError in the server log, and left the server healthy. The `req.signal` propagation and `cancel()`/`safeEnqueue` guards behave as designed.

### Gaps Summary

None. All 5 roadmap success criteria and all 15 plan must-have truths are verified with first-hand evidence; all 11 tests pass (4 live); typecheck, lint, source-clean, gitignore, and catalog gates all pass in the verifier's own session; PLAT-01 and PLAT-02 are satisfied. The flagged assumptions remain correctly flagged as assumptions, and the prohibitions remain correctly flagged-unverified with supporting grep evidence. Phase goal achieved — the platform spike is proven, and Phases 2-5 can depend on it.

---

_Verified: 2026-09-27T07:10:51Z_
_Verifier: Claude (gsd-verifier)_
