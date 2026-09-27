---
phase: 02-ingestion-calc-engine
reviewed: 2026-09-27T12:28:58Z
depth: deep
files_reviewed: 69
files_reviewed_list:
  - lib/calc/criteria.ts
  - lib/calc/round.ts
  - lib/calc/units.ts
  - lib/calc/dates.ts
  - lib/calc/formulas.ts
  - lib/calc/corrosion.ts
  - lib/calc/remaining-life.ts
  - lib/calc/verdicts.ts
  - lib/calc/interval.ts
  - lib/calc/outliers.ts
  - lib/calc/ptmt.ts
  - lib/calc/evaluate.ts
  - lib/calc/index.ts
  - lib/ingest/csv.ts
  - lib/ingest/session.ts
  - lib/ingest/map.ts
  - lib/ingest/validate.ts
  - lib/ingest/group.ts
  - lib/wizard/reducer.ts
  - lib/wizard/format.ts
  - lib/demo/demo-scenario.ts
  - lib/demo/fixtures/tracer-sample.ts
  - lib/demo/fixtures/zenodo-16780668-ut-register.json
  - lib/demo/ATTRIBUTION.md
  - lib/criteria/ut-criteria.json
  - lib/criteria/ptmt-criteria.json
  - lib/criteria/citations.json
  - components/wizard/wizard-context.tsx
  - components/wizard/dropzone.tsx
  - components/wizard/verdict-chip.tsx
  - components/wizard/screen-ingest.tsx
  - components/wizard/screen-review.tsx
  - components/wizard/parsed-row-table.tsx
  - components/wizard/column-mapping-panel.tsx
  - components/wizard/metadata-form.tsx
  - components/wizard/ptmt-entry.tsx
  - components/wizard/screen-results.tsx
  - components/wizard/results-table.tsx
  - components/wizard/summary-strip.tsx
  - components/wizard/ptmt-triage-list.tsx
  - components/wizard/flag-detail-row.tsx
  - components/wizard/unit-segmented.tsx
  - components/wizard/confirm-dialog.tsx
  - components/wizard/flag-badge.tsx
  - components/wizard/step-indicator.tsx
  - app/page.tsx
  - app/layout.tsx
  - public/sample-ut-register.csv
  - eslint.config.mjs
  - vitest.config.ts
  - tests/calc/formulas.test.ts
  - tests/calc/verdicts.test.ts
  - tests/calc/interval.test.ts
  - tests/calc/corrosion.test.ts
  - tests/calc/outliers.test.ts
  - tests/calc/ptmt.test.ts
  - tests/calc/dates.test.ts
  - tests/calc/evaluate.test.ts
  - tests/calc/evaluate.demo.test.ts
  - tests/calc/tracer-pipeline.test.ts
  - tests/calc/criteria-sovereignty.test.ts
  - tests/ingest/group.test.ts
  - tests/ingest/map.test.ts
  - tests/ingest/validate.test.ts
  - tests/ingest/boundary-imports.test.ts
  - tests/ingest/units-gate.test.ts
  - tests/ingest/demo-fixture.test.ts
  - tests/wizard/reducer.test.ts
  - tests/wizard/results.test.ts
findings:
  critical: 2
  warning: 8
  info: 7
  total: 17
status: findings_found
fixed:
  - CR-01
  - CR-02
  - WR-01
  - WR-02
  - WR-03
  - WR-04
  - WR-05
  - WR-06
  - WR-07
  - WR-08
  - IN-01
  - IN-02
  - IN-03
  - IN-04
  - IN-06
  - IN-07
disposition_recorded:
  - IN-05
fixed_at: 2026-09-27T19:45:00Z
fixed_branch: fix/phase-2-review
---

# Phase 2: Code Review Report — Ingestion & Deterministic Calc Engine

**Reviewed:** 2026-09-27T12:28:58Z
**Depth:** deep (cross-file analysis: criteria JSON -> lib/calc -> lib/ingest -> reducer -> components -> tests)
**Files Reviewed:** 69
**Status:** findings_found

## Summary

