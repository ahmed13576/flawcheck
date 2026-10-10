---
phase: 06-report-digestibility
verified: 2026-10-10T08:53:21Z
status: passed
score: 6/6 must-haves verified
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/ROADMAP.md"
  - ".planning/phases/06-report-digestibility/06-01-PLAN.md"
  - ".planning/phases/06-report-digestibility/06-01-SUMMARY.md"
  - ".planning/phases/06-report-digestibility/06-02-PLAN.md"
  - ".planning/phases/06-report-digestibility/06-02-SUMMARY.md"
  - "README.md"
  - "app/page.tsx"
  - "components/report/pdf-document.tsx"
  - "components/report/report-document.tsx"
  - "components/wizard/findings-brief.tsx"
  - "components/wizard/screen-ingest.tsx"
  - "components/wizard/screen-results.tsx"
  - "lib/demo/demo-scenario.ts"
  - "lib/demo/fixtures/zenodo-16780668-ut-register-subset.json"
  - "lib/report/content.ts"
  - "lib/wizard/reducer.ts"
  - "public/sample-ut-register-subset.csv"
  - "scripts/generate-demo-subset.mjs"
  - "tests/calc/evaluate.demo.test.ts"
  - "tests/ingest/demo-fixture.test.ts"
  - "tests/ingest/demo-subset-fixture.test.ts"
  - "tests/report/findings-brief.test.ts"
  - "tests/report/pdf-route.test.ts"
  - "tests/report/report-preview.test.ts"
covered_digest: "v3:sha256:310a9608e63eba89424d7c3bf74a92b94b13f7b1722f072ef842335f4538d5ac"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "UI-SPEC Design System lock: no new hex values anywhere in Phase 6 surfaces"
    reason: "WR-01 fix (commit 524769f) introduces #b45309 amber for the RE-CHECK PDF disposition tone. The two-tone original gave the RE-CHECK state the same green as all-accept — a misleading severity signal on a certified inspection report. Fix accepted via 06-REVIEW.md findings (critical: 0, warning: WR-01) and explicitly directed by the developer."
    accepted_by: "developer (per 06-REVIEW.md WR-01 disposition)"
    accepted_at: "2026-10-10T00:00:00Z"
---

# Phase 6: Report Digestibility — Verification Report

