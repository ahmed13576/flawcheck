---
phase: 06-report-digestibility
reviewed: 2026-10-10T10:00:00Z
depth: deep
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
  - components/wizard/wizard-context.tsx
  - app/page.tsx
  - scripts/generate-demo-subset.mjs
  - public/sample-ut-register-subset.csv
  - lib/criteria/citations.json
  - .gitattributes
  - tests/report/findings-brief.test.ts
  - tests/report/pdf-route.test.ts
  - tests/report/report-preview.test.ts
  - tests/wizard/screen3-brief.test.tsx
  - tests/wizard/reducer.test.ts
  - tests/ingest/demo-subset-fixture.test.ts
  - tests/calc/evaluate.demo.test.ts
findings:
  critical: 5
  warning: 9
  info: 6
  total: 20
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-10-10T10:00:00Z  
**Depth:** deep  
**Files Reviewed:** 22  
**Status:** issues_found  

## Summary

An adversarial, hostile code review of Phase 6 deliverables and their integration points with Phases 1–5 was conducted across all five core deliverable surfaces:
1. **Plain-English findings brief** (`lib/report/content.ts`, `components/wizard/findings-brief.tsx`)
2. **Two-page PDF executive dashboard** (`components/report/pdf-document.tsx`, 3-tone disposition banner, `getTop10Worst`, repeating headers, column widths)
3. **Verdict glossary** (`VERDICT_GLOSSARY` in `lib/report/content.ts`, allowlist citation mapping, and rendering across Screen 3, HTML report, and PDF Page 1)
4. **Two-tier demo loader** (`lib/demo/demo-scenario.ts`, 420-row subset vs 4,912-row full register, `ui.demoScope` state transitions, session re-hydration, and wizard navigation)
5. **`.gitattributes` LF normalization** and cross-platform line-ending handling

### Overall Assessment
While Phase 6 successfully separated the PDF into a Page 1 dashboard and Page 2+ register, added deterministic findings briefs, and constructed the 420-reading WBT-S6 demo subset, an adversarial examination disproves earlier complacent assessments. Prior reviews overlooked deep algorithmic flaws, cross-method safety blind spots, state corruption on re-hydration, and dead user interface controls because existing tests asserted only superficial invariants (e.g. testing that a returned array was sorted without verifying if it contained the actual worst readings, or testing demo loading without testing session restore after visiting `/report`).

A total of **20 actionable defects** were discovered and classified:
- **5 Critical Issues**: Algorithm failure in `getTop10Worst` silences critical defects beyond index 10; NDE multi-method blind spot in PDF executive banner certifies pipes with weld cracks as acceptable; full scale-demo state silently downgrades to 420 rows on session re-hydration; "Continue to review" button on Screen 1 is a dead no-op; and missing `fixed` attribute on Page 2+ PDF table header leaves unlabelled data columns on multi-page reports.
- **9 Warnings**: Verdict glossary on PDF Page 1 defines anonymous terms without verdict tokens; `joinNames` emits `", and undefined"` on empty arrays; missing deduplication in failing location names; outlier flag masks structural/pressure failure reasons in `whyFor`; citation semantic mismatch for RE-CHECK (`api570_7_1_2_governing`); IEEE 754 `NaN` sort hazard on multiple null remaining life readings; table column widths misaligned (70% on Page 1, 105% on Page 2); next inspection date callout cites wall-thickness design formula instead of API 570 §6.3.3; and incomplete `.gitattributes` coverage.
- **6 Informational Findings**: Degenerate zero-total state emits affirmative certification; public sample CSV download links to 6-row tracer instead of 420-row demo mirror; empty `<p>` and `<Text>` DOM nodes on null citations; singular/plural grammar defects; CSS Flexbox truncation failure in `BriefList`; and lack of demo watermark on exported PDF reports.

---

## Critical Issues