The calc core is genuinely strong. Verdict banding implements the locked `boundary_convention` order verbatim with 6-dp canonicalization; `requiredThickness` applies the governing `max(t_pressure, t_structural)`; the negative-CR policy clamps only the governing divisor, flags on either negative raw rate, and surfaces raw rates; G14 immediate-inspection is distinct from insufficient-history and never negative; class maxima, gauge uncertainty, and PT/MT limits all load from `lib/criteria/*.json`; dates are strict-ISO with leap-aware validation. Golden tests pin the real values (G1 2.637536 and G2 2.656522 via `toBe`, G5 21.8749, G8 arithmetic-constructed boundaries, G11 60.7050, G13 10.001369, G12 mils end-to-end) — they are not loose ranges, and the demo end-to-end pins the observed 301/538/4,073 split over all 4,912 fixture rows. Purity gates (eslint `no-restricted-imports` + a mechanical vitest walk) are present and meaningful; `npm run typecheck` exits 0.

However, adversarial probing found two blockers in the ingestion/validation layer that corrupt engineering output or block legitimate uploads on the *standard* input paths, plus a fail-open NaN hole in the public engine API. Every finding below was reproduced against the actual source (temporary vitest probes, since removed); none is speculative.

Note on the suite: `npx vitest run` = **241/242 passed** — the single failure is the Phase 1 network-dependent `tests/llm/hello-fixture.test.ts` (see WR-08).

## Critical Issues

### CR-01: Thickness-vs-OD validation compares CSV-unit values against a mm OD — every row of a legitimate in/mils upload is falsely rejected

**File:** `lib/ingest/validate.ts:187,197-205` (comparison), `lib/wizard/reducer.ts:274-277` (call site)
**Issue:** `rowIssues` assigns `thicknessMm = parsed` where `parsed` is the *raw CSV cell value* — no `toMm(value, csvThicknessUnit)` conversion — then compares it against `options.odMm` which `validateSession` supplies in canonical mm (`toMm(session.metadata.od, session.units.metadata)`). For a `mils` CSV (a first-class declared unit — UI-12, `csvThicknessUnitFromHeader`), a healthy 748-mil (19.0 mm) wall is compared as `748 >= 114.3` and every row gets `impossible value, exceeds outer diameter (114.3 mm)` — an ERROR that blocks Run Evaluation. Empirically confirmed by probe: uploading a 2-row `Measured_Thickness_mils` file with OD 114.3 mm yields exactly that error on both rows. The error message also mislabels the raw value as `mm`. Units-explicit ingestion (ING-05) is a locked requirement; this path silently inverts it into false rejections.
**Fix:**
```ts
// validate.ts — carry the CSV unit through options and convert before comparing
export interface ValidateOptions {
  odMm?: number;
  csvThicknessUnit?: Unit;          // NEW: unit of the parsed thickness cell
  todayIso?: string;
}
// in rowIssues():
const parsed = parseNumericCell(thicknessRaw);
if (parsed === null) { /* unchanged */ }
else {
  const thicknessMm = toMm(parsed, options.csvThicknessUnit ?? "mm");
  // <=0 check on the raw value is unit-invariant; OD check must use thicknessMm
  if (thicknessMm <= 0) { /* unchanged */ }
  else if (odMm > 0 && thicknessMm >= odMm) {
    // message renders thicknessMm (true mm), not the raw unit value
  }
}
// reducer validateSession: pass { odMm, csvThicknessUnit: session.units.csvThickness }
```

### CR-02: Auto-guess maps `Original_Scantling_mm` to t-initial; wide-format precedence then feeds the constant scantling into CR_LT — fabricated corrosion rates and false "immediate inspection" on the advertised upload format

