---
milestone: v3
audited: 2026-10-19T11:22:05Z
auditor: ZCode (gsd-milestone-audit)
status: tech_debt
scores:
  requirements: 24/24
  phases: 3/3
  integration: verified
  flows: verified
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: 07-decision-provider-seam (Fork A, read-only reference)
    items:
      - "Process debt (MEDIUM): no 07-VERIFICATION.md exists in Fork A — milestone auditor re-executed the verification gates in lieu (tsc clean, 621/5 hermetic suite, 0-byte protected-tree diff, artifacts on disk, measured baseline metrics). Recommend back-filling 07-VERIFICATION.md before /gsd:complete-milestone."
      - "Advisory (LOW): guard case 2 model-side false negative (p=0 on a grounded narrative) — deterministic grounding layer accepts it; conservative gate costs recall, never precision. Documented in baseline artifact."
      - "Advisory (LOW): one observed 17-minute upstream Nebius stall — 90 s transport timeout + bounded retry mandatory for production fleet triage (documented)."
  - phase: 08-subq-snap-decision-engine (Fork B)
    items:
      - "BENCH-03 (LOW): benchmark cost winner null — SubQ per-token pricing unpublished (no authoritative public price on docs.subq.ai); runner gates the comparative cost breakdown on verified pricing instead of fabricating numbers. Nebius side priced ($0.596/1k evals from Fork A artifact citation $0.13/$0.60 per M)."
      - "BENCH-04 (LOW-MEDIUM): `npm run benchmark` script entry not implemented — measured run executed via committed zero-dependency `scripts/system1-benchmark/` vitest harness (own include pattern, `npm test` never runs live calls). Artifact is committed and status `measured`. Add the npm alias before submission freeze."
      - "Calibration stability (LOW): calibration winner flipped run-to-run across two independent live runs (Brier 0.0112 vs 0.0039 at n=30) — documented as run-dependent; latency winner (subq) was stable on both runs."
      - "Advisory (LOW): live multimodal round-trip not separately exercised — image-path verification is hermetic (real encoded PNG/JPEG/WebP fixtures against mocked fetch seam); live gated run validated the SubQ contract on text-only synthetic states."
      - "Advisory (LOW): open 08-REVIEW.md advisories — WR-1 (no default request timeout), WR-2 (NODE_ENV=test origin override), WR-3 (serial fleet triage ignores batchSize), NF-1..NF-4 cosmetics. None violate a locked acceptance criterion."
  - phase: 09-visual-inspection-analytics (Fork B)
    items:
      - "Build gate (MEDIUM, pre-freeze action): `next build` cannot run in this worktree (NTFS node_modules junction rejected by Next/Turbopack resolver). Operative gates re-executed here: `tsc --noEmit` clean + 690/6 hermetic suite. A full `next build` MUST be run from the root repo checkout before the submission freeze."
      - "PDF-04 (LOW): axe accessibility scan not executed (no browser in environment) — evidence is code-level (motion-reduce utilities on every animated element + global prefers-reduced-motion media query + DOM class assertions). Run axe in CI/browser as follow-up."
      - "D6 presentation (LOW): audit-log deep links and automated prompt-fix suggestions remain unwired in guard-failure-report.tsx — remediation guidance is textual; not a locked SPEC acceptance criterion."
nyquist:
  capability: inactive
  note: "No validate-phase step hook active in verify:post render-hooks (only secure-phase, ui-review) — discovery skipped per workflow §5.5. No VALIDATION.md files exist in any phase directory."
requirement_set: "v3 did not add REQUIREMENTS.md entries (traceability still reports v2's 30). Per audit scope, the v3 requirement set is the union of phase SPEC locked requirements: 07 (DEC-01..04, SPIKE-01..04), 08 (SUBQ-01..04, BENCH-01..04), 09 (VIS-01..04, PDF-01..04) = 24."
---

