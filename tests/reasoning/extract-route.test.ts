/**
 * Extract route pins — 03-02 Task 2 (offline; client + config mocked).
 * Valid JSON → 200 with usage; unparseable-twice → 502 naming the error;
 * FLAWCHECK_DISABLE_LLM=1 → 200 {disabled:true}; unknown field → 400;
 * empty notes → schema accepts (ptmtNotesSummary null path).
 * No vendor model-ID literals anywhere (Phase 1 grep gate scans tests/).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/reasoning/extract/route";
import { ExtractionResultSchema } from "@/lib/reasoning/schemas";
import type { ComponentMetadata } from "@/lib/ingest/session";

vi.mock("@/lib/llm/client", () => ({
  getClient: vi.fn(() => fakeClient),
}));

vi.mock("@/lib/llm/config", () => ({
  getExtractionModel: () => "fixture-extraction-model",
  getReasoningModel: () => "fixture-reasoning-model",
  getApiKey: () => "fixture-key",
}));

type ChatResponse = {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
};

let scripted: ChatResponse[] = [];

const fakeClient = {
  chat: {
    completions: {
      create: vi.fn(async () => {
        const next = scripted.shift();
        if (!next) throw new Error("fixture scripted responses exhausted");
        return next;
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

const DIGEST = {
  total: 2,
  locations: 1,
  accept: 1,
  reCheck: 1,
  fail: 0,
  dateRange: { from: "2024-01-01", to: "2025-01-01" },
  units: { csvThickness: "mm", metadata: "mm" },
};

function body(overrides: Record<string, unknown> = {}) {
  return { metadata: METADATA, notes: "Line at weld toe.", indications: [], populationDigest: DIGEST, ...overrides };
}

const VALID_EXTRACTION = {
  componentContext: { serviceDescription: "Cooling water line, carbon steel, insulated." },
  notableFacts: ["Coating appears intact."],
  ptmtNotesSummary: { relevant: true, points: ["Linear indication at weld toe."] },
  cautions: [],
};

beforeEach(() => {
  scripted = [];
  fakeClient.chat.completions.create.mockClear();
  delete process.env.FLAWCHECK_DISABLE_LLM;
  process.env.NEBIUS_API_KEY = "fixture-key";
});

afterEach(() => {
  delete process.env.FLAWCHECK_DISABLE_LLM;
  delete process.env.NEBIUS_API_KEY;
  vi.restoreAllMocks();
});

function parseJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

describe("POST /api/reasoning/extract", () => {
  it("returns 200 with extraction + real usage on first-pass valid JSON", async () => {
    scripted = [
      {
        choices: [{ message: { content: JSON.stringify(VALID_EXTRACTION) } }],
        usage: { prompt_tokens: 321, completion_tokens: 87 },
      },
    ];
    const res = await POST(new Request("http://localhost/api/reasoning/extract", { method: "POST", body: JSON.stringify(body()) }));
    expect(res.status).toBe(200);
    const json = await parseJson(res);
    const parsed = ExtractionResultSchema.safeParse(json.extraction);
    expect(parsed.success).toBe(true);
    const usage = json.usage as Record<string, unknown>;
    expect(usage.promptTokens).toBe(321);
    expect(usage.completionTokens).toBe(87);
    expect(usage.model).toBe("fixture-extraction-model");
    expect(Number(usage.latencyMs)).toBeGreaterThanOrEqual(0);
    expect(fakeClient.chat.completions.create).toHaveBeenCalledTimes(1);
  });

  it("returns 502 naming the error when both attempts return unparseable JSON", async () => {
    scripted = [
      { choices: [{ message: { content: "this is not json at all" } }] },
      { choices: [{ message: { content: "still not json" } }] },
    ];
    const res = await POST(new Request("http://localhost/api/reasoning/extract", { method: "POST", body: JSON.stringify(body()) }));
    expect(res.status).toBe(502);
    const json = await parseJson(res);
    expect(String(json.error)).toContain("Validated call failed after 1 retry");
    expect(fakeClient.chat.completions.create).toHaveBeenCalledTimes(2);
  });

  it("returns 200 {disabled:true} without touching the client when the kill-switch is set", async () => {
    process.env.FLAWCHECK_DISABLE_LLM = "1";
    const res = await POST(new Request("http://localhost/api/reasoning/extract", { method: "POST", body: JSON.stringify(body()) }));
    expect(res.status).toBe(200);
    const json = await parseJson(res);
    expect(json).toEqual({ extraction: null, usage: null, disabled: true });
    expect(fakeClient.chat.completions.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown field with 400 naming it (.strict)", async () => {
    const res = await POST(new Request("http://localhost/api/reasoning/extract", { method: "POST", body: JSON.stringify(body({ sneaky: true })) }));
    expect(res.status).toBe(400);
    const json = await parseJson(res);
    expect(String(json.error)).toContain("sneaky");
  });

  it("accepts empty notes (ptmtNotesSummary null path)", async () => {
    scripted = [
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                componentContext: { serviceDescription: "Drain line." },
                notableFacts: [],
                ptmtNotesSummary: null,
                cautions: [],
              }),
            },
          },
        ],
      },
    ];
    const res = await POST(new Request("http://localhost/api/reasoning/extract", { method: "POST", body: JSON.stringify(body({ notes: "" })) }));
    expect(res.status).toBe(200);
    const json = await parseJson(res);
    const extraction = json.extraction as { ptmtNotesSummary: unknown };
    expect(extraction.ptmtNotesSummary).toBeNull();
  });

  it("returns 400 on malformed JSON body", async () => {
    const res = await POST(new Request("http://localhost/api/reasoning/extract", { method: "POST", body: "{not json" }));
    expect(res.status).toBe(400);
  });
});
