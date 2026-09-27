# Adversarial Review — FlawCheck Work Product (Session 2)
*Scope: All deliverables created since the initial GSD plan review — criteria configs, handoff artifacts, AGENTS.md, grilling decisions*
*Reviewer stance: hostile NDT auditor + hostile software architect + hostile judge*
*Generated: 2026-09-27*

---

> [!CAUTION]
> This review intentionally looks for ways the work product fails. Findings are prioritized by hackathon-fatal risk first.

---

## Summary

| Severity | Count | Items |
|---|---|---|
| 🔴 **CRITICAL** | 4 | Missing governing t_min clause, Wrong Class 2 interval max, Verdict band logic inversion, HANDOFF.json missing |
| 🟠 **HIGH** | 4 | Symbol inconsistency (OD vs D), ut-criteria.json missing UT §344.6.2, grilling_decisions formula error, Class 2 max_interval wrong |
| 🟡 **MEDIUM** | 5 | api574_10_5_1_4 gap, No negative CR guard, No unit system declaration, PT/MT page reference error, AGENTS.md formula has wrong grouping |
| 🟢 **LOW** | 4 | State drift in ROADMAP.md, Missing §5.7.4 reference, Annex D tables not cited, handoff.md copyright note missing code |

---

## 🔴 CRITICAL Findings

