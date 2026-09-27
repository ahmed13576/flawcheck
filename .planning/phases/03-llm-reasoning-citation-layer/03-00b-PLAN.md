---
phase: 03-llm-reasoning-citation-layer
plan: 00b
type: execute
wave: 2
depends_on: ["03-00"]
files_modified:
  - app/page.tsx
  - lib/report/session-snapshot.ts
  - app/report/page.tsx
  - components/report/report-document.tsx
  - components/wizard/screen-results.tsx
  - components/wizard/summary-strip.tsx
  - components/wizard/results-table.tsx
  - components/wizard/ptmt-triage-list.tsx
  - tests/wizard/flowstep-restyle.test.ts
  - tests/report/report-preview.test.ts
autonomous: true
requirements: []
  # User-directed Flowstep GUI redesign (03-CONTEXT "Flowstep GUI integration", 2026-09-27) —
  # no Phase-3 REQ ids apply; all six REQ ids (REAS-01..05, PLAT-05) are covered by 03-01..03-05
user_setup: []
estimate:
  tokens: 52000
  raw_tokens: 35000
  tasks: 2
  confidence: low
must_haves:
  truths:
    - "Screen 3 shows the hero card + 4 KPI stat cards fed by REAL evaluation counts (never the mock's placeholder numbers), sticky summary strip, All findings / Needs attention tabs, CML search box, legend, the results table with sticky CML + Verdict columns (the cluster 03-01 extends), and footer 'Back to metadata' / 'Save review' (session-only persist) / 'Open report preview' rendered DISABLED per the locked decision"
    - "FS-12: Screen 4 exists at /report as the locked report preview rendering the current session's REAL data per Screen 4.png — light document, PENDING INSPECTOR SIGN-OFF chip, component context, CML measurements + PT/MT indication tables, clause-cited conclusions, next-inspection callout, non-functional sign-off fields, disclaimer, preview banner, disabled Download PDF/Print — with zero PDF generation"
    - "FS-01..FS-12: the full 12-row Flowstep visual contract is pinned in tests — 03-00's FS-01..FS-08 re-asserted on the completed screens plus FS-09..FS-11 here and FS-12 in the report-preview suite — so 03-05 sweeps ids backed by named tests"
    - "All hermetic tests stay green; verdict chip TEXT (ACCEPT/RE-CHECK/FAIL), data-* hooks, aria patterns, reducer contracts, and resultRowKey remain byte-identical through the Screen 3 restyle"
  artifacts:
    - path: "lib/report/session-snapshot.ts"
      provides: "writeReportSnapshot/readReportSnapshot against sessionStorage key flawcheck:report-snapshot:v1 — session-only serialization of the evaluation session"
    - path: "app/report/page.tsx + components/report/report-document.tsx"
      provides: "The locked Screen 4 report preview route: light-token document rendering real session data per Screen 4.png; generation/Download/Print gated to Phase 4"
    - path: "components/wizard/results-table.tsx (restyled)"
      provides: "Sticky CML/Location left + Verdict right cluster on opaque token backgrounds inside the preserved overflow-x-auto wrapper — the mechanics 03-01 extends to the 11-column contract"
    - path: "tests/wizard/flowstep-restyle.test.ts (extended) + tests/report/report-preview.test.ts"
      provides: "The complete FS-01..FS-12 visual-contract pins (03-05 sweeps these ids)"
  key_links:
    - from: "components/wizard/screen-results.tsx"
      to: "lib/report/session-snapshot.ts"
      via: "auto-write on results presence + Save review button write; /report reads the same snapshot"
      pattern: "writeReportSnapshot|readReportSnapshot"
    - from: "app/report/page.tsx"
      to: "lib/ingest/session.ts"
      via: "ReportDocument renders only serialized EvaluationSession slices (metadata, summary, readings, indications) — no LLM content, no new computation"
      pattern: "readReportSnapshot"
---

<objective>
Flowstep GUI integration wave 2 — completes the redesign on the foundation 03-00 laid: Screen 3 is restyled to the mock with real-data KPI cards, tabs/search/legend, the sticky CML+Verdict columns (the cluster 03-01 extends), and the mock's footer nav; the locked Screen 4 report-preview route is built at /report from real session data; and the full FS-01..FS-12 visual contract is pinned in tests.

