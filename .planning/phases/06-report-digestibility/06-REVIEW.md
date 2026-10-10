---
phase: 06-report-digestibility
reviewed: 2026-10-10T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - lib/report/content.ts
  - components/report/pdf-document.tsx
  - components/report/report-document.tsx
  - components/wizard/findings-brief.tsx
  - components/wizard/screen-results.tsx
  - components/wizard/screen-ingest.tsx
  - lib/demo/demo-scenario.ts
  - lib/demo/fixtures/zenodo-16780668-ut-register-subset.json
  - lib/wizard/reducer.ts
  - app/page.tsx
  - scripts/generate-demo-subset.mjs
  - public/sample-ut-register-subset.csv
  - README.md
  - tests/report/findings-brief.test.ts
  - tests/report/pdf-route.test.ts
  - tests/report/report-preview.test.ts
  - tests/wizard/screen3-brief.test.tsx
  - tests/wizard/reducer.test.ts
  - tests/wizard/flowstep-restyle.test.ts
  - tests/calc/evaluate.demo.test.ts
  - tests/ingest/demo-fixture.test.ts
  - tests/ingest/demo-subset-fixture.test.ts
findings:
  critical: 0
  warning: 1
  info: 5
  total: 6
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-10-10
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Phase 6 adds a deterministic findings brief (content seam + Screen 3 mount), a two-page
PDF executive dashboard, a shared verdict glossary rendered by three surfaces, and a
two-tier demo (420-row WBT-S6 subset default, 4,912-row full register). The
implementation is solid: every CRITICAL INVARIANT holds, the 79 phase-related tests
pass (executed during this review), and the prompt's specific bug hypotheses were
checked and cleared (details below).

**Invariants verified against real code:**

1. **lib/calc / lib/criteria untouched** — the `master..build/phase-6` diff contains
   zero changes under `lib/calc/` or `lib/criteria/`. `content.ts` only *reads*
   `criteria.citations` and reuses `roundTo` — no new math (content.ts:14-18).
2. **No LLM writes the brief** — `buildFindingsBrief` (content.ts:203-278) is a pure
   template over `summary` + `readings`; no Date.now, no random, no store reads.
   `findings-brief.tsx` adds zero copy of its own and imports nothing client-side
   beyond VerdictChip.
3. **Citations inside the allowlist** — all three glossary ids
   (`api574_10_5_1_4`, `api570_7_1_2_governing`, `api570_7_6`) exist in
   `lib/criteria/citations.json` (verified by loading the file); every clause string
   renders via `citationRef`, which emits zero glyphs for unknown ids. No verbatim
   standard text anywhere — cite-don't-quote holds.
4. **Verdict banding untouched** — `lib/calc/verdicts.ts` absent from the diff.
5. **Subset scoping does not leak** — `createDemoSession("subset")` is the default and
   `load-demo` is the primary button path; `load-demo-full` is a distinct reducer
   action wired to a clearly secondary button (screen-ingest.tsx:200-210). Every
   non-demo session-creating path (`ingestCsv`, `loadSample`) spreads `INITIAL_UI`
   (`demoScope: null`) and sets `isDemo: false` (reducer.ts:507, 519, 548), so the
   scope-aware banner (app/page.tsx:109) can never show for an uploaded session, and
   `confirm-replace` correctly resets it.

**Bug hypotheses checked and cleared:**

- **Division by zero / empty readings**: no division exists in any Phase 6 builder;
  `buildCodeBreakdown` sums conditionally. Degenerate zero-total input is pinned by
  test ("All 0 readings meet the code minimum.", findings-brief.test.ts:247-252) and
  is unreachable in production (evaluation of zero rows is gated upstream).
- **null rlYears handling**: both comparators map `null → +Infinity`, i.e. null sorts
  LAST within its class — matching the documented "no computable life, never infinite"
  convention (content.ts:163-165, pdf-document.tsx:119-121). Correct.
