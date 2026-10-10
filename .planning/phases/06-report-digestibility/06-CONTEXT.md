# Phase 6: Report Digestibility & At-a-Glance Findings — CONTEXT

**Date**: 2026-10-09
**Status**: Decisions locked — ready for research/planning

## <domain>

A human inspector can understand a full evaluation in seconds. Three surfaces change:

1. **Results screen (Screen 3)** gains a plain-English "What we found" brief above the table
2. **Certified PDF** gets an executive dashboard page 1 — the whole story before any detail
3. **Verdict chips** everywhere gain a shared layman glossary (plain sentence + clause sub-line)

The demo story also changes shape: a human-sized subset becomes the primary one-click demo; the full 4,912-reading register becomes the secondary scale demo.

### Scope boundary

This phase changes PRESENTATION and DEMO COMPOSITION only. It must not touch:
- Any number computed by `lib/calc/` (protected, golden-pinned)
- The verdict banding order or governing `t_required` rule
- Citation allowlist mechanics (`lib/criteria/citations.json`, renderer-locked)

</domain>

## <decisions>

### 1. Plain-English brief on the results screen

- **Position**: Top of Screen 3, above the results table — first thing the eye lands on after evaluation.
- **Structure** (hybrid, per user choice):
  - Sentence 1: one-sentence disposition — e.g. "2 of 4,912 readings failed — immediate inspection required at CML-014."
  - Sentence 2: what to do next (the consequence-led action line).
  - Short narrative paragraph covering counts by verdict and what each verdict means (2–3 sentences, prose).
  - Worst-locations list: top 3–5, one line each — location + verdict + plain-English why.
- **Clause citations**: NONE in the brief body. Zero `[[cite:]]` tokens. The tables below carry all citations. Rationale: maximum readability for non-NDT readers; brief is orientation, not defense.
- **CRITICAL INVARIANT**: the brief is composed by a deterministic TypeScript template from precomputed engine results (summary counts, governing readings). It is NOT LLM-generated. This is the user's "based on facts" requirement — same invariant as the whole app: LLM never computes, and now also: LLM never writes the summary of record. The Nemotron narrative continues to exist alongside (per-CML reasoning pane) — the brief sits above all of that as engine-derived fact.

### 2. PDF executive dashboard (page 1)

- **Page 1 = executive dashboard**: disposition banner ("2 of 4,912 FAILED — 2 locations need immediate inspection"), the existing executive summary card (from the A-remediation merge), **code-breakdown stats** — counts per verdict and per criterion type passing/failing (user: "all the types of codes passing/failing"), top-10 worst CMLs table (location, t-actual, t-required, RL, verdict), and the what-to-do-next line.
- **Detail register**: KEPT as the human-verifiable detail layer starting page 2 — full governing register (top 100 + all reject/re-check) as merged in the A-remediation. Additionally, a "Full data: downloadable CSV" pointer line is added so the register can shrink in a future revision without losing the data path.
- The top-10 table and the code-breakdown stats are presentation-level compositions of `snapshot.summary` + `snapshot.readings` — no new computation. Top-10 is RL-ascending sorted (worst remaining life first), user-decided during planning; code-breakdown stats group by verdict and governing-thickness source.

### 3. Verdict glossary

- **Form**: shared 3-line legend — SAME copy everywhere a verdict appears (results table footer, HTML report document, PDF). Not tooltips (invisible in print/PDF).
- **Tone**: plain consequence-led sentence FIRST, standard clause as a small sub-line beneath (cite-don't-quote: composed from `citationRef` record fields only).
- **Locked copy** (plain sentence / clause sub-line) — clause ids RE-MAPPED during planning (research found the originally-proposed ids absent from citations.json and semantically wrong; plain sentences unchanged):
  - **ACCEPT** — "Wall thickness meets the code minimum at this location." / `api574_10_5_1_4` (governing t-required = max(pressure, structural))
  - **RE-CHECK** — "Thickness is close to the limit — re-measure to confirm before deciding." / `api570_7_1_2_governing`
  - **FAIL** — "Wall is thinner than the code allows at this location. Action required." / `api570_7_6` (retirement/action)
- Legend placement: results table footer (Screen 3), report conclusions section (HTML), PDF page-1 footer. One shared source-of-truth constant (e.g. `lib/report/verdict-glossary.ts`) consumed by all three renderers — one source, two-to-three renderers, same pattern as `lib/report/content.ts`.

### 4. Demo dataset size

- **Primary one-click demo**: human-sized subset of the Zenodo register — one tank section, ~200–500 readings, still spanning multiple campaigns so CR/RL math is real (multiple surveys per CML). Every surface (brief, dashboard, tables) is instantly readable at this size.
- **Secondary option**: "Load full register (scale demo)" — the existing 4,912-row path stays available for the scale story and Zenodo provenance.
- Subset must be deterministic and committed (generated from the same Zenodo record, documented provenance in README + dataset attribution unchanged).

</decisions>

## <specifics>

- The demo-subset CSV must preserve the exact column schema of the full register (alias auto-guess compatibility).
- Verdict chip components keep repo-protected strings `ACCEPT / RE-CHECK / FAIL` — the glossary ADDS explanation lines, never renames chips.

</specifics>

## <code_context>

- `lib/calc/evaluate.ts` — `evaluate(session)` seam already returns summary counts + governing readings; the brief and dashboard are pure compositions of its output.
- `components/report/pdf-document.tsx` — `getGoverningPdfReadings(readings, 100)` (merged A-remediation) already produces the worst-first ordering; worst-10 = first 10. `styles.summaryCard` exists for the dashboard card.
- `lib/report/content.ts` — the established one-source/multiple-renderers content seam; verdict glossary constant belongs beside it.
- `components/wizard/verdict-chip.tsx` — `verdictLabel()` repo-protected strings; glossary renders adjacent, not inside.
- `components/wizard/screen-results.tsx` — Screen 3 host; the brief mounts above `ResultsTable`.
- `lib/ingest/csv.ts` — demo subset ships as a committed fixture parsed by the same path (no special-casing). Research constraint (06-RESEARCH.md): subset filters by Tank (WBT-S6, ~420 readings), NEVER by date — `groupByCml` derives history from the date-sorted group and a date window would manufacture insufficient_history flags.

</code_context>

## <canonical_refs>

- `.planning/ROADMAP.md` — Phase 6 entry (Goal + Success Criteria 1–3)
- `.planning/REQUIREMENTS.md` — REPT-01..03 (existing report requirements this extends)
- `lib/calc/` — protected trees; read-only (AGENTS.md standards invariant)
- `lib/criteria/ut-criteria.json` — verdict banding + boundary conventions (glossary sub-lines must not contradict)
- `lib/criteria/citations.json` — citation allowlist for glossary clause sub-lines
- `AGENTS.md` — criteria sovereignty + cite-don't-quote invariants

</canonical_refs>

## <deferred>

- Unit auto-conversion UX guard (from the other agent's Phase B) — silent metadata rescaling needs a visual cue; separate fix branch, not this phase.
- Phase D branding badges + Phase E pipeline graph (branches `phase-d-branding` / `phase-e-pipeline-graph`) — visual extras, merge after video if desired.
- Interactive animated process graph with clickable drawers — related to digestibility but a distinct capability; held back with phase-e.

</deferred>
