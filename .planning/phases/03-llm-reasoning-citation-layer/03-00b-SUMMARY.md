---
phase: 03-llm-reasoning-citation-layer
plan: 00b
subsystem: gui-design-system
tags: [flowstep, screen-3, report-preview, sticky-columns, session-snapshot, fs-contract]
requires: [03-00 (Flowstep token system + primitives)]
provides:
  - Restyled Screen 3 with real-data KPI cards, All findings/Needs attention tabs, CML search, legend, sticky summary strip
  - Sticky CML/Location + Verdict cluster inside the preserved overflow-x-auto wrapper (03-01 extends to 11 columns)
  - lib/report/session-snapshot.ts (sessionStorage flawcheck:report-snapshot:v1, defensive parse, session-only)
  - Locked /report preview route (Screen 4) rendering real session data under data-appearance="light"
  - Full FS-01..FS-12 visual-contract pins (03-05 sweeps the ids)
  - verdictLabel() additive export (verdict TEXT source for non-chip surfaces)
affects: [03-01 (Reasoning column extends the sticky cluster), 03-02..03-04 (reasoning layer), 03-05 (FS sweep)]
tech-stack:
  added: []
  patterns: [sticky-cluster C1/C3, session-only snapshot, allowlist citation renderer, data-appearance="light" subtree]
key-files:
  created:
    - lib/report/session-snapshot.ts
    - app/report/page.tsx
    - components/report/report-document.tsx
    - tests/report/report-preview.test.ts
  modified:
    - components/wizard/screen-results.tsx
    - components/wizard/summary-strip.tsx
    - components/wizard/results-table.tsx
    - components/wizard/ptmt-triage-list.tsx
    - components/wizard/verdict-chip.tsx (additive verdictLabel export only)
    - app/page.tsx (auto-write snapshot effect)
    - tests/wizard/flowstep-restyle.test.ts
decisions:
  - "Tab/search filters are LOCAL component state composing through filterReadings(); the reducer is untouched — filter changes reset pagination via the exported FILTER_RESET_PAGE constant (node suite pins the contract without DOM events)"
  - "ReportDocument renders ONLY serialized session slices + citations.json record fields (T-03-21 mitigation); conclusions are a deterministic Phase-3 placeholder list Phase 4 replaces with narrative-driven conclusions"
  - "citationRef() composes 'code §clause' from citations.json record fields only — unknown id renders zero glyphs; re-inspection rule id api570_6_3_3_halflife grounded in lib/calc/evaluate.ts, clause string never hardcoded"
  - "Report verdict text reuses verdictLabel() from verdict-chip.tsx (additive export, chip classes untouched) so ACCEPT/RE-CHECK/FAIL has exactly one source"
  - "Open report preview disabled now (aria-disabled + sr-only 'Report generation unlocks in Phase 4' hint); Phase 4 enables it and owns generation"
metrics:
  duration: ~2 sessions (prior session died on provider captcha mid-Task 1; resumed cleanly from disk state)
  completed: 2026-09-28
status: complete
plan_head_before: 80b53747d5b9772aa8b4c082e29c5bb9967c7780
commits: 2
actuals:
  tokens: 58000
  tasks: 2
  commits: 2
---

# Phase 3 Plan 00b: Flowstep GUI Wave 2 — Screen 3 + Locked /report Preview Summary

**One-liner:** Screen 3 restyled to the Flowstep mock with real-data KPI cards, tabs/search/legend, and the sticky CML+Verdict cluster 03-01 extends; the locked /report preview renders real session data as a warm-paper document with generation gated to Phase 4; the complete FS-01..FS-12 visual contract is pinned.

## What Was Built

