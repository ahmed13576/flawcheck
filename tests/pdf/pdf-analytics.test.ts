/**
 * Phase 09 PDF-01/PDF-02/PDF-03 — vector analytics in the certified report.
 *
 * Pins the vector element hierarchy of the PDF document tree: the fan plot
 * renders <Svg> with <Path>/<Line>/<Circle> primitives and the severity
 * matrix renders its <Rect> grid — zero raster images anywhere. The fan
 * mounts through the shared limiting-series adapter (buildLimitingSeries —
 * pinned in tests/analytics/fan-series.test.ts), and page 3 falls back to the
 * no-positive-rate message when no limiting CML has a validated positive
 * governing rate. The pure heatmap seam (toHeatmapItems) stays pinned here.
 */
import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  buildClauseReferenceLines,
  buildPdfDocument,
  toHeatmapItems,
  getTop10Worst,
} from "@/components/report/pdf-document";
import type { ReportSnapshot } from "@/lib/report/session-snapshot";
import type { ReadingResult } from "@/lib/ingest/session";

function reading(overrides: Partial<ReadingResult> = {}): ReadingResult {
  return {
    readingId: "r-1",
    location: "North header",
    cml: "CML-01",
    date: "2025-01-15T00:00:00Z",
    tActualMm: 6.5,
    tPressureMm: 4.2,
    tStructuralMm: 6.35,
    tRequiredMm: 6.35,
    crLtMmYr: 0.3,
    crStMmYr: null,
    rawCrLtMmYr: 0.3,
    rawCrStMmYr: null,
    crGoverningMmYr: 0.3,
    rlYears: 12.4,
    nextInspection: null,
    flags: [],
    verdict: "accept",
    citations: ["api574_10_5_1_4"],
    ...overrides,
  };
}

const METADATA = {
  od: 219.1,
  tNominal: 10.31,
  fca: 1,
  tStructural: 6.35,
  designCode: "ASME B31.3 — 2024 Edition" as const,
  pipeClass: 2 as const,
  gaugeUncertainty: 0.1,
  pressureUnit: "MPa" as const,
  designPressure: 3.5,
  allowableStress: 138,
  e: 1,
  w: 1,
  y: 0.4,
  formula: "asme_b31_3_straight_pipe" as const,
};

function snapshot(readings: ReadingResult[]): ReportSnapshot {
  return {
    evaluatedAt: "2026-10-05T00:00:00Z",
    sourceName: "sample.csv",
    units: { csvThickness: "mm", metadata: "mm" },
    metadata: METADATA,
    summary: {
      total: readings.length,
      locations: readings.length,
      accept: readings.filter((r) => r.verdict === "accept").length,
      reCheck: readings.filter((r) => r.verdict === "re_check").length,
      fail: readings.filter((r) => r.verdict === "reject").length,
    },
    readings,
    indications: [],
    notes: "Test snapshot.",
    signOff: null,
  };
}

/**
 * Normalize a React element type to a comparable name. React-pdf primitives
 * are elements whose `type` is a string ("svg", "path", ... — compared
 * case-insensitively); react function components carry a function type.
 */
function typeName(type: unknown): string | null {
  if (typeof type === "string") return type.toLowerCase();
  if (typeof type === "function") return type.name;
  return "?";
}

/** Walks the element tree, invoking function components so they render. */
function walkElement(node: unknown, visit: (type: string) => void): void {
  // Adjacent JSX .map() expressions produce NESTED children arrays
  // ([[rect, rect], [g, g]]) — descend them, or the whole Svg subtree
  // (and any multi-expression block) is silently dropped.
  if (Array.isArray(node)) {
    for (const c of node) walkElement(c, visit);
    return;
  }
  if (typeof node !== "object" || node === null) return;
  const el = node as { type?: unknown; props?: { children?: unknown } };
  if (el.type === undefined) return;
  visit(typeName(el.type) ?? "?");
  if (typeof el.type === "function") {
    // Invoke pure function components (no hooks in these components) so the
    // walker can descend into their rendered output.
    const rendered = (el.type as (p: unknown) => unknown)(el.props);
    walkElement(rendered, visit);
    return;
  }
  const children = el.props?.children;
  if (Array.isArray(children)) for (const c of children) walkElement(c, visit);
  else if (children) walkElement(children, visit);
}

/** Pure element-tree walker — finds nodes by element type name. */
function flatten(node: unknown, acc: string[] = []): string[] {
  walkElement(node, (t) => acc.push(t));
  return acc;
}

