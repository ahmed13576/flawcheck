/**
 * 06-01 Task 1 — the Phase 6 content-seam contracts (lib/report/content.ts):
 * buildFindingsBrief (REPT-04), buildCodeBreakdown, VERDICT_GLOSSARY
 * (REPT-06), and the locked dashboard copy builders. The brief is a
 * DETERMINISTIC template over evaluate() output — zero [[cite: tokens, no
 * LLM/telemetry/Date.now input (UI-6.3/UI-6.4) — and the fixture shape
 * mirrors tests/report/pdf-route.test.ts (ReadingResult literals, no mocks).
 *
 * Fixture names deliberately use grid identities (S6-G07, WBT-P1 grid 4) —
 * never the token "CML" — so the P5 invariant ("no brief output contains the
 * token CML; summary.locations is never labeled CMLs") is assertable.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildFindingsBrief,
  buildCodeBreakdown,
  VERDICT_GLOSSARY,
  VERDICT_GLOSSARY_ORDER,
  buildDispositionBannerSentence,
  buildWhatToDoNextLine,
  buildCsvPointerLine,
  citationRef,
} from "@/lib/report/content";
import type { ReadingResult, Verdict } from "@/lib/ingest/session";
import type { EvaluationResults } from "@/lib/ingest/session";

/** Full ReadingResult fixture (same shape as the pdf-route READING literal). */
function reading(overrides: Partial<ReadingResult> & { readingId: string }): ReadingResult {
  return {
    location: "WBT-S6",
    date: "2025-01-15T00:00:00Z",
    tActualMm: 8.42,
    tPressureMm: 4.2,
    tStructuralMm: 6.35,
    tRequiredMm: 6.35,
    crLtMmYr: 0.112,
    crStMmYr: null,
    rawCrLtMmYr: 0.112,
    rawCrStMmYr: null,
    crGoverningMmYr: 0.112,
    rlYears: 35.4,
    nextInspection: { date: "2030-01-15", intervalYears: 5 },
    flags: [],
    verdict: "accept",
    citations: ["api574_10_5_1_4"],
    ...overrides,
  };
}

function summary(partial: Partial<EvaluationResults["summary"]>): EvaluationResults["summary"] {
  return { total: 0, locations: 1, accept: 0, reCheck: 0, fail: 0, ...partial };
}

/** Grid-style names — the token "CML" never appears in brief fixtures. */
const G_FAIL_IMMEDIATE = reading({
  readingId: "r-f1",
  cml: "S6-G07",
  tActualMm: 6.0,
  rlYears: 0,
  nextInspection: null,
  flags: ["immediate_inspection"],
  verdict: "reject",
  citations: ["api570_7_1_2_lt"],
});
const G_FAIL_STRUCTURAL = reading({
  readingId: "r-f2",
  cml: "S6-G11",
  tActualMm: 6.2,
  tRequiredMm: 6.35, // == tStructuralMm → structural-governed
  rlYears: null, // insufficient history (null RL — never Infinity)
  nextInspection: null,
  flags: ["insufficient_history"],
  verdict: "reject",
  citations: ["api574_10_5_1_3"],
});
const G_RECHECK_BAND = reading({
  readingId: "r-c1",
  cml: "S6-G03",
  tActualMm: 6.4, // within the gauge-uncertainty band above t-required
  rlYears: 0.4,
  verdict: "re_check",
  citations: ["api570_7_1_2_governing"],
});

const MIXED_SUMMARY = summary({ total: 420, locations: 1, accept: 409, reCheck: 9, fail: 2 });

