# FlawCheck — Agent Handoff (v2, 2026-09-28)

> **Purpose**: complete continuity brief for any agent resuming FlawCheck. This supersedes the phase-1-era `handoff.md` (kept for the standards hierarchy it encodes) and `.planning/.continue-here.md` (pre-phase-1).
> **Read after this**: `AGENTS.md` (guardrails) → `.planning/STATE.md` (exact position) → latest `*-SUMMARY.md` files in the active phase dir.

---

## 1. Project & Deadline

- **FlawCheck — NDT Inspection Copilot**: raw UT thickness CSVs + PT/MT notes → deterministic code-compliance evaluation (pure TS) → Nemotron-narrated, clause-cited reports. Hackathon: **Nebius x NVIDIA Global AI Hackathon, deadline 30 Oct 2026 10:30pm GMT+5:30**. Track: Best Apps & Agents. Deliverables: hosted demo, ≤3-min video, public OSS repo.
- **Builder**: Mohammed Ahmed — mechanical engineer, NDT Level 2 (UT/PT/MT), ASME-literate; transitioning into AI/DS. Not a professional coder — ALL production code is agent-generated.
- **Hard rules**: runs on Nebius Token Factory; ≥1 NVIDIA open model; MIT license in repo; judges punish proof-of-concept demos and AI-wrapper slop.

## 2. Current State (exactly where we are)

| Phase | Status |
|---|---|
| 1 Platform Spike | ✅ COMPLETE, merged to master (verified 15/15 + browser walkthrough) |
| 2 Ingestion + Calc Engine | ✅ COMPLETE, merged to master (280 hermetic tests; deep review fixed 2C+8W; verified 50/50 + browser walkthrough) |
| **3 Reasoning + Citations + Flowstep GUI** | 🔶 **IN PROGRESS on `build/phase-3`** — 03-00 ✅ (Flowstep tokens+primitives+Screens 1-2), 03-00b ✅ (Screen 3 restyle + locked /report preview + FS-01..12), 03-01 ✅ (tokenizer+fallback+schemas+narrative route+pane wiring), 03-02 ✅ (extraction route, enabled stream path, 4 lints, usage capture, live A11 proof), 03-03 Task 1 ✅ (narrative store, 8/8 tests). **REMAINING: 03-03 Task 2 (rewire results table onto store), 03-04 (provider/status bar/PT-MT panes integration), 03-05 (wrap: invariants, coverage sweep, summary)** |
| 4 Report Rendering | ⬜ (Flowstep Screen 4 exists as locked preview; Phase 4 unlocks generation) |
| 5 Demo/Deploy/Submission | ⬜ |

Branch discipline: `master` = verified milestones only. Per-phase `build/phase-N` branches; review fixes on `fix/phase-N-review`; merge to master ONLY after verification passes. **Check `git branch --show-current` before EVERY commit** — an external force switched branches mid-run once (reflog forensics recovered it).

## 3. Immutable Architectural Invariants (violating any = broken product)

1. **TypeScript computes every number; the LLM only extracts/structures/narrates** — `lib/calc/` never imports `lib/llm/` (eslint no-restricted-imports + boundary test). lib/calc + lib/criteria are byte-frozen per phase (`phase-start-ref.txt` gate).
2. **Criteria sovereignty**: all formulas/limits/citations load from `lib/criteria/*.json` (ut-criteria incl. governing `t_required = max(t_pressure, t_structural)`, boundary_convention, negative_cr_policy; ptmt-criteria; citations.json = 15-entry edition-pinned allowlist). LLMs never invent clause numbers.
3. **Citation renderer enforcement**: narrative emits `[[cite:<id>]]`; renderer resolves ONLY against citations.json; unknown ID → zero glyphs + amber audit stamp. Cite-don't-quote (17 U.S.C. §102(b)) — never verbatim standard text.
4. **Fail-loud tiering**: config throws / LLM calls retry-then-throw / SSE routes emit typed error frames + [DONE]. `evaluate()` throws typed errors on non-finite input (never silent NaN).
5. **Verdict order** (ut-criteria implementation_note): `if (t_actual < t_required) reject; else if (t_actual < t_required + gauge_uncertainty) re_check; else accept`. RL ≤ 0 with valid CR → `{ intervalYears: 0, state: "immediate-inspection" }` — never a negative interval.
6. **Model routing** (env-only, validated at startup vs live /v1/models): `nvidia/nemotron-3-super-120b-a12b` (narrative, reasoning_effort "low", 1200 tokens) + `nvidia/Nemotron-3_5-Lightning` (extraction, 3000 tokens). Ultra-253B/Nano-Omni were REMOVED from Token Factory 2026-08-31. **Never hardcode `nvidia/` IDs in source/tests** (grep gate scans app/ lib/ scripts/ tests/).
7. **Secrets**: NEBIUS_API_KEY only in .env.local (gitignored), read only in lib/llm/config.ts. Health endpoint response whitelisted.