### CR-01: Pre-sort Truncation in `getTop10Worst` Silences Critical Defects Beyond Row 10
- **File:** `components/report/pdf-document.tsx:103, 117-123`
- **Deliverable:** Surface 2 (Two-Page PDF Executive Dashboard)
- **Issue:**  
  `getTop10Worst(readings)` calls `getGoverningPdfReadings(readings, 10)`. Inside `getGoverningPdfReadings`, `flagged` readings (recheck, reject, immediate_inspection) are filtered from the input array in raw file order and combined with non-flagged readings before being sliced to `limit` (`combined = [...flagged, ...selectedOthers].slice(0, limit)`).  
  `flagged` is **never sorted prior to slicing**. If a dataset contains more than 10 flagged readings (e.g. 15 failing CMLs), `combined` captures only the first 10 flagged readings encountered in the CSV. `getTop10Worst` then sorts only those 10 captured readings by remaining life (`rlYears`).  
  If reading index 11 is an imminent blowout hazard (`rlYears = 0.05` years, `flags: ["immediate_inspection"]`) while readings 0–9 have `rlYears = 15.0` years, reading index 11 is **silently discarded** before sorting. The certified PDF Page 1 executive summary reports readings with 15 years of remaining life as the "Top 10 Worst Locations" while completely hiding imminent safety failures.  
  *(Note: In contrast, Surface 1's `buildFindingsBrief` in `lib/report/content.ts:214-217` correctly sorts ALL candidate non-accept readings by `compareWorst` before calling `.slice(0, 5)`.)*
- **Why Existing Tests Missed It:**  
  In `tests/report/pdf-route.test.ts:182-205`, the test fixture defined 12 readings where reading `r-11` (index 10) had `rlYears: 3` and reading `r-1` (index 0) had `rlYears: 12`. The function dropped `r-11` and kept `r-1`. The test only asserted that the resulting 10 rows were sorted relative to each other (`toBe([...nonNull].sort())`), failing to assert whether the rows were the true 10 lowest RL readings from the input.
- **Reproduction:**  
  Pass a 12-reading snapshot where readings 0–9 have `rlYears = 10` and reading 10 has `rlYears = 0.1` (`verdict: "reject"`). Reading 10 is omitted from `getTop10Worst(readings)`.
- **Fix:**  
  Sort all candidate flagged readings by severity and remaining life *before* slicing to 10:
  ```tsx
  export function getTop10Worst(
    readings: ReportSnapshot["readings"],
  ): ReportSnapshot["readings"] {
    const flagged = readings.filter(
      (r) =>
        r.verdict === "reject" ||
        r.verdict === "re_check" ||
        r.flags.includes("immediate_inspection"),
    );
    const pool = flagged.length >= 10 ? flagged : readings;
    return [...pool]
      .sort((a, b) => {
        const aImm = a.flags.includes("immediate_inspection") ? 0 : 1;
        const bImm = b.flags.includes("immediate_inspection") ? 0 : 1;
        if (aImm !== bImm) return aImm - bImm;
        const aRej = a.verdict === "reject" ? 0 : 1;
        const bRej = b.verdict === "reject" ? 0 : 1;
        if (aRej !== bRej) return aRej - bRej;
        const rlA = a.rlYears ?? Number.POSITIVE_INFINITY;
        const rlB = b.rlYears ?? Number.POSITIVE_INFINITY;
        return rlA - rlB;
      })
      .slice(0, 10);
  }
  ```

---

### CR-02: Disposition Banner and Executive Summary Blind to PT/MT Weld Inspection Rejects
- **File:** `components/report/pdf-document.tsx:164-176, 210-213, 220-222, 292`
- **Deliverable:** Surface 2 (Two-Page PDF Executive Dashboard)
- **Issue:**  
  `dispositionHeading`, `dispositionTone`, `buildDispositionBannerSentence`, and `buildWhatToDoNextLine` evaluate strictly `snapshot.summary.fail` and `snapshot.summary.reCheck`:
  ```tsx
  const dispositionHeading =
    snapshot.summary.fail > 0
      ? "ACTION REQUIRED — DEFECTS DETECTED"
      : snapshot.summary.reCheck > 0
        ? "ATTENTION — RE-CHECK REQUIRED"
        : "ACCEPTABLE FOR CONTINUED SERVICE";
  ```
  `snapshot.summary` is derived in `lib/calc/evaluate.ts:222-230` exclusively from ultrasonic wall-thickness readings (`readings`), ignoring `snapshot.indications` (PT/MT).  
  When an asset has passing UT wall thickness (`fail === 0, reCheck === 0`), but `snapshot.indications` contains an active linear crack (e.g. `morphology: "linear"`, `lengthMm: 45`, `verdict: "reject"` per ASME B31.3 §344.4.2):
  1. The banner renders in bright GREEN (`#047857`).
  2. The banner title proclaims: `ACCEPTABLE FOR CONTINUED SERVICE`.
  3. The banner text states: `All X readings meet the code minimum — acceptable for continued service.`
  4. What-to-do-next advises: `continue the established inspection interval`.  
  Under API 570 §5 and ASME B31.3 Chapter VI, overall in-service piping disposition is governing across all inspection methods. Issuing a certified green report declaring "Acceptable for continued service" when a crack exists in the piping weld violates engineering standards and creates severe operational hazard.
- **Reproduction:**  
  Create a snapshot where all UT readings are `accept`, but `indications` contains `[{ method: "PT", morphology: "linear", lengthMm: 20, verdict: "reject" }]`. PDF Page 1 generates with a green "ACCEPTABLE FOR CONTINUED SERVICE" banner.
- **Fix:**  
  Evaluate overall disposition across both UT summary and PT/MT indications:
  ```tsx
  const hasFail =
    snapshot.summary.fail > 0 ||
    snapshot.indications.some((i) => i.verdict === "reject");
  const hasReCheck =
    snapshot.summary.reCheck > 0 ||
    snapshot.indications.some((i) => i.verdict === "re_check");
  const dispositionTone = hasFail
    ? "#991b1b"
    : hasReCheck
      ? "#b45309"
      : "#047857";
  const dispositionHeading = hasFail
    ? "ACTION REQUIRED — DEFECTS DETECTED"
    : hasReCheck
      ? "ATTENTION — RE-CHECK REQUIRED"
      : "ACCEPTABLE FOR CONTINUED SERVICE";
  ```

---

### CR-03: Full Scale-Demo State Silently Downgrades to 420-Row Subset on Session Re-hydration
- **File:** `components/wizard/wizard-context.tsx:50-61`
- **Deliverable:** Surface 4 (Two-Tier Demo Loader)
- **Issue:**  
  To conserve `sessionStorage` quota, demo sessions are serialized compactly with `__compactDemo: true` (stripping row arrays). On re-hydration, `getInitialState()` checks `parsed?.__compactDemo`:
  ```typescript
  if (parsed?.__compactDemo) {
    const demoBase = wizardReducer(createInitialState(), { type: "load-demo" });
    const evaluated = wizardReducer(demoBase, { type: "run-evaluation" });
    return {
      ...evaluated,
      ui: { ...evaluated.ui, ...(parsed.ui ?? {}) },
      ptmt: parsed.ptmt ? { ...evaluated.ptmt, ...parsed.ptmt } : evaluated.ptmt,
    };
  }
  ```
  Line 54 hardcodes `{ type: "load-demo" }` (which loads the **420-row subset**), regardless of whether the user had loaded the subset or the full register!  
  Line 58 then merges `parsed.ui`, restoring `ui.demoScope: "full"` and `screen: 3`.  
  **Observed Result:**
  - `state.ui.demoScope` is `"full"`.
  - The banner renders: `"Demo scenario loaded — Zenodo record 16780668 full register (sample data)"`.
  - BUT `state.rows`, `state.csv.rowCount`, and `state.results` contain only **420 readings** (22 accept, 53 re-check, 345 fail, 1 location)!
  - Screen 3 displays the 420-row subset results under a banner claiming it is the 4,912-row full register (which actually has 301 accept, 538 re-check, 4,073 fail across 12 tanks).
- **Reproduction:**  
  1. Click "Load full register (scale demo)" on Screen 1 (`load-demo-full`, 4,912 rows).
  2. Run evaluation to Screen 3.
  3. Click "Review report layout" to navigate to `/report`.
  4. On `/report`, click "Back to results" (`router.push("/")`).
  5. State re-hydrates with 420 readings while the banner proclaims "full register".
- **Fix:**  
  Dynamically select `load-demo-full` when `parsed.ui?.demoScope === "full"`:
  ```typescript
  if (parsed?.__compactDemo) {
    const actionType =
      parsed.ui?.demoScope === "full" ? "load-demo-full" : "load-demo";
    const demoBase = wizardReducer(createInitialState(), { type: actionType });
    const shouldEvaluate =
      parsed.ui?.screen === 3 || Boolean(parsed.ui?.evaluatedAt);
    const hydrated = shouldEvaluate
      ? wizardReducer(demoBase, { type: "run-evaluation" })
      : demoBase;
    return {
      ...hydrated,
      ui: { ...hydrated.ui, ...(parsed.ui ?? {}) },
      ptmt: parsed.ptmt ? { ...hydrated.ptmt, ...parsed.ptmt } : hydrated.ptmt,
    };
  }
  ```

---

### CR-04: "Continue to Review" Forward Navigation Trapped on Screen 1
- **File:** `lib/wizard/reducer.ts:684-688` vs `components/wizard/screen-ingest.tsx:259-265`
- **Deliverable:** Surface 4 (Two-Tier Demo Loader & Wizard Flow)
- **Issue:**  
  In `lib/wizard/reducer.ts:687`, `set-screen` rejects all forward navigation:
  ```typescript
  case "set-screen":
    // Forward navigation happens only through parse/run-evaluation success;
    // set-screen serves back-links (2->1, 3->2) and the lost-state redirect.
    if (action.screen > state.ui.screen) return state;
    return { ...state, ui: { ...state.ui, screen: action.screen } };
  ```
  On Screen 1 (`screen-ingest.tsx:261`), when rows are already loaded, the bottom navigation button renders:
  ```tsx
  <button
    type="button"
    disabled={!rowsLoaded || parsing !== null}
    onClick={() => dispatch({ type: "set-screen", screen: 2 })}
    className="..."
  >
    Continue to review
  </button>
  ```
  When a user on Screen 1 clicks "Continue to review", `action.screen` (2) > `state.ui.screen` (1). The guard in `reducer.ts` activates and unconditionally returns `state` unchanged. The button is a completely dead no-op. The user is trapped on Screen 1 and cannot proceed to Screen 2 unless they re-ingest a file or re-click a demo button (wiping out any draft metadata edits).
- **Reproduction:**  
  1. Ingest a CSV or load demo (advances to Screen 2).
  2. On Screen 2, click "Back" to return to Screen 1. `rowsLoaded` is true.
  3. Click "Continue to review". Nothing happens; screen remains 1.
- **Fix:**  
  Allow forward navigation from Screen 1 to Screen 2 when rows are loaded:
  ```typescript
  case "set-screen":
    if (action.screen > state.ui.screen) {
      if (
        state.ui.screen === 1 &&
        action.screen === 2 &&
        state.csv.rowCount > 0
      ) {
        return { ...state, ui: { ...state.ui, screen: 2 } };
      }
      return state;
    }
    return { ...state, ui: { ...state.ui, screen: action.screen } };
  ```

---

### CR-05: Missing Repeating Table Header on Page 2+ Leaves Unlabelled Multi-Page CML Data Tables
- **File:** `components/report/pdf-document.tsx:378-388`
- **Deliverable:** Surface 2 (Two-Page PDF Executive Dashboard)
- **Issue:**  
  In `@react-pdf/renderer`, when table content in a `<Page>` exceeds physical page height, the library wraps the elements onto subsequent pages. A table header row only repeats on overflow pages if it carries the `fixed` attribute (as seen on the page-number footer on line 186).  
  In `pdf-document.tsx:379`, the CML table header is rendered as:
  ```tsx
  <View wrap={false} style={[styles.tableRow, styles.tableHeader]}>
    <Text style={styles.cellName}>CML / Location</Text>
    ...
  </View>
  ```
  It lacks `fixed`. In datasets with >25 CMLs (including both demo datasets: 40 CMLs in subset, 120+ CMLs in full register), the table breaks across Pages 2, 3, 4, etc. On Pages 3 and beyond, inspectors are presented with rows of raw unlabelled floating-point numbers without column headers. In certified NDT inspection documentation, orphaned data columns without header identifiers fail regulatory auditing.
- **Reproduction:**  
  Render a PDF with 50 readings. Observe that Page 3 contains data rows without the table header row.
- **Fix:**  
  Add `fixed` to the table header `<View>`:
  ```tsx
  <View fixed wrap={false} style={[styles.tableRow, styles.tableHeader]}>
    <Text style={styles.cellName}>CML / Location</Text>
    ...
  </View>
  ```

---

## Warnings

### WR-01: Verdict Glossary on PDF Page 1 Omits Verdict Tokens, Defining Anonymous Terms
- **File:** `components/report/pdf-document.tsx:298-309`
- **Deliverable:** Surface 3 (Verdict Glossary) / Surface 2 (PDF Document)
- **Issue:**  
  Both HTML renderers (`components/report/report-document.tsx:456` and `components/wizard/screen-results.tsx:329`) render `{verdictLabel(verdict)}` before `{entry.plain}`.  
  `pdf-document.tsx:303` renders ONLY `{entry.plain}` and `{citationRef(entry.citationId)}`. On generated PDFs, three sentences and clause codes appear under "Verdict glossary" without stating *which* verdict (ACCEPT, RE-CHECK, FAIL) is being defined:
  ```
  Verdict glossary
  Wall thickness meets the code minimum at this location.
  API 574 §10.5.1.4
  Thickness is close to the limit — re-measure to confirm before deciding.
  API 570 §7.1.2
  Wall is thinner than the code allows at this location. Action required.
  API 570 §7.6
  ```
  It is a glossary that defines nameless terms.
- **Fix:**  
  Prepend `{verdictLabel(verdict)} — ` in `pdf-document.tsx:303`:
  ```tsx
  <Text style={styles.footer}>
    {`${verdictLabel(verdict)} — ${entry.plain}`}
  </Text>
  ```

---

### WR-02: `joinNames` Lacks Empty-Array Base Case, Producing `", and undefined"`
- **File:** `lib/report/content.ts:129-134, 232-235`
- **Deliverable:** Surface 1 (Plain-English Findings Brief)
- **Issue:**  
  `joinNames` is implemented as:
  ```ts
  function joinNames(names: string[]): string {
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
  }
  ```
  When `names.length === 0`, `names.slice(0, -1)` returns `[]`, while `names[names.length - 1]` accesses `names[-1]`, which is `undefined`. It returns `", and undefined"`.  
  In `buildFindingsBrief`, when `summary.fail <= 3`, `failNames` is extracted from `worstLocations`. If caller passes a summary with `fail: 1` but empty readings, `dispositionSentence` emits:  
  `"1 of 10 readings failed — immediate inspection required at , and undefined."`
- **Fix:**  
  Add `if (names.length === 0) return "";` and fall back to generic wording when `failNames.length === 0`.

---

### WR-03: Missing Deduplication in Failing Location Names
- **File:** `lib/report/content.ts:232-235`
- **Deliverable:** Surface 1 (Plain-English Findings Brief)
- **Issue:**  
  In ultrasonic surveys, multiple readings are taken at the same CML or location across different grid quadrants or inspection campaigns. When 2 or 3 failing readings are recorded at the same CML (e.g. `TK-101`), `failNames` contains `["TK-101", "TK-101"]`. `joinNames(failNames)` outputs:  
  `"2 of 420 readings failed — immediate inspection required at TK-101 and TK-101."`  
  Three failing readings at `TK-101` output `"TK-101, TK-101, and TK-101."`
- **Fix:**  
  Deduplicate `failNames`:
  ```ts
  const uniqueNames = [...new Set(failNames)];
  dispositionSentence = `${fmtCount(summary.fail)} of ${fmtCount(total)} readings failed — immediate inspection required at ${joinNames(uniqueNames)}.`;
  ```

---

### WR-04: Outlier Flag Preempts Wall Loss Failure Reasons in `whyFor` (Domain Safety Hazard)
- **File:** `lib/report/content.ts:175-192`
- **Deliverable:** Surface 1 (Plain-English Findings Brief)
- **Issue:**  
  In `whyFor(reading: ReadingResult)`:
  ```ts
  if (isFail && reading.flags.includes("immediate_inspection")) {
    return "No safe service life remaining";
  }
  if (reading.flags.includes("outlier")) {
    return "Reading deviates from this CML's history — re-shoot candidate";
  }
  if (isFail) {
    ...
  ```
  When a reading has `verdict === "reject"` (fails code minimum thickness) and is also flagged as an `outlier`, `whyFor` returns `"Reading deviates from this CML's history — re-shoot candidate"`.  
  In the Screen 3 Findings Brief, next to the red `FAIL` chip, the inspector is told the reading is merely a `"re-shoot candidate"`, obscuring the fact that the reading is below the structural or pressure-design minimum thickness. If a pipe has severe wall loss, labeling it only as a statistical outlier understates safety risk.
- **Fix:**  
  Prioritize failure criteria over the statistical outlier flag for `reject` verdicts:
  ```ts
  if (isFail) {
    if (reading.flags.includes("immediate_inspection")) {
      return "No safe service life remaining";
    }
    const structuralGoverned =
      roundTo(reading.tRequiredMm, 6) === roundTo(reading.tStructuralMm, 6);
    const failureWhy = structuralGoverned
      ? "Below the structural minimum thickness"
      : "Below the pressure-design minimum thickness";
    return reading.flags.includes("outlier")
      ? `${failureWhy} (outlier — re-shoot to confirm)`
      : failureWhy;
  }
  ```

---

### WR-05: Semantic Mismatch for RE-CHECK Citation (`api570_7_1_2_governing`)
- **File:** `lib/report/content.ts:331-334`, `lib/criteria/citations.json:91-100`
- **Deliverable:** Surface 3 (Verdict Glossary)
- **Issue:**  
  `VERDICT_GLOSSARY` maps `re_check` to `api570_7_1_2_governing`.  
  In `lib/criteria/citations.json`:
  - `clause`: `"7.1.2"`
  - `title`: `"Governing Corrosion Rate Comparison and Selection"`
  - `scope_note`: `"LT and ST corrosion rates should be compared to see which results in the shortest remaining life as part of data assessment..."`  
  API 570 §7.1.2 governs comparing long-term vs short-term corrosion rates. It does not define gauge-uncertainty tolerance bands or thickness re-measurement thresholds. Associating API 570 §7.1.2 with `"Thickness is close to the limit — re-measure to confirm before deciding"` creates a false appearance of normative standard mandate for an engineering tolerance convention.
- **Fix:**  
  Set `re_check.citationId: null` in `VERDICT_GLOSSARY` (which renders zero clause glyphs via `citationRef`, correctly reflecting that gauge uncertainty is an engineering threshold rather than a codified API 570 clause).

---

### WR-06: IEEE 754 `NaN` Comparator Hazard with Multiple Null Remaining Life Readings
- **File:** `components/report/pdf-document.tsx:94-98, 118-122`, `lib/report/content.ts:163-165`
- **Deliverable:** Surface 2 (PDF Document) / Surface 1 (Findings Brief)
- **Issue:**  
  ```ts
  const rlA = a.rlYears ?? Number.POSITIVE_INFINITY;
  const rlB = b.rlYears ?? Number.POSITIVE_INFINITY;
  return rlA - rlB;
  ```
  When two readings have `rlYears === null`, `Number.POSITIVE_INFINITY - Number.POSITIVE_INFINITY` evaluates to `NaN`.  
  In ECMAScript 23.1.3.30 (`Array.prototype.sort`), returning `NaN` from a comparator violates strict weak ordering and leads to implementation-defined, non-deterministic sorting across JavaScript engines.
- **Fix:**  
  Handle nulls explicitly before arithmetic:
  ```ts
  if (a.rlYears === null && b.rlYears === null) return 0;
  if (a.rlYears === null) return 1;
  if (b.rlYears === null) return -1;
  return a.rlYears - b.rlYears;
  ```

---

### WR-07: Table Column Width Misalignment (70% on Page 1, 105% on Page 2)
- **File:** `components/report/pdf-document.tsx:51-54, 268-272, 380-388`
- **Deliverable:** Surface 2 (Two-Page PDF Executive Dashboard)
- **Issue:**  
  - Page 1 Top-10 table columns: `cellName` (22%) + `cellNum` (11%) + `cellNum` (11%) + `cellNum` (11%) + `cellWide` (15%) = **70%**. This leaves 30% of the table container width blank on the right margin.
  - Page 2 detail table columns: `cellName` (22%) + `cellNum` (11%) + `cellNum` (11%) + `cellNum` (11%) + `cellNum` (11%) + `cellWide` (15%) + `cellFlags` (13%) + `cellNum` (11%) = **105%**. This causes 5% horizontal overflow and clipping on the right edge.
- **Fix:**  
  Normalize column width definitions so each table sums to exactly 100%:
  - Page 1 (5 columns): `cellName: 34%`, `cellNum: 16%`, `cellNum: 16%`, `cellNum: 16%`, `cellWide: 18%` (Total: 100%).
  - Page 2 (8 columns): `cellName: 20%`, `cellNum: 10%`, `cellNum: 10%`, `cellNum: 11%`, `cellNum: 10%`, `cellWide: 14%`, `cellFlags: 15%`, `cellNum: 10%` (Total: 100%).

---

### WR-08: Next Inspection Callout Cites Wall Thickness Design Code Instead of API 570 §6.3.3
- **File:** `components/report/pdf-document.tsx:151-154, 422-427`
- **Deliverable:** Surface 2 (Two-Page PDF Executive Dashboard)
- **Issue:**  
  In `pdf-document.tsx:151`:
  ```tsx
  const ruleCite =
    snapshot.readings.find((r) => r.verdict !== "accept")?.citations[0] ??
    snapshot.readings[0]?.citations[1] ??
    null;
  ```
  `citations[0]` of a failing reading is `asme_b31_3_304_1_2` or `api574_10_5_1_4`.  
  Next inspection scheduling is governed by API 570 §6.3.3. `lib/report/content.ts:48` explicitly defines and exports `REINSPECTION_CITATION_ID = "api570_6_3_3_halflife"`, which is correctly used by `report-document.tsx:122`. Citing ASME B31.3 §304.1.2 (straight pipe pressure design formula) as the rule for next inspection date violates standards hierarchy.
- **Fix:**  
  Import and use `REINSPECTION_CITATION_ID`:
  ```tsx
  <Text style={styles.monoSmall}>
    Rule applied: {citationRef(REINSPECTION_CITATION_ID)}
  </Text>
  ```

---

### WR-09: Incomplete `.gitattributes` Scope & Fragile Line-Ending Parsing in Tests
- **File:** `.gitattributes:1-2`, `tests/ingest/demo-subset-fixture.test.ts:81`
- **Deliverable:** Surface 5 (`.gitattributes` LF Normalization)
- **Issue:**  
  1. `.gitattributes` specifies only:
     ```gitattributes
     *.csv text eol=lf
     lib/demo/fixtures/*.json text eol=lf
     ```
     It omits `* text=auto` and rules for TypeScript source files, criteria files, and other test fixtures. On Windows environments where `core.autocrlf = true`, files outside the specific glob patterns are vulnerable to CRLF checkout conversion.
  2. In `demo-subset-fixture.test.ts:81`, `csv.split("\n")` leaves trailing `\r` carriage returns on each element if `sample-ut-register-subset.csv` is checked out with CRLF. String equality assertions (`expect(lines[0]).toBe(...)`) will fail due to `\r` mismatches.
- **Fix:**  
  1. Add `* text=auto eol=lf` to `.gitattributes`.
  2. Update `demo-subset-fixture.test.ts:81` to split on `csv.split(/\r?\n/)`.

---

## Info

### IN-01: Degenerate Zero-Total State Emits Affirmative Certification
- **File:** `lib/report/content.ts:207-275`, `lib/report/snapshot-schema.ts:133`
- **Deliverable:** Surface 1 (Findings Brief) / Surface 2 (PDF Document)
- **Issue:**  
  If `summary.total === 0`, `allAccept` evaluates to `true`. The brief emits `"All 0 readings meet the code minimum."` and `"All 0 readings are ACCEPT"`, and the PDF generates a green certified report with zero table rows.
- **Fix:**  
  Add `.min(1)` to `ReportSnapshotSchema.shape.readings` and guard `total === 0` in `buildFindingsBrief` to return neutral placeholder text: `"No readings evaluated."`

---

### IN-02: Public Sample CSV Download Links to 6-Row Tracer Sample Rather Than 420-Row Demo Mirror
- **File:** `components/wizard/screen-ingest.tsx:216-222`
- **Deliverable:** Surface 4 (Two-Tier Demo Loader)
- **Issue:**  
  `screen-ingest.tsx` links "Download sample CSV" to `/sample-ut-register.csv` (a 6-row sample). The 420-row mirror generated in Phase 6 (`public/sample-ut-register-subset.csv`) is committed and tested, but completely inaccessible from the user interface.
- **Fix:**  
  Update link or provide dual links to allow downloading both the quick 6-row tracer and the full 420-row demo subset mirror.

---

### IN-03: Empty Paragraph / Text DOM Nodes on Null `citationId`
- **File:** `components/wizard/screen-results.tsx:334`, `components/report/report-document.tsx:460`, `components/report/pdf-document.tsx:305`
- **Deliverable:** Surface 3 (Verdict Glossary)
- **Issue:**  
  When `citationId` is null, empty `<p className="font-mono text-xs ..."></p>` and `<Text style={styles.monoSmall}></Text>` elements render into the DOM, inserting unwanted vertical spacing in flex containers.
- **Fix:**  
  Conditionally render the element only when `entry.citationId && citationRef(entry.citationId)`.

---

### IN-04: Singular vs. Plural Grammar Defects for Single-Reading Datasets
- **File:** `lib/report/content.ts:226, 228, 235`
- **Deliverable:** Surface 1 (Plain-English Findings Brief)
- **Issue:**  
  For single-reading datasets (`total === 1`), `buildFindingsBrief` outputs `"All 1 readings meet..."`, `"All 1 readings failed"`, and `"1 readings are ACCEPT"`.
- **Fix:**  
  Introduce a count-aware helper `n === 1 ? "1 reading" : `${fmtCount(n)} readings`` and adjust verbs (`is` vs `are`).

---

### IN-05: CSS Flexbox Truncation Failure in `BriefList`
- **File:** `components/wizard/findings-brief.tsx:40-49`
- **Deliverable:** Surface 1 (Plain-English Findings Brief)
- **Issue:**  
  Each item in `BriefList` is rendered in `<li className="flex flex-wrap items-center gap-2 text-sm">`. Because `flex-wrap` is set and there is no `max-w` or `min-w-0` on the `<span>`, long CML names expand to full width and wrap child chips onto new lines rather than truncating cleanly with ellipsis.
- **Fix:**  
  Add `max-w-[200px]` and `truncate` to the location name span.

---

### IN-06: Report Snapshot Strips Demo Provenance Watermark
- **File:** `lib/report/session-snapshot.ts:34-45`, `components/report/pdf-document.tsx:201`
- **Deliverable:** Surface 4 (Two-Tier Demo Loader)
- **Issue:**  
  `ReportSnapshot` interface only stores `evaluatedAt`, `sourceName`, `units`, `metadata`, `summary`, `readings`, `indications`. It strips `isDemo` and `demoScope`. Exported PDFs from demo sessions display `SOURCE zenodo-16780668-Appendix-A-UT-register.csv` without any "SAMPLE DATA" watermark.
- **Fix:**  
  Include `demoScope` in `ReportSnapshot` and render a sample data watermark on demo-generated reports.

---

## Allowlist Citation & Standards Verification

All citations referenced across Phase 6 deliverables were verified against `lib/criteria/citations.json` and normative standards:

| Citation ID | In Allowlist? | Code Standard | Clause | Scope Note Match | Audit Verdict |
|:---|:---:|:---|:---|:---|:---|
| `api574_10_5_1_4` | **YES** | API 574 | 10.5.1.4 | Minimum Required Thickness — Governing Selection Rule (`t_required = max(t_pressure, t_structural)`) | **PASS** — Accurate normative citation for ACCEPT. |
| `api570_7_6` | **YES** | API 570 | 7.6 | Required Thickness Determination for in-service piping | **PASS** — Accurate normative citation for FAIL / reject. |
| `api570_7_1_2_governing` | **YES** | API 570 | 7.1.2 | Governing Corrosion Rate Comparison (LT vs ST) | **CONCERN (WR-05)** — Clause covers corrosion rate comparison, not gauge-uncertainty re-measurement. Recommend `null`. |
| `api570_6_3_3_halflife` | **YES** | API 570 | 6.3.3 | Inspection interval half-life rule | **PASS** — Correct reinspection rule (see WR-08). |

---

## Verification & Invariant Audit

1. **Protected Calculation Trees (`lib/calc/` & `lib/criteria/`):**
   - Verified completely untouched. `git status --porcelain -- lib/calc lib/criteria` is empty.
   - All deterministic calculation invariants remain byte-identical.
2. **Deterministic Non-LLM Boundaries:**
   - Verified that `buildFindingsBrief` and `pdf-document.tsx` contain zero LLM calls, zero network fetches, zero nondeterministic seeds, and zero arbitrary datetime shifts.
3. **Tank-Identity Subsetting Invariant:**
   - Subsetting script (`scripts/generate-demo-subset.mjs`) filters strictly by tank identity (`Tank === "WBT-S6"`).
   - Produced exactly 420 readings, exactly 40 CMLs, exactly 1 tank.
   - Exactly 40 readings carry `insufficient_history` (legitimate first-campaign readings from 2015-03). No false `insufficient_history` flags were manufactured.
