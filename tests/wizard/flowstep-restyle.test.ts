/**
 * Flowstep visual contract pins — FS-01..FS-11 (03-00 + 03-00b; 03-00b Task 2
 * completes the sweep to FS-12; 03-05 sweeps the ids). SSR markup checks via
 * react-dom/server: the redesigned chrome (header, 4-step indicator with the
 * locked Report step), Screen 1's reassurance/provenance/25 MB copy and
 * preserved affordances, Screen 2's hero chips, SIX mapping targets, the
 * three uppercase metadata section headers with the unit toggle and the
 * footer error/unmapped summary, and Screen 3's hero card + real-data KPI
 * cards, tabs/search/legend, sticky summary strip, sticky CML/Verdict
 * cluster, and the locked footer nav. Text contracts (verdict chips, aria
 * patterns, data-* hooks) are unchanged — these pins coexist with them.
 */
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "@/app/page";
import { StepIndicator } from "@/components/wizard/step-indicator";
import { WizardProvider, useWizard } from "@/components/wizard/wizard-context";
import { ScreenReview } from "@/components/wizard/screen-review";
import { MetadataForm } from "@/components/wizard/metadata-form";
import { PtmtEntry } from "@/components/wizard/ptmt-entry";
import {
  ScreenResultsContent,
  needsAttention,
  filterReadings,
  FILTER_RESET_PAGE,
  type ResultsTab,
} from "@/components/wizard/screen-results";
import { ResultsTable } from "@/components/wizard/results-table";
import { SummaryStrip } from "@/components/wizard/summary-strip";
import { ReportDocument } from "@/components/report/report-document";
import { metadataProblems } from "@/lib/wizard/reducer";
import type {
  ComponentMetadata,
  EvaluationResults,
  ReadingResult,
  Verdict,
} from "@/lib/ingest/session";
import type { ReportSnapshot } from "@/lib/report/session-snapshot";

/** Mirrors page.tsx's Screen 2 composition (metadata + PT/MT children). */
function Screen2Harness() {
  const { state, dispatch } = useWizard();
  return createElement(
    ScreenReview,
    null,
    createElement(MetadataForm, {
      draft: state.ui.metadataDraft,
      metadataUnit: state.units.metadata,
      problems: metadataProblems(state.ui.metadataDraft),
      onField: (field, value) => dispatch({ type: "set-metadata-field", field, value }),
      onMetadataUnit: (unit) => dispatch({ type: "set-metadata-unit", unit }),
    }),
    createElement(PtmtEntry, {
      notes: state.ptmt.notes,
      indications: state.ptmt.indications,
      onNotes: (notes) => dispatch({ type: "set-ptmt-notes", notes }),
    }),
  );
}

function renderScreen2(): string {
  return renderToStaticMarkup(
    createElement(
      WizardProvider,
      null,
      createElement(Screen2Harness),
    ),
  );
}

function renderScreen1(): string {
  return renderToStaticMarkup(createElement(Home));
}

describe("FS-01 header chrome (shield + FlawCheck / NDT Inspection Copilot)", () => {
  it("renders the shield logo, brand, and copilot subtitle", () => {
    const markup = renderScreen1();
    expect(markup).toContain("FlawCheck");
    expect(markup).toContain("NDT Inspection Copilot");
    expect(markup).toContain("lucide-shield-check");
  });
});

