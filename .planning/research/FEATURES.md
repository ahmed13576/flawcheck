# Feature Research

**Domain:** AI-powered NDT inspection report copilot (UT thickness + PT/MT indication acceptance, ASME/API-style criteria)
**Researched:** 2026-09-24
**Confidence:** MEDIUM overall (datasets: MEDIUM — best-in-class item verified by direct download; competitor details: LOW–MEDIUM; report-template links: LOW — search-derived, several not directly fetchable)

---

## Demo Data Inventory (Top-Priority Question)

**Bottom line: 3 fully-real end-to-end demo scenarios are covered today, plus 1 covered with builder-authored data grounded in published worked examples, plus 1 v2 vision scenario. That is enough — do not wait for a "perfect" piping dataset; none exists publicly.**

### (a) Ultrasonic thickness measurement data — FLAGSHIP: FOUND AND VERIFIED

| Dataset | Where | Size / Format | License | Demo use case it enables | Verification |
|---|---|---|---|---|---|
| **RBM PoF Model & Supporting Data** (Pudar, Aug 2025), Zenodo record 16780668 | https://zenodo.org/records/16780668 | `RBM_PoF_Model.zip` 169.3 kB → `Appendix_A_UT_register.csv`: **4,912 real UT thickness readings**, 12 water-ballast-tank structures (WBT-P1..P6, S1..S6), grid positions (A1..D10), original scantling 20 mm, measured 19.0–19.98 mm, dates across **11 annual campaigns 2015–2025**. Columns: `Reading_ID, Tank, Grid_Position, Original_Scantling_mm, Measured_Thickness_mm, Measurement_Date` | **CC BY 4.0** (attribution) | (1) **Flagship single-tank acceptance**: t-nominal vs measured, short/long-term corrosion rate, remaining life vs t-min, re-inspection interval. (2) **Fleet triage**: rank 12 tanks by remaining life / 5-yr PoF (bonus: `pof_results.csv` included). (3) **Data-quality flagging**: `Appendix_B_RPAV_validation_metrics.csv` contains real QC observations incl. "Shadow—reshoot" verdicts; Appendix A has outliers (~19.0 mm vs 19.9 norm) | **VERIFIED — I downloaded the zip and inspected the CSV directly** (row/tank/year counts confirmed). Cross-checked MEDIUM (highest tier available for web sources) |
| Corrosion-induced thickness loss in steel quay walls (2026) | https://doi.org/10.5281/zenodo.21027907 (Zenodo) | Long-term thickness-loss measurements dataset + paper | CC BY 4.0 (per Zenodo API metadata) | Secondary marine-structure scenario; could widen demo beyond tanks | UNVERIFIED — existence confirmed via Zenodo API metadata; contents not downloaded |
| Metrological analysis of UT thickness gauge A-1210 (2025) | https://doi.org/10.5281/zenodo.14865833 | Gauge accuracy study, may contain calibration measurements | CC BY 4.0 (per API metadata) | Supporting citation for instrument-accuracy discussion in report, not a demo driver | UNVERIFIED contents |
| **Negative finding (important)** | Kaggle / Mendeley / Zenodo searched | — | — | **No public dataset of industrial *piping* CML thickness readings exists** — that data is proprietary everywhere (confirmed by multiple searches across Kaggle, Mendeley, Zenodo). Only simulated pulse-echo trace datasets exist (e.g., Mendeley "Simulated ultrasonic pulse-echo well-integrity dataset", 2024 — traces, not thickness CSVs) | VERIFIED as an absence (searches) |

**Implication for the demo:** run the flagship scenario on the real Zenodo tank register (marine tank plating — API 653/570-style framing works identically), and for a *piping* B31.3-flavored scenario author a small sample CSV yourself (you are the domain expert) with numbers traceable to the published MSTS worked example below — label it "sample data" in the UI. That is defensible; fabricating a fake "public" dataset is not.

### (b) Weld defect datasets (v2 / demo-video B-roll only — vision is out of MVP scope)