describe("06-01 buildFindingsBrief — the three canonical copy cases (UI-6.5)", () => {
  it("mixed case: disposition, next action, narrative, and worst list per the locked copy", () => {
    const brief = buildFindingsBrief(MIXED_SUMMARY, [G_FAIL_IMMEDIATE, G_FAIL_STRUCTURAL, G_RECHECK_BAND]);
    // 2 fails ≤ 3 → the failing locations are named inline (worst-order).
    expect(brief.dispositionSentence).toBe(
      "2 of 420 readings failed — immediate inspection required at S6-G07 and S6-G11.",
    );
    expect(brief.nextActionSentence).toBe(
      "Next action: re-measure the failing locations and disposition them against the code before continued service.",
    );
    expect(brief.narrative).toBe(
      "409 readings are ACCEPT — wall thickness meets the code minimum. " +
        "9 are RE-CHECK — thickness is close to the limit and must be confirmed. " +
        "2 are FAIL — wall is thinner than the code allows.",
    );
    expect(brief.worstLocations).toEqual([
      { name: "S6-G07", verdict: "reject", why: "No safe service life remaining" },
      { name: "S6-G11", verdict: "reject", why: "Below the structural minimum thickness" },
      { name: "S6-G03", verdict: "re_check", why: "Within the gauge-uncertainty band — re-measure to confirm" },
    ]);
  });

  it("mixed case with more than 3 fails defers to the list below instead of naming inline", () => {
    const s = summary({ total: 500, accept: 495, reCheck: 1, fail: 4 });
    const brief = buildFindingsBrief(s, [
      reading({ readingId: "f1", cml: "S6-G01", verdict: "reject", rlYears: 1 }),
      reading({ readingId: "f2", cml: "S6-G02", verdict: "reject", rlYears: 2 }),
      reading({ readingId: "f3", cml: "S6-G03", verdict: "reject", rlYears: 3 }),
      reading({ readingId: "f4", cml: "S6-G04", verdict: "reject", rlYears: 4 }),
      reading({ readingId: "c1", cml: "S6-G05", verdict: "re_check", rlYears: 8 }),
    ]);
    expect(brief.dispositionSentence).toBe(
      "4 of 500 readings failed — immediate inspection required at the worst locations listed below.",
    );
  });

  it("all-accept case: collapsed forms and an EMPTY worst list (no placeholder)", () => {
    const s = summary({ total: 420, accept: 420 });
    const brief = buildFindingsBrief(s, [reading({ readingId: "a1", cml: "S6-G01" })]);
    expect(brief.dispositionSentence).toBe("All 420 readings meet the code minimum.");
    expect(brief.nextActionSentence).toBe(
      "Next action: continue the established inspection interval — the earliest next inspection is dated in the register.",
    );
    expect(brief.narrative).toBe(
      "All 420 readings are ACCEPT — wall thickness meets the code minimum at every measured point.",
    );
    expect(brief.worstLocations).toEqual([]);
  });

  it("all-fail case: the locked collapsed forms with en-US formatted counts", () => {
    const s = summary({ total: 4912, fail: 4912 });
    const brief = buildFindingsBrief(s, [
      reading({ readingId: "f1", cml: "S6-G01", verdict: "reject", rlYears: 0, flags: ["immediate_inspection"], nextInspection: null }),
      reading({ readingId: "f2", cml: "S6-G02", verdict: "reject", rlYears: 0.5, nextInspection: null, flags: ["immediate_inspection"] }),
    ]);
    expect(brief.dispositionSentence).toBe(
      "All 4,912 readings failed — the component is below the code minimum everywhere measured.",
    );
    expect(brief.nextActionSentence).toBe(
      "Next action: take the component out of service and notify the responsible inspector.",
    );
    expect(brief.narrative).toBe(
      "None of the 4,912 readings are ACCEPT. All are FAIL — wall is thinner than the code allows.",
    );
    // Cap min(5, non-accept) — two fixtures → both listed.
    expect(brief.worstLocations).toHaveLength(2);
  });

  it("re-check-only case: disposition and next action flag the re-check before disposition", () => {
    const s = summary({ total: 420, accept: 408, reCheck: 12 });
    const brief = buildFindingsBrief(s, [G_RECHECK_BAND]);
    expect(brief.dispositionSentence).toBe("12 of 420 readings need re-check before disposition.");
    expect(brief.nextActionSentence).toBe(
      "Next action: re-check the flagged locations to confirm thickness before disposition.",
    );
  });
});

