/**
 * FS-12 pin — the locked /report preview (03-00b Task 2, Screen 4.png): the
 * PENDING INSPECTOR SIGN-OFF chip, both tables rendering fixture rows with
 * "—" for nulls (no Infinity/NaN anywhere), clause references composed ONLY
 * from citations.json record fields (cite-don't-quote — an unknown id renders
 * zero glyphs), the conclusions list matching the fixture's non-accept rows,
 * disabled sign-off inputs, the exact preview banner, and Download PDF /
 * Print report DISABLED (generation gated to Phase 4 — no PDF, no print CSS).
 * The document renders under data-appearance="light" (warm paper on dark
 * chrome). 03-05 sweeps this id alongside the flowstep-restyle suite.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ReportDocument,
  buildConclusions,
  citationRef,
  earliestNextInspection,
} from "@/components/report/report-document";
import type { ReportSnapshot } from "@/lib/report/session-snapshot";
import type { ReadingResult } from "@/lib/ingest/session";

function fixtureReading(
  readingId: string,
  cml: string,
  location: string,
  verdict: ReadingResult["verdict"],
  flags: ReadingResult["flags"],
  citations: string[],
  rlYears: number | null,
  nextInspection: ReadingResult["nextInspection"],
): ReadingResult {
  return {
    readingId,
    location,
    cml,
    date: "2025-01-15T00:00:00Z",
    tActualMm: 8.42,
    tPressureMm: 4.2,
    tStructuralMm: 6.35,
    tRequiredMm: 6.35,
    crLtMmYr: 0.112,
    crStMmYr: null,
    rawCrLtMmYr: 0.112,
    rawCrStMmYr: null,
    crGoverningMmYr: 0.112,
    rlYears,
    nextInspection,
    flags,
    verdict,
    citations,
  };
}

const FIXTURE_SNAPSHOT: ReportSnapshot = {
  evaluatedAt: "2026-09-27T14:32:00Z",
  sourceName: "ut_register_demo.csv",
  units: { csvThickness: "mm", metadata: "mm" },
  metadata: {
    od: 219.1,
    tNominal: 10.31,
    fca: 1.0,
    tStructural: 6.35,
    designCode: "ASME B31.3 — 2024 Edition",
    pipeClass: 2,
    gaugeUncertainty: 0.1,
    pressureUnit: "MPa",
    designPressure: 3.5,
    allowableStress: 138,
    e: 1,
    w: 1,
    y: 0.4,
    formula: "asme_b31_3_straight_pipe",
  },
  summary: { total: 3, locations: 3, accept: 1, reCheck: 1, fail: 1 },
  readings: [
    fixtureReading("r-acc", "CML-01", "North header", "accept", [], [], 35.4, {
      date: "2030-01-15",
      intervalYears: 5,
    }),
    fixtureReading(
      "r-rec",
      "CML-02",
      "North header",
      "re_check",
      ["outlier"],
      ["api570_7_1_2_governing"],
      0.1,
      { date: "2026-10-04", intervalYears: 0.1 },
    ),
    fixtureReading("r-rej", "CML-03", "Elbow E-04", "reject", [], ["api570_7_1_2_lt"], null, null),
  ],
  indications: [
    {
      id: "ind-mt-1",
      method: "MT",
      morphology: "linear",
      lengthMm: 4.2,
      widthMm: 0.8,
      count: 1,
      edgeSeparationMm: null,
      crackSuspect: false,
      verdict: "reject",
      detail: "Relevant linear indications are rejected — escalate to Level 2/3 inspector evaluation.",
      citationId: "asme_b31_3_344_3_2",
    },
  ],
  notes: "",
};

function renderReport(): string {
  return renderToStaticMarkup(
    createElement(ReportDocument, {
      snapshot: FIXTURE_SNAPSHOT,
      generatedAt: "2026-09-27T09:00:00Z",
    }),
  );
}

describe("FS-12 locked /report preview — chrome and gating", () => {
  it("renders the exact preview banner and the light appearance attribute", () => {
    const markup = renderReport();
    expect(markup).toContain("Report ready");
    expect(markup).toContain("Sign off to enable PDF export and printing.");
    expect(markup).toContain('data-appearance="light"');
    expect(markup).toContain("Printable inspection report");
  });

  it("renders the title row with the PENDING INSPECTOR SIGN-OFF badge and meta block", () => {
    const markup = renderReport();
    expect(markup).toContain("FlawCheck Inspection Report");
    expect(markup).toContain("Pending inspector sign-off");
    expect(markup).toContain("Generated");
    expect(markup).toContain("2026-09-27"); // generatedAt + evaluatedAt date
    expect(markup).toContain("ut_register_demo.csv");
  });

  it("renders Download PDF and Print report DISABLED with the sign-off note", () => {
    const markup = renderReport();
    for (const label of ["Download PDF", "Print report"]) {
      const idx = markup.indexOf(label);
      expect(idx).toBeGreaterThan(-1);
      expect(markup.slice(Math.max(0, idx - 300), idx)).toContain("disabled");
    }
    expect(markup).toContain("Available after inspector sign-off");
    expect(markup).toContain("Back to results");
  });

  it('owns PDF + print (04-03): the page now wires window.print and the PDF fetch', () => {
    const src = readFileSync('app/report/page.tsx', 'utf8');
    expect(src).toContain('window.print');
    expect(src).toContain('/api/report/pdf');
  });
});

describe("FS-12 locked /report preview — real data tables", () => {
  it("renders the CML measurements table with fixture rows, '—' for nulls, and no Infinity/NaN", () => {
    const markup = renderReport();
    expect(markup).toContain("CML measurements");
    expect(markup).toContain("CML-01 — North header");
    expect(markup).toContain("8.42"); // t-actual
    expect(markup).toContain("6.35"); // t-required
    expect(markup).toContain("0.112"); // CR gov.
    expect(markup).toContain("35.4 yr"); // RL
    expect(markup).toContain("2030-01-15"); // next inspection date
    expect(markup).toContain("OUTLIER"); // flag label via flagChipFor
    // Null cells degrade to '—' (r-rej: RL + next inspection), never Infinity/NaN.
    expect(markup).toContain("—");
    expect(markup).not.toContain("Infinity");
    expect(markup).not.toContain("NaN");
  });

  it("renders the PT/MT indication table with the verdict and clause ref", () => {
    const markup = renderReport();
    expect(markup).toContain("PT/MT indication");
    expect(markup).toContain("Linear");
    expect(markup).toContain("4.2 × 0.8 mm");
    expect(markup).toContain("FAIL");
    // Cite-don't-quote: the clause ref is composed from the record fields.
    expect(markup).toContain("ASME B31.3 §344.3.2");
  });

  it("renders the component context grid from metadata with formatFixed numerics", () => {
    const markup = renderReport();
    expect(markup).toContain("Component context");
    expect(markup).toContain("219.1 mm"); // OD
    expect(markup).toContain("10.31 mm"); // t-nom
    expect(markup).toContain("ASME B31.3 — 2024 Edition");
    expect(markup).toContain("Class 2");
    expect(markup).toContain("1.0 mm"); // FCA
  });

  it("renders the next-inspection callout with the earliest date and the record-derived rule", () => {
    const markup = renderReport();
    expect(markup).toContain("Next inspection: 2026-10-04"); // earliest of 2030-01-15 / 2026-10-04
    expect(markup).toContain("Rule applied: API 570 §6.3.3"); // api570_6_3_3_halflife record fields
  });
});

describe("FS-12 clause citation invariant (allowlist renderer)", () => {
  it("citationRef composes ONLY record fields and renders zero glyphs for unknown ids", () => {
    expect(citationRef("asme_b31_3_344_3_2")).toBe("ASME B31.3 §344.3.2");
    expect(citationRef("api570_6_3_3_halflife")).toBe("API 570 §6.3.3");
    expect(citationRef("not_a_real_citation_id")).toBe("");
  });

  it("the conclusions list matches the fixture's non-accept rows and ends with record clause refs", () => {
    const lines = buildConclusions(FIXTURE_SNAPSHOT);
    expect(lines).toHaveLength(3); // 2 non-accept readings + 1 non-accept indication
    // Deterministic order: readings in session order, then indications.
    expect(lines[0].text).toContain("CML-02");
    expect(lines[0].text).toContain("requires inspector re-check");
    expect(lines[0].citationId).toBe("api570_7_1_2_governing");
    expect(lines[1].text).toContain("CML-03");
    expect(lines[1].text).toContain(
      "is below the calculated required thickness and requires disposition before continued service.",
    );
    // WR-08: the conclusion cites the reading's OWN engine-emitted citation
    // (the governing t-required branch varies) — the old pin asserted the
    // hardcoded pressure-design clause the deep review flagged as a defect.
    expect(lines[1].citationId).toBe("api570_7_1_2_lt");
    expect(lines[2].text).toBe(
      "The linear MT indication requires Level 2/3 inspector evaluation.",
    );
    expect(lines[2].citationId).toBe("asme_b31_3_344_3_2");

    const markup = renderReport();
    expect(markup).toContain("Clause-cited conclusions");
    expect(markup).toContain(
      "is below the calculated required thickness and requires disposition before continued service.",
    );
    expect(markup).toContain("requires Level 2/3 inspector evaluation");
  });

  it("an all-accept session renders the single muted placeholder line", () => {
    const allAccept: ReportSnapshot = {
      ...FIXTURE_SNAPSHOT,
      readings: [FIXTURE_SNAPSHOT.readings[0]],
      indications: [],
    };
    expect(buildConclusions(allAccept)).toHaveLength(0);
    expect(earliestNextInspection(allAccept)).toBe("2030-01-15");
  });

  it("earliestNextInspection ignores immediate-inspection readings (G14: never a date for them)", () => {
    const snapshot: ReportSnapshot = {
      ...FIXTURE_SNAPSHOT,
      readings: [
        fixtureReading("r-imm", "CML-09", "Elbow", "reject", ["immediate_inspection"], [], 0, null),
        FIXTURE_SNAPSHOT.readings[0],
      ],
    };
    expect(earliestNextInspection(snapshot)).toBe("2030-01-15");
  });
});

describe("FS-12 sign-off is non-functional in Phase 3", () => {
  it("renders ENABLED Name/Certification/Date/Signature fields with required indicators (04-03)", () => {
    const markup = renderReport();
    expect(markup).toContain("Inspector sign-off");
    for (const id of ["inspector-name", "certification", "signoff-date", "signoff-signature"]) {
      expect(markup).toContain(`id="${id}"`);
    }
    // required indicators + no disabled attrs on the form fields
    expect(markup).toContain("text-destructive");
    expect(markup).not.toContain('id="inspector-name" placeholder="Full name" disabled');
    // unit assumption + audit appendix land in the document
    expect(markup).toContain("All values converted to mm (canonical).");
    expect(markup).toContain("Audit appendix");
  });
});