Purpose: 03-01..03-04 wire the reasoning layer INTO these restyled components — the sticky cluster and footer semantics must exist before the Reasoning column and status bar land. Splitting the restyle keeps each plan inside its context budget (checker round 1); this plan carries every Screen 3/4 affordance the mockups add that has no Phase-3 REQ id.

Output: restyled Screen 3, the session snapshot lib, the /report locked preview, and the FS-01..FS-12 test pins. Reducer contracts, data-* hooks, aria patterns, resultRowKey, verdict chip TEXT: unchanged.
</objective>

<execution_context>
@C:/Users/moham/.zcode/gsd-core/workflows/execute-plan.md
@C:/Users/moham/.zcode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03-llm-reasoning-citation-layer/03-CONTEXT.md
@.planning/phases/03-llm-reasoning-citation-layer/03-UI-SPEC.md
@.planning/phases/03-llm-reasoning-citation-layer/03-00-SUMMARY.md
@app/page.tsx
@lib/ingest/session.ts
@lib/wizard/format.ts
@components/wizard/screen-results.tsx
@components/wizard/summary-strip.tsx
@components/wizard/results-table.tsx
@components/wizard/verdict-chip.tsx

# Design source (mockups + reference projects — the binding visual spec for Screens 3-4)
flowstep-gui/Screen 3.png
flowstep-gui/Screen 4.png
flowstep-gui/Screen-3/src/Screen-3.tsx
flowstep-gui/Screen-4/src/Screen-4.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restyle Screen 3 (results) — real-data KPI cards, tabs/search/legend, sticky CML+Verdict columns, footer + session snapshot</name>
  <files>components/wizard/screen-results.tsx, components/wizard/summary-strip.tsx, components/wizard/results-table.tsx, components/wizard/ptmt-triage-list.tsx, lib/report/session-snapshot.ts, app/page.tsx, tests/wizard/flowstep-restyle.test.ts</files>
  <read_first>
    - flowstep-gui/Screen 3.png — the binding layout (copy strings verbatim)
    - flowstep-gui/Screen-3/src/Screen-3.tsx — reference markup to mirror
    - components/wizard/screen-results.tsx — current region order (indicator → summary strip → table → PT/MT → footnotes) and the Phase 2 footnotes/caption; pagination and RESULTS_PAGE_SIZE live here
    - components/wizard/summary-strip.tsx + results-table.tsx — the components being restyled; resultRowKey namespacing (results-table.tsx ~line 36-38) and the overflow-x-auto wrapper are load-bearing for 03-01
    - lib/ingest/session.ts — EvaluationResults.summary fields (digest/KPI source) and ReadingResult fields (flags, verdict)
    - lib/wizard/format.ts — formatFixed(value, dp): null/non-finite renders "—" — THE shared formatter for every number on this screen
    - 03-CONTEXT.md "Flowstep GUI integration" — the locked decisions this task implements (KPI real data, footer semantics, Open report preview disabled, mock numbers are placeholders)
    - 03-00-SUMMARY.md — the token system, ui primitives, and Screen 1-2 restyle this task builds on
  </read_first>
  <action>
    Restyle is className/markup-structure only: every dispatch, reducer action, data-* hook, aria pattern, and gated interaction stays byte-identical. Use 03-00's primitives and token classes; icons from lucide-react.

    1. `screen-results.tsx` (Screen 3 per Screen 3.png): keep the demo banner; add the hero card — orange eyebrow "EVALUATION COMPLETE", h1 "Your findings are ready" (data-screen-heading stays on the screen's h1), sub "We've checked {n} readings and surfaced the items that deserve a closer look." with n from the real summary count; then 4 KPI stat cards — Accepted (green token), Re-check (amber), Fail (red), Locations — fed ONLY by real evaluation counts from results.summary (toLocaleString("en-US"); the mock's 3,812/876/224/42 are placeholder data — never render mock numbers). Add the "All findings / Needs attention" tabs and the CML search input (Search icon, placeholder "Search CML or location") as LOCAL component state (useState) — the reducer is untouched. "Needs attention" filters to rows with verdict re_check or reject OR any flags; the search box case-insensitively matches the CML id or location description; both compose and reset the table's page to 1 on change (pagination mechanics otherwise untouched, RESULTS_PAGE_SIZE stays 50). Add the legend row (Accepted/Re-check/Fail colored dots). Restyle the PT/MT triage cards per the mock's "Recommended next step" pattern (arrow icon in an orange-tinted circle, verdict chip right, clause line from the existing engine data). Footnotes: keep the units/source lines (mono, muted token styling). Footer bar: "Back to metadata" (existing set-screen back nav) left; right: "Save review" (secondary) and "Open report preview" (orange primary) — with "Open report preview" rendered DISABLED per the locked decision (aria-disabled="true", muted/disabled styling, accessible hint "Report generation unlocks in Phase 4"); Phase 4 enables it and owns generation.

    2. `summary-strip.tsx`: restyle and make sticky (sticky top below the header, opaque token background) per the mock's summary bar — "4,912 readings · 42 locations · 3,812 ACCEPT 876 RE-CHECK 224 FAIL" pattern from REAL counts with the "Read-only evaluation results" note right. Content sources unchanged.

    3. `results-table.tsx`: restyle to Flowstep tokens keeping the 10-column locked order, resultRowKey namespacing, flag detail rows, and the overflow-x-auto wrapper EXACTLY as they are — 03-01 (next plan) adds the 11th Reasoning column on top of this. Implement the sticky cluster from the binding C1/C3 decision NOW: the first column (CML/Location) `sticky left-0` and the last column (Verdict) `sticky right-0`, both with OPAQUE token backgrounds (bg-card thead / bg-background body cells) and a z-index above plain cells. Do NOT add a Reasoning column here — that is 03-01's task; build the sticky mechanics so an 11th trailing column can slot in without rework.

    4. `lib/report/session-snapshot.ts`: `writeReportSnapshot(session: ReportSnapshot): void` and `readReportSnapshot(): ReportSnapshot | null` over sessionStorage key `flawcheck:report-snapshot:v1`. ReportSnapshot is a serializable slice of the current evaluation session: { evaluatedAt, sourceName, units, metadata, summary, readings, indications, notes }. Hand-roll a defensive parse on read (shape-checked, returns null on absent/corrupt — sessionStorage can hold anything). Session-level only: nothing persists beyond the browser session and nothing transmits.

    5. `app/page.tsx`: a small effect in WizardRoot auto-writes the snapshot whenever results exist (so the /report route in Task 2 is reviewable by direct URL per the mock's "You can review the full layout now"); the Save review button in action 1 additionally writes + shows a transient "Saved — this session only" confirmation (session-level no-op persist per the locked decision — no reducer change, no durable storage). Keep 03-00's header chrome and demo banner exactly as landed.

    6. Tests: extend `tests/wizard/flowstep-restyle.test.ts` with FS-09..FS-11: KPI cards render a fixture summary's real counts (and never the mock numbers), the Needs-attention tab filters a fixture row set correctly, the search box filters and resets pagination, the footer renders all three actions with Open report preview carrying aria-disabled="true", and the sticky CML/Verdict cells carry their sticky classes with opaque token backgrounds.
  </action>
  <verify>
    <automated>npx vitest run tests/wizard/flowstep-restyle.test.ts tests/wizard && npm run typecheck && npm run build</automated>
    <fails_when>a KPI card renders a mock placeholder number instead of the summary's real counts; the results table loses the overflow-x-auto wrapper, resultRowKey, or the locked column order; the sticky cells use translucent backgrounds; Open report preview is enabled; Save review or the auto-write path loses its session-only guarantee (durable storage introduced); any data-* hook or aria pattern changed; the reducer is touched (`git diff lib/wizard/reducer.ts` non-empty); any hermetic test fails; the build fails.</fails_when>
  </verify>
  <acceptance_criteria>
    - Screen 3 renders 4 KPI cards whose values equal results.summary counts for the fixture session
    - Tab + search filtering works on local state with the reducer untouched (`git diff lib/wizard/reducer.ts` empty)
    - The footer renders all three actions with Open report preview carrying aria-disabled="true"
    - Sticky CML/Verdict cells use opaque token backgrounds; overflow-x-auto wrapper, resultRowKey, and the locked 10-column order are preserved
    - Full wizard suite green; npm run build green
  </acceptance_criteria>
  <done>Screen 3 matches the Flowstep mockup with real-data KPIs/tabs/search, the sticky CML+Verdict cluster, and the session-snapshot wiring; generation affordances stay gated to Phase 4.</done>
</task>

<task type="auto">
  <name>Task 2: Build the locked Screen 4 report-preview route (/report) + full FS-01..FS-12 pin sweep</name>
  <files>app/report/page.tsx, components/report/report-document.tsx, tests/report/report-preview.test.ts, tests/wizard/flowstep-restyle.test.ts</files>
  <read_first>
    - flowstep-gui/Screen 4.png + flowstep-gui/Screen-4/src/Screen-4.tsx — the binding layout (copy strings verbatim)
    - lib/report/session-snapshot.ts from Task 1 — the snapshot this route reads (same key, same shape)
    - lib/ingest/session.ts — the ReportSnapshot slice fields (metadata, summary, readings, indications, notes)
    - lib/wizard/format.ts — formatFixed for every numeric cell ("—" for nulls, never Infinity/NaN)
    - lib/calc/criteria.ts — criteria.citations records (code, clause, title, edition) for clause references; grep lib/calc for the re-inspection rule's citation id (never hardcode a clause string)
    - components/wizard/verdict-chip.tsx — verdict TEXT source (ACCEPT/RE-CHECK/FAIL); reuse the constants, do not restyle this file
    - 03-CONTEXT.md "Flowstep GUI integration" — Screen 4 preview-only locked decision (generation gated to Phase 4)
  </read_first>
  <action>
    1. `app/report/page.tsx` + `components/report/report-document.tsx` (Screen 4 per Screen 4.png): the page is a "use client" route that reads the snapshot on mount and `router.replace("/")` when absent. ReportDocument is a pure presentational component ({ snapshot }) rendering a subtree with `data-appearance="light"` so the light token block applies — the warm paper document from the mock on the dark chrome. Sections in mock order: top banner (lock icon) "Report preview ready — Generation unlocks in Phase 4. You can review the full layout now."; title row (green status dot + "FlawCheck Inspection Report" + "PENDING INSPECTOR SIGN-OFF" badge); GENERATED / SOURCE / EVALUATION DATE meta block (generated = render date, source = snapshot sourceName, evaluation date = evaluatedAt); "Component context" grid (OD, t-nom, design code + edition, piping class, FCA, evaluation date — from metadata, formatFixed where numeric); "CML measurements" table (CML/Location, t-actual, t-required, CR gov., RL, Next inspection, Flags, Verdict — real readings, formatFixed, "—" for nulls, verdict TEXT via the same ACCEPT/RE-CHECK/FAIL strings as VerdictChip); "PT/MT indication" table (Method, Morphology, Dimensions, Verdict, Clause reference — clause rendered ONLY from the citations.json record fields for the indication's engine-emitted citationId, cite-don't-quote; muted empty-state line when there are no indications); "Clause-cited conclusions" numbered list with left-orange-border entries — deterministic one-line summary per non-ACCEPT reading and per indication verdict (naming the CML/indication and its verdict), each ending with the clause ref from the citations.json record; a single muted line when everything accepts (this is the Phase-3 placeholder list — Phase 4 replaces it with narrative-driven conclusions); next-inspection callout (amber) with the earliest non-null next-inspection date and "Rule applied: {code} {clause}" from the engine-emitted re-inspection citation record (grep lib/calc for the id — never hardcode the clause string); "Inspector sign-off" Name/Certification/Date/Signature fields NON-FUNCTIONAL in Phase 3 (disabled inputs, no state, "Sign after reviewing the findings." hint); mono disclaimer block verbatim from the mock ("This report is an engineering aid based on supplied measurements and stated assumptions..."). Footer: "Back to results" (router.push("/")) left; "Download PDF" and "Print report" BOTH disabled with the "Available after inspector sign-off" note. ZERO PDF generation, zero print CSS this phase (Phase 4 owns both).

    2. Create `tests/report/report-preview.test.ts` rendering ReportDocument with a fixture snapshot: the PENDING INSPECTOR SIGN-OFF chip, both tables render fixture rows with "—" for nulls (no Infinity/NaN anywhere), clause references appear only as citations.json record fields, the conclusions list matches the fixture's non-accept rows, sign-off inputs are disabled, the banner text is exact, Download PDF/Print are disabled, and the light-appearance attribute is present. This suite is the FS-12 pin.

    3. Full-contract sweep: extend `tests/wizard/flowstep-restyle.test.ts` so the completed screen set pins FS-01..FS-12 in one place 03-05 can cite — re-assert 03-00's FS-01..FS-08 pins still hold on the finished screens and that the FS-09..FS-11 pins from Task 1 are present, giving every one of the 12 visual-contract rows a named test.
  </action>
  <verify>
    <automated>npx vitest run tests/report/report-preview.test.ts tests/wizard/flowstep-restyle.test.ts && npm test && npm run typecheck && npm run build</automated>
    <fails_when>the report route renders PDF or print CSS; a fabricated clause string appears instead of citations.json record fields; Open report preview is enabled anywhere or Download PDF/Print are enabled; the report renders LLM content or newly computed values instead of serialized session slices; any FS-01..FS-12 pin fails in the sweep; a fabricated clause string appears instead of citations.json record fields; any hermetic test fails; the build fails.</fails_when>
  </verify>
  <acceptance_criteria>
    - /report renders the locked preview from a session snapshot; absent snapshot redirects to /
    - Download PDF/Print are disabled; the banner text matches the mock exactly
    - report-preview suite pins FS-12 (chip, tables with "—" nulls, record-field clause refs, disabled sign-off, light appearance)
    - The FS-01..FS-12 sweep in flowstep-restyle.test.ts passes; full hermetic suite green; npm run build green
  </acceptance_criteria>
  <done>/report serves the locked preview from live session data with generation gated to Phase 4, and the full FS-01..FS-12 Flowstep visual contract is pinned for 03-05 to sweep.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| session snapshot → sessionStorage → /report | The user's own current-session evaluation data serialized to their own browser storage |
| mock/fixture numbers → KPI cards | Placeholder numbers from the mock must never render as data — real summary counts only |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-03-20 | Information Disclosure | report snapshot in sessionStorage | low | accept | Snapshot is the user's own current-session data in their own browser; nothing persists beyond the session, nothing transmits, no PDF |
| T-03-21 | Tampering | report content spoofing on /report | low | mitigate | ReportDocument renders only serialized session calc results + citations.json record fields; verdict TEXT reuses the repo's ACCEPT/RE-CHECK/FAIL strings; zero LLM content on Screen 4 in Phase 3 |
| T-03-SC | Tampering | npm/pip/cargo installs | high | mitigate | No install tasks in this plan; the phase's single install (5 Flowstep design packages) is user-gated at 03-00's blocking checkpoint and ledgered in UNINSTALL.md — any additional install triggers a STOP-and-ask per builder constraint 1 |
</threat_model>

<verification>
- `npm test` (full hermetic suite) green; `npm run typecheck && npm run build` green
- `git diff lib/wizard/reducer.ts` empty (reducer contracts unchanged)
- Verdict chip TEXT gates, SOURCE-CLEAN and DOCS-CLEAN greps, data-* hooks, aria patterns, resultRowKey: unchanged (grep-verified)
- Flowstep visual contract rows this plan implements and pins:
  - FS-09 Screen 3 hero card + 4 KPI stat cards fed by real summary counts
  - FS-10 Screen 3 All findings / Needs attention tabs + CML search + legend + sticky summary strip
  - FS-11 Screen 3 footer: Back to metadata / Save review (session-only) / Open report preview disabled in Phase 3 (locked decision)
  - FS-12 Screen 4 locked report preview per mock with generation gated to Phase 4
  - Sticky CML+Verdict cluster (binding C1/C3) implemented inside the preserved overflow-x-auto wrapper — extended to the 11-column contract by 03-01
</verification>

<success_criteria>
Screen 3 matches the Flowstep mockup with every new affordance fed by real evaluation data and the sticky cluster 03-01 builds on; the locked /report preview renders real session data with generation gated to Phase 4; the complete FS-01..FS-12 visual contract is pinned in named tests — and 03-01..03-04 integrate the reasoning layer into these finished components instead of retrofitting them.
</success_criteria>

<output>
Create `.planning/phases/03-llm-reasoning-citation-layer/03-00b-SUMMARY.md` when done
</output>
