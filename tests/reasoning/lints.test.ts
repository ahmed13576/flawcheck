import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { criteria } from "@/lib/calc/criteria";
import type { ComponentMetadata, ReadingResult } from "@/lib/ingest/session";
import {
  numericConsistency,
  verdictAgreement,
  citationAllowlistLint,
  verbatimNgramLint,
  splitSentences,
  runFinalLints,
} from "@/lib/reasoning/lints";
import { buildNarrativeContext, numericAllowlist } from "@/lib/reasoning/narrative-context";
import { VERDICT_LABELS, FALLBACK_CLOSING_SENTENCE } from "@/lib/reasoning/fallback";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const reading: ReadingResult = {
  readingId: "R1",
  location: "CML-1",
  cml: "CML-1",
  date: "2025-01-15",
  tActualMm: 3.85,
  tPressureMm: 3.2,
  tStructuralMm: 2.5,
  tRequiredMm: 4.2,
  crLtMmYr: 0.03,
  crStMmYr: null,
  rawCrLtMmYr: 0.03,
  rawCrStMmYr: null,
  crGoverningMmYr: 0.03,
  rlYears: 12.3,
  nextInspection: { date: "2030-01-15", intervalYears: 5 },
  flags: [],
  verdict: "re_check",
  citations: ["api574_10_5_1_4", "api570_7_2"],
};

const metadata: ComponentMetadata = {
  od: 114.3,
  tNominal: 6.02,
  fca: 1,
  tStructural: 2.5,
  designCode: "ASME B31.3 — 2024 Edition",
  pipeClass: 1,
  gaugeUncertainty: 0.25,
  pressureUnit: "MPa",
  designPressure: 4,
  allowableStress: 138,
  e: 1,
  w: 1,
  y: 0.4,
  formula: "asme_b31_3_straight_pipe",
};

const ctx = buildNarrativeContext({
  kind: "cml",
  reading,
  metadata,
  extraction: null,
  history: null,
  thresholds: criteria.ptmt,
});

const CORPUS = criteria.citations.map((c) => `${c.title} ${c.scope_note}`);

/** Fully lint-passing fixture narrative: allowed numbers only, designator
 * mention (Pitfall 1), allowed cites, correct final line. */
const PASSING = `t-actual is 3.85 mm against t-required 4.20 mm per ASME B31.3, and with the gauge uncertainty of 0.25 mm the reading sits in the re-check band. The required thickness is the greater of the pressure design thickness and the structural minimum [[cite:api574_10_5_1_4]]. Remaining life is 12.3 yr [[cite:api570_7_2]].
Verdict: RE-CHECK.`;

function lint(text: string) {
  return runFinalLints(text, {
    allowedNumbers: ctx.allowedNumbers,
    allowedCitationIds: ctx.allowedCitationIds,
    verdict: "re_check",
    corpus: CORPUS,
  });
}

/* ------------------------------------------------------------------ */
/* numericConsistency                                                  */
/* ------------------------------------------------------------------ */

