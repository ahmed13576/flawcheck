import { describe, it, expect } from "vitest";
import { OUTLIER_Z_THRESHOLD, flagOutliers, modifiedZScores } from "@/lib/calc/outliers";

describe("outliers — G11 modified z-score (median/MAD, Iglewicz-Hoaglin)", () => {
  const population = [8.3, 9.19, 9.2, 9.2, 9.21];

  it("median 9.2 and MAD 0.01", () => {
    const scores = modifiedZScores(population);
    expect(scores.median).toBe(9.2);
    expect(scores.mad).toBe(0.01);
  });

  it("modified z of 8.3 is |60.7050| -> flagged; 9.19 is |0.6745| -> not flagged", () => {
    const scores = modifiedZScores(population);
    const z83 = scores.scores[0];
    const z919 = scores.scores[1];
    expect(Math.abs(z83)).toBe(60.705); // 4 dp canonical
    expect(Math.abs(z919)).toBe(0.6745);
    const flagged = flagOutliers(population.map((value, i) => ({ id: `r${i}`, value })));
    expect(flagged.map((f) => f.id)).toEqual(["r0"]);
    expect(flagged[0].z).toBe(-60.705); // signed z surfaced (8.3 below median)
    expect(flagged[0].median).toBe(9.2);
    expect(flagged[0].mad).toBe(0.01);
  });

  it("populations smaller than 4 readings never flag (n >= 4 required)", () => {
    for (const n of [0, 1, 2, 3]) {
      const values = population.slice(0, n);
      const flagged = flagOutliers(values.map((value, i) => ({ id: `r${i}`, value })));
      expect(flagged).toEqual([]);
    }
  });

  it("MAD 0 yields no flags (degenerate population)", () => {
    const degenerate = [9.2, 9.2, 9.2, 9.2, 100].map((value, i) => ({
      id: `d${i}`,
      value,
    }));
    const flagged = flagOutliers(degenerate);
    expect(flagged).toEqual([]);
  });

  it("OUTLIER_Z_THRESHOLD is the named 3.5 constant (OQ4: engineering code, not criteria JSON)", () => {
    expect(OUTLIER_Z_THRESHOLD).toBe(3.5);
  });
});