describe("06-01 buildFindingsBrief — degenerate inputs (P4 / UI-6.8)", () => {
  it("a single-reading session renders sensible sentences (never empty or garbled)", () => {
    const s = summary({ total: 1, fail: 1 });
    const brief = buildFindingsBrief(s, [
      reading({ readingId: "only", cml: "S6-G01", verdict: "reject", rlYears: 0, flags: ["immediate_inspection"], nextInspection: null }),
    ]);
    expect(brief.dispositionSentence).toBe(
      "All 1 readings failed — the component is below the code minimum everywhere measured.",
    );
    expect(brief.nextActionSentence).not.toBe("");
    expect(brief.narrative).not.toBe("");
    expect(brief.worstLocations).toHaveLength(1);
  });

  it("a zero-length readings array renders sensible (non-empty) sentences", () => {
    const brief = buildFindingsBrief(summary({ total: 0 }), []);
    expect(brief.dispositionSentence).toBe("All 0 readings meet the code minimum.");
    expect(brief.nextActionSentence).not.toBe("");
    expect(brief.narrative).not.toBe("");
    expect(brief.worstLocations).toEqual([]);
  });
});

describe("06-01 worst-locations ordering (UI-6.6) — immediate first, rejects before re-checks, RL ascending, null last", () => {
  it("orders the full chain within a non-binding cap (5 non-accept readings)", () => {
    const readings = [
      reading({ readingId: "rc-a", cml: "S6-G10", verdict: "re_check", rlYears: 10 }),
      reading({ readingId: "rj-b", cml: "S6-G20", verdict: "reject", rlYears: null, flags: ["insufficient_history"], nextInspection: null }),
      reading({ readingId: "rj-c", cml: "S6-G30", verdict: "reject", rlYears: 0, flags: ["immediate_inspection"], nextInspection: null }),
      reading({ readingId: "rj-d", cml: "S6-G40", verdict: "reject", rlYears: 5 }),
      reading({ readingId: "rc-e", cml: "S6-G50", verdict: "re_check", rlYears: null, flags: ["insufficient_history"], nextInspection: null }),
    ];
    const brief = buildFindingsBrief(summary({ total: 6, accept: 1, reCheck: 2, fail: 3 }), [
      ...readings,
      reading({ readingId: "acc", cml: "S6-G60" }),
    ]);
    expect(brief.worstLocations.map((w) => w.name)).toEqual([
      "S6-G30", // immediate_inspection first
      "S6-G40", // rejects: RL ascending
      "S6-G20", // rejects: null RL LAST within its verdict class
      "S6-G10", // re-checks: RL ascending
      "S6-G50", // re-checks: null RL last
    ]);
  });

  it("stability: equal sort keys preserve input order", () => {
    const readings = [
      reading({ readingId: "r1", cml: "S6-GA", verdict: "reject", rlYears: 3 }),
      reading({ readingId: "r2", cml: "S6-GB", verdict: "reject", rlYears: 3 }),
    ];
    const brief = buildFindingsBrief(summary({ total: 2, fail: 2 }), readings);
    expect(brief.worstLocations.map((w) => w.name)).toEqual(["S6-GA", "S6-GB"]);
  });

  it("caps the list at 5 when more than 5 non-accept readings exist", () => {
    const readings = [
      reading({ readingId: "rj-c", cml: "S6-G30", verdict: "reject", rlYears: 0, flags: ["immediate_inspection"], nextInspection: null }),
      reading({ readingId: "rj-f", cml: "S6-G60", verdict: "reject", rlYears: 2 }),
      reading({ readingId: "rj-d", cml: "S6-G40", verdict: "reject", rlYears: 5 }),
      reading({ readingId: "rj-b", cml: "S6-G20", verdict: "reject", rlYears: null, flags: ["insufficient_history"], nextInspection: null }),
      reading({ readingId: "rc-g", cml: "S6-G70", verdict: "re_check", rlYears: 1 }),
      reading({ readingId: "rc-a", cml: "S6-G10", verdict: "re_check", rlYears: 10 }),
      reading({ readingId: "rc-e", cml: "S6-G50", verdict: "re_check", rlYears: null, flags: ["insufficient_history"], nextInspection: null }),
    ];
    const brief = buildFindingsBrief(
      summary({ total: 8, accept: 1, reCheck: 3, fail: 4 }),
      [...readings, reading({ readingId: "acc", cml: "S6-G99" })],
    );
    expect(brief.worstLocations).toHaveLength(5);
    expect(brief.worstLocations.map((w) => w.name)).toEqual([
      "S6-G30", "S6-G60", "S6-G40", "S6-G20", "S6-G70",
    ]);
  });
});

