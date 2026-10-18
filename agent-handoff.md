# FlawCheck Fork A (`feat/nvidia-system1`) — Agent Handoff (v3.1, 2026-10-15)

> **Purpose**: continuity brief for resuming Fork A on a new machine. Fork B's `agent-handoff.md` (v3.1, in `../flawcheck-subq-snap` / branch `feat/subq-snap`) is the **full** shared brief — project context, standards invariants (§2), platform caveats (§6), process/trust rules (§7) all apply here identically. This document covers only what differs for Fork A. (Supersedes the v2 handoff inherited from master.)
> **Read after this**: `AGENTS.md` → `.planning/STATE.md` → `.planning/phases/07-decision-provider-seam/07-SPEC.md` → `07-01-PLAN.md`.

## 1. Fork A Identity

- Worktree: `C:\Users\moham\Documents\flawcheck-nvidia-system1`, branch `feat/nvidia-system1`, remote `origin` = `https://github.com/ahmed13576/flawcheck.git`.
- **Hackathon-compliant** System-1 fork: uses Nebius Token Factory NVIDIA models only — no third-party API. If any fork's approach were folded into the Devpost submission, it would be this one's pattern.
- System-1 engine: `nvidia/Nemotron-3_5-Lightning` at temperature 0 with strict `json_object` schema emitting only `{ choice: enum, score: number }` / boolean gates — single-pass, ~100–300 ms, zero freeform prose. System-2 narration stays on `nvidia/nemotron-3-super-120b-a12b`.

## 2. Verified Current State (2026-10-15)

Exactly **2 commits ahead of `master` (6764cbe)**, working tree clean, tests **583 passed / 5 skipped** (inherited suite), `tsc --noEmit` clean:

| Commit | Date | Contents |
|---|---|---|
| `f70c3ea` | 10-14 | Code scaffold — **12 files, +1,674 lines**: `lib/decision/types.ts` (DecisionProvider seam), `lib/decision/providers/nebius-nemotron.ts` (257-line Nebius adapter stub), 4 domain spike contracts, `lib/analytics/geometry.ts`, analytics/PDF component stubs |
| `4c2c6e2` | 10-15 | Planning layer — 11 files, +1,428 lines: ROADMAP Milestone v3 + SPEC/CONTEXT/PLAN for Phases 07–09 (committed identically to Fork B) |

`node_modules` is an NTFS junction → root repo's install (shared with Fork B — installs affect all three trees).

## 3. Phase 07 — THIS Fork's Build (the operative plan)

`07-01-PLAN.md` targets **this worktree** and its paths are local (no cross-fork path bugs). Scope: implement `NebiusNemotronDecisionProvider` (temperature-0, strict-schema, low-latency single-pass), run the 4 domain spikes against it with fail-closed gates (p<0.85 → manual sign-off), prove TypeScript calculation sovereignty.

- **Depends on nothing** — Phase 07 can start immediately; it is the *baseline producer* for Fork B's comparative benchmark.
- **Deliver downstream**: measured latency / calibration (Brier/ECE) / cost metrics that Fork B's harness imports as `nebiusMetrics`. Emit them as a portable artifact (e.g. `docs/system1-baseline-metrics.json`) and record the exact shape in the phase summary — Fork B's `benchmark/runner.ts` consumes this.
- **Model quirks already learned** (apply here): Lightning wraps JSON in prose → `parseJsonLoose` extraction; visible CoT counts inside `max_completion_tokens` (extraction needs 3000); `reasoning_effort` enum is `low|medium|high` only.
- **Never hardcode `nvidia/` model IDs in source/tests** — env-only routing (grep gate), inherited from master.
- **Status**: Phase 07 NOT yet started (0 summaries). Fork B raced ahead: its Phase 08 is implemented hermetically (617/6 tests) but its benchmark comparisons stay pending until this fork's baseline lands.

## 4. Phase Ownership (avoid the cross-fork trap)

- Phase 08 (SubQ Snap) plans live in this `.planning` but **scope belongs to Fork B** — do not execute Phase 08 here.
- Phase 09 (visual analytics) components are stubbed identically in both forks; decide the canonical home when its turn comes.
- Both worktrees' `STATE.md` say `current_phase: 7` — correct here, misleading in Fork B.

## 5. Run Order

1. Verify `tsc --noEmit` + `npm test` (583/5) — hermetic baseline.
2. Execute `07-01-PLAN.md` (provider → spikes → gates), committing after every task (provider spawn instability is real on this account — git checkpoints are the recovery).
3. Emit baseline metrics artifact for Fork B's benchmark; note its schema in the phase summary.
4. Wrap Phase 07 (summary, STATE) — then Fork B unblocks its full measured comparison.
5. `NEBIUS_API_KEY` in `.env.local` is **real** here (inherited) — no key setup needed, unlike Fork B.

---
*Agent handoff v3.1 — 2026-10-15. Fork A maintained; see Fork B's v3.1 handoff for the complete shared learnings catalog.*
