import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import subsetFixture from "@/lib/demo/fixtures/zenodo-16780668-ut-register-subset.json";
import {
  createDemoSession,
  DEMO_FILENAME,
  DEMO_HEADERS,
  DEMO_MAPPING,
} from "@/lib/demo/demo-scenario";
import { groupByCml } from "@/lib/ingest/group";
import { evaluate } from "@/lib/calc/evaluate";
import { parseIsoUtc } from "@/lib/calc/dates";

/**
 * Gates the committed WBT-S6 demo-subset fixture forever (06-02, UI-6.24):
 * exact six-column schema, ONE tank, 420 rows (200-500 target), every CML
 * multi-campaign (tank-identity filter ONLY — NEVER date-filtered: research
 * P3 — a date window would amputate groupByCml history and manufacture
 * insufficient_history rows), and all three verdict bands under the
 * DEMO_METADATA preset. Also pins the CSV mirror (public/
 * sample-ut-register-subset.csv) to identical row content, and the
 * end-to-end session through the unchanged buildCells parse path.
 *
 * Verdict counts are the OBSERVED execution-time values (Phase 2 precedent):
 * 22 accept / 53 re-check / 345 fail under t_required 19.85 ± 0.1 — every
 * band present.
 */
const rows = subsetFixture as unknown as Array<Record<string, string>>;

const TANK = "WBT-S6";

describe("demo subset fixture — the committed WBT-S6 tank section (UI-6.24)", () => {
  it("contains exactly 420 data rows (mid-range of the 382-438 tank spread)", () => {
    expect(rows).toHaveLength(420);
  });

  it("carries exactly the six source columns on every row", () => {
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([...DEMO_HEADERS].sort());
    }
  });

  it("has exactly ONE distinct Tank value (tank-identity filter ONLY)", () => {
    const tanks = [...new Set(rows.map((r) => r.Tank))];
    expect(tanks).toEqual([TANK]);
  });

  it("gives every CML (Tank + Grid_Position) >= 2 distinct campaigns — history is never amputated", () => {
    const campaignsByCml = new Map<string, Set<string>>();
    for (const row of rows) {
      const key = `${row.Tank}|${row.Grid_Position}`;
      if (!campaignsByCml.has(key)) campaignsByCml.set(key, new Set());
      campaignsByCml.get(key)!.add(row.Measurement_Date);
    }
    expect(campaignsByCml.size).toBe(40);
    for (const [cml, dates] of campaignsByCml) {
      expect(dates.size).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps the original scantling constant at 20 mm and ISO dates the strict parser accepts", () => {
    expect(new Set(rows.map((r) => r.Original_Scantling_mm))).toEqual(new Set(["20"]));
    for (const row of rows) {
      expect(parseIsoUtc(row.Measurement_Date)).not.toBeNull();
    }
  });

  it("straddles the DEMO_METADATA band edges: min < 19.85 and max >= 19.95", () => {
    const thicknesses = rows.map((r) => Number(r.Measured_Thickness_mm));
    expect(Math.min(...thicknesses)).toBeLessThan(19.85);
    expect(Math.max(...thicknesses)).toBeGreaterThanOrEqual(19.95);
  });
});

describe("demo subset CSV mirror — identical row content to the fixture", () => {
  const csv = readFileSync(
    join(__dirname, "..", "..", "public", "sample-ut-register-subset.csv"),
    "utf8",
  ).trim();
  const lines = csv.split("\n");

  it("carries the DEMO_HEADERS header row and exactly 420 data rows", () => {
    expect(lines[0]).toBe(DEMO_HEADERS.join(","));
    expect(lines).toHaveLength(421);
  });

  it("every CSV line matches the fixture row field-for-field (same order)", () => {
    for (let i = 0; i < rows.length; i++) {
      const expected = DEMO_HEADERS.map((h) => rows[i][h]).join(",");
      expect(lines[i + 1]).toBe(expected);
    }
  });
});

describe("demo subset session — builder decisions (no special-casing)", () => {
  const session = createDemoSession("subset");

  it("loads the 420-row subset as demo data through the same session shape", () => {
    expect(session.csv.rowCount).toBe(420);
    expect(session.rows).toHaveLength(420);
    expect(session.source.isDemo).toBe(true);
    // Same source register file for both scopes — scope is carried separately.
    expect(session.source.filename).toBe(DEMO_FILENAME);
  });

  it("leaves t-initial/t-previous unmapped and carries the same mapping as the full scope", () => {
    expect(DEMO_MAPPING.tInitial).toBeNull();
    expect(DEMO_MAPPING.tPrevious).toBeNull();
    expect(session.mapping.tInitial).toBeNull();
    expect(session.mapping.tPrevious).toBeNull();
    expect(session.mapping.measuredThickness).toBe("Measured_Thickness_mm");
    expect(session.mapping.tank).toBe("Tank");
  });

  it("carries the DEMO_METADATA preset and the sample PT/MT notes/indications", () => {
    expect(session.metadata.tStructural).toBe(19.85);
    expect(session.ptmt.indications).toHaveLength(2);
  });
});

describe("demo subset end-to-end — groupByCml + evaluate land all three bands", () => {
  const session = createDemoSession("subset");
  const inputs = groupByCml(session.rows, session.mapping, {
    csvThicknessUnit: session.units.csvThickness,
  });
  const results = evaluate(inputs, session.metadata, session.units, {
    ptmtIndications: session.ptmt.indications,
  });

  it("every subset reading flows through the pipeline (420 inputs)", () => {
    expect(inputs).toHaveLength(420);
    expect(results.readings).toHaveLength(420);
  });

  it("all three verdict bands present — observed 22 accept / 53 re-check / 345 fail", () => {
    expect(results.summary.accept).toBeGreaterThan(0);
    expect(results.summary.reCheck).toBeGreaterThan(0);
    expect(results.summary.fail).toBeGreaterThan(0);
    expect(results.summary).toEqual({
      total: 420,
      locations: 1, // one mapped tank (WBT-S6)
      accept: 22,
      reCheck: 53,
      fail: 345,
    });
  });

  it("the 40 first-campaign readings (one per CML) honestly carry insufficient_history", () => {
    const noHistory = results.readings.filter(
      (r) => r.rawCrLtMmYr === null && r.rawCrStMmYr === null,
    );
    expect(noHistory).toHaveLength(40);
    for (const reading of noHistory) {
      expect(reading.flags).toContain("insufficient_history");
    }
  });
});
