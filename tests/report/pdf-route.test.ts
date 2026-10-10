/**
 * PDF route pins — 04-02 Task 2: signed-off fixture → 200 with real %PDF
 * bytes; bad input → 400 with JSON errors (UI-49/UI-50); sign-off absent →
 * 400. React 19 + @react-pdf/renderer render in vitest (smoke-proven 03-05).
 *
 * 06-01 Task 2 additions: the two-<Page> restructure — getTop10Worst is
 * RL-ascending with nulls last, the rendered buffer is still real %PDF, and
 * an element-tree walk pins the locked page-1 dashboard order (UI-6.14) with
 * the detail register beginning on page 2.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { POST } from "@/app/api/report/pdf/route";
import { buildPdfDocument, getTop10Worst } from "@/components/report/pdf-document";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  buildDispositionBannerSentence,
  buildWhatToDoNextLine,
  buildCsvPointerLine,
} from "@/lib/report/content";
import type { ReportSnapshot } from "@/lib/report/session-snapshot";
import type { ReadingResult } from "@/lib/ingest/session";

const METADATA = {
  od: 219.1,
  tNominal: 10.31,
  fca: 1,
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
};

const READING = {
  readingId: "r-1",
  location: "North header",
  cml: "CML-01",
  date: "2025-01-15T00:00:00Z",
  tActualMm: 6.5,
  tPressureMm: 4.2,
  tStructuralMm: 6.35,
  tRequiredMm: 6.35,
  crLtMmYr: 0.3,
  crStMmYr: 0.25,
  rawCrLtMmYr: 0.3,
  rawCrStMmYr: 0.25,
  crGoverningMmYr: 0.3,
  rlYears: 12.4,
  nextInspection: { date: "2030-01-15", intervalYears: 5 },
  flags: [],
  verdict: "accept",
  citations: ["api574_10_5_1_4"],
};

const SIGN_OFF = {
  name: "Mohammed Ahmed",
  certification: "NDT Level II",
  date: "2026-10-05",
  signature: "M. Ahmed",
};

function body(overrides: Record<string, unknown> = {}) {
  return {
    snapshot: {
      evaluatedAt: "2026-10-05T00:00:00Z",
      sourceName: "sample.csv",
      units: { csvThickness: "mm", metadata: "mm" },
      metadata: METADATA,
      summary: { total: 1, locations: 1, accept: 1, reCheck: 0, fail: 0 },
      readings: [READING],
      indications: [],
      notes: "Sample note.",
      signOff: SIGN_OFF,
      ...overrides,
    },
    audit: {
      evaluatedAt: "2026-10-05T00:00:00Z",
      inputHash: "a".repeat(64),
      steps: [
        { step: "extraction", model: "fixture-model", promptTokens: 100, completionTokens: 50, latencyMs: 500 },
        { step: "narrative", model: "fixture-reasoning", promptTokens: 200, completionTokens: 80, latencyMs: 900 },
      ],
    },
  };
}

function post(payload: unknown | string): Promise<Response> {
  return POST(
    new Request("http://localhost/api/report/pdf", {
      method: "POST",
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    }),
  );
}

describe("POST /api/report/pdf", () => {
  it("returns 200 with real %PDF bytes and correct headers for a signed-off snapshot (UI-49)", async () => {
    const res = await post(body());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(buf.length).toBeGreaterThan(1024);
  }, 30_000);

  it("returns 400 for an empty body", async () => {
    const res = await post("");
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("valid JSON");
  });

  it("returns 400 when metadata is missing tStructural (WR-10)", async () => {
    const bad = body();
    const meta = { ...METADATA } as Record<string, unknown>;
    delete meta.tStructural;
    (bad.snapshot as Record<string, unknown>).metadata = meta;
    const res = await post(bad);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("tStructural");
  });

  it("returns 400 for an incomplete sign-off (empty certification)", async () => {
    const bad = body();
    (bad.snapshot as Record<string, unknown>).signOff = { ...SIGN_OFF, certification: "" };
    const res = await post(bad);
    expect(res.status).toBe(400);
  });

  it("returns 400 when signOff is absent", async () => {
    const bad = body();
    (bad.snapshot as Record<string, unknown>).signOff = null;
    const res = await post(bad);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("sign-off");
  });
});

/* ---------------------------------------------------------------------------
 * 06-01 Task 2 — the two-<Page> restructure (REPT-05 / UI-6.13..UI-6.20).
 * ------------------------------------------------------------------------- */

/** Full ReadingResult factory for the multi-reading fixtures (no mocks). */
function rl(overrides: Partial<ReadingResult> & { readingId: string }): ReadingResult {
  return {
    location: "North header",
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
    verdict: "reject",
    citations: ["api570_7_1_2_lt"],
    ...overrides,
  };
}

