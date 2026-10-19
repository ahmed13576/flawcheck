import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyFluidService, API_570_TABLE_1_CRITERIA, type Api570PipingClass } from "@/lib/decision/spikes/fluid-classifier";
import { triageReading, triageFleetBatch, type TriageReading, type TriageTier } from "@/lib/decision/spikes/fleet-triage";
import { classifyIndicationMorphology, type MorphologyType } from "@/lib/decision/spikes/morphology-classifier";
import { verifySemanticGrounding, findUnauthorizedCitations, type SemanticGuardInput } from "@/lib/decision/spikes/semantic-guard";
import type { DecisionProvider, DecisionContext, NoulCriteria, ChoiceOptions, ScoreLevels } from "@/lib/decision/types";
import type { NoulResult, ChoiceResult, ScoreResult } from "@/lib/decision/types";

/**
 * SPIKE-01..04 offline verification: every test drives the spike through a
 * scripted DecisionProvider double (no client, no network, no model ID).
 * The scripted double is the "model under test"; the fail-closed gates,
 * deterministic overrides, and grounding layers are the system under test.
 */

// ---------------------------------------------------------------- scriptable provider

interface ScriptedRules {
  choice?: (context: DecisionContext, options: ChoiceOptions<string>) => { choice: string; confidence: number };
  noul?: (context: DecisionContext, criteria: NoulCriteria) => { probability: number };
}

function scriptedProvider(rules: ScriptedRules): DecisionProvider {
  const noulResult = (probability: number): NoulResult => ({
    type: "noul",
    noul: probability,
    verdict: probability >= 0.5,
    latencyMs: 1,
  });
  return {
    providerId: "scripted",
    modelId: "scripted-fake-model", // neutral fake — never a real vendor model ID
    async noul(context, criteria): Promise<NoulResult> {
      return noulResult(rules.noul?.(context, criteria)?.probability ?? 0.5);
    },
    async choice<T extends string = string>(context: DecisionContext, options: ChoiceOptions<T>): Promise<ChoiceResult<T>> {
      const keys = Object.keys(options.criteria) as T[];
      const scripted = rules.choice?.(context, options as unknown as ChoiceOptions<string>);
      const pick = (scripted && keys.includes(scripted.choice as T) ? scripted.choice : keys[0]) as T;
      const confidence = scripted ? Math.max(0, Math.min(1, scripted.confidence)) : 0.5;
      const probabilities = {} as Record<T, number>;
      for (const k of keys) probabilities[k] = k === pick ? confidence : (1 - confidence) / (keys.length - 1 || 1);
      return { type: "choice", choice: pick, probabilities, confidence, latencyMs: 1 };
    },
    async score(_context, levels): Promise<ScoreResult> {
      return { type: "score", score: 0, level: 0, label: levels.criteria[0] ?? "", legend: {}, probabilities: {}, confidence: 0.5, latencyMs: 1 };
    },
    async batch(): Promise<{ answers: Record<string, NoulResult | ChoiceResult | ScoreResult>; usage: { inputTokens: number; outputTokens: number }; totalLatencyMs: number }> {
      throw new Error("batch not scripted");
    },
  };
}

afterEach(() => vi.unstubAllEnvs());

// ---------------------------------------------------------------- SPIKE-01 fluid classifier