## 4. Critical Learnings & Caveats (discovered by failure — do not relearn)

### Provider/runtime instability (the dominant operational risk)
- **Subagent spawns fail frequently** on this account/provider: captcha timeouts (×4), "stream recovery max retries", "model concurrency limit exceeded". **Mitigation that works**: continuation-executor pattern — each attempt banks committed work; resume prompts state exact committed state + uncommitted files. Executor role separation is preserved; after 3+ consecutive provider deaths, the orchestrator may execute a plan INLINE (done for 03-02) — plan files on disk are the recovery source.
- **Commit after every task; never leave work uncommitted across a spawn boundary.** Git checkpoints are the crash recovery.
- `git branch --show-current` before every commit (external branch switch happened once mid-run).

### Model behavior (live-verified 2026-09-27/28)
- **Lightning wraps JSON in prose** despite `response_format: json_object` → `parseJsonLoose` in lib/llm/complete.ts extracts balanced `{…}` blocks, tried LAST-first (CoT replies end with the answer).
- **Lightning's visible chain-of-thought counts inside max_completion_tokens** — 800 truncated mid-thought; extraction now 3000. Super-120B narrative fits in 1200 (verified live: 550 completion tokens).
- **Nondeterministic derivation slips**: live narrative once stated "6.45 mm" (= 6.35+0.1, derived arithmetic) → numeric lint rejected → deterministic fallback. Correct behavior; occasional rejections are expected and safe.
- `reasoning_effort` enum is `low|medium|high` ONLY (wider values 422).
- **"ASME B31.3" contains digits 31.3 and 3** — the numeric-consistency lint strips code designators before digit scanning, or every narrative fails.
- Live costs: extraction ~$0.0002/eval; narrative ~$0.0009/pane; worst judge session (1 extraction + 50 panes) ≈ $0.044 → $25 budget ≈ 570 sessions. SC5's cost field renders `—` (no price map in .ts — grep gate).

### Test/hermeticity machinery
- **vitest loads .env.local** (zero-dep loader in vitest.config.ts) → NEBIUS_API_KEY is present in EVERY test run → `isLlmDisabled()` is false in tests. Consequence: fallback-contract tests MUST set `FLAWCHECK_DISABLE_LLM=1` in beforeEach (see tests/reasoning/narrative-route.test.ts), and live tests are gated behind `FLAWCHECK_LIVE_LLM=1` (skipIf pattern in tests/llm/hello-fixture.test.ts).
- Hermetic suite = **280+ tests, zero network, key-independent** (`npm test`). Live suite: `FLAWCHECK_LIVE_LLM=1 npm test`.
- 03-01 test helper `framesOf` kept nulls: `parseNarrativeFrame` returns null exactly for `[DONE]` — asserting `frames[last]` null asserts the sentinel.
- **Relay byte-exactness**: `splitSentences` trims (lossy) — the stream relay uses `sentenceRelayCutoff` (lib/reasoning/lints.ts) so relayed deltas preserve separators exactly; the trailing fragment stays buffered until final lints pass (UI-42: rejected text never partially renders).
- TS closure narrowing: a usage sink assigned inside a callback needs a holder object (`const usage: { v: T | null } = { v: null }`) — plain `let` narrows to `never` at the read site.
- Golden values (G1–G14 calc, P1–P7 PT/MT, demo split 301/538/4,073 over 4,912) are pinned with exact `toBe` — **never adjust a number to pass a test**; if a golden fails, find the code bug or HALT.

### GSD workflow caveats
- `check verify-command-paths` / `check verify-failure-directions` probes returned CORRUPTED output on this setup — do not feed them to checkers; checkers derive those dimensions themselves (stated in every checker prompt).
- `.planning/HANDOFF.json` is a one-shot pause artifact — consumed (deleted) at resume by design; don't recreate it.
- plan-phase filesystem fallback is real: planners/executors sometimes die (captcha) AFTER writing artifacts — always check disk + git before re-running anything.
- Specless phases run the edge probe; unresolved edges → flagged assumptions in must_haves (FA-xx); prohibitions stay descriptor-less flagged-unverified.
- Install approval: EVERY package install needs explicit user approval. The user may be away — prompt, and if silent, decide by best judgment with provenance recorded (done twice: 5 Flowstep packages ratified; full ledger in UNINSTALL.md per phase with disk footprint + removal commands). NO deletions without approval.
- Browser verification (control-browser skill): bootstrap EVERY js call (fresh kernel); locator clicks may time out on Next.js dev overlays → fall back to `playwright.evaluate` clicking; **screenshots time out in dev mode** (3× verified) — use DOM snapshots + class assertions instead; IAB file-upload unsupported (replace-dialog focus-trap stays reducer-pinned).

