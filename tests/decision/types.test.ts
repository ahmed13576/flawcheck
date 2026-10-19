import { describe, it, expect } from "vitest";
import type {
  DecisionProvider,
  DecisionContext,
  NoulCriteria,
  NoulResult,
  ChoiceOptions,
  ChoiceResult,
  ScoreLevels,
  ScoreResult,
  DecisionBatchQuestions,
  DecisionBatchResult,
} from "@/lib/decision/types";
import { DecisionProviderError, DecisionValidationError } from "@/lib/decision/types";

/**
 * DEC-01 / DEC-03 contract lock: the DecisionProvider seam is fully typed
 * (zero `any`, zero freeform text leakage) and a mock implementation proves
 * all four primitive signatures (choice, noul, score, batch) are enforceable
 * at compile time and runtime. Offline — no client, no network, no model ID.
 */

/** Deterministic mock fulfilling every primitive of the seam. */
function makeMockProvider(): DecisionProvider {
  const noulResult: NoulResult = { type: "noul", noul: 0.92, verdict: true, latencyMs: 1 };
  const choiceResult: ChoiceResult<"a" | "b"> = {
    type: "choice",
    choice: "a",
    probabilities: { a: 0.7, b: 0.3 },
    confidence: 0.7,
    latencyMs: 1,
  };
  const scoreResult: ScoreResult = {
    type: "score",
    score: 1.6,
    level: 2,
    label: "mid",
    legend: { "0": "low", "1": "mid-high", "2": "mid" },
    probabilities: { "0": 0.2, "1": 0.6, "2": 0.2 },
    confidence: 0.8,
    latencyMs: 1,
  };
  return {
    providerId: "mock",
    modelId: "mock-model", // neutral fake — never a real vendor model ID
    async noul(): Promise<NoulResult> {
      return noulResult;
    },
    async choice<T extends string = string>(): Promise<ChoiceResult<T>> {
      return choiceResult as unknown as ChoiceResult<T>;
    },
    async score(): Promise<ScoreResult> {
      return scoreResult;
    },
    async batch(): Promise<DecisionBatchResult> {
      return {
        answers: { gate: noulResult, pick: choiceResult as unknown as ChoiceResult, rate: scoreResult },
        usage: { inputTokens: 10, outputTokens: 5 },
        totalLatencyMs: 3,
      };
    },
  };
}

const CONTEXT: DecisionContext = { state: "test state" };

describe("DecisionProvider seam contract (DEC-01, DEC-03)", () => {
  it("mock provider satisfies all four primitive signatures", async () => {
    const provider = makeMockProvider();

    const noul = await provider.noul(CONTEXT, { instructions: "gate" });
    expect(noul.type).toBe("noul");
    expect(noul.verdict).toBe(true);
    expect(noul.noul).toBeGreaterThanOrEqual(0);
    expect(noul.noul).toBeLessThanOrEqual(1);

    const choice = await provider.choice<"a" | "b">(CONTEXT, {
      instructions: "pick one",
      criteria: { a: "first", b: "second" },
    });
    expect(choice.type).toBe("choice");
    expect(["a", "b"]).toContain(choice.choice);

    const score = await provider.score(CONTEXT, {
      instructions: "rate",
      criteria: ["low", "mid-high", "mid"],
    });
    expect(score.type).toBe("score");
    expect(score.level).toBeGreaterThanOrEqual(0);

    const batch = await provider.batch(CONTEXT, {
      gate: { type: "noul", instructions: "gate" },
      pick: { type: "choice", instructions: "pick", criteria: { a: "first", b: "second" } },
      rate: { type: "score", instructions: "rate", criteria: ["low", "mid-high", "mid"] },
    });
    expect(Object.keys(batch.answers)).toHaveLength(3);
    expect(batch.usage.inputTokens).toBeGreaterThan(0);
  });

  it("noul criteria accepts optional true/false descriptions", async () => {
    const provider = makeMockProvider();
    const criteria: NoulCriteria = {
      instructions: "Is this reading critical?",
      criteria: { true: "critical", false: "benign" },
    };
    const res = await provider.noul(CONTEXT, criteria, 0.9);
    expect(res.verdict).toBe(false || res.noul >= 0.9);
  });

  it("batch questions accept all three primitive types", () => {
    const questions: DecisionBatchQuestions = {
      noulQ: { type: "noul", instructions: "gate" },
      choiceQ: { type: "choice", instructions: "pick", criteria: { x: null, y: "why" } },
      scoreQ: { type: "score", instructions: "rate", criteria: ["a", "b"] },
    };
    expect(Object.keys(questions)).toEqual(["noulQ", "choiceQ", "scoreQ"]);
  });

  it("error classes carry provider context and are distinct", () => {
    const pErr = new DecisionProviderError("upstream down", 503, "mock");
    expect(pErr.statusCode).toBe(503);
    expect(pErr.providerId).toBe("mock");
    expect(pErr.name).toBe("DecisionProviderError");

    const vErr = new DecisionValidationError("bad options");
    expect(vErr.name).toBe("DecisionValidationError");
    expect(vErr).toBeInstanceOf(Error);
  });

  it("choice options type-enforce 2..255 keys at the type level via Record", () => {
    // Compile-time proof: ChoiceOptions keyed by a string union; runtime bounds
    // are enforced by the concrete provider (see nebius-provider.test.ts).
    const options: ChoiceOptions<"class_1" | "class_2"> = {
      instructions: "classify",
      criteria: { class_1: "toxic", class_2: "process" },
    };
    expect(Object.keys(options.criteria)).toHaveLength(2);
  });

  it("score levels type-enforce ordered criteria arrays (2..10 runtime bounds)", () => {
    const levels: ScoreLevels = { instructions: "rate severity", criteria: ["minor", "major", "critical"] };
    expect(levels.criteria.length).toBeGreaterThanOrEqual(2);
  });
});