/** Collects text instances from the document tree. */
function collectText(node: unknown, acc: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const c of node) collectText(c, acc);
    return acc;
  }
  if (typeof node === "string") acc.push(node);
  if (typeof node !== "object" || node === null) return acc;
  const el = node as { type?: unknown; props?: { children?: unknown } };
  if (typeof el.type === "function") {
    const rendered = (el.type as (p: unknown) => unknown)(el.props);
    collectText(rendered, acc);
    return acc;
  }
  const children = el.props?.children;
  if (Array.isArray(children)) for (const c of children) collectText(c, acc);
  else if (children) collectText(children, acc);
  return acc;
}

/**
 * Two readings per CML so at least one limiting series carries a positive
 * validated governing rate and a 2-point history — the fan-mount guard's
 * minimum fixture (the single-reading fixtures below exercise the fallback).
 */
function multiPointReadings(): ReadingResult[] {
  return [
    reading({ readingId: "r-a1", cml: "CML-01", date: "2024-06-01T00:00:00Z", tActualMm: 6.8 }),
    reading({ readingId: "r-a2", cml: "CML-01", date: "2025-06-01T00:00:00Z", tActualMm: 6.5 }),
    reading({
      readingId: "r-b1",
      cml: "CML-02",
      date: "2024-06-01T00:00:00Z",
      tActualMm: 5.9,
      verdict: "reject",
      rlYears: 0,
    }),
    reading({
      readingId: "r-b2",
      cml: "CML-02",
      date: "2025-06-01T00:00:00Z",
      tActualMm: 5.7,
      verdict: "reject",
      rlYears: 0,
    }),
  ];
}

describe("heatmap adapter (pure)", () => {
  it("lays readings on a dense row-major grid with verbatim values", () => {
    const readings = [
      reading({ readingId: "r-a", cml: "CML-01" }),
      reading({ readingId: "r-b", cml: "CML-02", verdict: "reject" }),
    ];
    const items = toHeatmapItems(readings);
    expect(items).toHaveLength(2);
    // cols = ceil(sqrt(2)) = 2 → item 0 at (1,1), item 1 at (2,1)
    expect(items[0]).toMatchObject({ cmlId: "CML-01", x: 1, y: 1, tActualMm: 6.5, verdict: "accept" });
    expect(items[1]).toMatchObject({ cmlId: "CML-02", x: 2, y: 1, verdict: "accept" });
  });

  it("deduplicates readings sharing a CML identity, keeping latest (prevents duplicate React keys in PDF)", () => {
    const readings = [
      reading({ readingId: "r-a1", cml: "CML-01", date: "2015-01-01", tActualMm: 6.8 }),
      reading({ readingId: "r-a2", cml: "CML-01", date: "2016-01-01", tActualMm: 6.5 }),
    ];
    const items = toHeatmapItems(readings);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ cmlId: "CML-01", tActualMm: 6.5 });
  });
});

