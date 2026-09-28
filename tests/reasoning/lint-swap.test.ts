/**
 * Offline contradiction-swap pins — 03-02 Task 3 (open-question resolution 1
 * at the route boundary, zero network): a narrative that passes the
 * sentence-guard mid-stream but fails a FINAL lint swaps to the deterministic
 * fallback with NO usage frame; a mid-stream numeric rejection leaves every
 * relayed delta consistent with the allowed set at every point in the stream.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/reasoning/narrative/route";
import { parseNarrativeFrame } from "@/lib/reasoning/schemas";
import { FALLBACK_CLOSING_SENTENCE } from "@/lib/reasoning/fallback";
import { numericConsistency } from "@/lib/reasoning/lints";
import { buildNarrativeContext } from "@/lib/reasoning/narrative-context";
import { criteria } from "@/lib/calc/criteria";
import type { ComponentMetadata, ReadingResult } from "@/lib/ingest/session";

vi.mock("@/lib/llm/client", () => ({
  getClient: vi.fn(() => fakeClient),
}));

vi.mock("@/lib/llm/config", () => ({
  getExtractionModel: () => "fixture-extraction-model",
  getReasoningModel: () => "fixture-reasoning-model",
  getApiKey: () => "fixture-key",
}));

type StreamChunk = {
  choices: { delta: { content?: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
};

function streamOf(chunks: StreamChunk[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c;
    },
  };
}

let scriptedChunks: StreamChunk[] = [];

const fakeClient = {
  chat: {
    completions: {
      create: vi.fn(async () => streamOf(scriptedChunks)),
    },
  },
};

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

const EXTRACTION = {
  componentContext: { serviceDescription: "Cooling water line, carbon steel." },
  notableFacts: ["Coating intact."],
  ptmtNotesSummary: null,
  cautions: [],
};

function cmlBody(overrides: Record<string, unknown> = {}) {
  return {
    kind: "cml",
    evaluatedAt: "2026-09-27T14:32:00Z",
    reading: READING,
    metadata: METADATA,
    extraction: EXTRACTION,
    history: null,
    ...overrides,
  };
}

async function framesOf(res: Response) {
  const raw = await res.text();
  return raw
    .split("\n\n")
    .map((chunk) => chunk.replace(/^data: /, "").trim())
    .filter((payload) => payload.length > 0)
    .map((p) => parseNarrativeFrame(p));
}

beforeEach(() => {
  scriptedChunks = [];
  fakeClient.chat.completions.create.mockClear();
  delete process.env.FLAWCHECK_DISABLE_LLM;
  process.env.NEBIUS_API_KEY = "fixture-key";
});

afterEach(() => {
  delete process.env.FLAWCHECK_DISABLE_LLM;
  delete process.env.NEBIUS_API_KEY;
  vi.restoreAllMocks();
});

describe("contradiction-swap (open-question resolution 1, offline route pin)", () => {
  it("final-verdict contradiction swaps to fallback: no usage frame, exactly one rejected frame, closing sentence present", async () => {
    // Numeric-passing narrative whose final line disagrees with the computed
    // verdict ("accept" in the fixture; the narrative claims RE-CHECK).
    scriptedChunks = [
      {
        choices: [
          {
            delta: {
              content:
                "The measured wall thickness is 6.50 mm against a required 6.35 mm. [[cite:api574_10_5_1_4]] The governing corrosion rate is 0.300 mm per year with 12.4 years remaining life. [[cite:api570_7_2]]\nVerdict: RE-CHECK.",
            },
          },
        ],
      },
      { choices: [], usage: { prompt_tokens: 480, completion_tokens: 190 } },
    ];
    const res = await POST(
      new Request("http://localhost/api/reasoning/narrative", {
        method: "POST",
        body: JSON.stringify(cmlBody()),
      }),
    );
    expect(res.status).toBe(200);
    const frames = await framesOf(res);
    const deltas = frames.filter((f) => f?.type === "delta");
    const relayed = deltas.map((d) => (d as { text: string }).text).join("");
    expect(relayed).not.toContain("Verdict:"); // final line held back, never relayed
    const rejected = frames.filter((f) => f?.type === "rejected");
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as { reason: string }).reason).toBe("verdict_lint");
    expect((rejected[0] as { fallback: string }).fallback.endsWith(FALLBACK_CLOSING_SENTENCE)).toBe(
      true,
    );
    expect(frames.some((f) => f?.type === "usage")).toBe(false); // rejected metrics not served
    expect(frames[frames.length - 1]).toBeNull(); // [DONE]
  });

  it("mid-stream sentence-guard rejection: every relayed delta passes numericConsistency", async () => {
    scriptedChunks = [
      { choices: [{ delta: { content: "The measured wall thickness is 6.50 mm. " } }] },
      { choices: [{ delta: { content: "Local pitting reaches 3.90 mm depth. " } }] },
      { choices: [{ delta: { content: "Verdict: ACCEPT." } }] },
    ];
    const res = await POST(
      new Request("http://localhost/api/reasoning/narrative", {
        method: "POST",
        body: JSON.stringify(cmlBody()),
      }),
    );
    const frames = await framesOf(res);
    const ctx = buildNarrativeContext({
      kind: "cml",
      reading: READING,
      metadata: METADATA,
      extraction: EXTRACTION,
      history: null,
      thresholds: criteria.ptmt,
    });
    // Assert the prefix-invariant at every relayed point: the joined deltas
    // after each frame pass the numeric scan (partial render stays truthful).
    let relayed = "";
    for (const f of frames) {
      if (f?.type === "delta") {
        relayed += (f as { text: string }).text;
        expect(numericConsistency(relayed, ctx.allowedNumbers)).toBe(true);
      }
    }
    expect(relayed).not.toContain("3.90");
    const rejected = frames.find((f) => f?.type === "rejected") as { reason: string } | undefined;
    expect(rejected?.reason).toBe("numeric_lint");
    expect(frames.some((f) => f?.type === "usage")).toBe(false);
  });
});
