# Phase 2: Ingestion & Deterministic Calc Engine - Research

**Researched:** 2026-09-27
**Domain:** CSV ingestion + pure-TS engineering calc engine (API 570 / API 574 / ASME B31.3) in Next.js 16
**Confidence:** HIGH (repo-grounded: all rules read verbatim from `lib/criteria/*.json` this session; all golden values hand-computed and re-computed in node v24.14.1; API 570 Table 1 independently re-extracted from the local PDF via pypdf)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Wizard Screens (locked — handoff.md §5)**
- Screen 1 — Landing & Ingestion: CSV dropzone + prominent "Load Demo Scenario" button (preloaded Zenodo ballast-tank subset, 4,912 real readings) + sample CSV download template + format guide.
- Screen 2 — Data Review & Component Metadata: editable parsed-row table with per-row validation badges and column-mapping dropdowns; metadata form: OD, t-nominal, FCA, Design Code, Piping Class (1-3), Gauge Uncertainty (±0.1 mm default, user-configurable), optional PT/MT notes.

**Calculation Rules (locked — lib/criteria/ut-criteria.json, machine source of truth)**
- `t_required = max(t_pressure, t_structural)` — governing rule added 2026-09-27 (API 574 §10.5.1.4, verified); t_pressure via ASME B31.3 Eq. 3a `t = (P*OD)/(2*(S*E*W + P*Y)) + FCA` or API 574 Barlow in-service `t = (P*OD)/(2*S*E)`; t_structural from API 574 Annex D tables.
- Corrosion rates: CR_LT and CR_ST per API 570 §7.1.2; governing = max(LT, ST), both surfaced. Negative CR → clamp to 0 for RL + "measurement inconsistency" warning flag (negative_cr_policy).
- Remaining life: RL = (t_actual − t_required) / CR_governing; zero/negative CR after clamp → "insufficient corrosion history" state, never Infinity.
- Inspection interval: min(RL/2, class max); RL < 4 yr → min(RL, 2.0). Class maxima (VERIFIED against API 570 5th Ed. Table 1 p.52 on 2026-09-27): Class 1 = 5 yr, Class 2 = 10 yr, Class 3 = 10 yr, Class 4 = optional. (adversarial_review_v2's "Class 2 = 5 yr" claim was REFUTED — that value is the visual-external column.)
- Verdict bands (with boundary_convention, implement in exactly this order): `if (t_actual < t_required) reject; else if (t_actual < t_required + gauge_uncertainty) re_check; else accept`. Gauge uncertainty ±0.1 mm default.
- PT/MT indication acceptance per lib/criteria/ptmt-criteria.json (ASME B31.3 §344.3.2/§344.4.2): >1.5 mm relevance; linear (L>3W) strict reject; rounded reject if >5.0 mm or ≥4 in a line separated by ≤1.5 mm.

**Engineering Constraints (locked)**
- `lib/calc/` = pure TypeScript, zero imports from `lib/llm/` — enforced by forbidden-import lint. LLM never computes.
- Units: mm canonical internally; explicit at input (mm/in/mils); mixed units refused; unit assumption surfaced.
- Deterministic math is unit-tested pure functions — golden tests double as demo seed (Zenodo record 16780668 subset) and cached-LLM keys later.
- CSV parsing: column-mapping preview with confirm/correct; row-level specific validation errors; malformed/missing/impossible values rejected loudly. Prefer a zero-dependency parser unless the planner justifies a new package — ANY new package requires explicit user approval (checkpoint).

### Claude's Discretion
Internal calc-engine module structure, fixture file format, table/grid UI component choices, exact validation-error wording — all within the constraints above.

### Deferred Ideas (OUT OF SCOPE)
- Fleet triage table, CML trend charts (v2 per REQUIREMENTS.md)
- User-pasted code-excerpt reasoning (v2)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ING-01 | Upload UT CSV + confirmable column-mapping preview | Parser spec (RFC 4180 edge cases), auto-guess alias table (UI-SPEC verbatim), `lib/ingest/map.ts` design |
| ING-02 | Validate uploads with specific error messages | Error taxonomy (parse errors vs row issues), row-error catalog, exact `Row {n}: …` pattern (UI-SPEC:159) |
| ING-03 | Component metadata drives criteria selection | Metadata schema, zod-at-boundary house pattern, design-conditions gap (pressure unit) flagged in Open Questions |
| ING-04 | PT/MT indication notes with context | `lib/calc/ptmt.ts` verdict model, structured-indication repeater → engine input shape, crack-suspect RE-CHECK mapping |
| ING-05 | Units explicit at input, mm canonical, assumption surfaced | `units.ts` conversion constants (25.4 / 0.0254 exact), canonical-rounding policy, float-drift evidence |
| CALC-01 | t-required, CR LT/ST, RL in pure unit-tested code | Golden Test Catalog G1–G5, G9–G10, G12; module structure; criteria-JSON loading rule |
| CALC-02 | Pass / re-check / fail verdicts per CML and indication | Verdict band implementation note (verbatim), boundary golden cases G8, PT/MT cases P1–P7 |
| CALC-03 | Re-inspection interval citing rule used | Interval rule (verbatim), class maxima re-verified against local API 570 PDF, citation-id mapping table |
| CALC-04 | Flag statistical outliers / re-shoot candidates | Modified z-score (median/MAD) recommendation, G11 with hand-shown values, per-CML population rule |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

Workspace `AGENTS.md` directives (treat as locked):
1. **All formulas, material coefficients, and flaw acceptance rules MUST be loaded from `lib/criteria/`** (`citations.json`, `ptmt-criteria.json`, `ut-criteria.json`). **LLMs must never perform arithmetic, invent clause citations, or alter acceptance limits** — all arithmetic in pure TypeScript under `lib/calc/`.
2. PDF access: use `pypdf` via Python scripts on disk (UTF-8 reconfigure); never `pdfplumber` for whole-document scans; never `view_file` on PDFs. (Used this session to verify Table 1.)
3. Windows PowerShell: no complex multiline inline Python; write scripts to `scratch/` and run `python <path>`.

Phase-1 house patterns that bind Phase 2 (from `01-PATTERNS.md:328-366`): env-only config, three-tier error conventions (config throws / validated calls retry-then-throw / health degraded body), **"Zod at every parse boundary"** (the CSV file is an untrusted parse boundary — use zod, already installed, for row/metadata schemas), import alias `@/*`, `lib/calc/` must never import `lib/llm/`.

## Summary

Phase 2 is two engines plus three wizard screens. The calc engine is fully specified by `lib/criteria/*.json` (read verbatim this session) — the TS job is to implement the formula *structures* while loading every constant (class maxima, gauge uncertainty, PT/MT limits, relevance threshold) from the JSON so the criteria files remain the single source of truth. Every number a golden test asserts is hand-verified in this document, including the two boundary equalities the UI-SPEC locks (`t_actual == t_required` → RE-CHECK; `== t_required + uncertainty` → ACCEPT) and the API 570 Table 1 class maxima, which I re-extracted from the local API 570 5th Ed. PDF (p.52): **Class 1 = 5 yr, Class 2 = 10 yr, Class 3 = 10 yr (Thickness Measurements column)** — independently confirming CONTEXT.md's refutation of adversarial_review_v2's "Class 2 = 5 yr" (that value is the Visual External column).

Ingestion needs a hand-rolled, quote-aware CSV tokenizer (~60 lines, RFC 4180 rules verified verbatim this session) plus a semantic validation layer whose row errors render in the locked pattern `Row {n}: {field} — {problem} ({value}).`. The largest *undocumented* engineering decision is that the flagship Zenodo dataset is **long-format** (one row per reading per annual campaign, ~10–11 rows per CML): the engine must group rows by CML (Tank + Grid_Position), sort by date, and *derive* t-initial/t-previous per reading — the optional mapped t-initial/t-previous columns serve wide-format gauge exports instead. Float safety is the second hidden trap: unit conversion through 0.0254 (mils→mm) and the B31.3 division both produce 1e-16-scale drift that can flip the locked boundary equalities and the `RL < 4 yr` branch; a documented canonical-rounding policy (round at public function exits) is recommended below and baked into the golden values.

Zero new packages. zod 4.6.5 (installed) covers parse-boundary validation per the house pattern; parsing, dates, and units are small deterministic hand-rolls the locked checkpoint rule prefers over supply-chain surface.

**Primary recommendation:** Build `lib/calc/` (8 small pure modules + JSON criteria loader) and `lib/ingest/` (parser, validator, mapper) as test-first pure TypeScript wired to a client-side wizard reducer; commit the full Zenodo Appendix A as a static JSON fixture with CC BY 4.0 attribution; implement the golden catalog below as `tests/calc/*.test.ts` before wiring UI.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CSV tokenization + BOM/delimiter handling | Client (browser) | — | UI-SPEC: "parse is local + fast", no skeleton needed; file never leaves the browser |
| Row validation + column auto-guess | Client (browser) | — | Re-runs on every mapping change (UI-07); must be synchronous and cheap (4,912 rows ≈ ms) |
| CML campaign grouping (t-initial/t-previous derivation) | Client, in `lib/ingest` | — | Pure data transform between ingestion and calc; feeds engine inputs |
| t-required / CR / RL / interval / verdict / outlier / PT-MT math | Client, in `lib/calc` (pure TS) | — | Locked: deterministic, unit-tested, zero `lib/llm` imports; runs identically in vitest node env and browser |
| Criteria constants (thresholds, maxima, clauses) | `lib/criteria/*.json` (data) | — | Machine source of truth; engine reads values, never hard-codes them |
| Wizard state (session model) | Client React state (reducer/context) | — | No server persistence in Phase 2; JSON-serializable contract exported for Phase 3/4 |
| Demo data delivery | Build-time static import | — | Locked: "zero network beyond page load" → static JSON import, no runtime fetch |
| File download (sample CSV) | Static asset in `public/` | — | User-initiated `<a download>`; same-origin static file |

## Standard Stack

### Core (all already installed — zero new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| typescript | 5.9.3 | Engine + types (`strict: true`, `resolveJsonModule: true` already set) | [VERIFIED: package.json + UNINSTALL.md] |
| zod | 4.6.5 | Parse-boundary validation (CSV rows, metadata form) per house pattern "Zod at every parse boundary" | [VERIFIED: package.json:21; house pattern 01-PATTERNS.md:348] |
| vitest | 5.0.2 | Golden tests; existing config `tests/**/*.test.ts`, node env, `@` alias | [VERIFIED: vitest.config.ts:18-19] |
| next | 16.3.6 | App Router wizard screens ('use client' components) | [VERIFIED: package.json:17] |
| react | 19.3.0 | Paginated tables, forms; no virtualization dependency (UI-13) | [VERIFIED: package.json:18-19] |
| tailwindcss | ^4 (4.3.3) | UI per 02-UI-SPEC design system (no component library) | [VERIFIED: package.json:30] |

### Not used (deliberately)
| Library | Why not |
|---------|---------|
| papaparse / csv-parse | Locked checkpoint rule prefers zero-dependency parser; dataset is 6 simple columns; RFC 4180 spec verified — hand-rolled is ~60 lines and fully under test |
| dayjs / date-fns | Only date need is strict ISO parse + year-difference + add-years; ~25 hand-rolled lines with documented UTC rules; avoids `new Date(string)` traps (demonstrated below) |
| tanstack virtual / react-window | 50-row pagination locked (UI-13); virtualization pays off only for smooth-scrolling tens of thousands of rows [CITED: multi-source search, itnext.io 50k-row benchmark] |
| decimal.js / big.js | Canonical rounding policy (round-at-exit) removes the need; keeps engine dependency-free |

**Installation:** none. **Any install requires explicit user approval (CONTEXT.md checkpoint) + UNINSTALL.md ledger entry.**

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none — no new packages proposed) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Zero-install phase. If the planner elects to add any package, the CONTEXT.md checkpoint rule applies: `checkpoint:human-verify` task + UNINSTALL.md Phase 2 ledger entry before install.*

