/**
 * criteria.ts — the single typed import point for lib/criteria/*.json.
 *
 * AGENTS.md invariant: all formulas, material coefficients, and flaw
 * acceptance rules MUST come from these files. lib/calc implements formula
 * *shapes* in TypeScript and loads every constant (thresholds, maxima,
 * uncertainty, citation ids) from here — never hard-codes them.
 */
import utJson from "../criteria/ut-criteria.json";
import ptmtJson from "../criteria/ptmt-criteria.json";
import citationsJson from "../criteria/citations.json";

export const criteria = {
  ut: utJson,
  ptmt: ptmtJson,
  citations: citationsJson,
} as const;

export type CitationId = (typeof citationsJson)[number]["id"];

export function citationIdExists(id: string): boolean {
  return citationsJson.some((c) => c.id === id);
}

/** ut-criteria.json verdict_bands.default_gauge_uncertainty_mm (± mm). */
export function defaultGaugeUncertaintyMm(): number {
  return criteria.ut.verdict_bands.default_gauge_uncertainty_mm;
}

/**
 * API 570 Table 1 maximum thickness-measurement interval by piping class.
 * Pitfall 10: the JSON mixes types — "Class 4": "optional" is a string among
 * numbers — so the accessor narrows `typeof v === "number"` and a class
 * without a numeric maximum yields null instead of leaking into arithmetic.
 */
export function maxIntervalByClass(pipeClass: 1 | 2 | 3): number | null {
  const table = criteria.ut.inspection_interval_rules
    .max_interval_by_class as Record<string, number | string>;
  const raw = table[`Class ${pipeClass}`];
  return typeof raw === "number" ? raw : null;
}