### C1 — `ut-criteria.json` missing the governing `t_required` selection rule
**File**: [`lib/criteria/ut-criteria.json`](file:///c:/Users/moham/Documents/Nebuis/lib/criteria/ut-criteria.json) (L8–26)

The file defines `asme_b31_3_straight_pipe` t_required and `barlow_in_service` t_pressure separately, but **nowhere encodes** the governing selection:

```
t_required = max(t_pressure, t_structural)
```

`api570_7_6` exists in `citations.json` (says "greater of pressure or structural"), and `api574_10_5_1_3` exists (says "structural min from Annex D"), but `ut-criteria.json` — the file the *calc engine will actually import* — never states this `max()` rule. A Phase 2 developer reading only `ut-criteria.json` will implement just the pressure formula and **miss the structural minimum entirely**. This silently makes `t_required` smaller than it should be → `RL` is overstated → inspection intervals are too long → safety-critical miss.

**Fix required**: Add a `governing_t_required` block to `ut-criteria.json`:
```json
"governing_t_required": {
  "clause": "API 570 §7.6 / API 574 §10.5.1.2 + §10.5.1.3",
  "rule": "t_required = max(t_pressure, t_structural)",
  "note": "t_structural from API 574 Annex D Tables D.2a/D.2b"
}
```

---

### C2 — Wrong `Class 2` maximum inspection interval
**Files**: [`lib/criteria/ut-criteria.json`](file:///c:/Users/moham/Documents/Nebuis/lib/criteria/ut-criteria.json) (L53–54), [`citations.json`](file:///c:/Users/moham/Documents/Nebuis/lib/criteria/citations.json) (L107)

`ut-criteria.json` states:
```json
"Class 1": 5.0,
"Class 2": 10.0,
"Class 3": 10.0,
```

`citations.json` (`api570_table1`) states: **"Class 1: 5 years max. Class 2: 10 years max."**

The API 570 5th Edition Table 1 text extracted by `pypdf` in the previous session showed **Class 1 = 5 years** and **Class 2 = 5 years** for UT measurements (Class 2 is 10 years for visual, but **5 years for thickness measurement**). The session's own PDF extraction confirmed Class 2 UT max is 5 years, but the criteria files were encoded as 10 years. If `Class 2 = 10.0` is retained in the calc engine, pipelines in Class 2 service could be recommended for inspection intervals up to 2× the code limit.

> [!CAUTION]
> This requires re-verification against the API 570 PDF before Phase 2 code is written. The discrepancy could be consequential for hackathon judging by any actual NDT professional.

**Fix**: Re-run PDF extraction script on API 570 Table 1. Correct whichever value is wrong in both `ut-criteria.json` and `citations.json`.

---

### C3 — Verdict band logic is inverted / ambiguous at the `RE-CHECK` boundary
**File**: [`lib/criteria/ut-criteria.json`](file:///c:/Users/moham/Documents/Nebuis/lib/criteria/ut-criteria.json) (L59–65)

```json
"accept":   "t_actual >= (t_required + gauge_uncertainty)",
"re_check": "t_required <= t_actual < (t_required + gauge_uncertainty)",
"reject":   "t_actual < t_required"
```

The `re_check` condition `t_required <= t_actual` **overlaps with the `reject` condition** at the exact boundary `t_actual == t_required`. The `reject` condition says `< t_required`, which means the exact-equal case falls into `re_check`. That is arguably correct, but the string-encoded logic is impossible for a developer to implement correctly from this JSON without knowing the intended boundary convention. More critically, the `accept` criterion requires `t_actual >= t_required + gauge_uncertainty`, but the `re_check` range is `[t_required, t_required + gauge_uncertainty)` — a gap of exactly 1 `gauge_uncertainty` width. **The accept floor is the re_check ceiling**. This looks right on paper but the string encoding expresses it with redundant conditions that create implementation ambiguity.

Also: the `handoff.md` encodes this correctly with clear math ($t_{\text{actual}} \ge t_{\text{required}} + 0.1$), but `ut-criteria.json` must be the machine source of truth and should use numeric boundary conditions rather than English strings, or add explicit boundary notes.

**Fix**: Add `boundary_convention` field: `"at_t_required": "re_check"`, `"at_t_required_plus_uncertainty": "accept"`.

---

### C4 — `HANDOFF.json` does not exist
**File**: `.planning/HANDOFF.json` (expected location)

The `.planning/` directory listing shows no `HANDOFF.json`. The file was referenced in handoff.md (line 138), in `.continue-here.md` (referenced), and in the session summary. It was committed as `50e073f` — but the file is not present on disk. Either the commit didn't apply cleanly or the file was deleted.

A cold-start agent following the handoff instructions will find a broken reference. The `.continue-here.md` is present and mostly covers this, but the machine-readable JSON state is missing.

**Fix**: Recreate and commit `.planning/HANDOFF.json`, or remove the reference from `handoff.md` line 138 if it was intentionally removed.

---

## 🟠 HIGH Findings

### H1 — Symbol inconsistency: `OD` vs `D` across files

**Files**: `ut-criteria.json` (L11: `t_required = (P * OD) / ...`), `citations.json` (L8: `t = (P*D) / ...`), `AGENTS.md` (L7: `t = PD / 2(SEW + PY)`), `handoff.md` (L65: `t = P·D / ...`)

All four files use a **different symbol** for pipe outside diameter:
- `ut-criteria.json`: `OD`
- `citations.json`: `D`  
- `AGENTS.md`: `D`
- `handoff.md`: `D`
- `grilling_decisions.md` L10: `OD`

ASME B31.3 §304.1.2 Eq. 3a uses `D` (outside diameter). API 574 §10.5.1.2 uses `D`. The decision to use `OD` in `ut-criteria.json` is a builder choice (more explicit), but the inconsistency means a Phase 2 developer could define two separate TypeScript symbol names for the same physical quantity.

**Fix**: Pick one. `OD` is more explicit and unambiguous — adopt it everywhere. Update `citations.json` scope notes to say "D (outside diameter, hereafter OD)".

---

### H2 — `ut-criteria.json` has no UT acceptance section (§344.6.2)

The file is named `ut-criteria.json` but covers *only* UT **thickness measurement** (t-min, corrosion rate, remaining life, verdict banding). It has zero content about **UT volumetric examination** acceptance criteria (ASME B31.3 §344.6.2 — the weld discontinuity limits for UT of butt welds). 

`citations.json` does not contain a `asme_b31_3_344_6_2` entry either.

For the hackathon, this may be intentional scope reduction (FlawCheck targets wall-thinning UT + PT/MT surface indications, not weld volumetric UT). But the file name is misleading and could cause a future agent to assume UT weld acceptance is covered. The `handoff.md` also doesn't clarify this scope exclusion explicitly.

**Fix**: Either rename `ut-criteria.json` → `thickness-criteria.json`, or add a `scope_exclusion` field: `"UT_weld_volumetric_344_6_2": "Out of scope for FlawCheck v1 — wall-thinning UT only"`.

---

### H3 — `grilling_decisions.md` t-min formula has a structural error

**File**: [`grilling_decisions.md`](file:///C:/Users/moham/.gemini/antigravity/brain/433f35f4-f3e2-466c-9e3f-aed7cf25f83d/grilling_decisions.md) (L10)

```
t_min = P×OD / (2×(S×E + P×Y)) + FCA
```

This is wrong. The denominator per ASME B31.3 Eq. 3a is `2*(S*E*W + P*Y)`, not `2*(S*E + P*Y)`. The weld factor **W** is **outside** the `S*E` group — it multiplies the `S*E` product as `S*E*W`. The formula in `grilling_decisions.md` drops `W` entirely from the denominator.

`ut-criteria.json` (L11) correctly writes `2 * (S * E * W + P * Y)`, which is correct.

So the definitive machine file is right but the human decision record — which a future human reading it might treat as the ground truth — is wrong. A future agent told to "implement per grilling_decisions.md" would produce a subtly incorrect denominator.

**Fix**: Update `grilling_decisions.md` line 10: `t_min = P×OD / (2×(S×E×W + P×Y)) + FCA`.

---

### H4 — `AGENTS.md` formula also has incorrect grouping

**File**: [`AGENTS.md`](file:///c:/Users/moham/Documents/Nebuis/AGENTS.md) (L7)

```
t = PD / 2(SEW + PY)
```

This renders ambiguously in inline math. The denominator is `2(SEW + PY)`, which is mathematically `2*SEW + 2*PY = 2(SEW + PY)`. This is actually correct (it equals `2*(S*E*W + P*Y)`)  — **but** the LaTeX is written without the `*` operator between S, E, and W, making it look like `S`, `E`, `W` is one symbol, not a product. Also `SEW` concatenated could be misread by a future LLM as a single material property name.

**Fix**: Rewrite as `$t = \frac{P \cdot D}{2(S \cdot E \cdot W + P \cdot Y)}$` for clarity.

---

## 🟡 MEDIUM Findings

### M1 — `api574_10_5_1_4` (governing t_min selection) absent from `citations.json`

`citations.json` has `api574_10_5_1_3` (structural minimum) and `api570_7_6` (required = max of pressure/structural), but is **missing** `api574_10_5_1_4` which in the API 574 5th Edition explicitly states the governing selection rule ("required thickness = greater of pressure and structural minimum"). 

`api570_7_6` delegates *to* API 574 §10 — so §10.5.1.4 is the direct normative source for the `max()` rule, not just a supporting reference. When the Phase 3 LLM layer cites the required thickness determination, it should cite `api574_10_5_1_4`, not just `api570_7_6`. Without the entry, the citation is incomplete.

**Fix**: Add entry `api574_10_5_1_4` to `citations.json`.

---

### M2 — No negative corrosion rate guard in `ut-criteria.json`

The corrosion rate formulas `CR_LT = (t_initial - t_actual) / delta_t` and `CR_ST = (t_previous - t_actual) / delta_t` can return **negative values** if the measured thickness increased (re-measurement noise, different measurement point, pipe relining). No guard is documented. If `CR_governing` is negative, `RL = (t_actual - t_required) / CR_governing` returns a large negative number, producing a nonsensical next inspection date in the distant past.

This is a real-world occurrence (HVAC pipe re-coated, measurement point shift). The calc engine must clamp: `CR_governing = max(CR_governing, 0)` and surface a warning flag when CR < 0.

**Fix**: Add `negative_cr_policy` field in `ut-criteria.json`:
```json
"negative_cr_policy": {
  "rule": "If CR_LT or CR_ST < 0, clamp to 0 for RL calculation and surface a 'measurement inconsistency' warning flag",
  "rationale": "API 570 §7.1.2 does not define behavior for apparent thickness gain; inspect measurement point metadata"
}
```

---

### M3 — No unit system declaration in `ut-criteria.json`

The file mixes mm-assuming symbols (`default_gauge_uncertainty_mm: 0.1`) with formula symbols that are unit-agnostic (`P * OD / 2*...`). The Phase 2 grilling decision says "units explicit at input (mm/in/mils), mm canonical internally." But `ut-criteria.json` itself never declares this. A developer reading only this file has no canonical unit guidance.

**Fix**: Add a top-level `unit_system` block:
```json
"unit_system": {
  "canonical": "mm (millimeters) for all thickness quantities",
  "pressure": "MPa or psi — must be consistent with S (allowable stress) units",
  "note": "User inputs in any unit converted to canonical before calc entry"
}
```

---

### M4 — `ptmt-criteria.json` and `citations.json` cite page 126 for both §344.3.2 and §344.4.2

**Files**: `citations.json` (L132, L143), `ptmt-criteria.json` (no page reference at all)

Both MT (§344.3.2) and PT (§344.4.2) acceptance criteria are cited as page 126 in `citations.json`. The previous session extracted MT from page 126–127. §344.4.2 (PT) may be on a different page (127 or 128). If both point to page 126 and only MT is on 126, a future agent asked to verify PT criteria will read the wrong page.

**Fix**: Re-run the PDF extraction script specifically for §344.4.2 to confirm its exact page number and correct if needed.

---

### M5 — `AGENTS.md` references `lib/criteria/` but does not list the file that covers the governing t_min rule

**File**: [`AGENTS.md`](file:///c:/Users/moham/Documents/Nebuis/AGENTS.md) (L10–12)

The Deterministic Single Source of Truth bullet says:
> - `lib/criteria/citations.json` (verified allowlist)
> - `lib/criteria/ptmt-criteria.json` (ASME B31.3 morphology & threshold rules)
> - `lib/criteria/ut-criteria.json` (Barlow/B31.3 formulas & verdict banding)

The description `"Barlow/B31.3 formulas & verdict banding"` doesn't convey that `ut-criteria.json` also governs corrosion rate calculation, remaining life, and inspection intervals — the majority of API 570 logic. A developer reading only `AGENTS.md` might assume API 570 calc logic is somewhere else.

**Fix**: Update the `ut-criteria.json` description: `"ut-criteria.json (all UT thickness eval: Barlow/B31.3 t-min, API 570 corrosion rates, remaining life, inspection interval rules, verdict banding)"`.

---

## 🟢 LOW Findings

### L1 — ROADMAP.md says Phase 1 is "In Progress" — state drift

`ROADMAP.md` line 120: `| 1. Platform Spike & App Skeleton | 4/4 | In Progress |`

The `.continue-here.md` says the project is **paused at Phase 1 boundary**, not executing it. "4/4 plans executed" in line 35 of ROADMAP.md says plans were executed, yet the progress table says "In Progress" with no completion date. Either Phase 1 is done (and should say "Complete") or the plans were planned but not executed. This creates confusion about the actual state.

---

### L2 — `handoff.md` lacks the explicit UT §344.6.2 scope exclusion note

Any NDT professional reviewing the handoff will immediately ask "what are your UT weld criteria?" The answer (out of scope for v1) is not stated anywhere in `handoff.md`. This could create a confusing conversation when a judge or collaborator reads the document.

---

### L3 — API 574 Annex D tables not cited in `citations.json`

`citations.json` has `api574_10_5_1_3` referencing "Annex D, Tables D.2a/D.2b" in its scope note, but no direct citation entry for the Annex D tables themselves. When the calc engine needs to look up the structural minimum value, it needs to call a citation — but there is no `api574_annex_d` entry. The LLM renderer will have no allowlist entry to cite when it renders "minimum structural thickness from API 574 Annex D."

---

### L4 — `handoff.md` copyright legal posture note cites 17 U.S.C. § 102(b) but provides no implementation guidance

`handoff.md` line 38 states the "Cite-Don't-Quote Legal Posture" and cites 17 U.S.C. § 102(b). This is correct — but provides no technical mechanism to enforce it. A Phase 3 agent generating the LLM prompt template has no guidance on *how* to prevent verbatim quotes. The citation allowlist prevents fabricated citations, but doesn't prevent the LLM from quoting "the allowable stress S shall be..." verbatim in its narrative.

---

## Cross-File Consistency Matrix

| Rule | `citations.json` | `ut-criteria.json` | `ptmt-criteria.json` | `handoff.md` | `grilling_decisions.md` |
|---|---|---|---|---|---|
| t_required formula | ✅ api570_7_6 + api574 | ✅ correct formula | ➖ N/A | ✅ | ⚠️ Missing W |
| Governing t_required = max() | ✅ api570_7_6 scope note | ❌ MISSING rule | ➖ N/A | ✅ | ➖ |
| CR_LT / CR_ST | ✅ | ✅ | ➖ | ✅ | ✅ |
| Governing CR = max(LT,ST) | ✅ | ✅ | ➖ | ✅ | ✅ |
| RL formula | ✅ | ✅ | ➖ | ✅ | ➖ |
| Interval = min(RL/2, class_max) | ✅ | ✅ | ➖ | ✅ | ✅ |
| Class 2 interval max | ⚠️ says 10yr | ⚠️ says 10yr | ➖ | ✅ 5yr | ✅ 5yr |
| Verdict banding | ➖ | ⚠️ Ambiguous boundary | ➖ | ✅ clear math | ✅ |
| PT/MT relevance 1.5mm | ✅ | ➖ | ✅ | ✅ | ✅ |
| PT/MT linear = reject all | ✅ | ➖ | ✅ | ✅ | ✅ |
| PT/MT rounded > 5mm reject | ✅ | ➖ | ✅ | ✅ | ✅ |
| PT/MT 4+ cluster reject | ✅ | ➖ | ✅ | ✅ | ✅ |

---

## Handoff Completeness Assessment

| Question | Answer |
|---|---|
| Can a cold-start agent reproduce all domain decisions? | ✅ Yes — `.continue-here.md` + `handoff.md` are complete |
| Can a cold-start agent find the HANDOFF.json machine state? | ❌ File missing from disk |
| Are all PDF tools documented? | ✅ Yes — `AGENTS.md` + `handoff.md` §4 |
| Is the formula source of truth unambiguous? | ⚠️ W symbol missing from grilling_decisions.md |
| Is the inspection interval cap for Class 2 unambiguous? | ❌ Conflicting (10yr in criteria files, 5yr cited in session) |
| Is the governing t_required rule machine-readable? | ❌ Missing from `ut-criteria.json` |

---

## Action Priority

| # | Action | Files to Change | Impact |
|---|---|---|---|
| 1 | Verify API 570 Table 1 Class 2 UT max interval via pypdf; fix criteria files | `ut-criteria.json`, `citations.json` | Safety-critical |
| 2 | Add `governing_t_required` rule to `ut-criteria.json` | `ut-criteria.json` | Prevents structural minimum being silently dropped |
| 3 | Fix grilling_decisions.md formula (add W factor) | `grilling_decisions.md` | Decision record integrity |
| 4 | Add `boundary_convention` to verdict bands in `ut-criteria.json` | `ut-criteria.json` | Implementation unambiguity |
| 5 | Add `negative_cr_policy` to `ut-criteria.json` | `ut-criteria.json` | Prevents nonsensical results on noisy data |
| 6 | Recreate or remove broken `.planning/HANDOFF.json` reference | `.planning/` or `handoff.md` | Cold-start handoff fidelity |
| 7 | Add `api574_10_5_1_4` to `citations.json` | `citations.json` | Citation completeness |
| 8 | Add `api574_annex_d` to `citations.json` | `citations.json` | Structural min lookup citation |
| 9 | Add `unit_system` declaration to `ut-criteria.json` | `ut-criteria.json` | Phase 2 developer clarity |
| 10 | Rename `ut-criteria.json` or add scope exclusion note | `ut-criteria.json` | Prevents confusion with weld UT |