**Phase Goal:** A human inspector can understand a full evaluation in seconds — the results screen leads with a plain-English summary of what was found and why it matters, and the report presents findings hierarchically (disposition → worst locations → detail) instead of thousands of flat entries
**Verified:** 2026-10-10T14:30:00Z (on branch `build/phase-6`, head 524769f)
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: Results screen leads with a plain-English "What we found" brief (disposition, worst locations, verdict meanings) understandable by a non-NDT reader | ✓ VERIFIED | `lib/report/content.ts:203-278` `buildFindingsBrief` — pure deterministic template over `evaluate()` output (summary + readings), zero `[[cite:` tokens, no LLM/narrative-store/Date.now input (determinism test at `tests/report/findings-brief.test.ts:315`; `[[cite:`-free and "CML"-bar tests at :297/:306). `components/wizard/findings-brief.tsx` renders builder output verbatim (zero own copy); mounted at `screen-results.tsx:239` directly below the hero card and above the KPI "Finding metrics" section (:242), inside the `flex flex-col gap-6` stack, as `section[aria-label="What we found"]` with the locked internal order (text-lg disposition → text-sm next-action → text-sm muted narrative → worst-list `<ul>` ≤ 5 rows of name + VerdictChip + why, rendered only when non-empty). Behavior test-pinned in `tests/wizard/screen3-brief.test.tsx` (position by markup index, DOM order, all-accept absent list). |
| 2 | SC2: The certified PDF leads with an at-a-glance summary a human can verify without scrolling thousands of entries; the register is the detail layer from page 2 | ✓ VERIFIED | `components/report/pdf-document.tsx:191-311` — TWO `<Page size="A4">` elements; page 1 in the locked order: header/meta → disposition banner (WR-01 amber fix :172-176) → executive summary card ("Total readings:" P5 fix :226) → code-breakdown grid (`buildCodeBreakdown`, 6-dp mirrored comparisons) → top-10 table (`getTop10Worst` :114-123 — RL-ascending slice with `rlYears ?? +Infinity` nulls-last) → what-to-do-next → static CSV pointer → glossary footer; page 2+ carries component context, PT/MT triage, the unchanged `getGoverningPdfReadings(snapshot.readings, 100)` register, conclusions, audit, sign-off. Page-number footer node on both pages (:181-189, :310, :468). Every row `wrap={false}`; no `Font.register`; built-in Helvetica/Courier only. Behavior test-pinned: element-tree walk of page-1 order + register-absent-on-page-1 and `%PDF` renderToBuffer smoke test in `tests/report/pdf-route.test.ts`. |
| 3 | SC3: Verdict meaning (ACCEPT / RE-CHECK / FAIL) explained in layman terms with clause sub-lines from the citation allowlist wherever a verdict appears — from one shared constant | ✓ VERIFIED | `VERDICT_GLOSSARY` + `VERDICT_GLOSSARY_ORDER` (`lib/report/content.ts:326-342`) with the locked remapped ids `api574_10_5_1_4` / `api570_7_1_2_governing` / `api570_7_6` — all three confirmed present in the 15-entry `lib/criteria/citations.json`. Rendered by all three surfaces, sub-lines composed ONLY via `citationRef` (zero-glyph on unknown id, no hardcoded clause strings): `screen-results.tsx:317-334` (Screen 3 footer, above mono footnotes), `report-document.tsx:450-460` (conclusions block), `pdf-document.tsx:298-309` (page-1 footer). `verdict-chip.tsx` strings ACCEPT/RE-CHECK/FAIL byte-unchanged (0-line diff vs master). Import graph asserted by tests (`findings-brief.test.ts`, `report-preview.test.ts`, `screen3-brief.test.tsx`). |
| 4 | DEMO-05: Primary one-click demo loads a committed deterministic human-sized subset (WBT-S6, ~420 readings, multi-campaign) through the standard parse path; the full 4,912-row register remains a secondary scale demo with distinguished provenance | ✓ VERIFIED | Committed fixture `lib/demo/fixtures/zenodo-16780668-ut-register-subset.json`: exactly 420 rows, single tank `WBT-S6`, exact six-column schema (verified by direct load). `createDemoSession(scope: "subset" \| "full" = "subset")` (`demo-scenario.ts:110-111`) — identical builder steps both scopes through the unchanged `buildCells` path. `load-demo` → subset (`reducer.ts:556-568`), new `{ type: "load-demo-full" }` → full (`:578-587, :619-620`), both through the same `validateSession` gate; `ui.demoScope` ("subset" \| "full" \| null) set per action. Screen 1: primary accent button label unchanged with locked WBT-S6 explainer (:195), secondary `Load full register (scale demo)` below (:208) with the "4,912 readings" explainer (:211). Scope-aware `DemoBanner` in `app/page.tsx:31-44` (both copies retain "(sample data)"), rendered when `ui.demoScope !== null` (:108). Pinned by `reducer.test.ts:241-283` and `tests/ingest/demo-subset-fixture.test.ts` (all passing). |
| 5 | Invariants: lib/calc/ and lib/criteria/ byte-identical to master; citations only from the 15-entry allowlist; verdict banding untouched | ✓ VERIFIED | `git diff master..build/phase-6 -- lib/calc lib/criteria` — empty; `git status --porcelain -- lib/calc lib/criteria` — empty. All three glossary ids resolve in `citations.json` (15 entries, verified by load). `lib/calc/verdicts.ts` absent from the branch diff — banding untouched. Zero new packages (`git diff master..build/phase-6 -- package.json package-lock.json` empty; generator uses Node built-ins). |
| 6 | Gates: full suite, typecheck, lint, build all green | ✓ VERIFIED | `npx vitest run` → **583 passed \| 5 skipped** (52 files passed, 2 skipped — the pre-existing live-LLM offline skips), matching the SUMMARY claim exactly. `npx tsc --noEmit` → clean. `npm run lint` → 0 errors, 13 pre-existing warnings. `npm run build` → green, all 10 routes compile including `/api/report/pdf`. |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `lib/report/content.ts` | Brief/code-breakdown/glossary/dashboard-copy builders | ✓ VERIFIED | 267 added lines, all exports from the plan present, pure, no "use client", no narrative-store imports |
| `components/report/pdf-document.tsx` | Two-Page document, dashboard page 1 | ✓ VERIFIED | Locked page-1 composition order; register page 2+; WR-01 amber tone applied |
| `components/report/report-document.tsx` | Glossary block in conclusions | ✓ VERIFIED | `aria-label="Verdict glossary"` block after conclusions, citationRef-only sub-lines |
| `components/wizard/findings-brief.tsx` | Presentational brief over the builder | ✓ VERIFIED | Zero own copy; locked markup contract; VerdictChip reused |
| `components/wizard/screen-results.tsx` | Brief mount + glossary footer | ✓ VERIFIED | Mount below hero / above KPIs (:239/:242); footer above mono footnotes (:317-334) |
| `lib/demo/fixtures/zenodo-16780668-ut-register-subset.json` | 420-row committed subset | ✓ VERIFIED | 420 rows, one tank, six columns (direct load verified); test-pinned ≥2 campaigns/CML |
| `lib/wizard/reducer.ts` | demoScope + load-demo-full | ✓ VERIFIED | State field, action union, both loaders wired in the switch |
| `app/page.tsx` | Scope-aware provenance banner | ✓ VERIFIED | Both locked copies with "(sample data)"; render condition `ui.demoScope !== null` |
| `components/wizard/screen-ingest.tsx` | Two-tier demo buttons | ✓ VERIFIED | Primary accent label unchanged; secondary below with secondary-token styling |
| `public/sample-ut-register-subset.csv` + `scripts/generate-demo-subset.mjs` | CSV mirror + generator | ✓ VERIFIED | 421 lines (header + 420 rows); Node built-ins only |
| `README.md` | Demo provenance note | ✓ VERIFIED | 16 lines changed documenting the subset generation |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| findings-brief.tsx | buildFindingsBrief | import from `@/lib/report/content` | WIRED | Renders builder output verbatim — no second copy source |
| screen-results.tsx glossary footer | VERDICT_GLOSSARY | import from `@/lib/report/content` | WIRED | One constant, three renderers, import-graph test-asserted |
| report-document.tsx conclusions | VERDICT_GLOSSARY | import | WIRED | Same |
| pdf-document.tsx page 1 | buildCodeBreakdown / VERDICT_GLOSSARY / builders | import from content seam | WIRED | All dashboard copy via the shared builders |
| Screen 1 primary button | `{ type: "load-demo" }` → `createDemoSession("subset")` | reducer dispatch | WIRED | Same static-import + buildCells path as full register |
| Screen 1 secondary button | `{ type: "load-demo-full" }` → `createDemoSession("full")` | reducer dispatch | WIRED | Secondary styling, below primary |
| app/page.tsx DemoBanner | `state.ui.demoScope` | prop `scope` | WIRED | Subset/full copy distinguished |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| FindingsBrief | summary / readings | `evaluate()` output via Screen 3 props | Yes | ✓ FLOWING |
| PDF dashboard | snapshot.summary / snapshot.readings | session snapshot → `buildPdfDocument` | Yes | ✓ FLOWING |
| Code-breakdown counts | tActualMm vs tPressureMm / tStructuralMm | reading fields emitted by `evaluate()` | Yes | ✓ FLOWING |
| DemoBanner | ui.demoScope | reducer action payloads | Yes | ✓ FLOWING |

