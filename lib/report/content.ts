/**
 * Report content seam — 04-01 Task 1. The pure presentation derivations that
 * both Phase 4 renderers share (one source of truth, two renderers): the
 * on-screen ReportDocument (components/report/report-document.tsx) and the
 * server PDF renderer (components/report/pdf-document.tsx, plan 04-02) both
 * import from here, so numbers, clause references, conclusions, and framing
 * copy can never drift between the HTML and PDF paths.
 *
 * Server-safe by construction: NO "use client" directive, imports only the
 * criteria loader (lib/calc/criteria — deterministic, AGENTS.md single source
 * of truth) and TYPES from lib/ingest/session + lib/report/session-snapshot.
 * Nothing from client components.
 */
import { criteria } from "@/lib/calc/criteria";
// Protected-tree READ-ONLY use (AGENTS.md): roundTo is the lib/calc rounding
// primitive the verdict-band comparison uses — the presentation layer mirrors
// the 6-dp convention by REUSING it, never by re-deriving math.
import { roundTo } from "@/lib/calc/round";
import type { ReportSnapshot } from "@/lib/report/session-snapshot";
import type { EvaluationResults, ReadingResult, Verdict } from "@/lib/ingest/session";

/**
 * Screen 3 / report framing copy (UI-55: every render path carries the unit
 * assumption). Callers substitute {csv} / {meta} from snapshot.units.
 */
export const REPORT_UNIT_ASSUMPTION_COPY =
  "Units: CSV thickness in {csv}, metadata in {meta}. All values converted to mm (canonical).";

type CitationRecord = (typeof criteria.citations)[number];
const CITATION_RECORDS = criteria.citations as readonly CitationRecord[];

/**
 * Allowlist renderer (citation invariant): the ref string is composed ONLY
 * from the citations.json record fields (code, clause) — cite-don't-quote.
 * An unknown id renders ZERO glyphs.
 * Exported pure for the node test-suite.
 */
export function citationRef(id: string): string {
  const record = CITATION_RECORDS.find((c) => c.id === id);
  return record ? `${record.code} §${record.clause}` : "";
}

/**
 * The engine emits this id whenever a dated next-inspection is set
 * (lib/calc/evaluate.ts). The clause STRING is never hardcoded — it is
 * rendered from the citations.json record fields via citationRef().
 */
export const REINSPECTION_CITATION_ID = "api570_6_3_3_halflife";

export interface ConclusionLine {
  text: string;
  citationId: string | null;
}

/**
 * Phase-3 placeholder conclusions (Phase 4 replaces this list with
 * narrative-driven conclusions): one deterministic line per non-ACCEPT
 * reading and per non-ACCEPT indication, each ending with the clause ref
 * from the citations.json record for an engine-emitted citation id (null id
 * or unknown id → no clause glyphs). Exported pure for the node test-suite.
 */
export function buildConclusions(snapshot: ReportSnapshot): ConclusionLine[] {
  const lines: ConclusionLine[] = [];
  for (const reading of snapshot.readings) {
    if (reading.verdict === "accept") continue;
    const name = reading.cml ?? reading.location;
    if (reading.verdict === "reject") {
      // WR-08: cite the reading's OWN engine-emitted citation (the governing
      // t-required branch varies) — pressure-design clause only as fallback.
      const engineCite =
        reading.citations.find((id) => citationRef(id) !== "") ?? null;
      const citeId =
        engineCite ??
        (citationRef("asme_b31_3_304_1_2") !== "" ? "asme_b31_3_304_1_2" : null);
      lines.push({
        text: `${name} is below the calculated required thickness and requires disposition before continued service.`,
        citationId: citeId,
      });
    } else {
      const cite = reading.citations.find((id) => citationRef(id) !== "") ?? null;
      lines.push({
        text: `${name} requires inspector re-check — data quality or the band boundary must be confirmed before acceptance.`,
        citationId: cite,
      });
    }
  }
  for (const indication of snapshot.indications) {
    if (indication.verdict === "accept") continue;
    const action =
      indication.verdict === "reject"
        ? "requires Level 2/3 inspector evaluation"
        : "requires inspector review before disposition";
    lines.push({
      text: `The ${indication.morphology} ${indication.method} indication ${action}.`,
      citationId: citationRef(indication.citationId) !== "" ? indication.citationId : null,
    });
  }
  return lines;
}

