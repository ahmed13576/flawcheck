# FlawCheck — NDT Inspection Copilot

Turn raw NDT inspection data (ultrasonic thickness CSVs, PT/MT notes) into deterministic, clause-referenced NDT examination report packages. NVIDIA Nemotron models on Nebius Token Factory can assist with narrative/extraction when a user supplies a runtime key; TypeScript remains the authority for engineering arithmetic and verdicts.

**Built for the [Nebius x NVIDIA Global AI Hackathon](https://devpost.com/hackathons)** · Track: Best Apps and Agents

![tests](https://img.shields.io/badge/tests-648%20passing-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue) ![next](https://img.shields.io/badge/Next.js-16-black) ![stack](https://img.shields.io/badge/NVIDIA-Nemotron%20on%20Nebius-76b900)

> **The invariant:** TypeScript computes every engineering number and verdict — the LLM never touches arithmetic. Every verdict is deterministic, every citation is renderer-locked, and every report is audit-stamped as an engineering aid, not a professional certification or final approval.

## What it does

1. **Ingest** — Upload an ultrasonic thickness CSV (or load the pre-loaded demo scenario from real data)
2. **Review** — Confirm column mapping, component metadata, and PT/MT notes
3. **Evaluate** — A pure TypeScript engine computes t-required, corrosion rates, remaining life, and pass/fail/re-check verdicts against ASME B31.3 / API 570 / API 574 criteria — never the LLM
4. **Reason** — Nemotron streams a clause-cited acceptance narrative around the precomputed values; every citation resolves through a renderer-locked allowlist
5. **Report** — Download a PDF/CSV package with the audit trail, inspector sign-off block, SHA-256 register seal, and limitations disclaimer


## Safety and governance limits

FlawCheck is an NDT examination and reporting aid. It does **not** claim professional engineering certification, guaranteed code compliance, inspector replacement, PDF/UA conformance, API 570 interval approval, Fitness-for-Service approval, or final continued-service authorization. NDT examination, API inspection, and engineering/FFS decisions are kept as distinct responsible roles.

## WBT-S6 deterministic remediation notes

The bundled WBT-S6 fixture is treated as one component/circuit with exactly 420 historical readings and 40 unique CMLs (A1..D10). The deterministic CML summary layer exposes scan count, baseline, previous, latest, historical minimum, required pressure/structural thickness, validated corrosion rates, governing rate, remaining life, flags, disposition, and source traceability. The 19.85 mm required thickness and 19.95 mm inclusive re-check boundary are pinned by tests; top-critical CMLs are unique and sorted by historical minimum, validated governing rate, raw maximum rate, and natural CML ID.

## Quick start

```bash
# Prerequisites: Node.js ≥ 24. A Nebius API key is optional and only required for live Token Factory inference.

git clone https://github.com/ahmed13576/flawcheck.git
cd flawcheck
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local and fill in your NEBIUS_API_KEY

# Run
npm run dev
# → http://localhost:3000
```

Click **"Explore a sample inspection"** on the landing page for a one-click demo with 420 real readings (the WBT-S6 tank subset — Zenodo, CC BY 4.0), or **"Load full register (scale demo)"** for the complete 4,912-reading register.

## Architecture

```
Parse → Calculate → Narrate → Render

  lib/ingest/     CSV parser, column mapping, validation, grouping
  lib/calc/       Pure TypeScript calc engine (t-min, corrosion, RL, verdicts)
  lib/reasoning/  Citation tokenizer, deterministic fallback, 4 server lints
  lib/llm/        Nebius Token Factory client (json_object → Zod → 1 retry)
  lib/report/     Snapshot, PDF schema, audit trail
  app/api/        SSE streaming routes (extraction + narrative + PDF)
```

**Key invariant:** TypeScript computes every number; the LLM only extracts, structures, and narrates around precomputed results. Enforced by forbidden-import lints and a criteria-sovereignty test.

## NVIDIA Nemotron models on Nebius Token Factory

| Role | Model | Usage |
|---|---|---|
| Acceptance narrative | `nvidia/nemotron-3-super-120b-a12b` | Streaming SSE, reasoning_effort: low |
| Extraction + structuring | `nvidia/nemotron-3-super-120b-a12b` | Batched, json_object mode |
| Deterministic fallback | — (pure TypeScript) | Always available, zero cost |

Model IDs are env-configured and validated at startup against the live `/v1/models` catalog.

## Tavily integration

Tavily performs a post-acceptance code-edition lookup (one basic search per evaluation, cached). Degrades to no-links on failure — never blocks the acceptance flow.

## Testing

```bash
npm test          # 648 hermetic tests (zero network, key-independent)
npm run typecheck # strict TS
npm run lint      # eslint (0 errors)
npm run build     # production build
FLAWCHECK_LIVE_LLM=1 npm test  # + live model tests (requires NEBIUS_API_KEY)
```

## Deploy (Netlify)

The app is a stock Next.js 16 project (Node-runtime API routes, SSE streaming, react-pdf on the server) — it deploys unchanged on Netlify via the official Next.js runtime:

1. Push this repo to GitHub and import it in Netlify (build command `npm run build`, Netlify auto-detects Next).
2. Set the environment variables in **Site configuration → Environment variables**:

| Variable | Required | Value |
|---|---|---|
| `NEBIUS_API_KEY` | no | optional Customer-supplied Token Factory key for live Nemotron inference |
| `NEBIUS_BASE_URL` | no | defaults to `https://api.tokenfactory.nebius.com/v1/` |
| `NEBIUS_MODEL_REASONING` | no | defaults to `nvidia/nemotron-3-super-120b-a12b` |
| `NEBIUS_MODEL_EXTRACTION` | no | defaults to `nvidia/nemotron-3-super-120b-a12b` |
| `TAVILY_API_KEY` | no | enables the code-edition source lookup |
| `FLAWCHECK_DISABLE_LLM` | no | `1` = deterministic fallback mode, zero LLM calls |

Without a Nebius key the app still runs end-to-end: every evaluation falls back to the deterministic engine (honest fallback, no fabricated data).

## Dataset

The demo uses [Zenodo record 16780668](https://zenodo.org/records/16780668) (CC BY 4.0) — real ultrasonic thickness readings from ballast tank locations across 11 annual survey campaigns.

**Demo datasets:**

- **Primary demo** (`Explore a sample inspection`): the committed WBT-S6 tank subset — 420 readings, one tank section, 40 CMLs, every CML multi-campaign (`lib/demo/fixtures/zenodo-16780668-ut-register-subset.json`, mirrored as `public/sample-ut-register-subset.csv`). It is generated deterministically from the full register by tank-identity filtering ONLY (never date-filtered, so per-CML campaign history stays intact):

  ```bash
  node scripts/generate-demo-subset.mjs
  ```

- **Scale demo** (`Load full register (scale demo)`): the untouched full register — 4,912 readings across 12 tank locations (`lib/demo/fixtures/zenodo-16780668-ut-register.json`).

Dataset attribution is unchanged — see `lib/demo/ATTRIBUTION.md`.

## License

[MIT](LICENSE) — see also the disclaimer rendered on every report.

---

*This report is an engineering aid based on supplied measurements and stated assumptions. Confirm findings, calculations, and disposition through the responsible inspector and applicable procedures.*

---

## System-1 Architecture

FlawCheck uses a dual-renderer analytics layer: one pure geometry engine computes every metric once, and two independent renderers present it — an interactive web SVG layer inside the wizard and a vector PDF layer inside the generated report.

- **`lib/analytics/`** — pure TypeScript geometry engine (no React, no arithmetic outside `lib/calc`): heatmap binning, trend-curve regression, and gauge metrics consumed by both renderers.
- **`components/analytics/`** — the web SVG renderer (`TrendCurve`, `CmlHeatmap`, `MetricGauge`), shown live in the Screen 3 **VisualInspectionAnalytics** panel after evaluation.
- **`components/report/pdf-trend-curve.tsx` + `pdf-heatmap.tsx`** — the vector-PDF counterparts (react-pdf) embedded in the report, crisp at any zoom.

Model routing runs through Nebius Token Factory: acceptance narrative and extraction both route to `nvidia/nemotron-3-super-120b-a12b` (see the model table above), with the deterministic pure-TypeScript fallback always available.

## Recent updates

- Extraction now routes to `nemotron-3-super-120b-a12b` (matching reasoning) — verified live against the `/v1/models` catalog, batched `json_object` mode.
- Typecheck/build unblocked: DemoBanner moved out of `app/page.tsx` into `components/wizard/demo-banner.tsx` (Next 16 route-entry exports), and `scratch/` excluded from `tsconfig.json`.
- Hydration-safe wizard session restore: saved sessions apply post-hydration via a `restore-session` action, so server and first client render byte-match.
- PDF page-1 top-10 fixed (CR-01): the top-10 worst-readings block renders correctly on the first page of the report.
- Past-due next-inspection dates flagged (amber) in the results table and report when the API 570-anchored date precedes today.
- PT/MT narrative store subscription: `PtmtTriageList` now subscribes to the narrative stream via `useNarrativeStream`.
- Streaming status precedence fix: the pipeline status bar prioritizes an active stream over fallback-served state (F-04).

## Verification

| Gate | Status |
|---|---|
| Unit/integration tests | 648 passed / 5 skipped (hermetic, zero network, key-independent) |
| `npm run typecheck` | clean (strict TS, exit 0) |
| `npm run lint` | 0 errors |
| `npm run build` | green — 10 routes |

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for contribution guidelines, standards invariants, and quality gates.
