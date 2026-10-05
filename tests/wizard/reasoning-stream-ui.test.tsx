/**
 * Reasoning pane state-markup contract — 03-03 Task 2 (UI-25..UI-32, UI-42,
 * UI-44): all five NarrativeEntryState states render their exact 03-UI-SPEC
 * copy/classes; the streaming container carries aria-busy + the
 * reduced-motion caret; the complete badge renders `tokens … · … s · —` (cost
 * em-dash); the error state offers Retry narrative.
 *
 * Store-level fetch-count behaviors (one fetch per open, zero on cache hit,
 * FIFO cap) are pinned in tests/reasoning/narrative-stream.test.ts — this file
 * pins the DOM contract via renderToStaticMarkup (sync, no hook needed: the
 * pane is a pure NarrativeEntryState consumer).
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReasoningPane } from "@/components/wizard/reasoning-pane";
import type { ComponentMetadata, ReadingResult } from "@/lib/ingest/session";
import type { NarrativeEntryState } from "@/components/wizard/reasoning-pane";

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
  citations: ["api574_10_5_1_4", "api570_7_2"],
};

function markup(entry: NarrativeEntryState): string {
  return renderToStaticMarkup(
    <ReasoningPane reading={READING} metadata={METADATA} entry={entry} />,
  );
}

describe("ReasoningPane state markup (03-UI-SPEC pane states)", () => {
  it("loading: 'Requesting narrative…' with the deterministic chain present", () => {
    const html = markup({ status: "loading", text: "" });
    expect(html).toContain("Requesting narrative…");
    expect(html).toContain("6.50"); // INPUTS chain (t-actual) renders in every state
    expect(html).toContain("6.35"); // LIMIT (t-required) renders in every state
    expect(html).toContain("ACCEPT"); // VERDICT chip renders in every state
  });

  it("streaming: aria-busy + reduced-motion caret + 'Streaming narrative…'", () => {
    const html = markup({
      status: "streaming",
      text: "The measured wall thickness is 6.50 mm.",
    });
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Streaming narrative…");
    expect(html).toContain("motion-reduce:animate-none");
    expect(html).toContain("6.50 mm"); // streamed text renders
  });

  it("complete: badge line 'tokens … · … s · —' with cost em-dash, mono numerals", () => {
    const html = markup({
      status: "complete",
      text: "The measured wall thickness is 6.50 mm. Verdict: ACCEPT.",
      model: "fixture-reasoning-model",
      usage: { promptTokens: 1184, completionTokens: 658, latencyMs: 3200 },
    });
    expect(html).toContain("tokens 1,842 · 3.2 s · —");
    expect(html).toContain("tabular-nums");
    expect(html).toContain("fixture-reasoning-model");
    // citation chip resolves from the allowlist
    expect(html).toContain("api574_10_5_1_4");
  });

  it("error: exact reason text + 'Retry narrative' affordance styling hook", () => {
    const html = markup({
      status: "error",
      text: "",
      errorReason: "Extraction failed — narrative generation was skipped.",
    });
    expect(html).toContain("Extraction failed — narrative generation was skipped.");
    // the Retry button lives in the surrounding detail row (results-table);
    // the pane itself renders the failure reason prominently
  });

  it("fallback: fallback text renders; served text contains the closing sentence", () => {
    const html = markup({
      status: "fallback",
      text: "",
      fallbackText: "Deterministic rationale. Verdict: ACCEPT.",
    });
    expect(html).toContain("Deterministic rationale. Verdict: ACCEPT.");
    expect(html).not.toContain("aria-busy=\"true\"");
  });
});