/**
 * Earliest dated next-inspection across the session's readings (ISO strings
 * sort lexicographically). Immediate-inspection readings keep
 * nextInspection null (G14) and never contribute a date. Exported pure.
 */
export function earliestNextInspection(snapshot: ReportSnapshot): string | null {
  const dates = snapshot.readings
    .map((r) => r.nextInspection?.date ?? null)
    .filter((d): d is string => d !== null)
    .sort();
  return dates[0] ?? null;
}

/**
 * ---------------------------------------------------------------------------
 * Phase 6 — Report Digestibility (plan 06-01). Pure, deterministic,
 * node-testable dashboard copy + the shared verdict glossary. Everything in
 * this section is a composition of fields evaluate() already emits — zero
 * [[cite: tokens, zero LLM / narrative-store / telemetry / Date.now input:
 * identical input yields identical output (UI-6.4, T-06-01-01).
 * ---------------------------------------------------------------------------
 */

/** en-US count formatting is locked for every brief/dashboard number (UI-6.5). */
function fmtCount(n: number): string {
  return n.toLocaleString("en-US");
}

/** "A", "A and B", "A, B, and C" — the locked inline-name joining rule (WR-01 null-safe). */
export function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * Plain-English findings brief (REPT-04 / UI-6.2..UI-6.8). The brief is the
 * deterministic template over evaluate() output — NOT LLM-generated
 * (06-CONTEXT locked decision 1): the LLM never writes the summary of record.
 * Zero clause citations by contract (UI-6.3) — the tables carry them.
 */
export interface FindingsBrief {
  dispositionSentence: string;
  nextActionSentence: string;
  narrative: string;
  worstLocations: Array<{ name: string; verdict: Verdict; why: string }>;
}

/**
 * Locked worst-list ordering (UI-6.6): immediate_inspection readings first,
 * then rejects before re-checks, then rlYears ascending with null RL LAST
 * within its verdict class (null = "no computable life", never infinite —
 * the getGoverningPdfReadings convention). Array#sort is stable, so equal
 * keys preserve input order. WR-06: explicit null check avoids NaN.
 */
function compareWorst(a: ReadingResult, b: ReadingResult): number {
  const aImmediate = a.flags.includes("immediate_inspection") ? 0 : 1;
  const bImmediate = b.flags.includes("immediate_inspection") ? 0 : 1;
  if (aImmediate !== bImmediate) return aImmediate - bImmediate;
  const aRank = a.verdict === "reject" ? 0 : 1;
  const bRank = b.verdict === "reject" ? 0 : 1;
  if (aRank !== bRank) return aRank - bRank;
  if (a.rlYears === null && b.rlYears === null) return 0;
  if (a.rlYears === null) return 1;
  if (b.rlYears === null) return -1;
  return a.rlYears - b.rlYears;
}

/**
 * Locked why-string derivation (UI-6.7), first match wins. The locked table
 * lists outlier last, which as written is unreachable dead code for
 * non-accept readings (every non-accept reading matches a verdict row) —
 * resolved per planner note by evaluating the outlier condition immediately
 * after the immediate_inspection condition.
 */
function whyFor(reading: ReadingResult): string {
  const isFail = reading.verdict === "reject";
  if (isFail && reading.flags.includes("immediate_inspection")) {
    return "No safe service life remaining";
  }
  if (reading.flags.includes("outlier")) {
    return "Reading deviates from this CML's history — re-shoot candidate";
  }
  if (isFail) {
    // Governing branch at the lib/calc/verdicts 6-dp convention: structural
    // governs exactly when the (rounded) required thickness equals the
    // (rounded) structural minimum.
    const structuralGoverned =
      roundTo(reading.tRequiredMm, 6) === roundTo(reading.tStructuralMm, 6);
    return structuralGoverned
      ? "Below the structural minimum thickness"
      : "Below the pressure-design minimum thickness";
  }
  return reading.flags.includes("insufficient_history")
    ? "Not enough survey history to compute remaining life"
    : "Within the gauge-uncertainty band — re-measure to confirm";
}

