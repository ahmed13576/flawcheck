---
phase: 01-platform-spike
verified: 2026-10-10T07:13:23Z
status: passed
score: 15/15 must-haves verified
covered_files: [".env.example", ".gitignore", ".planning/phases/01-platform-spike/01-01-PLAN.md", ".planning/phases/01-platform-spike/01-01-SUMMARY.md", ".planning/phases/01-platform-spike/01-02-PLAN.md", ".planning/phases/01-platform-spike/01-02-SUMMARY.md", ".planning/phases/01-platform-spike/01-03-PLAN.md", ".planning/phases/01-platform-spike/01-03-SUMMARY.md", ".planning/phases/01-platform-spike/01-04-PLAN.md", ".planning/phases/01-platform-spike/01-04-SUMMARY.md", ".planning/phases/01-platform-spike/01-SUMMARY.md", "UNINSTALL.md", "app/api/health/route.ts", "app/api/spike/stream/route.ts", "app/page.tsx", "app/spike/page.tsx", "docs/model-catalog.json", "docs/spike-record.md", "instrumentation.ts", "lib/llm/client.ts", "lib/llm/complete.ts", "lib/llm/config.ts", "lib/llm/schemas.ts", "lib/llm/validate-config.ts", "package.json", "scripts/dump-model-catalog.mjs", "tests/llm/hello-fixture.test.ts", "tests/llm/validate-config.offline.test.ts", "tests/llm/validated-call.retry.test.ts", "tests/pdf/react-pdf-smoke.test.ts", "vitest.config.ts"]
covered_digest: "v3:sha256:2f8c97a95ddc0b547af0d04cd48916f1f163db1c223389cf4cb2196929d7545e"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 15/15
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 1: Platform Spike & App Skeleton — Verification Report (REGENERATED)

**Phase Goal:** The Nebius Token Factory foundation is proven before any feature work depends on it — live model catalog committed, env-configured routing validated at startup, and the validated-call pattern (json_object → Zod → one bounded retry, SSE streaming) demonstrated against both routed models (Super-120B and Lightning; Ultra-253B/Nano-Omni confirmed removed from serverless).
**Verified:** 2026-10-10T07:13:23Z
**Status:** PASSED
**Re-verification:** Yes — regeneration after legitimate post-milestone edits to covered files (stale covered-input fingerprint refresh). All must-haves re-verified against the CURRENT codebase; live evidence re-executed in this session.

## Drift Disposition (why this regeneration ran)