describe("06-01 getTop10Worst — RL-ascending top-10 slice with nulls last (UI-6.17)", () => {
  it("a >10-flagged snapshot yields EXACTLY 10 rows, rlYears ascending, null-RL rows last", () => {
    const readings = [
      rl({ readingId: "r-1", rlYears: 12 }),
      rl({ readingId: "r-2", rlYears: 10 }),
      rl({ readingId: "r-3", rlYears: null, flags: ["insufficient_history"] }),
      rl({ readingId: "r-4", rlYears: 8 }),
      rl({ readingId: "r-5", rlYears: 6 }),
      rl({ readingId: "r-6", rlYears: 4 }),
      rl({ readingId: "r-7", rlYears: 2 }),
      rl({ readingId: "r-8", rlYears: 0, flags: ["immediate_inspection"] }),
      rl({ readingId: "r-9", rlYears: 11 }),
      rl({ readingId: "r-10", rlYears: 9 }),
      rl({ readingId: "r-11", rlYears: 3 }),
      rl({ readingId: "r-12", rlYears: 7 }),
    ];
    const top = getTop10Worst(readings);
    expect(top).toHaveLength(10);
    const nonNull = top.filter((r) => r.rlYears !== null).map((r) => r.rlYears as number);
    expect(nonNull).toEqual([...nonNull].sort((a, b) => a - b));
    expect(top.filter((r) => r.rlYears === null)).toHaveLength(1);
    // Null RL is LAST — "no computable life", never infinite.
    expect(top[top.length - 1].rlYears).toBeNull();
  });

  it("a <=10-reading snapshot returns ALL rows (RL-sorted, nulls last)", () => {
    const readings = [
      rl({ readingId: "r-1", rlYears: 5 }),
      rl({ readingId: "r-2", rlYears: null, flags: ["insufficient_history"] }),
      rl({ readingId: "r-3", rlYears: 1 }),
      rl({ readingId: "r-4", rlYears: 20, verdict: "accept", citations: ["api574_10_5_1_4"] }),
    ];
    const top = getTop10Worst(readings);
    expect(top).toHaveLength(4);
    expect(top.map((r) => r.readingId)).toEqual(["r-3", "r-1", "r-4", "r-2"]);
  });
});

/** Depth-first string collector over a React element tree (skips render fns). */
function collectText(node: unknown, out: string[]): void {
  if (typeof node === "string") {
    out.push(node);
    return;
  }
  if (typeof node === "number") {
    out.push(String(node));
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return;
  }
  if (node && typeof node === "object") {
    const { children } = (node as { props?: { children?: unknown } }).props ?? {};
    if (typeof children !== "function") collectText(children, out);
  }
}

/** Splits the built document into per-page flattened text (in DOM order). */
function pageTexts(docElement: unknown): string[] {
  const children = (docElement as { props?: { children?: unknown } }).props?.children;
  const pages = Array.isArray(children) ? children : [children];
  expect(pages).toHaveLength(2); // two <Page> elements (UI-6.13)
  return pages.map((page) => {
    const out: string[] = [];
    collectText((page as { props?: { children?: unknown } }).props?.children, out);
    return out.join("\n");
  });
}

describe("06-01 two-<Page> PDF document — dashboard page 1, register page 2 (UI-6.13/UI-6.14)", () => {
  it("renders through renderToBuffer as real %PDF bytes > 1024 (route render path intact)", async () => {
    const { snapshot, audit } = body();
    const buf = await renderToBuffer(
      buildPdfDocument(
        snapshot as unknown as ReportSnapshot,
        audit as unknown as Parameters<typeof buildPdfDocument>[1],
      ),
    );
    const asBuffer = Buffer.from(buf as unknown as Uint8Array);
    expect(asBuffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(asBuffer.length).toBeGreaterThan(1024);
  }, 30_000);

  it("page 1 carries the locked dashboard sequence in order; the register starts on page 2", () => {
    const { snapshot, audit } = body();
    const [page1, page2] = pageTexts(buildPdfDocument(
        snapshot as unknown as ReportSnapshot,
        audit as unknown as Parameters<typeof buildPdfDocument>[1],
      ));

    const banner = buildDispositionBannerSentence(snapshot.summary);
    const nextLine = buildWhatToDoNextLine(snapshot.summary);
    const csvLine = buildCsvPointerLine(snapshot.readings.length);

    // Locked page-1 order: banner → summary card → code-breakdown → top-10
    // headers → what-to-do-next → CSV pointer → glossary footer.
    const tokens = [
      banner,
      "EXECUTIVE EVALUATION SUMMARY",
      "vs pressure design (B31.3)",
      "vs structural minimum (API 574)",
      "CML / Location",
      "t-actual (mm)",
      "t-required (mm)",
      "RL (yr)",
      "Verdict",
      nextLine,
      csvLine,
      "Verdict glossary",
      "Wall thickness meets the code minimum at this location.",
      "API 574 §10.5.1.4",
    ];
    let prev = -1;
    for (const token of tokens) {
      const idx = page1.indexOf(token, prev + 1);
      expect(idx, `token order: ${token}`).toBeGreaterThan(prev);
      prev = idx;
    }

    // Page 1 contains ONLY the dashboard — the register labels are absent.
    expect(page1).not.toContain("Component context");
    expect(page1).not.toContain("CML measurements");

    // Page 2 carries the unchanged detail content.
    expect(page2).toContain("Component context");
    expect(page2).toContain("CML measurements");
  });

  it("the page-number footer render node exists on BOTH pages", () => {
    const { snapshot, audit } = body();
    const doc = buildPdfDocument(
        snapshot as unknown as ReportSnapshot,
        audit as unknown as Parameters<typeof buildPdfDocument>[1],
      );
    const children = (doc as { props?: { children?: unknown } }).props?.children as Array<{
      props?: { children?: unknown };
    }>;
    for (const page of children) {
      let found = false;
      const visit = (node: unknown): void => {
        if (found || !node || typeof node !== "object") return;
        if (Array.isArray(node)) {
          for (const child of node) visit(child);
          return;
        }
        const props = (node as { props?: Record<string, unknown> }).props;
        if (props && typeof props.render === "function") found = true;
        if (props && typeof props.children !== "function") visit(props.children);
      };
      visit(page);
      expect(found).toBe(true);
    }
  });

  it("import-graph pin: the PDF renderer imports VERDICT_GLOSSARY from the content seam (T-06-01-03)", () => {
    const src = readFileSync(join(process.cwd(), "components/report/pdf-document.tsx"), "utf8");
    expect(src).toContain("VERDICT_GLOSSARY");
    expect(src).toContain('from "@/lib/report/content"');
  });
});
