---
phase: 03-llm-reasoning-citation-layer
plan: 00
subsystem: gui-design-system
tags: [flowstep, oklch, tailwind-v4, shadcn-primitives, wizard-restyle]
requires: [phase-2 wizard baseline]
provides:
  - Flowstep oklch token system (orange primary, forced dark, light subree opt-in)
  - components/ui primitives (button/badge/card via cva, no radix)
  - lib/utils cn() class-merge helper
  - 4-step indicator with locked Report step (C4)
  - Restyled Screens 1-2 with FS-01..FS-08 pins
  - 25 MB upload cap (MAX_ROWS 50,000 untouched)
  - UNINSTALL.md Phase 3 ledger; phase-start-ref.txt byte-identity baseline
affects: [03-00b (Screen 3 + /report), 03-01..03-05 (build on Flowstep baseline)]
tech-stack:
  added: [class-variance-authority@0.7.1, clsx@2.1.1, lucide-react@0.562.0, tailwind-merge@3.7.0 (^3.4.0), tw-animate-css@1.4.0]
  patterns: [cva variants, token-class composition via cn(), data-appearance theming]
key-files:
  created:
    - lib/utils.ts
    - components/ui/button.tsx
    - components/ui/badge.tsx
    - components/ui/card.tsx
    - tests/wizard/flowstep-restyle.test.ts
    - .planning/phases/03-llm-reasoning-citation-layer/phase-start-ref.txt
  modified:
    - app/globals.css
    - app/layout.tsx
    - app/page.tsx
    - components/wizard/step-indicator.tsx
    - components/wizard/screen-ingest.tsx
    - components/wizard/dropzone.tsx
    - components/wizard/screen-review.tsx
    - components/wizard/column-mapping-panel.tsx
    - components/wizard/parsed-row-table.tsx
    - components/wizard/metadata-form.tsx
    - components/wizard/ptmt-entry.tsx
    - components/wizard/flag-badge.tsx
    - components/wizard/confirm-dialog.tsx
    - components/wizard/unit-segmented.tsx
    - lib/ingest/validate.ts
    - lib/wizard/reducer.ts (Rule 1 copy fix only)
    - tests/wizard/reducer.test.ts
    - package.json / package-lock.json / UNINSTALL.md
    - tsconfig.json (Rule 3: exclude flowstep-gui)
decisions:
  - "Verdict tokens --accept/--recheck/--fail keep Phase-2 hex byte-identically in both appearance blocks (repo-protected semantics)"
  - "Font stacks prepend the existing --font-geist-sans/--font-geist-mono variables before the Flowstep Inter/Geist Mono entries (keeps Phase-1 font wiring, no new font packages)"
  - "Dropzone stays a whole-card <button> (keyboard parity contract) with Browse files as a styled span — mock's separate button would nest a button in a button"
  - "Screen 1 Continue to review dispatches set-screen 2 behind rowsLoaded gating; the reducer's forward-navigation guard makes the click a no-op in the back-nav case (documented stub)"
metrics:
  duration: ~40 min
  completed: 2026-09-27
status: complete
plan_head_before: a1d0b2a946ae7c15700ec8ad2e65b389401b0b35
commits: 4
actuals:
  tokens: 62000
  tasks: 3
  commits: 4
---

# Phase 3 Plan 00: Flowstep Design System Wave 1 Summary

**One-liner:** Flowstep oklch token system (dark chrome + orange primary) with hand-rolled cva primitives, restyled Screens 1-2 with the locked 4-step indicator and 25 MB cap, the 5 approved packages behind the phase's only install checkpoint, and the committed phase-start byte-identity ref.

## What Was Built

