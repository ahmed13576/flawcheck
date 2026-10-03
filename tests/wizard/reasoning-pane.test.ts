/**
 * Reasoning pane + 11-column table pins — 03-01 Task 2. SSR markup checks via
 * react-dom/server (the Phase 2 precedent): the deterministic chain renders in
 * every state; the fallback state shows the DETERMINISTIC FALLBACK chip and
 * `— · — · —` metrics (never fabricated usage); an unresolved citation id
 * renders zero glyphs at its position while the audit stamp names it; a
 * resolved id renders a chip labeled from citations.json record fields; an
 * empty citations array renders `—` (UI-48); error/streaming state copy and
 * UI-46/47 classes are pinned; the results table renders 11 columns in the
 * locked order with the sticky CML/Verdict/Reasoning cluster, aria-wired
 * toggles, and colSpan-11 detail rows.
 */
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReasoningPane, type NarrativeEntryState } from "@/components/wizard/reasoning-pane";
import {
  ReasoningDetailRow,
  ResultsTable,
} from "@/components/wizard/results-table";
import { criteria } from "@/lib/calc/criteria";
import type {
  ComponentMetadata,
  ReadingResult,
} from "@/lib/ingest/session";

const METADATA: ComponentMetadata = {
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
};

const READING: ReadingResult = {
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
  nextInspection: { date: "2030-01-15", intervalYears: 5 },
  flags: [],
  verdict: "accept",
  citations: ["api574_10_5_1_4", "api570_7_2"],
};

const FALLBACK_ENTRY: NarrativeEntryState = {
  status: "fallback",
  text: "",
  fallbackText:
    "Reading r-1 at CML-01: t-actual is 6.50 mm against t-required 6.35 mm. Verdict: ACCEPT. All verdicts are computed in code and unaffected.",
};

function pane(entry: NarrativeEntryState, reading: ReadingResult = READING): string {
  return renderToStaticMarkup(
    createElement(ReasoningPane, {
      reading,
      metadata: METADATA,
      entry,
    }),
  );
}

describe("ReasoningPane — deterministic chain (UI-26/27)", () => {
  it("renders INPUTS/CLAUSE/LIMIT/VERDICT blocks with formatFixed values and — nulls", () => {
    const markup = pane(FALLBACK_ENTRY);
    expect(markup).toContain("Inputs");
    expect(markup).toContain("Clause");
    expect(markup).toContain("Limit");
    expect(markup).toContain("Verdict");
    // INPUTS at table precision; CR_ST is null → — (never Infinity/NaN)
    expect(markup).toContain("6.50");
    expect(markup).toContain("6.35");
    expect(markup).toContain("0.300");
    expect(markup).toContain("12.4");
    expect(markup).not.toContain("Infinity");
    expect(markup).not.toContain("NaN");
    // LIMIT: t-required ± gauge uncertainty
    expect(markup).toContain("t-required 6.35 mm ± 0.10 mm gauge uncertainty");
    expect(markup).toContain("CR governing 0.300 mm/yr");
  });

  it("renders the chain in EVERY state including error and fallback (UI-26)", () => {
    for (const entry of [
      { status: "loading", text: "" },
      {
        status: "streaming",
        text: "Partial narrative",
      },
      FALLBACK_ENTRY,
      { status: "error", text: "", errorReason: "HTTP 502" },
      {
        status: "complete",
        text: "Done narrative",
        model: "test/model",
        usage: { promptTokens: 10, completionTokens: 5, latencyMs: 500 },
      },
    ] as NarrativeEntryState[]) {
      const markup = pane(entry);
      expect(markup).toContain("Inputs");
      expect(markup).toContain("Verdict");
      expect(markup).toContain("t-required 6.35 mm ± 0.10 mm gauge uncertainty");
    }
  });

  it("renders CitationChips for reading.citations and — for an empty array (UI-48)", () => {
    const markup = pane(FALLBACK_ENTRY);
    // Chip labels built solely from record fields: {code} {clause}
    expect(markup).toContain("API 574 10.5.1.4");
    expect(markup).toContain("API 570 7.2");

    const empty = pane(FALLBACK_ENTRY, { ...READING, citations: [] });
    expect(empty).toContain("—");
  });

  it("shows the VERDICT segment with the reused VerdictChip and band basis", () => {
    const markup = pane(FALLBACK_ENTRY);
    expect(markup).toContain("ACCEPT");
    expect(markup).toContain("t-actual 6.50 mm ≥ t-required + 0.10 mm gauge uncertainty");
  });
});

