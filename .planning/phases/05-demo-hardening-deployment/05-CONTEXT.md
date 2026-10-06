# Phase 5: Demo Hardening, Deployment & Submission - Context

**Gathered:** 2026-10-05
**Status:** Ready for planning
**Mode:** Smart-discuss (decisions locked by ROADMAP + STACK.md + PITFALLS.md; builder is solo so deploy/video are user-action handoffs)

<domain>
## Phase Boundary

Judges get a complete, coherent product — a public URL running cached one-click demo scenarios with a Live-model toggle, abuse-guarded endpoints, and a licensed, documented repo ready for submission. Video recording is the builder's action; the repo README + video script + deploy config are deliverables here.

</domain>

<decisions>
## Implementation Decisions

### Demo caching (locked)
- One-click demo mode (already landed in Phase 2) gains cached LLM responses: the extraction + narrative calls for the two demo scenarios (UT flagship + PT/MT) are served from committed JSON fixtures (keyed by input hash) — zero live calls on the demo path
- A "Live model" toggle in Screen 3's pipeline status bar switches the demo path to real Nemotron endpoints (the toggle is honest: it shows which mode is active)
- Cached responses are captured from real runs and committed as fixtures (grounded, not fabricated)

### Abuse guarding (locked, PLAT-04)
- In-memory per-IP rate limiter on /api/reasoning/* and /api/report/pdf: token bucket (20 req/min/IP), returns 429 + Retry-After
- Per-request token caps: extraction 3000, narrative 1200 (already set); PDF route bounded by the 25 MB schema cap
- The demo path is the primary judge surface — rate limits must not break a legitimate walkthrough (50-pane worst case stays under the cap)
- Phase 1's unguessable-path posture carries over (no additional auth for the hackathon demo)

### Tavily (locked, PLAT-03)
- Tavily integration runs POST-acceptance only: one cached basic search per evaluation for the design code edition; degrades to no-links on timeout/failure/absent key — never blocks the acceptance flow
- TAVILY_API_KEY is env-only; when absent the lookup is skipped (no error, no banner)
- The lookup result renders as a "Further reading" block in the report footer (citation-style, linking out — never re-serving code text)

### Deploy readiness
- Vercel config (vercel.json if needed for function duration), .env.production.example with all required env vars documented
- NEBIUS_API_KEY + model IDs + TAVILY_API_KEY (optional) documented in the README setup section
- Deploy is the builder's action (Vercel account); the repo is deploy-ready when `vercel deploy` works without local state

### Repo + video deliverables
- README: clone-to-running setup, Nebius/NVIDIA usage highlighted, disclaimer, dataset attribution (Zenodo CC BY 4.0), architecture diagram (text), license (MIT)
- Video script (≤3 min, ≥1 min working solution with model badges visible) — written as a markdown doc the builder records from
- LICENSE file (MIT)

### Claude's Discretion
Cache-key format, rate-limiter implementation details, README section ordering, video script shot list.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Demo mode (Phase 2): `lib/demo/demo-scenario.ts` (buildDemoSession), `lib/demo/fixtures/zenodo-16780668-ut-register.json`, ATTRIBUTION.md
- The narrative/extraction routes already accept `extraction` + `history` on the request — the cache layer can supply pre-computed responses without route changes
- lib/llm/complete.ts usageSink → the audit writer's per-step telemetry — cached mode must serve the same shapes with null telemetry (UI-54)
- pipeline-status-bar.tsx has the `deterministic fallback` chip — the "cached" and "live" badges extend this pattern
- screen3 integration tests render the full screen — the Live toggle joins the Finding controls region

### Established Patterns
- All responses flow through the typed frame protocol; cached mode emits identical frames with a `meta` frame marking `model: "cached (committed fixture)"`
- 494 hermetic tests; every new feature needs pins
- UNINSTALL.md ledger; UNINSTALL note per phase

### Integration Points
- The demo session's evaluatedAt is deterministic (fixed date) so cached keys are stable
- Screen 3's footer CTA + /report page are the judge's full walkthrough path
</code_context>

<specifics>
## Specific Ideas

- The demo MUST work in an incognito cold-start: zero local setup, zero network dependency for the happy path
- The Live toggle is the judge's proof of real AI usage — badge shows the actual model IDs
- The video script should show: ingestion → demo → evaluation → reasoning pane (streaming, cited) → PDF download — with the pipeline status bar visible

</specifics>

<deferred>
## Deferred Ideas

- Multi-evaluation history, report archiving (post-hackathon)

</deferred>
