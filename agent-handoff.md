# FlawCheck Fork B (`feat/subq-snap`) — Agent Handoff (v3.1, 2026-10-15)

> **Purpose**: complete continuity brief for any agent resuming **during/after the SubQ Snap build phase (08-01-PLAN.md)**. Supersedes the v2 handoff (2026-09-28) inherited into this worktree — that document still governs the main `master` submission repo.
> **v3.1 update**: Phase 08 execution began and is substantially complete — 6 implementation commits landed, tests grew 583→617. See §3a.
> **Read after this**: `AGENTS.md` (workspace guardrails) → `.planning/STATE.md` (exact position) → `.planning/phases/08-subq-snap-decision-engine/08-SPEC.md` → `08-01-PLAN.md`.

---

## 1. Project Context — Why This Fork Exists

**FlawCheck** is an NDT Inspection Copilot: raw ultrasonic thickness CSVs + PT/MT notes in → deterministic code-compliance evaluation (pure TypeScript) → Nemotron-narrated, clause-cited acceptance reports out. Built for the **Nebius x NVIDIA Global AI Hackathon** — Devpost deadline **30 Oct 2026, 10:30pm IST**, track "Best Apps & Agents".

- Main submission repo: `C:\Users\moham\Documents\Nebuis` (branch `master`, deployed at https://ndt-flawcheck-ai.netlify.app, GitHub `ahmed13576/flawcheck`).
- **Builder**: Mohammed Ahmed — mechanical engineer, NDT Level 2 (UT/PT/MT), ASME-literate; not a professional coder — all production code is agent-generated. Commit identity: `ahmed13576`.
- **Hackathon rule**: the submission must use Nebius Token Factory and ≥1 NVIDIA open model. This is why the original "Jev" concept (TypeSafe AI's proprietary System-1 decision model) was kept **out of the main trunk**: a third-party API in core decision logic dilutes the sponsor-evaluated criteria and breaks the judges' runs-out-of-the-box invariant (`NEBIUS_API_KEY` only).
- **Two experimental forks** were scaffolded (2026-10-14/15) to explore the "System-1 fast decision model" pattern (non-autoregressive, strictly-typed `choice` / `noul` / `score` outputs, ~100–300 ms, zero prose):
  - **Fork A** — `../flawcheck-nvidia-system1` (`feat/nvidia-system1`): Nemotron-3.5-Lightning at temperature 0 with strict JSON schema as the System-1 tier. Hackathon-compliant path.
  - **Fork B (this worktree)** — `../flawcheck-subq-snap` (`feat/subq-snap`): SubQ.ai Snap Decision API (`subq-snap-preview`) as the System-1 tier **plus a comparative benchmark harness vs Nemotron-Lightning**. This is the research/portfolio piece ("System-1 vs System-2 in Industrial NDT AI") — its code does **not** ship in the Devpost submission.

**Dual-System framing**: System 0 (pure TS `lib/calc/`) computes every number; System 1 (this fork: fast typed micro-decisions) routes/classifies/gates; System 2 (Nemotron Super-120B) narrates. System-1 stage candidates from ideation: column reconciliation, PT/MT indication morphology triage, API 570 fluid-class routing, outlier/negative-CR root cause, adversarial prompt-injection firewall pre-System-2, fleet-scale tiering (Tier 1 auto-pass / Tier 2 borderline / Tier 3 full System-2), and semantic narrative verification replacing regex lints.

## 2. Immutable Architectural Invariants (violating any = broken product)

1. **TypeScript computes every number** — `lib/calc/` never imports `lib/llm/` or any decision-provider code (boundary test + eslint no-restricted-imports). The System-1 model is **never** asked numerical questions ("Is 4.2 < 4.5?" is forbidden — the engine answers that deterministically and passes the answer in as context).
2. **Criteria sovereignty**: all formulas/limits/citations load from `lib/criteria/*.json` (`citations.json` edition-pinned allowlist; `ptmt-criteria.json` ASME B31.3 morphology/thresholds; `ut-criteria.json` Barlow/B31.3 t-min, governing `t_required = max(t_pressure, t_structural)`, API 570 corrosion rates, remaining life, intervals, verdict bands). Models never invent clause numbers, never alter acceptance limits.
3. **Standards hierarchy**: API 570 (5th Ed.) → corrosion rate, remaining life, inspection intervals; API 574 (5th Ed., 2024) §10 & Annex D → required thickness, Barlow; ASME B31.3-2024 → pressure design formula and MT/PT NDE acceptance (§344.3.2 MT / §344.4.2 PT; linear indications rejectable regardless of size).
4. **Fail-closed on low confidence**: any System-1 calibrated probability below threshold (e.g. p < 0.85 on API 570 fluid classification) routes to manual Level 2 inspector sign-off — never a guess, never a fallback default.
5. **Zero-cost hermetic fallback**: with `FLAWCHECK_DISABLE_LLM=1` (and if any System-1 endpoint is unreachable) the system must fully pass tests using deterministic heuristic fallbacks, zero network.
6. **Verdict order / verdict banding** (ut-criteria): `if (t_actual < t_required) reject; else if (t_actual < t_required + gauge_uncertainty) re_check; else accept`. RL ≤ 0 with valid CR → `{ intervalYears: 0, state: "immediate-inspection" }` — never a negative interval.
7. **Golden values are pinned** (G1–G14 calc, P1–P7 PT/MT, demo split 301/538/4,073 over 4,912 readings) with exact `toBe`. **Never adjust a number to pass a test** — if a golden fails, find the code bug or HALT.
8. **Scaffold-time sovereignty audit** (verified 2026-10-15, victory audit): `lib/calc/` and `lib/criteria/` are byte-identical to `master` at both fork commits. Phase 08 must-have truth re-asserts this — keep it green.

## 3. Fork B — Verified Current State (2026-10-15)

Worktree: `C:\Users\moham\Documents\flawcheck-subq-snap`, branch `feat/subq-snap`, working tree **clean**. Exactly **2 commits ahead of `master` (6764cbe)**:

| Commit | Date | Contents |
|---|---|---|
| `73def31` | 10-14 | Code scaffold — **14 files, +1,944 lines**: `lib/decision/types.ts` (DecisionProvider seam: `choice`, `noul`, `score`, `batch`, `DecisionImage`, error envelopes), `lib/decision/providers/subq-snap.ts` (286-line SubQ client stub), 4 domain spike contracts (`fluid-classifier.ts`, `fleet-triage.ts`, `morphology-classifier.ts`, `semantic-guard.ts`), `lib/decision/benchmark/{runner,types}.ts`, analytics stubs (`lib/analytics/geometry.ts`, `components/analytics/{cml-heatmap,metric-gauge,trend-curve}.tsx`, `components/report/pdf-analytics.tsx`) |
| `340de94` | 10-15 | Planning layer — 11 files, +1,428 lines: ROADMAP Milestone v3 + SPEC/CONTEXT/PLAN for Phases 07–09 (committed identically to Fork A) |
| `241607a` | 10-15 | feat(08-01): implement SubQ Decisions provider |
| `01fcbbe` | 10-15 | test(08-01): cover SubQ image validation |
| `aa4bd6b` | 10-15 | test(08-01): exercise SubQ decision spikes |
| `735a4e8` | 10-15 | feat(08-01): add honest System-1 benchmark harness |
| `71f1fed` | 10-15 | fix(08-01): close adversarial review findings |
| `dfea9a6` | 10-15 | test(08-01): verify live SubQ integration |

### §3a. Phase 08 execution status (v3.1)

An executor run implemented 08-01 across 6 commits: the SubQ provider, spike tests, multi-modal image validation, the benchmark harness (with the adversarial-review fix: comparisons are marked "measured" only when BOTH providers have successful observations — pending/failed otherwise, with failure counts + diagnostics in the report), and live-SubQ verification tests. Tests are now **617 passed / 6 skipped (56 files)**. The deep-review artifact is `.planning/phases/08-subq-snap-decision-engine/REVIEW.md` (10 files reviewed).

Live-SubQ reality (updated 2026-10-19): the user supplied the real `SUBQ_API_KEY` in `.env.local` and a minimal live request to `subq-snap-preview` succeeded (valid `noul` response, 105 input tokens, 0 output tokens — see Temp handoff of 2026-10-19). Hermetic implementation + mocked tests are complete, and `08-01-SUMMARY.md` now exists. Remaining: fresh adversarial review (done 2026-10-19 → `08-REVIEW.md`), verify-work, live measured benchmark (still blocked on a Fork A Nebius baseline + verified pricing — do not invent either), then Phase 09.

- GSD state: `milestone_version: v3`, 9 phases registered, 0 MVP-mode.
- `node_modules` is an **NTFS junction** → `C:\Users\moham\Documents\Nebuis\node_modules` (see §6 caveat 1).

### ⚠️ Structural caveat: Phase 07 vs Phase 08 ownership (read before executing)

The planning layer was committed **identically to both worktrees**, but the plans have cross-fork scope:

1. **Phase 07 (`07-01-PLAN.md`) targets Fork A** — its `files_modified` are the Nebius Nemotron adapter in `../flawcheck-nvidia-system1`. Do **not** execute Phase 07 from inside Fork B.
2. **Fork B has no `providers/nebius-nemotron.ts`** — the benchmark runner (`lib/decision/benchmark/runner.ts`) takes `nebiusMetrics` as an *optional* input and degrades gracefully (comparison fields become null/"tie"), so Phase 08 compiles and runs standalone. But a *comparative* benchmark needs baseline metrics from Fork A's Phase 07 run. **Sequence: Phase 07 executes in Fork A → baseline metrics/provider ported here → Phase 08 executes here.**
3. Both worktrees' `STATE.md` say `current_phase: 7`. In Fork B the meaningful phase is **08**. Point the executor at Phase 08 deliberately — don't let it "helpfully" implement Fork A's adapter in this tree, and don't let it merge anything into `master`.

## 4. Phase 08 Scope (the build being started)

Requirements locked: **SUBQ-01..04, BENCH-01..04** (8 must-haves in `08-SPEC.md`). Estimate ~45k tokens, 4 tasks, autonomous: true.

- **SUBQ-01**: `SubQSnapDecisionProvider` → `POST https://api.subq.ai/v1/systemone`, model `subq-snap-preview`, native `noul`/`choice`/`score` payloads, `Authorization: Bearer $SUBQ_API_KEY`, clean HTTP 4xx/5xx handling, reflect `output_tokens: 0` in usage telemetry.
- **SUBQ-02/04**: multi-modal evaluation — base64 PNG/JPEG dye-penetrant / ultrasonic A-scan images (SubQ supports up to 4 images/request, 384K context), client-side data-URI stripping and size bounding.
- **SUBQ-03**: all 4 domain spikes run against SubQ with identical interface contracts and fail-closed gates.
- **BENCH-01..04**: comparative harness Nemotron-Lightning vs SubQ Snap across Spikes A–D — latency distribution, calibration on boundary edge cases (Brier score / ECE), cost per 1,000 evaluations → `docs/system1-benchmark-report.json`.
- Planned files: `providers/subq-snap.ts` (implement), `benchmark/{runner,scenarios,metrics}.ts`, the report artifact, and 3 new test files (`tests/decision/{subq-provider,multimodal,benchmark}.test.ts`).
- **SubQ API reference** (user-provided doc set): Decisions API (`docs.subq.ai/endpoints/decisions-api/`) is operative; also Structured outputs, Function calling, Responses API, Chat Completions API, Files API, Conversations API.
- **Spike success criteria from ideation** (ground-truth expectations): Spike A fluid classification >98% accuracy on ~50 noisy industrial fluid descriptions, latency <150 ms, catastrophic-fail = misclassifying a toxic/flammable Class 1 fluid as Class 3; Spike B 0 false negatives on `re_check`/`reject` readings across the 4,912-reading Zenodo register, >80% token-cost reduction; Spike C 100% linear/rounded boundary adherence + immunity to embedded jailbreaks; Spike D 100% factual-contradiction detection with ~90% fewer false positives than the regex lints.

## 5. Critical Learnings — Provider/Runtime (from v2; still operative)

- **Subagent spawns fail frequently** on this account/provider: captcha timeouts (×4), "stream recovery max retries", model concurrency limits. **Mitigation that works**: continuation-executor pattern — each attempt banks committed work; resume prompts state exact committed state + uncommitted files. After 3+ consecutive provider deaths the orchestrator may execute a plan INLINE — plan files on disk are the recovery source.
- **Commit after every task; never leave work uncommitted across a spawn boundary.** Git checkpoints are the crash recovery.
- `git branch --show-current` before EVERY commit — an external force switched branches mid-run once (recovered via reflog forensics). Worktrees make the risk surface larger, not smaller.
- **Lightning wraps JSON in prose** despite `response_format: json_object` → `parseJsonLoose` extracts balanced `{…}` blocks, tried LAST-first. Relevant if Fork A's adapter is ported in for the baseline.
- **Lightning's visible chain-of-thought counts inside max_completion_tokens** — extraction needs 3000 (800 truncated mid-thought). Super-120B narrative fits in 1200 at `reasoning_effort: "low"`.
- `reasoning_effort` enum is `low|medium|high` ONLY (wider values 422).
- **"ASME B31.3" contains digits (31.3, 3)** — the numeric-consistency lint strips code designators before digit scanning, or every narrative fails. If Spike D's semantic guard replaces lints, keep this quirk in the benchmark scenarios.
- Live costs (master-era): extraction ~$0.0002/eval; narrative ~$0.0009/pane. Benchmark cost metrics must use measured usage, not hardcoded prices (grep gate scans for hardcoded `nvidia/` model IDs — never hardcode them in source/tests).

## 6. Environment & Platform Caveats

1. **NTFS junction `node_modules`** → root repo's install. Zero disk duplication, but an `npm install <new-dep>` in Fork B mutates the shared lockfile state for root AND Fork A. If Phase 08 needs a dependency, either install at root deliberately (affects all three trees, needs user approval per §7) or break the junction for a real local `node_modules` (decouples CI realism, costs disk).
2. **`.env.local`** (git-ignored): `SUBQ_API_KEY` — **real key supplied by the user 2026-10-19; treat as secret: never print, copy into artifacts, or log its value.** Also carries real Nebius credentials (needed by inherited test suites + base routes), `FLAWCHECK_DECISION_ENGINE=subq`, `SUBQ_BASE_URL=https://api.subq.ai`, `SUBQ_MODEL=subq-snap-preview`. Keep out of every commit.
3. **Hermeticity machinery** (v2, still true): vitest loads `.env.local` via a zero-dep loader → keys present in every test run → fallback-contract tests MUST set `FLAWCHECK_DISABLE_LLM=1` in beforeEach; live tests gated behind `FLAWCHECK_LIVE_LLM=1` (skipIf pattern, `tests/llm/hello-fixture.test.ts` is the template). Hermetic suite = **583 tests, zero network, key-independent**.
4. **Windows/Git Bash**: no complex multiline inline Python in PowerShell — write scratch scripts to `scratch/` (gitignored) and run via `python <path>` with `sys.stdout.reconfigure(encoding='utf-8')`. Standards text contains `−`, `°`, `’` — sanitize before console printing.
5. **PDF standards**: never open standards `.pdf`s with view tools; use `pypdf` (`PdfReader`) — `pdfplumber` times out on 500+-page files.
6. **CRLF**: `.gitattributes` pins LF for CSV/fixture files (commit `9c33f6b` exists because of this). New fixture files must respect the pin.
7. Browser verification (control-browser skill): bootstrap every JS call; locator clicks may time out on Next.js dev overlays → fall back to `playwright.evaluate` clicking; screenshots time out in dev mode — use DOM snapshots + class assertions.

## 7. Process & Trust Caveats

1. **Trust `git log`, not status narratives.** The multi-agent coordination log claimed Milestone v3 GSD artifacts were committed *before they existed* — verification against actual commits showed only the code scaffold had landed (Fork A `f70c3ea`, Fork B `73def31`); the planning layer arrived later as `4c2c6e2` / `340de94`. Every claim in this handoff has been re-verified against `git log` / filesystem. Maintain that standard: state claims must map to commits.
2. **Agents never push, deploy, or publish.** The user pushes to GitHub/Netlify manually. Root `master` was ~9 commits ahead of origin (`4eb2620`…`6764cbe` unpushed) — that is the user's action.
3. **Root `master` stays untouched** by Fork B work. Do not merge forks into `master` before the Oct 30 submission. History note: master was rewritten once with `git filter-repo` (`06ad869`, 155 commits, pack 15 MB → 1.07 MiB; backup bundle at `C:\Users\moham\Documents\nebius-backup-prehistory-20261008.bundle`) — old SHAs in older docs may not resolve.
4. **Package installs need explicit user approval** (v2 rule): the user may be away — if silent, decide by best judgment with provenance recorded in `UNINSTALL.md` (per-phase ledger with disk footprint + removal commands). NO deletions without approval.
5. **Hackathon compliance boundary**: Fork B (SubQ) content does NOT ship in the Devpost submission. It may be cited in the write-up as benchmark evidence, but the submission runs standalone on Nebius + NVIDIA with `NEBIUS_API_KEY` only.
6. **GSD fingerprint quirk**: `gsd-tools query` can report phases stale/incomplete from fingerprint/mtime drift — a false reading (root needed commit `ee06b02` to fix exactly this). If Phase 08 summaries exist on disk but stats disagree, verify on disk before "fixing".
7. **Cosmetic backlog**: Phase 04 shows 4 plans / 3 summaries in all three trees (one missing summary). Fix opportunistically.
8. **GSD one-shots**: `.planning/HANDOFF.json` is a one-shot pause artifact, consumed at resume by design — don't recreate it. Specless phases flag assumptions as FA-xx in must_haves.

## 8. Key File Map (Fork B)

| Path | What |
|---|---|
| `lib/criteria/*.json` | Ground truth (READ-ONLY, byte-frozen) |
| `lib/calc/` | Deterministic engine (pure, golden-pinned, byte-frozen) |
| `lib/decision/types.ts` | DecisionProvider seam: `choice` / `noul` / `score` / `batch` / `DecisionImage`, error types |
| `lib/decision/providers/subq-snap.ts` | SubQ client stub → Phase 08 Task 1 implements |
| `lib/decision/spikes/*` | 4 domain spike contracts (fluid, fleet-triage, morphology, semantic-guard) |
| `lib/decision/benchmark/*` | Runner (optional-Nebius-baseline design), types → scenarios.ts + metrics.ts are new in 08 |
| `lib/ingest/`, `lib/wizard/`, `lib/reasoning/`, `lib/llm/` | Master-era subsystems (unchanged; the LLM config reads env only) |
| `components/analytics/*`, `lib/analytics/geometry.ts`, `components/report/pdf-analytics.tsx` | Phase 09 visual-analytics stubs (SVG curves, CML heatmaps, PDF vector serialization) |
| `.planning/phases/08-subq-snap-decision-engine/` | SPEC / CONTEXT / 01-PLAN for this build |
| `docs/system1-benchmark-report.json` | Phase 08 output artifact (to be created) |

## 9. Run Order Status (v3.1)

1. ~~Pre-flight~~ — done; Fork A has NOT executed Phase 07, so the benchmark runs degraded (comparisons stay pending until a Nebius baseline is ported). ~~**`SUBQ_API_KEY` is still a placeholder** — live runs blocked until user supplies it.~~ **Resolved 2026-10-19: real key supplied; a live smoke test succeeded.** Measured *comparative* benchmark data still awaits the Fork A baseline + verified pricing.
2. ~~Execute 08-01 tasks 1–4~~ — done across commits `241607a`…`dfea9a6` (617/6 tests).
3. Remaining gates: live spikes + measured benchmark once key is set → regenerate `docs/system1-benchmark-report.json`; keep `FLAWCHECK_DISABLE_LLM=1` fully hermetic; `lib/calc/`/`lib/criteria/` byte-identical; fail-closed p<0.85 paths tested.
4. Wrap Phase 08 (summary, STATE update). Phase 09 (visual analytics) is the remaining v3 phase — components stubbed and shared across both forks.
5. After both forks complete: benchmark write-up is portfolio material; nothing merges to `master` before the Oct 30 submission.

---

**One-line summary**: Fork B has Phase 08 implemented hermetically (8 branch commits, 617/6 tests, benchmark harness with honest pending-until-measured semantics); the remaining work is the real `SUBQ_API_KEY` → live measured benchmark, a Nebius baseline port from Fork A for the comparison, and Phase 08 wrap.

---
*Agent handoff v3.1 — 2026-10-15. Fork B maintained; update after Phase 08 close. v2 learnings preserved verbatim where still operative.*
