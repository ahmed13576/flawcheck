import { describe, it, expect } from "vitest";
import { evaluateIndication } from "@/lib/calc/ptmt";
import { criteria } from "@/lib/calc/criteria";
import type { PtmIndication } from "@/lib/ingest/session";

function ind(overrides: Partial<PtmIndication>): PtmIndication {
  return {
    id: "ind-1",
    method: "MT",
    morphology: "rounded",
    lengthMm: 2.0,
    widthMm: 1.8,
    count: 1,
    edgeSeparationMm: null,
    crackSuspect: false,
    ...overrides,
  };
}

describe("ptmt — P1-P7 golden catalog (ptmt-criteria.json verbatim limits)", () => {
  it("P1: MT L 4.2 W 0.8 -> reject + clause asme_b31_3_344_3_2 (relevant 4.2 > 1.5; linear 4.2 > 3*2.4)", () => {
    const result = evaluateIndication(
      ind({ method: "MT", morphology: "linear", lengthMm: 4.2, widthMm: 0.8 }),
    );
    expect(result.verdict).toBe("reject");
    expect(result.citationId).toBe("asme_b31_3_344_3_2");
    expect(result.detail).toBe(
      "Relevant linear indications are rejected — escalate to Level 2/3 inspector evaluation.",
    );
  });

  it("P2: PT L 2.0 W 1.9 -> accept (relevant, rounded, within the rounded limit)", () => {
    const result = evaluateIndication(
      ind({ method: "PT", morphology: "rounded", lengthMm: 2.0, widthMm: 1.9 }),
    );
    expect(result.verdict).toBe("accept");
    expect(result.citationId).toBe("asme_b31_3_344_4_2");
  });

  it("P3: PT L 6.0 W 5.5 -> reject (rounded but over the limit; 6.0 <= 16.5 so still rounded)", () => {
    const result = evaluateIndication(
      ind({ method: "PT", morphology: "rounded", lengthMm: 6.0, widthMm: 5.5 }),
    );
    expect(result.verdict).toBe("reject");
    expect(result.detail).toBe("Rounded indication exceeds 5.0 mm limit.");
  });

  it("P4: MT L 1.5 W 1.2 -> accept as non-relevant (max dim exactly 1.5 is NOT > 1.5 — strict)", () => {
    const result = evaluateIndication(
      ind({ method: "MT", lengthMm: 1.5, widthMm: 1.2 }),
    );
    expect(result.verdict).toBe("accept");
    expect(result.detail).toBe(
      `Non-relevant per relevance threshold (${criteria.ptmt.relevance_threshold_mm} mm).`,
    );
  });

  it("P5: MT L 1.2 W 0.9 crack-suspect -> re_check (the only inferred mapping, per UI-SPEC)", () => {
    const result = evaluateIndication(
      ind({ method: "MT", lengthMm: 1.2, widthMm: 0.9, crackSuspect: true }),
    );
    expect(result.verdict).toBe("re_check");
    expect(result.detail).toBe("Verify crack-suspect indication with Level 2/3 inspector.");
  });

  it("P6a: rounded count 4 sep 1.2 -> reject aligned cluster", () => {
    const result = evaluateIndication(
      ind({ morphology: "rounded", count: 4, edgeSeparationMm: 1.2 }),
    );
    expect(result.verdict).toBe("reject");
    expect(result.detail).toBe(
      `Aligned rounded cluster: 4 indications within ${criteria.ptmt.limits.aligned_rounded_cluster.max_separation_edge_to_edge_mm} mm separation.`,
    );
  });

  it("P6b: rounded count 3 sep 1.2 -> per-size verdict (below cluster threshold)", () => {
    const result = evaluateIndication(
      ind({ morphology: "rounded", count: 3, edgeSeparationMm: 1.2 }),
    );
    expect(result.verdict).toBe("accept");
  });

  it("P6c: rounded count 4 sep 1.6 -> per-size verdict (sep == 1.5 IS a cluster — strict <=; 1.6 is not)", () => {
    const result = evaluateIndication(
      ind({ morphology: "rounded", count: 4, edgeSeparationMm: 1.6 }),
    );
    expect(result.verdict).toBe("accept");
  });

  it("P7a: L 3.0 W 1.0 -> accept (L == 3W is rounded — linear is strictly L > 3W)", () => {
    const result = evaluateIndication(ind({ lengthMm: 3.0, widthMm: 1.0 }));
    expect(result.verdict).toBe("accept");
  });

  it("P7b: L 3.1 W 1.0 -> reject (now linear)", () => {
    const result = evaluateIndication(
      ind({ morphology: "linear", lengthMm: 3.1, widthMm: 1.0 }),
    );
    expect(result.verdict).toBe("reject");
  });
});

describe("ptmt — citation ids resolve against citations.json", () => {
  it("every method maps to a citation id present in the allowlist", () => {
    const known = new Set(criteria.citations.map((c) => c.id as string));
    for (const method of ["MT", "PT"] as const) {
      for (const crackSuspect of [false, true]) {
        const result = evaluateIndication(
          ind({ method, crackSuspect, lengthMm: 0.9, widthMm: 0.5 }),
        );
        expect(known.has(result.citationId)).toBe(true);
      }
    }
  });
});