**File:** `lib/ingest/map.ts:54-57` (aliases), `lib/wizard/reducer.ts:469` (autoGuess at ingest), `lib/ingest/group.ts:105-115` (wide-column precedence)
**Issue:** The UI-SPEC alias table maps `originalscantlingmm` to t-initial, and `autoGuess` honors it, so any upload of the six-column format the app's own format guide and `public/sample-ut-register.csv` advertise gets `mapping.tInitial = "Original_Scantling_mm"`. In `groupByCml`, mapped wide columns take precedence over derived campaign history, so CR_LT = (20 − t_actual)/Δt from a *design scantling*, not a measurement. Empirically confirmed through the real reducer path (parse-file + metadata filled + run-evaluation): A01-2025 (true rate 0.029996 mm/yr) reports **CR_LT 1.079852, RL 6.08**; B02-2025 — a CML with *zero* measured degradation (2.0 → 2.0, truly insufficient history) — reports **CR 1.799754, RL −0.3542 and the `immediate_inspection` flag**; C03-2025 reports RL 0/immediate under a re_check verdict. The team knows this hazard: the tracer/demo builders explicitly null this exact mapping with the comment "Wide-format precedence in lib/ingest/group would otherwise feed the constant into CR_LT" (`lib/wizard/reducer.ts:162-165`) — but that guard was never applied to the user upload path (`ingestCsv`), where it silently corrupts remaining life, intervals, and immediate-inspection flags. `tests/ingest/map.test.ts:26` even pins the hazardous auto-map as correct behavior.
**Fix:** Remove `originalscantlingmm` / `originalscantling` from the t-initial *auto-guess* alias list (keep them selectable in the manual dropdown, preserving UI-07 overridability), and update `map.test.ts`. Minimal alternative: detect a constant-nominal t-initial column and downgrade it to a warning requiring explicit confirmation. This intentionally deviates from the literal UI-SPEC alias table and needs a recorded decision — but shipping auto-computed garbage CRs on the flagship format is worse than the spec drift.

## Warnings

### WR-01: `evaluate()` fails open on NaN input — NaN thickness yields verdict `accept` and `rlYears: NaN`, violating the engine's own "never Infinity/NaN" contract

**File:** `lib/calc/evaluate.ts:88-156` (no input guard), `lib/ingest/group.ts:128` (`tActualMm: tActual ?? Number.NaN`)
**Issue:** Probed directly: `evaluate()` called with `tActualMm: NaN` returns `verdict: "accept"` (all NaN comparisons are false, so both reject and re_check branches fall through to accept) and `rlYears: NaN`. The R7 contract says `rlYears` is "NEVER Infinity/NaN — null instead", and `lib/calc/index.ts` exports `evaluate` as the public Phase 3/4 surface (the LLM phase will consume these results). The wizard path is currently protected only because `run-evaluation` filters error rows before grouping — the engine itself has no defense, and `group.ts` explicitly manufactures NaN at the seam.
**Fix:** Fail closed at `evaluate()` entry: skip or reject any input whose `tActualMm`/`dtLtYears`/`dtStYears` is non-finite (treat as insufficient history), or throw a typed error; add a test asserting NaN input never produces an accept verdict.

### WR-02: `pipeClass` is never validated as 1|2|3 — an unvalidated draft value silently uncaps the inspection interval

**File:** `lib/wizard/reducer.ts:312-314` (only blank-checked), `lib/wizard/reducer.ts:356` (`Number(draft.pipeClass) as 1 | 2 | 3`), `lib/calc/interval.ts:41-45`
**Issue:** `metadataProblems` checks only `draft.pipeClass.trim() === ""`; `metadataFromDraft` blind-casts `Number(...)` to `1|2|3`. Probed: `nextInterval(30, NaN)` returns **15.00** — `maxIntervalByClass` returns null for an unknown class and `interval.ts` does `classMax ?? Number.POSITIVE_INFINITY`, silently removing the API 570 Table 1 cap. The current select constrains the UI, but the reducer is the documented gate and its output reaches the engine as a validated-looking `ComponentMetadata`.
**Fix:** In `metadataProblems`, require `["1","2","3"].includes(draft.pipeClass)`; in `nextInterval`, treat a null classMax as a hard error (throw / refuse) instead of `?? Infinity`.

### WR-03: Row issues go stale after metadata edits — the OD check never fires for data entered after ingest

**File:** `lib/wizard/reducer.ts:665-673` (`set-metadata-field`), `lib/wizard/reducer.ts:647-652` (`set-metadata-unit`), `lib/wizard/reducer.ts:274-277` (`validateSession`)
**Issue:** `ui.rowIssues` is recomputed only by `ingestCsv`, `loadSample`, `loadDemo`, `set-mapping`, and `set-row-cell`. The thickness-vs-OD check depends on `metadata.od` (and its unit), but `set-metadata-field` and `set-metadata-unit` never re-run `validateSession`. A user who ingests first and fills the OD form afterwards is gated at Run Evaluation against issues computed with `odMm = 0` (check disabled) — contradicting the module's own "(UI-07: never stale)" invariant. (Note: fixing WR-01 is a prerequisite for this recomputation to be correct for non-mm CSVs.)
**Fix:** In both cases, rebuild the session slice and set `ui.rowIssues: validateSession(session)` exactly as `set-mapping` does.

