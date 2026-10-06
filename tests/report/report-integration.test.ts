/**
 * Full-chain integration proof — 04-04 (04-02 + 04-03): evaluation session →
 * snapshot + audit → WR-10 strict schema → the real PDF route POST → a
 * genuine %PDF buffer. No Phase 4 code is mocked. Zero network (all in-process).
 *
 * The verbatim-text invariant chain: narrative strings passed the Phase 3
 * tokenizer/verbatimNgramLint BEFORE entering the snapshot; this file proves
 * the render seam continues to cite only citations.json-composed references.
 */
import { describe, it, expect } from "vitest";
import { POST as pdfPOST } from "@/app/api/report/pdf/route";
import {
  buildReportSnapshot,
  withSignOff,
} from "@/lib/report/session-snapshot";
import { buildAuditSteps, computeInputHash } from "@/lib/report/audit";
import { ReportPdfRequestSchema } from "@/lib/report/snapshot-schema";
import { buildConclusions, citationRef } from "@/lib/report/content";
import { criteria } from "@/lib/calc/criteria";
import type { EvaluationSession, ReadingResult } from "@/lib/ingest/session";

const METADATA = {
  od: 219.1,
  tNominal: 10.31,
  fca: 1,
  tStructural: 6.35,
  designCode: "ASME B31.3 — 2024 Edition" as const,
  pipeClass: 2 as const,
  gaugeUncertainty: 0.1,
  pressureUnit: "MPa" as const,
  designPressure: 3.5,
  allowableStress: 138,
  e: 1,
  w: 1,
  y: 0.4,
  formula: "asme_b31_3_straight_pipe" as const,
};

function reading(
  id: string,
  verdict: "accept" | "re_check" | "reject",
  overrides: Partial<ReadingResult> = {},
): ReadingResult {
  return {
    readingId: id,
    location: `Loc ${id}`,
    cml: `CML-${id}`,
    date: "2025-06-15T00:00:00Z",
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
    citations: ["api574_10_5_1_4", "api570_7_2"],
    ...overrides,
  };
}

const SESSION: EvaluationSession = {
  source: { filename: "integration-fixture.csv", isDemo: false, ingestedAt: "2026-10-05T00:00:00Z" },
  csv: { headers: [], delimiter: ",", rowCount: 3 },
  mapping: {
    readingId: "Reading_ID",
    measuredThickness: "Measured_Thickness_mm",
    measurementDate: "Measurement_Date",
    tank: "Tank",
    tInitial: null,
    tPrevious: null,
  },
  units: { csvThickness: "mm", metadata: "mm" },
  rows: [],
  metadata: METADATA,
  ptmt: { notes: "Integration fixture note.", indications: [] },
  results: {
    readings: [
      reading("r-acc", "accept"),
      reading("r-rec", "re_check", {
        flags: ["outlier"],
        outlier: { z: 2.1, median: 6.4, mad: 0.05 },
      }),
      reading("r-rej", "reject", { rlYears: null, nextInspection: null, crLtMmYr: null, crStMmYr: null, rawCrLtMmYr: null, rawCrStMmYr: null, crGoverningMmYr: null }),
    ],
    summary: { total: 3, locations: 3, accept: 1, reCheck: 1, fail: 1 },
    indications: [
      {
        id: "ind-mt-1",
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
      },
    ],
    citationsUsed: ["api574_10_5_1_4", "api570_7_2", "asme_b31_3_344_3_2"],
  },
};

const SIGN_OFF = {
  name: "Mohammed Ahmed",
  certification: "NDT Level II",
  date: "2026-10-05",
  signature: "M. Ahmed",
};

describe("Phase 4 full-chain integration (04-04)", () => {
  it("session → snapshot+audit → strict schema → route POST → real %PDF bytes", async () => {
    // 1. snapshot from the real builder + complete sign-off
    const base = buildReportSnapshot(SESSION, "2026-10-05T00:00:00Z");
    expect(base).not.toBeNull();
    const snapshot = withSignOff(base as NonNullable<typeof base>, SIGN_OFF);

    // 2. audit: honest-mixed case — one step with real telemetry, one with nulls
    const inputHash = await computeInputHash(SESSION.rows, SESSION.mapping, SESSION.units);
    const steps = buildAuditSteps(
      { promptTokens: 790, completionTokens: 550, latencyMs: 3448, model: "integration-extraction-model" },
      null,
    );
    const audit = {
      evaluatedAt: snapshot.evaluatedAt,
      inputHash,
      steps,
    };

    // 3. client-side composition matches the server contract (WR-10 boundary)
    const request = { snapshot, audit };
    const parsed = ReportPdfRequestSchema.safeParse(request);
    expect(parsed.success).toBe(true);

    // 4. the REAL route handler
    const res = await pdfPOST(
      new Request("http://localhost/api/report/pdf", {
        method: "POST",
        body: JSON.stringify(request),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(buf.length).toBeGreaterThan(1024);
  }, 60_000);

  it("verbatim-text invariant: every fixture clause reference is a citations.json composition", () => {
    const snapshot = buildReportSnapshot(SESSION, "2026-10-05T00:00:00Z");
    expect(snapshot).not.toBeNull();
    const conclusions = buildConclusions(snapshot as NonNullable<typeof snapshot>);
    expect(conclusions.length).toBeGreaterThan(0);
    for (const line of conclusions) {
      if (line.citationId === null) continue;
      // the rendered reference must be the citationRef composition of a KNOWN
      // citations.json record — cite-don't-quote holds through the render seam
      const record = criteria.citations.find((c) => c.id === line.citationId);
      expect(record).toBeDefined();
      expect(citationRef(line.citationId)).toContain(record?.code ?? "NEVER");
    }
  });
});