No static-return or mock data sources feed any rendered value. The static demo-button explainer counts ("420", "4,912") are intentional static copy whose numbers are pinned by fixture tests — not stubs.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full suite hangs together (all phase pins: determinism, worst-list ordering chain, why-derivation, two-page element-tree walk, top-10 RL ordering, demo scope contracts, fixture pins) | `npx vitest run` | 583 passed, 0 failed, 5 pre-existing skips | ✓ PASS |
| PDF render path survives the two-Page split | renderToBuffer `%PDF` magic-byte test (in suite) | passing | ✓ PASS |
| Subset fixture shape | direct `require` of the fixture JSON | 420 rows, tank `['WBT-S6']`, six-column keys | ✓ PASS |
| Glossary ids in allowlist | direct `require` of citations.json | all 3 ids present in 15-entry list | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| REPT-04 | 06-01, 06-02 | Results screen leads with a plain-English "What we found" brief composed deterministically from engine output — never LLM-generated | ✓ SATISFIED | Truth #1 above |
| REPT-05 | 06-01 | Certified PDF leads with a page-1 executive dashboard; governing register is the detail layer from page 2 | ✓ SATISFIED | Truth #2 above |
| REPT-06 | 06-01, 06-02 | Verdict meaning explained in layman terms with allowlist clause sub-lines at all three surfaces from one shared constant | ✓ SATISFIED | Truth #3 above |
| DEMO-05 | 06-02 | Primary one-click demo = committed deterministic WBT-S6 subset through the standard parse path; full register secondary with distinguished provenance | ✓ SATISFIED | Truth #4 above |

