# lib/calc — RESERVED

This directory is reserved for the Phase 2 deterministic calc engine (API 574 / ASME B31.3
arithmetic in pure TypeScript, loaded from `lib/criteria/*.json`).

Invariant: files under `lib/calc/` must NEVER import from `lib/llm/`. The calc engine is
deterministic ground truth — no LLM calls, no model routing, no API keys.