describe("FS-02 4-step indicator with locked Report step (binding C4)", () => {
  it("renders all four steps with connected segments", () => {
    const markup = renderToStaticMarkup(createElement(StepIndicator, { current: 1 }));
    expect(markup).toContain("1 Ingest");
    expect(markup).toContain("2 Review &amp; Metadata");
    expect(markup).toContain("3 Results");
    expect(markup).toContain("4 Report");
    expect(markup).toContain("bg-border");
  });

  it("marks exactly the current step and never the locked Report step", () => {
    const markup = renderToStaticMarkup(createElement(StepIndicator, { current: 1 }));
    const currentCount = markup.match(/aria-current="step"/g)?.length ?? 0;
    expect(currentCount).toBe(1);
    const currentIdx = markup.indexOf('aria-current="step"');
    const currentSegment = markup.slice(
      Math.max(0, currentIdx - 200),
      currentIdx + 200,
    );
    expect(currentSegment).toContain("1 Ingest");

    const step3 = renderToStaticMarkup(createElement(StepIndicator, { current: 3 }));
    expect(step3.match(/aria-current="step"/g)?.length).toBe(1);
    const reportIdx = step3.indexOf("4 Report");
    // The 4 Report span itself (immediately preceding markup = its own open tag).
    expect(step3.slice(reportIdx - 60, reportIdx)).not.toContain("aria-current");
    expect(step3.slice(reportIdx - 60, reportIdx)).toContain("text-muted-foreground/60");
  });
});

describe("FS-03 Screen 1 reassurance row + provenance + 25 MB copy", () => {
  it("shows the dropzone copy, reassurances, and the Zenodo provenance line", () => {
    const markup = renderScreen1();
    expect(markup).toContain("Start with your inspection data");
    expect(markup).toContain("Drop your UT thickness CSV here");
    expect(markup).toContain("CSV up to 25 MB · Your file stays in this workspace");
    expect(markup).toContain("Secure workspace");
    expect(markup).toContain("Offline-ready evaluation");
    expect(markup).toContain("Sample data available");
    expect(markup).toContain(
      "Zenodo record 16780668 subset — 4,912 real readings. Runs offline.",
    );
  });
});

describe("FS-04 Screen 1 footer nav + preserved affordances", () => {
  it("keeps the demo loader, sample download, and format guide", () => {
    const markup = renderScreen1();
    expect(markup).toContain("Explore a sample inspection");
    expect(markup).toContain("Download sample CSV");
    expect(markup).toContain("View format guide");
    expect(markup).toContain('href="/sample-ut-register.csv"');
  });

  it("renders the footer Back / Continue nav with Back disabled at step 1", () => {
    const markup = renderScreen1();
    expect(markup).toContain("Back");
    expect(markup).toContain("Continue to review");
    const backIdx = markup.indexOf(">Back<");
    expect(markup.slice(backIdx - 200, backIdx)).toContain("disabled");
  });
});

describe("FS-05 Screen 2 hero card + status chips", () => {
  it("renders the hero heading, subheading, and readings chip", () => {
    const markup = renderScreen2();
    expect(markup).toContain("Review your inspection setup");
    expect(markup).toContain(
      "Everything looks ready for evaluation. Take a moment to confirm the highlighted assumptions.",
    );
    expect(markup).toContain("0 readings parsed");
  });
});

describe("FS-06 Screen 2 mapping panel keeps all SIX targets + CSV unit", () => {
  it("renders six mapping selects and the thickness unit select", () => {
    const markup = renderScreen2();
    expect(markup).toContain("Map CSV columns");
    for (const id of [
      "mapping-readingId",
      "mapping-measuredThickness",
      "mapping-measurementDate",
      "mapping-tInitial",
      "mapping-tPrevious",
      "mapping-tank",
    ]) {
      expect(markup).toContain(`id="${id}"`);
    }
    expect(markup).toContain('id="csv-thickness-unit"');
  });
});

describe("FS-07 Screen 2 metadata section headers + unit toggle + E/W/Y hint", () => {
  it("renders the three uppercase headers and the metadata unit toggle", () => {
    const markup = renderScreen2();
    expect(markup).toContain("COMPONENT GEOMETRY");
    expect(markup).toContain("CLASSIFICATION");
    expect(markup).toContain("DESIGN CONDITIONS");
    expect(markup).toContain("Metadata unit — applies to all numeric metadata fields");
    expect(markup).toContain("Ferritic steel ≤ 482°C per ASME B31.3 Table 304.1.1");
  });
});

