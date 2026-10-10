/**
 * 06-02 Task 1 — the Screen 3 "What we found" brief mount (REPT-04) and the
 * verdict-glossary footer (REPT-06). SSR markup checks via the ScreenResults
 * render harness (createElement + renderToStaticMarkup — the flowstep-restyle
 * pattern): the brief renders the 06-01 builder output VERBATIM below the
 * hero card and above the KPI cards (UI-6.1/UI-6.2), carries ZERO [[cite:
 * tokens (UI-6.3), renders no worst-list on all-accept sessions (UI-6.6),
 * and the glossary footer renders three real-text entries with
 * citationRef-composed mono clause sub-lines in ACCEPT/RE-CHECK/FAIL order
 * beneath the results table (UI-6.10). The source-scan assertion completes
 * the three-renderer import graph started in 06-01's findings-brief.test.ts:
 * screen-results.tsx imports VERDICT_GLOSSARY from the content seam — one
 * constant, three renderers (Screen 3 footer + HTML report + PDF), zero drift.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ScreenResultsContent,
  type ScreenResultsContentProps,
} from "@/components/wizard/screen-results";
import type {
  ComponentMetadata,
  EvaluationResults,
  ReadingResult,
  Verdict,
} from "@/lib/ingest/session";

/** Full ReadingResult fixture — same shape as the flowstep-restyle fixture. */
function fixtureReading(
  readingId: string,
  location: string,
  cml: string,
  verdict: Verdict,
  flags: ReadingResult["flags"],
  rlYears: number | null,
): ReadingResult {
  return {
    readingId,
    location,
    cml,
    date: "2025-01-15T00:00:00Z",
    tActualMm: 9.2,
    tPressureMm: 4.2,
    tStructuralMm: 6.1,
    tRequiredMm: 6.1,
    crLtMmYr: 0.03,
    crStMmYr: null,
    rawCrLtMmYr: 0.03,
    rawCrStMmYr: null,
    crGoverningMmYr: 0.03,
    rlYears,
    nextInspection: rlYears === null ? null : { date: "2030-01-15", intervalYears: 5 },
    flags,
    verdict,
    citations: [],
  };
}

/**
 * Mixed fixture — summary counts CONSISTENT with the readings (1 accept,
 * 1 re-check, 1 fail) so the brief's canonical mixed case renders from real
 * engine-shaped data: the fail names inline (fail <= 3), the immediate
 * reading leads the worst list, the null-RL re-check lands last.
 */
const MIXED_RESULTS: EvaluationResults = {
  summary: { total: 3, locations: 3, accept: 1, reCheck: 1, fail: 1 },
  readings: [
    fixtureReading("r-acc", "WBT-P1", "CML-01", "accept", [], 35.4),
    fixtureReading("r-rec", "WBT-P2", "CML-02", "re_check", ["insufficient_history"], null),
    fixtureReading("r-rej", "WBT-S1", "CML-03", "reject", ["immediate_inspection"], 0),
  ],
  indications: [],
  citationsUsed: [],
};

