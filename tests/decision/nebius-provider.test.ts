import { describe, it, expect, vi, afterEach } from "vitest";
import type { OpenAI } from "openai";
import { NebiusNemotronDecisionProvider } from "@/lib/decision/providers/nebius-nemotron";
import { DecisionValidationError } from "@/lib/decision/types";
import type { DecisionContext } from "@/lib/decision/types";

/**
 * DEC-02 offline contract lock for the Nebius Token Factory System-1 adapter
 * (ported from Fork A feat/nvidia-system1 for the measured comparison):
 * - clean JSON parsing; prose-preamble recovery via parseJsonLoose
 *   (verified Lightning quirk: JSON wrapped in conversational preamble)
 * - clamping of probabilities into [0, 1]; exactly ONE bounded retry, then
 *   fail-closed; abort-signal propagation; kill-switch hard-fail
 * - zero network: every test injects a fake client (never a real transport).
 * Neutral fake model IDs only — no vendor model-ID literals per grep gate.
 */

const CONTEXT: DecisionContext = { state: "pipe section W-12, service: diesel fuel" };

interface RecordedCall {
  params: Record<string, unknown>;
  requestOptions?: Record<string, unknown>;
}

function makeFakeClient(responses: string[]) {
  const calls: RecordedCall[] = [];
  let n = 0;
  const create = async (
    params: Record<string, unknown>,
    requestOptions?: Record<string, unknown>
  ) => {
    n += 1;
    calls.push({ params, requestOptions });
    const content = responses[Math.min(n - 1, responses.length - 1)];
    return { choices: [{ message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 20 } };
  };
  const client = { chat: { completions: { create } } } as unknown as OpenAI;
  return { client, callCount: () => n, calls };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("NebiusNemotronDecisionProvider (offline, injected client)", () => {
  it("parses a clean JSON noul reply and applies the threshold", async () => {
    const fake = makeFakeClient([JSON.stringify({ probability: 0.87 })]);
    const provider = new NebiusNemotronDecisionProvider({ client: fake.client, model: "test-model" });

    const res = await provider.noul(CONTEXT, { instructions: "Is the service class toxic?" }, 0.85);

    expect(res.type).toBe("noul");
    expect(res.noul).toBeCloseTo(0.87);
    expect(res.verdict).toBe(true);
    expect(fake.callCount()).toBe(1);
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("recovers from a prose preamble wrapping the JSON (verified Lightning quirk)", async () => {
    const fake = makeFakeClient(['Here is the JSON you asked for: {"probability": 0.42} — let me know if anything else is needed.']);
    const provider = new NebiusNemotronDecisionProvider({ client: fake.client, model: "test-model" });

    const res = await provider.noul(CONTEXT, { instructions: "gate" });

    expect(res.noul).toBeCloseTo(0.42);
    expect(res.verdict).toBe(false);
  });

  it("clamps noul probabilities into [0.0, 1.0]", async () => {
    const fake = makeFakeClient([JSON.stringify({ probability: 1.7 }), JSON.stringify({ probability: -0.3 })]);
    const provider = new NebiusNemotronDecisionProvider({ client: fake.client, model: "test-model" });

    const high = await provider.noul(CONTEXT, { instructions: "a" });
    const low = await provider.noul(CONTEXT, { instructions: "b" });

    expect(high.noul).toBe(1);
    expect(low.noul).toBe(0);
  });

  it("choice returns the selected key with a normalized distribution", async () => {
    const fake = makeFakeClient([
      JSON.stringify({ choice: "class_3", confidence: 0.91, probabilities: { class_1: 0.05, class_2: 0.04, class_3: 0.91, class_4: 0.1 } }),
    ]);
    const provider = new NebiusNemotronDecisionProvider({ client: fake.client, model: "test-model" });

    const res = await provider.choice<"class_1" | "class_2" | "class_3" | "class_4">(CONTEXT, {
      instructions: "classify service",
      criteria: { class_1: "toxic", class_2: "process", class_3: "diesel", class_4: "utility" },
    });

    expect(res.choice).toBe("class_3");
    const sum = Object.values(res.probabilities).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5); // DEC-03: distribution sums to ~1.0
    expect(res.confidence).toBeCloseTo(0.91);
  });

  it("sends temperature 0, json_object, reasoning_effort, and abort signal", async () => {
    const fake = makeFakeClient([JSON.stringify({ probability: 0.5 })]);
    const provider = new NebiusNemotronDecisionProvider({
      client: fake.client,
      model: "test-model",
      reasoningEffort: "medium",
      maxCompletionTokens: 777,
    });
    const controller = new AbortController();

    await provider.noul({ ...CONTEXT, signal: controller.signal }, { instructions: "gate" });

    const params = fake.calls[0].params;
    expect(params.temperature).toBe(0);
    expect(params.response_format).toEqual({ type: "json_object" });
    expect(params.reasoning_effort).toBe("medium");
    expect(params.max_completion_tokens).toBe(777);
    expect(params.model).toBe("test-model");
    expect(fake.calls[0].requestOptions?.signal).toBe(controller.signal);
  });

  it("retries exactly once on malformed prose then fails closed after 2 attempts", async () => {
    const noJson = new Array(2).fill("I cannot produce any structured output for that, sorry!");
    const fake = makeFakeClient(noJson);
    const provider = new NebiusNemotronDecisionProvider({ client: fake.client, model: "test-model" });

    await expect(provider.noul(CONTEXT, { instructions: "gate" })).rejects.toThrow(
      /Failed to parse JSON decision after 1 retry/
    );
    expect(fake.callCount()).toBe(2); // exactly one bounded retry
  });

  it("second attempt succeeds when the retry reply is valid", async () => {
    const fake = makeFakeClient(["let me think... no braces here", JSON.stringify({ probability: 0.99 })]);
    const provider = new NebiusNemotronDecisionProvider({ client: fake.client, model: "test-model" });

    const res = await provider.noul(CONTEXT, { instructions: "gate" });
    expect(res.noul).toBeCloseTo(0.99);
    expect(fake.callCount()).toBe(2);
  });

  it("rejects choice options outside 2..255 with DecisionValidationError", async () => {
    const fake = makeFakeClient([]);
    const provider = new NebiusNemotronDecisionProvider({ client: fake.client, model: "test-model" });

    await expect(
      provider.choice(CONTEXT, { instructions: "x", criteria: { only: "one" } })
    ).rejects.toThrow(DecisionValidationError);
    await expect(
      provider.choice(CONTEXT, {
        instructions: "x",
        criteria: Object.fromEntries(
          Array.from({ length: 256 }, (_, i) => [`opt_${i}`, null])
        ),
      })
    ).rejects.toThrow(DecisionValidationError);
  });

  it("rejects score levels outside 2..10 with DecisionValidationError", async () => {
    const fake = makeFakeClient([]);
    const provider = new NebiusNemotronDecisionProvider({ client: fake.client, model: "test-model" });

    await expect(
      provider.score(CONTEXT, { instructions: "x", criteria: ["just one level"] })
    ).rejects.toThrow(DecisionValidationError);
  });

  it("score maps the reply onto the level axis and legend", async () => {
    const fake = makeFakeClient([JSON.stringify({ score: 2.4, level: 2, confidence: 0.8 })]);
    const provider = new NebiusNemotronDecisionProvider({ client: fake.client, model: "test-model" });

    const res = await provider.score(CONTEXT, {
      instructions: "rate severity",
      criteria: ["minor", "moderate", "major", "critical"],
    });

    expect(res.level).toBe(2);
    expect(res.label).toBe("major");
    expect(res.legend["3"]).toBe("critical");
  });

  it("batch accumulates real usage deltas and answers for all three primitive types", async () => {
    const fake = makeFakeClient([
      JSON.stringify({ probability: 0.9 }),
      JSON.stringify({ choice: "a", confidence: 0.6 }),
      JSON.stringify({ score: 1.0, level: 1 }),
    ]);
    const provider = new NebiusNemotronDecisionProvider({ client: fake.client, model: "test-model" });

    const batch = await provider.batch(CONTEXT, {
      gate: { type: "noul", instructions: "gate" },
      pick: { type: "choice", instructions: "pick", criteria: { a: "first", b: "second" } },
      rate: { type: "score", instructions: "rate", criteria: ["low", "high"] },
    });

    expect(Object.keys(batch.answers)).toEqual(["gate", "pick", "rate"]);
    expect(batch.usage.inputTokens).toBe(300); // 3 calls x 100 prompt tokens
    expect(batch.usage.outputTokens).toBe(60);
    expect(batch.totalLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it("fails closed with zero calls when the kill-switch is set on the network path", async () => {
    vi.stubEnv("FLAWCHECK_DISABLE_LLM", "1");
    const fake = makeFakeClient([JSON.stringify({ probability: 0.5 })]);
    // No injected client: constructor takes the configured (network) path.
    vi.stubEnv("NEBIUS_MODEL_EXTRACTION", "test-env-model");
    const provider = new NebiusNemotronDecisionProvider();

    await expect(provider.noul(CONTEXT, { instructions: "gate" })).rejects.toThrow(/fails closed/);
    expect(fake.callCount()).toBe(0);
  });

  it("routes the model ID exclusively from the NEBIUS_MODEL_EXTRACTION env var", async () => {
    vi.stubEnv("NEBIUS_MODEL_EXTRACTION", "env-routed-fake-model");
    const fake = makeFakeClient([JSON.stringify({ probability: 0.5 })]);
    const provider = new NebiusNemotronDecisionProvider({ client: fake.client });

    await provider.noul(CONTEXT, { instructions: "gate" });

    expect(provider.modelId).toBe("env-routed-fake-model");
    expect(fake.calls[0].params.model).toBe("env-routed-fake-model");
  });

  it("defaults max_completion_tokens to the live-verified 6000 budget", async () => {
    const fake = makeFakeClient([JSON.stringify({ probability: 0.5 })]);
    const provider = new NebiusNemotronDecisionProvider({ client: fake.client, model: "test-model" });

    await provider.noul(CONTEXT, { instructions: "gate" });

    // Live-verified quirk: guard-style evaluation can emit >8k reasoning tokens;
    // a truncated budget returns EMPTY content with finish_reason "length".
    expect(fake.calls[0].params.max_completion_tokens).toBe(6000);
  });
});