describe("FS-08 Screen 2 footer: back nav / step status / blocker summary / run", () => {
  it("renders the footer nav pieces with the live blocker summary", () => {
    const markup = renderScreen2();
    expect(markup).toContain("Back to ingest");
    expect(markup).toContain(
      "Step 2 of 4 · Review complete when required fields are resolved",
    );
    // The live blocker summary (default state: required fields unresolved).
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("3 unmapped columns");
    expect(markup).toContain("Run evaluation");
  });
});

describe("tokenized chrome", () => {
  it("resolves the verdict token classes in the compiled CSS contract", () => {
    // The @theme inline mappings must expose accept/recheck/fail so verdict
    // chip classes resolve; pinned here via the CSS source contract.
    const fs = require("node:fs");
    const path = require("node:path");
    const css = fs.readFileSync(
      path.resolve(__dirname, "../../app/globals.css"),
      "utf8",
    );
    expect(css).toContain("--color-accept: var(--accept)");
    expect(css).toContain("--color-recheck: var(--recheck)");
    expect(css).toContain("--color-fail: var(--fail)");
    expect(css).toContain('oklch(0.646 0.222 41.116)'); // dark primary
    expect(css).not.toContain("scrollbar-width: none"); // sticky-column contract
  });
});

/**
 * 03-00b Task 1 Screen 3 fixture — hand-built EvaluationResults whose summary
 * counts deliberately differ from BOTH the demo session's golden counts and
 * the mock's placeholder numbers (3,812 / 876 / 224 / 42), so the FS-09 pin
 * proves the KPI cards render whatever summary they are FED, never a mock.
 */
function fixtureReading(
  readingId: string,
  location: string,
  cml: string,
  verdict: Verdict,
  flags: ReadingResult["flags"],
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
    rlYears: 35.4,
    nextInspection: { date: "2030-01-15", intervalYears: 5 },
    flags,
    verdict,
    citations: [],
  };
}

const FIXTURE_READINGS: ReadingResult[] = [
  fixtureReading("r-acc", "WBT-P1", "CML-01", "accept", []),
  fixtureReading("r-rec", "WBT-P2", "CML-02", "re_check", ["outlier"]),
  fixtureReading("r-rej", "WBT-S1", "CML-03", "reject", []),
];

const FIXTURE_RESULTS: EvaluationResults = {
  summary: { total: 1312, locations: 37, accept: 1204, reCheck: 87, fail: 21 },
  readings: FIXTURE_READINGS,
  indications: [],
  citationsUsed: [],
};

function renderResults(): string {
  return renderToStaticMarkup(
    createElement(ScreenResultsContent, {
      results: FIXTURE_RESULTS,
      units: { csvThickness: "mm", metadata: "mm" },
      sourceFilename: "ut_register_demo.csv",
      csvRowCount: 1312,
      evaluatedAt: "2026-09-27T14:32:00Z",
      metadata: SWEEP_METADATA,
      page: 1,
      onPageChange: () => {},
      onBackToMetadata: () => {},
      onSaveReview: () => {},
    }),
  );
}