// The scripted double reads context.state directly: a keyword model standing
// in for a well-calibrated System-1 fluid classifier.
function fluidModelProvider(): DecisionProvider {
  return scriptedProvider({
    choice: (context) => {
      const desc = String(context.state).toLowerCase();
      // Ambiguous / mixed-stream cases deliberately trigger LOW confidence
      // (fail-closed) — the real model would also be unsure here.
      const ambiguous =
        desc.includes("mixed") || desc.includes("unknown") || desc.includes("intermittent");
      // Toxic class-1 keywords dominate.
      if (/h2s|hf\b|chlorine|autorefrigerat|public waterway|toxic/.test(desc) && !ambiguous) {
        if (/trace|h2s at 2%|below 3/.test(desc)) {
          // borderline toxic: confidently NOT class_1 but the note is borderline — model is unsure
          return { choice: "class_2", confidence: 0.6 };
        }
        return { choice: "class_1", confidence: 0.93 };
      }
      if (/steam|compressed air|nitrogen|potable|cooling water|instrument air/.test(desc) && !ambiguous) {
        return { choice: "class_4", confidence: 0.95 };
      }
      if (/diesel|lube oil|kerosene|below.*flash point|storage transfer/.test(desc) && !ambiguous) {
        return { choice: "class_3", confidence: 0.92 };
      }
      if (/hydrocarbon|hydrogen|acid|caustic|process unit|below.*boiling|amine|solvent/.test(desc) && !ambiguous) {
        return { choice: "class_2", confidence: 0.9 };
      }
      // Anything unrecognized or mixed → low confidence (fail-closed).
      return { choice: desc.includes("steam") ? "class_4" : "class_2", confidence: 0.55 };
    },
  });
}

interface CuratedCase {
  description: string;
  expected: Api570PipingClass;
  expectReview?: boolean;
}

/** 20 curated NDT process-fluid cases (SPIKE-01: >=95% on clear, flag on ambiguous). */
const CURATED_FLUID_CASES: CuratedCase[] = [
  { description: "Dry gas with H2S at 8 mol%, autorefrigerates on release", expected: "class_1" },
  { description: "Anhydrous HF acid sampling line", expected: "class_1" },
  { description: "Chlorine transfer piping", expected: "class_1" },
  { description: "Sour gas line crossing a public waterway", expected: "class_1" },
  { description: "Amine contactor overhead, toxic gas carryover", expected: "class_1" },
  { description: "Process unit hydrogen header at 1200 psig", expected: "class_2" },
  { description: "Caustic injection line", expected: "class_2" },
  { description: "Hydrocarbon feed below boiling point, on-site", expected: "class_2" },
  { description: "Sulphuric acid distribution header", expected: "class_2" },
  { description: "Rich amine solvent line", expected: "class_2" },
  { description: "Diesel fuel oil recirculation line", expected: "class_3" },
  { description: "Lube oil storage transfer below flash point", expected: "class_3" },
  { description: "Kerosene product rundown", expected: "class_3" },
  { description: "Fuel oil off-site transfer below flash point", expected: "class_3" },
  { description: "Saturated steam header at 600 psig", expected: "class_4" },
  { description: "Instrument compressed air drop", expected: "class_4" },
  { description: "Nitrogen blanketing line", expected: "class_4" },
  { description: "Potable water supply", expected: "class_4" },
  { description: "Intermittent service: unknown slop between diesel and caustic", expected: "class_2", expectReview: true },
  { description: "Mixed stream, unrecognized composition from decommissioned drum", expected: "class_2", expectReview: true },
];

describe("SPIKE-01 — API 570 fluid classifier", () => {
  it("classifies clear cases at >=95% accuracy over the 20-case suite", async () => {
    const provider = fluidModelProvider();
    let correct = 0;
    let clear = 0;
    for (const c of CURATED_FLUID_CASES) {
      const res = await classifyFluidService(provider, c.description);
      if (!c.expectReview) {
        clear++;
        if (res.pipingClass === c.expected) correct++;
      }
    }
    expect(clear).toBe(18);
    expect(correct / clear).toBeGreaterThanOrEqual(0.95);
  });

  it("trips the fail-closed inspector flag for ambiguous and borderline-toxic cases", async () => {
    const provider = fluidModelProvider();
    for (const c of CURATED_FLUID_CASES.filter((x) => x.expectReview)) {
      const res = await classifyFluidService(provider, c.description);
      expect(res.failClosedReviewRequired).toBe(true);
    }
  });

  it("flags any classification below the 0.85 threshold (fail-closed contract)", async () => {
    const provider = scriptedProvider({
      choice: () => ({ choice: "class_2", confidence: 0.84 }),
    });
    const res = await classifyFluidService(provider, "caustic line");
    expect(res.failClosedReviewRequired).toBe(true);
  });

  it("exposes the API 570 citation and full criteria set", () => {
    expect(Object.keys(API_570_TABLE_1_CRITERIA)).toHaveLength(4);
    const provider = scriptedProvider({ choice: () => ({ choice: "class_3", confidence: 0.9 }) });
    return classifyFluidService(provider, "diesel").then((res) => {
      expect(res.citation).toBe("api570_6_3_4");
    });
  });
});

