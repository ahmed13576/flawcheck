/**
 * Deterministic fallback pins — 03-01 Task 1 (Pattern R4 contract):
 * every [[cite:id]] in the output is a member of the engine's own citation
 * set; the closing sentence is byte-exact; insufficient-history readings
 * quote no rate numerals; immediate-inspection readings name no date; the
 * indication variant cites only indication.citationId. Numbers appear only
 * through formatFixed — the strings Infinity/NaN can never appear.
 */
import { describe, it, expect } from "vitest";
import {
  fallbackNarrative,
  fallbackNarrativeForIndication,
  VERDICT_LABELS,
  FALLBACK_CLOSING_SENTENCE,
} from "@/lib/reasoning/fallback";
import { verdictLabel } from "@/components/wizard/verdict-chip";
import { formatFixed } from "@/lib/wizard/format";
import type {
  ComponentMetadata,
  PtmIndicationResult,
  ReadingResult,
  Verdict,
} from "@/lib/ingest/session";

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

function reading(verdict: Verdict, overrides: Partial<ReadingResult> = {}): ReadingResult {
  return {
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
    verdict,
    citations: ["api574_10_5_1_4", "api570_7_1_2_lt", "api570_7_1_2_st", "api570_7_1_2_governing", "api570_7_2"],
    ...overrides,
  };
}

function citedIds(text: string): string[] {
  return [...text.matchAll(/\[\[cite:([a-z0-9_]+)\]\]/g)].map((m) => m[1]);
}

describe("fallbackNarrative — citation discipline", () => {
  for (const verdict of ["accept", "re_check", "reject"] as const) {
    it(`cites only ids inside reading.citations (${verdict})`, () => {
      const r = reading(verdict);
      const text = fallbackNarrative(r, METADATA);
      const ids = citedIds(text);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        expect(r.citations).toContain(id);
      }
    });

    it(`ends with the exact locked closing sentence and chip-identical label (${verdict})`, () => {
      const text = fallbackNarrative(reading(verdict), METADATA);
      expect(text.endsWith(`Verdict: ${VERDICT_LABELS[verdict]}. ${FALLBACK_CLOSING_SENTENCE}`)).toBe(
        true,
      );
      expect(VERDICT_LABELS[verdict]).toBe(verdictLabel(verdict));
    });
  }

  it("drops a branch citation the engine did not emit for the reading", () => {
    // Reading without the structural citation: no api574 cite may appear even
    // though the id exists in the global allowlist.
    const r = reading("accept", { citations: ["api570_7_2"] });
    const text = fallbackNarrative(r, METADATA);
    expect(citedIds(text)).toEqual(["api570_7_2"]);
    expect(text).not.toContain("api574_10_5_1_4");
  });
});

describe("fallbackNarrative — data-conditioned assembly", () => {
  it("insufficient history: no rate numerals and no Infinity/NaN", () => {
    const r = reading("reject", {
      crLtMmYr: null,
      crStMmYr: null,
      rawCrLtMmYr: null,
      rawCrStMmYr: null,
      crGoverningMmYr: null,
      rlYears: null,
      nextInspection: null,
      citations: ["api574_10_5_1_4"],
    });
    const text = fallbackNarrative(r, METADATA);
    expect(text).toContain("insufficient");
    expect(text).not.toContain("mm/yr");
    expect(text).not.toContain("Infinity");
    expect(text).not.toContain("NaN");
  });

  it("immediate inspection: states the consequence, never a date or negative interval", () => {
    const r = reading("reject", {
      flags: ["immediate_inspection"],
      rlYears: 0,
      nextInspection: null,
    });
    const text = fallbackNarrative(r, METADATA);
    expect(text).toContain("immediate inspection");
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/); // no ISO date anywhere
    expect(text).not.toMatch(/-\d+(\.\d+)?\s*yr/); // no negative interval
  });

  it("renders thickness at 2dp and rates at 3dp via formatFixed (UI-27 byte-parity)", () => {
    const r = reading("re_check", { tActualMm: 6.4, crLtMmYr: 0.2996 });
    const text = fallbackNarrative(r, METADATA);
    expect(text).toContain(formatFixed(6.4, 2));
    expect(text).toContain(formatFixed(0.2996, 3));
    expect(text).toContain(
      formatFixed(r.tRequiredMm + METADATA.gaugeUncertainty, 2),
    );
    expect(text).toContain(formatFixed(METADATA.gaugeUncertainty, 2));
  });
});

describe("fallbackNarrativeForIndication", () => {
  const indication: PtmIndicationResult = {
    id: "ind-1",
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
  };

  it("cites only indication.citationId and restates dims, count, and the engine detail", () => {
    const text = fallbackNarrativeForIndication(indication, { thresholds: true });
    expect(citedIds(text)).toEqual(["asme_b31_3_344_3_2"]);
    expect(text).toContain("L 4.2 × W 0.8 mm");
    expect(text).toContain("(1 recorded)");
    expect(text).toContain(indication.detail);
    expect(text.endsWith(`Verdict: FAIL. ${FALLBACK_CLOSING_SENTENCE}`)).toBe(true);
  });
});
