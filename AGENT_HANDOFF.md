# FlawCheck Agent Handoff & Problem Resolution Dossier

**Branch:** `redesign/web-interface`  
**Repository:** `c:\Users\moham\Documents\flawcheck-subq-snap`  
**Last Updated:** 2026-10-21  
**Project State:** Milestone v4 in progress; all 693 tests passing, TypeScript 0 errors, dev server verified.

---

## 1. Executive Summary

This handoff documents the critical engineering challenges, root causes, bug fixes, UI/UX redesigns, and workflow adaptations executed across the FlawCheck NDT Inspection Copilot.

The project satisfies the hackathon requirement of **prominently featuring NVIDIA Nemotron open-source models** on **Nebius Token Factory** across two distinct pipeline steps:
1. **Structured JSON Extraction**: `nvidia/nemotron-3-super-120b-a12b`
2. **Deterministic Engineering Narrative & Reasoning**: `nvidia/nemotron-3-super-120b-a12b`

---

## 2. Problems Encountered & Resolutions

### 2.1 Extraction Pipeline Failure (Crash with Zod Validation Error)
- **Symptom:**  
  The extraction stage failed consistently with:
  `Extraction failed: Validated call failed after 1 retry (model=nvidia/Nemotron-3_5-Lightning)`
  Zod errors reported:
  `componentContext: expected object, received undefined`, `notableFacts: expected array, received undefined`, etc.
- **Root Cause:**
  1. `nvidia/Nemotron-3_5-Lightning` is a hybrid Mamba-2 + Transformer MoE reasoning model. Under the strict extraction system prompt (anti-injection delimiters, untrusted data guidelines, digit bans), it generated 3,000 to 5,023 internal reasoning tokens (`reasoning_content`) before emitting output.
  2. With `maxCompletionTokens: 3000`, the model hit `finish_reason: "length"` during reasoning, returning `content: null`.
  3. When token caps were increased to 6000, under arbitrary `json_object` mode (without strict JSON schema enforcement), the model corrupted the first key into `{". ": "Pipe..."}` instead of `{"componentContext": ...}`, failing Zod schema parsing.
- **Resolution (Commit `96ef082`):**
  - Switched `NEBIUS_MODEL_EXTRACTION` in `.env.local` and `.env.example` to `nvidia/nemotron-3-super-120b-a12b`.
  - Super-120B runs concise reasoning (~197 reasoning tokens + 108 output tokens = ~305 tokens total) at `reasoning_effort: "low"`.
  - Latency reduced from 15–20s timeout to ~2.5s.
  - Passes `ExtractionResultSchema` on first attempt with 100% reliability.
  - Updated docstrings in `app/api/reasoning/extract/route.ts`, `lib/reasoning/prompts.ts`, and `lib/reasoning/narrative-context.ts`.

---

### 2.2 Historical Inspection Date Display ("Next Inspection: 2018" in 2026)
- **Symptom:**  
  The report and UI displayed "Next inspection: 2018-02-15", causing users to assume the calculation engine was buggy or outdated in 2026.
- **Root Cause:**
  - Engineering logic in `lib/calc/evaluate.ts` strictly implements API 570 §6.3.3 / Pitfall 11: `addYearsUtc(reading.date, intervalYears)` anchors to the **measurement date of the physical reading**, NOT the current wall-clock date.
  - The demo dataset (Zenodo record 16780668) comprises historical inspection campaigns conducted in 2015–2016. A 2015 reading with a 2-year half-life interval mathematically yields 2017/2018. The calculation is mathematically and standard-compliant.
- **Resolution (Commit `44e1903`):**
  - Preserved all calculation logic under `lib/calc/` without tampering.
  - In `components/report/report-document.tsx`: Added date comparison against `TODAY`. If next inspection date is in the past, renders:
    `<span className="text-xs text-amber-500 ml-1 font-normal">(historical data — verify current inspection status)</span>`
  - In `components/wizard/results-table.tsx`: Added an amber `(past due)` indicator under the date cell when `next.date < TODAY`.

---