No orphaned requirements — all four Phase 6 requirement IDs from REQUIREMENTS.md appear in the plan frontmatter (`requirements: [REPT-04, REPT-05, REPT-06]` / `[REPT-04, REPT-06, DEMO-05]`).

### Decision Coverage

Decision coverage verify (warning): could not parse decisions — possible format mismatch. The CONTEXT.md `<decisions>` block uses `### N.` heading form rather than the `- **D-NN:**` form the gate parses. Non-blocking; all four locked decisions were manually confirmed honored (brief deterministic template = Decision 1; PDF dashboard page 1 = Decision 2; glossary with remapped ids = Decision 3; two-tier demo with tank-only filter = Decision 4).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | No debt markers (TBD/FIXME/XXX/HACK), no placeholders, no `[[cite:` tokens or Date.now outside invariant-documenting comments | — | — |

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| tests/report/findings-brief.test.ts | REPT-04 | 28 | 0 | No | Value + behavioral (deep-equal determinism, ordering chain, copy contracts) | VALID |
| tests/report/pdf-route.test.ts | REPT-05 | extended | 0 | No | Behavioral (element-tree walk, renderToBuffer, ordering) | VALID |
| tests/report/report-preview.test.ts | REPT-06 | +3 | 0 | No | Value (glossary entries + mono sub-lines) | VALID |
| tests/wizard/screen3-brief.test.tsx | REPT-04/06 | 9 | 0 | No | Behavioral (SSR markup, position by index, DOM order) | VALID |
| tests/wizard/reducer.test.ts | DEMO-05 | re-pointed | 0 | No | Value (rowCount 420/4912, demoScope, gates) | VALID |
| tests/ingest/demo-subset-fixture.test.ts | DEMO-05 | 10 | 0 | No | Value (schema, one tank, ≥2 campaigns, three bands) | VALID |

**Disabled tests on requirements:** 0. **Circular patterns detected:** 0. **Insufficient assertions:** 0.

## Human Verification Required

None required to gate this phase. Every truth carries behavioral test evidence (SSR markup assertions, element-tree walks, deep-equal determinism tests), and the orchestrator's verification contract for this run treats the render-path tests as sufficient. A final visual read of the generated PDF and Screen 3 in a live browser before merging to master is recommended as ordinary diligence, not as a blocking gate.

## Gaps Summary

None. All 6 must-haves verified with codebase evidence on `build/phase-6`. The goal is achieved: the results screen leads with a deterministic plain-English brief, the certified PDF presents disposition → worst locations → detail hierarchically from page 1, the verdict glossary renders everywhere a chip appears from one constant, and the demo story is human-sized by default. One accepted deviation (WR-01 amber tone, `#b45309`) is recorded as an override — it corrects a misleading severity signal identified by code review and improves on the UI-SPEC's color lock.

---

_Verified: 2026-10-10T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
