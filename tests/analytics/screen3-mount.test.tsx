/**
 * VIS-03 Screen 3 analytics mount (master-native — replaces Fork B's
 * screen3-mount.test.tsx which imports the fork's redesigned hosts).
 *
 * Pins: the panel renders with readings; the heatmap onSelect relay
 * highlights exactly the matching results-table rows (identity
 * `cml ?? location`); empty readings render the empty state.
 */
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ScreenResultsContent,
  ROW_HIGHLIGHTED_TESTID,
} from "@/components/wizard/screen-results";
import { ResultsTable } from "@/components/wizard/results-table";
import type {
  ReadingResult,
  ComponentMetadata,
  ParsedRow,
  TargetField,
  PtmIndicationResult,
} from "@/lib/ingest/session";

function reading(over: Partial<ReadingResult> = {}): ReadingResult {
  return {
    readingId: "r-1",
    location: "WBT-S6",
    cml: "WBT-S6 / B2",
    date: "2022-05-14",
    tActualMm: 19.45,
    tPressureMm: 19.0,
    tStructuralMm: 19.5,
    tRequiredMm: 19.85,
    crLtMmYr: 0.305,
    crStMmYr: 0.305,
    crGoverningMmYr: 0.305,
    rlYears: 0,
    flags: ["immediate_inspection"],
    verdict: "reject",
    citations: [],
    ...over,
  } as ReadingResult;
}

const metadata: ComponentMetadata = {
  od: 2000,
  tNominal: 20,
  fca: 0,
  tStructural: 19.5,
  designCode: "ASME B31.3 — 2024 Edition",
  pipeClass: 2,
  gaugeUncertainty: 0.1,
  pressureUnit: "MPa",
  designPressure: 1.6,
  allowableStress: 138,
  e: 1,
  w: 1,
  y: 0.4,
  formula: "asme_b31_3_straight_pipe",
};

const baseProps = {
  units: { csvThickness: "mm" as const, metadata: "mm" as const },
  sourceFilename: "zenodo-test.csv",
  csvRowCount: 3,
  page: 1,
  onPageChange: () => {},
  onBackToMetadata: () => {},
  onSaveReview: () => {},
  onOpenReport: () => {},
  rows: [] as ParsedRow[],
  mapping: {
    readingId: "Reading_ID",
    measuredThickness: "Measured_Thickness_mm",
    measurementDate: "Measurement_Date",
    tInitial: null,
    tPrevious: null,
    tank: "Tank",
  } satisfies Record<TargetField, string | null>,
  notes: "",
  indications: [] as PtmIndicationResult[],
};

describe("VisualAnalyticsPanel mount (VIS-03)", () => {
  it("renders the analytics panel with a heatmap above the findings tabs", () => {
    const html = renderToStaticMarkup(
      createElement(ScreenResultsContent, {
        ...baseProps,
        results: {
          summary: { total: 3, accept: 0, reCheck: 0, fail: 3, locations: 1 },
          readings: [reading(), reading({ readingId: "r-2" }), reading({ readingId: "r-3" })],
          indications: [],
          citationsUsed: [],
        },
        evaluatedAt: "2026-10-21T00:00:00Z",
        metadata,
      }),
    );
    expect(html).toContain('data-testid="visual-analytics-panel"');
    expect(html).toContain("Visual Inspection Analytics");
    expect(html).toContain("Spatial CML Severity Heatmap");
  });

  it("renders the empty state when there are no readings", () => {
    const html = renderToStaticMarkup(
      createElement(ScreenResultsContent, {
        ...baseProps,
        results: {
          summary: { total: 0, accept: 0, reCheck: 0, fail: 0, locations: 0 },
          readings: [],
          indications: [],
          citationsUsed: [],
        },
        evaluatedAt: "2026-10-21T00:00:00Z",
        metadata,
      }),
    );
    expect(html).toContain('data-testid="visual-analytics-empty"');
    expect(html).not.toContain('data-testid="visual-analytics-panel"');
  });
});

describe("ResultsTable row highlight relay (VIS-03)", () => {
  const readings = [
    reading({ readingId: "r-a" }),
    reading({ readingId: "r-b", cml: "WBT-S6 / A1" }),
    reading({ readingId: "r-c" }),
  ];

  it("highlights exactly the rows matching the selected CML identity", () => {
    const html = renderToStaticMarkup(
      createElement(
        "table",
        null,
        createElement(ResultsTable, {
          readings,
          page: 1,
          onPageChange: () => {},
          highlightedCmlId: "WBT-S6 / B2",
        }),
      ),
    );
    const count = html.split(ROW_HIGHLIGHTED_TESTID).length - 1;
    expect(count).toBe(2); // r-a and r-c share identity WBT-S6 / B2
  });

  it("highlights nothing when the selection is null", () => {
    const html = renderToStaticMarkup(
      createElement(
        "table",
        null,
        createElement(ResultsTable, {
          readings,
          page: 1,
          onPageChange: () => {},
          highlightedCmlId: null,
        }),
      ),
    );
    expect(html).not.toContain(ROW_HIGHLIGHTED_TESTID);
  });
});
