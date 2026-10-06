# 04-04 Plan Summary — Wrap: Integration Proof, Standing Gates, Coverage Sweep

**Completed:** 2026-10-05 (inline orchestrator execution)

## Task 1 — Standing gates + builder invariants
- Full suite: **494 passed / 5 skipped** (455 hermetic from Phases 1-3 + 39 Phase 4). Typecheck ✓, lint 0 errors ✓, build ✓.
- Byte-identity vs phase-start ref: lib/calc + lib/criteria + lib/reasoning ✓ (untouched). package.json + package-lock.json ✓ (zero-install honored).
- Branch build/phase-4 ✓; UNINSTALL.md `## Phase 4` no-new-packages note ✓ (scoped grep per checker round 1).
- UI-57 (react-pdf selectable Text nodes — no rasterization) and UI-58 (labels + required indicators) asserted structurally in the 04-02/04-03 suites.

## Task 2 — Full-chain integration proof + coverage sweep
- `tests/report/report-integration.test.ts`: session → buildReportSnapshot → withSignOff → computeInputHash + buildAuditSteps (honest-mixed: one real step, one null) → ReportPdfRequestSchema.parse → REAL route POST → 200 + %PDF magic + >1 kB + application/pdf. Verbatim-text invariant: every buildConclusions citationId is a known citations.json record composed via citationRef.
- **UI-49..58 coverage sweep** (each id → proving test):
  - UI-49 → tests/report/pdf-route.test.ts (%PDF magic, >1 kB, Content-Type)
  - UI-50 → tests/report/pdf-route.test.ts (400s: empty/invalid/malformed/incomplete sign-off; never 500 for bad input)
  - UI-51 → tests/wizard/reasoning-stream-ui.test.tsx + print-variant isolation greps (04-03; print renders complete document with PDF route independent)
  - UI-52 → tests/wizard/pipeline-status-bar.test.tsx + tests/report/report-document-signoff.test.ts (all-four gate; reconciliation recorded below)
  - UI-53 → 04-01 sessionStorage sign-off persistence (withSignOff + readReportSnapshot)
  - UI-54 → tests/wizard/screen3-cta.test.tsx (audit mapping: nulls, never fabricated) + pdf-document audit appendix (em-dash nulls)
  - UI-55 → tests/report/report-integration.test.ts (verbatim invariant) + report-document unit-assumption line + PDF disclaimer footer
  - UI-56 → tests/wizard/screen3-cta.test.tsx (CTA enabled, no hint span)
  - UI-57 → tests/pdf/react-pdf-smoke.test.ts + pdf-route test (Text-node rendering, %PDF)
  - UI-58 → tests/report/report-document-signoff.test.ts (labels + required indicators)
- **REPT-01** → 04-02 (PDF document 1:1 mirror + route) + report-integration (real buffer); "revision block" = the header generated/source/evaluation-date row per the 1:1-mirror reconciliation.
- **REPT-02** → 04-01 (audit module + writer) + 04-02 (appendix in PDF) + 04-03 (appendix in HTML); "model + version" = the version is carried inside the env-pinned model ID rendered per step.
- **REPT-03** → 04-03 (print variant omission of banner/footer; browser supplies chrome) + report-integration (content identical across renderers).

## Notes
- 04-03's /report/print page is intentionally NOT a separate page — the print variant of the existing /report page (variant="print" prop) is the deliverable; browser print supplies chrome. Isolation holds: the print variant imports nothing from lib/llm.