### 2.3 Narrative Pipeline Rejection (`DETERMINISTIC FALLBACK`)
- **Symptom:**  
  `POST /api/reasoning/narrative` returned HTTP 200, but Screen 3 rendered:
  `DETERMINISTIC FALLBACK · — · — · —` instead of the streaming LLM narrative.
- **Root Cause:**  
  FlawCheck applies a 4-lint security and hallucination guard (`numeric_lint`, `verdict_lint`, `citation_lint`, `verbatim_lint`). Probing live Super-120B inference uncovered 6 specific failure triggers:
  1. **Unicode Narrow No-Break Space (`\u202F`)**: Super-120B emitted `API 574` with `\u202F`, escaping the ASCII `DESIGNATORS` regex and causing `574` to be rejected as an unauthorized number.
  2. **Transcribed Clause Identifiers**: The model transcribed clause numbers from citation titles (e.g., `§10.5.1.4`, `§344.3.2`) into prose, triggering `numeric_lint` rejections on numbers `10.5`, `1`, `4`, `344.3`, and `2`.
  3. **Derived Arithmetic in Prose**: The model attempted to compute remaining margins in prose (`19.88 mm - 19.85 mm = 0.03 mm`), emitting numbers absent from `PRECOMPUTED VALUES`.
  4. **Unicode En-Dash in Negative Numbers**: Super-120B used Unicode en-dashes (`–`, `\u2013`) for negative corrosion rates (`–0.244`), causing regex splits to look up positive `0.244`.
  5. **Reasoning Token Exhaustion**: `openStream` had `max_completion_tokens: 1200`. Super-120B consumed 500–1000 tokens in CoT, hitting the limit and returning an empty text body, immediately failing `verdict_lint`.
  6. **Trailing Newline Regex Boundary**: Trailing newlines after `Verdict: FAIL.` caused regex `$` multiline boundary mismatches.
- **Resolution (Commit `c206698`):**
  - **`lib/reasoning/prompts.ts`**:
    - Rule 1: Forbid computing differences/margins in prose; forbid transcribing standard names or clause numbers; refer generically to "the code"; use standard ASCII `-`.
    - Rule 3: Enforce citing standards strictly through `[[cite:<id>]]` tokens.
    - Rule 4 & OUTPUT CONTRACT: Mandate that `Verdict: <LABEL>.` must be the absolute final text with no trailing characters.
  - **`app/api/reasoning/narrative/route.ts`**:
    - Raised `max_completion_tokens` from 1200 to 4000 in `openStream`.
    - Added `.trim()` to `fullText = (relayed + buffer).trim()` before `runFinalLints`.
  - **`lib/reasoning/narrative-context.ts`**:
    - Added `Math.abs(v)` variants to `numericAllowlist` for typographical defense.
  - Verified live: Zero rejections across ACCEPT, RE-CHECK, FAIL, and PT/MT scenarios.

---

### 2.4 Lack of Loading Indicators on Pipeline Status Bar
- **Symptom:**  
  During multi-second extraction and narrative streaming, the pipeline bar displayed static text, making the application appear unresponsive or frozen.
- **Resolution (Commit `9df0ced`):**
  - Updated `components/wizard/pipeline-status-bar.tsx`.
  - Active steps display an animated orange spinner (`Loader2` from `lucide-react` with `animate-spin text-orange-400`).
  - Pending steps display `animate-pulse text-muted-foreground`.
  - Step container tags display an active left border glow and pulsing tint (`border-l-2 border-orange-400 pl-2 bg-orange-400/5 animate-pulse`).

---

### 2.5 Horizontal Scroll Discoverability on Screen 3 Results Table
- **Symptom:**  
  The 11-column table in Screen 3 ("All findings" tab) extends beyond 1100px. Users on typical viewports could not tell that additional columns (RL, Next inspection, Flags, Verdict, Reasoning) were hidden off-screen.
