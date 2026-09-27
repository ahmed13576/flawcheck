---
phase: 02-ingestion-calc-engine
verified: 2026-09-27T14:17:42Z
status: human_needed
score: 50/50 must-have truths verified (0 failed; 4 carry a browser-interactive residue — see behavior_unverified_items)
behavior_unverified: 4
overrides_applied: 0
covered_digest: "v1:sha256:b43e47f5239f5da68f3ba142a8c255131b6e27670570644a7a9bcf9d9928c5c3"
re_verification:
  previous_status: none (initial verification)
  note: "Ran on build/phase-2 INCLUDING the merged review fixes at 93724f7 (16 fixed + 1 dispositioned). The 2 review items flagged requires-human-verification (WR-01, WR-02) were independently re-verified here and stand as recorded orchestrator RATIFICATIONS of the fail-closed policies — not open human items."
human_verification:
  - test: "Drag-hover visual state (UI-01): drag a file over the dropzone, then out, then drop a CSV."
    expected: "Border renders border-blue-500 with bg-blue-500/5 while hovering; reverts to border-gray-700 on dragleave and drop. The classes are present in dropzone.tsx (grep 4 matches) and SSR markup renders — the live drag interaction itself was never exercised (executor could not run a browser)."
    why_human: "HTML5 drag events + visual rendering cannot be observed by reducer tests or greps."
  - test: "Interactive wizard walkthrough with public/sample-ut-register.csv: upload, watch 'Parsing…', confirm focus lands on the Screen 2 heading; re-drop a second CSV to open 'Replace loaded data?' — verify focus is trapped in the dialog, initial focus on Cancel, Esc = Cancel; fill metadata, Run Evaluation, verify the button disables with 'Evaluating…' and focus lands on the Screen 3 heading (UI-03/04/21/22/23)."
    expected: "All state transitions already pinned at reducer level (tests/wizard/reducer.test.ts) occur visibly: banner copy verbatim, focus movement to [data-screen-heading], dialog focus trap, evaluation-failure path re-enables the button."
    why_human: "Real DOM focus movement, focus trapping, and Esc handling are runtime behaviors with no component test harness in the zero-dep suite."
  - test: "Visual contract of the 4,912-row tables (UI-14 backstops, plans 02-04 and 02-05): load the demo, inspect review and results tables."
    expected: "Identifier cells truncate with title; numeric cells font-mono tabular-nums whitespace-nowrap, never wrap; the ten result columns never collapse at 50 rows/page ('Showing 1–50 of 4,912' caption — formatter pinned by tests/wizard/results.test.ts)."
    why_human: "Overflow/truncation/typography rendering is a layout outcome greps cannot see."
  - test: "Zero-CML edge (UI-15 backstop): contrive a grouping that yields zero CML rows (e.g. unmap every identifier) with a fully valid dataset."
    expected: "The results empty-state copy renders ('No results…' locked copy), never a bare table. The branch exists in screen-results.tsx (grep-verified) but no test exercises the zero path end-to-end."
    why_human: "Requires contrived input to trigger; the path is present and wired but unexercised."
---

# Phase 2: Ingestion & Deterministic Calc Engine — Verification Report

**Phase Goal:** Raw inspection data in, deterministic verdicts out — CSV upload with editable mapping preview, component metadata, and PT/MT notes feed a pure, unit-tested calc engine (t-required, short/long-term corrosion rate, remaining life, verdict bands, outliers, re-inspection interval) that would stand alone even if every LLM call failed.
**Verified:** 2026-09-27T14:17:42Z (on branch `build/phase-2`, HEAD 93724f7 — includes merged review fixes)
**Status:** human_needed (zero gaps in the deterministic core; 4 browser-interactive residues routed to human)
**Re-verification:** No — initial verification, run after review-fix merge

## Verdict Summary

Every programmatic must-have is verified by evidence I produced myself (gates run in my own shell, 21 temporary adversarial probe tests re-deriving the math by hand, source read line-by-line, PDF cross-check). The engine is real, not theater (see Anti-Slop Assessment). The only reason this is not `passed` is the interactive browser walkthrough that the executor explicitly deferred to this end-of-phase gate (02-04/02-05 summaries: "browser-use MCP unavailable in this executor context; the interactive pass belongs to the end-of-phase UI safety gate") — 4 items listed above. No code gaps found; nothing blocks Phase 3 planning.