- **Task 1 (checkpoint, approved):** recorded the phase-start SHA (`a1d0b2a`) in phase-start-ref.txt BEFORE any phase change, then installed the 5 user-approved Flowstep packages (registry-verified canonical maintainers, 0 vulnerabilities) and ledgered the full Phase 3 section in UNINSTALL.md (provenance, registry findings table, resolved versions, disk footprint ~44.2M, removal commands).
- **Task 2:** globals.css replaced the Phase-2 hex baseline with the complete orange.css token set (light + `[data-appearance="dark"]` blocks, @theme inline mappings, radius/font stacks, tw-animate-css import, @custom-variant dark) — verdict tokens preserved byte-identically and mapped to `--color-accept/recheck/fail`; html carries `data-appearance="dark"`; cn() helper; button/badge/card primitives via cva with NO radix.
- **Task 3:** Screens 1-2 restyled per the mocks — Screen 1 (mock h1/subheading, dropzone with lucide Upload + "CSV up to 25 MB" copy, reassurance row, orange "Explore a sample inspection", mono provenance line, Back/Continue footer); Screen 2 (hero card + real-state status chips, ALL SIX mapping targets kept, COMPONENT GEOMETRY/CLASSIFICATION/DESIGN CONDITIONS headers, unit toggle top-right, footer with live blocker summary); 4-step indicator with locked/greyed Step 4 Report (never aria-current, binding C4); MAX_FILE_BYTES 5→25 MB with MAX_ROWS 50,000 untouched; FS-01..FS-08 pinned by tests/wizard/flowstep-restyle.test.ts (react-dom/server SSR).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tsconfig excludes flowstep-gui/**
- **Found during:** Task 2
- **Issue:** `npm run typecheck` failed — the flowstep-gui reference projects (react-router-dom/vite imports) are picked up by tsconfig's `**/*.ts(x)` include.
- **Fix:** added `"flowstep-gui"` to tsconfig exclude.
- **Files modified:** tsconfig.json
- **Commit:** 5741fde

**2. [Rule 1 - Bug] Reducer parse-too-large message derived from MAX_FILE_BYTES**
- **Found during:** Task 3
- **Issue:** with the cap raised, lib/wizard/reducer.ts:619's hardcoded "The limit is 5 MB." user-facing message became a lie (the plan's own fails_when: "the 25 MB cap is not active"). The plan's `git diff lib/wizard/reducer.ts empty` verification intended contract-preservation; the one-line copy fix (message derives from MAX_FILE_BYTES; comment updated) changes no action, state shape, or contract.
- **Fix:** message now interpolates `MAX_FILE_BYTES / (1024 * 1024)`; cap test updated to a 26 MB payload expecting "26.0 MB"/"25 MB" (plan-authorized "update any test asserting the 5 MB limit").
- **Files modified:** lib/wizard/reducer.ts, tests/wizard/reducer.test.ts
- **Commit:** 0b1f9bf

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Screen 1 "Continue to review" click is a no-op when rows are loaded via back-nav | components/wizard/screen-ingest.tsx | footer button | The reducer's set-screen forward-navigation guard (lib/wizard/reducer.ts:650, protected contract "set-screen back-nav only") ignores forward navigation; forward nav remains parse/demo-success-driven. The button renders per the mock and is disabled until rows load (existing gating); the plan forbids reducer changes this task. 03-04/03-05 integration may revisit. |

## Verification Results

- `npx vitest run`: **291 passed / 4 skipped** (280 baseline + 11 new FS pins; cap test updated per plan) — green
- `npm run typecheck && npm run build`: green; html carries data-appearance="dark"
- `npm ls` of the five packages: all resolve; UNINSTALL.md Phase 3 section complete
- Verdict chip TEXT, aria inventory (aria-live/invalid/describedby/pressed/modal/current), data-screen-heading hooks: grep-verified unchanged
- Flowstep visual contract FS-01..FS-08 implemented and pinned (FS-09..FS-12 → 03-00b)

## Self-Check: PASSED

- phase-start-ref.txt committed (17cdb7b) with pre-install SHA a1d0b2a — verified
- All 4 commits present in git log since plan_head_before — verified
- 291-test suite green on token classes — verified
