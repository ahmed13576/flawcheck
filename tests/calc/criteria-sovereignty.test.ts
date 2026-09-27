import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Criteria sovereignty guard (research Pitfall 9): the class maxima, gauge
 * uncertainty, and PT/MT limits must be loaded from lib/criteria/*.json via
 * lib/calc/criteria.ts — never duplicated as bare numeric literals in
 * verdicts.ts, interval.ts, or ptmt.ts.
 *
 * Method: strip comments (line + block) and string/template literals so the
 * scan sees only code positions, then assert the guarded literals never
 * appear. outliers.ts is exempt from the z-threshold check by the OQ4
 * resolution (statistical QC is engineering code; OUTLIER_Z_THRESHOLD = 3.5
 * lives there as a named constant) — and 3.5 is not in the guarded set
 * anyway.
 */
const GUARDED_FILES = ["verdicts.ts", "interval.ts", "ptmt.ts"] as const;

/** Numeric literals whose presence in code positions would duplicate criteria values. */
const GUARDED_LITERALS = [/\b0\.1\b/, /\b1\.5\b/, /\b5\.0\b/, /\b10\.0\b/, /\b5\b/] as const;

const LITERAL_NAMES = ["0.1", "1.5", "5.0", "10.0", "5"];

function stripCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ") // block comments
    .replace(/\/\/[^\n]*/g, " ") // line comments
    .replace(/`(?:\\.|[^`\\])*`/g, " ") // template literals
    .replace(/"(?:\\.|[^"\\])*"/g, " ") // double-quoted strings
    .replace(/'(?:\\.|[^'\\])*'/g, " "); // single-quoted strings
}

describe("criteria sovereignty — thresholds load from lib/criteria/*.json only", () => {
  const calcDir = join(__dirname, "..", "..", "lib", "calc");

  it("criteria.ts exists as the sanctioned constants access point", () => {
    const source = readFileSync(join(calcDir, "criteria.ts"), "utf8");
    expect(source).toContain('from "../criteria/ut-criteria.json"');
    expect(source).toContain('from "../criteria/ptmt-criteria.json"');
  });

  for (let i = 0; i < GUARDED_FILES.length; i++) {
    const fileName = GUARDED_FILES[i];
    it(`${fileName} carries no guarded numeric literal in a code position`, () => {
      const source = readFileSync(join(calcDir, fileName), "utf8");
      const code = stripCommentsAndStrings(source);
      const violations: string[] = [];
      GUARDED_LITERALS.forEach((pattern, j) => {
        if (pattern.test(code)) violations.push(LITERAL_NAMES[j]);
      });
      expect(violations).toEqual([]);
    });
  }
});
