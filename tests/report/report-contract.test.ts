/**
 * 04-01 Task 1 — report session contract tests: the optional validated
 * signOff on the report snapshot (sessionStorage round-trip, degrade-to-
 * absent on corrupt shapes, pure withSignOff), the pre-existing parseSnapshot
 * behavior (unchanged without signOff), and the lib/report/content.ts seam
 * exports (citationRef zero-glyphs for unknown ids).
 *
 * Node environment: sessionStorage does not exist — every storage test stubs
 * globalThis.sessionStorage with an in-memory map.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  REPORT_SNAPSHOT_KEY,
  readReportSnapshot,
  withSignOff,
  writeReportSnapshot,
  type ReportSnapshot,
  type ReportSignOff,
} from "@/lib/report/session-snapshot";
import {
  REPORT_UNIT_ASSUMPTION_COPY,
  buildConclusions,
  citationRef,
  earliestNextInspection,
} from "@/lib/report/content";

const SIGN_OFF: ReportSignOff = {
  name: "J. Alvarez",
  certification: "API 570 #57012",
  date: "2026-09-27",
  signature: "signed in presence of unit operator",
};

const BASE_SNAPSHOT: ReportSnapshot = {
  evaluatedAt: "2026-09-27T14:32:00Z",
  sourceName: "ut_register_demo.csv",
  units: { csvThickness: "mm", metadata: "mm" },
  metadata: {
    od: 219.1,
    tNominal: 10.31,
    fca: 1.0,
    tStructural: 6.35,
    designCode: "ASME B31.3 — 2024 Edition",
    pipeClass: 2,
    gaugeUncertainty: 0.1,
    pressureUnit: "MPa",
    designPressure: 3.5,
    allowableStress: 138,
    e: 1,
    w: 1,
    y: 0.4,
    formula: "asme_b31_3_straight_pipe",
  },
  summary: { total: 1, locations: 1, accept: 1, reCheck: 0, fail: 0 },
  readings: [],
  indications: [],
  notes: "",
};

/* In-memory sessionStorage stub (node has none), re-installed before each test. */
const backing = new Map<string, string>();
beforeEach(() => {
  backing.clear();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = {
    getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
    setItem: (k: string, v: string) => {
      backing.set(k, v);
    },
    removeItem: (k: string) => {
      backing.delete(k);
    },
    clear: () => {
      backing.clear();
    },
    key: (i: number) => Array.from(backing.keys())[i] ?? null,
    get length() {
      return backing.size;
    },
  };
});
afterEach(() => {
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
});

describe("04-01 sign-off persistence on the report snapshot", () => {
  it("a complete signOff survives the writeReportSnapshot/readReportSnapshot round-trip with all four fields intact", () => {
    writeReportSnapshot({ ...BASE_SNAPSHOT, signOff: SIGN_OFF });
    const roundTripped = readReportSnapshot();
    expect(roundTripped).not.toBeNull();
    expect(roundTripped?.signOff).toEqual({
      name: "J. Alvarez",
      certification: "API 570 #57012",
      date: "2026-09-27",
      signature: "signed in presence of unit operator",
    });
  });

  it("a signOff with one empty field parses back with signOff ABSENT (degrade, never throw)", () => {
    writeReportSnapshot({
      ...BASE_SNAPSHOT,
      signOff: { ...SIGN_OFF, certification: "" },
    });
    const parsed = readReportSnapshot();
    expect(parsed).not.toBeNull();
    expect(parsed?.signOff).toBeUndefined();
    // The rest of the snapshot stays valid.
    expect(parsed?.sourceName).toBe("ut_register_demo.csv");
  });

  it("corrupt signOff shapes degrade to absent — wrong type, array, non-string field", () => {
    for (const corrupt of ["bogus", 42, ["x"], { name: 7, certification: "c", date: "d", signature: "s" }]) {
      backing.set(REPORT_SNAPSHOT_KEY, JSON.stringify({ ...BASE_SNAPSHOT, signOff: corrupt }));
      const parsed = readReportSnapshot();
      expect(parsed).not.toBeNull();
      expect(parsed?.signOff).toBeUndefined();
    }
  });

  it("a snapshot WITHOUT signOff behaves exactly as before (no signOff key added)", () => {
    writeReportSnapshot(BASE_SNAPSHOT);
    const parsed = readReportSnapshot();
    expect(parsed).toEqual(BASE_SNAPSHOT);
    expect("signOff" in (parsed ?? {})).toBe(false);
  });

  it("withSignOff returns a NEW object with signOff set and never mutates its input", () => {
    const next = withSignOff(BASE_SNAPSHOT, SIGN_OFF);
    expect(next).not.toBe(BASE_SNAPSHOT);
    expect(next.signOff).toEqual(SIGN_OFF);
    expect(BASE_SNAPSHOT.signOff).toBeUndefined(); // input untouched
  });

  it("a corrupt stored payload still returns null (pre-existing defensive contract)", () => {
    backing.set(REPORT_SNAPSHOT_KEY, "{not json");
    expect(readReportSnapshot()).toBeNull();
    backing.set(REPORT_SNAPSHOT_KEY, "null");
    expect(readReportSnapshot()).toBeNull();
  });
});

describe("04-01 lib/report/content.ts — the server-safe content seam", () => {
  it("exports the moved pure derivations (functions resolve)", () => {
    expect(typeof citationRef).toBe("function");
    expect(typeof buildConclusions).toBe("function");
    expect(typeof earliestNextInspection).toBe("function");
    expect(typeof REPORT_UNIT_ASSUMPTION_COPY).toBe("string");
  });

  it("citationRef still renders ZERO glyphs for an unknown id and record fields for known ids", () => {
    expect(citationRef("not_a_real_citation_id")).toBe("");
    expect(citationRef("asme_b31_3_344_3_2")).toBe("ASME B31.3 §344.3.2");
    expect(citationRef("api570_6_3_3_halflife")).toBe("API 570 §6.3.3");
  });

  it("buildConclusions/earliestNextInspection behave identically through the seam", () => {
    expect(buildConclusions(BASE_SNAPSHOT)).toEqual([]);
    expect(earliestNextInspection(BASE_SNAPSHOT)).toBeNull();
  });

  it("the unit-assumption copy matches the Screen 3 string byte-for-byte", () => {
    expect(REPORT_UNIT_ASSUMPTION_COPY).toBe(
      "Units: CSV thickness in {csv}, metadata in {meta}. All values converted to mm (canonical).",
    );
  });
});
