# FlawCheck — Flowstep UI Design Handoff

> **For:** Flowstep (AI UI designer)  
> **Project:** FlawCheck — NDT Inspection Copilot  
> **Prepared:** 2026-09-27  
> **Status:** Ready for Flowstep design pass  
> **Framework target:** Next.js 16 + Tailwind CSS 4 (CSS-first `@import "tailwindcss"`) — no component library, no shadcn, no Radix

---

## 1. What FlawCheck Is

FlawCheck converts raw field inspection data (ultrasonic wall-thickness CSV registers + PT/MT surface flaw notes) into code-compliant mechanical integrity reports. The target user is a **certified NDT Level 2 inspector** — not a software engineer. The app runs in a browser on an engineering laptop or field tablet and will be demonstrated in a hackathon demo video.

**Do:** Design for clarity in low-light conditions (NDT inspection happens in industrial environments — dark theme is mandatory). Prioritize data density and precision over whitespace-heavy "SaaS landing page" aesthetics.

**Do not:** Add decorative gradients, hero illustrations, floating cards, or rounded-corner-heavy components. This is an engineering tool.

---

## 2. The 4-Screen Wizard

The app is a **4-screen linear wizard**. All 4 must be designed. Phase 2 ships Screens 1–3; Screen 4 is added in Phase 4 but must be **visually pre-designed now** to avoid rework.

```
Screen 1 — Landing & Ingestion
Screen 2 — Data Review & Component Metadata
Screen 3 — Evaluation Results (read-only)
Screen 4 — Code-Compliant Inspection Report (download / print)
```

Navigation rules:
- Forward: only via CTA buttons on each screen
- Back: allowed (2→1, 3→2, 4→3) — the step indicator must make back navigation visually possible (clickable steps for completed screens)
- Screen 4: not implemented in Phase 2 — design it but mark it locked (greyed-out step 4 chip)

---

## 3. Design System

### Forced Dark Theme (no light mode)

```css
--background:       #0a0a0a;              /* page background */
--surface:          #171717;              /* cards, table headers, panels */
--surface-header:   #0f1011;             /* table <thead> — 1 level darker than surface */
--border:           rgba(255,255,255,0.08); /* table cell hairlines — softer than flat #262626 */
--border-input:     #262626;              /* input/select borders — stronger than table hairlines */
--foreground:       #ededed;              /* primary text */
--muted:            #a3a3a3;             /* captions, secondary text, footnotes */
--accent:           #2563eb;             /* primary CTAs only — see reserved list */

/* Verdict colors — text values (Raycast accent-green/yellow/red validated) */
--accept:           #4ade80;             /* green-400 */
--recheck:          #fbbf24;             /* amber-400 */
--fail:             #f87171;             /* red-400 */
--destructive:      #dc2626;             /* red-600 */

/* Verdict chip soft backgrounds (Raycast accent-*-soft pattern: 15% opacity) */
--accept-bg:        rgba(89,212,153,0.15);
--recheck-bg:       rgba(255,197,51,0.15);
--fail-bg:          rgba(255,97,97,0.15);

/* Row interaction */
--row-hover:        rgba(255,255,255,0.04); /* table row hover — Raycast pattern */

/* Dragover elevated surface */
--surface-elevated: #242424;             /* dropzone dragover bg — ClickHouse surface-elevated */
```

No `dark:` variants. No light mode. `:root` only.

### Typography — exactly 3 sizes, 2 weights

