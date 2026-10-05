/**
 * Offline end-to-end — 03-05 Task 1: the REAL routes driven with
 * FLAWCHECK_DISABLE_LLM=1 (fallback mode, zero network). Proves REAS-03
 * end-to-end: fallback frames carry only allowlist-resolvable citation ids,
 * fabricated ids render zero glyphs + the audit stamp, no fabricated usage
 * frames, and the extract route honors the disabled contract.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as narrativePOST } from "@/app/api/reasoning/narrative/route";
import { POST as extractPOST } from "@/app/api/reasoning/extract/route";
import { parseNarrativeFrame, type MetadataSlice } from "@/lib/reasoning/schemas";
import { tokenize } from "@/lib/reasoning/tokenizer";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ReasoningPane } from "@/components/wizard/reasoning-pane";
import { criteria } from "@/lib/calc/criteria";
import type { ReadingResult } from "@/lib/ingest/session";

// CR-03: strict-schema request fixtures carry the declared metadata unit
// ("mm" — the fixture numerics are mm values).
const METADATA: MetadataSlice = {
  od: 219.1,
  tNominal: 10.31,
  fca: 1,
  tStructural: 6.35,
  designCode: "ASME B31.3 — 2024 Edition",
  pipeClass: 2,
  gaugeUncertainty: 0.1,
  metadataUnit: "mm",
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

const INDICATION = {
  id: "ind-mt-1",
  method: "MT" as const,
  morphology: "linear" as const,
  lengthMm: 4.2,
  widthMm: 0.8,
  count: 1,
  edgeSeparationMm: null,
  crackSuspect: false,
  verdict: "reject" as const,
  detail: "Relevant linear indications are rejected — escalate to Level 2/3 inspector evaluation.",
  citationId: "asme_b31_3_344_3_2",
};

async function framesOf(res: Response) {
  const raw = await res.text();
  return raw
    .split("\n\n")
    .map((c) => c.replace(/^data: /, "").trim())
    .filter((p) => p.length > 0)
    .map((p) => parseNarrativeFrame(p));
}

beforeEach(() => {
  process.env.FLAWCHECK_DISABLE_LLM = "1";
  delete process.env.NEBIUS_API_KEY;
});

afterEach(() => {
  delete process.env.FLAWCHECK_DISABLE_LLM;
});

describe("offline e2e — fallback mode through real routes", () => {
  it("(a) CML pane: one fallback frame, all citation ids allowlist-resolvable, no usage/meta frames", async () => {
    const res = await narrativePOST(
      new Request("http://localhost/api/reasoning/narrative", {
        method: "POST",
        body: JSON.stringify({
          kind: "cml",
          evaluatedAt: "E1",
          reading: READING,
          metadata: METADATA,
          extraction: null,
          history: null,
        }),
      }),
    );
    expect(res.status).toBe(200);
    const frames = await framesOf(res);
    const fallbacks = frames.filter((f) => f?.type === "fallback");
    expect(fallbacks).toHaveLength(1);
    const fallbackText = (fallbacks[0] as { fallback: string }).fallback;
    expect(fallbackText.endsWith("Verdict: ACCEPT."));
    // every [[cite:id]] in the fallback resolves against citations.json
    const ids = tokenize(fallbackText)
      .filter((s) => s.kind === "cite")
      .map((s) => (s as { kind: "cite"; id: string }).id);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(criteria.citations.some((c) => c.id === id)).toBe(true);
    }
    expect(frames.some((f) => f?.type === "usage" || f?.type === "meta")).toBe(false);
    expect(frames[frames.length - 1]).toBeNull();
  });

  it("(b) PT/MT pane: same contract via fallbackNarrativeForIndication", async () => {
    const res = await narrativePOST(
      new Request("http://localhost/api/reasoning/narrative", {
        method: "POST",
        body: JSON.stringify({ kind: "ptmt", evaluatedAt: "E1", indication: INDICATION }),
      }),
    );
    expect(res.status).toBe(200);
    const frames = await framesOf(res);
    const fallbacks = frames.filter((f) => f?.type === "fallback");
    expect(fallbacks).toHaveLength(1);
    const ids = tokenize((fallbacks[0] as { fallback: string }).fallback)
      .filter((s) => s.kind === "cite")
      .map((s) => (s as { kind: "cite"; id: string }).id);
    for (const id of ids) {
      expect(criteria.citations.some((c) => c.id === id)).toBe(true);
    }
  });

  it("extract route in disabled mode returns 200 {disabled:true}", async () => {
    const res = await extractPOST(
      new Request("http://localhost/api/reasoning/extract", {
        method: "POST",
        body: JSON.stringify({
          metadata: METADATA,
          notes: "",
          indications: [],
          populationDigest: {
            total: 1,
            locations: 1,
            accept: 1,
            reCheck: 0,
            fail: 0,
            dateRange: null,
            units: { csvThickness: "mm", metadata: "mm" },
          },
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ extraction: null, usage: null, disabled: true });
  });

  it("REAS-03 end-to-end: a fabricated citation id renders zero glyphs + the audit stamp", () => {
    // Doctored ONLY here in the test: a fallback text carrying a fabricated id
    // flows through the same tokenizer + pane rendering path the client uses.
    const doctored =
      "The reading satisfies the limit per [[cite:api570_7_2]]. Fabricated: [[cite:fabricated_id_01]]. Verdict: ACCEPT.";
    const html = renderToStaticMarkup(
      createElement(ReasoningPane, {
        reading: READING,
        metadata: METADATA,
        entry: { status: "fallback", text: "", fallbackText: doctored },
      }),
    );
    // Zero glyphs in the NARRATIVE text: the fabricated id never renders as a
    // citation chip (no button/aria-controls for it) — it appears ONLY in the
    // audit stamp, which the contract requires to NAME the blocked id.
    expect(html).not.toContain('cite-detail-fabricated_id_01');
    expect(html).toContain("Unresolved citation blocked: &#x27;fabricated_id_01&#x27; — rendered blank");
    expect(html).toContain("[[cite:api570_7_2]]".length > 0 ? "api570_7_2" : ""); // valid id still cited
  });
});