### WR-04: Duplicate reading IDs (warning-only) reach results and collide as duplicate React keys and DOM ids

**File:** `components/wizard/results-table.tsx:109` (`key={reading.readingId}`), `components/wizard/results-table.tsx:48` (`detail-${reading.readingId}-${flag}`), `components/wizard/flag-detail-row.tsx:65`
**Issue:** `duplicate reading ID` is a WARNING that never blocks (correctly, per the catalog), so rows with identical IDs flow through `groupByCml`/`evaluate` into `results.readings` (probed: two results, both `readingId: "R1"`). The results table keys `<tr>` by `readingId` and builds `aria-controls`/detail-row ids from it, so duplicate IDs produce duplicate React keys (reconciliation glitches) and duplicate DOM element ids (broken a11y wiring) on any page where both rows co-locate.
**Fix:** Key by a composite (`${reading.readingId}-${index}`) or make `readingId` unique at group time (`row-N` fallback already exists when the column is unmapped — extend it to deduplicate collisions).

### WR-05: Declared PT/MT morphology is ignored by the engine but displayed next to the derived verdict — contradictory triage cards

**File:** `lib/calc/ptmt.ts:55` (derives linear from `L > 3W`), `components/wizard/ptmt-entry.tsx:85-100` (radio), `components/wizard/ptmt-triage-list.tsx:18-21` (renders declared morphology)
**Issue:** `evaluateIndication` correctly re-derives morphology from the criteria definition (`linear` iff `L > 3W`, strictly), but the session's user-declared `morphology` field is dead in evaluation while the Screen 3 triage card prints it: an indication entered as Linear with L 2.0 × W 1.9 renders "Linear indication L 2.0 × W 1.9 mm — ACCEPT — Relevant rounded within limit." The declared value and the verdict basis disagree on screen with no explanation — a trust defect in a safety triage surface.
**Fix:** Either drop the radio and display the derived morphology (label it "derived from L vs 3W"), or surface the conflict ("declared linear, dimensions classify rounded per ASME B31.3 — dimensions govern") in the detail line.

### WR-06: Replace-flow reads the entire file before any type/size check, contradicting the documented "caps gate BEFORE any read" budget

**File:** `components/wizard/screen-ingest.tsx:45-57` (`handleFileChosen`), doc claim at `screen-ingest.tsx:8-9`
**Issue:** The primary ingest path checks `isCsvFile` and `file.size` before `file.text()`. The replace path (`rowsLoaded`) skips both and reads the whole file into memory, then stages the full content in `replaceConfirm` state; `assertFileBytes` only fires at `confirm-replace`. A multi-hundred-MB non-CSV dropped while rows are loaded is fully read and held in the reducer before any rejection.
**Fix:** Run the same `isCsvFile`/`file.size > MAX_FILE_BYTES` checks in `handleFileChosen` before calling `file.text()`, dispatching `parse-invalid`/`parse-too-large` on the replace path too.

### WR-07: Tokenizer silently drops data rows whose every field is empty — row numbering shifts and missing-value errors never fire

**File:** `lib/ingest/csv.ts:92` (`record.some((cell) => cell !== "")`)
**Issue:** Probed: input `a,b\n1,2\n,,\n3,4\n` tokenizes to 3 records — the `,` record (a legitimate RFC 4180 record of three empty fields) vanishes. The skip exists to prevent phantom trailing-newline rows, but it also swallows all-empty *data* records that the validation layer should report as `missing value` errors (every other blank cell gets that treatment), and it shifts the 1-based data-row numbering for all subsequent rows relative to what the user sees in their file.
**Fix:** Only skip records with zero fields or a single unquoted empty field (true blank lines); let `,,`-style records through to `rowIssues`, or emit a dedicated row issue when dropping them.

### WR-08: Suite is not hermetic — 241/242; the Phase 1 LLM network test fails without a compliant live model

**File:** `tests/llm/hello-fixture.test.ts:29`
**Issue:** `npx vitest run` currently reports 1 failure: the routed extraction model returned prose instead of JSON (`Validated call failed after 1 retry … is not valid JSON`). The test is Phase 1 scope, but it breaks the green-suite signal that Phase 2's mechanical gates (`tests/ingest/boundary-imports.test.ts`, criteria sovereignty) rely on, and makes "tests pass" non-reproducible off-network or on model drift.
**Fix:** Skip (or stub the transport for) `hello-fixture` when `FLAWCHECK_LIVE_LLM` / credentials are absent, so `npm test` is deterministic and the live check runs explicitly.

