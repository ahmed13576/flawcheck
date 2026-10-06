# Phase 4: Report Rendering - Context

**Gathered:** 2026-10-05
**Status:** Ready for planning
**Mode:** Smart-discuss (design contract = the existing Flowstep Screen 4 locked preview + 03-UI-SPEC baseline; decisions pre-locked)

<domain>
## Phase Boundary

The evaluation becomes a defensible, downloadable artifact — a clause-cited PDF report with inspector sign-off and disclaimer baked in from the first template version, with a print-CSS fallback guaranteed independent of PDF-library health. The `/report` page built in 03-00b (locked preview, FS-01..FS-12 pins) is UNLOCKED: Download PDF becomes functional, sign-off persists, the audit appendix lands.

</domain>

<decisions>
## Implementation Decisions

### Locked (03-UI-SPEC baseline + handoff §5 + verified STACK.md)
- **PDF: `@react-pdf/renderer` 4.9.0** — install-clean under React 19 (verified in the Phase 1 spike: `renderToBuffer` smoke PASSED), Node runtime only (won't run on Edge). Server route renders the report document to PDF bytes from the session snapshot.
- **Print-CSS fallback FIRST**: `/report/print` route rendering the complete report with print media styles — the guaranteed deliverable when the PDF route is disabled. Proven by toggling the PDF path off (ROADMAP SC3).
- **Unlock the Flowstep Screen 4 CTA**: the "Download PDF" button becomes functional; "Print report" opens the print route; "Available after inspector sign-off" framing per the mock (button disabled until the sign-off form is filled — name + certification + date).
- **Sign-off persistence**: sessionStorage alongside the report snapshot (session-scope, per the mock's "Save review — this session only" posture). No server persistence.
- **Audit appendix**: timestamps, input hashes (existing audit-trail hashes from evaluation), model + version per pipeline step (from the store's per-step usage + extraction state — runtime-resolved, never hardcoded).
- **Cite-don't-quote**: every clause citation resolves through citations.json (the snapshot carries citationsUsed); the PDF text node content is the same tokenizer-checked pipeline. No verbatim ASME/API text.
- **Zero new packages** — @react-pdf/renderer is already installed (Phase 1 approved set).

### Claude's Discretion
PDF document component structure, print-CSS specifics, sign-off form field validation details, audit-appendix layout — within the Flowstep Screen 4 mock + 03-UI-SPEC.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `/report` page + `components/report/report-document.tsx` (ReportDocument, buildConclusions — WR-08 engine-cited) + `lib/report/session-snapshot.ts` (readReportSnapshot/writeReportSnapshot/buildReportSnapshot) — the full report layout already FS-pinned
- `lib/calc/evaluate.ts` audit hashes + `hooks/use-narrative-store` usage data + `lib/reasoning/schemas.ts` usage shapes — audit-appendix sources
- Flowstep Screen 4 mock (`flowstep-gui/Screen 4.png`): light report document on dark chrome, sign-off form, Download PDF (orange) / Print report buttons
- 03-UI-SPEC baseline tokens (dark chrome) — the report document body renders LIGHT (cream) per the mock, framed by dark chrome

### Established Patterns
- Route runtime split: PDF route = Node runtime; print route = standard page
- Hermetic suite 449 tests; test seam patterns (extractionOverride, __getFallbackStoreForTests)
- WR-08: conclusions cite the reading's OWN engine-emitted citation

### Integration Points
- Screen 3 footer "Open report preview" button (disabled, aria-describedby hint) becomes enabled → routes to /report
- The sign-off gate: Download PDF disabled until name + certification + date filled (per mock)

</code_context>

<specifics>
## Specific Ideas

- PDF layout mirrors the on-screen report document 1:1 (same data, same citations, same disclaimers) — one source of truth for content, two renderers.
- The disclaimer footer is mandatory on EVERY render path (PDF, print, preview) — engineering-aid framing per the mock's footer text.

</specifics>

<deferred>
## Deferred Ideas

- Multi-report archiving, email delivery, server-side storage (post-hackathon)

</deferred>