// ---------------------------------------------------------------- SPIKE-02 fleet triage

const BASE_READING: TriageReading = {
  cmlId: "CML-001",
  component: "Line 4\"",
  tActualMm: 10,
  tRequiredMm: 8,
};

function readingAt(over: Partial<TriageReading>): TriageReading {
  return { ...BASE_READING, ...over };
}

describe("SPIKE-02 — high-throughput fleet triage", () => {
  it("hardwires deterministic failures to tier_3 without any model call", async () => {
    let modelCalls = 0;
    const provider = scriptedProvider({
      choice: () => {
        modelCalls++;
        return { choice: "tier_1", confidence: 0.99 };
      },
    });

    const below = await triageReading(provider, readingAt({ tActualMm: 7.9, tRequiredMm: 8 }));
    const nan = await triageReading(provider, readingAt({ tActualMm: Number.NaN }));
    const inf = await triageReading(provider, readingAt({ tActualMm: Number.POSITIVE_INFINITY }));
    const shortLife = await triageReading(provider, readingAt({ remainingLifeYears: 3.2 }));

    for (const res of [below, nan, inf, shortLife]) {
      expect(res.tier).toBe("tier_3");
      expect(res.urgency).toBe("immediate");
      expect(res.isDeterministicOverride).toBe(true);
    }
    expect(modelCalls).toBe(0); // zero model calls for deterministic cases
  });

  it("routes ambiguous readings into tiers 1–3 via the model with correct urgency", async () => {
    const provider = scriptedProvider({
      choice: (_ctx, options) => {
        // Script from the tier criteria keys themselves: the double picks the
        // tier whose description the caller embeds in the instructions.
        void options;
        return { choice: "tier_2", confidence: 0.88 };
      },
    });
    const res = await triageReading(provider, readingAt({ tActualMm: 10, tRequiredMm: 8, remainingLifeYears: 7 }));
    expect(res.tier).toBe("tier_2");
    expect(res.urgency).toBe("scheduled");
    expect(res.isDeterministicOverride).toBe(false);
  });

  it("screens the full 4,912-reading Zenodo register without crash or non-finite leakage", async () => {
    const fixturePath = join(__dirname, "..", "..", "lib", "demo", "fixtures", "zenodo-16780668-ut-register.json");
    const rows = JSON.parse(readFileSync(fixturePath, "utf8")) as Array<{
      Reading_ID: string;
      Tank: string;
      Original_Scantling_mm: number | string;
      Measured_Thickness_mm: number | string;
    }>;
    expect(rows).toHaveLength(4912);

    // t_required = original scantling minus the verified corrosion allowance;
    // measured below scantling is the realistic ballast-tank regime.
    const readings: TriageReading[] = rows.map((r) => ({
      cmlId: `CML-${r.Reading_ID}`,
      component: `Tank ${r.Tank}`,
      tActualMm: Number(r.Measured_Thickness_mm),
      tRequiredMm: Number(r.Original_Scantling_mm) - 2,
    }));

    const provider = scriptedProvider({
      choice: () => ({ choice: "tier_1", confidence: 0.9 }),
    });

    const summary = await triageFleetBatch(provider, readings);

    expect(summary.totalReadings).toBe(4912);
    expect(summary.results).toHaveLength(4912);
    expect(Number.isFinite(summary.elapsedMs)).toBe(true);
    for (const r of summary.results) {
      expect(["tier_1", "tier_2", "tier_3"]).toContain(r.tier);
      expect(Number.isFinite(r.confidence)).toBe(true);
    }
    // Deterministic screening count is computed from the raw data itself:
    // a reading is overridden iff measured <= t_required (scantling − 2 mm
    // allowance) or non-finite. The register's corrosion regime (measured
    // between scantling and scantling − 2) may yield zero overrides — the
    // count must simply match the pure-TS rule applied to the raw rows.
    const expectedOverrides = readings.filter(
      (r) => !Number.isFinite(r.tActualMm) || r.tActualMm <= r.tRequiredMm
    ).length;
    expect(summary.deterministicOverrides).toBe(expectedOverrides);
    expect(summary.tier1Count + summary.tier2Count + summary.tier3Count).toBe(4912);
  });

  it("counts every tier and deterministic override exactly once across a mixed batch", async () => {
    const provider = scriptedProvider({
      choice: (context) => {
        const s = JSON.stringify(context.state);
        return { choice: s.includes('"RL15"') ? "tier_1" : "tier_2", confidence: 0.9 };
      },
    });
    const readings: TriageReading[] = [
      readingAt({ cmlId: "RL15", tActualMm: 10, tRequiredMm: 8, remainingLifeYears: 15 }),
      readingAt({ cmlId: "RL7", tActualMm: 10, tRequiredMm: 8, remainingLifeYears: 7 }),
      readingAt({ cmlId: "BELOW", tActualMm: 7, tRequiredMm: 8 }),
      readingAt({ cmlId: "NAN", tActualMm: Number.NaN }),
    ];
    const summary = await triageFleetBatch(provider, readings);
    expect(summary.tier1Count).toBe(1);
    expect(summary.tier2Count).toBe(1);
    expect(summary.tier3Count).toBe(2);
    expect(summary.deterministicOverrides).toBe(2);
  });
});

