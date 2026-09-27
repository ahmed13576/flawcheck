/**
 * PT/MT surface-indication triage per ASME B31.3 — every threshold loads from
 * lib/criteria/ptmt-criteria.json (relevance_threshold_mm, morphology
 * definitions, limits, cluster rule) and clause ids from its clauses map
 * keyed by method (MT -> asme_b31_3_344_3_2, PT -> asme_b31_3_344_4_2).
 *
 * Locked semantics:
 * - relevance: any dimension strictly > the loaded relevance threshold
 *   (P4: a max dimension exactly at the threshold is non-relevant)
 * - linear: length strictly > 3 * width (P7a: L == 3W is rounded)
 * - aligned cluster: count >= count_threshold AND separation <= max
 *   (strict <= — separation at the loaded maximum IS a cluster; null
 *   separation with count 1 can never cluster)
 * - oversized rounded: max dimension strictly > the loaded rounded limit
 * - crack-suspect non-relevant maps to re_check — the only inferred mapping,
 *   declared by the UI-SPEC (the criteria config has no amber band)
 *
 * Detail strings follow the UI-SPEC PT/MT chip detail lines; the numeric
 * values inside them render from the loaded criteria, never literals.
 */
import type { PtmIndication, Verdict } from "../ingest/session";
import { criteria } from "./criteria";

export interface IndicationResult {
  verdict: Verdict;
  detail: string;
  citationId: string;
}

function citationForMethod(method: PtmIndication["method"]): string {
  return method === "MT" ? "asme_b31_3_344_3_2" : "asme_b31_3_344_4_2";
}

export function evaluateIndication(ind: PtmIndication): IndicationResult {
  const c = criteria.ptmt;
  const citationId = citationForMethod(ind.method);
  const maxDim = Math.max(ind.lengthMm, ind.widthMm);

  const relevant = maxDim > c.relevance_threshold_mm; // strict > (P4 boundary)
  if (!relevant) {
    if (ind.crackSuspect) {
      return {
        verdict: "re_check",
        detail: "Verify crack-suspect indication with Level 2/3 inspector.",
        citationId,
      };
    }
    return {
      verdict: "accept",
      detail: `Non-relevant per relevance threshold (${c.relevance_threshold_mm} mm).`,
      citationId,
    };
  }

  const linear = ind.lengthMm > 3 * ind.widthMm; // strict > (P7a boundary)
  if (linear) {
    return {
      verdict: "reject",
      detail:
        "Relevant linear indications are rejected — escalate to Level 2/3 inspector evaluation.",
      citationId,
    };
  }

  const cluster = c.limits.aligned_rounded_cluster;
  const isCluster =
    ind.count >= cluster.count_threshold &&
    (ind.edgeSeparationMm ?? Number.POSITIVE_INFINITY) <=
      cluster.max_separation_edge_to_edge_mm;
  if (isCluster) {
    return {
      verdict: "reject",
      detail: `Aligned rounded cluster: ${ind.count} indications within ${cluster.max_separation_edge_to_edge_mm} mm separation.`,
      citationId,
    };
  }

  if (maxDim > c.limits.max_rounded_dimension_mm) {
    // strict > (P2/P3 boundary: exactly 5.0 is acceptable)
    return {
      verdict: "reject",
      detail: `Rounded indication exceeds ${c.limits.max_rounded_dimension_mm.toFixed(1)} mm limit.`,
      citationId,
    };
  }

  return {
    verdict: "accept",
    detail: "Relevant rounded within limit.",
    citationId,
  };
}