describe("numericConsistency", () => {
  it("passes when every literal is an allowed variant, designators included (Pitfall 1)", () => {
    const allowed = buildNarrativeContext({
      kind: "cml",
      reading,
      metadata,
      extraction: null,
      history: null,
      thresholds: criteria.ptmt,
    }).allowedNumbers;
    expect(
      numericConsistency("t-actual 3.85 mm against t-required 4.20 mm per ASME B31.3.", allowed),
    ).toBe(true);
    expect(numericConsistency("The API 570 rate is 0.030 mm/yr and API 574 agrees.", allowed)).toBe(
      true,
    );
    expect(numericConsistency("Section B31.3 governs here.", allowed)).toBe(true);
  });

  it("rejects a literal that only the 2dp display value was injected for", () => {
    // injected raw 4.2 → allowed set has 4.2 and its 1/2/3dp variants (all 4.2)
    const allowed = new Set([4.2]);
    expect(numericConsistency("t-required 4.20 mm", allowed)).toBe(true);
    expect(numericConsistency("t-required 4.198 mm", allowed)).toBe(false);
  });

  it("pins the A6 boundary: 4.198 IS allowed when raw 4.19834 was injected", () => {
    const allowed = numericAllowlist([4.19834]);
    expect(numericConsistency("the computed 4.198 mm", allowed)).toBe(true);
    expect(numericConsistency("the invented 4.1983 mm", allowed)).toBe(false);
    expect(numericConsistency("the invented 4.19834 mm", allowed)).toBe(true);
    expect(numericConsistency("the invented 4.19 mm", allowed)).toBe(false);
  });

  it("rejects an invented number at any precision", () => {
    expect(numericConsistency("measured 3.9999 mm", ctx.allowedNumbers)).toBe(false);
    expect(numericConsistency("measured 3.9 mm", ctx.allowedNumbers)).toBe(true); // 1dp variant
  });

  it("rejects dates (Pitfall 4) — why the prompt forbids them", () => {
    expect(numericConsistency("measured 2026-09-15 per API 570.", ctx.allowedNumbers)).toBe(false);
  });

  it("strips cite tokens before scanning so citation-id digits never leak", () => {
    expect(numericConsistency("[[cite:api570_7_2]] governs remaining life.", ctx.allowedNumbers)).toBe(
      true,
    );
  });
});

describe("splitSentences", () => {
  it("splits on sentence boundaries and trims", () => {
    expect(splitSentences("One. Two! Three?")).toEqual(["One.", "Two!", "Three?"]);
    expect(splitSentences("Para one ends.\n\nPara two begins. It continues.")).toEqual([
      "Para one ends.",
      "Para two begins.",
      "It continues.",
    ]);
  });
});

/* ------------------------------------------------------------------ */
/* verdictAgreement                                                    */
/* ------------------------------------------------------------------ */

