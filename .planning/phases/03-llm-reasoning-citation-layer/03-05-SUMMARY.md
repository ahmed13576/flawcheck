# 03-05 Plan Summary — Wrap: Gates, Coverage, Live Record

**Completed:** 2026-09-28 (inline orchestrator execution)

## Task 1 — Offline e2e + standing gates
- `tests/reasoning/e2e-offline.test.ts` (4 tests): REAL routes under `FLAWCHECK_DISABLE_LLM=1` — CML + PT/MT fallback frames end with the locked closing sentence; every `[[cite:id]]` resolves against citations.json; zero usage/meta frames (nothing fabricated); extract route 200 `{disabled:true}`; REAS-03 end-to-end — a fabricated `[[cite:...]]` renders ZERO glyphs inline (no chip, no aria-controls) and appears ONLY in the audit stamp `Unresolved citation blocked: '…' — rendered blank (audit …)`, exactly per the renderer contract.
- Full gate chain green: typecheck ✓ · lint **0 errors** · hermetic **433 passed / 5 skipped** · build ✓ · `lib/calc`+`lib/criteria` byte-identical to phase-start ref ✓ · 5 Flowstep packages in package.json + UNINSTALL.md ✓ · zero `nvidia/` literals in app/lib/scripts/tests ✓ · zero dangerouslySetInnerHTML in app/components ✓.

## Task 2 — Live record + coverage sweep
- **Live A11 record (honest):** hello-fixture 4/4 PASS both routed models. Full live pipeline passed end-to-end once (2026-09-28: extraction 200, narrative 790/550 tokens streamed, all four final lints passed, `Verdict: ACCEPT.`). Subsequent runs hit **transient live-model failures** — one 502 at extraction (bounded retry exhausted on a live hiccup), one narrative lint-rejection (nondeterministic derivation slip). Both dispositions are the DESIGN working: lints reject → deterministic fallback; fallback text carries only allowlist ids. Recorded as known live flakiness, not product defects; hermetic suite stays key-independent.
- **SC5 note (resolution 2):** the cost field is served as the UI-SPEC unavailable-pricing em-dash (`—`); real tokens + latency + runtime-resolved model are the honest metrics.
- **UI-25..48 sweep:** all 24 rows covered — UI-25..32/44/45 (store: cache, FIFO, chunk safety, cross-key invisibility), UI-33..37/46..48 (fallback + citation renderer + audit), UI-38..43 (status bar + banner + PT/MT panes). FS-01..12 Flowstep pins green. SC1-5 mapped: SC1 (extract 502/422 loud paths), SC2 (4 lints + sentence-guard + fallback swap), SC3 (allowlist renderer e2e), SC4 (PT/MT thresholds + engine verdicts in chain), SC5 (badges/metrics with the em-dash note).
- **433 hermetic tests** (was 280 at Phase 2 close — Phase 3 added 153).

## Deviations
- `useReasoning` fallback store made an eager module singleton (lint: no globalThis mutation in render); test seam `__getFallbackStoreForTests()` exported.
- Lint-driven hardening: report page setState-in-effect → read-once derivation; auditClock ref-in-render → useState lazy init; flowstep-restyle test `require()` → static imports.