/** Minimal accept-only snapshot for the FS-01..FS-12 sweep's FS-12 anchor. */
const SWEEP_METADATA: ComponentMetadata = {
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

const SWEEP_SNAPSHOT: ReportSnapshot = {
  evaluatedAt: "2026-09-27T14:32:00Z",
  sourceName: "ut_register_demo.csv",
  units: { csvThickness: "mm", metadata: "mm" },
  metadata: SWEEP_METADATA,
  summary: { total: 1, locations: 1, accept: 1, reCheck: 0, fail: 0 },
  readings: [FIXTURE_READINGS[0]],
  indications: [],
  notes: "",
};

describe("FS-09 Screen 3 hero card + 4 KPI stat cards fed by real summary counts", () => {
  it("renders the hero copy with the fixture's REAL total in the sub-line", () => {
    const markup = renderResults();
    expect(markup).toContain("Evaluation complete");
    expect(markup).toContain("Your findings are ready");
    expect(markup).toContain(
      "We&#x27;ve checked 1,312 readings and surfaced the items that deserve a closer look.",
    );
  });

  it("renders the four KPI cards from results.summary — never the mock placeholder numbers", () => {
    const markup = renderResults();
    expect(markup).toContain("Accepted");
    expect(markup).toContain("Re-check");
    expect(markup).toContain("Fail");
    expect(markup).toContain("Locations");
    // Real fixture counts (toLocaleString("en-US")).
    expect(markup).toContain("1,204"); // accept
    expect(markup).toContain("87"); // reCheck
    expect(markup).toContain("21"); // fail
    expect(markup).toContain("37"); // locations
    // The mock's placeholder numbers are data — they must never render.
    for (const mockNumber of ["3,812", "876", "224", "4,912"]) {
      expect(markup).not.toContain(mockNumber);
    }
  });
});

describe("FS-10 Screen 3 tabs + CML search + legend + sticky summary strip", () => {
  it("renders the tab group, search input, and verdict legend", () => {
    const markup = renderResults();
    expect(markup).toContain("All findings");
    expect(markup).toContain("Needs attention");
    expect(markup).toContain('aria-label="Search CML or location"');
    expect(markup).toContain('placeholder="Search CML or location"');
    expect(markup).toContain("● Accepted");
    expect(markup).toContain("● Re-check");
    expect(markup).toContain("● Fail");
  });

  it("sticky summary strip renders REAL counts with the read-only note on an opaque background", () => {
    const markup = renderToStaticMarkup(
      createElement(SummaryStrip, { summary: FIXTURE_RESULTS.summary }),
    );
    expect(markup).toContain("1,312 readings · 37 locations");
    expect(markup).toContain("1,204 ACCEPT");
    expect(markup).toContain("87 RE-CHECK");
    expect(markup).toContain("21 FAIL");
    expect(markup).toContain("Read-only evaluation results");
    expect(markup).toContain("sticky top-0");
    expect(markup).toContain("bg-card"); // opaque token background
  });

  it("'Needs attention' filters to re_check/reject verdicts OR any flag", () => {
    expect(FIXTURE_READINGS.filter(needsAttention).map((r) => r.readingId)).toEqual([
      "r-rec",
      "r-rej",
    ]);
  });

  it("tab + search compose (CML id or location, case-insensitive) and every filter change resets the page", () => {
    expect(filterReadings(FIXTURE_READINGS, "attention", "cml-02").map((r) => r.readingId)).toEqual([
      "r-rec",
    ]);
    expect(filterReadings(FIXTURE_READINGS, "all", "WBT-S1").map((r) => r.readingId)).toEqual([
      "r-rej",
    ]);
    expect(filterReadings(FIXTURE_READINGS, "all", "")).toHaveLength(3);
    // Pagination reset contract — the tab/search handlers dispatch this page.
    expect(FILTER_RESET_PAGE).toBe(1);
  });
});

describe("FS-10b sticky CML + Verdict cluster (binding C1/C3) inside the overflow wrapper", () => {
  it("first column pins left, last pins right, both with opaque token backgrounds", () => {
    const markup = renderToStaticMarkup(
      createElement(ResultsTable, {
        readings: FIXTURE_READINGS,
        page: 1,
        onPageChange: () => {},
      }),
    );
    expect(markup).toContain("overflow-x-auto"); // 03-01's load-bearing wrapper
    expect(markup).toContain("sticky left-0");
    expect(markup).toContain("sticky right-0");
    expect(markup).toContain("z-30 bg-card"); // thead sticky cells — opaque
    expect(markup).toContain("z-10 bg-background"); // tbody sticky cells — opaque
  });

  it("keeps the locked 10-column order and the sticky cells in the first/last positions", () => {
    const markup = renderToStaticMarkup(
      createElement(ResultsTable, {
        readings: FIXTURE_READINGS,
        page: 1,
        onPageChange: () => {},
      }),
    );
    const headers = [
      "CML / Location",
      "t-actual (mm)",
      "t-required (mm)",
      "CR_LT (mm/yr)",
      "CR_ST (mm/yr)",
      "CR governing (mm/yr)",
      "RL (yr)",
      "Next inspection",
      "Flags",
      "Verdict",
    ];
    let last = -1;
    for (const header of headers) {
      const idx = markup.indexOf(`>${header}<`);
      expect(idx).toBeGreaterThan(last);
      last = idx;
    }
    const firstTh = markup.indexOf('scope="col"');
    expect(markup.slice(firstTh, firstTh + 300)).toContain("sticky left-0");
    const lastTh = markup.lastIndexOf('scope="col"');
    expect(markup.slice(lastTh, lastTh + 300)).toContain("sticky right-0");
  });
});

describe("FS-11 Screen 3 footer: back nav / Save review / Open report preview disabled", () => {
  it("renders all three actions with Open report preview carrying aria-disabled='true' (locked decision)", () => {
    const markup = renderResults();
    expect(markup).toContain("Back to metadata");
    expect(markup).toContain("Save review");
    const previewIdx = markup.indexOf("Open report preview");
    expect(previewIdx).toBeGreaterThan(-1);
    const buttonTag = markup.slice(Math.max(0, previewIdx - 400), previewIdx);
    expect(buttonTag).toContain("disabled");
    expect(buttonTag).toContain('aria-disabled="true"');
    // Accessible hint for the gated affordance.
    expect(markup).toContain("Report generation unlocks in Phase 4");
  });
});

/**
 * FS-01..FS-12 full-contract sweep (03-00b Task 2) — the named test 03-05
 * cites: one anchor assertion per visual-contract row across the finished
 * surfaces (chrome, Screen 1-3, /report). Detailed pins live in the
 * per-screen describes above; the report-preview suite pins FS-12 in depth.
 */
describe("FS-01..FS-12 full-contract sweep (03-05 cites this)", () => {
  it("anchors all twelve visual-contract rows on the completed screens", () => {
    const screen1 = renderScreen1();
    // FS-01 header chrome
    expect(screen1).toContain("FlawCheck");
    expect(screen1).toContain("lucide-shield-check");
    // FS-03 Screen 1 copy
    expect(screen1).toContain("CSV up to 25 MB · Your file stays in this workspace");
    // FS-04 Screen 1 footer affordances
    expect(screen1).toContain("Explore a sample inspection");

    const screen2 = renderScreen2();
    // FS-05 Screen 2 hero + chips
    expect(screen2).toContain("Review your inspection setup");
    // FS-06 six mapping targets
    expect(screen2).toContain('id="mapping-measuredThickness"');
    // FS-07 metadata section headers + unit toggle
    expect(screen2).toContain("COMPONENT GEOMETRY");
    // FS-08 Screen 2 footer + run
    expect(screen2).toContain("Run evaluation");

    // FS-02 4-step indicator with the locked Report step
    const step3 = renderToStaticMarkup(createElement(StepIndicator, { current: 3 }));
    expect(step3).toContain("4 Report");
    expect(step3.match(/aria-current="step"/g)?.length).toBe(1);

    const screen3 = renderResults();
    // FS-09 real-data KPI cards (fixture counts, never mock numbers)
    expect(screen3).toContain("1,204");
    expect(screen3).not.toContain("3,812");
    // FS-10 tabs + search + legend + sticky strip
    expect(screen3).toContain('aria-label="Search CML or location"');
    // FS-11 footer with disabled Open report preview
    expect(screen3).toContain('aria-disabled="true"');

    // FS-12 locked /report preview (depth pins: tests/report/report-preview.test.ts)
    const reportMarkup = renderToStaticMarkup(
      createElement(ReportDocument, { snapshot: SWEEP_SNAPSHOT, generatedAt: "2026-09-27T09:00:00Z" }),
    );
    expect(reportMarkup).toContain("Pending inspector sign-off");
    expect(reportMarkup).toContain("Download PDF");
    expect(reportMarkup.slice(Math.max(0, reportMarkup.indexOf("Download PDF") - 300), reportMarkup.indexOf("Download PDF"))).toContain("disabled");
    expect(reportMarkup).toContain('data-appearance="light"');
  });
});
