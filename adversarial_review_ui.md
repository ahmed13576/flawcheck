# Adversarial UI Review — FlawCheck Phase 2 Design
*Scope: `02-UI-SPEC.md`, all 3 wizard screens, design system, chip contract, accessibility floor*
*Reviewer stance: hostile UX judge + hostile field NDT inspector + hostile hackathon judge*
*Generated: 2026-09-27*

---

> [!CAUTION]
> This is a hostile review. Its job is to surface what fails, not validate what works.

---

## Summary

| Severity | Count |
|---|---|
| 🔴 CRITICAL | 4 |
| 🟠 HIGH | 5 |
| 🟡 MEDIUM | 6 |
| 🟢 LOW | 3 |

---

## 🔴 CRITICAL

### C1 — Screen 3 results table has 9 columns for a `max-w-6xl` container — it will overflow horizontally on every real screen

**Source**: UI-SPEC §Screen 3, §UI-14

The results table specifies 9 columns:
`CML / Location | t-actual | t-required | CR_LT | CR_ST | CR governing | RL | Next inspection | Flags | Verdict`

On a 1280px viewport `max-w-6xl` ≈ 1152px. With padding, the usable table width is ~1100px. At `text-sm` (14px) with mono numerals and `whitespace-nowrap`, each numeric column needs ~80–100px minimum. 9 columns × 90px = 810px for data alone, plus `CML/Location` (at least 120px), Flags (chip = ~140px), and Verdict (chip = ~80px). That's **~1150px** — the table is already at its container limit with zero breathing room. Any CML identifier longer than ~6 characters (e.g. `Tank_01_FrameG_Row14`) will push it over.

The spec says "never wrap" (UI-14) and "truncate with title" for CML — but the other 8 numeric columns also can't wrap and can't truncate. This is a contradictory constraint. In practice, the table will cause horizontal scroll at 1280px, which on a projector demo looks broken.

**Fix options**:
1. Collapse CR_LT and CR_ST into a single "CR History" cell with two stacked mono lines
2. Move Flags into an expandable row (already partly done — press-chip behavior) and hide the Flags column header
3. Use `table-layout: fixed` with fixed widths tuned to fit the container
4. Add a horizontal scroll container with sticky first + last columns (CML + Verdict)

---

### C2 — No visual design for the 4-screen wizard chrome exists — Flowstep cannot work from prose

**Source**: UI-SPEC §Wizard chrome, §Screen Layout Contracts

The wizard header (`FlawCheck` + `NDT Inspection Copilot` subtitle + step indicator) is described in prose but never visualized. The step indicator (`1 Ingest · 2 Review & Metadata · 3 Results`) — its exact height, active/inactive states, separator style, and vertical placement relative to the page heading — is undefined. This is the only persistent chrome on every screen and the most visible branding moment.

Flowstep needs: exact measurements, active/inactive chip styles, whether steps are clickable (spec says back navigation is allowed — 2→1, 3→2 — but the step indicator copy and accessibility pattern for this are unspecified), and the header layout at mobile breakpoints (the spec has no responsive contract at all).

**Fix**: Before handing off to Flowstep, provide a reference wireframe or annotated screenshot showing the wizard chrome on all three screens.

---

### C3 — The spec has zero mobile/responsive contract — demo video will expose this

**Source**: UI-SPEC §Screen Layout Contracts — entire section

The spec sets `max-w-4xl` (Screens 1–2) and `max-w-6xl` (Screen 3) but has no breakpoint contract, no mobile layout, and no tablet layout. The 4,912-row paginated table (Screen 2 + Screen 3) at mobile width (375px) is completely unusable. Even the metadata form with its 7+ fields will stack awkwardly without a specified grid breakpoint.

This matters for the hackathon for one reason: **Devpost judges often view demos on laptops at 1366×768** — the minimum real-world screen. At this resolution, `max-w-6xl` = 1152px is at ~85% viewport, leaving ~100px total horizontal margin. Combined with C1, the Screen 3 table almost certainly breaks at this resolution.