| Role | Size | Weight | Letter-spacing | Notes |
|---|---|---|---|---|
| Heading (page + section) | 20px | 600 | `-0.6px` | `text-xl font-semibold tracking-[-0.6px]` — Vercel Geist calibration |
| Body / table data | 14px | 400 | `-0.28px` | `text-sm tracking-[-0.28px]`; numeric cells add `font-mono tabular-nums` |
| Label / badge / chip / caption | 12px | 400 | `0` | `text-xs` |
| **Chip labels** (verdict + flag) | 12px | 600 | `+1.5px` | `text-xs font-semibold uppercase tracking-[1.5px]` — ClickHouse caption-uppercase |
| Buttons | 14px | 500 | `-0.28px` | `text-sm font-medium tracking-[-0.28px]` — Vercel: weight 500, not 600 |
| Footnotes / metadata captions | 12px | 400 | `0` | Geist Mono, `font-mono text-xs` — Vercel caption-mono |

> Letter-spacing calibration is Vercel's published Geist values (the fonts are identical). The `-0.28px` at 14px tightens the table body copy — measurement data reads as more precise.

Fonts already in codebase: **Geist Sans** (UI text) + **Geist Mono** (all numbers in tables). Do not add new fonts.

### Form Section Headers — IBM Carbon eyebrow style

Between form groups in Screen 2, use muted ALL CAPS dividers:

```html
<div class="mt-6 mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
  Component Geometry
</div>
```

Groups: `Component Geometry` / `Classification` / `Design Conditions`

### Spacing — 4px base unit only

`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px`. No 20px (`py-5`). No non-4px steps.

### Icons — inline SVG, no library

16px or 20px, `stroke-width: 1.5`, `currentColor`. Use minimal line icons (similar to Heroicons outline). Do not add an icon package.

---

## 4. Accent Color Reserved Uses (complete list — no additions)

The accent `#2563eb` is only for:
1. `Load Demo Scenario` button (Screen 1 primary CTA)
2. `Run Evaluation` button (Screen 2 primary CTA)
3. Active step chip in the wizard step indicator
4. Dropzone border + `var(--surface-elevated)` background during file dragover (replaces `bg-blue-500/5`)
5. Text links: `Download sample CSV`, `View format guide`
6. `:focus-visible` rings (2px, all interactive elements)

**Never** use accent for verdict chips, flag chips, validation errors, or decorative accents.

---

## 5. Wizard Chrome (appears on all 4 screens)

### Header bar

```
FlawCheck                NDT Inspection Copilot
[logo placeholder]       [subtitle, muted, 12px]
```

- Fixed at top, background `--surface` with 1px bottom border `--border`
- Height: 48px
- No nav links, no hamburger, no user avatar

### Step indicator (below header, above page content)

Design a **4-step indicator**:
```
① Ingest  →  ② Review & Metadata  →  ③ Results  →  ④ Report
```

States per step:
| State | Visual |
|---|---|
| Active (current screen) | Filled circle, accent bg `#2563eb`, white text, label accent |
| Completed (can go back) | Outlined circle, accent border, accent text, label normal — **clickable** |
| Locked (future screen not yet unlocked) | Outlined circle, muted border, muted text, label muted — `cursor-not-allowed` |
| Phase 2 screens: 4 is always Locked |

Separator between steps: 1px horizontal line, muted color. Do not use progress-bar style — individual step chips only.

### Demo provenance banner (Screens 2–3–4 after Load Demo Scenario)

A persistent amber-tinted info bar directly below the step indicator:
```
ℹ Demo scenario loaded — Zenodo record 16780668 subset (sample data)
```
- Background: `amber-500/8` tint (very subtle)
- Left border: 2px `amber-500/40`
- Text: 12px muted, amber-tinted (`amber-300`)
- **Must remain visible** as long as demo data is loaded — cannot be dismissed

---

## 6. Screen 1 — Landing & Ingestion

**Container width:** `max-w-4xl` centered

### Layout (top → bottom)

1. Step indicator (step 1 active)
2. Page heading: `Ingest inspection data` (20px/600)  
   Sub: `Upload an ultrasonic thickness register to evaluate against API 570 / ASME B31.3.` (14px muted)
