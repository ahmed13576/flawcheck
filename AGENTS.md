# FlawCheck Development Guidelines & Agent Guardrails

## 1. NDT Engineering Standards Invariant
- **Standards Hierarchy**:
  - In-service piping inspection, corrosion rate calculation, remaining life, and inspection intervals are governed by **API 570 (5th Edition)**.
  - Required thickness determination, Barlow formula, and structural minimum thickness are governed by **API 574 (5th Edition, 2024) Section 10 & Annex D**.
  - Straight pipe internal pressure design formulas ($t = \frac{P \cdot D}{2(S \cdot E \cdot W + P \cdot Y)}$, i.e. each of $S$, $E$, $W$ multiplies separately in the denominator) and weld NDE acceptance criteria (MT §344.3.2, PT §344.4.2) are governed by **ASME B31.3-2024**.
- **Deterministic Single Source of Truth**:
  - All formulas, material coefficients, and flaw acceptance rules MUST be loaded from `lib/criteria/`:
    - `lib/criteria/citations.json` (verified allowlist)
    - `lib/criteria/ptmt-criteria.json` (ASME B31.3 morphology & threshold rules)
    - `lib/criteria/ut-criteria.json` (ALL UT wall-thickness evaluation: Barlow/B31.3 t-min, governing `t_required = max(t_pressure, t_structural)` rule, API 570 corrosion rates, remaining life, inspection interval rules, verdict banding + boundary conventions)
  - **Forbidden**: LLMs must never perform arithmetic, invent clause citations, or alter acceptance limits. All arithmetic is executed in pure TypeScript under `lib/calc/`.

## 2. Working with PDF Standards in this Workspace
- **Do NOT use `view_file` on `.pdf` files**: Antigravity's `view_file` tool does not support `application/pdf` and will error.
- **Use `pypdf` for fast text search**: When searching or extracting from large standards (e.g., ASME B31.3, API 570, API 574), use Python with `from pypdf import PdfReader`. Do not use `pdfplumber` for whole-document scans as it causes timeouts on 500+ page files.
- **Subagent Instructions**: When dispatching subagents to analyze documents, always include explicit instructions on how to access PDFs via Python.

## 3. Windows PowerShell & Script Execution Guidelines
- **Avoid complex multiline inline Python**: Do not run complex multiline Python code directly inside PowerShell command lines with nested quotes.
- **Write scripts to disk**: Save temporary scripts to `.gemini/.../scratch/` or project scratch, enforce UTF-8 output (`sys.stdout.reconfigure(encoding='utf-8')`), and execute via `python <path>`.
- **Handle Unicode safely**: Standards text often contains special characters (minus signs `\u2212`, quotes `\u2019`, degrees `°`). Always normalize or sanitize characters before printing to Windows console.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