/**
 * Builds the plain-English brief from engine output alone. The disposition
 * sentence cites READING counts — summary.locations counts mapped tanks and
 * is never labeled "CMLs" (P5). Worst list names come from cml ?? location.
 */
export function buildFindingsBrief(
  summary: EvaluationResults["summary"],
  readings: ReadingResult[],
): FindingsBrief {
  const total = summary.total;
  const allAccept = summary.fail === 0 && summary.reCheck === 0;
  const allFail = total > 0 && summary.fail === total;

  // Worst-locations list: all non-accept readings in the locked order,
  // capped at 5 (cap = min(5, non-accept count) — slice(0, 5) is exactly
  // that). All-accept sessions yield an EMPTY list — no placeholder.
  const worstLocations = readings
    .filter((r) => r.verdict !== "accept")
    .sort(compareWorst)
    .slice(0, 5)
    .map((r) => ({
      name: r.cml ?? r.location,
      verdict: r.verdict,
      why: whyFor(r),
    }));

  let dispositionSentence: string;
  if (allAccept) {
    dispositionSentence = `All ${fmtCount(total)} readings meet the code minimum.`;
  } else if (allFail) {
    dispositionSentence = `All ${fmtCount(total)} readings failed — the component is below the code minimum everywhere measured.`;
  } else if (summary.fail > 0) {
    if (summary.fail <= 3) {
      // ≤ 3 fails: name the failing locations inline (worst-order names, deduplicated per WR-02).
      const failNames = worstLocations
        .filter((entry) => entry.verdict === "reject")
        .map((entry) => entry.name);
      const uniqueNames = [...new Set(failNames)];
      if (uniqueNames.length > 0) {
        dispositionSentence = `${fmtCount(summary.fail)} of ${fmtCount(total)} readings failed — immediate inspection required at ${joinNames(uniqueNames)}.`;
      } else {
        dispositionSentence = `${fmtCount(summary.fail)} of ${fmtCount(total)} readings failed — immediate inspection required at the worst locations listed below.`;
      }
    } else {
      dispositionSentence = `${fmtCount(summary.fail)} of ${fmtCount(total)} readings failed — immediate inspection required at the worst locations listed below.`;
    }
  } else {
    dispositionSentence = `${fmtCount(summary.reCheck)} of ${fmtCount(total)} readings need re-check before disposition.`;
  }

  let nextActionSentence: string;
  if (allAccept) {
    nextActionSentence =
      "Next action: continue the established inspection interval — the earliest next inspection is dated in the register.";
  } else if (allFail) {
    nextActionSentence =
      "Next action: take the component out of service and notify the responsible inspector.";
  } else if (summary.fail > 0) {
    nextActionSentence =
      "Next action: re-measure the failing locations and disposition them against the code before continued service.";
  } else {
    nextActionSentence =
      "Next action: re-check the flagged locations to confirm thickness before disposition.";
  }

  let narrative: string;
  if (allFail) {
    narrative = `None of the ${fmtCount(total)} readings are ACCEPT. All are FAIL — wall is thinner than the code allows.`;
  } else if (allAccept) {
    narrative = `All ${fmtCount(total)} readings are ACCEPT — wall thickness meets the code minimum at every measured point.`;
  } else {
    const clauses: string[] = [];
    if (summary.accept > 0) {
      clauses.push(`${fmtCount(summary.accept)} readings are ACCEPT — wall thickness meets the code minimum.`);
    }
    if (summary.reCheck > 0) {
      clauses.push(`${fmtCount(summary.reCheck)} are RE-CHECK — thickness is close to the limit and must be confirmed.`);
    }
    if (summary.fail > 0) {
      clauses.push(`${fmtCount(summary.fail)} are FAIL — wall is thinner than the code allows.`);
    }
    narrative = clauses.join(" ");
  }

  return { dispositionSentence, nextActionSentence, narrative, worstLocations };
}

