/**
 * PDF route pins — 04-02 Task 2: signed-off fixture → 200 with real %PDF
 * bytes; bad input → 400 with JSON errors (UI-49/UI-50); sign-off absent →
 * 400. React 19 + @react-pdf/renderer render in vitest (smoke-proven 03-05).
 */
import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/report/pdf/route";

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

const SIGN_OFF = {
  name: "Mohammed Ahmed",
  certification: "NDT Level II",
  date: "2026-10-05",
  signature: "M. Ahmed",
};

function body(overrides: Record<string, unknown> = {}) {
  return {
    snapshot: {
      evaluatedAt: "2026-10-05T00:00:00Z",
      sourceName: "sample.csv",
      units: { csvThickness: "mm", metadata: "mm" },
      metadata: METADATA,
      summary: { total: 1, locations: 1, accept: 1, reCheck: 0, fail: 0 },
      readings: [READING],
      indications: [],
      notes: "Sample note.",
      signOff: SIGN_OFF,
      ...overrides,
    },
    audit: {
      evaluatedAt: "2026-10-05T00:00:00Z",
      inputHash: "a".repeat(64),
      steps: [
        { step: "extraction", model: "fixture-model", promptTokens: 100, completionTokens: 50, latencyMs: 500 },
        { step: "narrative", model: "fixture-reasoning", promptTokens: 200, completionTokens: 80, latencyMs: 900 },
      ],
    },
  };
}

function post(payload: unknown | string): Promise<Response> {
  return POST(
    new Request("http://localhost/api/report/pdf", {
      method: "POST",
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    }),
  );
}

describe("POST /api/report/pdf", () => {
  it("returns 200 with real %PDF bytes and correct headers for a signed-off snapshot (UI-49)", async () => {
    const res = await post(body());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(buf.length).toBeGreaterThan(1024);
  }, 30_000);

  it("returns 400 for an empty body", async () => {
    const res = await post("");
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("valid JSON");
  });

  it("returns 400 when metadata is missing tStructural (WR-10)", async () => {
    const bad = body();
    const meta = { ...METADATA } as Record<string, unknown>;
    delete meta.tStructural;
    (bad.snapshot as Record<string, unknown>).metadata = meta;
    const res = await post(bad);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("tStructural");
  });

  it("returns 400 for an incomplete sign-off (empty certification)", async () => {
    const bad = body();
    (bad.snapshot as Record<string, unknown>).signOff = { ...SIGN_OFF, certification: "" };
    const res = await post(bad);
    expect(res.status).toBe(400);
  });

  it("returns 400 when signOff is absent", async () => {
    const bad = body();
    (bad.snapshot as Record<string, unknown>).signOff = null;
    const res = await post(bad);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("sign-off");
  });
});