describe("06-01 why-string derivation (UI-6.7) — every locked row", () => {
  it("FAIL + immediate_inspection → 'No safe service life remaining'", () => {
    const brief = buildFindingsBrief(summary({ total: 1, fail: 1 }), [
      reading({ readingId: "x", cml: "S6-G01", verdict: "reject", rlYears: 0, flags: ["immediate_inspection"], nextInspection: null }),
    ]);
    expect(brief.worstLocations[0].why).toBe("No safe service life remaining");
  });

  it("a non-accept outlier reading → the outlier why (evaluated right after immediate_inspection)", () => {
    const brief = buildFindingsBrief(summary({ total: 2, fail: 1, reCheck: 1 }), [
      reading({ readingId: "f", cml: "S6-G01", verdict: "reject", rlYears: 2, flags: ["outlier"] }),
      reading({ readingId: "c", cml: "S6-G02", verdict: "re_check", rlYears: 3, flags: ["outlier"] }),
    ]);
    expect(brief.worstLocations[0].why).toBe("Reading deviates from this CML's history — re-shoot candidate");
    expect(brief.worstLocations[1].why).toBe("Reading deviates from this CML's history — re-shoot candidate");
  });

  it("FAIL pressure-governed → 'Below the pressure-design minimum thickness'", () => {
    const brief = buildFindingsBrief(summary({ total: 1, fail: 1 }), [
      reading({ readingId: "x", cml: "S6-G01", verdict: "reject", tPressureMm: 6.5, tStructuralMm: 6.35, tRequiredMm: 6.5, tActualMm: 6.0, rlYears: 1 }),
    ]);
    expect(brief.worstLocations[0].why).toBe("Below the pressure-design minimum thickness");
  });

  it("6-dp boundary: tRequired within half a micro of tStructural IS structural-governed; just past it is not", () => {
    // 6.35 + 4e-7 rounds to 6.35 at 6 dp → structural-governed.
    const structuralCase = buildFindingsBrief(summary({ total: 1, fail: 1 }), [
      reading({ readingId: "x", cml: "S6-G01", verdict: "reject", tPressureMm: 6.2, tStructuralMm: 6.35, tRequiredMm: 6.3500004, tActualMm: 6.3, rlYears: 1 }),
    ]);
    expect(structuralCase.worstLocations[0].why).toBe("Below the structural minimum thickness");
    // 6.35 + 6e-7 rounds to 6.350001 at 6 dp → pressure-governed.
    const pressureCase = buildFindingsBrief(summary({ total: 1, fail: 1 }), [
      reading({ readingId: "x", cml: "S6-G01", verdict: "reject", tPressureMm: 6.2, tStructuralMm: 6.35, tRequiredMm: 6.3500006, tActualMm: 6.3, rlYears: 1 }),
    ]);
    expect(pressureCase.worstLocations[0].why).toBe("Below the pressure-design minimum thickness");
  });

  it("RE-CHECK + insufficient_history → 'Not enough survey history to compute remaining life'", () => {
    const brief = buildFindingsBrief(summary({ total: 1, reCheck: 1 }), [
      reading({ readingId: "x", cml: "S6-G01", verdict: "re_check", rlYears: null, flags: ["insufficient_history"], nextInspection: null }),
    ]);
    expect(brief.worstLocations[0].why).toBe("Not enough survey history to compute remaining life");
  });
});

