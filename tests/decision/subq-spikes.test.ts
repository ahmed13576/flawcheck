import { afterEach, describe, expect, it, vi } from "vitest";
import { SubQSnapDecisionProvider } from "../../lib/decision/providers/subq-snap";
import { classifyFluidService } from "../../lib/decision/spikes/fluid-classifier";
import { triageFleetBatch, type TriageReading } from "../../lib/decision/spikes/fleet-triage";
import { classifyIndicationMorphology } from "../../lib/decision/spikes/morphology-classifier";
import { verifySemanticGrounding } from "../../lib/decision/spikes/semantic-guard";

function mockSubQ() {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as {
      questions: Record<string, { type: string; criteria?: Record<string, string | null> }>;
      state: unknown;
    };
    const answers: Record<string, unknown> = {};
    for (const [name, question] of Object.entries(request.questions)) {
      if (question.type === "choice") {
        const keys = Object.keys(question.criteria ?? {});
        const selected = keys.includes("class_1") ? "class_1" : keys.includes("tier_1") ? "tier_1" : "linear";
        answers[name] = {
          type: "choice",
          choice: selected,
          probabilities: Object.fromEntries(keys.map((key) => [key, key === selected ? 0.84 : 0.16 / Math.max(keys.length - 1, 1)])),
          confidence: 0.84,
        };
      } else {
        const instructions = (question as { instructions?: string }).instructions ?? "";
        answers[name] = { type: "noul", noul: instructions.toLowerCase().includes("cracking") ? 0.99 : 0.94 };
      }
    }
    return new Response(JSON.stringify({ answers, usage: { input_tokens: 10, output_tokens: 0 } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("SubQ domain spike contracts (mocked API)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("Spike A: uses the 0.85 fail-closed fluid confidence gate", async () => {
    mockSubQ();
    const result = await classifyFluidService(new SubQSnapDecisionProvider({ apiKey: "test-key" }), "chlorine process stream");

    expect(result.pipingClass).toBe("class_1");
    expect(result.confidence).toBe(0.84);
    expect(result.failClosedReviewRequired).toBe(true);
    expect(result.citation).toBe("api570_6_3_4");
  });

  it("Spike B: screens a 4,912-row register while deterministic critical cases bypass the provider", async () => {
    const fetchMock = mockSubQ();
    const provider = new SubQSnapDecisionProvider({ apiKey: "test-key" });
    const readings: TriageReading[] = Array.from({ length: 4_912 }, (_, index) => index === 4_911
      ? { cmlId: `CML-${index}`, component: "synthetic test row", tActualMm: 9, tRequiredMm: 5, remainingLifeYears: 12 }
      : { cmlId: `CML-${index}`, component: "synthetic deterministic critical row", tActualMm: 5, tRequiredMm: 5, remainingLifeYears: 12 });

    const summary = await triageFleetBatch(provider, readings);

    expect(summary.totalReadings).toBe(4_912);
    expect(summary.deterministicOverrides).toBe(4_911);
    expect(summary.results.at(-1)?.tier).toBe("tier_1");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("Spike C: applies deterministic linear geometry and evaluates an image with the native provider", async () => {
    const fetchMock = mockSubQ();
    const result = await classifyIndicationMorphology(new SubQSnapDecisionProvider({ apiKey: "test-key" }), {
      dimensionLengthMm: 6,
      dimensionWidthMm: 1,
      inspectorNotes: "Dye penetrant indication with visible edge",
      image: { mediaType: "image/png", base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p1sAAAAASUVORK5CYII=" },
    });

    expect(result.morphology).toBe("linear");
    expect(result.asmeVerdict).toBe("REJECT");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(firstBody.images[0]).toEqual({ mediaType: "image/png", base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p1sAAAAASUVORK5CYII=" });
  });

  it("Spike D: fails closed below the semantic guard confidence threshold", async () => {
    mockSubQ();
    const result = await verifySemanticGrounding(new SubQSnapDecisionProvider({ apiKey: "test-key" }), {
      narrativeText: "The measured value is 9.0 mm under ASME B31.3.",
      facts: { tActualMm: 9, governingCitation: "asme_b31_3_344_4_2" },
      allowlistedCitations: ["asme_b31_3_344_4_2"],
    });

    expect(result.confidence).toBe(0.94);
    expect(result.isGrounded).toBe(false);
  });
});
