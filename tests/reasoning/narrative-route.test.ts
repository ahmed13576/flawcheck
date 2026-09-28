/**
 * Narrative route pins — 03-01 Task 1 (offline, no key): the exported POST
 * handler is invoked with real Request objects. Valid cml body → 200
 * text/event-stream whose frames parse against NarrativeFrameSchema, contain
 * exactly one fallback frame, and end with the [DONE] sentinel; .strict()
 * rejects an unknown extra field with 400; malformed JSON → 400; a ptmt body
 * → the fallback cites the indication's citation id. No meta/delta/usage
 * frames are emitted in this plan.
 */
import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/reasoning/narrative/route";
import { parseNarrativeFrame } from "@/lib/reasoning/schemas";
import { fallbackNarrative } from "@/lib/reasoning/fallback";
import type { ComponentMetadata, ReadingResult } from "@/lib/ingest/session";

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

const VALID_CML_BODY = {
  kind: "cml",
  evaluatedAt: "2026-09-27T14:32:00Z",
  reading: READING,
  metadata: METADATA,
  extraction: null,
  history: null,
};

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/reasoning/narrative", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

async function framesOf(res: Response): Promise<string[]> {
  const raw = await res.text();
  return raw
    .split("\n\n")
    .map((chunk) => chunk.replace(/^data: /, "").trim())
    .filter((payload) => payload.length > 0);
}

describe("POST /api/reasoning/narrative — fallback-first slice", () => {
  it("streams one fallback frame then [DONE] with text/event-stream content type", async () => {
    const res = await post(VALID_CML_BODY);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    const payloads = await framesOf(res);
    expect(payloads[payloads.length - 1]).toBe("[DONE]");

    const parsed = payloads
      .slice(0, -1)
      .map((p) => parseNarrativeFrame(p))
      .filter((f) => f !== null);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({
      type: "fallback",
      fallback: fallbackNarrative(READING, METADATA),
      reason: "llm_disabled",
    });
  });

  it("emits no meta/delta/usage frames in this plan (nothing fabricated)", async () => {
    const res = await post(VALID_CML_BODY);
    const payloads = await framesOf(res);
    const types = payloads
      .slice(0, -1)
      .map((p) => parseNarrativeFrame(p)?.type ?? "unparseable");
    expect(types).toEqual(["fallback"]);
  });

  it("rejects an unknown extra field with 400 (strict parse)", async () => {
    const res = await post({ ...VALID_CML_BODY, extra: 1 });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("invalid narrative request");
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await post("{\"kind\": broken");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("valid JSON");
  });

  it("serves a ptmt body whose fallback cites the indication's citation id", async () => {
    const res = await post({
      kind: "ptmt",
      evaluatedAt: "2026-09-27T14:32:00Z",
      indication: {
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
      },
    });
    expect(res.status).toBe(200);
    const payloads = await framesOf(res);
    const frames = payloads
      .slice(0, -1)
      .map((p) => parseNarrativeFrame(p))
      .filter((f) => f !== null);
    expect(frames).toHaveLength(1);
    if (frames[0]?.type === "fallback") {
      expect(frames[0].fallback).toContain("[[cite:asme_b31_3_344_3_2]]");
      expect(frames[0].fallback).toContain("All verdicts are computed in code and unaffected.");
    } else {
      expect(frames[0]?.type).toBe("fallback");
    }
  });

  it("rejects a cml body missing the history block with 400 (schema-defined shape)", async () => {
    const { history: _omitted, ...partial } = VALID_CML_BODY;
    const res = await post(partial);
    expect(res.status).toBe(400);
  });
});