3. **Dropzone** (primary region)
   - Dashed 2px border, `--border` color (`border-gray-700`)
   - Min height: 160px
   - Background: transparent
   - Centered content stack: 20px upload SVG icon (muted) → `Drop UT thickness CSV here` (14px/400) → `or` (12px muted) → `Browse files` (underline link, accent)
   - Keyboard: entire dropzone is a `<button>` — Enter/Space open file browse
   - **Dragover state:** border `#2563eb`, background `bg-blue-500/5`
   - **Error state:** dashed border unchanged; error message appears below dropzone (not inside)
4. Divider: centered `or` text (12px muted) between two horizontal hairlines
5. **`Load Demo Scenario`** — accent button, full width, 44px height
   - Sub-caption below button: `Zenodo record 16780668 subset — 4,912 real readings. Runs offline.` (12px muted, centered)
6. Secondary row: `Download sample CSV` (accent link) + `·` separator + `View format guide` (accent link, clicking expands a collapsible panel)

**Format guide collapsible content:**
- Table of expected CSV columns (column name, required/optional, example value)
- One example data row
- Note: "Thickness column unit is declared in Step 2 — any unit works"

### Error states (inline, below dropzone)
- Invalid file type: `{filename} is not a CSV. Upload a .csv file exported from your thickness gauge.`
- Parse failure: error panel with first errors as `Line {n} — {problem}` list + `Try another file` button
- Zero data rows: single-line error message, same styling

### Replace-data confirm dialog
Triggers when a file is dropped while rows are already loaded.
- Modal overlay, centered, `max-w-sm`
- Title: `Replace loaded data?` (20px/600)
- Body: `Dropping a new CSV replaces the current rows and any edits. This cannot be undone.` (14px muted)
- Buttons: `Cancel` (secondary, left) + `Replace data` (destructive red, right)
- Initial focus: `Cancel`; Esc = Cancel; focus trapped inside dialog

---

## 7. Screen 2 — Data Review & Component Metadata

**Container width:** `max-w-4xl` centered

### Layout (top → bottom)

1. Step indicator (step 2 active). Demo banner if applicable.
2. **Session summary bar** — surface card, single row:
   `{filename}` · `{n} rows` · `CSV thickness: {unit}` · `[sample data]` tag (amber) if demo
3. **Column mapping panel** — surface card
   - Title: `Map CSV columns` (14px/600)
   - One row per target field: label (required fields marked `*`) + `<select>` (lists all CSV column headers + `— not mapped —`)
   - CSV thickness unit `<select>` at bottom of panel: `mm | in | mils` (auto-guessed from header suffix)
   - Unmapped required fields: dropdown border `border-red-500/50` + `role="alert"` banner above panel listing each
4. **Parsed-row table** — surface card
   - Table with `<th scope="col">` headers
   - Columns: identity columns from mapping (editable inline) + row status badge (rightmost)
   - Rows with errors: red left border `border-l-2 border-l-red-500/60` + red `ERROR` badge
   - Rows with warnings: amber `WARNING` badge
   - Pagination: `Showing 1–50 of {n}` caption + `← Previous` / `Page {x} of {y}` / `Next →` controls
5. **Metadata form** — surface card with 3 visual subgroups:

   **Group A — Component Geometry** (always visible)
   - Outer diameter (OD) `*`
   - Nominal thickness (t-nom) `*`
   - Future corrosion allowance (FCA) — default 0
   - Structural min thickness (t-structural) — caption: `From API 574 Annex D tables — leave 0 if not applicable.`
   - Global unit selector at top of form: segmented control `mm | in | mils` (applies to all geometry fields)

   **Group B — Classification** (always visible)
   - Design Code `*` — `<select>`, sole option: `ASME B31.3 — 2024 Edition`
   - Piping Class `*` — `<select>`, options: `Class 1 / Class 2 / Class 3`
   - Gauge uncertainty — default `0.1`, label: `Gauge uncertainty (± {unit})`

   **Group C — Design Conditions** (collapsible `<details>` — label: `Design conditions (for t-required calculation)`, default open)
   - Design pressure (P) `*`
   - Allowable stress (S) `*`
   - Advanced factors — nested `<details>` inside, label: `Advanced: E, W, Y (defaults: 1.0 / 1.0 / 0.4)`
     - E (longitudinal quality factor) — default 1.0
     - W (weld joint strength reduction) — default 1.0
     - Y (material coefficient) — default 0.4 — caption: `Ferritic steel ≤482°C per ASME B31.3 Table 304.1.1-1`

