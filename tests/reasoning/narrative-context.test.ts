import { describe, it, expect } from "vitest";
import { criteria } from "@/lib/calc/criteria";
import type { ComponentMetadata, PtmIndicationResult, ReadingResult } from "@/lib/ingest/session";
import { ExtractionResultSchema } from "@/lib/reasoning/schemas";
import {
  buildNarrativeContext,
  numericAllowlist,
  type NarrativeHistory,
} from "@/lib/reasoning/narrative-context";
import { EXTRACTION_SCHEMA_HINT } from "@/lib/reasoning/prompts";

/* Fixture chain values: tRequired 4.2 pins the A6 boundary (raw 4.19834 case
 * lives in the dedicated allowlist test below). readingId/location/date are
 * deliberately digit-bearing — the payload must NOT contain them (Pitfall 1/4:
 * quoted identifiers would trip the numeric lint). */
const reading: ReadingResult = {
  readingId: "R1",
  location: "CML-1",
  cml: "CML-1",
  date: "2025-01-15",
  tActualMm: 3.85,
  tPressureMm: 3.2,
  tStructuralMm: 2.5,
  tRequiredMm: 4.2,
  crLtMmYr: 0.03,
  crStMmYr: null,
  rawCrLtMmYr: 0.03,
  rawCrStMmYr: null,
  crGoverningMmYr: 0.03,
  rlYears: 12.3,
  nextInspection: { date: "2030-01-15", intervalYears: 5 },
  flags: [],
  verdict: "re_check",
  citations: ["api574_10_5_1_4", "api570_7_2"],
};

const metadata: ComponentMetadata = {
  od: 114.3,
  tNominal: 6.02,
  fca: 1,
  tStructural: 2.5,
  designCode: "ASME B31.3 — 2024 Edition",
  pipeClass: 1,
  gaugeUncertainty: 0.25,
  pressureUnit: "MPa",
  designPressure: 4,
  allowableStress: 138,
  e: 1,
  w: 1,
  y: 0.4,
  formula: "asme_b31_3_straight_pipe",
};

const extraction = {
  componentContext: { serviceDescription: "Carbon-steel line in cooling-water service." },
  notableFacts: ["Coating shows local breakdown near the support."],
  ptmtNotesSummary: { relevant: true, points: ["Surface cleaned before inspection."] },
  cautions: ["Crack-suspect findings escalate to Level 2/3 inspector."],
};

const history: NarrativeHistory = {
  tInitialMm: 9.5,
  tPreviousMm: 9.2,
  dtLtYears: 10,
  dtStYears: 10,
};

function build(overrides: Partial<Parameters<typeof buildNarrativeContext>[0]> = {}) {
  return buildNarrativeContext({
    kind: "cml",
    reading,
    metadata,
    extraction: null,
    history: null,
    thresholds: criteria.ptmt,
    ...overrides,
  });
}