# Milestone v3 — System-1 Fast Decision Architectures: Milestone Audit

**Verdict: `tech_debt`** — all 24 milestone requirements satisfied with re-executed on-disk evidence across both fork worktrees; no FAIL-gate triggers (zero unsatisfied/orphaned requirements); accumulated deferred and process items catalogued below for review before `/gsd:complete-milestone`.

**Scope:** Milestone v3 deliberately spans two fork worktrees. Fork B (`feat/subq-snap`, this worktree): Phases 8–9 + measured benchmark. Fork A (`feat/nvidia-system1`, read-only reference): Phase 7. Phases 1–6 belong to archived v2 — baseline context only.

---

## 1. Gates Re-Executed by the Auditor (not trusted from narratives)

### Fork B — `C:\Users\moham\Documents\flawcheck-subq-snap` @ `080b6ed` (branch `feat/subq-snap`)

| Gate | Command | Result |
|---|---|---|
| Protected calc trees byte-identical to baseline `2ce76be` | `git diff 2ce76be..HEAD -- lib/calc/ lib/criteria/` | **0 bytes** ✔ |
| Protected trees clean in worktree | `git status --porcelain -- lib/calc/ lib/criteria/` | empty ✔ |
| PDF-03 dependency invariant | `git diff 2ce76be..HEAD -- package.json package-lock.json` | **0 bytes** — zero new packages ✔ |
| Hermetic sovereignty suite | `FLAWCHECK_DISABLE_LLM=1 npm test` | **690 passed \| 6 skipped** (62 files passed, 3 skipped of 65) — matches stated baseline 690/6 ✔ |
| Typecheck | `npx tsc --noEmit` | exit 0 ✔ |
| Working tree | `git status --porcelain` | clean ✔ |

The 6 skips are the intentionally gated live tests (`FLAWCHECK_LIVE_*`), not failures.

### Fork A — `C:\Users\moham\Documents\flawcheck-nvidia-system1` @ `3b8ba37` (branch `feat/nvidia-system1`, READ-ONLY — nothing written)

| Gate | Command | Result |
|---|---|---|
| Protected calc trees vs baseline `2ce76be` | `git diff 2ce76be..HEAD -- lib/calc/ lib/criteria/` | **0 bytes** ✔ |
| Hermetic sovereignty suite | `FLAWCHECK_DISABLE_LLM=1 npm test` | **621 passed \| 5 skipped** — matches claimed 621/5 ✔ |
| Typecheck | `npx tsc --noEmit` | exit 0 ✔ |
| Working tree after runs | `git status --porcelain` | clean (nothing written by audit) ✔ |

---

## 2. Requirement Scorecard (union of phase SPEC locked requirements)

Requirement sources cross-referenced per workflow §5: (a) REQUIREMENTS.md traceability table — contains no v3 IDs (30 v2 rows only), (b) phase VERIFICATION.md requirements tables, (c) SUMMARY/PLAN frontmatter. All 24 IDs appear in plan frontmatter (`07-01-PLAN` requirements line; `08-01-PLAN:18`; `09-01-PLAN:21`). No orphans possible (no v3 IDs exist in the traceability table to orphan).

### Phase 7 — Decision Provider Seam & Nebius Fast Engine (Fork A) — 8/8

> **Verification note:** Fork A has **no 07-VERIFICATION.md** (unverified-phase flag per workflow §2). Per audit scope instructions the phase is a read-only evidence reference; the auditor re-executed the verification gates directly (results in §1). Evidence basis: `07-01-SUMMARY.md` (back-filled at `3b8ba37`), commit history, artifacts on disk, and the measured baseline artifact.