- **why-derivation outlier ordering**: the outlier-before-FAIL-branch ordering looks
  suspicious (a FAIL + outlier reading reads "re-shoot candidate" rather than "below
  the minimum") but is the *locked* resolution of the spec's dead-code row —
  06-01-PLAN.md:102 states it verbatim. Not a bug; implementation matches the locked
  table exactly.
- **fail ≤ 3 inline naming**: `worstLocations` is capped at 5 and `compareWorst` ranks
  rejects before re-checks, so when `summary.fail ≤ 3` every failing name is inside
  the cap — `joinNames` can never receive an empty or truncated list on that branch.
- **getTop10Worst stability**: ES2019+ `Array#sort` is stable; the RL-comparator has
  no non-associative edge; the flagged-first slice then RL-sort is deterministic.
  Pinned by pdf-route.test.ts:208-238.
- **react-pdf two-Page validity**: `Page size="A4"`, reused `Text render + fixed`
  footer element, `wrap={false}` rows, percentage widths — all valid react-pdf props;
  `renderToBuffer` smoke-tested in pdf-route.test.ts:261-275.

## Critical Issues

None found.

## Warnings

### WR-01: "ATTENTION — RE-CHECK REQUIRED" PDF banner renders in the ACCEPT/green tone

**File:** `components/report/pdf-document.tsx:170` (see also 164-169, 204-208, 214-216)

**Issue:** `dispositionTone = fail > 0 ? "#991b1b" : "#047857"` gives the re-check
case the same green as "ACCEPTABLE FOR CONTINUED SERVICE". On a certified inspection
report, an attention state sharing the "all clear" color is a misleading severity
signal — the RE-CHECK chip semantics elsewhere in this repo are amber
(verdict-chip.tsx: `text-amber-400`). The comment claims "the existing three-tone
heading" but the implementation is two-tone. (Pre-existing code colored *all* headings
red; this ternary is new and fixed the accept case but not the re-check case.)

**Fix:**

```tsx
const dispositionTone =
  snapshot.summary.fail > 0
    ? "#991b1b" // FAIL — red
    : snapshot.summary.reCheck > 0
      ? "#b45309" // RE-CHECK — amber (matches the RE-CHECK chip)
      : "#047857"; // ACCEPT — green
```

## Info

### IN-01: Two different "worst locations" orderings across HTML brief and PDF top-10

**File:** `lib/report/content.ts:156-166` vs `components/report/pdf-document.tsx:114-123`

**Issue:** The Screen 3 brief orders worst locations immediate-first, then
reject-before-re-check, then RL ascending; the PDF top-10 table orders the same class
of readings by pure RL ascending. The same two readings (e.g. a FAIL with RL 5.0 and a
RE-CHECK with RL 1.0) can appear in opposite relative order across the two
deliverables. Both orderings are locked (UI-6.6 vs UI-6.17) and test-pinned, so this
is a documented-divergence observation, not a defect to fix unilaterally.

**Fix:** If consistency is ever desired, align with the planner before changing
either comparator; otherwise leave as-is (each is spec-locked).

### IN-02: Null-RL comparator duplicated three times

**File:** `lib/report/content.ts:163-165`, `components/report/pdf-document.tsx:94-98` and `119-121`

**Issue:** `const rl = r.rlYears ?? Number.POSITIVE_INFINITY; return rlA - rlB` is
copy-pasted in three places. A future change to the null convention (e.g. "null
first") must be made in three spots.

**Fix:** Export a `compareRlAscending(a, b)` from `lib/report/content.ts` and reuse it
in `getGoverningPdfReadings`/`getTop10Worst` (the PDF already imports the content seam).

### IN-03: Glossary render loop duplicated across the three renderers

**File:** `components/wizard/screen-results.tsx:314-341`, `components/report/report-document.tsx:447-464`, `components/report/pdf-document.tsx:292-303`

**Issue:** All three surfaces map over `VERDICT_GLOSSARY_ORDER`, pull the entry, and
render plain text + a mono `citationRef` sub-line with slightly different markup. The
constant guarantees copy cannot drift, but the structural loop can (e.g. screen-results
renders `citationRef(entry.citationId ?? "")`, the others use the ternary guard —
see IN-04).

**Fix:** Extract one `<VerdictGlossary />` HTML component shared by screen-results and
report-document (the two HTML renderers); the PDF renderer stays separate (react-pdf
element types are incompatible).

### IN-04: Inconsistent citationRef null-idiom in the Screen 3 footer

**File:** `components/wizard/screen-results.tsx:338`

**Issue:** `citationRef(entry.citationId ?? "")` vs the `entry.citationId ? citationRef(...) : ""`
idiom used in report-document.tsx:459 and pdf-document.tsx:299. Behavior is identical
today (`citationRef("")` returns "") because every glossary entry has a non-null id,
but the divergent idiom invites confusion.

**Fix:** Prefer `entry.citationId ? citationRef(entry.citationId) : ""` for uniformity.

### IN-05: Degenerate zero-total brief copy

**File:** `lib/report/content.ts:226`

**Issue:** With `summary.total === 0`, the brief emits "All 0 readings meet the code
minimum." Unreachable in production (evaluation requires ≥ 1 reading; Screen 3's
zero-visible-rows state builds the brief from the *unfiltered* summary) and explicitly
pinned as acceptable by test (findings-brief.test.ts:247-252). Noted only so a future
caller passing empty data doesn't inherit a nonsense sentence silently.

**Fix:** Optionally guard: `total === 0` → a neutral "No readings evaluated." line.

---

_Reviewed: 2026-10-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
