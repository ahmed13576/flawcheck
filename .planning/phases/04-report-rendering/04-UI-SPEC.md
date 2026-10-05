# Phase 4 UI-SPEC — Report Rendering (Flowstep Screen 4 unlock)

**Gathered:** 2026-10-05 · **Baseline:** 03-UI-SPEC (dark chrome) + Flowstep `Screen 4.png` (light report document) + the 03-00b locked `/report` preview (FS-01..12)

## Design System Delta
- Report document body renders LIGHT (cream `#faf7f2`-family per mock) inside the dark chrome — one deliberate light island; all other chrome unchanged.
- No new packages. `@react-pdf/renderer` renders server-side; the on-screen document is unchanged HTML.

## Screens / Regions
1. **`/report` (unlocked)**: existing ReportDocument layout (header + PENDING INSPECTOR SIGN-OFF chip, generated/source/date block, Component context, CML measurements, PT/MT indication, Clause-cited conclusions, Next-inspection callout, Inspector sign-off form, disclaimer footer) — plus the NEW audit appendix section.
2. **Sign-off form**: Name (text), Certification (text), Date (date), Signature (textarea) — all four required before Download PDF enables; values persist to sessionStorage with the snapshot; sign-off state renders in the header chip (`PENDING INSPECTOR SIGN-OFF` → `SIGNED OFF — {name}`).
3. **Download PDF**: POST to `/api/report/pdf` returning `application/pdf`; button disabled until signed off; on failure shows inline error text, never a blank tab.
4. **Print report**: opens `/report/print` (same document, print media styles, `@media print` hides chrome/footer buttons, `window.print()` on load) — independent of the PDF route.
5. **Audit appendix**: new section listing per-step pipeline telemetry (extraction/narrative: model, tokens, latency — from the snapshot's audit data), input hash, evaluation timestamps; rendered in both PDF and print paths.
6. **Screen 3 CTA unlock**: footer "Open report preview" button loses `disabled`; navigates to `/report`.

## Copywriting (exact strings)
- Signed chip: `SIGNED OFF — {name}` · Download enabled title: `Download PDF` · Print: `Print report` · Failure inline: `PDF generation failed — use Print report as a fallback.` · Audit heading: `Audit appendix` · Disclaimer: verbatim from the 03-00b preview footer.

## UI Considerations (lifted into plan must_haves)

| id | consideration | verification | status |
|---|---|---|---|
| UI-49 | PDF route returns a real `%PDF` buffer (>1 kB) with `Content-Type: application/pdf` for a signed-off snapshot | explicit | resolved |
| UI-50 | PDF route 400s (not 500) when the snapshot is missing or the sign-off is incomplete; inline failure copy renders | explicit | resolved |
| UI-51 | Print route renders the COMPLETE report (all sections incl. audit appendix) with the PDF route disabled — proven by toggling the PDF route off | explicit | resolved |
| UI-52 | Download PDF button is disabled until name+certification+date are filled; enabled after; chip flips to SIGNED OFF — {name} | explicit | resolved |
| UI-53 | Sign-off values persist across a page reload (sessionStorage) | explicit | resolved |
| UI-54 | Audit appendix lists extraction + narrative steps with model, tokens, latency and the input hash — no fabricated entries when usage is absent (`—` per resolution 2) | explicit | resolved |
| UI-55 | Every render path (preview, print, PDF) carries the unit assumption + pending-sign-off/signed framing + disclaimer; zero verbatim ASME/API text (tokenizer check on PDF text extraction) | explicit | resolved |
| UI-56 | Screen 3 footer CTA is enabled and navigates to /report (aria-disabled removed) | explicit | resolved |
| UI-57 | PDF text is selectable (react-pdf text nodes, not an image rasterization) | backstop | resolved |
| UI-58 | Sign-off form fields have labels + required indicators; keyboard reachable | backstop | resolved |

**Status: all resolved — 0 unresolved.** Planner lifts this table verbatim into must_haves.
