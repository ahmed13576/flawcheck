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
import type { ReportSnapshot } from "@/lib/report/session-snapshot";

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