describe("PDF vector tree (PDF-01/PDF-02/PDF-03)", () => {
  it("renders Svg/Path/Line/Circle/Rect vector primitives with zero Image nodes", () => {
    const doc = buildPdfDocument(
      snapshot(multiPointReadings()),
      {
        evaluatedAt: "2026-10-05T00:00:00Z",
        inputHash: "a".repeat(64),
        steps: [
          {
            step: "extraction" as const,
            model: null,
            promptTokens: null,
            completionTokens: null,
            latencyMs: null,
          },
          {
            step: "narrative" as const,
            model: null,
            promptTokens: null,
            completionTokens: null,
            latencyMs: null,
          },
        ],
      },
    );
    const names = flatten(doc);
    expect(names).toContain("document");
    expect(names).toContain("page");
    expect(names).toContain("text");
    // The fan plot actually MOUNTS on this fixture (CML-02 has a positive
    // validated governing rate and a 2-point history), so the vector
    // primitives are really present — not just absent-Image.
    expect(names).toContain("PdfFanPlot");
    expect(names).toContain("svg");
    expect(names).toContain("path");
    expect(names).toContain("line");
    expect(names).toContain("circle");
    expect(names).toContain("rect");
    expect(names).not.toContain("image");
  }, 30_000);

  it("labels the fan plot with the limiting CML identities and its caption", () => {
    const doc = buildPdfDocument(snapshot(multiPointReadings()), null);
    const texts = collectText(doc).join(" ");
    expect(texts).toContain("Degradation fan — limiting CMLs on one scale");
    expect(texts).toContain("Limiting CML degradation fan");
    // Legend identities — both limiting CMLs, worst (CML-02) included.
    expect(texts).toContain("CML-01");
    expect(texts).toContain("CML-02");
    expect(texts).toContain("2 limiting CMLs by historical minimum");
    expect(texts).toContain("Master CML Register");
    expect(texts).toContain("Population reconciliation");
  }, 30_000);

  it("falls back to the no-positive-rate message instead of a chart when no limiting CML has a validated rate", () => {
    // Single reading per CML — no 2-point history, so the fan-mount guard
    // fails exactly like the old single-series trend guard did.
    const doc = buildPdfDocument(
      snapshot([
        reading({ readingId: "r-a", cml: "CML-01" }),
        reading({
          readingId: "r-b",
          cml: "CML-02",
          tActualMm: 5.9,
          verdict: "reject",
          rlYears: 0,
        }),
      ]),
      null,
    );
    const texts = collectText(doc).join(" ");
    expect(texts).toContain(
      "No positive validated corrosion rate is available for any limiting CML",
    );
    expect(texts).toContain("would imply a guarantee the measurements do not support");
    // The fan never mounts — the page-1 heatmap's Svg is still present, so
    // assert on the fan component itself, which appears only when mounted.
    expect(flatten(doc)).not.toContain("PdfFanPlot");
  }, 30_000);

  it("produces real %PDF bytes with the analytics mounted", async () => {
    const buf = await renderToBuffer(
      buildPdfDocument(snapshot(multiPointReadings()), null),
    );
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
  }, 60_000);

  it("keeps getTop10Worst intact (existing phase-06 contract)", () => {
    const readings = [
      reading({ readingId: "r-a", cml: "CML-01", rlYears: 20 }),
      reading({ readingId: "r-b", cml: "CML-02", verdict: "reject", rlYears: 0 }),
    ];
    const top10 = getTop10Worst(readings);
    expect(top10).toHaveLength(2);
    expect(top10[0].readingId).toBe("r-b");
  });
});

describe("clause/threshold reference block (Phase 09, pure)", () => {
  it("states each governing rule ONCE with a citation composed from citations.json", () => {
    const lines = buildClauseReferenceLines(METADATA);
    expect(lines.map((l) => l.rule)).toEqual([
      "Required thickness",
      "Verdict bands",
      "Corrosion rate",
      "Remaining life",
    ]);
    // Cite-don't-quote: every citation is composed by citationRef from
    // citations.json — none is a typed clause string.
    expect(lines[0]).toMatchObject({
      text: expect.stringContaining("t_required = max(t_pressure, t_structural)"),
      citation: "API 574 §10.5.1.4",
    });
    expect(lines[1].citation).toBe("API 570 §7.6");
    expect(lines[2].citation).toBe("API 570 §7.1.2");
    expect(lines[3].citation).toBe("API 570 §7.2");
  });

  it("derives verdict-band boundaries from the evaluation's OWN metadata, never a demo literal", () => {
    // This fixture's tStructural is 6.35 (not the WBT-S6 demo 19.85), so the
    // block must print 6.35/6.45 — a hardcoded demo literal would be wrong here.
    const bands = buildClauseReferenceLines(METADATA)[1].text;
    expect(bands).toContain("FAIL below 6.35 mm");
    expect(bands).toContain("RE-CHECK 6.35 through 6.45 mm inclusive");
    expect(bands).toContain("ACCEPT only above 6.45 mm");
    expect(bands).not.toContain("19.85");
    expect(bands).not.toContain("19.95");
  });

  it("carries the criteria thresholds and the remaining-life clamp, not JSX literals", () => {
    const lines = buildClauseReferenceLines(METADATA);
    // ut-criteria.json corrosion_rate_validation: minimum_short_term_interval_
    // years 0.25 and gauge_deadband_mm 0.1 — pinned as literals per the
    // Phase-8 anti-self-reference rule.
    expect(lines[2].text).toContain("0.25 yr");
    expect(lines[2].text).toContain("0.1 mm gauge deadband");
    expect(lines[3].text).toContain("RL = (t_actual - t_required) / CR_governing");
    expect(lines[3].text).toContain("clamped to 0.0 yr");
    expect(lines[3].text).toContain("N/A");
  });
});