describe("verdictAgreement", () => {
  it("passes when the single final line matches the engine verdict", () => {
    expect(verdictAgreement("t-actual is 3.85 mm. Verdict: RE-CHECK.", "re_check")).toBe(true);
    expect(verdictAgreement("fine.\nVerdict: ACCEPT.", "accept")).toBe(true);
    expect(verdictAgreement("fine.\nVerdict: FAIL.", "reject")).toBe(true);
  });

  it("rejects a disagreeing label", () => {
    expect(verdictAgreement("t-actual is 3.85 mm. Verdict: RE-CHECK.", "accept")).toBe(false);
  });

  it("rejects two verdict lines", () => {
    expect(
      verdictAgreement("Early note. Verdict: ACCEPT.\nThen more. Verdict: RE-CHECK.", "re_check"),
    ).toBe(false);
  });

  it("rejects a missing final line (finish_reason length truncation, Pitfall 3)", () => {
    expect(verdictAgreement("narration ends without the contract line", "re_check")).toBe(false);
    expect(verdictAgreement("Verdict: RE-CHECK. and then prose keeps going", "re_check")).toBe(
      false,
    );
  });

  it("uses exactly the VerdictChip labels (mapping identity, behavioral pin)", () => {
    for (const verdict of ["accept", "re_check", "reject"] as const) {
      expect(verdictAgreement(`Verdict: ${VERDICT_LABELS[verdict]}.`, verdict)).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */
/* citationAllowlistLint                                               */
/* ------------------------------------------------------------------ */

describe("citationAllowlistLint", () => {
  it("passes when every cited id is in the reading's allowed set", () => {
    expect(
      citationAllowlistLint(
        "clause [[cite:api574_10_5_1_4]] and life [[cite:api570_7_2]]",
        reading.citations,
      ),
    ).toBe(true);
    expect(citationAllowlistLint("no citations at all", reading.citations)).toBe(true);
  });

  it("hard-rejects a wrong-context id that exists in the global allowlist (A8)", () => {
    expect(
      citationAllowlistLint("pressure design [[cite:asme_b31_3_304_1_2]]", reading.citations),
    ).toBe(false);
  });

  it("WR-05: hard-rejects malformed cite machinery the strict grammar never matched", () => {
    // A digit-free malformed id historically passed ALL four lints (no token
    // was recognized) and reached the reader as raw machinery text.
    expect(citationAllowlistLint("prose [[cite:FOO]] end", reading.citations)).toBe(false);
    expect(citationAllowlistLint("prose [[cite:]] end", reading.citations)).toBe(false);
    // Valid tokens are stripped before the machinery scan — prose containing
    // a closed valid token still passes.
    expect(
      citationAllowlistLint("life [[cite:api570_7_2]] and nothing else", reading.citations),
    ).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* verbatimNgramLint                                                   */
/* ------------------------------------------------------------------ */

describe("verbatimNgramLint", () => {
  it("rejects an 8-word window of a citations.json title", () => {
    const title = criteria.citations[0].title; // "Straight Pipe Under Internal Pressure — Pressure Design Thickness"
    expect(verbatimNgramLint(`The standard covers ${title.toLowerCase()} for piping.`, CORPUS)).toBe(
      false,
    );
  });

  it("rejects an 8-word window of a scope_note", () => {
    const window = "pressure design thickness t = p d 2 s e w p y for t";
    expect(verbatimNgramLint(`Formula recap: ${window} below six inches.`, CORPUS)).toBe(false);
  });

  it("passes paraphrase and short overlaps", () => {
    expect(verbatimNgramLint(PASSING, CORPUS)).toBe(true);
    expect(verbatimNgramLint("pressure design thickness governs", CORPUS)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* runFinalLints — ordered reasons                                     */
/* ------------------------------------------------------------------ */

describe("runFinalLints", () => {
  it("returns ok=true for the fully passing fixture", () => {
    expect(lint(PASSING)).toEqual({ ok: true });
  });

  it("names numeric_lint for an invented number", () => {
    expect(lint(PASSING.replace("12.3 yr", "12.345 yr"))).toEqual({
      ok: false,
      reason: "numeric_lint",
    });
  });

  it("names verdict_lint for a disagreeing final line", () => {
    expect(lint(PASSING.replace("Verdict: RE-CHECK.", "Verdict: ACCEPT."))).toEqual({
      ok: false,
      reason: "verdict_lint",
    });
  });

  it("names citation_lint for a wrong-context citation", () => {
    expect(
      lint(PASSING.replace("[[cite:api570_7_2]]", "[[cite:asme_b31_3_304_1_2]]")),
    ).toEqual({ ok: false, reason: "citation_lint" });
  });

  it("names verbatim_lint for a quoted title window", () => {
    const quoted = `The code region here is straight pipe under internal pressure pressure design thickness for piping systems.
Verdict: RE-CHECK.`;
    expect(lint(quoted)).toEqual({ ok: false, reason: "verbatim_lint" });
  });
});

/* ------------------------------------------------------------------ */
/* Purity guard: lints.ts has ZERO imports                             */
/* ------------------------------------------------------------------ */

describe("lints module purity", () => {
  it("contains no import statements and no require() calls", () => {
    const src = readFileSync(resolve(process.cwd(), "lib/reasoning/lints.ts"), "utf8");
    expect(src).not.toMatch(/^\s*import\b/m);
    expect(src).not.toMatch(/\brequire\s*\(/);
    expect(src).not.toMatch(/^\s*export\s+[^;]*\bfrom\s+/m);
  });
});

/* ------------------------------------------------------------------ */
/* Fallback symmetry (sanity): the fallback closing copy stays locked  */
/* ------------------------------------------------------------------ */

describe("fallback contract unchanged", () => {
  it("closing sentence the rejected/fallback frames must end with is intact", () => {
    expect(FALLBACK_CLOSING_SENTENCE).toBe("All verdicts are computed in code and unaffected.");
  });
});