### Windows specifics
- pypdf (never pdfplumber for 500+ page standards PDFs); write scripts to `scratch/`, `sys.stdout.reconfigure(encoding="utf-8")`.
- No multiline inline Python in PowerShell — Git Bash heredocs fine; scratch/ is gitignored.
- `npm run catalog` needed a 500 ms socket settle before exit (win32 libuv teardown assertion, exit 127 after success).
- LF→CRLF git warnings are harmless noise on this machine.
- `create-next-app` refuses non-empty dirs — scaffold into temp + ADD-only merge (done in Phase 1).

### Phase-2 regressions that MUST stay pinned (regression tests exist)
- **CR-01**: thickness-vs-OD validation compares in canonical mm (a 748-mil row vs 114.3 mm OD validates clean).
- **CR-02**: auto-guess never maps `Original_Scantling_mm` (constant nominal) to t-initial; explicit mapping honored with a `nominal-scantling-as-t-initial` warning.
- Six CSV mapping targets (incl. t-initial/t-previous) — the Flowstep mock's 4-target layout was REJECTED as a functional regression (R6 wide-format grouping).

## 5. Flowstep GUI Integration (user-directed 2026-09-27)

- Source: `flowstep-gui/` (4 mockups + 4 reference Vite projects; orange oklch primary, dark chrome, lucide icons). 5 packages installed+ledgered: class-variance-authority, clsx, lucide-react, tailwind-merge, tw-animate-css (~44 MB, lucide = 43 MB).
- 4-step wizard indicator with Step 4 "Report" LOCKED (pre-designed; Phase 4 unlocks). Screen 4 exists as a locked report PREVIEW (`/report`, sessionStorage snapshot; "Generation unlocks in Phase 4").
- Binding deviations from the mock: 6 mapping targets kept (above); Screen 1 copy says 25 MB (cap raised; 50k-row cap unchanged — the real parse bound); mock's placeholder numbers (3,812/876/224/42 locations) are NOT our data (real: 301/538/4,073 over 12 locations).
- Functional-preservation pins that must stay green: reducer contracts, data-* hooks, aria patterns, resultRowKey, verdict chip TEXT (ACCEPT/RE-CHECK/FAIL), SOURCE-CLEAN/DOCS-CLEAN greps.

## 6. Key File Map

| Path | What |
|---|---|
| `lib/criteria/*.json` | Ground truth (READ-ONLY in phases 2-3) |
| `lib/calc/` | Deterministic engine (pure, golden-pinned) |
| `lib/ingest/` | CSV parser, mapping, validation, grouping, session |
| `lib/wizard/` | Reducer, format, results render helpers |
| `lib/reasoning/` | schemas, prompts, narrative-context, lints, fallback, tokenizer |
| `lib/llm/` | config (env-only), client, complete (validated call + usageSink + parseJsonLoose) |
| `app/api/reasoning/*` | extract + narrative routes (frame protocol in schemas.ts) |
| `hooks/use-narrative-stream.ts` | Narrative store + hook (03-03 T1) |
| `components/wizard/` | Screens 1-3 components, reasoning-pane, citation-chip |
| `app/report/` | Locked report preview (Phase 4 unlocks) |
| `UNINSTALL.md` | Per-phase package ledger (keep appending) |
| `.planning/phases/03-*/` | Plans (7), summaries, REVIEW, VERIFICATION |

## 7. Next Actions (in order)

1. **03-03 Task 2**: rewire results table onto the store (streaming/complete/error/retry UX) per 03-03-PLAN.md Task 2; gates; SUMMARY.
2. **03-04**: ReasoningProvider + PipelineStatusBar (token badges, `—` cost) + extraction-failure banner + PT/MT panes + re-eval reset, INTO the Flowstep-restyled components.
3. **03-05**: wrap — offline e2e gates, purity/grep invariants vs phase-start ref, UNINSTALL verify, UI-25..48 + FS-01..12 + SC1-5 coverage sweep, 03-SUMMARY.md (state SC5 cost em-dash + live A11 findings).
4. Orchestrator: adversarial code review (deep) → fix branch → verify (gsd-verifier) → browser walkthrough of the Flowstep redesign → merge build/phase-3 → master.
5. Phases 4 (report generation + print-CSS + sign-off) and 5 (cached demo + Live toggle, rate limiting, Tavily, deploy, video, repo audit) — full GSD cycles each.
6. Milestone lifecycle: audit → complete → cleanup.
7. Submission checklist (deadline 30 Oct): public repo + MIT license visible, README with Nebius/NVIDIA usage highlighted, ≤3-min YouTube video with audio, demo URL, feedback write-up.

---
*Agent handoff v2 — 2026-09-28. Maintained by the orchestrator; update after every phase close.*