**Fix**: Define at minimum a 1366px-viewport layout contract. The results table needs a "compact column" mode or horizontal scroll affordance at this breakpoint.

---

### C4 — Screen 4 (Report) is out of scope for Phase 2 — but the wizard step indicator shows only 3 steps, creating a dead end at Phase 2 that will need destructive refactor in Phase 4

**Source**: UI-SPEC §Out of scope, §Step indicator copy

The current step indicator is `1 Ingest · 2 Review & Metadata · 3 Results`. When Phase 4 adds the report screen, this becomes `1 Ingest · 2 Review & Metadata · 3 Results · 4 Report`. That means:
- The step indicator component needs to be modified to add a 4th step
- Screen 3 currently has no forward navigation (it's a dead end — "No Phase 3/4 affordances")
- Screen 3 will need a forward CTA to Screen 4 added in Phase 4

This is **not a show-stopper** but it means Phase 2's step indicator is a throwaway. If Flowstep designs a tight, visually specific 3-step indicator, the Phase 4 developer will need to redesign it for 4 steps. This should be pre-designed as a 4-step indicator with Step 4 "greyed out/locked" in Phase 2, so Phase 4 just unlocks it.

---

## 🟠 HIGH

### H1 — The metadata form has 10+ fields (7 base + 3 design conditions) — no visual grouping or prioritization contract

**Source**: UI-SPEC §Metadata form

The metadata form has:
- 3 geometry fields (OD, t-nom, FCA)
- 1 structural field (t-structural)
- 2 selects (Design Code, Piping Class)
- 1 advanced numeric (Gauge uncertainty)
- 2 design condition fields (P, S) — collapsed details with 3 more (E, W, Y)

That's 10 fields in a single card with no visual grouping. The spec says "design conditions subgroup" but doesn't specify how it's visually separated. No column layout, no grouping borders, no section headers within the form are specified.

For an NDT engineer entering data on-site, **Piping Class and Design Code are the most safety-critical fields** — but they're buried at item 5 and 6 of a 10-field form. The spec has no visual hierarchy within the form (all fields appear equal).

---

### H2 — Column mapping panel at 4,912 rows has no "preview row" — inspector cannot verify the auto-guess is correct

**Source**: UI-SPEC §Column mapping, §Screen 2

The spec defines auto-guess aliases for 6 target fields, but the only feedback is the dropdown pre-selecting. There's no preview of what value the mapped column actually contains for the first few rows. An NDT inspector mapping a CSV with column headers like `Reading_1`, `Reading_2` (common in legacy export formats) will auto-guess fail — but they have no way to see what each CSV column contains without reading the raw file in Excel.

The spec provides no "show first 3 values of this column" preview on the mapping dropdowns. This is the most user-hostile moment in the entire wizard.

---

### H3 — The PT/MT indication repeater is underspecified for Flowstep — field layout within a repeater row is missing

**Source**: UI-SPEC §PT/MT entry

The spec says: "Add indication button appends a row: Method (PT/MT radio), Morphology (Linear/Rounded radio), Length mm, Width mm, Count (default 1), Edge separation mm (shown only when Count >= 2), Description (optional)."

That's 7 fields per row, shown inline. How these lay out within a single repeater row — whether it's a grid, a flex row, whether each field has a label above or beside it, the row height, the remove button position — is completely unspecified. Flowstep will need to invent this layout, and whatever they invent may not match the Phase 2 implementation.

---

### H4 — No loading/skeleton state contract for Screen 3 after evaluation

**Source**: UI-SPEC §Screen 3 States

The spec says "Loading reuses Screen 2's evaluating state (this screen renders after it)." That means during the `calc()` computation (which for 4,912 rows could take 200–500ms), the user sees Screen 2 with `Run Evaluation` disabled and `Evaluating…` text — and then Screen 3 snaps in fully populated. There's no skeleton, no progress bar, no transition.

For 4,912 rows this might be imperceptible (TypeScript in-browser). But the spec doesn't bound this. If the Phase 3 LLM layer is added (which adds streaming per CML), Screen 3 will need a progressively populated skeleton. The Phase 2 spec hard-codes a snap transition that Phase 3 will need to replace — another throwaway design moment.

---

### H5 — The accent-color reserved list (6 uses) conflicts with the demo-mode banner, which is neither text link nor CTA

**Source**: UI-SPEC §Color, §Copywriting Contract

The accent `#2563eb` is strictly reserved for 6 use cases. The demo provenance banner (`Demo scenario loaded — Zenodo record 16780668 subset (sample data)`) is none of those 6. The spec doesn't assign it a color. It will default to whatever the developer picks — likely surface `#171717` with muted text — but this is not specified. A hackathon judge will immediately notice the banner if it looks wrong (either too prominent or invisible).

---

## 🟡 MEDIUM

### M1 — The `View format guide` collapsible has no interaction spec

What content does it show? How many columns? What example row? The copy contract says "lists expected columns, one example row, unit note" — but the format of those columns (table? code block? bullet list?) is unspecified. Flowstep will design something arbitrary.

### M2 — Pagination `Showing 1–50 of 4,912` — no page controls spec

The spec says "paginated 50 rows/page" but never defines the pagination control: Previous/Next buttons only? Page number input? First/Last buttons? Keyboard navigable? The 4,912-row table with 98 pages and no jump-to-page control is unusable for finding a specific CML error.

### M3 — `Download sample CSV` link has no defined behavior

Does it download a pre-committed CSV file? Generate one on the fly? What is the filename? What are the contents — fake data or Zenodo subset? Unspecified. Flowstep cannot design the loading state or error state of this action.

### M4 — Sticky footer action bar on Screen 2 — no height or z-index contract

The validation summary + `Run Evaluation` button in a sticky footer will overlap the last metadata form fields on short viewports (768px height). No scroll behavior contract, no overlap handling.

### M5 — "Advanced: E, W, Y" collapsed `<details>` — the expand label is unspecified

The spec says "collapsed `<details>`" but gives no label for the summary element. `Advanced: E, W, Y` is the field names in prose — but the summary text that a user sees to expand it, and its visual treatment (caret? chevron? underline?), is missing.

### M6 — Verdict chip boundary case: the UI-SPEC encodes the boundary convention correctly, but `ut-criteria.json` still doesn't (C3 from adversarial review v2)

The UI-SPEC (line 114) locks: `t_actual == t_required` is RE-CHECK; `t_actual == t_required + uncertainty` is ACCEPT. This is the correct convention. But `ut-criteria.json` still uses ambiguous string conditions (adversarial_review_v2.md C3). The UI design is ahead of the data contract here. If a developer implements from `ut-criteria.json`, they'll get the wrong boundary and the chip will be wrong.

---

## 🟢 LOW

### L1 — No dark-mode screenshot reference
Flowstep will need to know what `#0a0a0a` actually looks like against `#171717` cards with `#262626` borders in browser. The hex values are correct but the visual contrast between page background and surface cards is very subtle — a designer unfamiliar with dark UIs may push card backgrounds lighter to compensate, breaking the spec.

### L2 — No error state for PT/MT indication with invalid dimensions (e.g. Length=0)
The spec says "Numbers must be > 0" but doesn't specify whether the error renders inline per field or blocks the `Add indication` row-level submit button.

### L3 — No favicon/logo contract
The app has `app/favicon.ico` (default Next.js favicon). No spec for whether a custom logo or favicon is needed, or how `FlawCheck` is typeset in the header.

---

## What Flowstep Cannot Design Without

Before handing off, the following must be decided:

1. **4-step vs 3-step wizard** — decide now, design the 4-step indicator with Step 4 locked
2. **Screen 3 table layout at 1366px** — needs a concrete column-width table or compact mode spec
3. **Step indicator visual design** — exact px height, active/inactive chip style, is each step clickable
4. **Metadata form visual grouping** — which fields are in which named group, column grid within the form card
5. **Column mapping preview** — show first 3 values per column or not
6. **PT/MT repeater row layout** — inline grid or stacked, field label placement
7. **Demo banner color** — surface card with a specific border tint? amber tint (sample data warning)? accent tint?