| Dataset | Where | Size / Format | License | Demo use case | Verification |
|---|---|---|---|---|---|
| **GDXray+ Welds** (GRIMA PUC Chile + BAM Berlin) | https://github.com/computervision-xray-testing/GDXray (Welds.zip 209 MB, direct Dropbox link in README) | ~21,100 X-ray images total across groups; Welds series (W0001/W0002) from BAM; defect types: cavities/porosity, cracks, inclusions, lack of fusion, shape defects | Repo GPL-3.0; **images free for research/educational use ONLY — no redistribution, no commercial use**; must cite Mery et al. 2015, *J. Nondestructive Evaluation* 34:42 | v2 vision-demo narrative and roadmap slide in video. **Do NOT bundle images in the repo** | **VERIFIED — repo fetched, download links + terms read directly** |
| **SWRD: Seam Weld Radiographic Dataset** (Zhao et al. 2025) | Paper on Research Square (Nov 2024 preprint) / Springer (June 2025); download via paper's data-availability section | 3,600+ seam-weld X-ray images (standard + T-joint welds) | Public per paper; exact terms unconfirmed | v2 vision training/eval | UNVERIFIED link — existence confirmed via paper (12+ citations) |
| Roboflow "GDXray-segmentation" | roboflow.com (search "GDXray") | 135 weld defect images | CC BY 4.0 (per aggregator) | Small, permissively licensed v2 sample set | UNVERIFIED |
| Kaggle "Casting Product Inspection" | kaggle.com (casting product datasets) | 7,348 images, defective vs non-defective classes | Per dataset page — check badge | v2 demo only | UNVERIFIED |

### (c) Sample inspection report templates / formats

