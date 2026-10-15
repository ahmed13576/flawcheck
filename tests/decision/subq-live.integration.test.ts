import { afterEach, describe, expect, it, vi } from "vitest";
import { SubQSnapDecisionProvider } from "../../lib/decision/providers/subq-snap";
import { classifyFluidService } from "../../lib/decision/spikes/fluid-classifier";
import { triageReading } from "../../lib/decision/spikes/fleet-triage";
import { classifyIndicationMorphology } from "../../lib/decision/spikes/morphology-classifier";
import { verifySemanticGrounding } from "../../lib/decision/spikes/semantic-guard";

const liveSubQEnabled = process.env.FLAWCHECK_LIVE_SUBQ === "1";

describe.skipIf(!liveSubQEnabled)("SubQ live integration (synthetic states only)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("maps native primitives and exercises the four fail-closed spike paths", async () => {
    const apiKey = process.env.SUBQ_API_KEY;
    expect(apiKey, "SUBQ_API_KEY must be configured to run this gated integration test").toBeTruthy();
    const provider = new SubQSnapDecisionProvider({ apiKey, baseURL: "https://api.subq.ai/v1" });
    const actualFetch = globalThis.fetch.bind(globalThis);
    let apiRequestCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      apiRequestCount++;
      return actualFetch(input, init);
    });

    // One request verifies all three native SubQ answer mappings.
    const primitives = await provider.batch({ state: { fixture: "synthetic API contract check; no inspection data" } }, {
      binary_check: {
        type: "noul",
        instructions: "Does the supplied synthetic fixture contain the word synthetic?",
        criteria: { true: "It contains synthetic.", false: "It does not contain synthetic." },
      },
      category_check: {
        type: "choice",
        instructions: "Choose the option that matches the fixture label.",
        criteria: { synthetic: "The fixture is synthetic.", real: "The fixture is real inspection data." },
      },
      level_check: {
        type: "score",
        instructions: "Rate whether a test fixture is suitable for exercising a provider schema.",
        criteria: ["not suitable", "partly suitable", "suitable"],
      },
    });
    expect(primitives.answers.binary_check).toMatchObject({ type: "noul" });
    expect(primitives.answers.category_check).toMatchObject({ type: "choice" });
    expect(primitives.answers.level_check).toMatchObject({ type: "score" });
    expect(primitives.usage.outputTokens).toBe(0);

    const fluid = await classifyFluidService(
      provider,
      "Synthetic ambiguous test stream: label 'fixture-fluid'; no composition, volatility, toxicity, or operating conditions supplied.",
    );
    expect(Number.isFinite(fluid.confidence)).toBe(true);
    expect(fluid.confidence).toBeLessThan(0.85);
    expect(fluid.failClosedReviewRequired).toBe(true);

    // A deterministic critical thickness condition must fail closed without a model call.
    const triage = await triageReading(provider, {
      cmlId: "SYNTHETIC-CML-01",
      component: "synthetic test pipe",
      tActualMm: 1,
      tRequiredMm: 2,
      remainingLifeYears: 20,
    });
    expect(triage).toMatchObject({ tier: "tier_3", urgency: "immediate", isDeterministicOverride: true });

    const morphology = await classifyIndicationMorphology(provider, {
      dimensionLengthMm: 6,
      dimensionWidthMm: 1,
      inspectorNotes: "Synthetic test indication only; no image supplied.",
    });
    expect(morphology.morphology).toBe("linear");
    expect(morphology.asmeVerdict).toBe("REJECT");

    const semantic = await verifySemanticGrounding(provider, {
      narrativeText: "Synthetic test report: measured thickness is 99 mm.",
      facts: { tActualMm: 9 },
      allowlistedCitations: [],
    });
    expect(semantic.isGrounded).toBe(false);
    expect(apiRequestCount).toBe(5);
  }, 30_000);
});
