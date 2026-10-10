# Phase 6: Report Digestibility & At-a-Glance Findings — Research

**Researched:** 2026-10-10
**Domain:** Presentation-layer composition of engine results (Screen 3 brief, PDF executive dashboard, verdict glossary) + demo dataset composition
**Confidence:** HIGH (all findings grounded in read source this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
1. **Plain-English brief on Screen 3** — top of Screen 3 above the results table: disposition sentence, next-action sentence, short narrative paragraph (counts by verdict + meanings), worst-locations list (top 3–5, one line each: location + verdict + plain-English why). **Zero `[[cite:]]` tokens in the brief body.** Deterministic TypeScript template from precomputed engine results — NOT LLM. The LLM never writes the summary of record.
2. **PDF executive dashboard (page 1)** — disposition banner, existing executive summary card, code-breakdown stats (counts per verdict and per criterion type passing/failing), top-10 worst CMLs table (location, t-actual, t-required, RL, verdict), what-to-do-next line. Detail register KEPT starting page 2 (top 100 + all reject/re-check) + "Full data: downloadable CSV" pointer line. Top-10 and stats are presentation compositions of `snapshot.summary` + `snapshot.readings` — reuse `getGoverningPdfReadings` ordering; worst-10 = first 10.
3. **Verdict glossary** — shared 3-line legend, SAME copy everywhere (results table footer, HTML report document, PDF page-1 footer). Plain consequence-led sentence FIRST, clause sub-line beneath composed from `citationRef` record fields only (cite-don't-quote). Locked copy: ACCEPT = "Wall thickness meets the code minimum at this location." / API 574 §10.5 · RE-CHECK = "Thickness is close to the limit — re-measure to confirm before deciding." / API 570 §6.4 · FAIL = "Wall is thinner than the code allows at this location. Action required." / API 570 §7.1.1. One shared source-of-truth constant consumed by all three renderers.
4. **Demo dataset** — primary one-click demo = human-sized deterministic committed subset of the Zenodo register (one tank section, ~200–500 readings, multi-campaign so CR/RL math is real). Secondary "Load full register (scale demo)" keeps the 4,912-row path. Subset preserves the exact column schema; provenance documented; attribution unchanged.

### Specifics
- Verdict chip strings `ACCEPT / RE-CHECK / FAIL` are repo-protected — glossary ADDS lines, never renames chips.
- Demo-subset CSV must parse through the same path (no special-casing).

### Scope boundary
Presentation and demo composition ONLY. Must not touch: any number computed by `lib/calc/` (golden-pinned G1–G14, P1–P7), the verdict banding order or governing `t_required` rule, citation allowlist mechanics (`lib/criteria/citations.json`, renderer-locked).

### Claude's Discretion
Implementation details within the locked structure (exact copy wording for non-locked strings, component decomposition, file layout) are planning discretion.

### Deferred Ideas (OUT OF SCOPE)
- Unit auto-conversion UX guard; Phase D branding badges; Phase E pipeline graph; interactive animated process graph with clickable drawers.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REPT-04 (SC1) | Plain-language "What we found" brief on Screen 3 | `buildFindingsBrief()` pure template over `evaluate()` output (Finding F1, F2); mounts above `ResultsTable` (F3) |
| REPT-05 (SC2) | Certified PDF page-1 executive dashboard; governing register page 2+ | Two-`<Page>` restructure of `buildPdfDocument`; code-breakdown from per-reading `tPressureMm/tStructuralMm` (F4, F5) |
| REPT-06 (SC3) | Verdict glossary everywhere a verdict chip appears | `VERDICT_GLOSSARY` constant in `lib/report/content.ts` pattern; **clause-id conflict must be resolved** (F6) |
| DEMO-01 (SC-support) | Human-sized primary demo subset + full-register secondary | Fixture-filter by Tank/GRID (not date) preserving ≥2 campaigns/CML; second reducer action (F7, F8) |
</phase_requirements>

## Summary

Every surface this phase touches already has the exact data it needs: `evaluate()` returns summary counts, per-reading verdicts, flags, remaining life, and both thickness branches (lib/calc/evaluate.ts:196-238); the PDF already has a worst-first governing register and an executive summary card (components/report/pdf-document.tsx:48-53, 61-94, 148-175); and `lib/report/content.ts` is the established server-safe, pure, node-testable seam that both renderers already share. The brief and dashboard are therefore pure template work with **no new computation and no new packages**.

Two findings materially affect planning. **First, a citation conflict:** the locked glossary copy cites API 574 §10.5, API 570 §6.4, and API 570 §7.1.1 — none of which is an id in `citations.json` (15 entries, verified). `citationRef()` renders zero glyphs for unknown ids (lib/report/content.ts:33-36), and hardcoding the clause string would violate cite-don't-quote. Verified against the API 570 PDF itself: §6.4 is "Extent of Visual External and CUI Inspections" and §7.1.1 is "General" (method-selection intro) — semantically wrong topics for RE-CHECK and FAIL. The sub-lines must be remapped to the nearest allowlist ids (recommended below) and gated behind a human checkpoint. **Second, the PDF is currently a single `<Page>`** — "page 1 = dashboard" requires splitting `buildPdfDocument` into two `<Page>` elements.

For the demo, the current one-click path statically imports a 4,912-row JSON fixture (lib/demo/demo-scenario.ts:28, 97-118). One tank alone (e.g. WBT-S6: 420 readings, 40 grid points, ~10.5 campaigns per CML) lands inside the 200–500 target with full multi-campaign history — the subset must filter by Tank/GRID identity, never by date, or it would manufacture `insufficient_history` rows.

**Primary recommendation:** Build three pure exports in `lib/report/content.ts` (`buildFindingsBrief`, `buildCodeBreakdown`, `VERDICT_GLOSSARY`), restructure `buildPdfDocument` into dashboard + register pages, and ship a tank-filtered fixture generated by a one-off script — gating the glossary clause-id remap behind `checkpoint:human-verify`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Findings brief (SC1) | lib/report/content.ts (pure template) | components/wizard/screen-results.tsx (mount) | Deterministic, node-testable, no LLM — same seam both renderers share |
| PDF dashboard (SC2) | components/report/pdf-document.tsx | lib/report/content.ts (pure helpers) | Server module; page structure is renderer concern |
| Code-breakdown stats (SC2) | lib/report/content.ts (pure counts) | pdf-document.tsx (render) | Counts derive from snapshot fields; keep pure for the node suite |
| Verdict glossary (SC3) | lib/report/content.ts | verdict-chip.tsx consumers (render adjacent) | One source of truth, three renderers, same as buildConclusions |
| Demo subset (SC4) | lib/demo/ (committed fixture + session builder) | lib/wizard/reducer.ts (second action) | Same parse path, static import, zero network |

## Key Findings (with file:line evidence)

**F1 — The engine seam already exposes everything the brief needs.** `evaluate()` returns `summary: { total, locations, accept, reCheck, fail }` (lib/calc/evaluate.ts:222-230) and readings carrying `verdict`, `rlYears`, `flags`, `cml`/`location`, `nextInspection`, `citations`, and `tPressureMm`/`tStructuralMm`/`tRequiredMm` (evaluate.ts:190-210). `t_required = max(t_pressure, t_structural)` is session-wide (one `ComponentMetadata` per evaluation, evaluate.ts:88-110), so "which criterion governs" is one deterministic fact derivable by comparing `tRequiredMm` to `tStructuralMm` — a presentation-level read of existing fields, not new math. Flag semantics for the brief's "why" text: `insufficient_history` / `measurement_inconsistency` / `outlier` (evaluate.ts:158-162) and `immediate_inspection` (evaluate.ts:167-177, G14 — set when RL ≤ 0 with valid positive CR; `nextInspection` stays null).

**F2 — `rlYears` null semantics constrain worst-list sorting.** `remainingLife()` returns null when history is absent (evaluate.ts:151; G14 nulls-never-Infinity). A `null` RL on a reject reading means "no computable life" (insufficient history), not "infinite life." Recommended canonical ordering for the top-3–5 brief list: rejects before re-checks; `immediate_inspection` first; then `rlYears` ascending; null RL last within its verdict class. This mirrors `getGoverningPdfReadings`' convention (`rlYears ?? Number.POSITIVE_INFINITY`, pdf-document.tsx:83-87) without touching it.

**F3 — The Screen 3 mount point and its precedent exist.** `ScreenResultsContent` renders `SummaryStrip` → hero card → KPI cards → controls → `ResultsTable` (components/wizard/screen-results.tsx:209-296); the brief mounts between the KPI cards and the controls/tabs section (or directly above `ResultsTable` at line 284). `screen-results.tsx` already imports a pure constant from `lib/report/content.ts` into this client component (line 43) — importing the brief builder from the same seam is established precedent. Existing legend is color dots only (lines 273-281); the glossary goes in the table footer area per locked decision 3.

**F4 — PDF is one `<Page>` today; the dashboard needs a structural split.** `buildPdfDocument` returns a single `<Page>` containing everything in flow order (pdf-document.tsx:134-338). "Page 1 = executive dashboard, detail from page 2" requires two `<Page>` elements inside the `<Document>` (dashboard page; register/conclusions/audit/sign-off page(s)). `@react-pdf/renderer` ^4.9.0 (package.json) supports multiple `<Page>` siblings natively; the existing `styles.summaryCard` block (pdf-document.tsx:48-53) is the dashboard card shell. The existing summary banner already emits disposition tone: "ACTION REQUIRED — DEFECTS DETECTED" etc. (pdf-document.tsx:150-157).

**F5 — Top-10 ordering caveat.** `getGoverningPdfReadings` (pdf-document.tsx:61-94) keeps ALL reject/re-check/immediate-inspection readings in **original array order** (pdf-document.tsx:74-80) and rl-sorts only the accept remainder. So "worst-10 = first 10" yields rejects in file order, not RL order. The locked decision accepts this reuse — but the brief's independent top-3–5 (F2 ordering) is the surface where true worst-first matters. With a 200–500-row demo subset (`totalCount <= limit`), `getGoverningPdfReadings` returns everything unfiltered (lines 70-72) — the top-10 table must slice the same ordering itself.

**F6 — CRITICAL: locked glossary clause ids are not in the citation allowlist.** `citations.json` contains exactly 15 ids (verified this session, full read): `asme_b31_3_304_1_2`, `api574_10_5_1_2`, `api574_10_5_1_3`, `api574_10_5_1_4`, `api574_annex_d`, `api570_7_6`, `api570_7_1_2_lt`, `api570_7_1_2_st`, `api570_7_1_2_governing`, `api570_7_2`, `api570_6_3_3_halflife`, `api570_table1`, `api570_6_3_4`, `asme_b31_3_344_3_2`, `asme_b31_3_344_4_2`. The locked sub-lines "API 574 §10.5", "API 570 §6.4", "API 570 §7.1.1" match none. `citationRef()` returns `""` for unknown ids (content.ts:33-36) and hardcoding clause strings is forbidden (AGENTS.md cite-don't-quote). Verified against the source PDF (pypdf, scratch/p6-clause-scan.py): API 570 5th Ed. §6.4 = "Extent of Visual External and CUI Inspections" (wrong topic for RE-CHECK); §7.1.1 = "General" ("The owner-operator may use either the point-to-point analysis method or a statistical analysis method…") (wrong topic for FAIL). See Recommendations for the remap.

**F7 — Demo load path and where the secondary option mounts.** Screen 1's "Explore a sample inspection" button dispatches `load-demo` (screen-ingest.tsx:185-192) → `loadDemo()` (lib/wizard/reducer.ts:546-557) → `createDemoSession()` (lib/demo/demo-scenario.ts:97-118), which statically imports `lib/demo/fixtures/zenodo-16780668-ut-register.json` (745 KB, 4,912 rows — verified by script) and hand-builds `ParsedRow`s through `buildCells` (demo-scenario.ts:100-106). The reducer also has an undispatched-from-UI `load-sample` action (tracer fixture, reducer.ts:517-544). The full-register secondary option mounts as a second button beside line 188 dispatching a new action (e.g. `load-demo-full`), and the provenance banner (app/page.tsx:32: "Demo scenario loaded — Zenodo record 16780668 subset") must distinguish subset vs full.

**F8 — Fixture shape and the history constraint on subsetting.** Verified by script against the fixture: 12 tanks (`WBT-P1..P6`, `WBT-S1..S6`), 40 `Grid_Position`s each, monthly campaigns 2015-03 → 2025-06 (~128 months), 480 distinct CMLs, 2–19 campaigns per CML (median 10). Any single tank yields 382–438 readings — inside the 200–500 target with intact per-CML history. `groupByCml` derives `t_initial`/`t_previous` from the date-sorted group (lib/ingest/group.ts:92-137); a date-window filter would amputate history and manufacture `insufficient_history`, so the subset generator must filter by Tank (optionally + first-k grids) only. The demo metadata preset depends on the 18.88–20.0 mm thickness spread landing all three verdict bands (demo-scenario.ts:7-12) — the subset must be verified to still hit ACCEPT/RE-CHECK/FAIL with the identical preset. Schema: `DEMO_HEADERS` six columns (demo-scenario.ts:32-39); the committed CSV in `public/sample-ut-register.csv` mirrors this.

## Recommendations (per locked decision)

**Decision 1 — Brief.** Add to `lib/report/content.ts`: `export interface FindingsBrief { dispositionSentence: string; nextActionSentence: string; narrative: string; worstLocations: Array<{ name: string; verdict: Verdict; why: string }> }` and `export function buildFindingsBrief(summary, readings): FindingsBrief` — pure, template-composed, zero `[[cite:]]`, no LLM input. Inputs exactly what Screen 3 holds (`results.summary`, `results.readings`); no new session plumbing. Worst-list uses F2 ordering, top 3–5 (all non-accept readings when ≤ 5). "Why" strings derive deterministically from verdict + flags + governing branch (e.g. reject + `tRequiredMm == tStructuralMm` → "below the structural minimum thickness"; `immediate_inspection` → "no safe service life remaining"). Mount a small client component (e.g. `components/wizard/findings-brief.tsx`) above `ResultsTable` (screen-results.tsx:284).

**Decision 2 — PDF dashboard.** Split `buildPdfDocument` into `<Page>` 1 (dashboard: disposition banner + existing summary card + code-breakdown grid + top-10 table + what-to-do-next + glossary footer) and `<Page>` 2+ (component context, PT/MT triage, governing register, conclusions, audit, sign-off). Add pure `buildCodeBreakdown(summary, readings)` in content.ts: per-verdict counts (already in `summary`) + passing/failing counts against each criterion branch computed as `tActualMm` vs `tPressureMm` and vs `tStructuralMm` comparisons (6-dp rounding convention, mirroring lib/calc/round.ts usage in verdicts.ts:27-28 — presentation-level comparison of already-emitted fields, no new calc). Top-10 = `getGoverningPdfReadings(snapshot.readings, 10)` or first 10 of the existing call's ordering (F5). CSV pointer = plain text line on the register page (no export endpoint exists — verified `app/api/` has health/reasoning/report/spike only; a future endpoint is out of scope per the decision's intent).

**Decision 3 — Glossary.** Add `VERDICT_GLOSSARY: Record<Verdict, { plain: string; citationId: string | null }>` to `lib/report/content.ts` (CONTEXT.md suggests `lib/report/verdict-glossary.ts`; content.ts is the established shared seam — either is acceptable, recommend content.ts to keep one seam). Plain sentences = the locked copy verbatim. Clause sub-lines composed ONLY via `citationRef(citationId)`. **Recommended remap (needs `checkpoint:human-verify` — see Pitfalls P1):** ACCEPT → `api574_10_5_1_4` (renders "API 574 §10.5.1.4" — the governing t_required selection rule; §10.5.1.4 is inside §10.5), FAIL → `api570_7_6` (renders "API 570 §7.6" — Required Thickness Determination), RE-CHECK → `api570_7_1_2_governing` (renders "API 570 §7.1.2" — whose text covers measurement error bands; verified in the source PDF) **or `null`** (no sub-line) — the `citationId: null` pattern already exists in `ConclusionLine` (content.ts:45-48). Render from: Screen 3 table footer, `report-document.tsx` conclusions section (~line 424), `pdf-document.tsx` page-1 footer. Never alter `verdict-chip.tsx` strings (verdict-chip.tsx:11-24, 36-38).

**Decision 4 — Demo subset.** Write a one-off generator script (`scripts/generate-demo-subset.mjs` or .py) that filters the fixture to one tank (recommend `WBT-S6`, 420 readings — mid-range), emitting `lib/demo/fixtures/zenodo-16780668-ut-register-subset.json` with the identical six-column schema. Add `createDemoSessionFull()` (or a parameter) in demo-scenario.ts; rewire `load-demo` → subset; add secondary "Load full register (scale demo)" button → new `load-demo-full` action (reducer.ts:579-584). Update the provenance banner copy (app/page.tsx:32) and the Screen 1 blurb (screen-ingest.tsx:195 "4,912 real readings" → subset count). Keep the full fixture and its `tests/ingest/demo-fixture.test.ts` pin untouched; add a parallel subset-fixture test file.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Worst-first ordering | Custom sort chain per surface | `getGoverningPdfReadings` (PDF) + F2 convention (brief) | Ordering is already merged, tested by A-remediation, and consistent |
| Citation rendering | Literal "API 570 §6.4" strings | `citationRef()` from record fields (content.ts:33-36) | Cite-don't-quote is enforced exactly there; unknown id renders zero glyphs |
| Multi-page PDF flow | Manual pagination hacks | `@react-pdf/renderer` `<Page>` siblings + `wrap` on table rows | Already used (every table row has `wrap={false}`, pdf-document.tsx:211, 251) |
| Demo parsing path | A special subset loader | Same static-import + `buildCells` path (demo-scenario.ts:100-106) | One uniform `ParsedRow` shape; T-02-08 null-prototype guarantee holds |

## Common Pitfalls

### P1: Rendering the locked clause ids as written
**What goes wrong:** "API 570 §6.4" hardcoded renders fine but breaches cite-don't-quote; passed through `citationRef()` it renders "" (unknown id) — a silently missing sub-line. Worse, the locked clauses are semantically wrong (§6.4 is CUI inspection extent; §7.1.1 is method selection — verified in the source PDF).
**Why it happens:** The locked copy predates the allowlist mapping.
**How to avoid:** Remap to nearest allowlist ids (Recommendation 3) and gate with `checkpoint:human-verify`. Never add ids to `citations.json` in this phase (renderer-locked scope boundary).
**Warning signs:** Glossary sub-line missing in render; audit test asserting non-empty `citationRef` fails.

### P2: One-`<Page>` PDF renders dashboard and register interleaved
**What goes wrong:** Adding dashboard blocks above the existing content in the single `<Page>` does not guarantee page 1 contains only the dashboard — the register table wraps mid-dashboard.
**How to avoid:** Two `<Page>` elements; the register page's own flow handles multi-page spillover. Keep every `<View>` row `wrap={false}` as existing code does.
**Warning signs:** `tests/pdf/react-pdf-smoke.test.ts` and `tests/report/pdf-route.test.ts` snapshots shift; page-2 footer numbering wrong.

### P3: Date-window demo subsetting manufactures data-quality flags
**What goes wrong:** Filtering rows by campaign date leaves tail campaigns per CML, so `t_initial`/`t_previous` become null and `insufficient_history` floods the demo — the brief reads "most readings have insufficient history," the opposite of the demo story.
**How to avoid:** Filter by Tank (and optionally first-k `Grid_Position`s) only; verify every retained CML keeps ≥ 2 campaigns.
**Warning signs:** Subset fixture test showing campaign-per-CML minimum < 2.

### P4: Brief regressions on degenerate evaluations
**What goes wrong:** All-ACCEPT sessions (no worst locations), zero-reject-only-flags sessions, or single-reading sessions produce empty/awkward brief sentences; a reject reading with null `rlYears` sorts to the bottom as if safest.
**How to avoid:** Define the degenerate contracts in the builder itself (pure): all-accept → disposition "All N readings meet the code minimum" with an empty worst list; null-RL handling per F2. Node-test each.
**Warning signs:** `filterReadings(..., "attention", ...)` empty-state (screen-results.tsx:284-287) coexisting with a brief that promises "locations needing attention."

### P5: `locations` count vs CML count confusion in the disposition sentence
**What goes wrong:** `summary.locations` counts distinct mapped Tanks (evaluate.ts:224-226), not CMLs; the worst list names CMLs (`cml ?? location`). "2 of 4,912 failed at CML-014" mixes granularities — with one-tank demo subsets, "1 location" reads oddly.
**How to avoid:** Disposition sentence cites reading counts; worst list cites CML/grid names; never call `summary.locations` "CMLs" (note the existing PDF card already mislabels total as "Total CMLs", pdf-document.tsx:161 — optional copy fix within discretion).

### P6: Client/server boundary drift
**What goes wrong:** Adding narrative-store or LLM imports into the brief path breaks the deterministic invariant and the server-safe content seam (content.ts:8-13 — no "use client", imports only criteria + types).
**How to avoid:** Brief builder consumes only `summary` + `readings` plain data; keep content.ts isomorphic; the Nemotron per-CML narrative stays in its existing pane, untouched.

## Test Matrix

Existing (vitest 5, `npm test`): `tests/ingest/demo-fixture.test.ts` (4,912 rows / columns / tanks / campaign years / thickness range pins), `tests/ingest/group.test.ts`, `tests/report/report-contract.test.ts` (content-seam pure functions), `tests/report/pdf-route.test.ts` + `tests/pdf/react-pdf-smoke.test.ts` (PDF render), `tests/wizard/results.test.ts` + `screen3-integration.test.tsx` (Screen 3), `tests/wizard/reducer.test.ts` (load-demo path).

New tests per decision:
1. **Brief builder** (extend `tests/report/report-contract.test.ts` or new `tests/report/findings-brief.test.ts`): disposition sentence counts (mixed / all-accept / single-reading); worst-list ordering (reject-before-re-check, immediate-inspection first, rl ascending, null-RL last); top 3–5 cap; zero `[[cite:` tokens invariant; determinism (same input → identical output, no Date.now).
2. **Code-breakdown** (same file): branch passing/failing counts vs `tPressureMm`/`tStructuralMm` on a synthetic snapshot; sums reconcile with `summary.total`.
3. **Dashboard composition** (extend `tests/pdf/react-pdf-smoke.test.ts`): two-page document renders; top-10 table has exactly 10 rows on a >100 snapshot; CSV pointer text present; glossary footer present on page 1.
4. **Glossary** (new cases in report-contract + smoke): all three renderers consume the same constant (import graph assertion); every `citationId` resolves via `citationRef` to a non-empty string; chip labels unchanged (existing verdictLabel pins).
5. **Subset fixture** (new `tests/ingest/demo-subset-fixture.test.ts`, mirroring demo-fixture.test.ts): 200–500 rows; exactly one Tank; exact six-column schema; every CML ≥ 2 campaigns; all three verdict bands present under `DEMO_METADATA` preset; strict ISO date parse passes.
6. **Reducer** (extend `tests/wizard/reducer.test.ts`): `load-demo` yields subset session; new `load-demo-full` yields 4,912-row session; both set screen 2 and pass `validateSession`.

## Security Domain

`security_enforcement: true`, ASVS Level 1. Presentation-only phase: no new endpoints, auth, crypto, or storage. Applicable controls: **V5 Input Validation** — demo subset flows through the same null-prototype `buildCells` path (csv.ts:150-159, T-02-02 hold); no new parsing. **Information exposure** — the brief/dashboard must not leak LLM telemetry or narrative text into the summary of record (invariant preserved: engine facts only). The CSV pointer is static text — no user data interpolation. STRIDE: Tampering risk only if dashboard copy embedded untrusted strings — all copy is template constants; reading-derived strings (CML names) render through react-pdf `Text` (auto-escaped) and React (auto-escaped). No deviations.

## Package Legitimacy Audit

**No external packages are installed by this phase** (verified: all work uses existing `@react-pdf/renderer` ^4.9.0, React 19, vitest 5 — package.json). Audit table: not applicable. Generator script uses Node built-ins only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | RE-CHECK glossary sub-line maps to `api570_7_1_2_governing` (measurement-error framing) or renders null | Recommendations 3 | User may prefer a new verified citation entry (out of scope boundary) — checkpoint covers it |
| A2 | `WBT-S6` (420 readings) chosen as the primary tank | Recommendations 4 | If its verdict spread under `DEMO_METADATA` misses a band, pick another tank — subset test catches it before merge |
| A3 | Top-3–5 brief list cap "3–5" resolves to "min(5, count)" | Recommendation 1 | Cosmetic only |
| A4 | CSV pointer remains non-functional text this phase | Recommendation 2 | If user expects a live link, small follow-up (export route) needed |

## Open Questions

1. **Glossary clause-id remap** — confirm ACCEPT→§10.5.1.4, FAIL→§7.1.1→§7.6 swap, RE-CHECK→§7.1.2-or-null at the human checkpoint (P1). Recommendation: present the rendered strings side-by-side with the locked copy.
2. **Top-10 ordering** — accept file-order within the flagged block (locked reuse, F5) or rl-sort the top-10 slice? Recommendation: accept locked reuse; the brief carries true worst-first.

## Sources

### Primary (HIGH confidence — read this session)
- lib/calc/evaluate.ts:88-239, lib/calc/verdicts.ts:1-33 (engine output shape, banding)
- lib/report/content.ts:1-108 (content seam, citationRef, citations-null pattern)
- components/report/pdf-document.tsx:27-341 (single Page, summaryCard, getGoverningPdfReadings)
- components/wizard/screen-results.tsx:1-496, screen-ingest.tsx:184-198, verdict-chip.tsx:1-71
- lib/ingest/group.ts:68-140, lib/ingest/csv.ts:150-159, lib/criteria/citations.json (full read, 15 ids), ut-criteria.json verdict_bands
- lib/demo/demo-scenario.ts:1-118, lib/wizard/reducer.ts:495-604, app/page.tsx:32
- API 570 5th EDITION.pdf pp. 54, 61-62 via pypdf (§6.4, §7.1.1, §7.1.2 headings and text)

### Secondary
- Fixture statistics computed by script (row/tank/campaign counts)
- tests/ingest, tests/report, tests/pdf, tests/wizard inventory (test matrix grounding)

## Metadata

**Confidence breakdown:** Standard stack HIGH (no new packages; all existing code read) · Architecture HIGH (seam patterns established in Phase 4) · Pitfalls HIGH (P1 verified against source PDF and allowlist).
**Research date:** 2026-10-10 · **Valid until:** 2026-11-09 (stable; repo-derived)