- **Task 1:** Screen 3 per Screen 3.png — hero card ("Evaluation complete" / "Your findings are ready" with the REAL total), 4 KPI stat cards fed only by `results.summary` (mock placeholders 3,812/876/224/42 can never render — test-pinned), All findings / Needs attention tabs + CML search as LOCAL state (reducer untouched; `filterReadings`/`needsAttention` exported pure), legend, sticky summary strip from real counts, results table tokenized with the sticky CML/Location (left) + Verdict (right) cluster on opaque token backgrounds inside the preserved overflow-x-auto wrapper, PT/MT "Recommended next step" cards (arrow circle, verdict chip right, mono clause line), footer with "Open report preview" DISABLED (aria-disabled + sr-only hint). `lib/report/session-snapshot.ts` (writeReportSnapshot/readReportSnapshot over sessionStorage `flawcheck:report-snapshot:v1`, defensive shape-checked parse, SSR-safe no-ops) wired via an auto-write effect in the wizard root + the Save review button (transient "Saved — this session only"). FS-09/FS-10/FS-10b/FS-11 pinned.
- **Task 2:** `/report` locked preview per Screen 4.png — `app/report/page.tsx` reads the snapshot on mount and redirects to `/` when absent; `ReportDocument` renders the `data-appearance="light"` paper document from ONLY serialized session slices: banner, PENDING INSPECTOR SIGN-OFF chip, GENERATED/SOURCE/EVALUATION DATE meta, component context grid (formatFixed numerics), CML measurements table ("—" nulls, G14-safe), PT/MT indication table, clause-cited conclusions (deterministic placeholder list, one line per non-ACCEPT reading/indication, each ending in a record-derived clause ref), next-inspection callout (earliest date + "Rule applied: API 570 §6.3.3" from the api570_6_3_3_halflife record), non-functional disabled sign-off, verbatim disclaimer, Download PDF/Print DISABLED with zero PDF/print CSS (source-scanned by test). FS-12 pinned in the new report-preview suite + the FS-01..FS-12 full-contract sweep named test added for 03-05.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] session-snapshot.ts metadata cast rejected by tsc**
- **Found during:** Task 1 verification (typecheck)
- **Issue:** `metadata as ComponentMetadata` failed TS2352 — `Record<string, unknown>` does not sufficiently overlap the 15-field interface for a direct cast.
- **Fix:** cast through `unknown` (`metadata as unknown as ComponentMetadata`); the defensive shape check above the cast is unchanged.
- **Files modified:** lib/report/session-snapshot.ts
- **Commit:** 13eff0d

### Notes

- In-flight session recovery: the prior executor session died (provider captcha) with Task 1 partially on disk (screen-results.tsx + summary-strip.tsx modified, session-snapshot.ts written but untracked). Resumed by assessing the on-disk state against the plan, completing the remaining Task 1 files (results-table, ptmt-triage-list, app/page.tsx, FS-09..FS-11 pins), and committing atomically.
- verdict-chip.tsx carries an ADDITIVE export (`verdictLabel`) beyond the plan's file list — needed so the report's verdict text shares the chip's exact ACCEPT/RE-CHECK/FAIL strings without duplicating the mapping (plan: "reuse the constants, do not restyle this file" — no classes touched).

## Auth Gates

None.

## Known Stubs

- **Clause-cited conclusions are a Phase-3 placeholder list** (components/report/report-document.tsx, `buildConclusions`): deterministic one-line summaries per non-ACCEPT reading/indication. Intentional per plan ("this is the Phase-3 placeholder list — Phase 4 replaces it with narrative-driven conclusions").
- **Open report preview / Download PDF / Print report are disabled** — the locked decision; Phase 4 owns generation.

## Self-Check: PASSED

- 13eff0d, 7c7ec18 present on build/phase-3 (`git log` verified)
- Created files exist: app/report/page.tsx, components/report/report-document.tsx, lib/report/session-snapshot.ts, tests/report/report-preview.test.ts
- Full hermetic suite 314 passed / 4 skipped (baseline 280 → +34); typecheck + build green (/report prerenders)
- `git diff lib/wizard/reducer.ts` empty; `git diff lib/calc lib/criteria` empty
