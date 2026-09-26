# FlawCheck — Agent Handoff & Continuity Brief

> **Target Audience**: Any incoming AI agent, pair programmer, or developer resuming work on the **FlawCheck** project.
> **Date**: 2026-09-26  
> **Status**: Pre-Phase 1 Ready (Research, domain modeling, adversarial audit, and criteria configs 100% complete)  
> **Repository Root**: `c:\Users\moham\Documents\Nebuis`

---

## 1. Project Context & Objectives

* **Project**: **FlawCheck — NDT Inspection Copilot**
* **Hackathon**: Nebius x NVIDIA Global AI Hackathon (Devpost)
  * **Track**: *Best Apps and Agents Track*
  * **Deadline**: October 30, 2026 (10:30 PM GMT+5:30)
  * **Core Deliverables**: Live working web app URL, <=3 minute demonstration video with audio, public GitHub repository (MIT license) with README.
* **Builder Persona**: Mechanical Engineer & certified NDT Level 2 (UT/PT/MT) transitioning into AI/data science. Not a professional software engineer—**all production code is generated and maintained through agentic workflows**.
* **Value Proposition**: Automates the conversion of raw NDT inspection field data (ultrasonic thickness CSV registers, PT/MT defect notes) into legally defensible, code-compliant mechanical integrity inspection reports with edition-pinned API/ASME acceptance evaluations.

---

## 2. Immutable Architectural Invariants

Every incoming agent **MUST strictly honor these rules without deviation**:

