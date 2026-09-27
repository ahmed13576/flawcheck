import { describe, it, expect } from "vitest";
import { assertUnitsDeclared, EvaluationInputError } from "@/lib/ingest/session";
import { toMm } from "@/lib/calc/units";

/**
 * ING-05 engine-side gate (Plan 02-03 Task 3):
 * - units are declared per input (CSV thickness column + metadata form);
 * - undeclared units are refused loudly BEFORE any calculation reaches the
 *   engine (UI wiring proof lands in Plan 02-04 — here the function contract);
 * - declared-but-different units are legal (UI-12) and convert to canonical mm
 *   with the exact constants 25.4 (in) and 0.0254 (mil).
 */
describe("units gate — assertUnitsDeclared", () => {
  it("throws EvaluationInputError when both units are undeclared, naming both inputs", () => {
    expect(() =>
      assertUnitsDeclared({ csvThickness: null, metadata: null }),
    ).toThrow(EvaluationInputError);

    try {
      assertUnitsDeclared({ csvThickness: null, metadata: null });
      expect.unreachable("gate must throw when both units are undeclared");
    } catch (error) {
      expect(error).toBeInstanceOf(EvaluationInputError);
      const message = (error as Error).message;
      expect(message).toContain("CSV thickness");
      expect(message).toContain("metadata");
    }
  });

  it("throws naming the CSV thickness column when only it is undeclared", () => {
    try {
      assertUnitsDeclared({ csvThickness: null, metadata: "mm" });
      expect.unreachable("gate must throw when the CSV thickness unit is undeclared");
    } catch (error) {
      expect(error).toBeInstanceOf(EvaluationInputError);
      const message = (error as Error).message;
      expect(message).toContain("CSV thickness");
      expect(message).not.toContain("Undeclared: metadata");
    }
  });

  it("throws naming the metadata form when only it is undeclared", () => {
    try {
      assertUnitsDeclared({ csvThickness: "mm", metadata: null });
      expect.unreachable("gate must throw when the metadata unit is undeclared");
    } catch (error) {
      expect(error).toBeInstanceOf(EvaluationInputError);
      const message = (error as Error).message;
      expect(message).toContain("metadata");
      expect(message).not.toContain("Undeclared: CSV thickness");
    }
  });

  it("carries the locked mixed-units copy semantics (UI-SPEC error row)", () => {
    try {
      assertUnitsDeclared({ csvThickness: null, metadata: null });
      expect.unreachable("gate must throw");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("Units are not declared for every input.");
      expect(message).toContain("mm, in, or mils");
    }
  });

  it("accepts declared-but-different units — they convert to canonical mm (UI-12)", () => {
    expect(() =>
      assertUnitsDeclared({ csvThickness: "mils", metadata: "mm" }),
    ).not.toThrow();
    expect(() =>
      assertUnitsDeclared({ csvThickness: "in", metadata: "mm" }),
    ).not.toThrow();
    expect(() =>
      assertUnitsDeclared({ csvThickness: "mm", metadata: "mm" }),
    ).not.toThrow();
  });
});

describe("conversion exactness — toMm (25.4 / 0.0254 exact constants)", () => {
  it("1 in = 25.4 mm exactly", () => {
    expect(toMm(1, "in")).toBe(25.4);
  });

  it("1 mil = 0.0254 mm exactly", () => {
    expect(toMm(1, "mils")).toBe(0.0254);
  });

  it("1000 mils = 25.4 mm exactly", () => {
    expect(toMm(1000, "mils")).toBe(25.4);
  });

  it("mm passthrough is the identity", () => {
    expect(toMm(19.85, "mm")).toBe(19.85);
  });

  it("round-trip mm -> value -> mm is identity within 1e-12 for realistic magnitudes", () => {
    for (const t of [19.0, 19.5, 19.85, 20.0, 25.4]) {
      expect(Math.abs(toMm(t / 25.4, "in") - t)).toBeLessThanOrEqual(1e-12);
      expect(Math.abs(toMm(t / 0.0254, "mils") - t)).toBeLessThanOrEqual(1e-12);
    }
  });
});
