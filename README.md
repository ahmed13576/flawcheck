# FlawCheck — NDT Inspection Copilot

Turn raw NDT inspection data (ultrasonic thickness CSVs, PT/MT notes) into code-compliant, clause-cited inspection reports. Powered by NVIDIA Nemotron models on Nebius Token Factory.

**Built for the [Nebius x NVIDIA Global AI Hackathon](https://devpost.com/hackathons)** · Track: Best Apps and Agents

![tests](https://img.shields.io/badge/tests-504%20passing-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue) ![next](https://img.shields.io/badge/Next.js-16-black) ![stack](https://img.shields.io/badge/NVIDIA-Nemotron%20on%20Nebius-76b900)

> **The invariant:** TypeScript computes every number — the LLM never touches arithmetic. Every verdict is deterministic, every citation is renderer-locked, every report is audit-stamped.

## What it does

1. **Ingest** — Upload an ultrasonic thickness CSV (or load the pre-loaded demo scenario from real data)
2. **Review** — Confirm column mapping, component metadata, and PT/MT notes
3. **Evaluate** — A pure TypeScript engine computes t-required, corrosion rates, remaining life, and pass/fail/re-check verdicts against ASME B31.3 / API 570 / API 574 criteria — never the LLM
4. **Reason** — Nemotron streams a clause-cited acceptance narrative around the precomputed values; every citation resolves through a renderer-locked allowlist
5. **Report** — Download a PDF with the full audit trail, sign-off block, and disclaimer

## Quick start

```bash
# Prerequisites: Node.js ≥ 24, a Nebius API key (https://tokenfactory.nebius.com/)

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

Click **"Explore a sample inspection"** on the landing page for a one-click demo with 4,912 real readings (Zenodo, CC BY 4.0).

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
| Extraction + structuring | `nvidia/Nemotron-3_5-Lightning` | Batched, json_object mode |
| Deterministic fallback | — (pure TypeScript) | Always available, zero cost |

Model IDs are env-configured and validated at startup against the live `/v1/models` catalog.

## Tavily integration

Tavily performs a post-acceptance code-edition lookup (one basic search per evaluation, cached). Degrades to no-links on failure — never blocks the acceptance flow.

## Testing

```bash
npm test          # 504 hermetic tests (zero network, key-independent)
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
| `NEBIUS_API_KEY` | yes | your Token Factory key |
| `NEBIUS_BASE_URL` | no | defaults to `https://api.tokenfactory.nebius.com/v1/` |
| `NEBIUS_MODEL_REASONING` | no | defaults to `nvidia/nemotron-3-super-120b-a12b` |
| `NEBIUS_MODEL_EXTRACTION` | no | defaults to `nvidia/Nemotron-3_5-Lightning` |
| `TAVILY_API_KEY` | no | enables the code-edition source lookup |
| `FLAWCHECK_DISABLE_LLM` | no | `1` = deterministic fallback mode, zero LLM calls |

Without a Nebius key the app still runs end-to-end: every evaluation falls back to the deterministic engine (honest fallback, no fabricated data).

## Dataset

The demo scenario uses [Zenodo record 16780668](https://zenodo.org/records/16780668) (CC BY 4.0) — 4,912 real ultrasonic thickness readings from 12 ballast tank locations across 11 annual survey campaigns.

## License

[MIT](LICENSE) — see also the disclaimer rendered on every report.

---

*This report is an engineering aid based on supplied measurements and stated assumptions. Confirm findings, calculations, and disposition through the responsible inspector and applicable procedures.*
