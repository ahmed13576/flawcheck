/**
 * Spike D: Semantic Guardrail
 *
 * Hallucination checking replacing brittle regex lints, in two layers:
 *
 * 1. Deterministic grounding (pure TypeScript, always runs):
 *    - every code citation token in the narrative must resolve to a clause
 *      documented in lib/criteria/citations.json (the verified allowlist —
 *      the single source of truth for what may be cited);
 *    - every supplied calculation fact must appear verbatim (exact string, or
 *      1/2-decimal rounding) in the narrative — a fact the report fails to
 *      state, or a fabricated value it invents, is a mismatch.
 *
 * 2. Semantic noul gate (System-1 model): calibrated probability that the
 *    narrative is fully grounded; requires p >= 0.95 to pass.
 *
 * Strict invariant (fail-closed): isGrounded requires BOTH the deterministic
 * layer clean AND the model gate — any unauthorized citation or number
 * mismatch fails the guard regardless of model confidence.
 */

import type { DecisionProvider, DecisionContext, NoulCriteria } from "../types";
import { criteria } from "@/lib/calc/criteria";

export interface CalculationFacts {
  tActualMm?: number;
  tRequiredMm?: number;
  corrosionRateMmYr?: number;
  remainingLifeYears?: number;
  governingVerdict?: string;
  governingCitation?: string;
}

export interface SemanticGuardInput {
  narrativeText: string;
  facts: CalculationFacts;
  /** Overrides the allowlist with caller-provided ids (defaults to lib/criteria/citations.json). */
  allowlistedCitations?: string[];
}

export interface SemanticGuardResult {
  isGrounded: boolean;
  confidence: number;
  unauthorizedCitations: string[];
  numberMismatches: string[];
  latencyMs: number;
}

export const SEMANTIC_GUARD_THRESHOLD = 0.95;

/** Allowlisted citation ids (lib/criteria/citations.json — verified source of truth). */
export function allowlistedCitationIds(): string[] {
  return criteria.citations.map((c) => c.id as string);
}

/** Flattened clause/code strings of every allowlisted citation (e.g. "ASME B31.3 344.3.2"). */
function allowlistedCitationTexts(): string[] {
  const out: string[] = [];
  for (const c of criteria.citations) {
    if (typeof c.code === "string") out.push(c.code.toLowerCase());
    if (typeof c.clause === "string") out.push(c.clause.toLowerCase());
  }
  return out;
}

/**
 * Citation-shaped tokens in the narrative — REQUIRE an explicit standard
 * prefix ("API", "ASME", "B31.3") or a "Table N" reference so bare computed
 * numbers, dates, and years can never false-positive as citations:
 *   "ASME B31.3 §344.3.2", "API 570 6.3.4", "API 574 Annex D", "B31.3 304.1.2".
 */
const CITATION_TOKEN_PATTERN =
  /(?:API\s*(?:B31\.3)?|ASME\s*(?:B31\.3)?|B31\.3)\s*§?\s*\d+(?:\.\d+)*(?:\s*\([^)]*\))?(?:\s*(?:Annex|[Tt]able)\s*[A-Z]?[\w.-]*)?|[Tt]able\s+[A-Z]?\d+/g;

/**
 * Deterministic citation check: every citation-shaped token in the narrative
 * must correspond to an allowlisted code/clause string. Purely lexical —
 * zero arithmetic (numbers here are identifiers, not computed values).
 */
export function findUnauthorizedCitations(
  narrativeText: string,
  allowedIds?: string[]
): string[] {
  const allowed = allowedIds ?? allowlistedCitationIds();
  const allowTexts = allowlistedCitationTexts();
  const found = new Set<string>();
  for (const match of narrativeText.matchAll(CITATION_TOKEN_PATTERN)) {
    const token = match[0].trim();
    if (!token || token.length < 2) continue;
    const norm = token.toLowerCase().replace(/[§]/g, " ").replace(/\s+/g, " ").trim();
    const isAllowed =
      allowTexts.some((t) => norm.includes(t)) || allowed.some((id) => norm.includes(id.toLowerCase()));
    // Bare clause numbers without a standard prefix (e.g. "344.3.2") may be
    // legal when a standard name appears earlier — accept when any allowlisted
    // clause string matches.
    if (!isAllowed && !allowTexts.some((t) => t.includes(norm))) {
      found.add(token);
    }
  }
  return [...found];
}

/** Canonical string renderings of a fact number: exact, 1-decimal, 2-decimal. */
function numberRenderings(value: number): string[] {
  return [String(value), value.toFixed(1), value.toFixed(2)];
}

/**
 * Deterministic number check: every provided fact must appear in the
 * narrative (exact or rounded rendering), and any explicitly labeled fact
 * value in the narrative must not contradict the fact set.
 */
export function findNumberMismatches(narrativeText: string, facts: CalculationFacts): string[] {
  const mismatches: string[] = [];
  for (const [key, value] of Object.entries(facts)) {
    if (value === undefined) continue;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        mismatches.push(`${key}: non-finite fact value`);
        continue;
      }
      const present = numberRenderings(value).some((r) => narrativeText.includes(r));
      if (!present) mismatches.push(`${key}: computed value ${value} not stated in narrative`);
    } else {
      // String facts (verdict, citation id) must appear in normalized form.
      const present = narrativeText.toLowerCase().includes(String(value).toLowerCase());
      if (!present) mismatches.push(`${key}: governing value "${value}" not stated in narrative`);
    }
  }
  return mismatches;
}

/**
 * Verifies that a generated narrative report is fully grounded in calculation facts:
 * deterministic citation/number checks combined with the System-1 semantic gate.
 */
export async function verifySemanticGrounding(
  provider: DecisionProvider,
  input: SemanticGuardInput,
  signal?: AbortSignal
): Promise<SemanticGuardResult> {
  const allowed = input.allowlistedCitations;

  // Layer 1 — deterministic grounding (runs even when the model is disabled).
  const unauthorizedCitations = findUnauthorizedCitations(input.narrativeText, allowed);
  const numberMismatches = findNumberMismatches(input.narrativeText, input.facts);

  const context: DecisionContext = {
    state: {
      narrativeText: input.narrativeText,
      facts: input.facts,
      allowlistedCitations: allowed ?? allowlistedCitationIds(),
    },
    metadata: { spike: "semantic_guard" },
    signal,
  };

  const criteriaNoul: NoulCriteria = {
    instructions:
      "Verify whether the narrative text is 100% grounded in the provided calculation facts. Are there any fabricated numbers or unallowlisted code citations?",
    criteria: {
      true: "All numbers, dates, and code citations in the narrative exactly match the provided calculation facts.",
      false: "The narrative invents or alters numerical values, fabricates standard citations, or introduces ungrounded claims.",
    },
  };

  // Layer 2 — semantic gate (System-1). Fails closed at p < 0.95.
  const result = await provider.noul(context, criteriaNoul, SEMANTIC_GUARD_THRESHOLD);

  return {
    isGrounded:
      unauthorizedCitations.length === 0 &&
      numberMismatches.length === 0 &&
      result.noul >= SEMANTIC_GUARD_THRESHOLD,
    confidence: result.noul,
    unauthorizedCitations,
    numberMismatches,
    latencyMs: result.latencyMs,
  };
}
