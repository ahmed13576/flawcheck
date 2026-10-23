# FlawCheck — Getting Started

FlawCheck is an NDT inspection copilot: it turns raw ultrasonic-thickness CSVs
and PT/MT surface-inspection notes into code-compliant, clause-cited evaluation
results and certified inspection reports. It runs evaluation entirely in
deterministic TypeScript; an LLM (NVIDIA Nemotron on Nebius Token Factory) is
used only to structure and narrate around precomputed values — and it is
optional.

This guide gets you from a clean checkout to a running app with a completed
demo evaluation, with and without an LLM key.

---

## 1. Prerequisites

| Tool | Requirement | Notes |
| --- | --- | --- |
| Node.js | ≥ 20.9.0 | The floor declared by Next.js 16's `engines`. `package.json` declares no `engines` of its own. This repo is developed and verified on Node 24 — use 24.x if you can. |
| npm | ships with Node | Any recent version. |
| Nebius account + API key | optional, for live mode | Create a key at https://tokenfactory.nebius.com/. Only needed if you want the live AI extraction/narrative (see §5). |
| Tavily API key | optional | Enables the post-acceptance code-edition/errata lookup on the report screen. Absent key degrades silently — never blocks anything. |

You do **not** need any LLM key to run the app. Without one, every evaluation
falls back to the deterministic engine (see §4).

---

## 2. Install

```bash
npm install
```

- Dependencies install into `node_modules/` at the repository root.
- The project has no lockfile-driven workspaces; a single `npm install` is all
  you need.
- **Environment setup:** copy the committed template to a local file:

  ```bash
  cp .env.example .env.local
  ```

  `.env.local` is gitignored (`.gitignore` excludes `.env*`, re-including
  `.env.example`) and is the **only** place API keys belong. Never commit a
  key, and never commit `.env.local` itself.

---

## 3. Run locally

```bash
npm run dev
```

Then open **http://localhost:3000** in your browser. You should land on the
FlawCheck wizard (Screen 1 — Ingest) with two demo buttons and a file dropzone.

---

## 4. Try it without any LLM key (deterministic fallback)

The app runs end-to-end with zero LLM calls. Either of these forces the
deterministic fallback, which computes every number in pure TypeScript and
serves an honest, non-fabricated narrative around it:

- Leave `NEBIUS_API_KEY` unset in `.env.local`, **or**
- Set `FLAWCHECK_DISABLE_LLM=1` in `.env.local` (the kill-switch).

Command-line note (instead of editing the file):

```bash
# Git Bash / macOS / Linux
FLAWCHECK_DISABLE_LLM=1 npm run dev

# PowerShell
$env:FLAWCHECK_DISABLE_LLM="1"; npm run dev
```

### Run the demo — one click, no CSV needed

On the landing page, click one of the two demo buttons:

| Button | Data | What it exercises |
| --- | --- | --- |
| **Explore a sample inspection** | The 420-row WBT-S6 tank subset (real Zenodo ultrasonic-thickness readings, CC BY 4.0) | The primary walkthrough demo — one tank section, 40 CMLs, every CML multi-campaign. |
| **Load full register (scale demo)** | The full 4,912-reading register across 12 tank locations | The scale demo — same pipeline, much bigger dataset. |

### Walkthrough — the four screens

1. **Screen 1 — Ingest.** Click a demo button (or drop a CSV). The parser
   tokenizes and validates rows; the column mapping is auto-guessed.
2. **Screen 2 — Review.** Review the auto-guessed column mapping (every
   dropdown stays overridable), fill in component metadata, and enter PT/MT
   notes. Click **Run Evaluation**.
3. **Screen 3 — Results + analytics.** The deterministic engine computes
   required thickness, corrosion rates, remaining life, and pass/fail/re-check
   verdicts against ASME B31.3 / API 570 / API 574 criteria. The analytics
   panel (`VisualInspectionAnalytics`) renders the metric gauge, trend curve,
   and CML heatmap. In fallback mode the narrative pane is served by the
   deterministic fallback — no network, no key.
4. **Screen 4 — Report.** The report page shows the full evaluation with audit
   trail and clause citations. Enter the **sign-off** block (it persists for
   the session), then click **Download PDF** (server-rendered via
   `POST /api/report/pdf`). The PDF embeds the analytics charts and the
   sign-off.

---

## 5. Enable live AI narration

To turn on the live LLM extraction and narrative (NVIDIA Nemotron on Nebius
Token Factory):

1. Set `NEBIUS_API_KEY` in `.env.local` (your Token Factory key).
2. Optionally set `NEBIUS_MODEL_REASONING` / `NEBIUS_MODEL_EXTRACTION` (leave
   as the template defaults unless you have re-verified IDs against the live
   catalog with `npm run catalog`).
3. **Restart** `npm run dev` (env vars are read at startup/request time from
   the environment — a running dev server may cache them).
4. Re-run either demo. Extraction (structured field extraction) and the
   acceptance narrative now call the models on Nebius, with the deterministic
   fallback still available as a backstop.

Model IDs are validated at startup against the live `/v1/models` catalog; if
the configured ID is stale or the key is invalid you will see a clear error.

---

## 6. Run the tests and gates

All commands come from `package.json` scripts:

```bash
npm test            # hermetic suite — 648 passing, 5 skipped (zero network, key-independent)
npm run typecheck   # strict TypeScript (next typegen + tsc --noEmit)
npm run lint        # eslint — 0 errors
npm run build       # production build (Next.js 16)
```

Optional, keyed:

```bash
FLAWCHECK_LIVE_LLM=1 npm test   # + live model tests (requires NEBIUS_API_KEY)
```

---

## 7. Next steps

- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) — system design, data flow, and the TypeScript-computes-everything invariant
- [`docs/DEVELOPMENT.md`](DEVELOPMENT.md) — contributing workflow and codebase map
- [`docs/TESTING.md`](TESTING.md) — test suite layout and gate commands
- [`docs/CONFIGURATION.md`](CONFIGURATION.md) — environment variables and model routing
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — contribution guidelines