| Covered file | Drift since 2026-09-27 verification | Commit | Must-have impact |
|---|---|---|---|
| `.env.example` | Gained `FLAWCHECK_DISABLE_LLM` (kill-switch, empty placeholder) + `TAVILY_API_KEY` (optional, empty placeholder) entries; NEBIUS_* contract unchanged | `37b23d9` final-review fix (DEMO-02 env docs, PLAT-03 Tavily) | NONE — still placeholder-only values, no secrets; still the sole committed file recommending model IDs |
| `.gitignore` | Gained Copyrighted-standards PDF untracking entries + `flowstep-gui/` + `graphify-out/` | final review (PDF untracking) | NONE — original 3 planning lines retained at top; `.env*` → `!.env.example` ordering intact |
| `tests/llm/hello-fixture.test.ts` | Live tests moved behind explicit `FLAWCHECK_LIVE_LLM` opt-in gate (hermetic default suite) | `3cecf45` fix(02-review): WR-08 | NONE — tests re-run LIVE with the gate in this session: 4/4 passed against both routed models |
| `package.json` | Gained 5 Flowstep design packages (clsx, lucide-react, tailwind-merge, tw-animate-css, class-variance-authority) | `ae27a0f` chore(03-00) — approved Phase 3 checkpoint install | NONE on the phase-1 process truth — every install went through its own approved checkpoint, appended to UNINSTALL.md per ledger design |
| `UNINSTALL.md` | Phase 3 section appended (ledger's append-per-phase design) | with `ae27a0f` | NONE — Phase 1 section unchanged, single-approved-gate record intact |
| `docs/model-catalog.json` | No content change (header/dump verbatim: 2026-09-27T06:23:52.967Z, count 25) | — | NONE |

## Goal Achievement

### Roadmap Success Criteria (1-5) — re-verified 2026-10-10

| # | Criterion | Verdict | Evidence (verifier-run, this session) |
|---|-----------|---------|-------------------------------------|
| 1 | Committed live `docs/model-catalog.json`; model IDs env-only; no hardcoded model IDs in source | VERIFIED | `.env.example` + `docs/model-catalog.json` both tracked (`git ls-files` exit 0); `node -e` shape check → `CATALOG-OK` (topKeys dumpedAt/count, 25 models); `grep -rn "nvidia/" app/ lib/ scripts/ tests/ instrumentation.ts` → SOURCE-CLEAN (zero hits); IDs read only via `lib/llm/config.ts` accessors |
| 2 | Startup validates configured IDs against live catalog; red-banner failure names the missing model; stale ID can never silently reach a live call | VERIFIED | `lib/llm/validate-config.ts` + `instrumentation.ts` unchanged in substance (nodejs-gated register, try/catch-swallowed validation); offline test case 2 still passes (degraded `missing` names the absent ID verbatim, ok:false) — run in this session's suite; live boot validation was observed first-hand in the original session and the code path is unchanged; red banner in `app/spike/page.tsx` renders `missing: <ids>` + `health.error` when empty |
| 3 | Hello-fixture call against BOTH Super-120B and Lightning passes Zod; forced-bad-output test proves one bounded retry with clear error | VERIFIED | Verifier ran `FLAWCHECK_LIVE_LLM=1 npx vitest run tests/llm/hello-fixture.test.ts` LIVE: 4/4 passed — reasoning model Zod-valid JSON (1597ms), extraction model Zod-valid JSON (1106ms), forced retry on BOTH models with assistant's own bad reply replayed (1557ms / 3192ms); offline contract tests also green in the full run |
| 4 | SSE streamed response consumed end-to-end through a route handler to a client | VERIFIED | `app/api/spike/stream/route.ts` (92 lines) code-inspected: `runtime = "nodejs"`, `req.signal` propagation, `data:` frame framing + `[DONE]` sentinel, empty-prompt 400 before any paid call; client consumer in `app/spike/page.tsx` (getReader, `\n\n` framing, incremental render) intact; live curl proof re-executed in original session, route unchanged since |
| 5 | Spike record states json_schema result on both routed models + react-pdf 4.9.0/React 19.3 install result for Phase 4's evidence-based choice | VERIFIED | `docs/spike-record.md` re-read (65 lines): per-model json_schema results, react-pdf install result, routing corrections, evidence-only "Phase 4 input" section all intact; react-pdf smoke test green in this session's full run |

### must_haves disposition (truth-by-truth, all four plans) — re-verified 2026-10-10

| # | Plan | Truth | Verdict | Evidence |
|---|------|-------|---------|----------|
| 1.1 | 01-01 | Working Next.js 16.3.6 + React 19.3.0 workspace at verified pins; zero pre-existing tracked files lost | verified | typecheck exit 0, lint exit 0 (0 errors), full test suite exit 0 in this session; pins unchanged in package.json; `.gitignore` retains its 3 original planning lines at top (lines 1-3); untracked PDFs/.planning intact |
| 1.2 | 01-01 | No package-adding command ran without the explicit approval checkpoint | verified | UNINSTALL.md Phase 1 section unchanged (single approved gate + exact commands); the only post-phase dep growth is the Phase 3 Flowstep install (`ae27a0f`) — its own approved checkpoint, appended to the ledger exactly per design |
| 1.3 | 01-01 | `.env*` gitignored, `.env.example` committable, before any secret existed | verified | `git check-ignore .env.local` exit 0; `git check-ignore .env.example` exit 1 (not ignored); `.gitignore` ordering `.env*` → `!.env.example` intact (lines 38-39); `.env.example` still placeholder-only (incl. new empty FLAWCHECK_DISABLE_LLM / TAVILY_API_KEY entries — no secrets) |
| 2.1 | 01-02 | Every model ID from env accessors; unset variable throws naming that variable | verified | `lib/llm/config.ts` (25 lines): `requiredEnv()` throws `Missing required env var: ${name}`; no model-ID literals; offline test case 3 (rejection matches `/NEBIUS_MODEL_REASONING/`) green in this session |
| 2.2 | 01-02 | Structured hello call via runValidatedCompletion returns Zod-valid JSON from BOTH routed models live | verified | LIVE in this session: `FLAWCHECK_LIVE_LLM=1` fixture run — both models return Zod-valid JSON through config → client → complete → Zod (see SC3) |
| 2.3 | 01-02 | OpenAI client injectable; validated-call loop testable offline with a fake | verified | `ValidatedCallOptions.client: OpenAI` unchanged; offline retry + validation tests green in this session's full run |
| 2.4 | 01-02 | API key read in exactly one place; never in client code, responses, or logs | verified | `getClient()` (lib/llm/client.ts) is the sole reader of `getApiKey()` in the phase-1 surface; grep `NEXT_PUBLIC` → zero hits; health body whitelist unchanged; SSE route forwards delta text only; no key-like literals in tracked files |
| 3.1 | 01-03 | App startup validates both env IDs against live catalog and never crashes on validation problems | verified | `instrumentation.ts` (11 lines) + `validateAndCacheModelConfig()` try/catch-swallow unchanged; nodejs-gated `register()`; live boot observation in original session; unchanged code path |
| 3.2 | 01-03 | GET /api/health returns 200 ok or 503 degraded; degraded NAMES the missing configured model ID | verified | `app/api/health/route.ts` (19 lines) code-inspected: 503 branch + body shape unchanged; missing-ID transition proven offline (validate-config.offline.test.ts case 2, green this session); WR-03 `error`-when-empty render intact in app/spike/page.tsx |
| 3.3 | 01-03 | SSE flows Token Factory → route handler → browser page, rendered incrementally until [DONE] | verified | Route + consumer code-inspected unchanged; live curl frames + `[DONE]` proven in original verifier session against the same code |
| 3.4 | 01-03 | No API response ever contains the API key or the full model list | verified | Health body builder: 4 whitelisted fields only; stream route forwards `{text}` frames only; no key material in tracked files (checked this session) |
| 4.1 | 01-04 | Forced-bad-output test proves exactly one bounded retry and a clear error naming the model with the Zod message after exactly 2 attempts | verified | `tests/llm/validated-call.retry.test.ts` (4 tests) green in this session's full run; ALSO re-proven LIVE on both routed models in this session (retry payload carries the assistant's own bad reply, both models) |
| 4.2 | 01-04 | Committed docs/model-catalog.json holds the live dump, regenerated via `npm run catalog` | verified | Artifact unchanged (dumpedAt 2026-09-27T06:23:52.967Z, count 25); CATALOG-OK shape check exit 0 this session; `npm run catalog` regeneration proven in original session and script unchanged |
| 4.3 | 01-04 | Repo grep of source directories finds zero vendor-prefixed model-ID literals | verified | `grep -rn "nvidia/" app/ lib/ scripts/ tests/ instrumentation.ts` → SOURCE-CLEAN, zero hits, this session |
| 4.4 | 01-04 | Spike record states actual json_schema result on both routed models + react-pdf runtime result | verified | `docs/spike-record.md` re-read in full (65 lines) — all sections intact; react-pdf smoke test green this session |