## Info

### IN-01: `crLtMmYr`/`crStMmYr` are always identical to `rawCrLtMmYr`/`rawCrStMmYr`
**File:** `lib/calc/evaluate.ts:144-147`
**Issue:** Both field pairs are assigned from the same `outcome.rawLt`/`rawSt`, duplicating the R7 contract's distinction (display value vs raw audit value). Harmless today (the clamped quantity is the *governing* rate, surfaced separately), but the redundancy invites divergence later.
**Fix:** Either drop the raw aliases or assign the display pair from a distinct (e.g., formatting-oriented) derivation; document the identity in `session.ts`.

### IN-02: `_in` unit suffix heuristic over-matches
**File:** `lib/ingest/map.ts:102-108`
**Issue:** `csvThicknessUnitFromHeader` returns `in` for any normalized header *ending in* `in` — e.g. a measured-thickness column named `T_Min` (`tmin`) or `Origin` would auto-declare inches and silently convert all values. Only applies to the mapped thickness column, hence low likelihood.
**Fix:** Match the last underscore/space-separated token against `mm|in|inch|mils` instead of `endsWith`.

### IN-03: `assertFileBytes` measures UTF-16 code units, not bytes
**File:** `lib/wizard/reducer.ts:411`, `lib/ingest/validate.ts:29-35`
**Issue:** `content.length` under-counts multibyte content up to 3x vs UTF-8, so the in-reducer cap admits ~15 MB of CJK text as "5 MB". The dropzone's `file.size` check is the real byte gate on the primary path, so this is belt-and-braces drift only.
**Fix:** Acceptable as-is for the budget; alternatively check `new Blob([content]).size` or document that the reducer cap is char-based.

### IN-04: Auto-guess can bind two target fields to the same header
**File:** `lib/ingest/map.ts:37,62` (`cml` aliases both `readingId` and `tank`), `lib/wizard/reducer.ts:629-637`
**Issue:** `CML` in a header row maps to both Reading ID and Tank/Location, and `set-mapping` doesn't prevent a user from selecting the same header twice; the parsed-row table then renders two identical editable columns.
**Fix:** In `autoGuess` and `set-mapping`, clear the header from other fields when it is claimed (`mapping[f] === header && f !== field` -> null).

### IN-05: Error-badge linkage couples components to validate.ts label strings
**File:** `components/wizard/parsed-row-table.tsx:97-112`
**Issue:** `cellMatchesField` maps `RowIssue.field` back to a `TargetField` by literal strings ("Measured thickness", …). Renaming a label in `validate.ts` silently severs `aria-invalid`/`aria-describedby` and the red cell borders with no failing test.
**Fix:** Add a stable `targetField?: TargetField` to `RowIssue` at creation and match on it.

### IN-06: Misleading copy when t-nominal is zero/negative
**File:** `lib/wizard/reducer.ts:297-303`
**Issue:** `tNominal === null || tNominal <= 0 || tNominal >= od` all render "Nominal thickness must be smaller than the outer diameter." — for `0`/negative input the message is wrong (the value isn't smaller-than-OD-violating, it's non-positive).
**Fix:** Split the zero/negative case into "Nominal thickness must be a number greater than 0."

### IN-07: `evaluated` footnote renders UTC wall-clock without a timezone marker
**File:** `lib/wizard/format.ts:29-31`
**Issue:** `formatEvaluatedAt` slices the ISO UTC string, so a user in UTC+5:30 sees a timestamp up to 5.5 h off their local clock with no "UTC" label.
**Fix:** Append ` UTC` to the rendered string or format in the user's locale/timezone.

## Verified Clean (adversarial checks that passed)

