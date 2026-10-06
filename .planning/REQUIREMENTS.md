# Requirements: FlawCheck — NDT Inspection Copilot

**Defined:** 2026-09-24
**Core Value:** Raw inspection data in → a defensible, code-cited acceptance decision and report out. If the acceptance reasoning is wrong, nothing else matters.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Ingestion

- [x] **ING-01**: User can upload a UT thickness CSV and see a column-mapping preview they can confirm or correct
- [x] **ING-02**: System validates uploads (malformed CSV, missing fields, impossible values) with specific error messages
- [x] **ING-03**: User can enter component metadata (t-nominal, material, service, corrosion allowance, code + edition) that drives criteria selection
- [x] **ING-04**: User can enter PT/MT indication notes with component context
- [x] **ING-05**: Units (mm/in/mils) are explicit at input, canonical mm internally, unit assumption surfaced on the report

### Calculation

- [x] **CALC-01**: System computes t-required, short/long-term corrosion rate, and remaining life in pure unit-tested code (never the LLM)
- [x] **CALC-02**: System assigns pass / re-check / fail verdicts per CML and indication, including gauge-uncertainty band
- [x] **CALC-03**: System suggests re-inspection interval from remaining life, citing the rule used
- [x] **CALC-04**: System flags statistical outliers and re-shoot candidates before acceptance

### Reasoning

- [x] **REAS-01**: Lightning extracts/structures readings and notes into validated JSON (schema + Zod + one bounded retry)
- [x] **REAS-02**: Super-120B produces acceptance narrative around precomputed values — it never computes
- [x] **REAS-03**: Acceptance decisions cite clause IDs only from the builder-vetted, edition-pinned allowlist (renderer-enforced)
- [x] **REAS-04**: User sees a visible reasoning chain (inputs → clause → limit → verdict) per decision
- [x] **REAS-05**: PT/MT indications are evaluated against the builder's structured criteria config (L2 ground truth)

### Report

- [x] **REPT-01**: User can export a PDF report (header, CML grid, indication table, conclusions, revision block, sign-off, disclaimer)
- [x] **REPT-02**: Report includes an audit appendix (timestamps, input hashes, model + version per step)
- [x] **REPT-03**: Print-CSS fallback guarantees report output even if the PDF library fails

### Platform

- [x] **PLAT-01**: All model calls via Token Factory OpenAI-compatible API; env-configured IDs validated against live `/v1/models` at startup
- [x] **PLAT-02**: LLM responses stream (SSE); structured output enforced (`json_object` + Zod + one bounded retry)
- [x] **PLAT-03**: Tavily code-edition/errata lookup runs post-acceptance, cached, degrades gracefully — never blocks the acceptance flow
- [x] **PLAT-04**: Public demo is abuse-guarded (per-IP rate limit, token caps, unguessable demo path)
- [x] **PLAT-05**: Model badges show which Nemotron model handled each step

### Demo & Submission

- [x] **DEMO-01**: One-click demo mode preloaded with the verified Zenodo tank dataset + honestly-labeled sample PT/MT scenario
- [x] **DEMO-02**: Seeded scenarios run from committed cached LLM responses, with a "Live model" toggle for the video
- [x] **DEMO-03**: App deployed to a public URL with Nebius as the AI backend
- [x] **DEMO-04**: Repo is public, OSS-licensed, README with setup + Nebius/NVIDIA usage highlighted

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Analysis Extensions

- **FLEET-01**: Fleet triage table ranking components by remaining life / risk
- **TREND-01**: CML trend charts (thickness vs time per point)
- **EXCRPT-01**: User-pasted code-excerpt reasoning (edition-specific acceptance)

### Vision (v2+)

- **VIS-01**: Weld radiograph defect triage (requires Token Factory vision-model feasibility spike; GDXray research-only license — never bundle images in repo)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Verbatim ASME/API code text or code-Q&A RAG | Copyright exposure; clause numbers + computed limits from criteria config instead |
| OCR of handwritten/legacy reports | Brittle, wrong comparison target, 2-week timeline killer |
| Instrument binary formats (.dta, proprietary) | Undocumented vendor formats; CSV export path exists on all major gauges |
| Multi-tenant auth / teams / orgs | Solo demo scope; zero judging points, added failure modes |
| Fine-tuning Nemotron on inspection data | $25 credit budget rules it out; unnecessary for the task |
| 3D corrosion maps / C-scan visualization | Point readings only; fake 3D damages credibility |
| Physical AI / hardware | No hardware available |
| Payments, multi-language, mobile app | Not judged; consume the 2 weeks |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAT-01 | Phase 1 | Complete |
| PLAT-02 | Phase 1 | Complete |
| ING-01 | Phase 2 | Complete |
| ING-02 | Phase 2 | Complete |
| ING-03 | Phase 2 | Complete |
| ING-04 | Phase 2 | Complete |
| ING-05 | Phase 2 | Complete |
| CALC-01 | Phase 2 | Complete |
| CALC-02 | Phase 2 | Complete |
| CALC-03 | Phase 2 | Complete |
| CALC-04 | Phase 2 | Complete |
| REAS-01 | Phase 3 | Complete |
| REAS-02 | Phase 3 | Complete |
| REAS-03 | Phase 3 | Complete |
| REAS-04 | Phase 3 | Complete |
| REAS-05 | Phase 3 | Complete |
| PLAT-05 | Phase 3 | Complete |
| REPT-01 | Phase 4 | Complete |
| REPT-02 | Phase 4 | Complete |
| REPT-03 | Phase 4 | Complete |
| PLAT-03 | Phase 5 | Complete |
| PLAT-04 | Phase 5 | Complete |
| DEMO-01 | Phase 5 | Complete |
| DEMO-02 | Phase 5 | Complete |
| DEMO-03 | Phase 5 | Complete |
| DEMO-04 | Phase 5 | Complete |

**Coverage:**

- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-24*
*Last updated: 2026-09-24 — roadmap traceability populated (26/26 mapped); corrected prior "24 total" miscount*