| ID | Requirement | Status | Evidence (on disk) |
|---|---|---|---|
| DEC-01 | Unified `DecisionProvider` interface, typed primitives, zero freeform leakage | ✓ satisfied | `lib/decision/types.ts` exists; contract-lock commit `2ca0a2b` — mock provider proves all four primitive signatures (`choice`, `noul`, `score`, `batch`); `tests/decision/types.test.ts` (6 tests) in the green 621/5 suite |
| DEC-02 | NebiusNemotronDecisionProvider on Token Factory, zero-temp JSON mode, balanced-brace recovery | ✓ satisfied | `lib/decision/providers/nebius-nemotron.ts` exists; commit `ba0c081` — temperature-0 strict `json_object`, `parseJsonLoose` preamble recovery exported from `lib/llm/complete.ts`, Zod wire validation, bounded retry fail-closed, kill-switch; budget fix `73c96ab` (2048→6000, live-verified quirk); `tests/decision/provider.test.ts` (13 tests) green |
| DEC-03 | Zero-text-leakage & typed returns (Zod rejects non-whitelisted keys, Σp≈1) | ✓ satisfied | Recorded in `ba0c081` (Zod wire validation) + SUMMARY decision "Choice distributions normalized to sum ≈ 1.0 (DEC-03)"; enforced by adapter tests in green suite |
| DEC-04 | Pure TS arithmetic sovereignty; hermetic pass under `FLAWCHECK_DISABLE_LLM=1` | ✓ satisfied | Protected-tree diff 0 bytes (re-executed §1); 621/5 green under the flag (re-executed §1) |
| SPIKE-01 | Spike A fluid classifier ≥95%, fail-closed p<0.85 | ✓ satisfied | `lib/decision/spikes/fluid-classifier.ts`; commit `f0c4b96`; measured baseline: 100% clear-case accuracy, 2/2 ambiguous fail-closed (confidence 0.65/0.75 < 0.85) in `docs/system1-baseline-metrics.json` |
| SPIKE-02 | Spike B fleet triage of 4,912 readings into Tiers 1–3, deterministic Tier-3 pre-filter | ✓ satisfied | `lib/decision/spikes/fleet-triage.ts`; commit `f0c4b96` — zero model calls on deterministic `t_actual < t_required` failures; 19 spike tests green |
| SPIKE-03 | Spike C PT/MT morphology per ASME B31.3 §344, 0 false negatives on cracks | ✓ satisfied | `lib/decision/spikes/morphology-classifier.ts`; commit `f0c4b96` — pure-TS L>3W override from `ptmt-criteria.json` thresholds (de-literalized per SUMMARY decision) |
| SPIKE-04 | Spike D semantic guard rejects unallowlisted citations & mismatched numbers | ✓ satisfied | `lib/decision/spikes/semantic-guard.ts`; commit `f0c4b96` — deterministic citations.json allowlist + verbatim/rounded number grounding layered under p≥0.95 noul gate; measured baseline 4 guard cases with the case-2 caveat documented |

### Phase 8 — SubQ Snap Decision Engine & Multi-Modal Benchmark (Fork B) — 8/8

`08-VERIFICATION.md`: status passed, 8/8, verified 2026-10-19T08:12:23Z at head `a4cdfbf` (verification commit `ccb4abf` — object confirmed in git). The verification's own re-executed evidence is consistent with the auditor's §1 re-runs. The then-pending measured comparison has since been **completed** (commits `592aa21` + `3fe0f83`): `docs/system1-benchmark-report.json` is now `status: "measured"` with 30/30 scenarios, 1 attempt each, zero failures on both providers — the completeness gate satisfied.

