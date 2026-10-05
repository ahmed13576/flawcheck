# 03-04 Plan Summary — ReasoningProvider, Status Bar, PT/MT Panes, Screen 3 Integration

**Completed:** 2026-09-28 (inline orchestrator execution)

## Task 1
- `components/wizard/reasoning-context.tsx`: ReasoningProvider owning ONE store per mount; ONE batched extraction per evaluatedAt (client-computed population digest per R1); state machine pending→running→complete|failed|disabled (200 `{disabled:true}` → `disabled`, resolution 3); `allowNarration` = complete OR disabled (never failed — Pitfall 5 client gate); positionally-aligned history seam (`groupByCml` re-run per evaluatedAt, same rows/mapping/units the reducer used → inputs[i] ↔ readings[i]); `useReasoning()` degrades to a module-fallback store + narration-enabled outside the provider (markup tests + non-provider embeds stay working).
- `components/wizard/pipeline-status-bar.tsx`: per-step rows (Extraction/Narrative), runtime-resolved model badges verbatim, `tokens {n} · {s} s · —` cost em-dash (resolution 2), FAILED badge, disabled `—` + `fallback mode`, deterministic-fallback chip when `store.fallbackServed()` (metrics — never fabricated), `running…` from `store.streamingCount()`. `extractionOverride` test seam (SSR effects don't run).
- `screen-results.tsx`: provider wrap, StatusRegion (bar + `role="alert"` banner with the exact UI-SPEC failure copy — computed columns never gated), new session-slice props (rows/mapping/notes/indications from wizard state).
- Store extensions: `narrativeModel()`, `streamingCount()` (additive).

## Task 2
- `ptmt-triage-list.tsx`: CML toggle contract per card (View/Hide reasoning, chevron rotate + motion-reduce, aria-expanded/aria-controls → `reasoning-ptmt-{id}`) expanding to a ReasoningPane instance — indication chain (method/dimensions/count/edge-separation/crack-suspect + criteria.ptmt thresholds verbatim), clause chip resolving the engine-emitted citationId, LIMIT = engine `detail` verbatim, VERDICT chip; kind-ptmt payloads through the same provider store.
- `reasoning-pane.tsx`: optional `indication` prop variant (mutually exclusive with reading; same five states + narrative region).
- `screen-results.tsx`: region keyed by evaluatedAt (re-run remounts — panes close, status bar resets, cached narratives unreachable); audit footnote `Citation audit: {n} unresolved citation(s) blocked at renderer.` rendered ONLY when n>0; `onUnresolvedCitation` plumbed from panes.
- `tests/wizard/screen3-integration.test.tsx`: PT/MT chain (thresholds verbatim, clause chip, engine detail, FAIL verdict), toggle contract, RESULTS_PAGE_SIZE=50 regression.

## Deviations / notes
- vitest include already extended for .tsx (03-03).
- `reasoning-pane.tsx` props widened: `reading`/`metadata` now optional with a mutual-exclusion guard (CML chain narrows via the ternary).
- flowstep-restyle test call-site updated with the four new session-slice props (rows []/mapping nulls — SSR effects don't run, extraction stays pending, hermetic).

## Gates
- **429 passed / 5 skipped** hermetic; typecheck + `npm run build` green; zero `nvidia/` literals (grep re-run clean).