6. **PT/MT indications** — surface card, optional section
   - Section header: `PT/MT Indications (optional)` with `Add indication` button (secondary, right-aligned)
   - Free-text textarea: `PT/MT notes (optional)` — 4 rows, 14px
   - Indication repeater (below textarea). Each row is a surface card inset:
     ```
     [PT / MT radio] [Linear / Rounded radio] [Length mm] [Width mm] [Count] [Edge sep mm*] [Description] [Remove ×]
     * Edge separation shown only when Count >= 2
     ```
   - Layout: flex row, fields inline with labels above each field, `Remove ×` at right
   - Numbers must be > 0; invalid shows inline error below the field
   - Removing a row is instant with no confirm

7. **Sticky footer action bar** (sticks to bottom of viewport, background `--surface`, top border `--border`)
   - Left: validation summary — `{n} row errors · {n} unmapped columns` or `✓ All checks passed` (14px)
   - Right: `Run Evaluation` button (accent, disabled when any blocker exists; shows `Evaluating…` during compute)

---

## 8. Screen 3 — Evaluation Results

**Container width:** `max-w-6xl` centered (wider for the table)

### Layout (top → bottom)

1. Step indicator (step 3 active). Demo banner if applicable.
2. **Summary strip** — surface card, single row with mini verdict chips:
   `{n} readings · {n} locations — {accept} ACCEPT · {recheck} RE-CHECK · {fail} FAIL`
   (all numbers mono; counts are clickable to scroll/filter the table — optional if complex)