| ID | Requirement | Status | Evidence (on disk) |
|---|---|---|---|
| SUBQ-01 | SubQSnapDecisionProvider on `POST /v1/systemone`, model `subq-snap-preview`, native primitives, output_tokens 0, clean 4xx/5xx | ✓ satisfied | `lib/decision/providers/subq-snap.ts` (13,989 bytes) — model literal, Bearer auth, usage telemetry, typed `DecisionProviderError` with statusCode/providerId; `tests/decision/subq-provider.test.ts` green in §1 suite |
| SUBQ-02 | Multi-modal: ≤4 base64 PNG/JPEG/WebP images, ≤4 MiB each / 8 MiB total | ✓ satisfied | `MAX_IMAGES=4`, `MAX_IMAGE_BYTES=4MiB`, `MAX_TOTAL_IMAGE_BYTES=8MiB` enforced in provider; real encoded fixtures in `tests/decision/multimodal.test.ts` green (caveat: hermetic, see tech debt) |
| SUBQ-03 | All 4 domain spikes re-executed on SubQ Snap, identical contracts, fail-closed gates | ✓ satisfied | All 4 spikes in `lib/decision/spikes/` consume `DecisionProvider` (grep-confirmed); fail-closed paths test-proven (fluid 0.84<0.85 → review; semantic 0.94<0.95 → reject) in `tests/decision/subq-spikes.test.ts`; 4,912-reading register screened |
| SUBQ-04 | Data-URI stripping, byte-length validation, pre-dispatch question validation | ✓ satisfied | Stripping with media-type match before network dispatch; negative tests prove fetch never called on malformed payloads (`multimodal.test.ts`) |
| BENCH-01 | Latency distribution suite (min/mean/p50/p90/p95/p99) both engines → structured JSON | ✓ satisfied | `lib/decision/benchmark/metrics.ts` + runner; measured report: subq p50 583ms/p95 2177ms vs nebius p50 3890ms/p95 7679ms — `latencyWinner: subq` |
| BENCH-02 | Calibration on boundary edge cases: Brier + ECE | ✓ satisfied | Measured: subq Brier 0.0112/ECE 0.0679 vs nebius Brier 0.0039/ECE 0.0417 — `calibrationWinner: nebius` (run-dependent across the two live runs — tech debt) |
| BENCH-03 | Cost per 1,000 evaluations from published pricing | ✓ satisfied (with debt) | Nebius $0.596/1k computed; SubQ `null` — pricing unpublished; runner refuses to invent (measurementNotes) — accepted tech debt, see §4 |
| BENCH-04 | Automated report generation → committed `docs/system1-benchmark-report.json` | ✓ satisfied (with debt) | Artifact committed, `status: "measured"`, 30/30 both providers, zero failures; identical-fixture verification enforced by runner completeness gate (runner.ts:99-132); `npm run benchmark` alias missing — tech debt, see §4 |

### Phase 9 — Visual Inspection Analytics & Vector PDF (Fork B) — 8/8

`09-VERIFICATION.md`: status passed, 8/8, verified 2026-10-19T10:48:52Z at head `eae5a1d` (post Screen-3 mount gap closure `e30965b` — commit confirmed in git log; phantom SHAs removed in `eae5a1d`). Consistent with §1 re-runs (690/6 includes the +58 new tests).

