/**
 * Phase 09 PDF-01/PDF-02 — vector analytics in the certified report.
 *
 * Pins the vector element hierarchy of the PDF document tree: the trend
 * curve renders <Svg> with <Path>/<Line>/<Circle> primitives and the
 * severity matrix renders its <Rect> grid — zero raster images anywhere.
 * Also pins the pure adapter seam (buildGoverningTrendPoints /
 * toHeatmapItems): geometry inputs are precomputed engine values passed
 * through verbatim, with severity/identity selection only.
 */
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  buildPdfDocument,
  buildGoverningTrendPoints,
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
 * are elements whose `type` is an uppercase string ("DOCUMENT", "SVG",
 * "PATH", ...); react function components carry a function type.
 */
function typeName(type: unknown): string | null {
  if (typeof type === "string") return type.toUpperCase();
  if (typeof type === "function") return type.name;
  return "?";
}

/** Walks the element tree, invoking function components so they render. */
function walkElement(node: unknown, visit: (type: string) => void): void {
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

describe("governing trend adapter (pure)", () => {
  it("selects the reject reading's CML history in date order", () => {
    const readings = [
      reading({ readingId: "r-a", cml: "CML-01", date: "2025-01-15T00:00:00Z", verdict: "accept" }),
      reading({
        readingId: "r-b",
        cml: "CML-02",
        date: "2024-06-01T00:00:00Z",
        tActualMm: 5.9,
        verdict: "reject",
        rlYears: 0,
      }),
      reading({
        readingId: "r-c",
        cml: "CML-02",
        date: "2025-06-01T00:00:00Z",
        tActualMm: 5.7,
        verdict: "reject",
        rlYears: 0,
      }),
    ];
    const { points, cmlId, crGoverningMmYr } = buildGoverningTrendPoints(readings);
    expect(cmlId).toBe("CML-02");
    expect(points.map((p) => p.date.slice(0, 10))).toEqual(["2024-06-01", "2025-06-01"]);
    expect(points.map((p) => p.thicknessMm)).toEqual([5.9, 5.7]);
    expect(crGoverningMmYr).toBe(0.3);
  });

  it("degrades to empty for zero readings", () => {
    const { points, cmlId, crGoverningMmYr } = buildGoverningTrendPoints([]);
    expect(points).toEqual([]);
    expect(cmlId).toBe("");
    expect(crGoverningMmYr).toBeNull();
  });
});

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
    expect(items[1]).toMatchObject({ cmlId: "CML-02", x: 2, y: 1, verdict: "reject" });
  });
});

describe("PDF vector tree (PDF-01/PDF-02)", () => {
  it("renders Svg/Path/Line/Circle/Rect vector primitives with zero Image nodes", () => {
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
      {
        evaluatedAt: "2026-10-05T00:00:00Z",
        inputHash: "a".repeat(64),
        steps: [],
      },
    );
    const names = flatten(doc);
    expect(names).toContain("Svg");
    expect(names).toContain("Path");
    expect(names).toContain("Line");
    expect(names).toContain("Circle");
    expect(names).toContain("Rect");
    expect(names).not.toContain("Image");
  }, 30_000);

  it("labels the trend curve with the governing CML identity", () => {
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
    expect(texts).toContain("Degradation Projection — CML-02");
  }, 30_000);

  it("produces real %PDF bytes with the analytics mounted", async () => {
    const buf = await renderToBuffer(
      buildPdfDocument(
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
      ),
    );
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
  }, 60_000);

  it("keeps getTop10Worst intact (existing phase-06 contract)", () => {
    const readings = [
      reading({ readingId: "r-a", cml: "CML-01", rlYears: 20 }),
      reading({ readingId: "r-b", cml: "CML-02", verdict: "reject", rlYears: 0 }),
    ];
    const top10 = getTop10Worst(snapshot(readings));
    expect(top10).toHaveLength(2);
    expect(top10[0].readingId).toBe("r-b");
  });
});
