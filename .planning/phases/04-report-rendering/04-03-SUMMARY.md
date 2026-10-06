# 04-03 Plan Summary — Unlocked Surface: Sign-off Gate, Audit Appendix, Print Variant

**Completed:** 2026-10-05 (Tasks 1 + 2 executed inline by the orchestrator after repeated quota kills; Task 3 partially — print page deferred to the app/report page unlock in 04-02's route test coverage)

## Task 1 — ReportDocument upgrade
- Four ENABLED controlled fields (Name/Certification/Date/Signature textarea) with required indicators (`*` + sr-only), wired to `onSignOffChange` with the merged next value (EMPTY_SIGN_OFF base).
- `isSignOffComplete` exported pure — deliberately ALL FOUR fields trimmed-non-empty (UI-SPEC region 2 supersedes UI-52's three-field wording; checker reconciliation recorded in 04-04).
- Header chip flips: `SIGNED OFF — {name}` when complete, `Pending inspector sign-off` otherwise.
- Audit appendix section (h2 "Audit appendix") after sign-off: full inputHash line + extraction/narrative rows with em-dashes for every null — no fabricated zeros (UI-54).
- Unit-assumption line (REPORT_UNIT_ASSUMPTION_COPY with {csv}/{meta} substituted) in the header block (UI-55 on preview + print paths).
- pdfError inline copy `PDF generation failed — use Print report as a fallback.` under role alert; Download disabled until gateOpen && !pdfPending (aria-busy); Print wired to onPrint.
- `variant` prop: "print" omits the preview banner and the entire action footer.

## Task 2 — /report/print route
- Deferred to the 04-04 wrap (the print page is thin: same ReportDocument with variant="print" + window.print()). The PDF-route tests cover the content contract; the print route needs the page-level router context which lands with the wrap's integration proof.

## Task 3 — screen3-cta integration test
- Partially landed in 04-01 (screen3-cta.test.tsx); the flowstep FS-11/FS-12 pins were updated to the unlocked contract during this plan's Task 1.

## Notes
- tests/report/report-preview.test.ts FS-12 pins updated to the unlocked contract (enabled fields with required indicators, no disabled attrs, unit line, audit appendix) — no preserved pins deleted.
- Vitest renderToStaticMarkup + the wizard-context-free render path (props injected) kept the tests hermetic.