| ID | Requirement | Status | Evidence (on disk) |
|---|---|---|---|
| VIS-01 | Shared pure geometry engine, zero DOM, 100% unit-tested | ✓ satisfied | `lib/analytics/geometry.ts` (12,941 bytes) — zero DOM references (grep-confirmed in verification); `tests/analytics/geometry.test.ts` 20 tests incl. hand-computed values and degenerate-viewport NaN guards |
| VIS-02 | Animated wall-loss trend curves: history, CR slope, t_required intercept, ±0.1mm envelope, reduced-motion | ✓ satisfied | `components/analytics/trend-curve.tsx`; edge cases test-pinned (zero CR, negative CR anomaly, immediate failure, single reading) |
| VIS-03 | CML spatial severity heatmap: verdict colors, tooltips, click→row highlight | ✓ satisfied | Colors `#16a34a`/`#d97706`/`#dc2626` in geometry engine; Screen 3 mount markers grep-confirmed (10 hits in `screen-results.tsx`: `VisualAnalyticsPanel`, `onSelectCml`, `highlightedCmlId`); dedicated relay test in `tests/analytics/screen3-mount.test.tsx` |
| VIS-04 | Animated safety-margin gauges: strokeDashoffset transitions, clamped, reduced-motion | ✓ satisfied | `components/analytics/metric-gauge.tsx` — `motion-reduce:transition-none motion-reduce:animate-none`, clamp tests in geometry suite |
| PDF-01 | Vector PDF trend curve via `@react-pdf/renderer` primitives, Helvetica/Courier, no rasterization | ✓ satisfied | `components/report/pdf-trend-curve.tsx` — imports `Svg, Path, Line, Circle, Rect, G, Text`; mounted at `pdf-document.tsx:462` (page 2); `tests/pdf/pdf-analytics.test.ts` (7 tests) asserts primitive hierarchy |
| PDF-02 | Vector PDF heatmap summary page 1, no overflow, >100 locations graceful | ✓ satisfied | `components/report/pdf-heatmap.tsx` mounted at `pdf-document.tsx:352` (page 1); dense registers shrink uniform cells (geometry `cellSize` empty-safe) |
| PDF-03 | Zero external charting dependencies | ✓ satisfied | `git diff 2ce76be..HEAD -- package.json package-lock.json` = 0 bytes (re-executed §1) |
| PDF-04 | Accessibility & motion sensitivity (motion-reduce fallbacks) | ✓ satisfied (code-level) | `motion-reduce:` utilities on every animated element + global `@media (prefers-reduced-motion: reduce)` in `app/globals.css:194`; axe scan not run (no browser) — tech debt, see §4 |

---

## 3. Cross-Phase Integration & E2E Wiring (verified directly)

The gsd-integration-checker role was executed inline by the milestone auditor (subagent dispatch of the checker was performed as direct verification — all findings below were checked against source, not narratives):

| Wiring | Verification |
|---|---|
| Phase 7 → 8: shared DecisionProvider seam | All 4 spikes (`fluid-classifier`, `fleet-triage`, `morphology-classifier`, `semantic-guard`) consume `DecisionProvider` primitives; BOTH providers (`nebius-nemotron.ts` ported from Fork A via `592aa21` with `parseJsonLoose` exported from `lib/llm/complete.ts`, and `subq-snap.ts`) implement the identical interface — seam contract intact |
| Phase 8 benchmark ↔ Fork A baseline | Runner completeness gate (`lib/decision/benchmark/runner.ts:99-132`) requires identical scenarioCount/attemptCount and zero failures — the measured report satisfies it (30/30 both providers, zero failures, `status: "measured"`); the earlier 24-attempt Fork A baseline mismatch was correctly rejected, then superseded by porting the Nebius provider into Fork B's harness |
| Phase 8 → 9: fail-closed explainability | `components/review/fail-closed-review-block.tsx` (D5) renders the full precomputed decision distribution, never re-classifies (14 tests); `guard-failure-report.tsx` (D6) with dual-audience remediation (14 tests) |
| Phase 9 web mount | Screen 3 `VisualAnalyticsPanel` in `screen-results.tsx` with onSelect row-highlight relay — pinned by `tests/analytics/screen3-mount.test.tsx` (3 tests) |
| Phase 9 PDF mount | `PdfHeatmap` at `pdf-document.tsx:352` (page 1), `PdfTrendCurve` at `:462` (page 2), imports at `:38-39` — pinned by `tests/pdf/pdf-analytics.test.ts` (7 tests) |
| Phase 9 ↔ calc sovereignty | Geometry projects precomputed `evaluate()` outputs only; `lib/calc/`/`lib/criteria/` byte-identical (0-byte diff, both forks) |
| E2E flow | demo fixture → evaluate() → decision provider → verdicts → Screen 3 analytics panel → vector PDF export: all links test-pinned in the green 690/6 suite |

**Integration verdict: verified. No broken flows, no wiring gaps.**

---

## 4. Tech Debt Assessment (all items pre-documented — judged, not discovered)

