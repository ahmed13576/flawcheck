/**
 * Narrative route ENABLED path — 03-02 Task 2 (offline; client + config
 * mocked with an async-iterable fake stream; no vendor model-ID literals — the
 * Phase 1 grep gate scans tests/).
 *
 * Scenarios (plan action 5): (a) lint-passing narrative → deltas relayed,
 * exactly one usage frame, [DONE]; (b) mid-stream invented number → the
 * offending sentence appears in NO relayed delta, rejected(numeric_lint) with
 * fallback ending in the locked closing sentence, no usage; (c) final verdict
 * contradicting the computed verdict → rejected(verdict_lint); (d) cml with
 * extraction null on the enabled path → 422; (e) upstream throw after two
 * deltas → error frame + [DONE], no usage frame.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/reasoning/narrative/route";
import { parseNarrativeFrame } from "@/lib/reasoning/schemas";
import { FALLBACK_CLOSING_SENTENCE } from "@/lib/reasoning/fallback";
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

let scriptedChunks: StreamChunk[] | null = null;
let scriptedThrow: Error | null = null;

const fakeClient = {
  chat: {
    completions: {
      create: vi.fn(async () => {
        if (scriptedThrow) throw scriptedThrow;
        if (!scriptedChunks) throw new Error("fixture stream not scripted");
        return streamOf(scriptedChunks);
      }),
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

function cmlBody(overrides: Record<string, unknown> = {}) {
  return {
    kind: "cml",
    evaluatedAt: "2026-09-27T14:32:00Z",
    reading: READING,
    metadata: METADATA,
    extraction: {
      componentContext: { serviceDescription: "Cooling water line, carbon steel." },
      notableFacts: ["Coating intact."],
      ptmtNotesSummary: null,
      cautions: [],
    },
    history: null,
    ...overrides,
  };
}

/** Lint-passing narrative: only fixture numbers at admitted precisions, allowed cites, correct final line. */
const PASSING_NARRATIVE =
  "The measured wall thickness is 6.50 mm against a required 6.35 mm, so the reading sits above the acceptance floor. [[cite:api574_10_5_1_4]] The long-term corrosion rate is 0.300 mm per year, giving a remaining life of 12.4 years. [[cite:api570_7_2]]\nVerdict: ACCEPT.";

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/reasoning/narrative", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

async function framesOf(res: Response) {
  const raw = await res.text();
  return raw
    .split("\n\n")
    .map((chunk) => chunk.replace(/^data: /, "").trim())
    .filter((payload) => payload.length > 0)
    .map((p) => parseNarrativeFrame(p));
  // NOTE: nulls are kept — parseNarrativeFrame returns null exactly for the
  // [DONE] sentinel, so the last element being null asserts the sentinel.
}

beforeEach(() => {
  scriptedChunks = null;
  scriptedThrow = null;
  fakeClient.chat.completions.create.mockClear();
  delete process.env.FLAWCHECK_DISABLE_LLM;
  process.env.NEBIUS_API_KEY = "fixture-key";
});

afterEach(() => {
  delete process.env.FLAWCHECK_DISABLE_LLM;
  delete process.env.NEBIUS_API_KEY;
  vi.restoreAllMocks();
});

describe("POST /api/reasoning/narrative — enabled path", () => {
  it("(a) relays a lint-passing narrative with exactly one usage frame then [DONE]", async () => {
    scriptedChunks = [
      { choices: [{ delta: { content: PASSING_NARRATIVE.slice(0, 60) } }] },
      { choices: [{ delta: { content: PASSING_NARRATIVE.slice(60) } }] },
      { choices: [], usage: { prompt_tokens: 540, completion_tokens: 210 } },
    ];
    const res = await post(cmlBody());
    expect(res.status).toBe(200);
    const frames = await framesOf(res);
    expect(frames[frames.length - 1]).toBeNull(); // [DONE] sentinel parses null
    const deltas = frames.filter((f) => f?.type === "delta");
    expect(deltas.map((d) => (d as { text: string }).text).join("")).toBe(PASSING_NARRATIVE);
    const usageFrames = frames.filter((f) => f?.type === "usage");
    expect(usageFrames).toHaveLength(1);
    const usage = usageFrames[0] as { promptTokens: number; completionTokens: number; latencyMs: number; model: string };
    expect(usage.promptTokens).toBe(540);
    expect(usage.completionTokens).toBe(210);
    expect(usage.model).toBe("fixture-reasoning-model");
    expect(usage.latencyMs).toBeGreaterThanOrEqual(0);
    expect(frames.some((f) => f?.type === "fallback")).toBe(false);
  });

  it("(b) never relays a mid-stream sentence with an invented number — rejected(numeric_lint) + fallback, no usage", async () => {
    const invented = "The local scraping loss is 2.75 mm deep near the support.";
    scriptedChunks = [
      { choices: [{ delta: { content: "The measured wall thickness is 6.50 mm against a required 6.35 mm. " } }] },
      { choices: [{ delta: { content: invented + " " } }] },
      { choices: [{ delta: { content: "Verdict: ACCEPT." } }] },
    ];
    const res = await post(cmlBody());
    const frames = await framesOf(res);
    const deltas = frames.filter((f) => f?.type === "delta");
    const relayed = deltas.map((d) => (d as { text: string }).text).join("");
    expect(relayed).not.toContain("2.75");
    const rejected = frames.find((f) => f?.type === "rejected") as { reason: string; fallback: string } | undefined;
    expect(rejected).toBeDefined();
    expect(rejected?.reason).toBe("numeric_lint");
    expect(rejected?.fallback.endsWith(FALLBACK_CLOSING_SENTENCE)).toBe(true);
    expect(frames.some((f) => f?.type === "usage")).toBe(false);
    expect(frames[frames.length - 1]).toBeNull();
  });

  it("(c) rejects a narrative whose final verdict contradicts the computed verdict — rejected(verdict_lint)", async () => {
    scriptedChunks = [
      { choices: [{ delta: { content: PASSING_NARRATIVE } }] },
      { choices: [], usage: { prompt_tokens: 500, completion_tokens: 200 } },
    ];
    // fixture reading verdict is "accept"; flip the body to "reject" so the
    // narrative's final line "Verdict: ACCEPT." disagrees.
    const res = await post(cmlBody({ reading: { ...READING, verdict: "reject" } }));
    const frames = await framesOf(res);
    const rejected = frames.find((f) => f?.type === "rejected") as { reason: string; fallback: string } | undefined;
    expect(rejected).toBeDefined();
    expect(rejected?.reason).toBe("verdict_lint");
    expect(frames.some((f) => f?.type === "usage")).toBe(false);
  });

  it("(d) returns 422 on the enabled path when the cml extraction pack is null", async () => {
    const res = await post(cmlBody({ extraction: null }));
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("extraction");
    expect(fakeClient.chat.completions.create).not.toHaveBeenCalled();
  });

  it("(e) upstream throw after two deltas → error frame + [DONE], no usage", async () => {
    scriptedChunks = [
      { choices: [{ delta: { content: "The measured wall thickness is 6.50 mm. " } }] },
      { choices: [{ delta: { content: "The required thickness is 6.35 mm. " } }] },
    ];
    scriptedThrow = new Error("upstream connection reset");
    const res = await post(cmlBody());
    const frames = await framesOf(res);
    const error = frames.find((f) => f?.type === "error") as { message: string } | undefined;
    expect(error).toBeDefined();
    expect(error?.message).toContain("upstream connection reset");
    expect(frames.some((f) => f?.type === "usage")).toBe(false);
    expect(frames[frames.length - 1]).toBeNull();
  });
});
