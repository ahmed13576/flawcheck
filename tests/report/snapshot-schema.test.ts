/**
 * Snapshot schema pins — 04-02 Task 1 (WR-10 closure): the valid fixture
 * parses; every enumerated trust-boundary surface throws a ZodError.
 */
import { describe, it, expect } from "vitest";
import {
  ReportPdfRequestSchema,
  ReportSnapshotSchema,
} from "@/lib/report/snapshot-schema";

const METADATA = {
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

const READING = {
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

const INDICATION = {
  id: "ind-mt-1",
  method: "MT",
  morphology: "linear",
  lengthMm: 4.2,
  widthMm: 0.8,
  count: 1,
  edgeSeparationMm: null,
  crackSuspect: false,
  verdict: "reject",
  detail: "Relevant linear indications are rejected.",
  citationId: "asme_b31_3_344_3_2",
};

const SIGN_OFF = {
  name: "Mohammed Ahmed",
  certification: "NDT Level II",
  date: "2026-10-05",
  signature: "M. Ahmed",
};

const AUDIT = {
  evaluatedAt: "2026-10-05T00:00:00Z",
  inputHash: "a".repeat(64),
  steps: [
    { step: "extraction", model: "fixture-model", promptTokens: 100, completionTokens: 50, latencyMs: 500 },
    { step: "narrative", model: "fixture-reasoning", promptTokens: 200, completionTokens: 80, latencyMs: 900 },
  ],
};

function validRequest(overrides: Record<string, unknown> = {}) {
  return {
    snapshot: {
      evaluatedAt: "2026-10-05T00:00:00Z",
      sourceName: "sample.csv",
      units: { csvThickness: "mm", metadata: "mm" },
      metadata: METADATA,
      summary: { total: 1, locations: 1, accept: 1, reCheck: 0, fail: 0 },
      readings: [READING],
      indications: [INDICATION],
      notes: "Sample note.",
      signOff: SIGN_OFF,
      ...overrides,
    },
    audit: AUDIT,
  };
}

describe("ReportPdfRequestSchema (WR-10 closure)", () => {
  it("parses the full valid fixture (nullable branches, indication, signOff, two-entry audit)", () => {
    const parsed = ReportPdfRequestSchema.safeParse(validRequest());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.snapshot.readings[0].crLtMmYr).toBe(0.3);
      expect(parsed.data.snapshot.signOff?.name).toBe("Mohammed Ahmed");
      expect(parsed.data.audit?.steps).toHaveLength(2);
    }
  });

  it("rejects an unknown unit string", () => {
    const bad = validRequest();
    (bad.snapshot as Record<string, unknown>).units = { csvThickness: "cm", metadata: "mm" };
    expect(ReportPdfRequestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects metadata missing tStructural", () => {
    const bad = validRequest();
    const meta = { ...METADATA } as Record<string, unknown>;
    delete meta.tStructural;
    (bad.snapshot as Record<string, unknown>).metadata = meta;
    expect(ReportPdfRequestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a non-finite od (NaN)", () => {
    const bad = validRequest();
    (bad.snapshot as Record<string, unknown>).metadata = { ...METADATA, od: NaN };
    expect(ReportPdfRequestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a reading missing tRequiredMm", () => {
    const bad = validRequest();
    const r = { ...READING } as Record<string, unknown>;
    delete r.tRequiredMm;
    (bad.snapshot as Record<string, unknown>).readings = [r];
    expect(ReportPdfRequestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown verdict", () => {
    const bad = validRequest();
    (bad.snapshot as Record<string, unknown>).readings = [
      { ...READING, verdict: "maybe" },
    ];
    expect(ReportPdfRequestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an indication with method VT", () => {
    const bad = validRequest();
    (bad.snapshot as Record<string, unknown>).indications = [
      { ...INDICATION, method: "VT" },
    ];
    expect(ReportPdfRequestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects summary total as a string", () => {
    const bad = validRequest();
    (bad.snapshot as Record<string, unknown>).summary = {
      total: "1",
      locations: 1,
      accept: 1,
      reCheck: 0,
      fail: 0,
    };
    expect(ReportPdfRequestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an empty-string certification inside signOff", () => {
    const bad = validRequest();
    (bad.snapshot as Record<string, unknown>).signOff = { ...SIGN_OFF, certification: "" };
    expect(ReportPdfRequestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an audit step named ingestion", () => {
    const bad = validRequest();
    (bad as Record<string, unknown>).audit = {
      ...AUDIT,
      steps: [{ step: "ingestion", model: null, promptTokens: null, completionTokens: null, latencyMs: null }],
    };
    expect(ReportPdfRequestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a NaN token count", () => {
    const bad = validRequest();
    (bad as Record<string, unknown>).audit = {
      ...AUDIT,
      steps: [
        { step: "extraction", model: "m", promptTokens: NaN, completionTokens: 1, latencyMs: 1 },
        AUDIT.steps[1],
      ],
    };
    expect(ReportPdfRequestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unexpected extra top-level key (strict)", () => {
    const bad = validRequest({ injected: true });
    expect(ReportPdfRequestSchema.safeParse(bad).success).toBe(false);
  });

  it("snapshot schema alone also rejects an extra key", () => {
    const snap = validRequest().snapshot as Record<string, unknown>;
    expect(ReportSnapshotSchema.safeParse({ ...snap, extra: 1 }).success).toBe(false);
  });
});