**Score: 15/15 must-haves verified** (0 present-behavior-unverified, 0 abstained, 0 failed)

### Flagged Assumptions FA-01..FA-06 — remain recorded, not silently resolved

All six spec-less probe edges remain `flagged_assumptions` with `status: unverified` in the plan frontmatter exactly as verified originally (FA-01, FA-02, FA-04, FA-06 in 01-02-PLAN.md and 01-03-PLAN.md; FA-03, FA-05 in 01-02-PLAN.md and 01-04-PLAN.md). The conservative behaviors they describe remain implemented in the unchanged phase-1 code. None were flipped to verified in plan frontmatter.

### Prohibitions — still flagged-unverified (NOT silently passed)

The 8 `status: flagged-unverified` prohibitions across the four plans remain formally flagged-unverified. This session's independent negative checks again support them:

- No vendor-prefixed model-ID literals in source — SOURCE-CLEAN grep re-run clean (this session).
- API key never in bundles/responses/logs/git — no NEXT_PUBLIC hits, health body whitelist, placeholder-only grep on the UPDATED `.env.example` (new Tavily entry is empty — no secret), `.env.local` ignored (exit 0).
- No verbatim ASME/API standards text enters the repo — the standards PDFs remain untracked (`git ls-files | grep .pdf` → no hits, this session); the new `.gitignore` entries strengthen this by explicitly excluding them.

**Unverified-prohibition — human review recommended:** these judgment-tier items have no wired test enforcement; they are guarded by repeatable greps documented in the plans and re-run clean by this verification.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PLAT-01 | 01-01..01-04 | All model calls via Token Factory OpenAI-compatible API; env-configured IDs validated against live /v1/models at startup | SATISFIED | getClient() with Token Factory baseURL (unchanged); env-only accessors; startup validation code path unchanged + live boot observed in original session; live fixture calls against both routed models succeeded THIS session |
| PLAT-02 | 01-01..01-04 | LLM responses stream (SSE); structured output enforced (json_object + Zod + one bounded retry) | SATISFIED | complete.ts contract locked offline + re-proven LIVE this session on both models (forced retry, bad-reply replay); SSE route → client unchanged with live proof in original session |

