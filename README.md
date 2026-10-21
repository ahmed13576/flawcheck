# FlawCheck — NDT Inspection Copilot

Turn raw non-destructive testing (NDT) inspection data — ultrasonic thickness (UT) registers and liquid penetrant / magnetic particle (PT/MT) weld notes — into code-compliant, clause-cited inspection reports. Powered by **NVIDIA Nemotron** reasoning models deployed on **Nebius Token Factory**.

**Built for the [Nebius x NVIDIA Global AI Hackathon](https://devpost.com/hackathons)** · Track: Best Apps and Agents

![tests](https://img.shields.io/badge/tests-692%20passing-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue) ![next](https://img.shields.io/badge/Next.js-16%20Turbopack-black) ![nvidia](https://img.shields.io/badge/NVIDIA-Nemotron--3--Super--120B-76b900) ![nebius](https://img.shields.io/badge/Nebius-Token%20Factory-00d2ff)

> **The Engineering Invariant:** Pure TypeScript computes every number, formula, and limit — the LLM never touches arithmetic. Every verdict is mathematically deterministic, every standard citation is renderer-locked, and every report is audit-stamped.

---

## NVIDIA Nemotron on Nebius Token Factory

FlawCheck prominently utilizes **`nvidia/nemotron-3-super-120b-a12b`** (120B MoE, 12B active parameters, FP4 quantization) hosted on **Nebius Token Factory** across two distinct, complementary stages of the pipeline:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               FLAWCHECK PIPELINE ARCHITECTURE                          │
└────────────────────────────────────────────────────────────────────────────────────────┘

 [ Inspector Upload ] ──────────┐
   • UT CSV Readings            │
   • PT/MT Surface Notes        ▼
                      ┌─────────────────────────────────────────┐
                      │    1. Ingest & Schema Validation        │
                      │       (lib/ingest/ — Pure TS)           │
                      └───────────────────┬─────────────────────┘
                                          │
                      ┌───────────────────▼─────────────────────┐
                      │ 2. Deterministic Calculation Engine     │
                      │    (lib/calc/ — API 570 / ASME B31.3)   │
                      │    • Barlow & B31.3 Pressure t-min      │
                      │    • Structural Minimum Thickness       │
                      │    • Short/Long-Term Corrosion Rates    │
                      │    • Half-Life Remaining Life (RL)      │
                      │    • Pass / Re-Check / Fail Verdicts    │
                      └─────────┬─────────────────────┬─────────┘
                                │                     │
            Qualitative Notes   │                     │ Precomputed Metrics
                                ▼                     ▼
┌─────────────────────────────────────────┐  ┌─────────────────────────────────────────┐
│ 3. Qualitative Extraction & Synthesis   │  │ 4. Engineering Acceptance Narration     │
│    Model: nvidia/nemotron-3-super-120b  │  │    Model: nvidia/nemotron-3-super-120b  │
│    • Service context & operating facts  │  │    • Real-time SSE streaming narrative  │
│    • Prompt-injection security boundary │  │    • Explains governing code limits     │
│    • Strict Zod Schema validation       │  │    • Multi-lint hallucination guards    │
│    • ~305 tokens, ~2.5s latency         │  │    • Locked [[cite:id]] resolution      │
└─────────────────────────────────────────┘  └────────────────────┬────────────────────┘
                                                                  │
                                                                  ▼
                                             ┌─────────────────────────────────────────┐
                                             │ 5. Certified Vector Report & UI Preview │
                                             │    • Industrial Precision Dark Theme    │
                                             │    • Spatial CML Severity Matrix        │
                                             │    • Inspector Sign-Off & Audit Trail   │
                                             │    • Certified PDF Export               │
                                             └─────────────────────────────────────────┘
```

### Dual-Stage Nemotron Integration

| Stage | Model ID | Provider & Config | Role & Architecture |
|---|---|---|---|
| **1. Structured Context Extraction** | `nvidia/nemotron-3-super-120b-a12b` | Nebius Token Factory (`reasoning_effort: "low"`, `max_completion_tokens: 3000`) | Distills unstructured field notes into structured JSON context (`componentContext`, `notableFacts`, `ptmtNotesSummary`, `cautions`). Enforces prompt-injection delimiters and qualitative bans. |
| **2. Engineering Acceptance Narration** | `nvidia/nemotron-3-super-120b-a12b` | Nebius Token Factory (SSE stream, `reasoning_effort: "low"`, `max_completion_tokens: 4000`) | Generates real-time, professional engineering narratives explaining *why* a location passed, failed, or requires re-check under API 570 / ASME B31.3. Cites governing clauses strictly via allowlist tokens (`[[cite:<id>]]`). |
| **Deterministic Fallback** | *Pure TypeScript Engine* | Local (zero network, zero API cost) | Built-in fallback templates guarantee full app functionality even if network or API keys are unavailable. |

### Token Economics & Budget Efficiency ($25 Hackathon Credit)

Running `nvidia/nemotron-3-super-120b-a12b` on Nebius Token Factory delivers exceptional performance and cost efficiency:
- **Input Pricing:** $0.30 per 1M tokens ($0.0003 / 1k)
- **Output Pricing:** $0.90 per 1M tokens ($0.0009 / 1k)
- **Measured Cost Per Evaluation Call:** ~850 prompt tokens + ~305 completion tokens ≈ **$0.00053 USD** (approx. 1/20th of a cent)
- **Capacity:** A standard $25.00 Nebius Hackathon credit budget supports over **47,000 full pipeline evaluations**.

---

## Key Features

1. **Deterministic Calculation Sovereignty**:
   - Straight-pipe internal pressure design thickness calculated via ASME B31.3 Eq. 3a ($t = \frac{P \cdot D}{2(S \cdot E \cdot W + P \cdot Y)}$).
   - In-service structural minimum thickness evaluated per API 574 Section 10 & Annex D.
   - Long-term and short-term corrosion rates and remaining life intervals computed per API 570 §6.3.3 / §7.1.1.
   - **Zero LLM arithmetic:** Verified by automated forbidden-import source scanners and criteria-sovereignty test suites.

2. **Four Server-Side Hallucination Lints**:
   Every streamed Nemotron narrative passes through four rigorous server-side verification gates before reaching the client:
   - **`numeric_lint`**: Disallows any numbers that were not precomputed by the engine (guards against fabricated dimensions, rates, or percentages). Strips standard designations and inspector qualification levels (`Level 2/3`).
   - **`verdict_lint`**: Enforces strict conclusion agreement (`Verdict: ACCEPT.`, `Verdict: RE-CHECK.`, or `Verdict: FAIL.`).
   - **`citation_lint`**: Validates every `[[cite:<id>]]` against verified records in `lib/criteria/citations.json`.
   - **`verbatim_lint`**: 8-word n-gram window scan preventing copyright quoting of protected code text.

3. **Industrial Precision Dark UI**:
   - Clean, squared-corner (`rounded-none`) industrial instrument aesthetic with high-contrast borders and safety orange accent (`oklch(0.646 0.222 41.116)`).
   - Solid dropzone border, underline tab indicators, and red-accented Fail KPI cards.
   - Responsive CML results table with pinned sticky `CML / Location` column, right-edge gradient fade overlay, and reactive scroll discoverability cues.
   - Live loading status badges with animated `Loader2` spinners and pulsing borders.
   - Historical date UX indicators highlighting past-due inspection intervals from legacy datasets.

4. **Certified PDF & Audit Trail Export**:
   - Produces a multi-page PDF inspection report with spatial CML severity matrix, CML measurement registers, PT/MT indications, inspector sign-off block, and tamper-evident audit hashes.

5. **SubQ Decision Engine Seam**:
   - Features the SubQ snapshot decision engine (`FLAWCHECK_DECISION_ENGINE=subq`) with multimodal benchmark evaluation and historical trend projection.

---

## Quick Start

### Prerequisites
- **Node.js** ≥ 24
- **Nebius API Key** (Get one at [Nebius Token Factory](https://tokenfactory.nebius.com/))

### Installation & Local Run

```bash
# 1. Clone repository
git clone https://github.com/ahmed13576/flawcheck.git
cd flawcheck

# 2. Install dependencies (Node 24 / npm)
npm install

# 3. Configure environment
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
```env
# Required for live Nemotron LLM extraction and narrative
NEBIUS_API_KEY=your_nebius_api_key_here

# Configured Models (NVIDIA Nemotron-3-Super-120B)
NEBIUS_MODEL_EXTRACTION=nvidia/nemotron-3-super-120b-a12b
NEBIUS_MODEL_REASONING=nvidia/nemotron-3-super-120b-a12b
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1/

# Optional: Code Edition / Errata Search
TAVILY_API_KEY=your_tavily_key_here

# Decision Engine Provider
FLAWCHECK_DECISION_ENGINE=subq
```

Start the application:
```bash
npm run dev
# Open http://localhost:3000
```

Click **"Explore a sample inspection"** on the home page for an instant demo loaded with 420 real ultrasonic readings and PT/MT surface indications.

---

## Verification & Testing

The repository maintains strict test coverage with zero tolerance for regressions:

```bash
# Run all 692 unit and integration tests (hermetic, zero network required)
npm test

# Type-check TypeScript codebase (0 errors)
npm run typecheck

# Code quality and style linting
npm run lint

# Production build test (Turbopack)
npm run build

# Run live integration tests against Nebius Token Factory
FLAWCHECK_LIVE_LLM=1 npm test
```

---

## Engineering Standards & Citations Ground Truth

All calculations, coefficients, and flaw acceptance rules are strictly loaded from verified JSON configurations:
- `lib/criteria/citations.json` — Verified allowlist of API 570, API 574, and ASME B31.3 standards clauses.
- `lib/criteria/ut-criteria.json` — ASME B31.3 internal pressure formulas, Barlow equations, and API 570 inspection intervals.
- `lib/criteria/ptmt-criteria.json` — ASME B31.3 §344.3.2 / §344.4.2 surface examination criteria (1.5mm relevance, zero linear flaws allowed, cluster rejection).

---

## Dataset Attribution

The sample data incorporates [Zenodo Record 16780668](https://zenodo.org/records/16780668) (Creative Commons Attribution 4.0 International), representing actual ultrasonic thickness measurements from marine ballast tank piping surveys across 11 annual survey campaigns.

---

## License

[MIT](LICENSE) — Built with precision for the Nebius x NVIDIA Global AI Hackathon.