const ALL_ACCEPT_RESULTS: EvaluationResults = {
  summary: { total: 2, locations: 2, accept: 2, reCheck: 0, fail: 0 },
  readings: [
    fixtureReading("a-1", "WBT-P1", "CML-01", "accept", [], 35.4),
    fixtureReading("a-2", "WBT-P2", "CML-02", "accept", [], 40.2),
  ],
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

describe("Screen 3 What-we-found brief (REPT-04 / UI-6.1..UI-6.3)", () => {
  it("renders the labelled section BETWEEN the hero card and the Finding metrics section", () => {
    const markup = renderResults(MIXED_RESULTS);
    const heroIdx = markup.indexOf("Your findings are ready");
    const briefIdx = markup.indexOf('aria-label="What we found"');
    const kpiIdx = markup.indexOf('aria-label="Finding metrics"');
    expect(heroIdx).toBeGreaterThan(-1);
    expect(briefIdx).toBeGreaterThan(heroIdx);
    expect(kpiIdx).toBeGreaterThan(briefIdx);
  });

  it("renders the four locked blocks in DOM order from the builder output", () => {
    const markup = renderResults(MIXED_RESULTS);
    const section = markup.slice(
      markup.indexOf('aria-label="What we found"'),
      markup.indexOf('aria-label="Finding metrics"'),
    );
    // Disposition (fail <= 3 → inline naming), next-action, narrative.
    expect(section).toContain(
      "1 of 3 readings failed — immediate inspection required at CML-03.",
    );
    expect(section).toContain(
      "Next action: re-measure the failing locations and disposition them against the code before continued service.",
    );
    expect(section).toContain(
      "1 readings are ACCEPT — wall thickness meets the code minimum.",
    );
    expect(section).toContain(
      "1 are RE-CHECK — thickness is close to the limit and must be confirmed.",
    );
    expect(section).toContain(
      "1 are FAIL — wall is thinner than the code allows.",
    );
    // Locked order inside the section: disposition -> next action -> narrative.
    const dispositionIdx = section.indexOf("readings failed");
    const nextActionIdx = section.indexOf("Next action:");
    const narrativeIdx = section.indexOf("are ACCEPT");
    expect(dispositionIdx).toBeLessThan(nextActionIdx);
    expect(nextActionIdx).toBeLessThan(narrativeIdx);
  });

  it("renders the worst-list rows in the builder's locked order: name + chip text + why", () => {
    const markup = renderResults(MIXED_RESULTS);
    const section = markup.slice(
      markup.indexOf('aria-label="What we found"'),
      markup.indexOf('aria-label="Finding metrics"'),
    );
    // Immediate-inspection FAIL first (why string from the locked derivation),
    // then the insufficient-history RE-CHECK (null RL last).
    const failIdx = section.indexOf("CML-03");
    const recheckIdx = section.indexOf("CML-02");
    expect(failIdx).toBeGreaterThan(-1);
    expect(recheckIdx).toBeGreaterThan(failIdx);
    expect(section).toContain("No safe service life remaining");
    expect(section).toContain("Not enough survey history to compute remaining life");
    // Chip strings are the repo-protected labels — rendered as chips.
    expect(section).toContain("FAIL");
    expect(section).toContain("RE-CHECK");
    // The name row carries the truncate + full-name title contract.
    expect(section).toContain('title="CML-03"');
  });

  it("carries ZERO [[cite: tokens in the brief body (UI-6.3)", () => {
    const markup = renderResults(MIXED_RESULTS);
    const section = markup.slice(
      markup.indexOf('aria-label="What we found"'),
      markup.indexOf('aria-label="Finding metrics"'),
    );
    expect(section).not.toContain("[[cite:");
  });

  it("renders no worst-list (no <ul>, no placeholder) on an all-accept fixture", () => {
    const markup = renderResults(ALL_ACCEPT_RESULTS);
    const section = markup.slice(
      markup.indexOf('aria-label="What we found"'),
      markup.indexOf('aria-label="Finding metrics"'),
    );
    expect(section).toContain("All 2 readings meet the code minimum.");
    expect(section).not.toContain("<ul");
    expect(section).toContain("Next action: continue the established inspection interval");
  });
});

describe("Screen 3 verdict-glossary footer (REPT-06 / UI-6.9/UI-6.10)", () => {
  it("renders three real-text entries with non-empty mono clause sub-lines in ACCEPT/RE-CHECK/FAIL order", () => {
    const markup = renderResults(MIXED_RESULTS);
    expect(markup).toContain('aria-label="Verdict glossary"');
    // Locked plain sentences (verbatim from the shared constant).
    expect(markup).toContain("Wall thickness meets the code minimum at this location.");
    expect(markup).toContain(
      "Thickness is close to the limit — re-measure to confirm before deciding.",
    );
    expect(markup).toContain(
      "Wall is thinner than the code allows at this location. Action required.",
    );
    // Clause sub-lines composed ONLY via citationRef — mono text, non-empty.
    expect(markup).toContain("API 574 §10.5.1.4");
    expect(markup).toContain("API 570 §7.1.2");
    expect(markup).toContain("API 570 §7.6");
    // Order: ACCEPT before RE-CHECK before FAIL.
    const acceptIdx = markup.indexOf(">ACCEPT<");
    const recheckIdx = markup.indexOf(">RE-CHECK<", acceptIdx);
    const failIdx = markup.indexOf(">FAIL<", recheckIdx);
    expect(acceptIdx).toBeGreaterThan(-1);
    expect(recheckIdx).toBeGreaterThan(acceptIdx);
    expect(failIdx).toBeGreaterThan(recheckIdx);
  });

  it("sits beneath the results table and above the mono unit/source footnotes", () => {
    const markup = renderResults(MIXED_RESULTS);
    const glossaryIdx = markup.indexOf('aria-label="Verdict glossary"');
    const tableIdx = markup.indexOf("CML / Location");
    const footnotesIdx = markup.indexOf("Units: CSV thickness in");
    expect(glossaryIdx).toBeGreaterThan(tableIdx);
    expect(glossaryIdx).toBeLessThan(footnotesIdx);
  });

  it("renders the glossary on the zero-results empty-state path too", () => {
    // readings: [] -> the visibleReadings guard renders the empty-state copy
    // while the footer still renders beneath it (renders in BOTH cases).
    const markup = renderResults({
      summary: { total: 0, locations: 0, accept: 0, reCheck: 0, fail: 0 },
      readings: [],
      indications: [],
      citationsUsed: [],
    });
    expect(markup).toContain("No readings match the current filters.");
    expect(markup).toContain('aria-label="Verdict glossary"');
  });
});

describe("import-graph assertion — one glossary constant, three renderers", () => {
  it("components/wizard/screen-results.tsx imports VERDICT_GLOSSARY from the content seam", () => {
    const src = readFileSync(
      resolve(__dirname, "../../components/wizard/screen-results.tsx"),
      "utf8",
    );
    expect(src).toContain("VERDICT_GLOSSARY");
    expect(src).toContain('from "@/lib/report/content"');
    // The brief component consumes the builder from the same seam — never a
    // second copy source.
    const briefSrc = readFileSync(
      resolve(__dirname, "../../components/wizard/findings-brief.tsx"),
      "utf8",
    );
    expect(briefSrc).toContain("buildFindingsBrief");
    expect(briefSrc).toContain('from "@/lib/report/content"');
    // T-06-02-02: no narrative-store / telemetry / Date.now import reaches the
    // brief — engine facts only (UI-6.26).
    expect(briefSrc).not.toContain("reasoning-context");
    expect(briefSrc).not.toContain("useSyncExternalStore");
    expect(briefSrc).not.toContain("Date.now");
  });
});