No orphaned requirements: REQUIREMENTS.md maps exactly PLAT-01 + PLAT-02 to Phase 1; both are claimed by all four plans and both are implemented.

### Behavioral Spot-Checks (verifier-run, this session unless noted)

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Typecheck | `npm run typecheck` | exit 0 (next typegen + tsc --noEmit clean) | PASS |
| Lint | `npm run lint` | exit 0 (0 errors, 14 warnings — all in post-phase files) | PASS |
| Full test suite (default, hermetic) | `npm test` | 513 passed / 5 skipped / 0 failed across 51 files — includes all phase-1 offline contracts + react-pdf smoke | PASS |
| Live fixture + forced retry, both routed models | `FLAWCHECK_LIVE_LLM=1 npx vitest run tests/llm/hello-fixture.test.ts` | 4/4 passed: Zod-valid JSON on Super-120B (1597ms) + Lightning (1106ms); forced retry with assistant's own bad reply on both (1557ms / 3192ms) | PASS |
| Catalog artifact | `node -e` require + shape check | CATALOG-OK (dumpedAt 2026-09-27T06:23:52.967Z, count 25), exit 0 | PASS |
| .env.local ignored | `git check-ignore .env.local` | exit 0; `.env.example` NOT ignored (exit 1) | PASS |
| Standards PDFs untracked | `git ls-files \| grep -i .pdf` | no output (exit 1 — zero tracked PDFs) | PASS |
| Source-clean | `grep -rn "nvidia/" app/ lib/ scripts/ tests/ instrumentation.ts` | zero hits (SOURCE-CLEAN) | PASS |
| Startup validation + health + SSE + WR-01 disconnect | `npm run dev` + curl | Verified live and first-hand in the original 2026-09-27 session; covered code paths unchanged since (`instrumentation.ts`, health route, stream route byte-identical in substance) | PASS (carried live evidence) |
| Catalog regeneration | `npm run catalog` (then restored) | `Wrote docs/model-catalog.json (25 models)`, exit 0 — original session; script unchanged | PASS (carried live evidence) |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| scripts/*/tests/probe-*.sh | — | none declared and none conventional in this repo (re-checked this session) | N/A (none exist) |
| scratch/json-schema-probe.mjs | documented in spike-record.md | by-design one-off, gitignored; live result recorded with exact commands in docs/spike-record.md and consistent with this session's live results | N/A (by-design one-off) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| app/spike/page.tsx | 105 | `placeholder="Prompt"` (HTML input attribute) | Info | Not a stub — standard input UX attribute |
| scripts/dump-model-catalog.mjs | 21 | console.log | Info | Plan-mandated confirmation line |
| lib/llm/validate-config.ts | 52 | console.log | Info | Plan-mandated explicit startup log (Pattern 4) |
| app/layout.tsx | 15-18 | Scaffold metadata "Create Next App" | Info | Known review finding IN-06, dispositioned accepted-for-now; Phase 5 owns branding restyle (may or may not still be present — post-phase files) |

No TBD/FIXME/XXX/HACK markers, no empty implementations, no hardcoded-empty props, no console.log-only handlers in any phase-1 covered file (re-scanned this session).

### Human Verification Required

None. The WR-01 live-disconnect check was verified first-hand in the original session against unchanged code.

### Gaps Summary

None. All 5 roadmap success criteria and all 15 plan must-have truths re-verified against the CURRENT codebase; live evidence re-executed this session (4/4 live fixture + forced-retry tests against both routed models); 513/513 hermetic tests, typecheck, lint, source-clean, gitignore, and catalog gates all pass in this session. The five covered-file drifts are all legitimate post-milestone changes (final-review env docs, PDF untracking, hermetic live-test gate, Phase 3 approved design-package install with its own UNINSTALL.md entry) and none disturbs any must-have. PLAT-01 and PLAT-02 remain satisfied. Phase goal achieved — the platform spike is proven, and Phases 2-6 can depend on it.

---

_Verified: 2026-10-10T07:13:23Z_
_Verifier: Claude (gsd-verifier) — regeneration run_
