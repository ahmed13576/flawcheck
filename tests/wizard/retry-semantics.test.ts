/**
 * Phase 13 — retry semantics completion. Pins the three behaviours the phase
 * promises: exactly one retry control (owned by the detail row, never the
 * pane), a retry that cannot run before extraction is available (WR-02), and
 * the narrow automatic retry of pre-extraction skips once extraction
 * completes (F-03).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ReasoningDetailRow,
  retryBlockedReason,
  retrySkippedNarratives,
} from "@/components/wizard/results-table";
import type { NarrativeEntryState } from "@/components/wizard/reasoning-pane";
import type { ComponentMetadata, ReadingResult, Unit } from "@/lib/ingest/session";
import type { ExtractionResult, NarrativeRequest } from "@/lib/reasoning/schemas";
import {
  createNarrativeStore,
  narrativeKey,
  EXTRACTION_SKIPPED_REASON,
} from "@/hooks/use-narrative-stream";

const MODEL = "fixture-reasoning-model";

const METADATA = {
  od: 219.1,
  tNominal: 10.31,
  fca: 1,
  tStructural: 6.35,
  designCode: "ASME B31.3 — 2024 Edition",
  pipeClass: 2,
  gaugeUncertainty: 0.1,
  metadataUnit: "mm",
  pressureUnit: "MPa",
  designPressure: 3.5,
  allowableStress: 138,
  e: 1,
  w: 1,
  y: 0.4,
  formula: "asme_b31_3_straight_pipe",
} as unknown as ComponentMetadata;

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
  citations: ["api574_10_5_1_4", "api570_7_2"],
} as unknown as ReadingResult;

const PACK: ExtractionResult = {
  componentContext: { serviceDescription: "Cooling water line." },
  notableFacts: [],
  ptmtNotesSummary: null,
  cautions: [],
};

const ERROR_ENTRY: NarrativeEntryState = {
  status: "error",
  text: "",
  errorReason: "upstream down",
};

function payload(): NarrativeRequest {
  return {
    kind: "cml",
    evaluatedAt: "E1",
    reading: READING,
    metadata: METADATA,
    extraction: PACK,
    history: null,
  } as unknown as NarrativeRequest;
}

function sseResponse(): Response {
  const usage = JSON.stringify({
    type: "usage",
    promptTokens: 100,
    completionTokens: 50,
    latencyMs: 12,
    model: MODEL,
  });
  const text = `data: ${JSON.stringify({ type: "delta", text: "Verdict: ACCEPT." })}\n\ndata: ${usage}\n\ndata: [DONE]\n\n`;
  const encoder = new TextEncoder();
  let sent = false;
  return new Response(
    new ReadableStream({
      pull(controller) {
        if (sent) {
          controller.close();
          return;
        }
        sent = true;
        controller.enqueue(encoder.encode(text));
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } },
  );
}

async function settle(times = 12): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => sseResponse()));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("retryBlockedReason — WR-02 gate", () => {
  it("blocks while extraction is pending or running", () => {
    for (const state of ["pending", "running"] as const) {
      expect(retryBlockedReason({ state })).toBe(
        "Retry becomes available when extraction finishes.",
      );
    }
  });

  it("blocks permanently when extraction failed", () => {
    expect(retryBlockedReason({ state: "failed", message: "boom" })).toBe(
      "Retry is unavailable because extraction failed.",
    );
  });

  it("allows the retry once extraction is complete or disabled (fallback mode)", () => {
    expect(
      retryBlockedReason({
        state: "complete",
        pack: PACK,
        usage: { promptTokens: 10, completionTokens: 5, latencyMs: 100, model: MODEL },
      }),
    ).toBeNull();
    expect(retryBlockedReason({ state: "disabled" })).toBeNull();
  });
});

describe("ReasoningDetailRow — exactly one retry control (WR-03)", () => {
  function row(retryBlockedReasonValue: string | null): string {
    return renderToStaticMarkup(
      createElement(ReasoningDetailRow, {
        rowKey: "r-1-0",
        reading: READING,
        metadata: METADATA,
        entry: ERROR_ENTRY,
        onRetry: () => {},
        retryBlockedReason: retryBlockedReasonValue,
      }),
    );
  }

  it("renders one enabled control when extraction allows narration", () => {
    const html = row(null);
    expect((html.match(/Retry narrative/g) ?? []).length).toBe(1);
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
  });

  it("renders the same single control disabled with the reason when blocked", () => {
    const html = row("Retry becomes available when extraction finishes.");
    expect((html.match(/Retry narrative/g) ?? []).length).toBe(1);
    expect(html).toMatch(/<button[^>]*\sdisabled=""/);
    expect(html).toContain("Retry becomes available when extraction finishes.");
  });
});

describe("retrySkippedNarratives — F-03 automatic recovery", () => {
  function args(store: ReturnType<typeof createNarrativeStore>, allowNarration: boolean) {
    return {
      store,
      readings: [READING],
      metadata: METADATA,
      evaluatedAt: "E1",
      metadataUnit: "mm" as Unit,
      extractionPack: PACK,
      historyFor: () => null,
      allowNarration,
    };
  }

  it("does nothing while narration is not allowed", () => {
    const store = createNarrativeStore();
    store.open(narrativeKey("E1", "cml", "r-1-0"), payload(), { allowNarration: false });
    expect(retrySkippedNarratives(args(store, false))).toBe(0);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("retries a skipped row exactly once when extraction completes", async () => {
    const store = createNarrativeStore();
    const key = narrativeKey("E1", "cml", "r-1-0");
    store.open(key, payload(), { allowNarration: false });
    expect(store.get(key)?.errorReason).toBe(EXTRACTION_SKIPPED_REASON);

    expect(retrySkippedNarratives(args(store, true))).toBe(1);
    await settle();
    expect(store.get(key)?.status).toBe("complete");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    // A second pass sees a completed pane and issues no duplicate request.
    expect(retrySkippedNarratives(args(store, true))).toBe(0);
    await settle();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("never auto-retries a generic upstream error — only pre-extraction skips", async () => {
    const store = createNarrativeStore();
    const key = narrativeKey("E1", "cml", "r-1-0");
    store.open(key, payload(), { allowNarration: true });
    await settle();
    // Force a non-skipped error entry through the store's own failure path.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "upstream down" }), { status: 502 })),
    );
    store.retry(key, payload());
    await settle();
    expect(store.get(key)?.status).toBe("error");
    expect(store.get(key)?.errorReason).not.toBe(EXTRACTION_SKIPPED_REASON);
    expect(retrySkippedNarratives(args(store, true))).toBe(0);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});
