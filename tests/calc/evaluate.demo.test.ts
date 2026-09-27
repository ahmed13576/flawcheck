import { describe, it, expect } from "vitest";
import citationsJson from "@/lib/criteria/citations.json";
import { createDemoSession } from "@/lib/demo/demo-scenario";
import {
  createInitialState,
  wizardReducer,
  blockingChecks,
} from "@/lib/wizard/reducer";
import { groupByCml } from "@/lib/ingest/group";
import { evaluate } from "@/lib/calc/evaluate";
import type { EvaluationResults } from "@/lib/ingest/session";

/**
 * Phase 2 flagship end-to-end: the committed 4,912-reading Zenodo fixture
 * flows load -> validate -> group -> evaluate through the REAL reducer seam
 * with zero network calls (pure imports only — CONTEXT.md demo lock).
 *
 * Numbers pinned here are the OBSERVED acquisition-time values (see
 * 02-03-SUMMARY deviations): 480 CMLs (tank + grid), all multi-campaign, so
 * 480 first-campaign readings (9.8%) carry honest insufficient-history state —
 * the research anticipated ~447; the fixture's real geometry wins.
 */

const demo = wizardReducer(createInitialState(), { type: "load-demo" });
const evaluated = wizardReducer(demo, { type: "run-evaluation" });
const results = evaluated.results as EvaluationResults;

function citationIds(node: unknown, acc: Set<string> = new Set()): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) citationIds(item, acc);
  } else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "id" && typeof value === "string") acc.add(value);
      else citationIds(value, acc);
    }
  }
  return acc;
}

const KNOWN_CITATION_IDS = citationIds(citationsJson);

/** Every numeric result field must be null or finite — never Infinity/NaN. */
function assertFiniteOrNullOrThrow(reading: EvaluationResults["readings"][number]) {
  const numericFields = [
    reading.tActualMm,
    reading.tPressureMm,
    reading.tStructuralMm,
    reading.tRequiredMm,
    reading.crLtMmYr,
    reading.crStMmYr,
    reading.rawCrLtMmYr,
    reading.rawCrStMmYr,
    reading.crGoverningMmYr,
    reading.rlYears,
  ];
  for (const value of numericFields) {
    expect(value === null || Number.isFinite(value)).toBe(true);
  }
  if (reading.nextInspection !== null) {
    expect(Number.isFinite(reading.nextInspection.intervalYears)).toBe(true);
    expect(reading.nextInspection.intervalYears).toBeGreaterThanOrEqual(0);
  }
}

describe("demo end-to-end — load -> validate -> group -> evaluate (zero network)", () => {
  it("flows the committed fixture through the real reducer seam", () => {
    expect(demo.csv.rowCount).toBe(4912);
    expect(blockingChecks(demo).rowErrors).toBe(0);
    expect(results).not.toBeNull();
    expect(evaluated.ui.screen).toBe(3);
  });

  it("summary: 4,912 readings · 12 locations · all three verdict bands present", () => {
    expect(results.summary.total).toBe(4912);
    expect(results.summary.locations).toBe(12);
    expect(results.summary.accept).toBeGreaterThan(0);
    expect(results.summary.reCheck).toBeGreaterThan(0);
    expect(results.summary.fail).toBeGreaterThan(0);
    // observed split at acquisition time (301 / 538 / 4,073)
    expect(results.summary).toEqual({
      total: 4912,
      locations: 12,
      accept: 301,
      reCheck: 538,
      fail: 4073,
    });
  });

  it("every reading flows through (4,912 results) and passes the non-finite scan", () => {
    expect(results.readings).toHaveLength(4912);
    for (const reading of results.readings) assertFiniteOrNullOrThrow(reading);
  });
});

describe("first-campaign honest handling (OQ3) on real data", () => {
  // True no-history rows: BOTH raw rates null (the group's earliest reading).
  // Rows whose raw rates computed but were negative are a DIFFERENT population
  // — the negative-CR policy clamps their governing to 0 (flag still fires,
  // raw rates surface verbatim per negative_cr_policy).
  const noHistory = results.readings.filter(
    (r) => r.rawCrLtMmYr === null && r.rawCrStMmYr === null,
  );
  const insufficient = results.readings.filter((r) =>
    r.flags.includes("insufficient_history"),
  );

  it("480 first-campaign readings (one per CML, 9.8%) carry insufficient_history", () => {
    // observed: 480 CMLs, every one multi-campaign; the research anticipated ~447
    expect(noHistory).toHaveLength(480);
    for (const reading of noHistory) {
      expect(reading.flags).toContain("insufficient_history");
    }
    // the flag ALSO fires for clamp-to-zero rows (all-negative rates) — the
    // real register has noisy apparent gains; both populations are honest
    expect(insufficient.length).toBeGreaterThanOrEqual(480);
  });

  it("each first-campaign reading has null CR/RL/interval yet a computed verdict", () => {
    for (const reading of noHistory) {
      expect(reading.crLtMmYr).toBeNull();
      expect(reading.crStMmYr).toBeNull();
      expect(reading.crGoverningMmYr).toBeNull();
      expect(reading.rlYears).toBeNull();
      expect(reading.nextInspection).toBeNull();
      expect(["accept", "re_check", "reject"]).toContain(reading.verdict);
      expect(reading.flags).not.toContain("immediate_inspection");
    }
  });

  it("clamp-to-zero rows surface raw rates verbatim with governing 0 and null RL", () => {
    const clamped = insufficient.filter(
      (r) => r.rawCrLtMmYr !== null || r.rawCrStMmYr !== null,
    );
    expect(clamped.length).toBeGreaterThan(0);
    for (const reading of clamped) {
      expect(reading.crGoverningMmYr).toBe(0);
      expect(reading.rlYears).toBeNull();
      expect(reading.nextInspection).toBeNull();
      // raw negative rates are visible — never silently dropped
      expect(reading.rawCrLtMmYr !== null || reading.rawCrStMmYr !== null).toBe(true);
    }
  });
});