## 1. Gates (run by this verifier)

| Gate | Command | Result | Status |
| ---- | ------- | ------ | ------ |
| Typecheck | `npm run typecheck` | exit 0 | PASS |
| Lint | `npm run lint` | exit 0 (2 pre-existing warnings in tests/ingest/group.test.ts — ledgered since 02-05) | PASS |
| Hermetic suite | `NEBIUS_API_KEY="" FLAWCHECK_LIVE_LLM="" npx vitest run` | **280 passed / 4 skipped** (23 files + 1 skipped), 3.6 s, zero network | PASS |
| Live-LLM suite | `FLAWCHECK_LIVE_LLM=1 npx vitest run` | 283 passed / 1 failed — the single failure is the Phase 1 network test `tests/llm/hello-fixture.test.ts > extraction model: retry payload…` (5010 ms vitest timeout; pre-existing flake documented in deferred-items.md #2, Phase 1 scope, opt-in only) | PASS (with known Phase 1 flake) |

The 4 skipped hermetic tests are exactly the live-gated `tests/llm/*` provider tests (WR-08 hermeticity gate working as ratified). Hermeticity confirmed: with the key unset the suite is green and network-free.

## 2. ROADMAP Success Criteria (goal-backward)

| # | Success Criterion | Evidence | Status |
| - | ----------------- | -------- | ------ |
| 1 | Upload UT CSV → confirmable/correctable column-mapping preview; malformed CSVs, missing fields, impossible values return specific row-naming errors | `components/wizard/column-mapping-panel.tsx` + `screen-ingest.tsx` (overridable dropdowns incl. not-mapped); `lib/ingest/validate.ts` locked pattern `Row {n}: {field} — {problem} ({value}).` with 8-entry catalog (non-numeric/missing/≤0/≥OD/date/future/duplicate/extra-cells); exact catalog pinned by `tests/ingest/validate.test.ts`; parse errors throw `CsvParseError {line, problem}` (`lib/ingest/csv.ts` quote-aware state machine, BOM, CRLF/LF/CR); reducer tests pin UI-02/05/06/07/08/09 | VERIFIED (visual residue → human) |
| 2 | Metadata drives criteria selection; units explicit at input, mm canonical, mixed-unit refused with explanation | `metadata-form.tsx` (MPa\|psi selector per OQ1); `lib/calc/units.ts` exact constants; `lib/ingest/session.ts` units-declaration gate — evaluation refused when either unit undeclared (`tests/ingest/units-gate.test.ts`); formula branch (`asme_b31_3_straight_pipe` vs `barlow_in_service`) selected from `metadata.formula`; WR-02 ratified: pipeClass 1\|2\|3 strictly enforced (`metadataProblems` + `nextInterval` throws) | VERIFIED |
| 3 | PT/MT notes with component context carried into the evaluation session alongside UT data | `session.ts` `ptmt: { notes, indications }`; `PtmtEntry` on Screen 2 (`app/page.tsx:80-87`); `evaluate(options.ptmtIndications)` → `indications[]` in results; Screen 3 `ptmt-triage-list.tsx` renders method tag, dimensions, verdict, method-pinned clause (§344.3.2 MT / §344.4.2 PT); P1–P7 golden pins green | VERIFIED |
| 4 | Golden tests from hand calculations pass on curated fixtures — t-required, CR, RL, interval with cited rule, outlier flags match hand-worked values exactly | G1–G13 + P1–P7 exact-`toBe` pins all green (280/280); **independently re-derived by this verifier** (Section 3): boundary equalities, governing max, negative-CR, G14 on real rows, Table-1 caps vs the actual API 570 PDF (pypdf, page 52), CR-01/CR-02 regressions | VERIFIED |
| 5 | Every CML and indication gets pass/re-check/fail incl. gauge-uncertainty band, pure TypeScript, forbidden-import lint | `verdicts.ts` implements the locked `implementation_note` verbatim (read line-by-line); gauge uncertainty loads from criteria (0.1 never a literal — sovereignty guard); purity: eslint `no-restricted-imports` block in `eslint.config.mjs` + mechanical walker `tests/ingest/boundary-imports.test.ts` (asserts ≥10 modules, zero `lib/llm`, zero `Date.now(`/`Math.random(`) | VERIFIED |

## 3. Adversarial Calc Spot-Verification (safety-critical, re-derived by hand + 21 probe tests)

| # | Check | Hand derivation | Observed result | Status |
| - | ----- | --------------- | --------------- | ------ |
| a | Verdict boundary equalities per `boundary_convention.implementation_note` | tReq 2.637536, unc 0.1: `t==tReq → re_check`; `t==tReq+0.1=2.737536 → accept`; 2.637535 → reject; 2.737535 → re_check; 9.2 → accept; 2.0 → reject | All six exact (`verdicts.ts` implements the locked `<`-chain verbatim, 6-dp canonicalized both sides) | PASS |
| b | Governing t_required = max(t_pressure, t_structural), structural governs | P 0.1, OD 114.3, S 138 MPa, E=W=1, Y=0.4: tP = 11.43/276.08 = 0.041404; tStructural 6.0 → tRequired must be 6.0, citing api574_annex_d | `tRequiredMm === 6.0`, citations contain `api574_annex_d` + `api574_10_5_1_4` (`formulas.ts:82` `Math.max` confirmed) | PASS |
| c | Negative-CR clamp + flag | Both-negative (20→20.5 over 10 yr: rawLt −0.05; 20.2→20.5: rawSt −0.3): governing floored to 0 → insufficient history, flag fires, RL null. Mixed-sign (rawLt +0.1, rawSt −0.1): governing kept 0.1, flag STILL fires, RL = 1.0/0.1 = 10 | Both behaviors exact (`corrosion.ts:66-76` — clamp only the RL divisor, flag on either negative raw, raw rates surfaced) | PASS |
| d | G14 immediate-inspection on a REAL demo row | Reading `3515` (CML WBT-S6 / B2): tActual 19.45 < tReq 19.85, governing CR 0.30494, RL −1.3117 → must be immediate, never a negative interval or past date | 2,775 immediate rows; every one has `nextInspection === null`, `rlYears <= 0`, verdict reject/re_check — distinct from the 2,030 insufficient-history rows (CR/RL null) | PASS |
| e | Class 2 interval cap 10.0 (NOT 5) — verified vs API 570 Table 1 | **Actual PDF check (pypdf, `API 570 5th EDITION.pdf` p.52):** "Table 1—Recommended Maximum Inspection Intervals … Class 1 5 years … Class 2 10 years … Class 3 10 years … Class 4 Optional"; §6.3.3: "one-half the remaining life, or … Table 1, whichever is less. Whenever the remaining life is less than 4 years … full remaining life up to a maximum of 2 years." | `ut-criteria.json` matches the PDF exactly (5/10/10/optional); `nextInterval(21.8749, 2) = 10.00`, Class 1 = 5.00, G6 `nextInterval(3.0, 2) = 2.00` (not 1.50); maxima loaded from JSON, unknown class throws (WR-02) | PASS |
| f | CR-01 regression: 748-mil row vs 114.3 mm OD validates clean | 748 mils × 0.0254 = 19.005 mm < 114.3 mm → no issue; 6000 mils = 152.4 mm > 114.3 → error naming TRUE mm | `rowIssues(..., {csvThicknessUnit:"mils", odMm:114.3})` → `[]` for 748; 6000 → 1 error containing `(114.3 mm)`; mm back-compat intact (`validate.ts:206-225` converts via `toMm` before both checks) | PASS |
| g | CR-02 regression: sample CSV upload has zero false immediate_inspection | `public/sample-ut-register.csv` through the REAL reducer gate chain (parse-file → draft → run-evaluation): A01-2025 hand rate (9.5−9.2)/10.001369 = 0.029996; B02-2025 (2.0→2.0) must be insufficient-history, NOT the pre-fix fabricated CR 1.799754/immediate | `tests/ingest/sample-register.test.ts` pins exactly this (6 readings, A01 CR 0.029996 accept, B02 rawCrLt 0 + insufficient_history, C03 re_check, zero immediate flags) — green in my hermetic run; auto-guess leaves `Original_Scantling_mm` unmapped | PASS |
| + | WR-01 ratified fail-closed: NaN input | NaN t_actual would fall through both `<` branches to a fabricated `accept` | `evaluate()` throws typed `EvaluationInputError` "fail-closed" naming reading+field (probed on NaN tActualMm; guard also covers metadata + computed t_required, `evaluate.ts:55-115`) | PASS |
| + | Demo end-to-end numbers | — | Pinned split **301 / 538 / 4,073 over 4,912 readings · 12 locations** reproduced through the real reducer seam; 480 CMLs; 2,030 insufficient_history; 2,819 measurement_inconsistency; 66 outliers; no Infinity/NaN in any numeric field of any reading | PASS |
| + | Mixed-sign on real data | — | Reading `4119`: rawSt −10.957475 flagged measurement_inconsistency, governing kept at positive LT 0.019815, RL 1.0093 computed from the kept rate — the OQ2 policy working on real gauge noise | PASS |

## 4. must_haves Disposition — all 5 plans (50 truths)

Legend: each truth verified by a named gate (test file / probe / grep I ran in this verification).

**Plan 02-01 (tracer) — 6/6 VERIFIED**

| Truth | Evidence | Status |
| ----- | -------- | ------ |
| Tracer e2e: sample → parse → map → validate → group → compute → ACCEPT/RE-CHECK/FAIL chips on screen with locked chip base class | `tests/calc/tracer-pipeline.test.ts` + `tests/wizard/reducer.test.ts`; `verdict-chip.tsx:13-21` labels + class; `app/page.tsx` composes 3 screens | VERIFIED (chip visual → human) |
| Golden pipeline: G1 2.637536, G13 10.001369, verdicts 9.2/2.637536/2.0 | Suite green + probe re-derivations | VERIFIED |
| verdictBand locked order verbatim from ut-criteria.json | Source read + probe (a) | VERIFIED |
| lib/calc pure: zero lib/llm/react/next/node:*, zero Date.now(/Math.random( | eslint block + boundary-imports walker (green) | VERIFIED |
| Tokenizer: BOM, doubled-quote escapes, CRLF/LF/CR, skips fully-empty records, null-prototype cells | `tests/ingest/csv` coverage in suite; WR-07 fix: only TRUE blank lines skipped | VERIFIED |
| Wizard shell step indicator, forced dark (#0a0a0a/#171717/#262626), no media flip | `app/globals.css` + `step-indicator.tsx`; colors greped in results-table (`border-[#262626] bg-[#171717]`) | VERIFIED (visual → human) |

**Plan 02-02 (calc engine) — 7/7 VERIFIED**

| Truth | Evidence | Status |
| ----- | -------- | ------ |
| G1–G12 + G13 catalog-exact values (G1 2.637536, G2 2.656522, G5 21.8749 + 5/10/10, G6 2.00, G7 1.00/5.00, G8 five boundaries, G9a/G9b, G10, G11 60.7050, G12 mils RL 5.0) | `tests/calc/*.test.ts` exact-`toBe` pins, 280/280 green; G5/G6/G8/G13/G14 re-derived by probe | VERIFIED |
| P1–P7 PT/MT golden (P4 exactly 1.5 mm strict >, P7a/P7b L==3W) | `tests/calc/ptmt.test.ts` green; limits load from `ptmt-criteria.json` | VERIFIED |
| Interval rule API 570 6.3.3 verbatim + class maxima from JSON + citations | Source read + **PDF Table 1 cross-check** + probe (e) | VERIFIED |
| G14 distinct from insufficient-history, never negative interval | interval.ts source + probe (d) on 2,775 real rows | VERIFIED |
| evaluate() orchestrates per R7 (t_req, raw CRs, governing after floor, RL null-never-∞, interval anchored to measurement date, outliers n≥4, verdicts, summary, deduped citations) | `evaluate.ts` read line-by-line; `addYearsUtc` anchoring (no Date.now); demo e2e | VERIFIED |
| Purity enforced, not promised (eslint + vitest walker asserting ≥10 modules) | Both read; both green | VERIFIED |
| Criteria sovereignty (no bare 5.0/10.0/0.1/1.5 literals in verdicts/interval/ptmt) | `tests/calc/criteria-sovereignty.test.ts` strips comments/strings then scans — real guard, green | VERIFIED |

**Plan 02-03 (ingestion) — 6/6 VERIFIED (one recorded deviation, ratified)**

| Truth | Evidence | Status |
| ----- | -------- | ------ |
| Auto-guess aliases + every dropdown overridable + mapping change re-runs validation | `tests/ingest/map.test.ts` + reducer set-mapping revalidation tests. DEVIATION (recorded, review-ratified CR-02): `originalscantlingmm/originalscantling` removed from AUTO-GUESS t-initial aliases — manual dropdown still selects them (UI-07); explicit mapping emits a `nominal-scantling-as-t-initial` WARNING (`validate.ts:270-279`). The deviation serves the truth's intent (never auto-fabricate CRs) and ships a permanent regression pin | VERIFIED (with recorded deviation) |
| Locked row-issue pattern + full catalog (ERROR: non-numeric/blank/≤0/≥OD/bad date; WARNING: future date/duplicate ID) + two numbering spaces | `tests/ingest/validate.test.ts` exact catalog; my probe (f) | VERIFIED |
| Long-format grouping R6 (Tank+Grid, date-ascending, derived t-initial/t-previous, wide precedence, unmapped Tank → per-row CML, first-campaign no history) | `tests/ingest/group.test.ts` + demo CR-degradation e2e ("unmapping Tank → every row its own CML") | VERIFIED |
| CsvParseError {line, problem} vs RowIssue never mix | `lib/ingest/csv.ts` + validate.test pins | VERIFIED |
| Demo fixture = real Zenodo 16780668 Appendix A subset + CC BY 4.0 attribution | **Directly inspected fixture JSON:** 4,912 rows, 12 tanks, 2015–2025, thickness 18.88–20.0, scantling constant 20; `ATTRIBUTION.md` carries verbatim credit + md5 `4735bbec…` + documented date-normalization transform; real observed range pinned (not the research's anticipated 19.0–19.98) | VERIFIED |
| Units declared per input, canonical mm exact constants, evaluation refused when undeclared | `tests/ingest/units-gate.test.ts` + reducer gate-ordering test | VERIFIED |

**Plan 02-04 (Screens 1–2) — 17/17 VERIFIED at logic/copy level**

UI-01 (drag classes greped, 4 matches — visual → human) · UI-02/05/06 (reducer parse-invalid/failure/zero-rows tests + locked copy greps) · UI-03 (reducer stage/cancel/confirm tests; dialog focus trap — interaction → human) · UI-04 (role=status 'Parsing…' grep) · UI-07 (auto-guess + override + revalidation tests) · UI-08 (blockingChecks.unmappedRequired flip tests + role=alert banner) · UI-09 (validate catalog + badge severance + border-l-2 red) · UI-10/11 (metadataProblems locked copies; P/S gates; E/W/Y=1.0/1.0/0.4 in collapsed details) · UI-12 (units gate + ordering) · UI-13 (4,912-row validate <1s + 50-row slice; caption formatter pinned) · UI-21 (banner verbatim on Screen 2, `app/page.tsx:26`) · UI-22 (focus effect on [data-screen-heading], `page.tsx:48` — real movement → human) · UI-23 (evaluation-start/failure tests + copy) · UI-14-backstop (CSS classes present — rendering → human). All: VERIFIED (4 with browser residue).

**Plan 02-05 (Screen 3 + wrap) — 14/14 VERIFIED at logic/copy level**

UI-13 caption 'Showing 1–50 of 4,912' (`format.ts:20`, pinned) · UI-14-backstop (→ human) · UI-15-backstop (first clause verified: demo yields 480 CML rows; zero branch → human) · UI-16 (ACCEPT/RE-CHECK/FAIL word labels; boundary equalities by engine probe a) · UI-17 (MEASUREMENT INCONSISTENCY chip + raw-vs-clamped detail + apparent-gain sentence; clamp population 2,819 real rows) · UI-18 (OUTLIER chip + re-shoot copy `flag-detail-row.tsx:45`; 66 real outliers; outliers never override banding) · UI-19 ('—' + 'insufficient corrosion history' sub-text `format.ts:62`; Infinity/NaN render-scan green; 2,030 real rows) · G14-UI ('Immediate inspection required' fail-tone `results-table.tsx:153`) · UI-20 (locked empty-state copy `ptmt-triage-list.tsx:44`) · UI-21 (banner persists Screen 3) · UI-22 (→ human) · UI-24 (ten locked columns in exact order, read at `results-table.tsx:101-110`; precision pins 2/3/1 dp in results.test.ts) · PT/MT triage cards (method tag, dimensions, verdict, method-pinned clause; WR-05 fix: declared-vs-derived morphology conflict line) · footnotes (units line `screen-results.tsx:18` + `… UTC` marker `format.ts:34`, IN-07). All: VERIFIED (visual/edge residues → human).

## 5. Prohibitions (judgment-tier — mechanically checkable subset checked, none silently passed)

| Prohibition | Check | Status |
| ----------- | ----- | ------ |
| ZERO new npm packages | `package.json`: 6 deps, identical to Phase 1 set | VERIFIED |
| lib/calc never imports lib/llm/react/next/node:* | eslint block + walker, green | VERIFIED |
| Criteria constants never hard-coded in TS | Sovereignty guard green | VERIFIED |
| No verbatim ASME/API code text | Grep for quote-shaped sentences in app/components/lib: zero hits; clause IDs only | VERIFIED |
| No Phase 3/4 affordances (Download PDF, reasoning pane, live-model toggle) | Grep: zero hits in app/components/lib | VERIFIED |
| No LLM/network calls anywhere in Phase 2 layers | Grep `fetch(`/`new OpenAI`/`getClient` across lib/calc, lib/ingest, lib/wizard, lib/demo, components/wizard: zero | VERIFIED |
| No `dangerouslySetInnerHTML`; filename as React text | Grep: zero | VERIFIED |
| No hardcoded model IDs in source | Grep "nemotron": zero outside env/catalog | VERIFIED |
| No silent truncation; ragged rows → errors | `buildParsedRows` preserves extra cells as row errors | VERIFIED |
| Engine enum `reject` never leaked to UI | `verdict-chip.tsx:5,21` — renders FAIL | VERIFIED |
| Golden values asserted exactly, never recomputed/adjusted | Exact-`toBe` pins; my independent re-derivations agree | VERIFIED |

## 6. Ratified Policy Decisions (recorded orchestrator ratifications — not open items)

| Finding | Ratified policy | Independent re-verification |
| ------- | --------------- | --------------------------- |
| WR-01 | `evaluate()` FAILS CLOSED: typed `EvaluationInputError` on any non-finite input/metadata/computed t-required (chosen over treat-as-insufficient-history because no honest verdict exists for NaN) | Probe: NaN tActualMm throws "fail-closed" naming reading+field; permanent pins in `tests/calc/evaluate.test.ts`; null-history path untouched |
| WR-02 | `pipeClass` strictly 1\|2\|3: `metadataProblems` rejects others; `nextInterval` THROWS on a class with no numeric maximum instead of `?? Infinity` (an unvalidated class used to silently uncap the API 570 Table 1 interval — probed 15.00 for NaN) | Probe: Class 4 and NaN class throw; capped 1\|2\|3 behavior unchanged (5/10/10) |

Both were flagged requires-human-verification by the deep review and RATIFIED by the orchestrator; this verification confirms the ratified behavior is implemented, typed, and permanently pinned.

## 7. Requirements Coverage

| Requirement | Evidence | Status |
| ----------- | -------- | ------ |
| ING-01 upload + mapping preview confirmable/correctable | column-mapping-panel + UI-07 reducer tests | SATISFIED |
| ING-02 specific validation errors | Row-issue catalog + CsvParseError two-space design, exact pins | SATISFIED |
| ING-03 metadata drives criteria selection | metadata.formula branch + code/edition metadata; units gate | SATISFIED |
| ING-04 PT/MT notes with component context | session.ptmt + PtmtEntry + triage cards + P1–P7 | SATISFIED |
| ING-05 units explicit, mm canonical, surfaced | units-gate + toMm at eval entry + results footnote units line | SATISFIED |
| CALC-01 t-required / CR / RL in pure unit-tested code | formulas/corrosion/remaining-life + G catalog, purity gates | SATISFIED |
| CALC-02 pass/re-check/fail per CML and indication incl. gauge band | verdicts.ts + ptmt.ts + G8 + UI-16 | SATISFIED |
| CALC-03 re-inspection interval citing the rule | interval.ts (api570_6_3_3_halflife + api570_table1; PDF-verified) | SATISFIED |
| CALC-04 outliers + re-shoot flags before acceptance | outliers.ts (modified-z 3.5, MAD) + 66 real flags + UI-18 | SATISFIED |

No orphaned requirements: REQUIREMENTS.md maps exactly ING-01..05 + CALC-01..04 to Phase 2, all claimed by plans.

## 8. Anti-Slop Assessment

**This is a real engine, not theater.** Evidence:
- **Pure + criteria-driven:** every policy constant loads from `lib/criteria/*.json` through one loader; the sovereignty guard strips comments/strings before scanning for duplicated literals — a non-tautological guard. The engine has zero LLM/react/node imports (lint + walking duplicate), zero `Date.now(`/`Math.random(` — it genuinely "stands alone if every LLM call failed" (`evaluate()` is the public Phase 3/4 seam and runs fully in the node test env).
- **Golden-pinned, not range-pinned:** exact `toBe` assertions (G1 2.637536, G2 2.656522, G11 60.7050, G13 10.001369…), and my independent hand re-derivations of boundaries, governing max, negative-CR, intervals, and Table 1 (against the actual API 570 PDF) all agree.
- **Real data, honestly labeled:** md5-verified Zenodo subset, transform documented, observed range pinned over the anticipated one, CC BY 4.0 credit verbatim, demo banner says "sample data".
- **It survives adversarial scrutiny:** the deep review reproduced two real blockers (CR-01 false rejections of legitimate mils uploads; CR-02 fabricated corrosion rates from the constant scantling) — exactly the class of bug a fake engine would never surface — and both are fixed with permanent regression pins through the real reducer path.

## 9. Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| tests/ingest/group.test.ts | 2, 9 | Unused vars (pre-existing, ledgered lint warnings) | Info | None — lint exits 0 |
| app/spike/page.tsx | 105 | HTML input placeholder attribute (Phase 1 spike page, benign UI attribute, not a stub) | Info | None |

No TBD/FIXME/XXX/HACK debt markers in any Phase 2 file. No stub patterns: every artifact is substantive (line counts, real logic, data flowing from the fixture through group → evaluate → results-table render path).

## 10. Human Verification Required

See the 4 items in frontmatter `human_verification` (drag-hover visual; interactive wizard walkthrough with focus/dialog/Esc; visual table contract at 4,912 rows; zero-CML empty-state edge). These are the residue the executor explicitly deferred to this gate — the state logic behind each is already reducer-test-pinned and the copy/classes are grep-verified; only live-browser rendering/interaction remains.

## 11. Fixture-Authenticity (FA) Assumptions Recorded

1. The committed fixture is the acquired Zenodo 16780668 Appendix A subset (4,912 × 6 columns), md5-verified at acquisition; only dates were normalized DD/MM/YYYY → ISO (documented).
2. The register's noisy apparent gains are real gauge data: 2,030 insufficient-history rows = 480 true no-history + 1,550 clamp-to-zero — documented as the honest reading of `negative_cr_policy` (02-05 summary deviation 1).
3. Thickness bounds gate the REAL observed 18.88–20.0 mm, not the research's anticipated 19.0–19.98 mm.
4. G14 immediate-inspection on the demo fires for both reject and the re_check equality band (RL rounds to 0 at 4 dp) — consistent with the builder decision "RL <= 0 → immediate".

## 12. Deferred / Advisory

| Item | Disposition | Evidence |
| ---- | ----------- | -------- |
| IN-05 (error-badge label-string coupling in parsed-row-table) | Deferred by recorded review disposition to the next session-contract revision (Phase 3 seam work); label strings are pinned verbatim by validate.test.ts so a rename fails CI today | 02-REVIEW.md dispositions table |
| Phase 1 live-LLM flake (`hello-fixture` retry-payload timeout) | Pre-existing Phase 1 scope; hermetic default unaffected; candidates for Phase 3's LLM-layer work (relax to tolerate known model prose) | deferred-items.md #1/#2; reproduced once in this verification's live run |

---

_Verified: 2026-09-27T14:17:42Z_
_Verifier: Claude (gsd-verifier) — all gates, probes, greps, and the PDF cross-check executed independently against build/phase-2 @ 93724f7_
