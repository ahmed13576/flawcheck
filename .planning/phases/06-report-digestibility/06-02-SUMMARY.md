---
phase: 06-report-digestibility
plan: 02
subsystem: wizard-presentation
tags: [findings-brief, verdict-glossary, demo-subset, two-tier-demo, provenance-banner]
requires:
  - lib/report/content.ts (06-01 seam: buildFindingsBrief, VERDICT_GLOSSARY, VERDICT_GLOSSARY_ORDER, citationRef — imported, never modified)
  - lib/ingest/csv.ts (buildCells — the unchanged parse path both demo scopes share)
provides:
  - components/wizard/findings-brief.tsx (presentational brief over the 06-01 builder)
  - Screen 3 glossary footer (VERDICT_GLOSSARY renderer #1 of 3 — import graph complete)
  - createDemoSession(scope: "subset" | "full") with committed deterministic WBT-S6 subset fixture
  - { type: "load-demo-full" } action + ui.demoScope ("subset" | "full" | null)
  - Screen 1 two-tier demo buttons + scope-aware provenance banner
  - public/sample-ut-register-subset.csv (manual-upload mirror) + scripts/generate-demo-subset.mjs
affects:
  - /report + PDF renderers already consume the same VERDICT_GLOSSARY (06-01); all three renderers now assert one constant
tech-stack:
  added: [] # zero new packages (generator uses Node built-ins only)
  patterns:
    - presentational component renders pure-builder output verbatim (zero second copy source)
    - scope parameter with identical builder steps (no special-casing — same buildCells path)
    - observed-value pinning (Phase 2 precedent) for the subset verdict split
key-files:
  created:
    - components/wizard/findings-brief.tsx
    - scripts/generate-demo-subset.mjs
    - lib/demo/fixtures/zenodo-16780668-ut-register-subset.json
    - public/sample-ut-register-subset.csv
    - tests/wizard/screen3-brief.test.tsx
    - tests/ingest/demo-subset-fixture.test.ts
  modified:
    - components/wizard/screen-results.tsx
    - components/wizard/screen-ingest.tsx
    - app/page.tsx
    - lib/demo/demo-scenario.ts
    - lib/wizard/reducer.ts
    - README.md
    - tests/wizard/flowstep-restyle.test.ts
    - tests/wizard/reducer.test.ts
    - tests/calc/evaluate.demo.test.ts
    - tests/ingest/demo-fixture.test.ts (scope args only — see deviations)
decisions:
  - DemoBanner exported as a prop-driven component (scope: "subset" | "full") so the
    node test-suite can pin both banner strings via SSR markup; the render
    condition (ui.demoScope !== null) lives in WizardRoot.
  - citationRef called with (entry.citationId ?? "") at the Screen 3 footer — the
    glossary entry type carries string | null and lib/report/content.ts stays untouched.
  - The wizard-context compactDemo re-hydration path re-hydrates via load-demo
    (now the subset). demoScope rides in the restored ui JSON, so fresh sessions
    are consistent; a stale pre-06-02 sessionStorage payload may restore a
    subset-count session with a full-register banner — an accepted hydration
    edge outside this plan's files_modified list.
metrics:
  duration: ~22 min
  completed: 2026-10-10
  tasks: 3
  commits: 3
status: complete
plan_head_before: 19b5f7b
actuals:
  tokens: 40000 # ~160k chars over the realized diff (fixture JSON dominates)
  tasks: 3
  commits: 3
---

# Phase 6 Plan 02: Report Digestibility — Screen 3 Brief Mount + Two-Tier Demo Summary

The Screen 3 "What we found" brief (verbatim over the 06-01 pure builder) with the shared verdict-glossary footer, and the reshaped demo composition: a committed deterministic WBT-S6 subset (420 readings, one tank, every CML multi-campaign) as the primary one-click demo with the full 4,912-row register demoted to the secondary "Load full register (scale demo)" path behind a scope-aware provenance banner.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | FindingsBrief component + Screen 3 mount + glossary footer | 44cbce3 | components/wizard/findings-brief.tsx, components/wizard/screen-results.tsx, tests/wizard/screen3-brief.test.tsx |
| 2 | WBT-S6 demo subset — generator, committed fixture, scoped demo session, reducer action | e24522a | scripts/generate-demo-subset.mjs, lib/demo/fixtures/zenodo-16780668-ut-register-subset.json, public/sample-ut-register-subset.csv, lib/demo/demo-scenario.ts, lib/wizard/reducer.ts, README.md, tests/ingest/demo-subset-fixture.test.ts, tests/wizard/reducer.test.ts, tests/calc/evaluate.demo.test.ts, tests/ingest/demo-fixture.test.ts |
| 3 | Screen 1 two-tier demo buttons + scope-aware provenance banner + full-suite phase gates | 915f70d | components/wizard/screen-ingest.tsx, app/page.tsx, tests/wizard/flowstep-restyle.test.ts, tests/ingest/demo-subset-fixture.test.ts (lint cleanup) |

## Test Counts (before / after)

- Touched suites: screen3-brief (new, 9 tests), flowstep-restyle 20 → 25, reducer.test.ts re-pointed subset contract + new load-demo-full describe, evaluate.demo.test.ts full pins verbatim + parallel subset block, demo-subset-fixture (new, 10 tests), demo-fixture pins verbatim (scope args only).
- Full suite: 550 passed (06-01 baseline) → **583 passed | 5 skipped (pre-existing live-LLM offline skips)**, 52 test files passed | 2 skipped.

## Final Gate Results

- `npx vitest run` — 583 passed, 0 failed (2 files / 5 tests skipped are the pre-existing live-LLM offline skips).
- `npx tsc --noEmit` — clean.
- `npm run lint` — 0 errors (13 pre-existing warnings, none remaining in touched files).
- `npm run build` — green (all routes compile, /api/report/pdf included).
- `git status --porcelain -- lib/calc lib/criteria` — empty.
- `git diff 19b5f7b..HEAD -- lib/demo/fixtures/zenodo-16780668-ut-register.json` — empty (full fixture byte-identical through this plan).
- Zero new packages: generator uses Node built-ins only; `package.json`/`package-lock.json` untouched.

## Locked Contracts Honored

- Brief: mounted as `section[aria-label="What we found"]` DIRECTLY below the hero card and ABOVE the "Finding metrics" KPI cards inside the gap-6 stack; internal order disposition (`text-lg font-semibold`) → next-action (`text-sm font-semibold`) → narrative (`text-sm text-muted-foreground`) → worst-list `<ul>` (≤ 5 one-line rows: `font-mono text-sm truncate` + `title` name, repo-protected VerdictChip, muted why). Zero own copy — `buildFindingsBrief` output rendered verbatim; zero `[[cite:` tokens; no narrative-store/telemetry/wall-clock input (source-scan asserted).
- Glossary footer: beneath the results table (renders on the zero-results path too), above the mono footnotes; ACCEPT/RE-CHECK/FAIL order with legend dot classes, real text (no tooltips), clause sub-lines composed ONLY via `citationRef` (`API 574 §10.5.1.4` / `API 570 §7.1.2` / `API 570 §7.6`). Three-renderer import graph complete: screen-results + report-document + pdf-document all import `VERDICT_GLOSSARY` from the content seam.
- Subset fixture: 420 rows, one tank (WBT-S6), exact six-column schema, 40 CMLs each with ≥ 2 distinct campaigns (min observed 4 — tank-identity filter ONLY, never date-filtered), thickness range straddles the DEMO_METADATA band edges (min < 19.85, max ≥ 19.95), all three verdict bands present (observed 22 / 53 / 345), CSV mirror pinned field-for-field to the JSON fixture.
- Full-register pins (301 / 538 / 4,073 split, 480 first-campaign insufficient-history, 4,912 end-to-end) stay VERBATIM under `load-demo-full` / `createDemoSession("full")`.
- Screen 1: primary accent button label unchanged, locked WBT-S6 explainer copy; secondary button with the exact secondary-token class string (never `bg-primary`), muted explainer; both disabled while parsing; both zero-network through the same static-import + `validateSession` gate.
- Provenance banner: subset vs full copies, both retaining "(sample data)", persists on Screens 2–3.

## Deviations from Plan

1. **[Rule 3 — blocking] tests/ingest/demo-fixture.test.ts: explicit scope args.** The plan states this file "stays untouched", but its two `createDemoSession()` calls (4,912-row pins) hit the new `subset` DEFAULT and would fail at Task 2's own verify (`npx vitest run tests/ingest/demo-fixture.test.ts`). Minimal fix: pass `createDemoSession("full")` at both call sites (2 lines + a comment). Every pin in the file is verbatim; the fixture-level describe blocks were not touched. The plan's intent — the full contract pinned under the full scope — is exactly preserved.
2. **[Rule 2 — lint floor] tests/ingest/demo-subset-fixture.test.ts unused-destructure cleanup.** `npm run lint` flagged a new unused `cml` binding (Task 3's gate is 0 errors and the file was in this plan's scope); replaced the destructured loop with `campaignsByCml.values()`.

## Authentication Gates

None encountered.

## Known Stubs

None — no placeholders, no unwired data sources. The secondary explainer "4,912 readings" and the primary explainer "420 real readings" are intentionally static copy whose counts are pinned by the committed-fixture tests (UI-6.21/UI-6.22 contract).

## Self-Check: PASSED

- Created files exist: components/wizard/findings-brief.tsx, scripts/generate-demo-subset.mjs, lib/demo/fixtures/zenodo-16780668-ut-register-subset.json, public/sample-ut-register-subset.csv, tests/wizard/screen3-brief.test.tsx, tests/ingest/demo-subset-fixture.test.ts.
- All three commit hashes verified on build/phase-6 (44cbce3, e24522a, 915f70d); measured commit count from ledger 19b5f7b..HEAD = 3; no file deletions in any commit.