- **Resolution (Commit `b5b0be2`):**
  - Updated `components/wizard/results-table.tsx`.
  - Added a dynamic right-edge gradient fade overlay (`bg-gradient-to-l from-[var(--background)] to-transparent z-20`) that automatically disappears when scrolled to the far right.
  - Added a reactive scroll hint: `Scroll right to see all columns →` that auto-hides upon reaching the right edge.
  - Pinned the `CML / Location` column with `sticky left-0` and matching background tokens so the identifier remains visible while scrolling.

---

### 2.6 Subagent Tooling & Environment Bottlenecks
- **Windows Junction Issue**: `node_modules` was initially symlinked via a Windows junction to `C:\Users\moham\Documents\Nebuis\node_modules`. This caused module resolution and dependency errors. Fixed by deleting the junction and executing a clean local `npm install` (449 packages).
- **Subagent Type Failure**: The `gsd-debugger` agent failed on startup due to missing tool definitions (`glob`, `google_web_search`). Resolved by dispatching `self` and `flash` subagent types.
- **PowerShell Command Compatibility**: Windows PowerShell does not provide Unix utilities like `head` or `tail`. Scripts and subagents now use native PowerShell cmdlets (`Select-Object -First N`, `Select-Object -Last N`).

---

## 3. UI/UX Redesign System Summary

All 4 wizard screens and core UI components were redesigned with an **Industrial Precision Dark App** aesthetic (Commits `85797ab` through `02a345d`):

| Screen / Area | Changes Implemented |
|---|---|
| **Theme & Tokens** | Near-black industrial canvas (`oklch(0.141 0.005 285.823)`), high-contrast borders, orange industrial accent (`oklch(0.646 0.222 41.116)`). |
| **Geometry** | Zeroed corner radii (`rounded-none`) across buttons, cards, badges, inputs, and modal containers for an instrument feel. |
| **Screen 1 (Ingest)** | Solid dropzone border (replaced dashed border); removed separate decorative icon badges and hairline dividers; cleaner single-purpose ingest zone. |
| **Screen 2 (Review)** | Squared input fields, structured metadata cards, high-contrast column mapping dropdowns. |
| **Screen 3 (Results)** | Underline tab bar indicators (replaced pill tabs); left red accent border (`border-l-4 border-[var(--fail)]`) on Fail KPI card; sticky first column with scroll fade cues. |
| **Screen 4 (Report)** | Clear engineering hierarchy, amber historical status badges, PDF download trigger, and structured compliance sections. |

---

## 4. Current Branch & Git Log

Branch: `redesign/web-interface`  
Head commits:
- `c206698` — `fix(narrative): strengthen prompt to pass verdict+numeric lints for Super-120B`
- `b5b0be2` — `feat(ux): add horizontal scroll discoverability to results table`
- `9df0ced` — `feat(ui): add loading spinner and pulse animations to pipeline status bar`
- `44e1903` — `fix(ui): flag past-due next inspection dates from historical demo data`
- `96ef082` — `fix(extraction): switch NEBIUS_MODEL_EXTRACTION to nemotron-3-super-120b-a12b`
- `8181bd7` — `chore(planning): start milestone v4 — Hackathon Submission Polish`
- `02a345d` — `redesign: screen-4 report`
- `77a7183` — `redesign: screen-3 results`
- `2a03ff8` — `redesign: screen-2 review`
- `66126d7` — `redesign: screen-1 ingest`
- `811a11f` — `redesign: globals + layout`
- `85797ab` — `redesign: ui primitives`

---

## 5. Next Steps for Succeeding Agents

1. **Phase 12: Hackathon Documentation & README (`.planning/ROADMAP.md`)**:
   - Update `README.md` to highlight NVIDIA Nemotron-3-Super-120B architecture, token economics on Nebius, and the two-tier extraction + narrative pipeline.
   - Include API setup instructions and model routing documentation for judges.
2. **Phase 13: Branch Merge & Final End-to-End Verification**:
   - Merge `redesign/web-interface` into `main` (or parent fork branch).
   - Execute final browser smoke test from file upload through PDF report generation.
   - Verify full test suite (`npx vitest run`) and TypeScript build (`npx tsc --noEmit`).