// ---------------------------------------------------------------- SPIKE-03 morphology

function morphologyProvider(opts?: { crackProbability?: number; morphology?: MorphologyType }): DecisionProvider {
  return scriptedProvider({
    choice: () => ({ choice: opts?.morphology ?? "rounded", confidence: 0.9 }),
    noul: () => ({ probability: opts?.crackProbability ?? 0.1 }),
  });
}

describe("SPIKE-03 — ASME B31.3 PT/MT morphology classifier", () => {
  it("rejects 100% of crack-note indications — zero false negatives", async () => {
    const provider = morphologyProvider({ crackProbability: 0.9 });
    const res = await classifyIndicationMorphology(
      provider,
      { dimensionLengthMm: 3, dimensionWidthMm: 2.5, inspectorNotes: "sharp crack-like tip, lack of fusion suspected" },
      "pt"
    );
    expect(res.asmeVerdict).toBe("REJECT");
    expect(res.isCrackSuspect).toBe(true);
    expect(res.citation).toBe("asme_b31_3_344_4_2");
  });

  it("forces linear when geometry says L > 3W even if the model says rounded", async () => {
    const provider = morphologyProvider({ morphology: "rounded" });
    const res = await classifyIndicationMorphology(provider, { dimensionLengthMm: 8, dimensionWidthMm: 2 });
    expect(res.morphology).toBe("linear"); // deterministic override
    expect(res.asmeVerdict).toBe("REJECT");
  });

  it("classifies the L == 3W boundary as rounded per the code definition", async () => {
    const provider = morphologyProvider({ morphology: "rounded" });
    const res = await classifyIndicationMorphology(provider, { dimensionLengthMm: 4.5, dimensionWidthMm: 1.5 });
    expect(res.morphology).toBe("rounded"); // 4.5 == 3 * 1.5, NOT strictly linear
    expect(res.asmeVerdict).toBe("ACCEPT");
  });

  it("accepts sub-threshold non-relevant indications", async () => {
    const provider = morphologyProvider();
    const res = await classifyIndicationMorphology(provider, { dimensionLengthMm: 0.8, dimensionWidthMm: 0.5 });
    expect(res.isRelevant).toBe(false);
    expect(res.asmeVerdict).toBe("ACCEPT");
  });

  it("rejects oversized rounded indications above the criteria maximum", async () => {
    const provider = morphologyProvider({ morphology: "rounded" });
    const res = await classifyIndicationMorphology(provider, { dimensionLengthMm: 6, dimensionWidthMm: 4 });
    expect(res.asmeVerdict).toBe("REJECT");
    expect(res.rejectionReason).toMatch(/maximum acceptable/i);
  });

  it("routes MT method to the MT citation", async () => {
    const provider = morphologyProvider();
    const res = await classifyIndicationMorphology(provider, { dimensionLengthMm: 2, dimensionWidthMm: 1 }, "mt");
    expect(res.citation).toBe("asme_b31_3_344_3_2");
  });
});

