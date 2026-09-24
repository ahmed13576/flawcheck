# FlawCheck (working title) — NDT Inspection Copilot

## What This Is

A web app that turns raw NDT inspection data — ultrasonic thickness readings (CSV), PT/MT indication notes, and component context — into code-compliant inspection reports. It automates a Level 2 inspector's most repetitive paperwork: acceptance evaluation against ASME/B31.3-style criteria, flagged failing indications, and a formatted, clause-cited report. Built by an NDT Level 2 engineer; powered by NVIDIA Nemotron models served on Nebius Token Factory.

## Core Value

Raw inspection data in → a defensible, code-cited acceptance decision and report out. If the acceptance reasoning is wrong, nothing else matters.

## Business Context

- **Customer**: NDT technicians, Level 2/3 inspectors, QA/QC engineers (pressure vessels, piping, fabrication shops)
- **Revenue model**: none (hackathon build); doubles as portfolio centerpiece for an AI/data-science career transition
- **Success metric**: complete hackathon submission (hosted demo + video + repo) scoring strongly on Potential Impact and Quality of the Idea
- **Strategy notes**: Nebius x NVIDIA Global AI Hackathon — deadline 30 Oct 2026, 10:30pm GMT+5:30

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can upload UT thickness readings (CSV) with component metadata (OD, design t, corrosion allowance, material, service)
- [ ] User can enter PT/MT indication notes and component context
- [ ] System computes acceptance per applicable code criteria (t-min / remaining-life evaluation, indication assessment) with visible reasoning
- [ ] System generates a formatted inspection report citing code clauses with clear pass / fail / re-check decisions
- [ ] Model routing: `nemotron-3-super-120b-a12b` for acceptance reasoning; `Nemotron-3_5-Lightning` for extraction/formatting (corrected by research — Ultra-253B/Nano-Omni removed from Token Factory serverless 2026-08-31)
- [ ] Tavily integration for live code-edition / errata / interpretation lookup
- [ ] Deployed demo reachable via public URL on Nebius infrastructure
- [ ] 3-minute demo video (with audio) + README highlighting Nebius and NVIDIA model usage

### Out of Scope

- Vision-based defect photo classification — viable v2; needs a Token Factory vision-model feasibility spike first
- Physical AI / robotics — no hardware available
- Fine-tuning or training custom models — $25 credit budget rules it out
- Multi-tenant auth / team features — solo demo scope
- Reproducing copyrighted ASME code text verbatim — legal risk; cite clause numbers, compute acceptance from input parameters, accept user-provided excerpts only

## Context

- **Builder**: mechanical engineer (M.E. Heat & Power Engineering), NDT Level 2 (UT/PT/MT, Einstein II Flaw Detector), ASME code familiarity, HVAC/thermal + failure-analysis background, 2 years explaining mechanical engineering as a Chegg SME. Breaking into AI/data science.
- **Development model**: built agentically with the GSD workflow — user makes decisions and supplies domain ground truth; the agent implements, tests, and commits.
- **Hackathon rules that bind**: must run on Nebius Token Factory or Nebius AI Cloud; must use ≥1 NVIDIA open source model; OSS license visible in repo; judges explicitly reward "complete, coherent product experience — not just a technical proof of concept."

## Constraints

- **Timeline**: 2 weeks to MVP inside the 37-day hackathon window (deadline 30 Oct 2026)
- **Budget**: $25 Nebius Builder Program credits — Lightning-dominant routing, Super-120B only for reasoning steps, aggressive caching (~$0.004–0.005/report ⇒ $25 ≈ 5,000+ runs; abuse, not volume, is the risk)
- **Team**: solo builder (domain expert, not a professional coder; all code agent-executed)
- **Platform**: Nebius Token Factory for model serving (+ Serverless Endpoints/Jobs encouraged for deploy); Tavily API free tier
- **Deliverables**: hosted demo URL, ≤3-min public YouTube demo with audio, public repo with OSS license + setup README

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Track: Best Apps and Agents | Hardware limits rule out Physical AI; Coding track crowdspace is brutal for a non-SWE builder; domain app maximizes "genuine problem-space understanding" judging points | — Pending |
| Idea: NDT report copilot (over plant-reliability personal AI, defect photo triage, HVAC checker) | Leverages NDT L2 + ASME edge; lowest AI-slop risk; Nano-heavy usage fits $25 credits; Tavily prize synergy | — Pending |
| Model routing: Super-120B for acceptance reasoning, Lightning for extraction/formatting | Research correction: Ultra-253B/Nano-Omni removed from Token Factory 2026-08-31; verified live catalog pricing ($0.30/$0.90 vs $0.06/$0.24 per 1M) | — Pending |
| No verbatim ASME text in app or repo | ASME codes are copyrighted; compute from parameters + cite clause numbers instead | — Pending |
| TypeScript computes every number; LLM only extracts, structures, narrates | LLM arithmetic is where models confidently fail; a wrong digit flips pass→fail on pressure-retaining components (ARCHITECTURE.md invariant, lint-enforced) | — Pending |
| Stack: Next.js 16 + @react-pdf/renderer on Vercel Hobby; fixed pipeline, no agentic loops | One language/repo, SSE streaming, free tier with verified 300s limit; fixed pipeline protects credits and credibility (STACK.md) | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-24 after initialization*
