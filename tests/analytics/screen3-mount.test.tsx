/**
 * Phase 09 VIS-03 — Screen 3 analytics-panel mount tests.
 *
 * The flowstep SSR harness (renderToStaticMarkup — the vitest environment is
 * `node`, no jsdom; no DOM events) asserts three contracts against the REAL
 * ScreenResultsContent:
 *
 * 1. The collapsible "Visual Inspection Analytics" panel renders above the
 *    findings controls with readings — heatmap, trend curve, and gauge all
 *    present, fed by the shared lib/analytics adapters.
 * 2. The heatmap onSelect relay highlights the matching results-table row —
 *    SSR has no click events, so the relay contract is pinned at BOTH ends:
 *    the exported ROW_HIGHLIGHTED_TESTID hook on ResultsTable rows (source
 *    + output when a highlightedCmlId prop is relayed) and the host wiring
 *    (the panel's selectedCmlId state flows into the table prop — source
 *    scan).
 * 3. Zero evaluated readings render the friendly empty state — never the
 *    empty SVG shell.
 *
 * The empty-readings case never reaches ScreenResultsContent via ScreenResults
 * (UI-15 gates first), so the empty state is pinned through the panel's own
 * rendering path: the ScreenResultsContent source passes results.readings
 * straight into the panel, and zero readings → the
 * `visual-analytics-empty` testid block.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ScreenResultsContent,
  ROW_HIGHLIGHTED_TESTID,
  type ScreenResultsContentProps,
} from "@/components/wizard/screen-results";
import { ResultsTable } from "@/components/wizard/results-table";
import type {
  ComponentMetadata,
  EvaluationResults,
  ReadingResult,
  Verdict,
} from "@/lib/ingest/session";

function fixtureReading(
  readingId: string,
  location: string,
  cml: string,
  verdict: Verdict,
  date: string,
): ReadingResult {
  return {
    readingId,
    location,
    cml,
    date,
    tActualMm: verdict === "reject" ? 5.9 : 9.2,
    tPressureMm: 4.2,
    tStructuralMm: 6.1,
    tRequiredMm: 6.1,
    crLtMmYr: 0.03,
    crStMmYr: null,
    rawCrLtMmYr: 0.03,
    rawCrStMmYr: null,
    crGoverningMmYr: verdict === "reject" ? 0.4 : 0.03,
    rlYears: verdict === "reject" ? 0 : 35.4,
    nextInspection:
      verdict === "reject" ? null : { date: "2030-01-15", intervalYears: 5 },
    flags: [],
    verdict,
    citations: [],
  };
}

const MIXED_RESULTS: EvaluationResults = {
  summary: { total: 3, locations: 3, accept: 1, reCheck: 1, fail: 1 },
  readings: [
    fixtureReading("r-acc", "WBT-P1", "CML-01", "accept", "2025-01-01T00:00:00Z"),
    fixtureReading(
      "r-rec",
      "WBT-P2",
      "CML-02",
      "re_check",
      "2025-02-01T00:00:00Z",
    ),
    fixtureReading(
      "r-rej",
      "WBT-S1",
      "CML-03",
      "reject",
      "2025-03-01T00:00:00Z",
    ),
  ],
  indications: [],
  citationsUsed: [],
};

const EMPTY_RESULTS: EvaluationResults = {
  summary: { total: 0, locations: 0, accept: 0, reCheck: 0, fail: 0 },
  readings: [],
  indications: [],
  citationsUsed: [],
};

const METADATA: ComponentMetadata = {
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
};

function renderResults(results: EvaluationResults): string {
  const props: ScreenResultsContentProps = {
    results,
    units: { csvThickness: "mm", metadata: "mm" },
    sourceFilename: "ut_register_demo.csv",
    csvRowCount: results.summary.total,
    evaluatedAt: "2026-09-27T14:32:00Z",
    metadata: METADATA,
    page: 1,
    onPageChange: () => {},
    onBackToMetadata: () => {},
    onSaveReview: () => {},
    onOpenReport: () => {},
    rows: [],
    mapping: {
      readingId: null,
      measuredThickness: null,
      measurementDate: null,
      tank: null,
      tInitial: null,
      tPrevious: null,
    },
    notes: "",
    indications: [],
  };
  return renderToStaticMarkup(createElement(ScreenResultsContent, props));
}

describe("Screen 3 Visual Inspection Analytics panel (VIS-03)", () => {
  it("renders the panel above the findings controls with all three analytics", () => {
    const markup = renderResults(MIXED_RESULTS);
    const panelIdx = markup.indexOf('data-testid="visual-analytics-panel"');
    const controlsIdx = markup.indexOf('aria-label="Findings controls"');
    expect(panelIdx).toBeGreaterThan(-1);
    expect(controlsIdx).toBeGreaterThan(panelIdx);

    // All three components mount inside the expanded panel (default open):
    // heatmap aria-label with the REAL evaluated count (one item per CML),
    // trend SVG with the governing history, gauge with the margin label.
    const panel = markup.slice(panelIdx, controlsIdx);
    expect(panel).toContain("Visual Inspection Analytics");
    expect(panel).toContain("3 CML locations");
    expect(panel).toContain("Wall Loss Velocity &amp; Degradation Curve");
    expect(panel).toContain("Governing CML safety margin");
    // Governing CML is CML-03 (reject) — trend shows its dated history.
    expect(panel).toContain("t_req: ");
  });

  it("highlights the matching results-table row through the onSelect relay", () => {
    // SSR cannot click — pin the relay at both ends:
    // (a) the table contract: relaying a highlightedCmlId renders the hook
    // testid + secondary tone on ONLY the matching CML's rows.
    const tableMarkup = renderToStaticMarkup(
      createElement(ResultsTable, {
        readings: MIXED_RESULTS.readings,
        page: 1,
        onPageChange: () => {},
        highlightedCmlId: "CML-03",
      }),
    );
    expect(tableMarkup).toContain(`data-testid="${ROW_HIGHLIGHTED_TESTID}"`);
    expect(tableMarkup).toContain("bg-secondary");
    const highlightedCount = tableMarkup.split(ROW_HIGHLIGHTED_TESTID).length - 1;
    expect(highlightedCount).toBe(1);

    // (b) the host wiring: the panel's onSelect drives the table prop (source
    // scan — the state→prop seam the SSR harness cannot exercise).
    const host = readFileSync(
      resolve(__dirname, "../../components/wizard/screen-results.tsx"),
      "utf8",
    );
    expect(host).toContain("onSelectCml={setSelectedCmlId}");
    expect(host).toContain("highlightedCmlId={selectedCmlId}");

    // Unhighlighted default keeps the locked bg-background token contract
    // (flowstep-restyle pins `z-10 bg-background`).
    const plainTable = renderToStaticMarkup(
      createElement(ResultsTable, {
        readings: MIXED_RESULTS.readings,
        page: 1,
        onPageChange: () => {},
      }),
    );
    expect(plainTable).not.toContain(`data-testid="${ROW_HIGHLIGHTED_TESTID}"`);
    expect(plainTable).toContain("z-10 bg-background");
  });

  it("renders the friendly empty state for zero evaluated readings", () => {
    const markup = renderResults(EMPTY_RESULTS);
    expect(markup).toContain('data-testid="visual-analytics-panel"');
    expect(markup).toContain('data-testid="visual-analytics-empty"');
    expect(markup).toContain("No evaluated CML locations to visualize");
    // Never an empty SVG shell for the heatmap.
    expect(markup).not.toContain('aria-label="Spatial severity heatmap');
  });
});