describe("ReasoningPane — narrative states", () => {
  it("fallback state: DETERMINISTIC FALLBACK chip + tokenized narrative + — · — · —", () => {
    const markup = pane(FALLBACK_ENTRY);
    expect(markup).toContain("Deterministic fallback");
    expect(markup).toContain("All verdicts are computed in code and unaffected.");
    expect(markup).toContain("— · — · —");
  });

  it("loading state shows the exact copy with role=status", () => {
    const markup = pane({ status: "loading", text: "" });
    expect(markup).toContain("Requesting narrative…");
    expect(markup).toContain('role="status"');
  });

  it("streaming state: aria-busy, caret with motion-reduce, Streaming narrative…", () => {
    const markup = pane({ status: "streaming", text: "Partial" });
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Streaming narrative…");
    expect(markup).toContain("motion-reduce:animate-none");
    expect(markup).toContain("animate-pulse");
  });

  it("error state: exact copy + Retry narrative button", () => {
    const markup = pane({ status: "error", text: "", errorReason: "HTTP 502" });
    expect(markup).toContain("Narrative unavailable: HTTP 502. The computed verdict is unaffected.");
    expect(markup).toContain("Retry narrative");
  });

  it("complete state with usage renders tokens/latency and a verbatim model badge; cost is —", () => {
    const markup = pane({
      status: "complete",
      text: "Done",
      model: "test/model-x",
      usage: { promptTokens: 1100, completionTokens: 600, latencyMs: 1500 },
    });
    expect(markup).toContain("test/model-x");
    expect(markup).toContain("tokens 1,700 · 1.5 s · —");
  });

  it("narrative region carries the UI-46/47 classes", () => {
    const markup = pane(FALLBACK_ENTRY);
    expect(markup).toContain("max-h-96 overflow-y-auto");
    expect(markup).toContain("whitespace-pre-wrap break-words");
  });
});

describe("ReasoningPane — citation allowlist enforcement (UI-34/35)", () => {
  it("an unresolvable id renders zero chip glyphs while the audit stamp names it", () => {
    const markup = pane({
      status: "complete",
      text: "Narrative cites [[cite:totally_fake_id]] here.",
    });
    // No chip detail target for the fake id (no chip was rendered) and the
    // raw token never appears as machinery text.
    expect(markup).not.toContain("cite-detail-totally_fake_id");
    expect(markup).not.toContain("[[cite:");
    // The audit stamp names the blocked id (SSR escapes ' as &#x27;).
    expect(markup).toContain("Unresolved citation blocked:");
    expect(markup).toContain("totally_fake_id");
    expect(markup).toContain("rendered blank (audit");
  });

  it("a resolved id renders a chip labeled ONLY from the record's code + clause", () => {
    const record = criteria.citations.find((c) => c.id === "api570_7_2");
    expect(record).toBeDefined();
    const markup = pane({
      status: "complete",
      text: `Remaining life per [[cite:api570_7_2]].`,
    });
    expect(markup).toContain(`${record!.code} ${record!.clause}`);
    expect(markup).toContain("cite-detail-api570_7_2");
  });

  it("an incomplete token renders zero glyphs (truncation machinery never shows)", () => {
    const markup = pane({
      status: "complete",
      text: "Truncated [[cite:api570_7_2",
    });
    // The raw machinery text never renders (the chain's chips render record
    // labels, not token syntax).
    expect(markup).not.toContain("[[cite:");
  });
});