## Golden Test Catalog (Hand-Verified)

Every expected value below was computed by hand and re-computed in node v24.14.1 this session. Unit convention: mm canonical, years for time. **Canonical-rounding policy** (recommended, see Architecture Patterns R4): round at public-function exits — t_required/CR to 6 dp, RL to 4 dp, interval to 2 dp, z to 4 dp. Golden values below are stated at that canonical precision.

**Shared metadata for cases G1–G8:** P = 4.0 MPa, OD = 114.3 mm, S = 138 MPa, E = 1.0, W = 1.0, Y = 0.4, FCA = 1.0 mm, gauge uncertainty = 0.1 mm unless stated.

### Formula-level cases (pass Δt directly — pure math, no date convention)

**G1 — B31.3 Eq. 3a pressure thickness (citation `asme_b31_3_304_1_2`):**
t_pressure = (P·OD)/(2·(S·E·W + P·Y)) + FCA = (4.0 × 114.3)/(2 × (138 + 4.0×0.4)) + 1.0 = 457.2/279.2 + 1.0 = 1.637535816618911 + 1.0 → **t_required = 2.637536 mm** (t_structural = 0, structural branch empty).

**G2 — API 574 Barlow in-service (citation `api574_10_5_1_2`):**
t_pressure = (4.0 × 114.3)/(2 × 138 × 1.0) + 1.0 = 457.2/276 + 1.0 = 1.6565217391304348 + 1.0 → **t_required = 2.656522 mm**.

**G3 — Governing max selects structural branch (citation `api574_10_5_1_4`):**
Same as G1 plus t_structural = 6.0 mm → max(2.637536, 6.0) → **t_required = 6.0 mm**. Result object must report `tPressureMm = 2.637536` alongside.

**G4 — Corrosion rates (citation `api570_7_1_2_lt` / `_st` / `_governing`):**
t_initial = 10.0, t_previous = 9.5, t_actual = 9.2, Δ_LT = 10.0 yr, Δ_ST = 1.0 yr →
CR_LT = (10.0 − 9.2)/10.0 = **0.080 mm/yr**; CR_ST = (9.5 − 9.2)/1.0 = **0.300 mm/yr**; governing = max = **0.300 mm/yr**.

**G5 — Remaining life + interval (citations `api570_7_2`, `api570_6_3_3_halflife`, `api570_table1`):**
t_actual = 9.2, t_required = 2.637536 (from G1), CR_gov = 0.300 → RL = 6.562464/0.300 = 21.87488 → **RL = 21.8749 yr** (4 dp).
Interval: RL ≥ 4 → min(RL/2, class max) → RL/2 = 10.93745 → **Class 1: 5.00 yr; Class 2: 10.00 yr; Class 3: 10.00 yr** (10.93745 > 10 caps Class 2/3 — exercises the class-maximum cap).

**G6 — `RL < 4 yr` branch (NOT naive RL/2):** deficit 0.9 mm, CR = 0.300 → RL = 3.0 yr < 4 → interval = min(3.0, 2.0) = **2.00 yr** (assert it is 2.00, not 1.50 — this single assertion proves the branch is implemented).

**G7 — Interval floor/cap interactions:** RL = 1.0 yr → min(1.0, 2.0) = **1.00 yr**; RL = 40 → RL/2 = 20 → Class 1 → **5.00 yr**.

**G8 — Verdict boundary equalities (t_required = 5.0, uncertainty = 0.1; locked order `if (t_actual < t_required) reject; else if (t_actual < t_required + gauge_uncertainty) re_check; else accept` — quote at `ut-criteria.json:93`):**

