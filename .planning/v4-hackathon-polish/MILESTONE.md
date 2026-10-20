# Milestone v4 — Hackathon Submission Polish

**Status:** In Progress  
**Started:** 2026-10-20  
**Deadline:** 2026-10-30 22:30 IST (GMT+5:30)  

## Objective
Polish FlawCheck for hackathon submission, ensuring NVIDIA Nemotron models are prominently featured and the full pipeline works reliably end-to-end.

## Hackathon Requirement Compliance
The hackathon requires using an NVIDIA open source model prominently.

**We satisfy this requirement twice over:**

| Pipeline Step | Model | Role |
|---|---|---|
| Structured JSON Extraction | `nvidia/nemotron-3-super-120b-a12b` | Extracts componentContext, notableFacts, ptmtNotesSummary, cautions from inspection notes |
| Engineering Reasoning & Narration | `nvidia/nemotron-3-super-120b-a12b` | Generates API 570/B31.3 verdict narration and risk assessment |

Both steps run on Nebius Token Factory (Nebius AI Studio).

## Model Details
- **Model:** NVIDIA Nemotron-3-Super-120B-A12B
- **Architecture:** 120B MoE (12B active parameters), FP4 quantization
- **Context Window:** 256K tokens
- **Structured Output:** Native json_object + json_schema support
- **Reasoning:** Yes (low/medium/high effort levels)
- **Pricing:** $0.30/$0.90 per 1M input/output tokens
- **Speed:** ~127 tokens/second
- **Provider:** Nebius Token Factory (us-central1)

## Phases
- Phase 10: Extraction Reliability (In Progress)
- Phase 11: Historical Date UX (In Progress)
- Phase 12: Hackathon Documentation & README (Planned)
- Phase 13: Branch Merge & Final Verification (Planned)

## Key Constraints
- No new npm dependencies
- All 690 tests must continue passing
- Engineering calculations remain pure TypeScript (LLM only extracts/narrates)
- API 570 / ASME B31.3 / API 574 standards invariant must hold