describe("06-01 invariants: zero citations, no CML token, determinism", () => {
  const ALL_BRIEFS = [
    buildFindingsBrief(MIXED_SUMMARY, [G_FAIL_IMMEDIATE, G_FAIL_STRUCTURAL, G_RECHECK_BAND]),
    buildFindingsBrief(summary({ total: 420, accept: 420 }), [reading({ readingId: "a1", cml: "S6-G01" })]),
    buildFindingsBrief(summary({ total: 4912, fail: 4912 }), [
      reading({ readingId: "f1", cml: "S6-G01", verdict: "reject", rlYears: 0, flags: ["immediate_inspection"], nextInspection: null }),
    ]),
    buildFindingsBrief(summary({ total: 10, reCheck: 10 }), [G_RECHECK_BAND]),
  ];

  it("no brief output contains a [[cite: token (UI-6.3 — the tables carry all citations)", () => {
    for (const brief of ALL_BRIEFS) {
      expect(brief.dispositionSentence).not.toContain("[[cite:");
      expect(brief.nextActionSentence).not.toContain("[[cite:");
      expect(brief.narrative).not.toContain("[[cite:");
      for (const w of brief.worstLocations) expect(w.why).not.toContain("[[cite:");
    }
  });

  it("no brief output contains the token 'CML' (summary.locations is never labeled CMLs — P5)", () => {
    for (const brief of ALL_BRIEFS) {
      expect(brief.dispositionSentence).not.toContain("CML");
      expect(brief.nextActionSentence).not.toContain("CML");
      expect(brief.narrative).not.toContain("CML");
      for (const w of brief.worstLocations) expect(w.name).not.toContain("CML");
    }
  });

  it("determinism: identical input yields deep-equal output (no Date.now/random/LLM input)", () => {
    const readings = [G_FAIL_IMMEDIATE, G_FAIL_STRUCTURAL, G_RECHECK_BAND];
    const a = buildFindingsBrief(MIXED_SUMMARY, readings);
    const b = buildFindingsBrief(MIXED_SUMMARY, readings);
    expect(a).toEqual(b);
  });
});

describe("06-01 buildCodeBreakdown (UI-6.16)", () => {
  it("echoes the verdict counts and compares t-actual against both branches at 6 dp", () => {
    const s = summary({ total: 5, accept: 2, reCheck: 1, fail: 2 });
    const readings = [
      reading({ readingId: "a1", cml: "S6-G01", tActualMm: 8.42 }), // pass / pass
      reading({ readingId: "a2", cml: "S6-G02", tActualMm: 7.0 }), // pass / pass
      reading({ readingId: "c1", cml: "S6-G03", tActualMm: 6.4, verdict: "re_check", rlYears: 0.4 }), // pass / pass
      reading({ readingId: "f1", cml: "S6-G04", tActualMm: 6.0, verdict: "reject", rlYears: 1, nextInspection: null }), // pass / FAIL
      reading({ readingId: "f2", cml: "S6-G05", tActualMm: 3.0, verdict: "reject", rlYears: 0, flags: ["immediate_inspection"], nextInspection: null }), // FAIL / FAIL
    ];
    const breakdown = buildCodeBreakdown(s, readings);
    expect(breakdown.verdicts).toEqual({ accept: 2, reCheck: 1, fail: 2 });
    expect(breakdown.pressure).toEqual({ pass: 4, fail: 1 });
    expect(breakdown.structural).toEqual({ pass: 3, fail: 2 });
  });

  it("6-dp boundary: equality after rounding passes (mirrors the verdict-band convention)", () => {
    const readings = [
      // 6.3500004 rounds to 6.35 at 6 dp → structural pass.
      reading({ readingId: "b1", cml: "S6-G01", tActualMm: 6.3500004 }),
      // 6.3499996 rounds to 6.35 at 6 dp → structural pass as well.
      reading({ readingId: "b2", cml: "S6-G02", tActualMm: 6.3499996 }),
    ];
    const breakdown = buildCodeBreakdown(summary({ total: 2, accept: 2 }), readings);
    expect(breakdown.structural).toEqual({ pass: 2, fail: 0 });
  });

  it("branch counts reconcile with summary.total on an empty array", () => {
    const breakdown = buildCodeBreakdown(summary({ total: 0 }), []);
    expect(breakdown).toEqual({
      verdicts: { accept: 0, reCheck: 0, fail: 0 },
      pressure: { pass: 0, fail: 0 },
      structural: { pass: 0, fail: 0 },
    });
  });
});