| t_actual | Expected | Why |
|----------|----------|-----|
| 5.0 | `re_check` | exact equality with t_required is RE-CHECK (UI-16 locked) |
| 5.099 | `re_check` | strictly below t_required + uncertainty |
| `t_required + 0.1` (constructed by arithmetic, not the literal `5.1`) | `accept` | accept floor == re_check ceiling, no gap no overlap |
| 4.99 | `reject` | strictly less than t_required |
| 5.0 with uncertainty = 0 | `accept` | accept branch `>=` wins at equality when the amber band has zero width |

Float evidence: `5.0 + 0.1 === 5.1` is `true` in node v24 (verified), but tests MUST construct the boundary via arithmetic (`tActual: tReq + unc`) so the comparison is bit-identical regardless of literal rounding.

**G9 — Negative CR policy (quote at `ut-criteria.json:66`):**
(a) Both rates negative: t_initial 9.0@2015, t_previous 9.1@2024, t_actual 9.2@2025 → CR_LT = −0.020, CR_ST = −0.100, raw governing = −0.020 → **floored to 0 → RL = null ("insufficient corrosion history"), MEASUREMENT INCONSISTENCY flag, raw rates surfaced verbatim** (−0.020 / −0.100).
(b) Mixed: t_initial 9.0, t_previous 9.3, t_actual 9.2 → CR_LT = −0.020 (negative), CR_ST = +0.100 → **governing stays 0.100 (positive), flag still fires (either raw rate negative), RL = (t_actual − t_required)/0.100**. Both raw values remain visible. Recommended interpretation — see Open Questions OQ2.

**G10 — Insufficient history (no rates):** t-initial and t-previous both unavailable (unmapped columns AND first-campaign reading) → CR_LT/CR_ST/governing = null, RL = null, interval = null, `INSUFFICIENT HISTORY` flag; **verdict still computes from t_actual vs t_required alone** (UI-SPEC CR-degradation policy, line 266).

**G11 — Outlier, modified z-score (median/MAD, Iglewicz-Hoaglin):**
CML history [8.3, 9.19, 9.2, 9.2, 9.21] (n = 5) → median = 9.2; |deviations| = [0, 0, 0.01, 0.01, 0.9] → MAD = 0.01; modified z of 8.3 = 0.6745 × (8.3 − 9.2)/0.01 = **−60.7050 → |z| = 60.7050 > 3.5 → OUTLIER flag**; 9.19 → 0.6745 × 0.01/0.01 = **0.6745 → no flag**. Verdict band still renders independently (UI-18: outliers warn, never override).

**G12 — mils units end-to-end (traces to MSTS worked example "remaining life = (465 − 440)/5 = 5 years" [CITED: .planning/research/FEATURES.md:50]):**
t_actual 465 mils = 11.811 mm; t_required 440 mils = 11.176 mm; CR 5 mils/yr = 0.127 mm/yr → RL = 0.635/0.127 = 5.0 yr (raw double: 4.999999999999998 — canonical rounding restores 5.0) → Class 1 interval = min(2.5, 5.0) = **2.50 yr**. This case proves the mm-canonical pipeline and the rounding policy in one shot.

### Date-convention case (pins the one convention, isolated from formula tests)

**G13 — date difference convention:** UTC days 2015-01-15 → 2025-01-15 = **3653 days** (verified); Δt = 3653/365.25 = **10.001369 yr**. 2024-01-15 → 2025-01-15 = **366 days** → **1.002053 yr**. (Convention: Δt_years = UTC-day difference / 365.25 — see R5.)

### PT/MT cases (all limits verbatim from `ptmt-criteria.json:9,21-27`)

| # | Input | Expected | Rule |
|---|-------|----------|------|
| P1 | MT, L 4.2, W 0.8 | `fail` + clause `344.3.2` | relevant (4.2 > 1.5); linear since L > 3W (4.2 > 2.4) → strict reject |
| P2 | PT, L 2.0, W 1.9 | `accept` | relevant (2.0 > 1.5); rounded (2.0 ≤ 5.7); 2.0 ≤ 5.0 |
| P3 | PT, L 6.0, W 5.5 | `fail` | rounded (6.0 ≤ 16.5); 6.0 > 5.0 → reject |
| P4 | MT, L 1.5, W 1.2 | `accept` ("non-relevant") | max dim 1.5 is NOT > 1.5 (strict) → below relevance threshold |
| P5 | MT, L 1.2, W 0.9, crack-suspect = true | `re_check` | only inferred mapping (UI-SPEC declares this inferred) |
| P6a | rounded, count 4, edge sep 1.2 | `fail` ("aligned cluster") | count ≥ 4 AND sep ≤ 1.5 |
| P6b | rounded, count 3, sep 1.2 | per-size verdict | below cluster threshold |
| P6c | rounded, count 4, sep 1.6 | per-size verdict | sep > 1.5 (boundary: sep == 1.5 IS a cluster) |
| P7a | L 3.0, W 1.0 | `accept` | L == 3W is **rounded** (linear is strictly L > 3W) |
| P7b | L 3.1, W 1.0 | `fail` | now linear |

### Demo-fixture assertions (Zenodo subset)

| Assertion | Expected |
|-----------|----------|
| Data rows | exactly **4,912** |
| Distinct Tank values | **12** (WBT-P1..P6, S1..S6 per FEATURES.md — eyeball names at download) |
| Distinct campaign years | **11** (2015–2025) |
| Columns | exactly `Reading_ID, Tank, Grid_Position, Original_Scantling_mm, Measured_Thickness_mm, Measurement_Date` |
| Original_Scantling_mm | 20 (constant) |
| Measured_Thickness_mm range | 19.0 – 19.98 |
| Date format | ISO `YYYY-MM-DD` (parseable by the strict parser) |

## Architecture Patterns

### System Architecture Diagram

```
                        Screen 1 (Ingestion)
  ┌─────────────┐   drop/browse   ┌──────────────────────┐
  │ user file   │──────────────►  │ lib/ingest/csv.ts    │  tokenize (RFC 4180 state machine)
  │ (.csv)      │                 │  strip BOM → header  │  structural errors: line {n}
  └─────────────┘                 └──────────┬───────────┘
        ▲                                    │ string[][] + headers
        │ "Try another file"                 ▼
        │                        ┌──────────────────────┐
  ┌─────┴──────────┐             │ lib/ingest/map.ts    │  normalize headers, auto-guess
  │ lib/demo/      │             │  aliases → mapping   │  user confirms/corrects
  │ fixtures/*.json│───────┐     └──────────┬───────────┘
  │ (Zenodo subset)│       │                │ mapped columns
  └────────────────┘       │                ▼
                           │     ┌──────────────────────┐
                           │     │ lib/ingest/validate.ts│  zod + catalog rules
                           │     │  → RowIssue[]        │  ERROR blocks / WARNING flags
                           │     └──────────┬───────────┘
                           │                │ valid rows
                           │                ▼
  Screen 2 (Review & Metadata)          ┌──────────────────────┐
  metadata form ───────────────────────►│ lib/ingest/group.ts  │  CML grouping + derived
  PT/MT repeater ──────────────────────►│ (campaign history)   │  t-initial / t-previous
                                        └──────────┬───────────┘
                                                   │ EvaluationInput[]
                                                   ▼
                     ┌──────────────────────── lib/calc (pure) ────────────────────────┐
                     │ units → formulas → corrosion → remaining-life → interval        │
                     │        → verdicts → outliers           ptmt (parallel branch)   │
                     │ criteria.ts loads constants from lib/criteria/*.json            │
                     └──────────┬──────────────────────────────────────────────────────┘
                                │ EvaluationResult[] (JSON-serializable, citations[])
                                ▼
                        Screen 3 (Results)  ── session JSON ──► Phase 3 (narrative) / Phase 4 (report)
```

### Recommended project structure

