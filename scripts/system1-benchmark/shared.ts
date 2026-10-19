/**
 * Shared helpers for the measured System-1 benchmark runner
 * (scripts/system1-benchmark/). Imported only by the benchmark runner and its
 * scratch smoke test — never part of the app module graph.
 */

import type { DecisionProvider } from "@/lib/decision/types";

/** Fork A observed a 17-minute upstream stall once — abort per request at 60 s and count the failure. */
export const PER_REQUEST_TIMEOUT_MS = 60_000;

/** Wraps a provider so every batch call carries a 60 s AbortSignal (composes with any existing signal). */
export function withTimeout(provider: DecisionProvider): DecisionProvider {
  return {
    providerId: provider.providerId,
    modelId: provider.modelId,
    noul: (context, criteria, threshold) => provider.noul(context, criteria, threshold),
    choice: (context, options) => provider.choice(context, options),
    score: (context, levels) => provider.score(context, levels),
    batch: (context, questions) =>
      provider.batch(
        {
          ...context,
          signal: AbortSignal.any(
            [context.signal, AbortSignal.timeout(PER_REQUEST_TIMEOUT_MS)].filter((s): s is AbortSignal => Boolean(s)),
          ),
        },
        questions,
      ),
  };
}

/**
 * TokenPricingPerMillion, verifiable-list-price only — the harness treats a
 * missing entry as estimatedCostPer1kUsd = null (no invented numbers).
 *
 * - Nebius: price reused from Fork A's measured artifact
 *   (flawcheck-nvidia-system1 docs/system1-baseline-metrics.json): "Nebius Token
 *   Factory public pricing, Nemotron-3.5 family (2026-10-19)" — $0.13/M input,
 *   $0.60/M output. Public list price, noted for reconciliation.
 * - SubQ: docs.subq.ai publishes NO per-token price (docs root and quickstart
 *   verified 2026-10-19; quickstart notes only that a request without available
 *   credits returns 402). Pricing unverified — recorded as null.
 */
export const PRICING_BY_PROVIDER: Record<string, { inputUsd: number; outputUsd: number }> = {
  nebius: { inputUsd: 0.13, outputUsd: 0.6 },
};

export const PRICING_SOURCES = [
  "nebius: Nebius Token Factory public pricing, Nemotron-3.5 family (2026-10-19) — reused from Fork A's artifact docs/system1-baseline-metrics.json ($0.13/M input, $0.60/M output)",
  "subq: pricing unverified — no authoritative public per-token price on docs.subq.ai; cost/1k recorded as null",
] as const;