describe("ResultsTable — 11-column contract (UI-25, binding C1/C3)", () => {
  const TABLE_FIXTURE: ReadingResult[] = [
    READING,
    {
      ...READING,
      readingId: "r-2",
      cml: "CML-02",
      rlYears: null,
      nextInspection: null,
      crLtMmYr: null,
      crStMmYr: null,
      crGoverningMmYr: null,
      flags: ["insufficient_history"],
    },
  ];

  function table(): string {
    return renderToStaticMarkup(
      createElement(ResultsTable, {
        readings: TABLE_FIXTURE,
        page: 1,
        onPageChange: () => {},
        metadata: METADATA,
        evaluatedAt: "2026-09-27T14:32:00Z",
      }),
    );
  }

  it("renders 11 th elements in the locked order with Reasoning as the 11th and last", () => {
    const markup = table();
    expect(markup.match(/scope="col"/g)?.length).toBe(11);
    const headers = [
      "CML / Location",
      "t-actual (mm)",
      "t-required (mm)",
      "CR_LT (mm/yr)",
      "CR_ST (mm/yr)",
      "CR governing (mm/yr)",
      "RL (yr)",
      "Next inspection",
      "Flags",
      "Verdict",
      "Reasoning",
    ];
    let last = -1;
    for (const header of headers) {
      const idx = markup.indexOf(`>${header}<`);
      expect(idx).toBeGreaterThan(last);
      last = idx;
    }
  });

  it("carries the sticky cluster on CML, Verdict, and Reasoning cells with opaque backgrounds", () => {
    const markup = table();
    expect(markup).toContain("sticky left-0");
    expect(markup).toContain("sticky right-[9.5rem]"); // Verdict offset
    const reasoningTh = markup.indexOf(">Reasoning<");
    expect(markup.slice(Math.max(0, reasoningTh - 300), reasoningTh)).toContain(
      "sticky right-0",
    );
    expect(markup).toContain("bg-card");
    expect(markup).toContain("bg-background");
  });

  it("wires the per-row toggle with aria-expanded/aria-controls reasoning-{rowKey}", () => {
    const markup = table();
    expect(markup).toContain("View reasoning");
    expect(markup).toContain('aria-controls="reasoning-r-1-0"');
    expect(markup).toContain('aria-controls="reasoning-r-2-1"');
    expect(markup).not.toContain("Hide reasoning"); // collapsed by default
  });

  it("RL — cells render without Infinity/NaN anywhere in the table HTML", () => {
    const markup = table();
    expect(markup).toContain("—");
    expect(markup).not.toContain("Infinity");
    expect(markup).not.toContain("NaN");
  });
});

describe("ReasoningDetailRow — colSpan-11 detail row (FlagDetailRow pattern)", () => {
  it("renders id reasoning-{rowKey}, colSpan 11, and the pane inside", () => {
    const markup = renderToStaticMarkup(
      createElement(ReasoningDetailRow, {
        rowKey: "r-1-0",
        reading: READING,
        metadata: METADATA,
        entry: FALLBACK_ENTRY,
      }),
    );
    expect(markup).toContain('id="reasoning-r-1-0"');
    expect(markup).toContain('colSpan="11"'); // React 19 SSR keeps camelCase
    expect(markup).toContain("Deterministic fallback");
  });

  it("without the metadata slice it renders the muted guard line, never a crash", () => {
    const markup = renderToStaticMarkup(
      createElement(ReasoningDetailRow, {
        rowKey: "r-1-0",
        reading: READING,
        entry: FALLBACK_ENTRY,
      }),
    );
    expect(markup).toContain("Reasoning pane requires the session metadata slice.");
  });
});

/** The indication variant type is 03-04's integration; a shape sanity pin. */
describe("narrativeRequestBody — tracer glue body contract", () => {
  it("builds a strict-schema-valid cml body with history: null", async () => {
    const { narrativeRequestBody } = await import("@/components/wizard/results-table");
    const body = narrativeRequestBody(READING, METADATA, "2026-09-27T14:32:00Z");
    expect(body).toMatchObject({
      kind: "cml",
      evaluatedAt: "2026-09-27T14:32:00Z",
      extraction: null,
      history: null,
    });
    const { NarrativeRequestSchema } = await import("@/lib/reasoning/schemas");
    expect(NarrativeRequestSchema.safeParse(body).success).toBe(true);
  });

  it("CR-01: carries the provider extraction pack + the reading's history when supplied", async () => {
    const { narrativeRequestBody } = await import("@/components/wizard/results-table");
    const pack = {
      componentContext: { serviceDescription: "Cooling water line, carbon steel." },
      notableFacts: ["Coating intact."],
      ptmtNotesSummary: null,
      cautions: [],
    };
    const history = { tInitialMm: 9.5, tPreviousMm: 9.2, dtLtYears: 10, dtStYears: null };
    const body = narrativeRequestBody(READING, METADATA, "2026-09-27T14:32:00Z", {
      extraction: pack,
      history,
    });
    expect(body.extraction).toEqual(pack);
    expect(body.history).toEqual(history);
    // The enabled route's strict schema must accept the wired body (the
    // Pitfall-5 guard 422s null-pack enabled calls — CR-01's dead path).
    const { NarrativeRequestSchema } = await import("@/lib/reasoning/schemas");
    expect(NarrativeRequestSchema.safeParse(body).success).toBe(true);
  });
});

describe("WR-01 — one narrative store app-wide (provider-owned)", () => {
  it("ResultsTable consumes useReasoning() and creates NO module-level second store", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(
      new URL("../../components/wizard/results-table.tsx", import.meta.url),
      "utf8",
    );
    expect(src).toContain("useReasoning()");
    expect(src).not.toMatch(/createNarrativeStore/);
    // The UI-41 gate comes from the context — never hardcoded per call site.
    expect(src).not.toContain("allowNarration: true");
  });
});