```
lib/
├── calc/                      # PURE — no react, no next, no node builtins, no lib/llm
│   ├── criteria.ts            # typed loaders for ../criteria/*.json (single import point)
│   ├── units.ts               # Unit = 'mm'|'in'|'mils'; toMm(value, unit); exact constants
│   ├── dates.ts               # strict ISO parse → UTC days; daysToYears (365.25); addYears
│   ├── formulas.ts            # tPressureB313(), tPressureBarlow(), requiredThickness()
│   ├── corrosion.ts           # crLongTerm(), crShortTerm(), governingRate()
│   ├── remaining-life.ts      # remainingLife() incl. negative-CR floor
│   ├── interval.ts            # nextInterval(RL, pipeClass) + citation ids
│   ├── verdicts.ts            # verdictBand() in locked order
│   ├── outliers.ts            # modifiedZScores() per CML population
│   ├── ptmt.ts                # evaluateIndication() + clause refs
│   ├── evaluate.ts            # orchestration: EvaluationInput[] + metadata → EvaluationResult[]
│   ├── round.ts               # roundTo(value, dp) — the canonicalization helper
│   ├── index.ts               # public barrel (the only import surface for app/)
│   └── README.md              # exists — keep the invariant note updated
├── ingest/
│   ├── csv.ts                 # tokenize(): string[][]; BOM, quotes, CRLF/CR/LF, delimiter sniff
│   ├── map.ts                 # normalizeHeader(), autoGuess(): Record<Field, col|null>
│   ├── validate.ts            # rowIssues(): RowIssue[] — zod schemas + catalog (exact copy strings)
│   ├── group.ts               # groupByCml(): derive t-initial/t-previous from campaign history
│   └── session.ts             # zod schemas + TS types for EvaluationSession (Phase 3/4 contract)
├── demo/
│   ├── fixtures/zenodo-16780668-ut-register.json   # committed demo data (static import)
│   ├── ATTRIBUTION.md         # CC BY 4.0 credit (text below)
│   └── demo-scenario.ts       # fixture + preset metadata + sample PT/MT notes → EvaluationSession
public/
└── sample-ut-register.csv     # "Download sample CSV" static asset (builder-authored, valid rows)
tests/
├── calc/                      # golden catalog: formulas.test.ts, corrosion.test.ts,
│                              # remaining-life.test.ts, interval.test.ts, verdicts.test.ts,
│                              # outliers.test.ts, ptmt.test.ts, units.test.ts, dates.test.ts,
│                              # evaluate.demo.test.ts (fixture assertions)
└── ingest/                    # csv.test.ts (quote/CRLF/BOM cases), validate.test.ts (catalog),
                               # map.test.ts (aliases), boundary-imports.test.ts (lint guard)
```

### The seven research-backed rules

**R1 — Load constants from JSON, implement structure in TS.** AGENTS.md makes `lib/criteria/*.json` the machine source of truth. `lib/calc/criteria.ts` imports the three JSONs (`resolveJsonModule: true` is already set) and exposes typed accessors. Values the engine must NOT hard-code: class maxima (note the JSON mixes types — `"Class 4": "optional"` is a string among numbers, so the accessor narrows `typeof v === "number"` and the UI select only offers Classes 1–3), `default_gauge_uncertainty_mm: 0.1`, `relevance_threshold_mm: 1.5`, `max_rounded_dimension_mm: 5.0`, cluster `count_threshold: 4` / `max_separation_edge_to_edge_mm: 1.5`, and the citation ids. The formula *shapes* live in TS (you cannot eval strings); golden tests pin the TS to the JSON's formula text.

**R2 — Two error spaces, two numbering spaces.** Parse errors (cannot tokenize: unclosed quote, and the zero-rows check) are *thrown* as `CsvParseError { line, problem }` and render as `line {n} — {problem}` (UI-SPEC:156). Semantic row issues are *collected data* (`RowIssue { row, field, severity, message }`), never exceptions, and render as the locked pattern — verbatim from UI-SPEC:159:

> `Row {n}: {field} — {problem} ({value}).` e.g. `Row 14: Measured thickness — impossible value, must be greater than 0 (0 mm).`

`row` = 1-based data-row index in original file order (row 1 = first data row, matching the review table); `line` = physical file line (differs when quoted fields embed newlines). Keeping these separate is the single most common CSV-validation bug.

**R3 — CSV tokenizer spec (RFC 4180 verified [CITED: www.rfc-editor.org/rfc/rfc4180]):** fields containing commas/quotes/line breaks are double-quoted; a quote inside a quoted field is escaped by doubling; quoted fields may contain CR/LF/commas; the last record may or may not have a trailing line break; records should have equal field counts. Required handling, each with its own test:

1. Strip UTF-8 BOM (`\uFEFF`) before header parse — Excel exports carry it; without stripping, `Reading_ID` never auto-guesses.
2. Quote-aware state machine (IN_FIELD / IN_QUOTED / QUOTE_IN_QUOTED) — a naive `split('\n')` corrupts quoted multi-line fields.
3. Accept CRLF, LF, and lone CR as record separators outside quotes.
4. Trailing newline must not produce a phantom 4,913th row; skip fully-empty records anywhere.
5. Ragged rows: fewer cells than header → "missing value" row error; extra cells → row error (do not silently truncate).
6. Delimiter sniff: count `,` vs `;` vs `\t` occurrences outside quotes on the header line, pick the max, default `,` (gauge exports vary; ~8 lines, deterministic).
7. Trim spaces around unquoted fields before validation.
8. Strict numeric grammar after trim: `/^[+-]?(\d+(\.\d+)?|\.\d+)$/` — then `Number()`. Never bare `Number(cell)`: demonstrated traps — `Number('') === 0`, `Number(' ') === 0`, `Number('0x1A') === 26`, `Number('Infinity') === Infinity`, `parseFloat('19.5abc') === 19.5` (all verified in node v24 this session). Comma-decimal (`19,5`) must fall into "not a number", never silently split or misparse.
9. Encoding: assume UTF-8, do not attempt detection; garbage bytes fail validation loudly downstream.

**R4 — Canonical rounding policy (float safety).** Evidence (verified in node v24): mils case RL = (11.811 − 11.176)/0.127 computes as **4.999999999999998**, and G1's t_required is 2.637535816618911. Both are correct IEEE doubles that would break exact-boundary tests and the `RL < 4` branch at engineered boundaries. Policy: one `roundTo(value, dp)` helper (`Math.round(v * 10^dp) / 10^dp`), applied at public-function exits — t_required & CR: 6 dp; RL: 4 dp; interval: 2 dp; z: 4 dp. Verdict comparisons then run on canonicalized values, and golden tests construct boundary inputs by arithmetic. Assert in tests: `expect(remainingLife(...)).toBeCloseTo(5.0, 9)` for G12 pre-rounding, `toBe(5.0)` post-rounding.