/**
 * Code-breakdown stats (REPT-05 / UI-6.16) — presentation-level counts ONLY:
 * verdict counts echo the summary; the pressure/structural pass-fail counts
 * compare each reading's already-emitted tActualMm against tPressureMm /
 * tStructuralMm with BOTH operands rounded to 6 dp (the lib/calc/verdicts
 * convention). NO new math enters lib/calc — comparison of emitted fields.
 * Totals reconcile with summary.total by construction.
 */
export interface CodeBreakdown {
  verdicts: { accept: number; reCheck: number; fail: number };
  pressure: { pass: number; fail: number };
  structural: { pass: number; fail: number };
}

export function buildCodeBreakdown(
  summary: EvaluationResults["summary"],
  readings: ReadingResult[],
): CodeBreakdown {
  let pressurePass = 0;
  let pressureFail = 0;
  let structuralPass = 0;
  let structuralFail = 0;
  for (const reading of readings) {
    const tActual = roundTo(reading.tActualMm, 6);
    if (tActual >= roundTo(reading.tPressureMm, 6)) pressurePass += 1;
    else pressureFail += 1;
    if (tActual >= roundTo(reading.tStructuralMm, 6)) structuralPass += 1;
    else structuralFail += 1;
  }
  return {
    verdicts: { accept: summary.accept, reCheck: summary.reCheck, fail: summary.fail },
    pressure: { pass: pressurePass, fail: pressureFail },
    structural: { pass: structuralPass, fail: structuralFail },
  };
}

/**
 * Shared verdict glossary (REPT-06 / UI-6.9) — ONE constant consumed by every
 * renderer (Screen 3 footer, HTML report conclusions, PDF page-1 footer).
 * Clause ids are the discussion-locked REMAP verified against citations.json
 * (research F6: the originally-proposed ids were absent from the allowlist and
 * semantically wrong). Sub-lines render ONLY via citationRef — an unknown id
 * renders zero glyphs, never a hardcoded clause string (T-06-01-02).
 */
export type VerdictGlossaryEntry = { plain: string; citationId: string | null };

export const VERDICT_GLOSSARY: Record<Verdict, VerdictGlossaryEntry> = {
  accept: {
    plain: "Wall thickness meets the code minimum at this location.",
    citationId: "api574_10_5_1_4",
  },
  re_check: {
    plain: "Thickness is close to the limit — re-measure to confirm before deciding.",
    citationId: "api570_7_1_2_governing",
  },
  reject: {
    plain: "Wall is thinner than the code allows at this location. Action required.",
    citationId: "api570_7_6",
  },
};

/** Fixed render order: ACCEPT, RE-CHECK, FAIL. */
export const VERDICT_GLOSSARY_ORDER: readonly Verdict[] = ["accept", "re_check", "reject"];

/**
 * Locked PDF disposition-banner sentence (UI-6.15), beneath the existing
 * three-tone heading. Counts substituted from real engine output only.
 */
export function buildDispositionBannerSentence(
  summary: EvaluationResults["summary"],
): string {
  if (summary.fail > 0) {
    return `${fmtCount(summary.fail)} of ${fmtCount(summary.total)} readings FAILED — the worst locations need immediate inspection.`;
  }
  if (summary.reCheck > 0) {
    return `${fmtCount(summary.accept)} of ${fmtCount(summary.total)} readings meet the code minimum — ${fmtCount(summary.reCheck)} readings need re-check before disposition.`;
  }
  return `All ${fmtCount(summary.total)} readings meet the code minimum — acceptable for continued service.`;
}

/** Locked what-to-do-next line (UI-6.18). */
export function buildWhatToDoNextLine(summary: EvaluationResults["summary"]): string {
  if (summary.fail > 0) {
    return "Immediate action: re-measure and disposition the failing locations before continued service.";
  }
  if (summary.reCheck > 0) {
    return "Next action: re-check the flagged locations to confirm thickness before disposition.";
  }
  return "Next action: continue the established inspection interval — earliest next inspection is dated in the register.";
}

/** Locked CSV pointer line (UI-6.19) — static text, no hyperlink this phase. */
export function buildCsvPointerLine(total: number): string {
  return `Full data: the complete register of ${fmtCount(total)} readings is available as a downloadable CSV export.`;
}