describe("G14 immediate inspection on real data (builder decision)", () => {
  const immediate = results.readings.filter((r) => r.flags.includes("immediate_inspection"));

  it("readings at/below t_required with a valid positive governing CR are immediate", () => {
    expect(immediate.length).toBeGreaterThan(0);
    for (const reading of immediate) {
      // RL <= 0 with a positive CR: the component is at/below t_required
      // (reject) or exactly at it (the re_check equality band, G8)
      expect(reading.verdict === "reject" || reading.verdict === "re_check").toBe(true);
      expect(reading.crGoverningMmYr).not.toBeNull();
      expect(reading.crGoverningMmYr as number).toBeGreaterThan(0);
      expect(reading.rlYears).not.toBeNull();
      expect((reading.rlYears as number) <= 0).toBe(true);
      expect(reading.nextInspection).toBeNull();
    }
    // and the engine banding stays honest: no reject-band reading with a
    // positive governing CR escapes the immediate flag
    for (const reading of results.readings) {
      if (
        reading.verdict === "reject" &&
        reading.crGoverningMmYr !== null &&
        reading.crGoverningMmYr > 0 &&
        !reading.flags.includes("outlier")
      ) {
        expect(reading.flags).toContain("immediate_inspection");
      }
    }
  });

  it("no result anywhere carries a negative interval; CR-null rows stay insufficient_history", () => {
    for (const reading of results.readings) {
      if (reading.nextInspection !== null) {
        expect(reading.nextInspection.intervalYears).toBeGreaterThanOrEqual(0);
      }
      if (reading.crGoverningMmYr === null) {
        expect(reading.flags).toContain("insufficient_history");
        expect(reading.flags).not.toContain("immediate_inspection");
      }
    }
    // the two states are disjoint by construction
    for (const reading of results.readings) {
      const both =
        reading.flags.includes("insufficient_history") &&
        reading.flags.includes("immediate_inspection");
      expect(both).toBe(false);
    }
  });
});

describe("CR-degradation contract (UI-SPEC policy)", () => {
  it("unmapping Tank -> every row its own CML: CR columns null, verdicts still compute", () => {
    const degradedSession = {
      ...createDemoSession(),
      mapping: { ...createDemoSession().mapping, tank: null },
    };
    const degradedInputs = groupByCml(degradedSession.rows, degradedSession.mapping, {
      csvThicknessUnit: degradedSession.units.csvThickness,
    });
    const degradedResults = evaluate(
      degradedInputs,
      degradedSession.metadata,
      degradedSession.units,
      { ptmtIndications: degradedSession.ptmt.indications },
    );
    expect(degradedResults.readings).toHaveLength(4912);
    for (const reading of degradedResults.readings) {
      expect(reading.crLtMmYr).toBeNull();
      expect(reading.crStMmYr).toBeNull();
      expect(reading.crGoverningMmYr).toBeNull();
      expect(reading.flags).toContain("insufficient_history");
      // verdicts still compute — they need only t-actual + metadata
      expect(["accept", "re_check", "reject"]).toContain(reading.verdict);
    }
    // with no CR, no interval can be computed either
    for (const reading of degradedResults.readings) {
      expect(reading.nextInspection).toBeNull();
    }
  });
});

describe("citations + PT/MT triage", () => {
  it("citationsUsed is non-empty and every id resolves against citations.json", () => {
    expect(results.citationsUsed.length).toBeGreaterThan(0);
    for (const id of results.citationsUsed) {
      expect(KNOWN_CITATION_IDS.has(id)).toBe(true);
    }
  });

  it("the two sample indications triage to one reject (linear MT) and one accept (PT)", () => {
    expect(results.indications).toHaveLength(2);
    const byId = new Map(results.indications.map((i) => [i.id, i]));
    expect(byId.get("demo-ind-mt-linear")!.verdict).toBe("reject");
    expect(byId.get("demo-ind-pt-rounded")!.verdict).toBe("accept");
    expect(byId.get("demo-ind-mt-linear")!.citationId).toBe("asme_b31_3_344_3_2");
    expect(byId.get("demo-ind-pt-rounded")!.citationId).toBe("asme_b31_3_344_4_2");
  });

  it("the whole end-to-end pipeline stays fast (deterministic, client-grade)", () => {
    const started = performance.now();
    const fresh = wizardReducer(createInitialState(), { type: "load-demo" });
    wizardReducer(fresh, { type: "run-evaluation" });
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(10_000);
  });
});
