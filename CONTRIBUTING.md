# Contributing to FlawCheck

## Welcome

FlawCheck is an NDT Inspection Copilot: it turns raw NDT inspection data (ultrasonic thickness CSVs, PT/MT notes) into deterministic, clause-referenced NDT examination report packages, powered by NVIDIA Nemotron models on the Nebius Token Factory. The project is open source under the MIT License, and every contribution matters — whether it is a new ingestion path, a calculation edge case, a report rendering fix, or better documentation. The most useful contributions are those that keep reports deterministic, reproducible, and audit-stamped: **TypeScript computes every number — the LLM never touches arithmetic.**

## Development setup

Prerequisites: Node.js >= 24 and a Nebius API key (https://tokenfactory.nebius.com/). The app runs end-to-end without a key via the deterministic fallback.

```bash
git clone https://github.com/ahmed13576/flawcheck.git
cd flawcheck
npm install

cp .env.example .env.local
# Edit .env.local and fill in your NEBIUS_API_KEY

npm run dev
# → http://localhost:3000
```

To try the app without any API key, load the "Explore a sample inspection" demo
(420 rows) or "Load full register (scale demo)" (4,912 rows) on the landing page —
the deterministic fallback engine evaluates them fully offline.

## Contribution workflow

We use a fork-and-branch model:

1. **Fork** the repository and add your fork as a remote.
2. **Branch** — create a feature branch from `master`:

   ```bash
   git checkout master
   git pull
   git checkout -b feat/your-feature
   ```

3. **Commit** with clear, conventional messages (e.g. `fix(calc): handle zero-thickness row in t-required`, `feat(report): add API 574 Annex D reference`).
4. **Open a pull request** against `master`. Describe what changed and why, and note which gate results you ran (see Quality gates below).

Please do **not** commit:

- `.env.local` or any other environment files with secrets
- `.next/` (build output)
- `scratch/` (local experimentation)
- Standards PDFs (API 570, API 574, ASME B31.3, etc. — these are large licensed documents, not repo assets)

## Standards & invariants

This project's core value is engineering correctness. The acceptance criteria are governed by a fixed standards hierarchy, and the implementation must obey a deterministic single source of truth.

**NDT engineering standards hierarchy**

- **API 570 (5th Edition)** — in-service piping inspection, corrosion rate calculation, remaining life, and inspection intervals.
- **API 574 (5th Edition, 2024) Section 10 & Annex D** — required thickness determination, the Barlow formula, and structural minimum thickness.
- **ASME B31.3-2024** — straight pipe internal pressure design formulas (`t = P·D / (2(S·E·W + P·Y))`, where each of `S`, `E`, `W` multiplies separately in the denominator) and weld NDE acceptance criteria (MT §344.3.2, PT §344.4.2).

**Deterministic single source of truth**

- All formulas, material coefficients, and flaw acceptance rules **must** be loaded from `lib/criteria/`:
  - `lib/criteria/citations.json` — verified citation allowlist
  - `lib/criteria/ptmt-criteria.json` — ASME B31.3 morphology & threshold rules
  - `lib/criteria/ut-criteria.json` — all UT wall-thickness evaluation: Barlow/B31.3 t-min, governing `t_required = max(t_pressure, t_structural)` rule, API 570 corrosion rates, remaining life, inspection interval rules, verdict banding + boundary conventions
- **Forbidden**: LLMs must never perform arithmetic, invent clause citations, or alter acceptance limits. All arithmetic is executed in pure TypeScript under `lib/calc/`.

If you touch anything that computes a number, cites a clause, or changes an acceptance limit, the change belongs in `lib/criteria/` or `lib/calc/` — never in prompt text or LLM-generated output.

## Quality gates

Run all of the following before opening a PR:

```bash
npm run typecheck   # strict TypeScript, exit 0
npm run lint        # eslint, 0 errors
npm test            # 648 hermetic tests (zero network, key-independent)
npm run build       # production build
```

- **Tests must stay hermetic.** No network calls, no API-key dependence — the suite must pass in a clean checkout with no environment variables. Live-model tests are opt-in only via `FLAWCHECK_LIVE_LLM=1 npm test`.
- **Honor the calc-sovereignty boundary.** New code must not smuggle arithmetic into the LLM prompt, narrative, or rendering layers, and must not bypass the criteria files or the forbidden-import lints.

## Code of conduct

Be respectful and constructive. Reviews are about the code, not the author. Assume good faith, give actionable feedback, and welcome questions from contributors at every level. Harassment, personal attacks, and discrimination have no place in this project.
