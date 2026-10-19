import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DecisionProviderError, DecisionValidationError, type DecisionBatchQuestions } from "../../lib/decision/types";
import { SubQSnapDecisionProvider } from "../../lib/decision/providers/subq-snap";

const context = { state: { observation: "test state" } };

describe("SubQSnapDecisionProvider", () => {
  beforeEach(() => {
    // Vitest loads .env.local, so FLAWCHECK_DISABLE_LLM may be ambient — the hermetic
    // suite must be key-independent: clear it before every test (pattern from
    // tests/reasoning/narrative-route.test.ts).
    vi.stubEnv("FLAWCHECK_DISABLE_LLM", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends native question types and maps typed answers and usage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      answers: {
        toxic: { type: "noul", noul: 0.91 },
        service: { type: "choice", choice: "class_1", probabilities: { class_1: 0.91, class_2: 0.09 }, confidence: 0.91 },
        severity: { type: "score", score: 1.8, legend: { "2": "high" }, probabilities: { "0": 0.05, "1": 0.1, "2": 0.85 }, confidence: 0.8 },
      },
      usage: { input_tokens: 42, output_tokens: 0 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new SubQSnapDecisionProvider({ apiKey: "test-key" });

    const result = await provider.batch(context, {
      toxic: { type: "noul", instructions: "Is this toxic?", criteria: { true: "toxic", false: "not toxic" } },
      service: { type: "choice", instructions: "Classify service", criteria: { class_1: "high hazard", class_2: "other" } },
      severity: { type: "score", instructions: "Rate severity", criteria: ["low", "medium", "high"] },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.subq.ai/v1/systemone");
    expect(request.headers).toMatchObject({ Authorization: "Bearer test-key", "Content-Type": "application/json" });
    expect(JSON.parse(String(request.body))).toMatchObject({ model: "subq-snap-preview", state: context.state });
    expect(result.answers.toxic).toMatchObject({ type: "noul", noul: 0.91 });
    expect(result.answers.service).toMatchObject({ type: "choice", choice: "class_1", confidence: 0.91 });
    expect(result.answers.severity).toMatchObject({ type: "score", score: 1.8, level: 2, label: "high" });
    expect(result.usage).toEqual({ inputTokens: 42, outputTokens: 0 });
  });

  it.each([
    [429, "rate_limit", "Try again later"],
    [422, "validation_error", "Invalid question"],
  ])("maps HTTP %i error envelopes into DecisionProviderError", async (status, errorType, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      detail: { error_type: errorType, message },
    }), { status })));
    const provider = new SubQSnapDecisionProvider({ apiKey: "test-key" });

    await expect(provider.batch(context, {
      check: { type: "noul", instructions: "Check", criteria: { true: "yes", false: "no" } },
    })).rejects.toMatchObject<Partial<DecisionProviderError>>({
      name: "DecisionProviderError",
      statusCode: status,
      providerId: "subq",
      message: expect.stringContaining(message),
    });
  });

  it("rejects invalid batch sizes before dispatch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new SubQSnapDecisionProvider({ apiKey: "test-key" });
    const questions = Object.fromEntries(Array.from({ length: 17 }, (_, index) => [`q${index}`, {
      type: "noul" as const,
      instructions: "Check",
    }]));

    await expect(provider.batch(context, questions)).rejects.toBeInstanceOf(DecisionValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the API model locked to the verified SubQ Snap model", () => {
    expect(() => new SubQSnapDecisionProvider({ apiKey: "test-key", model: "another-model" }))
      .toThrow("SubQ model is locked to subq-snap-preview.");
  });

  it.each([
    ["unrequested choice", { type: "choice", choice: "class_3", probabilities: { class_1: 0.6, class_2: 0.4 }, confidence: 0.8 }],
    ["out-of-range confidence", { type: "choice", choice: "class_1", probabilities: { class_1: 0.6, class_2: 0.4 }, confidence: 1.2 }],
    ["non-finite confidence", { type: "choice", choice: "class_1", probabilities: { class_1: 0.6, class_2: 0.4 }, confidence: Number.NaN }],
    ["mismatched probability keys", { type: "choice", choice: "class_1", probabilities: { class_1: 0.6, class_3: 0.4 }, confidence: 0.8 }],
    ["probabilities not summing to one", { type: "choice", choice: "class_1", probabilities: { class_1: 0.6, class_2: 0.3 }, confidence: 0.8 }],
    ["out-of-range score", { type: "score", score: 2, probabilities: { "0": 0.5, "1": 0.5 }, confidence: 0.8 }],
    ["invalid score confidence", { type: "score", score: 1, probabilities: { "0": 0.5, "1": 0.5 }, confidence: -0.1 }],
    ["invalid score distribution", { type: "score", score: 1, probabilities: { "0": 0.4, "1": 0.4 }, confidence: 0.8 }],
  ])("rejects malformed provider answer: %s", async (_description, answer) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ answers: { response: answer } }), { status: 200 })));
    const provider = new SubQSnapDecisionProvider({ apiKey: "test-key" });
    const question: DecisionBatchQuestions = (answer as { type: string }).type === "score"
      ? { score: { type: "score" as const, instructions: "Rate", criteria: ["low", "high"] } }
      : { response: { type: "choice" as const, instructions: "Choose", criteria: { class_1: "one", class_2: "two" } } };

    await expect(provider.batch(context, question)).rejects.toBeInstanceOf(DecisionProviderError);
  });

  it("restricts production endpoint configuration to the verified SubQ HTTPS origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => new SubQSnapDecisionProvider({ apiKey: "test-key", baseURL: "http://api.subq.ai/v1" }))
      .toThrow("SubQ base URL must use HTTPS");
    expect(() => new SubQSnapDecisionProvider({ apiKey: "test-key", baseURL: "https://attacker.example/v1" }))
      .toThrow("Production SubQ requests must target https://api.subq.ai/v1.");
    vi.stubEnv("SUBQ_BASE_URL", "https://attacker.example/v1");
    expect(() => new SubQSnapDecisionProvider({ apiKey: "test-key" }))
      .toThrow("Production SubQ requests must target https://api.subq.ai/v1.");
  });

  it("allows an HTTPS mock endpoint override only under NODE_ENV=test", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ answers: { check: { type: "noul", noul: 0.8 } } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new SubQSnapDecisionProvider({ apiKey: "test-key", baseURL: "https://mock.example/v1" });
    await provider.batch(context, { check: { type: "noul", instructions: "Check" } });
    expect(fetchMock.mock.calls[0][0]).toBe("https://mock.example/v1/systemone");
    expect(() => new SubQSnapDecisionProvider({ apiKey: "test-key", baseURL: "http://mock.example/v1" }))
      .toThrow("SubQ base URL must use HTTPS");
  });

  it("fails closed with 503 before any network when FLAWCHECK_DISABLE_LLM=1", async () => {
    vi.stubEnv("FLAWCHECK_DISABLE_LLM", "1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new SubQSnapDecisionProvider({ apiKey: "test-key" });
    await expect(provider.noul(context, { instructions: "Check" })).rejects.toMatchObject({
      statusCode: 503,
      providerId: "subq",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
