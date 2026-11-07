import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  requiredThickness,
  tPressureB313,
  tPressureBarlow,
  type FormulaInputs,
} from "@/lib/calc/formulas";
import { verdictBand } from "@/lib/calc/verdicts";
import { crLongTerm, crShortTerm, rateOutcome } from "@/lib/calc/corrosion";
import { remainingLife } from "@/lib/calc/remaining-life";

/**
 * Golden fixture parity runner (Phase 8) — mirrors the pipingtoolset-claude
 * tests/parity.py contract:
 *
 *   1. tests/fixtures/golden/calc.json is HAND-DERIVED ground truth. The Zenodo
 *      source dataset ships inputs only (no ground truth for any output), and
 *      the pre-existing suite proved self-consistency, not correctness. Every
 *      case carries a `derivation` string a stranger can follow with a
 *      calculator; expected values were never produced by running the engine.
 *   2. MANIFEST.json pins the sha256 of the exact calc.json bytes and the case
 *      count — a tampered or re-generated fixture fails before any case runs.
 *   3. A case with a missing or empty `expect` block FAILS as "asserts
 *      nothing" (a vacuous loop is a silent pass, the worst failure mode).
 *
 * Numeric fields compare with |actual - expected| <= tol; strings, booleans and
 * null compare exactly; arrays (citations) compare element-wise in order.
 */

const GOLDEN_DIR = join(__dirname, "fixtures", "golden");
const CALC_BYTES = readFileSync(join(GOLDEN_DIR, "calc.json"));
const CALC = JSON.parse(CALC_BYTES.toString("utf8")) as {
  description?: string;
  cases: GoldenCase[];
};
const MANIFEST = JSON.parse(
  readFileSync(join(GOLDEN_DIR, "MANIFEST.json"), "utf8"),
) as {
  source?: string;
  files: Record<string, { sha256: string; cases: number }>;
  generated?: string;
};

interface GoldenCase {
  id: string;
  op: string;
  input: Record<string, unknown>;
  expect: Record<string, unknown>;
  tol: number;
  derivation: string;
}

const CASES: GoldenCase[] = CALC.cases;

/**
 * Dispatch a golden case to the REAL exported engine functions. Returns
 * `unknown` — the result is a JSON-shaped record for comparison purposes,
 * cast once in compareGoldenCase at the fixture boundary.
 */
function runGoldenCase(c: GoldenCase): unknown {
  const i = c.input;
  switch (c.op) {
    case "tPressureB313":
      return { value: tPressureB313(i as unknown as FormulaInputs) };
    case "tPressureBarlow":
      return { value: tPressureBarlow(i as unknown as FormulaInputs) };
    case "requiredThickness":
      return requiredThickness(i as unknown as FormulaInputs);
    case "verdictBand":
      return {
        verdict: verdictBand(
          i.tActualMm as number,
          i.tRequiredMm as number,
          i.gaugeUncertaintyMm as number | undefined,
        ),
      };
    case "crLongTerm":
      return {
        value: crLongTerm(i.tInitialMm as number, i.tActualMm as number, i.dtYears as number),
      };
    case "crShortTerm":
      return {
        value: crShortTerm(i.tPreviousMm as number, i.tActualMm as number, i.dtYears as number),
      };
    case "rateOutcome":
      return rateOutcome(
        (i.tInitialMm ?? null) as number | null,
        (i.tPreviousMm ?? null) as number | null,
        i.tActualMm as number,
        (i.dtLtYears ?? null) as number | null,
        (i.dtStYears ?? null) as number | null,
      );
    case "remainingLife":
      return {
        value: remainingLife(
          i.tActualMm as number,
          i.tRequiredMm as number,
          (i.governingEffectiveMmYr ?? null) as number | null,
        ),
      };
    default:
      throw new Error(`golden case "${c.id}" uses unknown op "${c.op}"`);
  }
}

/** Compare the pinned `expect` fields against the engine output. */
function compareGoldenCase(c: GoldenCase): string[] {
  const failures: string[] = [];
  const actual = runGoldenCase(c) as Record<string, unknown>;
  for (const [key, expected] of Object.entries(c.expect)) {
    if (!(key in actual)) {
      failures.push(`${key}: fixture pins a field op "${c.op}" never produced`);
      continue;
    }
    const got = actual[key];
    if (typeof expected === "number" && typeof got === "number") {
      if (!(Math.abs(got - expected) <= c.tol)) {
        failures.push(`${key}: expected ${expected} +/- ${c.tol}, got ${got}`);
      }
    } else if (JSON.stringify(expected) !== JSON.stringify(got)) {
      // Exact match for strings, booleans, null and ordered arrays
      // (citations); JSON stringifying also makes NaN/undefined mismatches
      // visible instead of silently passing on `!==` semantics.
      failures.push(`${key}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
    }
  }
  return failures;
}

describe("golden fixtures — hand-derived ground truth vs the real engine", () => {
  it("MANIFEST sha256 matches the exact calc.json bytes on disk", () => {
    const actualSha = createHash("sha256").update(CALC_BYTES).digest("hex");
    const declared = MANIFEST.files["calc.json"]?.sha256;
    expect(
      declared,
      `MANIFEST sha256 mismatch for calc.json — manifest says ${declared}, bytes on disk hash to ${actualSha}. ` +
        "The fixture was tampered with or regenerated without updating MANIFEST.json.",
    ).toBe(actualSha);
  });

  it("MANIFEST case count matches the fixture array length", () => {
    expect(
      MANIFEST.files["calc.json"]?.cases,
      "MANIFEST cases count does not match calc.json — update MANIFEST.json when adding/removing cases",
    ).toBe(CASES.length);
  });

  it("the golden case set is non-empty (the loop cannot pass vacuously)", () => {
    expect(CASES.length).toBeGreaterThan(0);
  });

  it("every case asserts something (non-empty expect block)", () => {
    const vacuous = CASES.filter(
      (c) => !c.expect || typeof c.expect !== "object" || Object.keys(c.expect).length === 0,
    ).map((c) => c.id);
    expect(
      vacuous,
      "golden cases assert nothing (missing or empty expect block): " + vacuous.join(", "),
    ).toEqual([]);
  });

  it("case ids are unique", () => {
    const ids = CASES.map((c) => c.id);
    expect(new Set(ids).size, `duplicate golden case ids: ${ids.join(", ")}`).toBe(ids.length);
  });

  it.each(CASES)("golden case $id ($op)", (c) => {
    const failures = compareGoldenCase(c);
    expect(
      failures,
      `golden case "${c.id}" disagrees with the hand-derived ground truth.\n  ` +
        failures.join("\n  ") +
        `\n  derivation: ${c.derivation}`,
    ).toEqual([]);
  });
});
