/**
 * Screen 3 CTA unlock + audit-writer seam — 04-01 Task 3 (UI-56, REPT-02).
 * SSR markup via renderToStaticMarkup (no router needed — the prop is
 * injected); the audit mapping is pinned through lib/report/audit's
 * buildAuditSteps directly (disabled mode → null telemetry, never fabricated).
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ScreenResultsContent } from "@/components/wizard/screen-results";
import { buildAuditSteps } from "@/lib/report/audit";
import type {
  ComponentMetadata,
  EvaluationResults,
  ParsedRow,
  PtmIndicationResult,
  ReadingResult,
  TargetField,
} from "@/lib/ingest/session";

const METADATA: ComponentMetadata = {
  od: 219.1,
  tNominal: 10.31,
  fca: 1,
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

const READING: ReadingResult = {
  readingId: "r-1",
  location: "North header",
  cml: "CML-01",
  date: "2025-01-15T00:00:00Z",
  tActualMm: 6.5,
  tPressureMm: 4.2,
  tStructuralMm: 6.35,
  tRequiredMm: 6.35,
  crLtMmYr: 0.3,
  crStMmYr: 0.25,
  rawCrLtMmYr: 0.3,
  rawCrStMmYr: 0.25,
  crGoverningMmYr: 0.3,
  rlYears: 12.4,
  nextInspection: { date: "2030-01-15", intervalYears: 5 },
  flags: [],
  verdict: "accept",
  citations: ["api574_10_5_1_4"],
};

const RESULTS: EvaluationResults = {
  readings: [READING],
  indications: [] as PtmIndicationResult[],
  summary: { total: 1, locations: 1, accept: 1, reCheck: 0, fail: 0 },
  citationsUsed: ["api574_10_5_1_4"],
};

const MAPPING: Record<TargetField, string | null> = {
  readingId: "Reading_ID",
  measuredThickness: "Measured_Thickness_mm",
  measurementDate: "Measurement_Date",
  tank: "Tank",
  tInitial: null,
  tPrevious: null,
};

function render(): string {
  return renderToStaticMarkup(
    createElement(ScreenResultsContent, {
      results: RESULTS,
      units: { csvThickness: "mm", metadata: "mm" },
      sourceFilename: "sample.csv",
      csvRowCount: 1,
      evaluatedAt: "2026-10-05T00:00:00Z",
      metadata: METADATA,
      page: 1,
      onPageChange: () => {},
      onBackToMetadata: () => {},
      onSaveReview: () => {},
      onOpenReport: () => {},
      rows: [] as ParsedRow[],
      mapping: MAPPING,
      notes: "",
      indications: [],
    }),
  );
}

describe("Screen 3 CTA unlock (UI-56)", () => {
  it("renders an ENABLED Open report preview button — no disabled/aria-disabled/hint", () => {
    const html = render();
    expect(html).toContain("Open report preview");
    expect(html).not.toContain('aria-disabled="true"');
    expect(html).not.toContain("report-preview-hint");
    expect(html).not.toContain("Report generation unlocks in Phase 4");
    // the Button component renders a <button> (enabled: no disabled attr)
    const btnIdx = html.indexOf("Open report preview");
    const buttonOpen = html.lastIndexOf("<button", btnIdx);
    const buttonTag = html.slice(buttonOpen, btnIdx);
    // Tailwind "disabled:" utility classes are always present; assert the
    // ATTRIBUTE is absent (React renders disabled="" when true).
    expect(buttonTag).not.toContain('disabled=""');
    expect(buttonTag).not.toContain('aria-disabled');
  });
});

describe("audit mapping seam (REPT-02, disabled-mode honesty)", () => {
  it("disabled extraction/narrative telemetry maps to null fields — never fabricated", () => {
    const steps = buildAuditSteps(null, null);
    expect(steps).toHaveLength(2);
    expect(steps[0].step).toBe("extraction");
    expect(steps[0].model).toBeNull();
    expect(steps[0].promptTokens).toBeNull();
    expect(steps[1].step).toBe("narrative");
    expect(steps[1].model).toBeNull();
    expect(steps[1].latencyMs).toBeNull();
  });

  it("complete telemetry maps through with the runtime-resolved model", () => {
    const steps = buildAuditSteps(
      { promptTokens: 790, completionTokens: 550, latencyMs: 3448, model: "fixture-model" },
      { promptTokens: 1436, completionTokens: 900, latencyMs: 3200, model: "fixture-reasoning" },
    );
    expect(steps[0].model).toBe("fixture-model");
    expect(steps[0].promptTokens).toBe(790);
    expect(steps[1].model).toBe("fixture-reasoning");
    expect(steps[1].completionTokens).toBe(900);
  });
});
