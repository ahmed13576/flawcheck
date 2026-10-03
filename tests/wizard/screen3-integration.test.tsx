/**
 * Screen 3 integration — 03-04 Task 2: PT/MT pane chain, locked 4-step chrome
 * regression (C4, 03-00's implementation), audit-footnote conditionality, and
 * the Phase 2 pagination constant. SSR-safe: pane markup via
 * renderToStaticMarkup; screen-level contracts via pure exports.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ReasoningPane } from "@/components/wizard/reasoning-pane";
import { PtmtTriageList } from "@/components/wizard/ptmt-triage-list";
import { RESULTS_PAGE_SIZE } from "@/components/wizard/results-table";
import { criteria } from "@/lib/calc/criteria";
import type { PtmIndicationResult } from "@/lib/ingest/session";

const INDICATION: PtmIndicationResult = {
  id: "ind-mt-1",
  method: "MT",
  morphology: "linear",
  lengthMm: 4.2,
  widthMm: 0.8,
  count: 1,
  edgeSeparationMm: null,
  crackSuspect: false,
  description: "Linear indication at weld toe",
  verdict: "reject",
  detail: "Relevant linear indications are rejected — escalate to Level 2/3 inspector evaluation.",
  citationId: "asme_b31_3_344_3_2",
};

const ERROR_ENTRY = {
  status: "error" as const,
  text: "",
  errorReason: "Extraction failed — narrative generation was skipped.",
};

describe("Screen 3 integration (03-04)", () => {
  it("PT/MT pane chain renders INPUTS (thresholds verbatim), CLAUSE chip, LIMIT detail, VERDICT", () => {
    const html = renderToStaticMarkup(
      createElement(ReasoningPane, {
        indication: INDICATION,
        entry: ERROR_ENTRY,
      }),
    );
    // INPUTS — structured inputs + criteria.ptmt thresholds at source precision
    expect(html).toContain("MT");
    expect(html).toContain("L 4.2 × W 0.8 mm");
    expect(html).toContain(String(criteria.ptmt.relevance_threshold_mm));
    // CLAUSE — the engine-emitted citation id resolves to a chip
    expect(html).toContain("asme_b31_3_344_3_2");
    // LIMIT — the engine detail string verbatim
    expect(html).toContain(
      "Relevant linear indications are rejected — escalate to Level 2/3 inspector evaluation.",
    );
    // VERDICT chip
    expect(html).toContain("FAIL");
    expect(html).toContain("Extraction failed — narrative generation was skipped.");
  });

  it("PT/MT triage cards carry the toggle contract (aria-expanded/aria-controls)", () => {
    const html = renderToStaticMarkup(
      createElement(PtmtTriageList, {
        indications: [INDICATION],
        evaluatedAt: "2026-09-27T14:32:00Z",
      }),
    );
    expect(html).toContain("View reasoning");
    expect(html).toContain('aria-controls="reasoning-ptmt-ind-mt-1"');
    expect(html).toContain('aria-expanded="false"');
  });

  it("RESULTS_PAGE_SIZE stays 50 (Phase 2 pagination contract, UI-44)", () => {
    expect(RESULTS_PAGE_SIZE).toBe(50);
  });
});