| Source | Where | Notes | Verification |
|---|---|---|---|
| **CorrView International "Full Sample Report"** (UT pipe testing) | https://www.corrview.com (Ultrasonic Pipe Testing → Full Sample Report) | Real-world complete UT piping report from a corrosion-control consultancy; the exact PDF URL has moved (old link 404s) — navigate from the site menu | MEDIUM-LOW — site + section confirmed via search; PDF not re-fetched |
| Maptrack free UT thickness report template | maptrack.com | Records thickness readings, corrosion rates, remaining life — matches our output structure | UNVERIFIED (search-derived) |
| Sitemate NDT report template | sitemate.com (NDT report template page) | Flexible digital NDT template covering UT + penetrant methods | UNVERIFIED — fetch blocked (HTTP 403) |
| **US government public-domain formats** | PA DEP UST liner evaluation guidance (greenport.pa.gov, UT readings on Appendix B forms); NRC docket — Westinghouse LTR-RAC-12-57 Attachment D (UT thickness results); BNL-68166 (OSTI, UT wall-thickness methods); FHWA Dec 2024 memo (UT gauge limitations, ASTM E1961 tolerances) | US federal/state works are public domain — safest format references | UNVERIFIED links — all search-derived, domains confirmed |
| API "Thickness Measurement Report Form" (from API's Defined Procedure for UT Thickness Measurement) | api.org | The industry-standard form — **copyrighted API corpus; use as format inspiration only, never reproduce** | UNVERIFIED — treat as paid standard |

**Recommendation:** author your own report template with API 570/653-style sections (header block, component data, CML grid with t-nominal/t-min/t-actual/CR/RL, indication table, conclusions, inspector signature block) informed by CorrView/Maptrack layouts and public-domain gov formats. Own the format; don't copy a form.

### (d) Indication / acceptance criteria worked examples

| Source | Where | What you get | Verification |
|---|---|---|---|
| **Inspectioneering interactive Corrosion Rate Form** (Feb 2022) | inspectioneering.com (widgets/calculators) | Public interactive calculator: short-term & long-term corrosion rate, remaining life, next-inspection and retirement dates | Search-derived; formulas cross-confirmed |
| **MSTS Training "Corrosion Rates & Equipment Remaining Life"** | msts-training.com | **Worked numeric example** (short-term CR from last two readings; e.g., remaining life = (465 − 440)/5 = 5 years — note the units are mils, a nice units-handling demo hook) | Search snippet shows actual worked numbers |
| API 570 formulas (as commonly published) | iFactory app page, engineeringexcelspreadsheets.com + the two above | `CR_ST = (t_prev − t_actual)/Δt_ST`; `CR_LT = (t_init − t_actual)/Δt_LT`; `RL = (t_actual − t_required)/CR_governing`; `t_required = t_min + FCA` | **MEDIUM — 4+ independent sources agree**. Governing-rate selection rule needs your L2 confirmation |
| PT/MT indication criteria + worked examples | No public dataset of PT/MT indication notes found. Acceptance tables (linear vs rounded limits) live in paid standards (ASME Sec VIII appendices, API 570/570 tables, AWS D1.1) | **You supply the ground truth as a structured criteria config** (numbers + clause refs, not code text) — this is the correct MVP pattern and a genuine differentiator (see below) | VERIFIED absence of public datasets |

### Count of distinct end-to-end demo scenarios

| # | Scenario | Data reality |
|---|---|---|
| 1 | Single-tank UT acceptance: corrosion rate → remaining life → pass/fail → re-inspection interval | **REAL** (Zenodo register) |
| 2 | Fleet triage: 12 tanks ranked by remaining life / risk | **REAL** (same dataset) |
| 3 | Data-quality gate: outlier readings + "reshoot" flags surfaced before acceptance | **REAL** (Appendix A outliers + Appendix B QC verdicts) |
| 4 | Piping t-min / PT-MT indication acceptance | Builder-authored sample inputs, math traceable to published worked examples — label as samples |
| 5 | Weld radiograph defect detection | v2 only (GDXray verified, research-only license) |

**Recommendation for the 3-minute video: run scenarios 1 and 4.** Scenario 1 proves real-data credibility; scenario 4 proves the PT/MT breadth and the clause-citation reasoning. Scenario 2 makes a killer closing shot (fleet table) if time allows.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features an NDT/QA audience and hackathon judges assume exist. Missing these = "toy demo" verdict.

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| CSV upload with column-mapping preview | Instrument exports vary wildly (Einstein II, DM/Echo, Olympus); a fixed schema fails on first contact | MEDIUM | Parse header, guess mapping, let user confirm; accept at minimum `location, thickness, date` |
| Units handling (mm / inch / mils, explicit, never silent) | Unit errors are the classic NDT blunder; MSTS worked example itself is in mils | LOW | Store canonical mm internally; display both; surface the unit assumption on the report |
| Component metadata form (OD, t-nominal, corrosion allowance, material, service, design code + edition) | Acceptance is meaningless without context; every report form has this block | LOW | Dropdowns for code/edition drive the criteria config |
| Deterministic acceptance math (t-required, CR short/long-term, remaining life) | The Core Value: "if the acceptance reasoning is wrong, nothing else matters" | MEDIUM | **Pure, unit-tested functions — NOT LLM-computed.** LLM explains; code computes |
| Pass / fail / re-check verdict per CML and indication | Inspectors think in verdicts; color-coded chips are the industry visual language | LOW | Include "re-check" state — real reports use it (see Appendix B "reshoot") |
| CML reading table with min/max/avg stats | Every UT report form ever has this grid | LOW | Grid layout mirrors CorrView/Maptrack formats |
| Formatted PDF export with header, report number, revision table, inspector signature block | A report tool that can't produce the report is a calculator | MEDIUM | Client-side print-to-PDF is acceptable for demo scale |
| Audit trail (timestamp, input hash, model + version per step) | "Defensible" is the product's word; judges explicitly reward accountability; NDT reports are legal documents | MEDIUM | Append-only event log rendered in report appendix |
| Validation & error handling (malformed CSV, missing fields, impossible values) | Judges will feed it junk on purpose | LOW-MEDIUM | Friendly, specific messages |
| One-click demo mode with preloaded data | Judges won't upload their own CSVs; the video needs instant flow | LOW | Ship the Zenodo tank subset + your PT/MT samples as seed data |

### Differentiators (Competitive Advantage)

Nobody found in the scan combines CSV ingestion + code acceptance evaluation + clause-cited reasoning. These are the moat and the judging points.

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **Clause-cited acceptance decisions** (clause numbers + computed limits, never verbatim code text) | Turns an opinion generator into a defensible engineering document; directly scores "genuine problem-space understanding" | MEDIUM | Non-negotiable P1. Cite e.g. "API 570 §5.8 (corrosion rate), §6.4 (RL)" style refs from the criteria config |
| Visible reasoning chain per decision (inputs → clause → limit → verdict) | Trust + hackathon "show the AI thinking" appeal; makes Ultra's reasoning auditable | MEDIUM | Reasoning pane next to verdict; collapses into report |
| **Tavily live code-edition / errata / interpretation lookup** | Codes get revised; "which edition did you evaluate against?" is a real inspector question; Tavily prize synergy | MEDIUM | Graceful degradation when offline; store fetched sources in audit trail |
| Re-inspection interval suggestion (e.g., half-remaining-life rule) | Turns data into an action — the thing QA managers actually buy | LOW | Deterministic once RL exists; cite the interval rule used |
| Fleet triage view (rank components by remaining life / risk) | Real data supports it today (12 tanks); makes a spectacular 5-second video shot | MEDIUM | Table + sort; resist the urge to build dashboards |
| Data-quality flagging (statistical outliers, re-shoot recommendations) | Catches bad data BEFORE acceptance — inspectors' #1 silent fear; grounded in real Appendix B QC verdicts | MEDIUM | Simple z-score / threshold rules; huge credibility signal |
| Nemotron tier routing with visible model badges + token budget meter | Hackathon explicitly rewards NVIDIA model usage + Token Factory; transparency demo | LOW | Nano extracts, Super formats, Ultra reasons — show which did what |
| User-pasted code excerpt ingestion (Ultra reasons within user-supplied text) | Legally safe personalization; handles the "my plant uses the 2016 edition" case | MEDIUM | Paste-box, never stored server-side long-term; perfect demo moment |
| CML trend charts (thickness vs time per point) | Corrosion trends are the story the data tells; 11 campaigns of real data make this gorgeous | LOW-MEDIUM | Any chart lib; keep to one chart type |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| Verbatim ASME/API code text database + RAG over standards | "Ask the code book anything" is the obvious pitch | Copyright (PROJECT.md already rules this out); $25 budget can't support a vector DB; generic Q&A dilutes the acceptance workflow | Clause numbers + computed limits from a structured criteria config; user-pasted excerpts for reasoning |
| Vision defect photo classification in MVP | Flashy; GDXray exists | Needs a Token Factory vision-model feasibility spike (PROJECT.md out-of-scope); GDXray license is research-only — bundling images in the repo violates terms | Roadmap slide in the video + demo scenario 5 deferred to v2 |
| Multi-tenant auth, team roles, orgs | "Real SaaS" instinct | Solo demo scope; auth flows eat demo time and add failure modes for zero judging points | Single named session / inspector profile; localStorage-level persistence |
| Parsing legacy PDF/handwritten reports (OCR ingestion) | DocuMatrix's lane; looks impressive | Extremely brittle; wrong comparison target; 2-week timeline killer | CSV + typed notes only; mention OCR as v1.x direction |
| Native instrument file formats (.dta, .esc, proprietary binaries) | "Just plug in my flaw detector" | Binary formats are undocumented and vendor-specific | Standard CSV export path (all major gauges export CSV) |
| Fine-tuning Nemotron on inspection data | Judges love "custom model" | Explicitly ruled out by credit budget; unnecessary for this task | Prompt + criteria-config engineering with tier routing |
| 3D corrosion maps / C-scan visualization | Visual wow | We have point readings, not scanned grids; fake 3D = credibility damage | 2D trend charts + grid heat table (color-coded CML grid) |
| Auto-generated component sketches/drawings | Reports have sketches | Time sink; LLM-drawn schematics look wrong to inspectors | Simple CML grid/table layout; let users upload a photo attachment |
| Payments, subscriptions, multi-language, mobile app, offline mode | "Complete product" instinct | None are judged; all consume the 2 weeks | One polished desktop web flow, deployed on Nebius, OSS-licensed repo |

---

## Feature Dependencies

```
[Clause-cited acceptance]
    └──requires──> [Deterministic calc engine (t-req, CR, RL)]
                       └──requires──> [CSV ingest + column mapping]
                       └──requires──> [Component metadata form]
                       └──requires──> [Sample data pack (Zenodo + builder PT/MT)]

[Re-inspection interval suggestion] ──requires──> [Remaining life calc]
[Fleet triage] ──requires──> [Acceptance results across components]
[CML trend charts] ──requires──> [Repeated-campaign data (real dataset has it)]

[PDF report + revision table] ──requires──> [Acceptance results data model]
[Audit trail] ──enhances──> [Clause-cited acceptance] (evidence trail)
[Model badges + routing] ──requires──> [Audit trail] (per-step model logging)

[Tavily code lookup] ──independent──> (graceful degradation; enriches citations)
[User-pasted excerpt reasoning] ──enhances──> [Clause-cited acceptance]

[Demo mode] ──requires──> [Sample data pack]
```

### Dependency Notes

- **Clause-cited acceptance requires the deterministic calc engine:** the LLM must never do arithmetic; it wraps computed numbers in cited, explained decisions. This is the product's core trust boundary.
- **Re-inspection interval enhances the report:** it converts the acceptance result into the next action — cheap to add once RL exists (deterministic division + interval rule).
- **Tavily lookup is deliberately independent:** if Tavily fails mid-demo, the acceptance flow must complete unaffected (cached citation fallback). Never let a nice-to-have block the critical path.
- **Fleet triage conflicts with single-component depth at build time:** both compete for UI attention in a 2-week build — build triage as a read-only summary table over completed evaluations, not a separate workflow.

---

## MVP Definition

### Launch With (v1)

- [ ] CSV upload + column mapping preview + validation errors — the entry point; without it nothing demos
- [ ] Component metadata form — acceptance needs context; drives criteria selection
- [ ] Deterministic calc engine (t-required, CR ST/LT, RL, interval rule) — the Core Value; unit-tested pure functions
- [ ] Clause-cited acceptance decisions + visible reasoning pane — the moat and the judging differentiator
- [ ] PT/MT indication entry + acceptance vs builder-supplied criteria config — breadth beyond UT; your L2 ground truth encoded
- [ ] Data-quality flags (outliers, re-check) — cheap, high-credibility
- [ ] PDF report export: header, CML grid, indication table, conclusions, audit appendix, revision block — the deliverable artifact
- [ ] One-click demo mode preloaded with Zenodo tank data + sample PT/MT notes — how judges will actually experience it
- [ ] Nemotron routing badges + Tavily code lookup with graceful fallback — prize-alignment features

### Add After Validation (v1.x)

- [ ] Fleet triage table — once ≥2 components evaluate cleanly (scenario 2 is one click away)
- [ ] CML trend charts — once report layout is stable
- [ ] User-pasted code-excerpt reasoning — strong demo moment, moderate prompt-engineering risk; add after core reasoning is solid

### Future Consideration (v2+)

- [ ] Vision defect triage on radiographs — requires Token Factory vision feasibility spike; GDXray (research-only) or SWRD as data; do not bundle images in repo
- [ ] OCR of handwritten legacy reports — DocuMatrix's territory; only if pursuing the product post-hackathon
- [ ] Auth/teams/multi-tenancy — only with real users

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| Deterministic calc engine (t-req/CR/RL) | HIGH | MEDIUM | P1 |
| Clause-cited acceptance + reasoning pane | HIGH | MEDIUM | P1 |
| CSV ingest + column mapping + validation | HIGH | MEDIUM | P1 |
| PDF report + audit trail + revision block | HIGH | MEDIUM | P1 |
| Demo mode + sample data pack | HIGH (judges) | LOW | P1 |
| PT/MT indication acceptance | HIGH | MEDIUM | P1 |
| Data-quality flags | MEDIUM | LOW | P1 |
| Units handling (mm/in/mils) | HIGH | LOW | P1 |
| Component metadata form | HIGH | LOW | P1 |
| Verdict chips + CML table view | MEDIUM | LOW | P1 |
| Re-inspection interval suggestion | HIGH | LOW | P2 |
| Nemotron routing badges + budget meter | MEDIUM (judges HIGH) | LOW | P2 |
| Tavily code lookup | MEDIUM (prize synergy HIGH) | MEDIUM | P2 |
| CML trend charts | MEDIUM | LOW | P2 |
| Fleet triage view | MEDIUM | MEDIUM | P2 |
| User-pasted excerpt reasoning | MEDIUM | MEDIUM | P2 |
| Vision defect triage | HIGH (v2) | HIGH | P3 |
| OCR legacy reports | LOW | HIGH | P3 |
| Auth/teams | LOW | HIGH | P3 |

**Priority key:** P1 = must have for launch; P2 = should have, add when possible; P3 = future consideration.

---

## Competitor Feature Analysis

| Feature | DocuMatrix (SPA Innovision) | Sonatest UTLity / UTstudio+ / Zetec UltraVision | Spectora AI Report Assist (adjacent market) | Our Approach |
|---|---|---|---|---|
| Primary input | Photo of handwritten NDT report | Proprietary instrument data files | Voice notes + photos | **Plain CSV + typed notes + component metadata** |
| AI role | OCR/extraction into "smart reports" | None (analysis/plotting software) | Comment generation in inspector's style | Acceptance reasoning: extraction (Nano) → formatting (Super) → code reasoning (Ultra) |
| Code acceptance evaluation | No | No (inspector interprets) | No (home-inspection, no codes) | **Yes — deterministic math + clause citations** |
| Clause citations | No | No | No | Yes — clause numbers + computed limits |
| Remaining life / re-inspection interval | No | Thickness data trending only | No | Yes |
| Lock-in | Their platform | Their instruments | Their platform | Open CSV in, PDF + audit trail out; OSS repo |
| Target user | TIC companies digitalizing paperwork | Owners of their flaw detectors | Home inspectors | **Level 2/3 inspectors + QA/QC engineers (mechanical integrity)** |

**Landscape summary:** instrument vendors (Sonatest, Zetec, Evident) sell data-analysis software tethered to their hardware; DocuMatrix digitizes existing paperwork with OCR; Therness generates NDT *procedures*; home-inspection AI tools (Spectora, InspectorData, NACHI-community tools) prove the "AI writes the report" UX wins in an adjacent market. **No scanned player evaluates acceptance against code criteria with citations** — that intersection is open, and it is exactly where this project's domain expertise lives.

---

## Sources

Confidence per the source-hierarchy seam: cross-checked web findings = MEDIUM (highest tier available for web sources); single-source search results = LOW, marked UNVERIFIED where the page itself was not fetched.

- Zenodo record 16780668 (UT thickness register, CC BY 4.0) — https://zenodo.org/records/16780668 — **MEDIUM, verified by direct download and CSV inspection**
- GDXray+ repository — https://github.com/computervision-xray-testing/GDXray — **MEDIUM, repo fetched directly** (download links + license terms read)
- Dataset Ninja GDXray summary — https://datasetninja.com/gdxray — LOW (aggregator)
- SWRD paper (Zhao et al. 2025) — via Research Square / Springer Professional — LOW, UNVERIFIED download link
- Inspectioneering corrosion-rate calculator; MSTS Training worked example (msts-training.com); iFactory app (ifactoryapp.com); engineeringexcelspreadsheets.com — formulas MEDIUM (4+ independent agreeing sources)
- Sonatest software suite — https://sonatest.com ; Zetec — https://www.zetec.com ; ndt-kits.com comparison — MEDIUM (multi-source)
- DocuMatrix / SPA Innovision — https://spainnovision.com — MEDIUM (product verified on vendor site; blog detail LOW)
- Therness — https://www.therness.com — LOW (search only)
- Spectora AI Report Assist — https://www.spectora.com — MEDIUM (vendor + multi-source); InspectorData — https://inspectordata.com — LOW
- CorrView International sample reports — https://www.corrview.com — LOW-MEDIUM (site + section confirmed; PDF moved)
- Maptrack (maptrack.com), Sitemate (sitemate.com) templates — LOW, UNVERIFIED (fetch blocked/moved)
- PA DEP UST liner guidance (greenport.pa.gov); NRC Westinghouse LTR-RAC-12-57 Attachment D (nrc.gov); BNL-68166 (osti.gov); FHWA memo (fhwa.dot.gov) — LOW, search-derived, public-domain US gov works
- Zenodo API records 21027907 (quay walls), 14865833 (A-1210 gauge) — LOW-MEDIUM (metadata only)

---
*Feature research for: AI NDT inspection report copilot (Nebius x NVIDIA Global AI Hackathon)*
*Researched: 2026-09-24*
