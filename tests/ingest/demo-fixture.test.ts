import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fixture from "@/lib/demo/fixtures/zenodo-16780668-ut-register.json";
import {
  createDemoSession,
  DEMO_HEADERS,
  DEMO_MAPPING,
} from "@/lib/demo/demo-scenario";
import { groupByCml } from "@/lib/ingest/group";
import { evaluate } from "@/lib/calc/evaluate";
import { parseIsoUtc } from "@/lib/calc/dates";

/**
 * Gates the committed demo fixture forever (research demo-fixture assertion
 * table, corrected by direct verification at acquisition time — see the
 * deviations note in 02-03-SUMMARY.md):
 * - the research's MEDIUM-confidence A1 claims (thickness 19.0-19.98, ISO
 *   source dates) were DIVERGENT: the real register spans 18.88-20.0 mm with
 *   DD/MM/YYYY source dates. The transform normalizes dates to ISO
 *   (documented in ATTRIBUTION.md); thickness bounds below pin the REAL
 *   observed range, never the anticipated one.
 */
const rows = fixture as unknown as Array<Record<string, string>>;

const EXPECTED_TANKS = [
  "WBT-P1",
  "WBT-P2",
  "WBT-P3",
  "WBT-P4",
  "WBT-P5",
  "WBT-P6",
  "WBT-S1",
  "WBT-S2",
  "WBT-S3",
  "WBT-S4",
  "WBT-S5",
  "WBT-S6",
];

describe("demo fixture — the real Zenodo 16780668 Appendix A subset", () => {
  it("contains exactly 4,912 data rows", () => {
    expect(rows).toHaveLength(4912);
  });

  it("carries exactly the six source columns on every row", () => {
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([...DEMO_HEADERS].sort());
    }
  });

  it("has 12 distinct Tank values with the observed names", () => {
    const tanks = [...new Set(rows.map((r) => r.Tank))].sort();
    expect(tanks).toEqual(EXPECTED_TANKS);
  });

  it("spans 11 distinct campaign years, 2015-2025", () => {
    const years = [...new Set(rows.map((r) => r.Measurement_Date.slice(0, 4)))].sort();
    expect(years).toHaveLength(11);
    expect(years[0]).toBe("2015");
    expect(years[years.length - 1]).toBe("2025");
  });

  it("keeps the original scantling constant at 20 mm", () => {
    expect(new Set(rows.map((r) => r.Original_Scantling_mm))).toEqual(new Set(["20"]));
  });

  it("keeps measured thickness within the observed 18.88-20.0 mm range", () => {
    for (const row of rows) {
      const t = Number(row.Measured_Thickness_mm);
      expect(t).toBeGreaterThanOrEqual(18.88);
      expect(t).toBeLessThanOrEqual(20.0);
    }
  });

  it("stores ISO dates that the strict parser accepts (no permissive fallback)", () => {
    for (const row of rows) {
      expect(parseIsoUtc(row.Measurement_Date)).not.toBeNull();
    }
  });
});

describe("demo session — builder decisions", () => {
  const session = createDemoSession();

  it("loads 4,912 rows as demo data", () => {
    expect(session.csv.rowCount).toBe(4912);
    expect(session.rows).toHaveLength(4912);
    expect(session.source.isDemo).toBe(true);
  });

  it("leaves t-initial/t-previous unmapped — derived R6 campaign history governs", () => {
    expect(DEMO_MAPPING.tInitial).toBeNull();
    expect(DEMO_MAPPING.tPrevious).toBeNull();
    expect(session.mapping.tInitial).toBeNull();
    expect(session.mapping.tPrevious).toBeNull();
  });

  it("carries the sample PT/MT notes and two structured indications", () => {
    expect(session.ptmt.notes.length).toBeGreaterThan(0);
    expect(session.ptmt.indications).toHaveLength(2);
  });
});

describe("demo smoke — evaluate over the real fixture lands all three verdict bands", () => {
  const session = createDemoSession();
  const inputs = groupByCml(session.rows, session.mapping, {
    csvThicknessUnit: session.units.csvThickness,
  });
  const results = evaluate(inputs, session.metadata, session.units, {
    ptmtIndications: session.ptmt.indications,
  });

  it("every reading flows through the pipeline (4,912 inputs)", () => {
    expect(inputs).toHaveLength(4912);
    expect(results.readings).toHaveLength(4912);
  });

  it("at least one verdict in each of accept / re_check / fail", () => {
    expect(results.summary.accept).toBeGreaterThan(0);
    expect(results.summary.reCheck).toBeGreaterThan(0);
    expect(results.summary.fail).toBeGreaterThan(0);
    // Observed at acquisition time against t_required 19.85 ± 0.1:
    // 301 accept / 538 re_check / 4,073 fail.
    expect(results.summary).toEqual({
      total: 4912,
      locations: 12,
      accept: 301,
      reCheck: 538,
      fail: 4073,
    });
  });

  it("PT/MT sample indications triage to one reject (linear MT) and one accept (non-relevant PT)", () => {
    expect(results.indications).toHaveLength(2);
    const byId = new Map(results.indications.map((i) => [i.id, i]));
    expect(byId.get("demo-ind-mt-linear")!.verdict).toBe("reject");
    expect(byId.get("demo-ind-pt-rounded")!.verdict).toBe("accept");
  });
});

describe("demo attribution — CC BY 4.0 credit committed verbatim", () => {
  const attribution = readFileSync(
    join(__dirname, "..", "..", "lib", "demo", "ATTRIBUTION.md"),
    "utf8",
  );

  it("carries the DOI, the license grant, and the sample-data labeling", () => {
    expect(attribution).toContain("10.5281/zenodo.16780668");
    expect(attribution).toContain("CC BY 4.0");
    expect(attribution.toLowerCase()).toContain("sample data");
    expect(attribution).toContain("Pudar, A. (2025)");
  });
});