- **Verdict banding:** locked order verbatim (`lib/calc/verdicts.ts:26-31`); boundary equalities land in re_check/accept; G8 tests construct `tReq + unc` arithmetically; uncertainty loaded from criteria.
- **Governing t_required:** `Math.max(tPressureMm, tStructuralMm)` actually applied (`formulas.ts:82`); structural branch cites `api574_annex_d`.
- **Negative-CR policy:** clamp applied to the RL divisor only; flag fires when either raw rate is negative (OQ2); raw rates surfaced verbatim; floored-to-zero → insufficient history with RL null (G9a/G9b tests).
- **Interval:** `min(RL/2, class max)`, `RL < 4 → min(RL, 2.0)` (G6 pins 2.00 not 1.50), class maxima 5/10/10 loaded from JSON (Pitfall 10 narrowing present), G14 `RL <= 0 → intervalYears 0 + immediate-inspection`, never negative.
- **Float/date discipline:** round-at-exit implemented via one helper; strict-ISO parse rejects `2026-02-31`, `31/02/2026`; `daysToYears(3653) = 10.001369` exact; no `new Date(string)` on user data; engine has zero `Date.now(`/`Math.random(` (mechanically guarded).
- **CSV security:** null-prototype row cells (probed `__proto__` header — inert), quote-aware state machine with doubled-quote escapes, CRLF/LF/CR, BOM strip at both tokenizer and normalizer, no `eval`/`Function`/`innerHTML`/`dangerouslySetInnerHTML` anywhere in scope, filenames never used in fs/shell paths.
- **Purity:** `lib/calc` has zero imports from `lib/llm`/react/next/node builtins (eslint block + walking guard both present, and the guard verifies it finds ≥10 modules — not vacuous). The criteria-sovereignty test strips comments/strings before scanning — it is a real (if narrow: 3 files, 5 literals) guard, not a tautology.
- **Numeric/date coercion:** strict grammar gates every coercion (`0x1A`, `Infinity`, `19,5`, `19.5abc`, `""`/`" "` all tested); two numbering spaces (physical line vs data row) proven by embedded-newline fixtures.
- **Tests pin real values:** spot-checked G1/G2/G5/G8/G11/G13/G12 all assert exact canonical values via `toBe` (not ranges); demo suite pins the observed 4,912-row/12-tank/301-538-4,073 split; fixture gates the real observed range (18.88–20.0) rather than the research's anticipated one — the deviation is documented in `demo-fixture.test.ts` and `ATTRIBUTION.md`.
- **UI contract:** verdict chips ACCEPT/RE-CHECK/FAIL (internal `reject` never leaked); flag chips per contract; demo provenance banner persists on Screens 2–3; `Row {n}: {field} — {problem} ({value}).` pattern produced by a single formatter; 50-row pagination with memoized slices; focus moves to screen headings; confirm-dialog implements a focus trap.
- **Tooling:** `npm run typecheck` exit 0; eslint `no-restricted-imports` block present as specified; zero new packages.

## Dispositions

Fix branch `fix/phase-2-review` (from `build/phase-2`), one atomic commit per finding. All criticals were re-reproduced with failing tests first; every regression test is kept as a permanent pin. Golden catalog (G1–G14, P1–P7) and the demo split (301/538/4,073) remain pinned and green. Final gates: `npm run typecheck` exit 0; `npm run lint` exit 0 (2 pre-existing warnings in `tests/ingest/group.test.ts`); `npm test` with `NEBIUS_API_KEY` and `FLAWCHECK_LIVE_LLM` unset — **280 passed / 4 skipped, 3.9 s, zero network** (hermetic); `npm run build` exit 0.