**R5 — Date rules (all traps demonstrated this session).** Parse only strict ISO `YYYY-MM-DD` (optionally `YYYY/MM/DD`); reject everything else into "not a valid date" (the UI-SPEC's own example is `'31/02/2026'`). Never use `new Date(string)` for user data — verified traps: `new Date('2026-02-31')` silently rolls to **2026-03-03**; `new Date('02/31/2026')` parses with a **local-timezone offset** (−5:30 on this machine → 2026-03-02T18:30Z); `new Date('31/02/2026')` → Invalid Date. Validate components manually against UTC days-in-month (leap-aware). Δt_years = UTC-day difference / 365.25 (R5 convention; alternatives 365.0 or calendar-year diff change CR values — pin with G13 and document in `dates.ts`). Next-inspection date = measurement date + interval years via UTC calendar arithmetic (year + floor, month/day preserved, Feb 29 → Feb 28 clamp; fractional part × 365 days) — anchored to the **measurement date** per UI-SPEC results column ("measurement date + interval"), never `Date.now()` (keeps the engine time-independent and pure).

**R6 — Long-format grouping (the undocumented core transform).** The Zenodo register is one row per reading per campaign (~447 CMLs × ~11 campaigns). `lib/ingest/group.ts` groups valid rows by CML identity (mapped Tank + Grid_Position; Reading_ID stays the per-reading id), sorts each group by parsed date ascending, and derives per reading *i*: t_initial = group[0].thickness, t_previous = group[i−1].thickness (i ≥ 1), t_actual = group[i].thickness. Reading at index 0 has no history → INSUFFICIENT HISTORY for that reading (honest; ~9% of demo rows). If the optional t-initial/t-previous columns ARE mapped, their values take precedence (wide-format gauge exports); if Tank/Location is unmapped, every row is its own CML → all history null, verdicts still compute. UI-SPEC's CR-degradation policy (line 266) is the contract: t-initial unmapped → CR_LT renders `—`; t-previous unmapped → CR_ST `—`; both → governing `—` + INSUFFICIENT HISTORY; verdicts always compute.

**R7 — Session data model (Phase 3/4 contract).** One JSON-serializable type in `lib/ingest/session.ts` (zod schema + inferred type). No `Date` objects (ISO strings), no `Map`/`Set`, no class instances — so Phase 3 can POST it to an LLM route and cache on it (CONTEXT.md: golden tests double as cached-LLM keys).

```ts
type Unit = "mm" | "in" | "mils";
type Verdict = "accept" | "re_check" | "reject";   // engine band names; UI renders ACCEPT/RE-CHECK/FAIL
type TargetField = "readingId" | "measuredThickness" | "measurementDate" | "tInitial" | "tPrevious" | "tank";

interface ParsedRow { row: number; cells: Record<string, string>; issues: RowIssue[]; }
interface RowIssue { row: number; field: string; severity: "error" | "warning"; message: string; }

interface ComponentMetadata {          // all thickness in declared metadata unit; converted to mm at eval
  od: number; tNominal: number; fca: number; tStructural: number;
  designCode: "ASME B31.3 — 2024 Edition"; pipeClass: 1 | 2 | 3;
  gaugeUncertainty: number;            // ±, mm after conversion
  pressureUnit: "MPa" | "psi";         // see Open Questions OQ1 — UI-SPEC gap
  designPressure: number; allowableStress: number; e: number; w: number; y: number;
  formula: "asme_b31_3_straight_pipe" | "barlow_in_service";
}

interface PtmIndication {
  id: string; method: "PT" | "MT"; morphology: "linear" | "rounded";
  lengthMm: number; widthMm: number; count: number; edgeSeparationMm: number | null;
  crackSuspect: boolean; description?: string;
}

interface EvaluationSession {
  source: { filename: string; isDemo: boolean; ingestedAt: string /* ISO */ };
  csv: { headers: string[]; delimiter: "," | ";" | "\t"; rowCount: number };
  mapping: Record<TargetField, string | null>;
  units: { csvThickness: Unit; metadata: Unit };
  rows: ParsedRow[];
  metadata: ComponentMetadata;
  ptmt: { notes: string; indications: PtmIndication[] };
  results: EvaluationResults | null;    // populated by Run Evaluation
}

interface EvaluationResults {
  readings: ReadingResult[];           // 4,912 entries
  summary: { total: number; locations: number; accept: number; reCheck: number; fail: number };
  indications: PtmIndicationResult[];
  citationsUsed: string[];             // subset of citations.json ids, renderer allowlist later
}

interface ReadingResult {
  readingId: string; location: string; date: string;   // ISO
  tActualMm: number;
  tPressureMm: number; tStructuralMm: number; tRequiredMm: number;
  crLtMmYr: number | null; crStMmYr: number | null;    // null = insufficient history
  rawCrLtMmYr: number | null; rawCrStMmYr: number | null;  // possibly negative, for detail display
  crGoverningMmYr: number | null;                      // post-floor effective rate
  rlYears: number | null;                              // NEVER Infinity/NaN — null instead
  nextInspection: { date: string; intervalYears: number } | null;
  flags: Array<"outlier" | "measurement_inconsistency" | "insufficient_history">;
  outlier?: { z: number; median: number; mad: number };
  verdict: Verdict;
  citations: string[];
}
```

Session location: a single `useReducer` store in a client wizard context under the page route (Screens 1→2→3 are one client tree; back-navigation preserves state by construction). No URL state (4,912 rows), no server persistence, no localStorage in v1 (refresh loses state — acceptable; optional `sessionStorage` persistence ≈ 500 KB is a cheap later add). Phase 2 writes no Token Factory calls (locked).

**R8 — Forbidden-import gate: eslint `no-restricted-imports` (zero new deps), plus a 5-line vitest guard.** ESLint is already configured (flat config) and `npm run lint` is an established script. Add to `eslint.config.mjs`:

```js
// append inside defineConfig([...]) after the next configs:
{
  files: ["lib/calc/**/*.ts"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        { group: ["**/lib/llm", "**/lib/llm/*", "**/llm/*"],
          message: "lib/calc is deterministic ground truth — LLM imports forbidden (handoff.md invariant 2)." },
        { group: ["react", "react-dom", "next", "next/*", "node:*"],
          message: "lib/calc must stay pure: no react/next/node builtins — vitest node env + browser must both run it." },
      ],
    }],
  },
},
```

Belt-and-braces `tests/ingest/boundary-imports.test.ts`: read every `lib/calc/**/*.ts` with `node:fs` (allowed in tests) and assert zero matches for `lib/llm`, `Date.now(`, `Math.random(` — cheap determinism guard that runs in `npm test` even when lint is skipped. (Recommend both; either alone is acceptable.)

### Demo fixture acquisition (executor steps)

The demo button must run "with zero network beyond page load" (locked) → the data ships **inside the bundle** as a static JSON import, not a runtime fetch.

1. Download (execution time, once):
   ```bash
   mkdir -p scratch/zenodo && curl -L -o scratch/zenodo/RBM_PoF_Model.zip \
     "https://zenodo.org/records/16780668/files/RBM_PoF_Model.zip?download=1"
   md5sum scratch/zenodo/RBM_PoF_Model.zip   # must equal 4735bbeca392636f9b2ba91b2c2b42fc
   ```
   [VERIFIED: zenodo.org/records/16780668 — fetched this session: file `RBM_PoF_Model.zip`, 169.3 kB, md5 `4735bbeca392636f9b2ba91b2c2b42fc`, CC BY 4.0, DOI 10.5281/zenodo.16780668, author Aleksandar Pudar, published 2025-08-08]
2. Extract (`unzip` is NOT installed on this machine — use python): `python -m zipfile -e scratch/zenodo/RBM_PoF_Model.zip scratch/zenodo/extracted/` (fallback: `powershell.exe -NoProfile -Command "Expand-Archive -Path scratch/zenodo/RBM_PoF_Model.zip -DestinationPath scratch/zenodo/extracted"`).
3. Transform `Appendix_A_UT_register.csv` → `lib/demo/fixtures/zenodo-16780668-ut-register.json` (minified JSON array of row objects; ≈ 500 KB — static-import safe). Do NOT commit the zip or the other appendices (Appendix B / pof_results are out of scope).
4. Validate with the demo-fixture assertion table above (4,912 rows / 12 tanks / 11 years / exact columns / 19.0–19.98 mm) before committing.
5. Attribution (CC BY 4.0 requirement) — commit as `lib/demo/ATTRIBUTION.md` and surface via the locked demo banner on Screens 2–3:
   > Pudar, A. (2025). *RBM PoF Model and Supporting Data for Risk-Based and Condition-Based Crude-Oil Tank Inspection Optimisation*. Zenodo. https://doi.org/10.5281/zenodo.16780668 — CC BY 4.0. Subset used: Appendix A UT thickness register (4,912 readings). FlawCheck labels this data "sample data" in the UI.
6. Demo preset metadata (discretion): builder-authored values labeled by the locked provenance banner. Recommended: t_structural = 19.85 mm governs (tank plating — pressure thickness negligible), gauge 0.1 mm, Class 2 → the 19.0–19.98 mm spread lands in all three verdict bands (ACCEPT ≥ 19.95, RE-CHECK [19.85, 19.95), FAIL < 19.85) and CR_LT ≈ 0.01 mm/yr gives RL ≈ 5 yr. Add a demo smoke assertion: at least one of each verdict present.

`public/sample-ut-register.csv`: builder-authored, 6 valid rows, headers exactly the auto-guess aliases (`Reading_ID,Tank,Grid_Position,Original_Scantling_mm,Measured_Thickness_mm,Measurement_Date`) so the `_mm` suffix drives unit auto-guess (UI-SPEC mapping panel).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Row/metadata schema validation | Ad-hoc `if` ladders with stringly-typed errors | zod 4.6.5 (installed) schemas in `lib/ingest` | House pattern "Zod at every parse boundary" (01-PATTERNS.md:348); free, already audited in Phase 1 |
| Verdict/interval/threshold constants | Hard-coded numbers in TS | `lib/calc/criteria.ts` JSON accessors | AGENTS.md single-source-of-truth invariant; JSON is the machine contract |
| Import-boundary enforcement | A custom build step or codegen | eslint `no-restricted-imports` + 5-line vitest guard (R8) | Both already installed; zero deps |
| Virtualized 4,912-row table | Scroll-window renderer | 50-row pagination (UI-13 locked) + `React.memo` row + `useMemo` page slice | Pagination is the benchmark-backed choice at this scale [CITED: itnext.io 50k-row grid benchmark] |
| Icon set | Package | Inline SVG per UI-SPEC | Locked: no icon package |
| (Deliberate hand-rolls, per lock) | — | CSV tokenizer, date math, unit conversion | CONTEXT.md prefers zero-dependency; each is small, specified here, and fully golden-tested |

**Key insight:** in this phase "don't hand-roll" mostly inverts — the *locked* architecture hand-rolls parsing/math to keep the supply chain empty and the criteria JSON sovereign. The things you must NOT hand-roll are the *validation schemas* (zod), the *constants* (JSON), and the *enforcement* (eslint) — rebuild those and you re-introduce drift the project explicitly engineered away.

## Common Pitfalls

### Pitfall 1: `new Date(string)` silently fabricates dates
**What goes wrong:** `new Date('2026-02-31')` → 2026-03-03 (rollover); `new Date('02/31/2026')` → parsed with local-timezone offset (verified: 2026-03-02T18:30Z on this machine). A thickness register with one impossible date computes a wrong Δt and a wrong corrosion rate — silently.
**Why it happens:** JS spec rolls overflow components; non-ISO strings fall into implementation-defined locale parsing.
**How to avoid:** strict-ISO regex parse + manual days-in-month validation in `dates.ts` (R5); unit tests for 2026-02-31 and 2024-02-29.
**Warning signs:** dates in results that differ from CSV cells by days; Δt values like 1.002053 where 1.0 was intended (leap-day inclusion is legitimate — drift to 1.0027 is not).

### Pitfall 2: Float drift flips locked boundary verdicts
**What goes wrong:** `t_actual == t_required` must be RE-CHECK and `== t_required + uncertainty` must be ACCEPT (UI-16); binary floats make 0.1 inexact and mils conversion drifts (RL = 4.999999999999998 in G12). An unintended 1e-16 flips a verdict or the `RL < 4 yr` branch.
**How to avoid:** R4 canonical rounding at function exits; tests construct boundary inputs arithmetically (`tReq + unc`), never by decimal literal; never `===` against hand-typed decimals except post-canonicalization.
**Warning signs:** golden test failures that differ only in the 12th decimal; verdicts that change when a value passes through mils.

### Pitfall 3: Numeric coercion traps render fake data valid
**What goes wrong:** `Number('') === 0`, `Number(' ') === 0`, `Number('0x1A') === 26`, `parseFloat('19.5abc') === 19.5` (all verified). A blank cell becomes thickness 0 mm and then a confusing "impossible value" error instead of "missing value".
**How to avoid:** strict regex grammar before coercion (R3 item 8); blank/whitespace → "missing value" branch, not the number path.
**Warning signs:** row errors naming `0 mm` on rows users know were blank.

### Pitfall 4: BOM breaks auto-guess
**What goes wrong:** first header arrives as `\uFEFFReading_ID`; normalization doesn't match aliases; the user sees everything unmapped on a perfectly good file.
**How to avoid:** strip BOM before header read (R3 item 1); map.test.ts case with a BOM fixture.
**Warning signs:** demo file maps fine, user uploads map nothing.

### Pitfall 5: Trailing newline creates a phantom row
**What goes wrong:** the standard's "may or may not have a trailing line break" [CITED: RFC 4180 §2] yields a 4,913th empty record → "4,913 rows" summary and a blank-row error.
**How to avoid:** skip fully-empty records post-tokenization (R3 item 4).
**Warning signs:** row counts off by one only for files saved from Excel.

### Pitfall 6: Infinity/NaN reaches the results table
**What goes wrong:** RL = (t_actual − t_required)/0 when CR is 0 → `Infinity` renders (UI-19 forbids the strings ever rendering).
**How to avoid:** engine returns `null` for RL/CR/interval on the insufficient-history path (G9/G10); types say `number | null`; a vitest test asserts no result field is ever non-finite.
**Warning signs:** `typeof rlYears === 'number' && !Number.isFinite(rlYears)` tripping in tests.

### Pitfall 7: Row numbering confusion (file line vs data row)
**What goes wrong:** parse errors use file lines; validation errors use data-row order (R2). Quoted embedded newlines make the two diverge; mixing them produces "Row 12" pointing at the wrong cell.
**How to avoid:** two explicit counters in the tokenizer (physical line) and validator (data row); tests with an embedded-newline fixture.
**Warning signs:** user-reported error rows not matching visible rows.

### Pitfall 8: Rendering all 4,912 rows
**What goes wrong:** mapping the full array into DOM nodes (≈49k cells) freezes the tab, especially with per-cell inputs.
**How to avoid:** paginate at 50 (locked UI-13), `useMemo` the page slice, `React.memo` row components, re-validate on mapping change but only re-render the current page; validation of 4,912 rows is pure math (~ms) — no worker needed.
**Warning signs:** typing lag in inline edits; React DevTools highlighting the whole table per keystroke.

### Pitfall 9: Hard-coding criteria values in TS
**What goes wrong:** duplicating `5.0/10.0` class maxima or `1.5/5.0` PT-MT limits in code violates the single-source invariant and drifts on criteria edits.
**How to avoid:** R1 JSON accessors; a guard test greps `lib/calc` for the literal thresholds outside `criteria.ts`.
**Warning signs:** review finds numbers in `verdicts.ts`/`interval.ts`.

### Pitfall 10: Class-max lookup typed as `number | string`
**What goes wrong:** `max_interval_by_class` mixes values — verbatim: `"Class 1": 5.0, "Class 2": 10.0, "Class 3": 10.0, "Class 4": "optional"` (`ut-criteria.json:75-81`) — so the inferred TS type is `number | string`; arithmetic on it fails typecheck or worse.
**How to avoid:** accessor narrows `typeof v === "number"`; UI restricts to Classes 1–3 (locked form contract).
**Warning signs:** `tsc` error on `Math.min(rl / 2, maxByClass[k])`.

### Pitfall 11: Time-dependent engine
**What goes wrong:** using `Date.now()` for "next inspection" or "evaluated at" inside the engine makes golden tests non-deterministic and breaks purity.
**How to avoid:** next-inspection anchors to the measurement date (UI-SPEC); `evaluatedAt` timestamp is captured in the session by the UI, not the engine; R8 purity guard greps for `Date.now(`.
**Warning signs:** golden tests fail the day after they pass.

## Code Examples

### Verdict band — locked order, verbatim implementation note

```ts
// Source: lib/criteria/ut-criteria.json:90-94 (boundary_convention.implementation_note, verbatim):
// "Implement as: if (t_actual < t_required) reject; else if (t_actual < t_required + gauge_uncertainty) re_check; else accept — evaluated in exactly this order"
import { criteria } from "./criteria";
import { roundTo } from "./round";

export type Verdict = "accept" | "re_check" | "reject";

export function verdictBand(tActualMm: number, tRequiredMm: number, gaugeUncertaintyMm?: number): Verdict {
  const unc = gaugeUncertaintyMm ?? criteria.ut.verdict_bands.default_gauge_uncertainty_mm; // 0.1 — ut-criteria.json:84
  const tReq = roundTo(tRequiredMm, 6);
  const tAct = roundTo(tActualMm, 6);
  if (tAct < tReq) return "reject";                        // FAIL in UI (UI-SPEC:117)
  if (tAct < roundTo(tReq + unc, 6)) return "re_check";    // exact equality with t_required is re_check, NOT reject
  return "accept";                                         // tAct == tReq + unc lands here (accept floor == re_check ceiling)
}
```

### Quote-aware CSV tokenizer core (RFC 4180)

```ts
// Source: RFC 4180 §2 rules verified this session — https://www.rfc-editor.org/rfc/rfc4180
// "Fields containing line breaks (CRLF), double quotes, and commas should be enclosed in double-quotes";
// "a double-quote appearing inside a field must be escaped by preceding it with another double quote";
// "The last record in the file may or may not have an ending line break."
export interface CsvParseError { line: number; problem: string; }

export function tokenize(input: string, delimiter: "," | ";" | "\t"): { records: string[][]; errors: CsvParseError[] } {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input; // strip BOM
  const records: string[][] = [];
  const errors: CsvParseError[] = [];
  let field = "", record: string[] = [], inQuotes = false, line = 1, fieldStartLine = 1;
  const pushField = () => { record.push(field); field = ""; };
  const pushRecord = () => { pushField(); records.push(record); record = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }        // 2DQUOTE escape
        else inQuotes = false;                                  // closing quote — peek, don't consume CRLF
      } else field += ch;
    } else if (ch === '"' && field === "") { inQuotes = true; fieldStartLine = line; }
    else if (ch === delimiter) pushField();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      line++; pushRecord();
    } else field += ch;
  }
  if (inQuotes) errors.push({ line: fieldStartLine, problem: "unclosed quoted field" });
  else if (field !== "" || record.length > 0) pushRecord();     // last record may lack a line break
  return { records, errors };                                   // caller skips fully-empty records (Pitfall 5)
}
```

### Remaining life with negative-CR floor (engine returns facts; UI renders)

```ts
// Source: lib/criteria/ut-criteria.json:60-71 — RL formula (line 62) and negative_cr_policy rule (line 66, verbatim):
// "If CR_LT or CR_ST computes negative (apparent thickness gain), clamp CR_governing to 0 for the RL
//  calculation and surface a 'measurement inconsistency' warning flag on the affected CML"
export interface RateOutcome {
  rawLt: number | null; rawSt: number | null;
  governingRaw: number | null;        // max(LT, ST) — may be negative
  governingEffective: number | null;  // floored at 0 — the RL divisor
  insufficientHistory: boolean;
  measurementInconsistency: boolean;  // either raw rate negative
}

export function rateOutcome(tInitial: number | null, tPrevious: number | null, tActual: number,
  dtLtYears: number | null, dtStYears: number | null): RateOutcome {
  const rawLt = (tInitial !== null && dtLtYears !== null && dtLtYears > 0)
    ? roundTo((tInitial - tActual) / dtLtYears, 6) : null;   // CR_LT = (t_initial - t_actual) / delta_t_years
  const rawSt = (tPrevious !== null && dtStYears !== null && dtStYears > 0)
    ? roundTo((tPrevious - tActual) / dtStYears, 6) : null;  // CR_ST = (t_previous - t_actual) / delta_t_years
  const governingRaw = rawLt === null && rawSt === null ? null : Math.max(rawLt ?? -Infinity, rawSt ?? -Infinity);
  const governingEffective = governingRaw === null ? null : Math.max(0, governingRaw);
  return {
    rawLt, rawSt, governingRaw, governingEffective,
    insufficientHistory: governingEffective === null || governingEffective === 0,
    measurementInconsistency: (rawLt !== null && rawLt < 0) || (rawSt !== null && rawSt < 0),
  };
}
// remainingLife = insufficientHistory ? null : roundTo((tActual - tRequired) / governingEffective, 4)  — never Infinity
```

### PT/MT indication evaluation (thresholds loaded, never hard-coded)

```ts
// Source: lib/criteria/ptmt-criteria.json — relevance_threshold_mm (line 9), morphology definitions (10-19),
// limits (20-27): max_rounded_dimension_mm 5.0; cluster count_threshold 4, max_separation_edge_to_edge_mm 1.5
export function evaluateIndication(ind: PtmIndication): { verdict: Verdict; detail: string; citationId: string } {
  const c = criteria.ptmt;
  const relevant = Math.max(ind.lengthMm, ind.widthMm) > c.relevance_threshold_mm;   // strict > (P4: 1.5 is non-relevant)
  if (!relevant) {
    if (ind.crackSuspect) return { verdict: "re_check", detail: "crack-suspect", citationId: ind.method === "MT" ? "asme_b31_3_344_3_2" : "asme_b31_3_344_4_2" };
    return { verdict: "accept", detail: "non-relevant", citationId: /* as above */ "" };
  }
  const linear = ind.lengthMm > 3 * ind.widthMm;                                     // L > 3W strictly (P7a: == is rounded)
  if (linear || ind.count >= c.limits.aligned_rounded_cluster.count_threshold
        && (ind.edgeSeparationMm ?? Infinity) <= c.limits.aligned_rounded_cluster.max_separation_edge_to_edge_mm)
    return { verdict: "reject", detail: linear ? "relevant linear" : "aligned cluster", citationId: /* per method */ "" };
  if (Math.max(ind.lengthMm, ind.widthMm) > c.limits.max_rounded_dimension_mm)       // strict > (P2/P3 boundary: 5.0 acceptable)
    return { verdict: "reject", detail: "oversized rounded", citationId: /* per method */ "" };
  return { verdict: "accept", detail: "relevant rounded within limit", citationId: /* per method */ "" };
}
```
*(P6 note: the structured repeater's Count + Edge-separation fields ARE the cluster test — count ≥ 4 AND sep ≤ 1.5 rejects that row. Cross-row cluster detection across separately-typed indications is out of v1 scope.)*

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Number()`/`parseFloat` coercion for CSV cells | Strict regex grammar then coerce | stable best practice | avoids `Number('')===0` class of bugs (verified) |
| `new Date(string)` for dates | Manual strict-ISO parse | stable best practice | avoids rollover + TZ traps (verified) |
| Virtualized tables for big data | Pagination for page-scanned data | stable | 50-row pages locked; no dep |
| Class 2 interval = 10 yr debate | Settled: 10 yr thickness / 5 yr visual-external | confirmed this session from local PDF | golden G5 asserts 10.00 for Class 2 |

**Deprecated/outdated:** adversarial_review_v2.md §C2's "Class 2 = 5 yr" claim — explicitly refuted by CONTEXT.md and independently re-confirmed this session (local API 570 PDF, p.52: "Class 2 | 10 years | 5 years" — 10 = Thickness Measurements, 5 = Visual External). Do not re-open.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Zenodo CSV column values: scantling constant 20 mm, measured 19.0–19.98, tanks named WBT-*, dates ISO — taken from FEATURES.md (MEDIUM, direct-download-verified there) and asserted as fixture tests at download time | Demo fixture acquisition | Fixture assertions fail loudly at execution → trivial fix; no silent risk |
| A2 | Next-inspection fractional-year handling: whole-year part via calendar (Feb 29→28 clamp), fractional part × 365 days [ASSUMED — no convention is locked anywhere] | R5 | Cosmetic date drift of ≤ 1 day on fractional intervals; demo data (whole-year intervals) unaffected |
| A3 | Δt_years convention = UTC-day difference / 365.25 (alternatives: /365, calendar-year diff) — Claude's discretion, pinned by G13 | R5, G13 | CR values shift ~0.1–0.8% vs other conventions; consistent across engine + tests, so no internal inconsistency |
| A4 | Demo preset metadata t_structural = 19.85 mm, Class 2 — builder-authored demo scenario (discretion) | Demo fixture acquisition | Wrong values → demo still runs but may not show all three verdict bands; smoke assertion catches it |
| A5 | `unzip` absent → python `zipfile` extraction path (python 3 + pypdf verified present) | Demo fixture acquisition | Extraction command fails → Expand-Archive fallback documented |
| A6 | Session lives purely in client state; refresh loses it (no persistence in v1) | R7 | UX nit only; optional sessionStorage noted |
| A7 | Per-reading results (4,912 rows) rather than per-CML aggregation — per UI-SPEC Screen 3 ("4,912 readings · 12 locations", paginated results table) | R7 | If user intended per-CML rollup, Screen 3 would need regrouping — flagged as OQ5 |

## Open Questions (RESOLVED — see plans' <open_question_resolutions>)

All five questions below were resolved during planning; the resolutions are recorded verbatim in the `<open_question_resolutions>` block of `.planning/phases/02-ingestion-calc-engine/02-01-PLAN.md` (OQ1 pressureUnit selector in Plan 02-04; OQ2 either-rate flag in 02-01/02-02; OQ3 accepted; OQ4 outliers.ts constant in 02-02; OQ5 per-reading granularity). The text below is retained for traceability only.

1. **Pressure/stress unit selector is missing from the UI-SPEC metadata form.**
   - What we know: `ut-criteria.json:10` requires P and S in consistent units ("MPa or psi — must be consistent with S (allowable stress) units; record the chosen system in the evaluation"), but the UI-SPEC design-conditions table has no unit control for P/S.
   - What's unclear: intended UX — a small `MPa | psi` segmented control in the design-conditions subgroup is the minimal fix.
   - Recommendation: planner adds the control (defaults MPa) and records `pressureUnit` in metadata; surfaced in the results footnote. Needs user eyes at discuss/checkpoint since UI-SPEC is a reviewed contract.
2. **Negative-CR flag trigger: either-rate or governing-rate?**
   - What we know: `negative_cr_policy` (verbatim at ut-criteria.json:66) says "If CR_LT or CR_ST computes negative … clamp CR_governing to 0". Clamping a *positive* max() to 0 would discard a real rate, so the coherent reading is: flag fires when **either** raw rate is negative; the RL divisor is `max(0, max(LT, ST))` (floor); floored-to-zero → insufficient history.
   - What's unclear: whether the user wants RL suppressed even when one rate is positive.
   - Recommendation: implement the floor reading (G9 encodes both sub-cases); confirm at checkpoint — it is safety-adjacent wording.
3. **First-campaign readings show INSUFFICIENT HISTORY (~9% of demo rows).** Unavoidable under the per-reading model (no prior measurement exists). Recommendation: accept; it demonstrates the flag on real data. Confirm acceptable for the demo video.
4. **Outlier rule is not in the criteria JSON** (CALC-04 lives in REQUIREMENTS, not ut-criteria.json). Recommendation shipped: per-CML modified z-score (median/MAD), |z| > 3.5, requires n ≥ 4, MAD = 0 → no flags; never overrides verdicts (UI-18). If the user wants it governed by criteria JSON instead, move thresholds there before planning.
5. **Results granularity:** per-reading rows (recommended, matches UI-SPEC counts) vs per-CML rollup. Confirm at discuss if the demo story is "12 locations" rather than "4,912 readings".

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | engine, vitest, next | ✓ | 24.14.1 | — |
| npm | installs (none planned) | ✓ | 11.11.0 | — |
| python + pypdf | criteria verification (done), zip extraction | ✓ | pypdf 6.19.0 | — |
| curl | Zenodo download | ✓ | 8.18.0 | — |
| md5sum | zip integrity check | ✓ | coreutils 8.32 | `certutil -hashfile … MD5` |
| unzip | zip extraction | ✗ | — | `python -m zipfile -e` (primary), PowerShell `Expand-Archive` |
| Network (Zenodo) | one-time fixture download | ✓ (verified this session) | — | builder-authored labeled sample data |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** unzip (fallbacks above).

## Security Domain

### Applicable ASVS Categories (L1, security_enforcement: true)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no auth by design (single-session demo tool) |
| V3 Session Management | no | client-side wizard state only; no server sessions |
| V4 Access Control | no | no privileged resources in this phase |
| V5 Input Validation | **yes — primary** | zod schemas at the CSV/metadata boundary; strict numeric grammar; strict ISO dates; file-type + size gate before parse |
| V6 Cryptography | no | no secrets, no crypto in this phase |
| V14 Config | no | no new env vars in Phase 2 (LLM config untouched, no Token Factory calls — locked) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious/oversized CSV upload (memory DoS) | DoS | accept-check `.csv`/`text/csv` (UI-SPEC), size cap ~5 MB and row cap ~50,000 with a loud "file too large" error before tokenize; pagination bounds render cost |
| CSV content reflected into DOM (stored XSS via cell text/filename) | Tampering | React escapes text by default — **never** `dangerouslySetInnerHTML`; filename rendered as text only; never used in filesystem paths |
| CSV formula-injection (=CMD…) | Tampering | out of scope for a reader app: we never re-export cells to Excel in Phase 2; when Phase 4 exports, prefix leading `=`/`+`/`-`/`@` cells with `'` |
| Criteria tampering (altered acceptance limits) | Tampering/Elevation | `lib/criteria/*.json` is git-reviewed config; engine loads only from it; guard test greps for hard-coded thresholds (Pitfall 9) |

## Sources

### Primary (HIGH confidence)
- `lib/criteria/ut-criteria.json` — read in full this session; all formulas/rules/limits quoted verbatim with line ranges
- `lib/criteria/ptmt-criteria.json` — read in full this session; thresholds quoted
- `lib/criteria/citations.json` — read in full this session; citation-id allowlist enumerated
- API 570 5th EDITION.pdf (local) — Table 1 + §6.3.3 extracted via pypdf this session (PDF page 52 / printed page 46): Class 1 = 5 yr, Class 2 = 10 yr, Class 3 = 10 yr thickness-measurement maxima; "whichever is less" + RL < 4 yr / max 2 yr rule text matches ut-criteria.json
- node v24.14.1 execution this session — all golden-case arithmetic, float behaviors, date traps, day counts
- zenodo.org/records/16780668 — fetched this session (files, size 169.3 kB, md5, CC BY 4.0, DOI, author, date)

### Secondary (MEDIUM confidence)
- RFC 4180 (www.rfc-editor.org/rfc/rfc4180) — normative CSV rules fetched this session [authoritative for the spec; fetched via summarizer, wording cross-checked against ABNF excerpt]
- .planning/research/FEATURES.md — Zenodo dataset contents (4,912 rows / 12 tanks / 11 campaigns / column list / ranges), MSTS worked example (line 50)
- Multi-source React table-perf search (itnext.io 50k-row benchmark; hostinger; greatfrontend) — pagination-vs-virtualization guidance

### Tertiary (LOW confidence)
- MSTS Training worked example numbers — search-snippet-derived in FEATURES.md; used only as a traceability story for G12 (the arithmetic itself is verified here)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing audited packages; zero installs
- Golden catalog: HIGH — every value hand-computed and machine-verified this session; criteria text quoted verbatim
- Architecture: HIGH — repo conventions + UI-SPEC contract are explicit; grouping rule (R6) is the one designed-here piece, flagged for discuss
- Pitfalls: HIGH — every JS trap demonstrated by execution, not asserted from memory

**Research date:** 2026-09-27
**Valid until:** 2026-10-27 (stable domain; criteria JSON is the moving part — re-check if it changes)
