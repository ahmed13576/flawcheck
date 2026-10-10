---
phase: 06-report-digestibility
plan: 01
subsystem: report-presentation
tags: [findings-brief, pdf-dashboard, verdict-glossary, content-seam, react-pdf]
requires:
  - lib/calc/evaluate.ts (evaluate() output — READ-ONLY composition source)
  - lib/report/content.ts (established content seam — extended additively)
provides:
  - buildFindingsBrief (REPT-04 deterministic plain-English brief engine)
  - buildCodeBreakdown (REPT-05 presentation-level verdict + branch counts)
  - VERDICT_GLOSSARY / VERDICT_GLOSSARY_ORDER (REPT-06 shared glossary constant)
  - buildDispositionBannerSentence / buildWhatToDoNextLine / buildCsvPointerLine
  - getTop10Worst (RL-ascending top-10 slice, nulls last)
  - two-<Page> PDF document (page-1 executive dashboard)
  - HTML report conclusions glossary block
affects:
  - 06-02 (wave 2) imports these exports for the Screen 3 brief mount + demo subset
tech-stack:
  added: [] # zero new packages (locked)
  patterns:
    - pure content-seam builders consumed by two renderers (HTML + react-pdf)
    - citationRef-only clause sub-lines (cite-don't-quote, zero-glyph failure mode)
    - element-tree walk test over the react-pdf React element tree
key-files:
  created:
    - tests/report/findings-brief.test.ts
  modified:
    - lib/report/content.ts
    - components/report/pdf-document.tsx
    - components/report/report-document.tsx
    - tests/report/pdf-route.test.ts
    - tests/report/report-preview.test.ts
decisions:
  - Import-graph assertion sequencing: Task 1's strict per-renderer pin cannot
    pass before Tasks 2/3 create the imports, so Task 1 ships a state-aware
    drift guard and the strict per-renderer pins land with each renderer task
    (pdf-route Task 2, report-preview Task 3). Final contract identical to plan.
  - Disposition inline naming (fail <= 3) lists the failing readings' names in
    worst-list order (immediate first, RL ascending, nulls last).
  - Code-breakdown grid labels "Verdicts" / "vs pressure design (B31.3)" /
    "vs structural minimum (API 574)" per UI-6.16 with en-US counts.
metrics:
  duration: ~9 min
  completed: 2026-10-10
  tasks: 3
  commits: 3
status: complete
actuals:
  tokens: 38000 # ~152k chars over the realized diff
  tasks: 3
  commits: 3
---

# Phase 6 Plan 01: Report Digestibility — Content Seam + PDF Dashboard Summary

Deterministic plain-English findings-brief engine, code-breakdown counts, shared verdict glossary with the locked citation remap, locked dashboard copy builders (all in lib/report/content.ts), the two-<Page> certified PDF split (page-1 executive dashboard, page-2+ register unchanged), and the glossary block in the HTML report conclusions.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Content-seam pure exports — findings brief, code-breakdown, verdict glossary, dashboard copy | 9e0bca9 | lib/report/content.ts, tests/report/findings-brief.test.ts |
| 2 | PDF two-page restructure — page-1 executive dashboard, page-2+ register unchanged | 4e0e5ad | components/report/pdf-document.tsx, tests/report/pdf-route.test.ts |
| 3 | HTML report glossary block + full-suite phase gates | 6172497 | components/report/report-document.tsx, tests/report/report-preview.test.ts |

## Test Counts (before / after)

- Report suites: 58 passing (baseline) → 95 passing (37 new: 28 findings-brief, 6 pdf-route, 3 report-preview).
- Full suite: 513 passing baseline → **550 passed | 5 skipped (pre-existing offline skips)**, 52 files.

## Final Gate Results

- `npx vitest run` — 550 passed, 0 failed (2 files / 5 tests skipped are the pre-existing live-LLM offline skips).
- `npx tsc --noEmit` — clean.
- `npm run lint` — 0 errors (13 pre-existing warnings, none in touched files).
- `npm run build` — green (all routes compile, /api/report/pdf included).
- `git status --porcelain -- lib/calc lib/criteria` — empty (working tree clean for protected trees).
- `git log --oneline master..HEAD -- lib/calc lib/criteria` — 0 commits; `git diff master HEAD -- lib/calc lib/criteria` — empty (byte-identical).
- `git diff master HEAD --stat -- package.json package-lock.json` — empty (zero new packages).

## Locked Contracts Honored

- Brief: deterministic template over `evaluate()` output — zero `[[cite:` tokens, no LLM/telemetry/Date.now input, node-tested for determinism; disposition cites READING counts (never `summary.locations`-as-CMLs; the word "CML" is test-barred from every brief output); worst-list ordering immediate-first → rejects before re-checks → RL ascending → null RL last; cap min(5, non-accept); empty list on all-accept.
- The three canonical copy cases match the UI-SPEC copy contracts verbatim (all-accept collapsed form, mixed narrative clauses, all-fail collapsed form), with en-US formatted counts.
- Glossary: `VERDICT_GLOSSARY` with locked plain sentences and locked remapped ids `api574_10_5_1_4` / `api570_7_1_2_governing` / `api570_7_6`, rendered ONLY via `citationRef` on both the PDF page-1 footer and the HTML conclusions block; chip strings ACCEPT/RE-CHECK/FAIL untouched.
- PDF: two `<Page>` elements, locked page-1 composition order, top-10 slice RL-ascending with nulls last (`getTop10Worst`), page-2+ register ordering untouched (`getGoverningPdfReadings(snapshot.readings, 100)` verbatim), built-in Helvetica/Courier, no Font.register, no new colors/metrics, every table row `wrap={false}`, page-number footer on both pages.
- "Total CMLs:" → "Total readings:" discretionary P5 copy fix applied.

## Deviations from Plan

1. **[Rule 3 — sequencing] Task 1 import-graph assertion split across tasks.** The plan's Task 1 test includes an import-graph assertion that `report-document.tsx` and `pdf-document.tsx` each import `VERDICT_GLOSSARY` from `@/lib/report/content` — but neither import exists until Tasks 2/3 create them, so the strict assertion would fail at Task 1's own verify. Task 1 ships a state-aware drift guard (any renderer referencing `VERDICT_GLOSSARY` must import it from the seam); the strict per-renderer pins land in Task 2 (pdf-route) and Task 3 (report-preview). The final state satisfies the plan's contract exactly.

## Authentication Gates

None encountered.

## Known Stubs

None — no placeholders, no unwired data sources. The CSV pointer is intentionally static text per UI-6.19 (no export endpoint exists this phase; a future plan may add it).

## Self-Check: PASSED

- Created files exist: tests/report/findings-brief.test.ts.
- Modified files committed: lib/report/content.ts, components/report/pdf-document.tsx, components/report/report-document.tsx, tests/report/pdf-route.test.ts, tests/report/report-preview.test.ts.
- All three commit hashes verified on build/phase-6 (9e0bca9, 4e0e5ad, 6172497); no file deletions in any commit.