| Finding | Disposition | Commit | Rationale / notes |
|---------|-------------|--------|-------------------|
| CR-01 | fixed | cde5338 | `ValidateOptions.csvThicknessUnit` added; thickness converted via `toMm` before both checks; `validateSession` passes the declared CSV unit (and the metadata draft, for WR-03). Pins: 748-mil row clean vs 114.3 mm OD through the real reducer; 6000-mil row still errors; mm back-compat. |
| CR-02 | fixed (recorded UI-SPEC deviation) | ca985c8 | `originalscantlingmm`/`originalscantling` removed from t-initial AUTO-GUESS aliases — deliberate deviation from the literal UI-SPEC table, mirroring the demo/tracer builder decision (reducer.ts:162-165). Manual dropdown still selects them (UI-07); an explicit mapping emits a `nominal-scantling-as-t-initial`/`-t-previous` row WARNING (non-blocking). Pin: `public/sample-ut-register.csv` uploads with derived campaign history — A01-2025 CR 0.029996, B02-2025 insufficient-history (NOT the fabricated 1.799754/immediate), zero immediate_inspection flags. |
| WR-01 | fixed: requires human verification | 975c164 | Logic-semantics change (fail-closed policy): `evaluate()` throws typed `EvaluationInputError` on any non-finite input/metadata/computed-t-required, naming reading + field. Chosen over the treat-as-insufficient-history alternative because no honest verdict exists for NaN t-actual; the reducer surfaces the message in the evaluationError banner. Pins: NaN across all five input fields + non-finite metadata throw; null-history path untouched. |
| WR-02 | fixed: requires human verification | 3f0610f | Logic-semantics change (fail-closed policy): `metadataProblems` requires 1\|2\|3; `nextInterval` throws on a class with no numeric maximum instead of `?? Infinity`. Pins: Class 4 ("optional") and NaN class throw; capped 1\|2\|3 behavior unchanged. |
| WR-03 | fixed | 1c8f512 | `set-metadata-field`, `set-metadata-unit`, AND `set-csv-thickness-unit` re-run `validateSession` (the draft od is authoritative while the form is filled; `validateSession` gained the draft parameter in the CR-01 commit). The reviewer listed only the first two; the CSV-unit case is the same staleness class and is included. |
| WR-04 | fixed | bcc71c7 | Keys and `detail-*` DOM ids namespace by `resultRowKey(readingId, absoluteIndex)`; expansion state map uses the same key. Pins: three "R1" results → three distinct keys; no cross id/index collisions. |
| WR-05 | fixed | b0c2671 | Agreement renders the plain line; disagreement renders `declared: X (informational) — L … × W … classifies Y per ASME B31.3 (L > 3W governs the verdict)`. P7a boundary pinned arithmetically. |
| WR-06 | fixed (no test feasible) | 3bbc709 | Replace path runs `isCsvFile` + 5 MB cap BEFORE `file.text()`, dispatching `parse-invalid`/`parse-too-large` pre-read. No component test harness exists in the zero-dep suite; the reducer gate actions are already pinned. |
| WR-07 | fixed | a6bc0b6 | Tokenizer skips only TRUE blank lines (single unquoted empty field); `,,` records and quoted-empty records are real records → missing-value errors fire and row numbering no longer shifts. |
| WR-08 | fixed | 3cecf45 | Live provider tests gated behind `FLAWCHECK_LIVE_LLM` AND the key; default suite skips them (hermetic proof above). Opt in with `FLAWCHECK_LIVE_LLM=1 npm test`. |
| IN-01 | fixed (documented) | 387bd90 | Identity documented on `ReadingResult`; fields kept distinct by contract. |
| IN-02 | fixed | daad55c | Unit token matched against the LAST separator-delimited token; `T_Min`/`Origin` no longer declare inches; `Wall Thickness (in)` still resolves. |
| IN-03 | fixed (documented) | 58d10c5 | Char-based cap documented; dropzone `file.size` is the byte gate (covers the replace path since WR-06). |
| IN-04 | fixed | 573a058 | `autoGuess` excludes already-claimed headers; `set-mapping` clears a claimed header from other fields. |
| IN-05 | recorded — NOT fixed | — | Adding a stable `targetField` to `RowIssue` touches the session contract + schema + table matching across three modules — beyond this pass's "cheap mechanical" bar. Residual risk is low: the label strings are pinned verbatim by `tests/ingest/validate.test.ts`, so a label rename fails CI today. Defer to the next session-contract revision (Phase 3 seam work). |
| IN-06 | fixed | 357a2d8 | Non-positive t-nominal renders "Nominal thickness must be a number greater than 0."; smaller-than-OD copy fires only on the real OD comparison (blank-draft expectation updated accordingly). |
| IN-07 | fixed | c4ebaef | Footnote renders `YYYY-MM-DD HH:mm UTC`. |

### Verification record

- Gates ran in the main checkout `C:\Users\moham\Documents\Nebuis` on branch `fix/phase-2-review` (no isolated worktree; `build/phase-2` untouched — the orchestrator merges after re-verification).
- Criticals were re-reproduced empirically before fixing (CR-01: 3 failing probes; CR-02: 7 failing probes incl. the false immediate-inspection), and the failing state was observed in the suite before each fix commit.
- Fix-count: 16 of 17 findings fixed; 1 disposition recorded (IN-05). New test total 280 (from 242 baseline) — 38 added regression probes/pins, all hermetic.

---

_Reviewed: 2026-09-27T12:28:58Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
