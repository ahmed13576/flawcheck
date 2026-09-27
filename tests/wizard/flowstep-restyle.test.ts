/**
 * Flowstep visual contract pins — FS-01..FS-08 (03-00; 03-00b extends to
 * FS-09..FS-12; 03-05 sweeps the ids). SSR markup checks via
 * react-dom/server: the redesigned chrome (header, 4-step indicator with the
 * locked Report step), Screen 1's reassurance/provenance/25 MB copy and
 * preserved affordances, and Screen 2's hero chips, SIX mapping targets, the
 * three uppercase metadata section headers with the unit toggle, and the
 * footer error/unmapped summary. Text contracts (verdict chips, aria
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
import { metadataProblems } from "@/lib/wizard/reducer";

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
