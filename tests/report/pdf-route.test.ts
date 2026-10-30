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

describe("06-01 getTop10Worst — RL-ascending top-10 slice with nulls last (UI-6.17 / CR-01)", () => {
  it("a >10-flagged snapshot yields EXACTLY 10 rows from the true worst set (CR-01 pre-sort fix)", () => {
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
    // r-11 (3 yr) and r-12 (7 yr) at indices 10 & 11 in input MUST be included in the top-10 worst
    expect(top.map((r) => r.readingId)).toContain("r-11");
    expect(top.map((r) => r.readingId)).toContain("r-12");
    // r-1 (12 yr) is excluded because 10 worse readings exist
    expect(top.map((r) => r.readingId)).not.toContain("r-1");
    const nonNull = top.filter((r) => r.rlYears !== null).map((r) => r.rlYears as number);
    expect(nonNull).toEqual([...nonNull].sort((a, b) => a - b));
  });

  it("places null-RL reading last among selected rows when included in top 10", () => {
    const readings = [
      rl({ readingId: "r-1", rlYears: 5 }),
      rl({ readingId: "r-2", rlYears: 10 }),
      rl({ readingId: "r-3", rlYears: null, flags: ["insufficient_history"] }),
      rl({ readingId: "r-4", rlYears: 8 }),
    ];
    const top = getTop10Worst(readings);
    expect(top).toHaveLength(4);
    expect(top[top.length - 1].rlYears).toBeNull();
    expect(top[top.length - 1].readingId).toBe("r-3");
  });

  it("a <=10-reading snapshot returns ALL rows (rejects before accept, RL-sorted, nulls last)", () => {
    const readings = [
      rl({ readingId: "r-1", rlYears: 5 }),
      rl({ readingId: "r-2", rlYears: null, flags: ["insufficient_history"] }),
      rl({ readingId: "r-3", rlYears: 1 }),
      rl({ readingId: "r-4", rlYears: 20, verdict: "accept", citations: ["api574_10_5_1_4"] }),
    ];
    const top = getTop10Worst(readings);
    expect(top).toHaveLength(4);
    expect(top.map((r) => r.readingId)).toEqual(["r-3", "r-1", "r-2", "r-4"]);
  });

  it("adversarial stress test: 50 flagged readings with random & edge-case RL (null, Infinity, 0.001 yr blowouts)", () => {
    // 50 readings spanning all severity classes, flags, and edge-case remaining life values
    const generated: ReadingResult[] = [
      // Tier 1: immediate_inspection (dominant over verdict & RL)
      rl({ readingId: "imm-rej-0", flags: ["immediate_inspection"], verdict: "reject", rlYears: 0 }),
      rl({ readingId: "imm-rej-0001", flags: ["immediate_inspection"], verdict: "reject", rlYears: 0.001 }),
      rl({ readingId: "imm-rej-null", flags: ["immediate_inspection"], verdict: "reject", rlYears: null }),
      rl({ readingId: "imm-chk-0001", flags: ["immediate_inspection"], verdict: "re_check", rlYears: 0.001 }),
      rl({ readingId: "imm-acc-0001", flags: ["immediate_inspection"], verdict: "accept", rlYears: 0.001 }),

      // Tier 2: reject (no immediate_inspection)
      rl({ readingId: "rej-blowout-0001", flags: [], verdict: "reject", rlYears: 0.001 }),
      rl({ readingId: "rej-0002", flags: [], verdict: "reject", rlYears: 0.002 }),
      rl({ readingId: "rej-0010", flags: [], verdict: "reject", rlYears: 0.01 }),
      rl({ readingId: "rej-0100", flags: [], verdict: "reject", rlYears: 0.1 }),
      rl({ readingId: "rej-0500", flags: [], verdict: "reject", rlYears: 0.5 }),
      // Boundary items (11th and beyond):
      rl({ readingId: "rej-1000", flags: [], verdict: "reject", rlYears: 1.0 }),
      rl({ readingId: "rej-2500", flags: [], verdict: "reject", rlYears: 2.5 }),
      rl({ readingId: "rej-inf", flags: [], verdict: "reject", rlYears: Infinity }),
      rl({ readingId: "rej-null", flags: [], verdict: "reject", rlYears: null }),

      // Tier 3: re_check (18 items, rlYears from 0.001 to 20.0 + null)
      ...Array.from({ length: 18 }, (_, i) =>
        rl({
          readingId: `chk-${i}`,
          flags: [],
          verdict: "re_check",
          rlYears: i === 0 ? 0.001 : i === 17 ? null : i * 1.1,
        }),
      ),

      // Tier 4: accept (18 items, rlYears from 0.001 to 100.0 + null + Infinity)
      ...Array.from({ length: 18 }, (_, i) =>
        rl({
          readingId: `acc-${i}`,
          flags: [],
          verdict: "accept",
          rlYears: i === 0 ? 0.001 : i === 1 ? Infinity : i === 17 ? null : i * 5.0,
        }),
      ),
    ];

    expect(generated).toHaveLength(50);

    // Shuffle into reverse order to guarantee sort isn't relying on input order
    const shuffled = [...generated].reverse();

    const top = getTop10Worst(shuffled);
    expect(top).toHaveLength(10);

    const expectedOrder = [
      "imm-rej-0",
      "imm-rej-0001",
      "imm-rej-null",
      "imm-chk-0001",
      "imm-acc-0001",
      "rej-blowout-0001",
      "rej-0002",
      "rej-0010",
      "rej-0100",
      "rej-0500",
    ];

    expect(top.map((r) => r.readingId)).toEqual(expectedOrder);
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
  expect(pages).toHaveLength(3); // three <Page> elements: triage, register, trend/audit/sign-off
  return pages.map((page) => {
    const out: string[] = [];
    collectText((page as { props?: { children?: unknown } }).props?.children, out);
    return out.join("\n");
  });
}

describe("3-page PDF document — triage page 1, register page 2, trend/audit/sign-off page 3", () => {
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

  it("page 1 carries the exception-first dashboard and the Master Register starts on page 2", () => {
    const { snapshot, audit } = body();
    const doc = buildPdfDocument(
      snapshot as unknown as Parameters<typeof buildPdfDocument>[0],
      audit as unknown as Parameters<typeof buildPdfDocument>[1],
    );
    const texts = pageTexts(doc);
    const page1 = String(texts[0]);
    const page2 = String(texts[1]);
    expect(page1).toContain("Population reconciliation");
    expect(page1).toContain("Priority 1 deterministic surface indication");
    expect(page1).toContain("Top 10 unique CMLs");
    expect(page1).not.toContain("Clause-cited conclusions");
    expect(page2).toContain("Master CML Register");
    expect(page2).toContain("exactly one row per WBT-S6 CML");
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

  it("import-graph pin: the PDF renderer imports deterministic report content helpers", () => {
    const src = readFileSync(join(process.cwd(), "components/report/pdf-document.tsx"), "utf8");
    expect(src).toContain("buildCodeBreakdown");
    expect(src).toContain('from "@/lib/report/content"');
    expect(src).toContain("buildCmlSummaries");
  });
});

describe("CR-02 / CR-05 / WR-01 / WR-08 regression tests", () => {
  it("CR-02: rejected PT/MT indications trigger ACTION REQUIRED banner even when UT passes", () => {
    const { snapshot, audit } = body();
    const snap = {
      ...(snapshot as unknown as ReportSnapshot),
      summary: { total: 10, locations: 1, accept: 10, reCheck: 0, fail: 0 },
      indications: [
        {
          id: "pt-1",
          method: "PT" as const,
          morphology: "linear" as const,
          lengthMm: 25,
          widthMm: 2,
          surfaceOrInternal: "surface" as const,
          verdict: "reject" as const,
          citationId: "asme_b31_3_pt_linear",
        },
      ],
    };
    const [page1] = pageTexts(
      buildPdfDocument(
        snap as unknown as ReportSnapshot,
        audit as unknown as Parameters<typeof buildPdfDocument>[1],
      ),
    );
    expect(page1).toContain("Priority 1 deterministic surface indication");
    expect(page1).toContain("Priority 1");
    expect(page1).toContain("FAIL");
    expect(page1).toContain("NDT examination, API inspection, and engineering/FFS decisions remain separate responsible roles");
  });

  it("CR-05 / WR-01: Page 1 renders explicit inclusive verdict boundary labels", () => {
    // Bands are derived from the evaluation's own metadata, so this fixture
    // (tStructural 6.35, gauge 0.10) must print its own numbers - a hardcoded
    // WBT-S6 literal here would print wrong thresholds for any other component.
    const { snapshot, audit } = body();
    const [page1] = pageTexts(buildPdfDocument(
      snapshot as unknown as ReportSnapshot,
      audit as unknown as Parameters<typeof buildPdfDocument>[1],
    ));
    expect(page1).toContain("FAIL below 6.35 mm");
    expect(page1).toContain("RE-CHECK 6.35 through 6.45 mm inclusive");
    expect(page1).toContain("ACCEPT only above 6.45 mm with no active anomaly");
  });

  it("CR-05: the WBT-S6 demo prints its own 19.85/19.95 inclusive boundary", async () => {
    const { createDemoSession } = await import("@/lib/demo/demo-scenario");
    const { groupByCml } = await import("@/lib/ingest/group");
    const { evaluate } = await import("@/lib/calc/evaluate");
    const { buildReportSnapshot, withSignOff } = await import("@/lib/report/session-snapshot");
    const session = createDemoSession("subset");
    const inputs = groupByCml(session.rows, session.mapping, {
      csvThicknessUnit: session.units.csvThickness,
    });
    const results = evaluate(inputs, session.metadata, session.units, {
      ptmtIndications: session.ptmt.indications,
    });
    const snap = buildReportSnapshot({ ...session, results }, "2026-10-25T00:00:00.000Z")!;
    const signed = withSignOff(snap, {
      name: "QA",
      certification: "ASNT NDT Level II",
      date: "2026-10-25",
      signature: "QA",
    });
    const [page1] = pageTexts(buildPdfDocument(signed, null));
    expect(page1).toContain("FAIL below 19.85 mm");
    expect(page1).toContain("RE-CHECK 19.85 through 19.95 mm inclusive");
    expect(page1).toContain("ACCEPT only above 19.95 mm with no active anomaly");
  }, 60_000);

  it("CR-05: Page 2 table header is non-wrapping for the one-row-per-CML register", () => {
    const src = readFileSync(join(process.cwd(), "components/report/pdf-document.tsx"), "utf8");
    expect(src).toContain("wrap={false}");
    expect(src).toContain("Master CML Register");
  });

  it("WR-08: report limits avoid final engineering approval claims", () => {
    const { snapshot, audit } = body();
    const [page1] = pageTexts(buildPdfDocument(
      snapshot as unknown as ReportSnapshot,
      audit as unknown as Parameters<typeof buildPdfDocument>[1],
    ));
    expect(page1).toContain("not professional engineering certification");
    expect(page1).toContain("not");
    expect(page1).toContain("final continued-service authorization");
  });
});

