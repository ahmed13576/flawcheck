# Phase 1: Platform Spike & App Skeleton - Context

**Gathered:** 2026-09-26
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — smart-discuss grey areas skipped)

<domain>
## Phase Boundary

The Nebius Token Factory foundation is proven before any feature work depends on it — live model catalog committed, env-configured routing validated at startup, and the validated-call pattern (json_object → Zod → one bounded retry, SSE streaming) demonstrated against both routed models (Super-120B and Lightning; Ultra-253B/Nano-Omni are confirmed removed from serverless).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/criteria/citations.json`, `lib/criteria/ut-criteria.json`, `lib/criteria/ptmt-criteria.json` — builder-vetted ground truth (used from Phase 2 onward; do not modify in this phase)
- `AGENTS.md` — workspace guardrails (standards hierarchy, pypdf rule, Windows scripting rules)
- `.planning/research/STACK.md` — verified Token Factory facts: OpenAI-compatible base URL `https://api.tokenfactory.nebius.com/v1/`, streaming, `json_object` guaranteed (`json_schema` model-dependent), live model IDs and pricing

### Established Patterns
- No application code exists yet — greenfield scaffold in this phase
- Node.js v24.14.1 available on the machine

### Integration Points
- Nebius Token Factory API (env-configured model IDs, validated at startup against live `/v1/models`)
- `.env` / `.env.example` for `NEBIUS_API_KEY` and routed model IDs

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