1. **Deterministic Single Source of Truth**:
   * All allowable formula variants, material coefficients, inspection intervals, and flaw acceptance rules are hard-coded in [`lib/criteria/`](file:///c:/Users/moham/Documents/Nebuis/lib/criteria/):
     * [`lib/criteria/citations.json`](file:///c:/Users/moham/Documents/Nebuis/lib/criteria/citations.json): Builder-vetted, edition-pinned citation allowlist.
     * [`lib/criteria/ut-criteria.json`](file:///c:/Users/moham/Documents/Nebuis/lib/criteria/ut-criteria.json): Ultrasonic thickness formulas, interval rules, and verdict banding.
     * [`lib/criteria/ptmt-criteria.json`](file:///c:/Users/moham/Documents/Nebuis/lib/criteria/ptmt-criteria.json): Surface flaw dimensions and morphology acceptance criteria.
2. **LLM Never Computes Arithmetic**:
   * All formulas ($t_{\min}$, corrosion rates $CR_{LT}$ / $CR_{ST}$, remaining life $RL$, next inspection date) are computed in pure TypeScript under `lib/calc/`.
   * Enforced via a forbidden-import boundary: `lib/calc/` may NEVER import from `lib/llm/`.
   * The LLMs (`nemotron-3-super-120b-a12b` and `Nemotron-3_5-Lightning`) only extract structured entities, format data, and generate natural-language rationale narratives.
3. **Citation Allowlist Enforcement at Renderer**:
   * LLMs cannot invent clause citations or output unvetted references. The PDF/HTML report generator rejects any citation ID not present in `citations.json`.
4. **Cite-Don't-Quote Legal Posture**:
   * Due to ASME/API copyright protections (17 U.S.C. § 102(b)), reports cite clause identifiers and summarize scopes, but **never reproduce verbatim standard paragraphs**.
5. **Fixed Pipeline (No Autonomous Agent Loops)**:
   * Architecture is a deterministic 4-step pipeline: `Parse -> Calculate -> Narrate -> Render`.
   * Eliminates infinite loops, API token drain, and latency unpredictability.
6. **Model Routing on Nebius Token Factory**:
   * `nemotron-3-super-120b-a12b`: Deep acceptance reasoning narrative (SSE streamed).
   * `Nemotron-3_5-Lightning`: Fast structured extraction of inspection metadata and PT/MT notes.
   * *Note: Ultra-253B and Nano-Omni were retired from Nebius serverless in Aug 2026.*

---

## 3. Ground-Truth Engineering Standards Summary

The codebase strictly enforces the real-world standards hierarchy:

```
[In-Service Piping Management]   API 570 (5th Edition)
        │
        ├── §7.6 (Required Thickness) ──────► API 574 (5th Ed, 2024) §10 & Annex D
        │                                           │
        │                                           └── Straight Pipe Formula ──► ASME B31.3-2024 §304.1.2
        │
        └── §5.7.4 (Weld NDE Examination) ──────────────────────────────────────► ASME B31.3-2024 §344.3.2 / §344.4.2
```

### Key Mathematical & Evaluative Rules:
* **Required Pressure Thickness ($t_{\min}$)**:
  * ASME B31.3 Eq. 3a: $t = \frac{P \cdot D}{2(S \cdot E \cdot W + P \cdot Y)}$ with $c = \text{FCA}$ (future corrosion allowance).
  * API 574 in-service Barlow fallback: $t = \frac{P \cdot D}{2 S \cdot E}$.
  * Governing $t_{\text{required}} = \max(t_{\text{pressure}}, t_{\text{structural}})$ where $t_{\text{structural}}$ is derived from API 574 Annex D.
* **Corrosion Rates**:
  * Long-Term: $CR_{LT} = \frac{t_{\text{initial}} - t_{\text{actual}}}{\Delta \text{years}}$.
  * Short-Term: $CR_{ST} = \frac{t_{\text{previous}} - t_{\text{actual}}}{\Delta \text{years}}$.
  * Governing rate: $\max(CR_{LT}, CR_{ST})$ governs remaining life, but both are surfaced in the report.
* **Remaining Life & Inspection Interval**:
  * $RL = \frac{t_{\text{actual}} - t_{\text{required}}}{CR_{\text{governing}}}$.
  * Next inspection interval: $\min\left(\frac{RL}{2}, \text{Table 1 Class Max}\right)$ (Class 1 = 5 yr; Class 2/3 = 10 yr; if $RL < 4\text{ yr}$, interval = $\min(RL, 2.0\text{ yr})$).
* **Verdict Banding**:
  * Default gauge uncertainty: $\pm 0.1\text{ mm}$ (user-configurable).
  * `ACCEPT`: $t_{\text{actual}} \ge t_{\text{required}} + 0.1\text{ mm}$.
  * `RE-CHECK`: $t_{\text{required}} \le t_{\text{actual}} < t_{\text{required}} + 0.1\text{ mm}$.
  * `FAIL`: $t_{\text{actual}} < t_{\text{required}}$.
* **PT/MT Flaw Acceptance (ASME B31.3 §344.3.2 & §344.4.2)**:
  * Relevance: any dimension $> 1.5\text{ mm}$.
  * Linear indication ($L > 3W$): **Strict reject** (zero relevant linear indications permitted).
  * Rounded indication ($L \le 3W$): Reject if $> 5.0\text{ mm}$, or if $\ge 4$ rounded indications in a line are separated by $\le 1.5\text{ mm}$ edge-to-edge.

---

## 4. Antigravity & Windows Operational Guardrails

All agents must follow [`AGENTS.md`](file:///c:/Users/moham/Documents/Nebuis/AGENTS.md):
1. **Never use `view_file` on `.pdf` files**: Antigravity's `view_file` tool errors on `application/pdf`. Use Python with `from pypdf import PdfReader` via `run_command`.
2. **Avoid `pdfplumber` on whole documents**: `pdfplumber` attempts font/layout rendering and times out on 500+ page files like `ASME-B31.3-2024.pdf`. Use `pypdf` which scans in seconds.
3. **PowerShell Quote & Unicode Safety**: Avoid multiline inline Python strings in PowerShell (`python -c "..."`). Write standalone Python scripts to `scratch/` with `sys.stdout.reconfigure(encoding='utf-8')` and run `python script.py`.
4. **Subagent Instructions**: Always inform subagents that PDFs cannot be viewed directly with file tools.

---

## 5. UI & Wizard Flow Specifications

The web application flow is explicitly specified across 4 linear screens:
1. **Screen 1 — Landing & Ingestion**:
   * CSV dropzone + prominent **"Load Demo Scenario"** button (preloaded Zenodo ballast tank dataset with 4,912 real readings).
   * Sample CSV download template and format guide.
2. **Screen 2 — Data Review & Component Metadata**:
   * Editable parsed-row table with per-row validation badges and column mapping dropdowns.
   * Metadata input form: Outer Diameter ($OD$), Nominal Thickness ($t_{\text{nom}}$), Future Corrosion Allowance ($FCA$), Design Code, Piping Class (Class 1–3), Gauge Uncertainty ($\pm 0.1\text{ mm}$ default), and optional PT/MT notes.
3. **Screen 3 — Evaluation Results & Streaming Reasoning**:
   * CML grid with colored verdict chips (Green = Accept, Amber = Re-check, Red = Fail).
   * Expandable **Reasoning Pane** per CML displaying streaming `nemotron-3-super-120b-a12b` narrative with token and latency badges.
   * Separate PT/MT defect triage panel.
4. **Screen 4 — Code-Compliant Inspection Report**:
   * Formatted report layout: Header, Component Context, CML Measurement Table, Formula Substitutions ("Show Your Work"), Clause-Cited Conclusions, Re-Inspection Date, Inspector Sign-off field, and Legal Disclaimer footer.
   * Action buttons: **"Download PDF"** (`@react-pdf/renderer`) and **"Print Report"** (CSS print fallback).

---

## 6. Project Roadmap & Next Steps

| Phase | Goal | Status | Next Agent Action |
|---|---|---|---|
| **Phase 1** | **Platform Spike & App Skeleton** | **READY TO START** | Run `/gsd-discuss-phase 1` or `/gsd-plan-phase 1`. Scaffold Next.js 16, verify Token Factory API routes, test `@react-pdf/renderer` peer dependency with React 19. |
| **Phase 2** | **Ingestion & Deterministic Calc Engine** | Blockers Cleared | Implement CSV parser, metadata schema, and `lib/calc/` engine unit-tested against hand calculations. |
| **Phase 3** | **LLM Reasoning & Citation Layer** | Blockers Cleared | Implement Nebius Token Factory gateway, prompt templates, and citation allowlist validator. |
| **Phase 4** | **Report Rendering** | Ready | Implement React-PDF report and `/report/print` print-CSS route with sign-off blocks. |
| **Phase 5** | **Demo Hardening, Deployment & Submission** | Ready | Seed Zenodo dataset scenarios, build live toggle, deploy to Vercel/Nebius, and record <=3 min demo video. |

---

## 7. How to Resume Work

To resume the structured GSD workflow immediately:
```bash
/gsd-resume-work
```
Or initiate Phase 1 directly:
```bash
/gsd-discuss-phase 1
```
*(Reference machine handoff state at [`.planning/HANDOFF.json`](file:///c:/Users/moham/Documents/Nebuis/.planning/HANDOFF.json) and human handoff at [`.planning/.continue-here.md`](file:///c:/Users/moham/Documents/Nebuis/.planning/.continue-here.md)).*