describe("buildNarrativeContext", () => {
  it("formats the chain at table precision (t_required_mm at 2dp)", () => {
    const ctx = build();
    expect(ctx.payload).toContain('"t_required_mm": "4.20"');
    expect(ctx.payload).toContain('"t_actual_mm": "3.85"');
    expect(ctx.payload).toContain('"cr_lt_mm_yr": "0.030"');
    expect(ctx.payload).toContain('"rl_years": "12.3"');
    expect(ctx.payload).toContain('"verdict": "RE-CHECK"');
  });

  it("injects history values when present and omits null members", () => {
    const withHistory = build({ history });
    expect(withHistory.payload).toContain('"t_initial_mm": "9.50"');
    expect(withHistory.payload).toContain('"t_previous_mm": "9.20"');
    expect(withHistory.payload).toContain('"dt_lt_years": "10.0"');

    const partial = build({ history: { ...history, tPreviousMm: null, dtStYears: null } });
    expect(partial.payload).toContain('"t_initial_mm"');
    expect(partial.payload).not.toContain('"t_previous_mm"');
    expect(partial.payload).not.toContain('"dt_st_years"');
  });

  it("omits the history block entirely when history is null or all-null", () => {
    expect(build({ history: null }).payload).not.toContain("t_initial_mm");
    const allNull = build({
      history: { tInitialMm: null, tPreviousMm: null, dtLtYears: null, dtStYears: null },
    });
    expect(allNull.payload).not.toContain('"history"');
  });

  it("includes metadata numerics when metadata is provided", () => {
    const ctx = build();
    expect(ctx.payload).toContain('"gauge_uncertainty_mm": "0.25"');
    expect(ctx.payload).toContain('"allowable_stress": "138.00"');
    expect(ctx.payload).toContain('"pressure_unit": "MPa"');
  });

  it("CR-03: converts a declared-unit gauge uncertainty to mm in payload AND allowlist", () => {
    // metadataUnit "in" with uncertainty 0.25 → 6.35 mm canonical; the raw
    // declared-unit value must never be registered (the numeric lint would
    // then approve the model quoting the mislabeled figure).
    const ctx = build({ metadataUnit: "in" });
    expect(ctx.payload).toContain('"gauge_uncertainty_mm": "6.35"');
    expect(ctx.allowedNumbers.has(Number((0.25 * 25.4).toFixed(6)))).toBe(true);
    expect(ctx.allowedNumbers.has(6.35)).toBe(true);
    expect(ctx.allowedNumbers.has(0.25)).toBe(false); // raw declared value unregistered
    // Default (mm) unchanged: the registered value is the raw one.
    const mmCtx = build();
    expect(mmCtx.allowedNumbers.has(0.25)).toBe(true);
  });

  it("contains no digit-bearing identifiers, dates, or design_code strings", () => {
    const ctx = build({ history });
    expect(ctx.payload).not.toContain("R1");
    expect(ctx.payload).not.toContain("CML-1");
    expect(ctx.payload).not.toContain("2025-01-15");
    expect(ctx.payload).not.toContain("2030-01-15");
    expect(ctx.payload).not.toContain("2024 Edition");
  });

  it("injects thresholds verbatim from criteria.ptmt", () => {
    const ctx = build();
    expect(ctx.payload).toContain('"relevance_threshold_mm": 1.5');
    expect(ctx.payload).toContain('"max_rounded_dimension_mm": 5');
    expect(ctx.payload).toContain('"count_threshold": 4');
  });

  it("includes the indication slice with the engine verdict label for kind ptmt", () => {
    const indication: PtmIndicationResult = {
      id: "IND-7",
      method: "MT",
      morphology: "linear",
      lengthMm: 12.4,
      widthMm: 2.1,
      count: 3,
      edgeSeparationMm: null,
      crackSuspect: true,
      verdict: "reject",
      detail: "Aligned rounded cluster: 4 indications within 1.5 mm separation.",
      citationId: "asme_b31_3_344_3_2",
    };
    const ctx = buildNarrativeContext({
      kind: "ptmt",
      indication,
      extraction: null,
      thresholds: criteria.ptmt,
    });
    expect(ctx.payload).toContain('"method": "MT"');
    expect(ctx.payload).toContain('"morphology": "linear"');
    expect(ctx.payload).toContain('"length_mm": "12.4"');
    expect(ctx.payload).toContain('"verdict": "FAIL"');
    expect(ctx.payload).not.toContain("IND-7"); // no digit-bearing identifiers
    expect(ctx.allowedCitationIds).toEqual(["asme_b31_3_344_3_2"]);
  });

  it("adds the extraction pack as evaluation_context when non-null", () => {
    const withExtraction = build({ extraction });
    expect(withExtraction.payload).toContain('"evaluation_context"');
    expect(withExtraction.payload).toContain("cooling-water service");
    expect(build({ extraction: null }).payload).not.toContain("evaluation_context");
  });

  it("returns allowedCitationIds = the reading's citations for kind cml", () => {
    expect(build().allowedCitationIds).toEqual(["api574_10_5_1_4", "api570_7_2"]);
  });

  it("throws on kind/shape mismatch (programmer error)", () => {
    expect(() => buildNarrativeContext({ kind: "cml", extraction: null, thresholds: criteria.ptmt })).toThrow();
    expect(() => buildNarrativeContext({ kind: "ptmt", extraction: null, thresholds: criteria.ptmt })).toThrow();
  });
});

describe("numericAllowlist (A6 policy)", () => {
  it("admits the raw 6dp value plus 1/2/3dp variants of every injected number", () => {
    const allowed = numericAllowlist([4.19834]);
    expect(allowed.has(4.19834)).toBe(true);
    expect(allowed.has(4.2)).toBe(true); // 2dp display variant
    expect(allowed.has(4.198)).toBe(true); // 3dp variant — the A6 boundary
    expect(allowed.has(4.1983)).toBe(false); // 4dp literal is NOT admitted
    expect(allowed.has(4.19)).toBe(false);
    expect(allowed.has(4.198341)).toBe(false);
  });

  it("a 2dp-exact value does not admit higher-precision literals", () => {
    const allowed = numericAllowlist([4.2]);
    expect(allowed.has(4.2)).toBe(true);
    expect(allowed.has(4.198)).toBe(false);
  });
});

describe("EXTRACTION_SCHEMA_HINT key coverage (A10)", () => {
  it("mentions every top-level and nested key of ExtractionResultSchema", () => {
    const topKeys = Object.keys(ExtractionResultSchema.shape);
    for (const key of topKeys) expect(EXTRACTION_SCHEMA_HINT).toContain(key);

    const componentCtx = ExtractionResultSchema.shape.componentContext;
    expect("serviceDescription" in componentCtx.shape).toBe(true);
    for (const key of Object.keys(componentCtx.shape)) {
      expect(EXTRACTION_SCHEMA_HINT).toContain(key);
    }

    const ptmt = ExtractionResultSchema.shape.ptmtNotesSummary;
    const inner = ptmt.unwrap();
    if ("shape" in inner) {
      for (const key of Object.keys(inner.shape)) {
        expect(EXTRACTION_SCHEMA_HINT).toContain(key);
      }
    }
  });
});