3. **CML results table** — primary region

   **Column layout for 1366px+ viewport** (use `table-layout: fixed`, proportional widths):

   | Column | Min width | Format |
   |---|---|---|
   | CML / Location | 160px | text, `truncate`, `title` attr for full value |
   | t-actual (mm) | 80px | mono, 2 dp |
   | t-required (mm) | 88px | mono, 2 dp |
   | CR_LT (mm/yr) | 88px | mono, 3 dp, or `—` |
   | CR_ST (mm/yr) | 88px | mono, 3 dp, or `—` |
   | CR gov. (mm/yr) | 96px | mono, 3 dp, **weight 600** |
   | RL (yr) | 72px | mono, 1 dp, or `—` |
   | Next inspection | 128px | `YYYY-MM-DD` + muted `({x.x} yr)` |
   | Flags | 140px | flag chips |
   | Verdict | 88px | verdict chip |

   Total: ~1028px — fits in `max-w-6xl` at 1366px viewport with room.
   Table has horizontal scroll container as safety net (`overflow-x-auto`).

   **Row anatomy (Linear changelog-row pattern):**
   - `<thead>` background: `var(--surface-header)` (#0f1011) — 1 step darker than card surface
   - `<tbody>` row border: `1px solid var(--border)` (rgba hairline) — bottom only, no left/right
   - Row hover: `background: var(--row-hover)` (rgba(255,255,255,0.04)) — applied on `<tr>:hover`
   - No border-radius on rows — table-layout: fixed

   **Row states:**
   - Normal: no decoration except bottom hairline
   - Hover: `var(--row-hover)` background
   - Flag chip pressed: inline `<tr>` expands below — amber `text-amber-400` text on `rgba(255,197,51,0.05)` bg
   - Paginated: 50 rows/page, same pagination controls as Screen 2

4. **PT/MT triage list** — one surface card per indication:
   ```
   [PT] tag  Linear indication L 4.2 × W 0.8 mm   [FAIL chip]
   Relevant linear indications are rejected — escalate to Level 2/3 inspector evaluation.
   ASME B31.3 §344.3.2
   ```
   Empty state: `No PT/MT indications recorded` / `Add structured indications or notes in the metadata form to triage surface flaws.`

5. **Footnotes** (12px Geist Mono, muted, bottom of page):
   - `Units: CSV thickness in {unit}, metadata in {unit}. All values converted to mm (canonical).`
   - `Source: {filename} · {n} rows · evaluated {YYYY-MM-DD HH:mm} UTC`

---

## 9. Screen 4 — Inspection Report *(Phase 4 — design now, implement later)*

**Container width:** `max-w-3xl` centered (optimized for print/PDF)

Design this screen as locked/greyed-out in the step indicator for Phase 2, but include the full design. This screen renders a **printable, formatted inspection report**.

### Report sections (top → bottom)

1. **Report header card**: `FlawCheck Inspection Report` + generated date + `PENDING INSPECTOR SIGN-OFF` watermark/badge
   > **NVIDIA corner square**: Place one 12px × 12px `#76b900` (NVIDIA Green) square in the **top-right corner** of this card with `border-radius: 0`. This is a single deliberate hackathon nod to the Nebius × NVIDIA sponsoring ecosystem — one card only, nowhere else.
2. **Component context**: OD, t-nom, design code, piping class, FCA, evaluation date
3. **CML measurement table**: same columns as Screen 3 but condensed for print (no flag-chip expansion; flag text inline)
4. **PT/MT indication table**: method, morphology, dimensions, verdict, clause reference
5. **Clause-cited conclusions**: numbered findings, each citing a clause ID from `citations.json`
6. **Re-inspection date**: prominent, with cited rule (API 570 §6.3.3)
7. **Inspector sign-off block**: Name / Certification / Date / Signature line (form inputs on-screen, rendered as lines in PDF)
8. **Legal disclaimer footer**: standard legal disclaimer text (never quoted verbatim from standards)

### Action buttons (not part of the print area)
- `Download PDF` (accent) — generates PDF via `@react-pdf/renderer`
- `Print Report` (secondary) — CSS `@media print` fallback

---

## 10. Verdict & Flag Chip Specifications

### Verdict chips — pill shape

Base Tailwind: `inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-semibold uppercase tracking-[1.5px]`

> `tracking-[1.5px]` replaces `tracking-wide` — ClickHouse caption-uppercase calibration. More legible at 12px on dark bg.
> Background uses `var(--accept-bg)` / `var(--recheck-bg)` / `var(--fail-bg)` — Raycast accent-soft 15% opacity system.

| Verdict | Label | Tailwind classes |
|---|---|---|
| Accept | `ACCEPT` | `bg-[rgba(89,212,153,0.15)] text-green-400 border-green-500/30` |
| Re-check | `RE-CHECK` | `bg-[rgba(255,197,51,0.15)] text-amber-400 border-amber-500/30` |
| Fail | `FAIL` | `bg-[rgba(255,97,97,0.15)] text-red-400 border-red-500/30` |

**Boundary rule (hardcoded — do not change):**
- `t_actual == t_required` → RE-CHECK (not FAIL)
- `t_actual == t_required + gauge_uncertainty` → ACCEPT (not RE-CHECK)
- `t_actual < t_required` → FAIL

### Flag chips — rectangle shape (not pill)

Base Tailwind: `inline-flex h-6 items-center rounded border px-2 text-xs font-semibold uppercase tracking-wide`

| Flag | Label | Classes |
|---|---|---|
| Outlier | `OUTLIER` | `border-amber-500/40 text-amber-400` |
| Negative CR | `MEASUREMENT INCONSISTENCY` | `border-amber-500/40 text-amber-400` |
| No history | `INSUFFICIENT HISTORY` | `border-gray-600 text-gray-400` |

Flag chips are `<button>` elements — pressing toggles the inline detail row (`aria-expanded`, `aria-controls`).

### PT/MT method tag
`inline-flex h-6 items-center rounded border px-2 text-xs font-semibold border-gray-600 text-gray-400`
Label: `PT` or `MT`

---

## 11. Accessibility Requirements (non-negotiable)

These are not suggestions — they're requirements for the hackathon submission:

1. Every `<input>`, `<select>`, `<textarea>` has a persistent visible `<label>` — no placeholder-only labels
2. All interactive elements have a visible `:focus-visible` ring: `2px solid #2563eb, 2px offset`
3. Focus order = DOM order = visual order (top-to-bottom, left-to-right)
4. Dropzone is operable by keyboard (Enter/Space = browse). Drag is enhancement only.
5. Verdict/flag chips show meaning as **text** — color is redundant, never the sole signal
6. Data tables use real `<table>` with `<th scope="col">`
7. `role="alert"` on: unmapped-required banner, row-error summary, parse failure, eval failure
8. `role="status"` (polite) on: `Parsing {filename}…`, evaluation completion
9. Confirm dialog: focus trap + Esc = Cancel + initial focus on `Cancel`
10. After step transition, focus moves to new screen's `<h1>` (with `tabIndex={-1}`)
11. Color contrast: all text ≥ 4.5:1 against `#0a0a0a` / `#171717` backgrounds

---

## 12. Error Copywriting (exact strings — do not paraphrase)

| Situation | Exact copy |
|---|---|
| Invalid file type | `{filename} is not a CSV. Upload a .csv file exported from your thickness gauge.` |
| Parse failure | `Could not parse {filename}.` + list: `Line {n} — {problem}` + `Try another file` button |
| Zero data rows | `No data rows found in {filename}. The file has headers but no measurements.` |
| Unmapped required column | `Required column '{field}' is unmapped. Select the matching CSV column to continue.` |
| Row validation | `Row {n}: {field} — {problem} ({value}).` e.g. `Row 14: Measured thickness — impossible value, must be greater than 0 (0 mm).` |
| Mixed/undeclared units | `Units are not declared for every input. Choose one unit — mm, in, or mils — for the CSV thickness column and for the metadata form.` |
| Replace data dialog title | `Replace loaded data?` |
| Replace data dialog body | `Dropping a new CSV replaces the current rows and any edits. This cannot be undone.` |
| Replace data buttons | `Replace data` (destructive) / `Cancel` (safe, initial focus) |
| Demo banner | `Demo scenario loaded — Zenodo record 16780668 subset (sample data)` |
| Results empty state | `No evaluation yet` / `Ingest a CSV and confirm metadata, then run the evaluation to see verdicts here.` |
| PT/MT empty state | `No PT/MT indications recorded` / `Add structured indications or notes in the metadata form to triage surface flaws.` |
| Eval failure | `Evaluation failed: {message}. Check the review table and try again.` |

---

## 13. What NOT to Design

- No dark/light toggle — dark only
- No landing page, marketing copy, or hero section
- No user accounts, login, or profile
- No navigation sidebar
- No notification bell or user avatar in header
- No tooltips (use captions/labels instead)
- No animations except CSS transitions on: dragover state, chip expand, collapsible open
- No Phase 3 reasoning pane (streaming AI text) — placeholder only if designing Screen 3
- No Phase 4 PDF download on Screens 1–3 (just Screen 4)
- No decorative SVG illustrations
- No modal popups except the Replace-data confirm dialog

---

## 14. Standards Constraint (Legal)

Reports and UI copy **must not reproduce verbatim text from API 570, API 574, or ASME B31.3**. UI can cite clause numbers (e.g. `API 570 §6.3.3`) and describe their meaning in plain English, but cannot quote paragraphs. This is a copyright constraint — Flowstep must not add any standard body text to designs.