Per audit instruction, the four known documented limitations were weighed:

| Item | Judgment | Severity | Rationale |
|---|---|---|---|
| Benchmark cost winner `null` (SubQ pricing unpublished) | **Accepted tech debt** | Low | BENCH-03's comparative methodology is fully implemented and priced on the Nebius side; publishing a SubQ number without an authoritative source would violate the repo's no-invented-data invariant. Resolves automatically when docs.subq.ai publishes pricing. |
| Latency-stable / calibration run-dependent | **Accepted tech debt** | Low | Latency winner (subq) reproduced identically on two independent live runs; calibration winner flipped narrowly at n=30. Honest small-n reporting; increase n before drawing calibration conclusions in the submission deck. |
| `next build` blocked by NTFS junction in this worktree | **Debt with a mandatory pre-freeze action** | **Medium** | `tsc --noEmit` + 690/6 are strong operative gates, but the SPEC criterion "builds cleanly (`npm run build`)" is only typecheck-verified in Fork B. Run a full `next build` from the root repo checkout before the submission freeze. |
| Audit-log deep links unwired | **Accepted tech debt** | Low | Presentation-layer enhancement from 09-CONTEXT D6, not a locked 09-SPEC acceptance criterion; remediation guidance is complete as text. |

Additional items surfaced by the audit (per workflow §2 flag and phase verification caveats):

| Item | Judgment | Severity |
|---|---|---|
| No `07-VERIFICATION.md` in Fork A | Process debt — auditor re-executed the gates in lieu (§1); back-fill before complete-milestone | **Medium** |
| `npm run benchmark` script alias missing (BENCH-04 target line) | Debt — capability exists via committed `scripts/system1-benchmark/` harness; artifact measured; add alias | Low-Medium |
| PDF-04 axe scan not executed (no browser in env) | Debt — code-level evidence solid; run axe in CI/browser | Low |
| Live multimodal round-trip not separately exercised | Debt — hermetic fixtures + live text-only contract check | Low |
| Open 08-REVIEW.md advisories (WR-1/2/3, NF-1..4) | Accepted advisories — none violate locked criteria | Low |

---

## 5. Nyquist Compliance

Capability inactive — `gsd_run loop render-hooks verify:post --raw` shows step hooks `secure-phase` and `ui-review` only; no `validate-phase` step hook. Discovery skipped per workflow §5.5. No `*-VALIDATION.md` files exist in any phase directory. No action required for this audit.

---

## 6. FAIL Gate Evaluation

- Unsatisfied requirements: **0 / 24** → FAIL gate not triggered.
- Orphaned requirements: **0** (no v3 IDs exist in the REQUIREMENTS.md traceability table; all 24 are claimed and evidenced in SPEC-plan-verification chain).
- Missing VERIFICATION.md: Phase 7 only — compensated by auditor re-execution; recorded as process debt, not a requirement failure.

## 7. Conclusion

Milestone v3 achieved its definition of done: the `DecisionProvider` seam with two interchangeable System-1 backends (Nebius Nemotron-Lightning, SubQ Snap), 4 fail-closed NDT domain spikes proven on both providers, a measured comparative benchmark (latency winner: SubQ, 5.7× faster at p50; calibration winner: Nebius, narrowly and run-dependently), and shared-geometry visual analytics serialized losslessly into the certified vector PDF — with `lib/calc/` and `lib/criteria/` byte-identical across both forks and 100% of arithmetic in pure TypeScript.

**Verdict: `tech_debt`.** Safe to proceed to `/gsd:complete-milestone v3` after the two Medium actions: (1) run `next build` from the root repo checkout, (2) optionally back-fill `07-VERIFICATION.md` in Fork A.

---

*Audit executed per `~/.zcode/gsd-core/workflows/audit-milestone.md`. Evidence re-executed 2026-10-19, Fork B head `080b6ed`, Fork A head `3b8ba37`.*
