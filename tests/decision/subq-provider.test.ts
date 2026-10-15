import { afterEach, describe, expect, it, vi } from "vitest";
import { DecisionProviderError, DecisionValidationError } from "../../lib/decision/types";
import { SubQSnapDecisionProvider } from "../../lib/decision/providers/subq-snap";

const context = { state: { observation: "test state" } };

describe("SubQSnapDecisionProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends native question types and maps typed answers and usage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      answers: {
        toxic: { type: "noul", noul: 0.91 },
        service: { type: "choice", choice: "class_1", probabilities: { class_1: 0.91, class_2: 0.09 }, confidence: 0.91 },
        severity: { type: "score", score: 1.8, legend: { "2": "high" }, probabilities: { "2": 0.8 }, confidence: 0.8 },
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
});