describe("06-01 VERDICT_GLOSSARY (REPT-06 / UI-6.9) — locked copy + locked citation remap", () => {
  it("renders a non-empty clause sub-line via citationRef for every entry (no zero-glyph ids)", () => {
    for (const verdict of VERDICT_GLOSSARY_ORDER) {
      const entry = VERDICT_GLOSSARY[verdict];
      expect(entry.citationId).not.toBeNull();
      expect(citationRef(entry.citationId as string)).not.toBe("");
    }
    expect(citationRef("api574_10_5_1_4")).toBe("API 574 §10.5.1.4");
    expect(citationRef("api570_7_1_2_governing")).toBe("API 570 §7.1.2");
    expect(citationRef("api570_7_6")).toBe("API 570 §7.6");
  });

  it("the plain sentences match the locked copy verbatim", () => {
    expect(VERDICT_GLOSSARY.accept.plain).toBe("Wall thickness meets the code minimum at this location.");
    expect(VERDICT_GLOSSARY.re_check.plain).toBe(
      "Thickness is close to the limit — re-measure to confirm before deciding.",
    );
    expect(VERDICT_GLOSSARY.reject.plain).toBe(
      "Wall is thinner than the code allows at this location. Action required.",
    );
  });

  it("the fixed order is ACCEPT, RE-CHECK, FAIL", () => {
    expect(VERDICT_GLOSSARY_ORDER).toEqual<readonly Verdict[]>(["accept", "re_check", "reject"]);
  });
});

describe("06-01 dashboard copy builders (UI-6.15 / UI-6.18 / UI-6.19)", () => {
  it("banner: all three cases", () => {
    expect(buildDispositionBannerSentence(summary({ total: 420, fail: 2, reCheck: 9, accept: 409 }))).toBe(
      "2 of 420 readings FAILED — the worst locations need immediate inspection.",
    );
    expect(buildDispositionBannerSentence(summary({ total: 420, accept: 408, reCheck: 12 }))).toBe(
      "408 of 420 readings meet the code minimum — 12 readings need re-check before disposition.",
    );
    expect(buildDispositionBannerSentence(summary({ total: 420, accept: 420 }))).toBe(
      "All 420 readings meet the code minimum — acceptable for continued service.",
    );
  });

  it("what-to-do-next: all three cases", () => {
    expect(buildWhatToDoNextLine(summary({ total: 420, fail: 2, reCheck: 9, accept: 409 }))).toBe(
      "Immediate action: re-measure and disposition the failing locations before continued service.",
    );
    expect(buildWhatToDoNextLine(summary({ total: 420, accept: 408, reCheck: 12 }))).toBe(
      "Next action: re-check the flagged locations to confirm thickness before disposition.",
    );
    expect(buildWhatToDoNextLine(summary({ total: 420, accept: 420 }))).toBe(
      "Next action: continue the established inspection interval — earliest next inspection is dated in the register.",
    );
  });

  it("CSV pointer: locked wording with en-US formatted total", () => {
    expect(buildCsvPointerLine(4912)).toBe(
      "Full data: the complete register of 4,912 readings is available as a downloadable CSV export.",
    );
    expect(buildCsvPointerLine(0)).toBe(
      "Full data: the complete register of 0 readings is available as a downloadable CSV export.",
    );
  });
});

describe("06-01 import-graph drift guard (T-06-01-03)", () => {
  /**
   * One glossary constant, many renderers — zero drift. At 06-01 the two
   * renderer imports land in Tasks 2/3; this guard pins the invariant from
   * the moment they exist: any component file referencing VERDICT_GLOSSARY
   * MUST import it from "@/lib/report/content" (never a local redefinition).
   * The strict per-renderer requires-import pins are asserted in
   * tests/report/pdf-route.test.ts (Task 2) and tests/report/report-preview
   * extensions (Task 3); plan 06-02 extends the same pin to the Screen 3
   * surface.
   */
  const RENDERERS = [
    "components/report/report-document.tsx",
    "components/report/pdf-document.tsx",
  ];
  it("any renderer that references VERDICT_GLOSSARY imports it from the content seam", () => {
    for (const file of RENDERERS) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      if (src.includes("VERDICT_GLOSSARY")) {
        expect(src).toContain('from "@/lib/report/content"');
        expect(src).toContain("VERDICT_GLOSSARY");
      }
    }
  });
});