// ---------------------------------------------------------------- SPIKE-04 semantic guard

const CLEAN_FACTS = { tRequiredMm: 7.82, tActualMm: 9.4, remainingLifeYears: 12.5 };

const CLEAN_NARRATIVE =
  "The governing required thickness is 7.82 mm per API 570 7.1.2, and the measured thickness of 9.4 mm exceeds it. " +
  "Remaining life is 12.5 years per API 570 6.3.3. Verdict: accept.";

const GUARD_INPUT: SemanticGuardInput = {
  narrativeText: CLEAN_NARRATIVE,
  facts: CLEAN_FACTS,
};

describe("SPIKE-04 — semantic guardrail", () => {
  it("passes a verified clean report (grounded numbers and allowlisted citations)", async () => {
    const provider = scriptedProvider({ noul: () => ({ probability: 0.98 }) });
    const res = await verifySemanticGrounding(provider, GUARD_INPUT);
    expect(res.isGrounded).toBe(true);
    expect(res.unauthorizedCitations).toEqual([]);
    expect(res.numberMismatches).toEqual([]);
    expect(res.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it("rejects a hallucinated, unallowlisted citation regardless of model confidence", async () => {
    const provider = scriptedProvider({ noul: () => ({ probability: 0.99 }) });
    const res = await verifySemanticGrounding(provider, {
      ...GUARD_INPUT,
      narrativeText: CLEAN_NARRATIVE.replace("API 570 7.1.2", "API 579 9.1.2"),
    });
    expect(res.unauthorizedCitations.length).toBeGreaterThan(0);
    expect(res.isGrounded).toBe(false);
  });

  it("rejects a falsified calculation number omitted from the narrative", async () => {
    const provider = scriptedProvider({ noul: () => ({ probability: 0.99 }) });
    const res = await verifySemanticGrounding(provider, {
      ...GUARD_INPUT,
      narrativeText: CLEAN_NARRATIVE.replace("7.82 mm", "7.41 mm"),
    });
    expect(res.numberMismatches.length).toBeGreaterThan(0);
    expect(res.isGrounded).toBe(false);
  });

  it("fails closed when the semantic gate reports low grounding probability", async () => {
    const provider = scriptedProvider({ noul: () => ({ probability: 0.55 }) });
    const res = await verifySemanticGrounding(provider, GUARD_INPUT);
    expect(res.isGrounded).toBe(false); // p < 0.95 even with clean deterministic layers
  });

  it("detects unallowlisted citations deterministically without any model", () => {
    expect(findUnauthorizedCitations("See API 579 clause 9.1 for fitness-service.")).toHaveLength(1);
    expect(findUnauthorizedCitations("Evaluated per ASME B31.3 §344.3.2.")).toEqual([]);
    expect(findUnauthorizedCitations("Thickness per API 574 10.5.1.4.")).toEqual([]);
  });
});
