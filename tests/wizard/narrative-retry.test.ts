/**
 * WR-05 — narrative retry integrity. An errored narrative (including the
 * pre-extraction "skipped" entry the route never sees) must be recoverable
 * from the same "View reasoning" control once extraction completes, while the
 * UI-31/UI-46 cache contract for successful/active panes is unchanged.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { shouldFetchNarrativeOnToggle } from "@/components/wizard/results-table";
import type { NarrativeEntryState } from "@/components/wizard/reasoning-pane";
import {
  createNarrativeStore,
  narrativeKey,
  EXTRACTION_SKIPPED_REASON,
} from "@/hooks/use-narrative-stream";
import type { NarrativeRequest } from "@/lib/reasoning/schemas";

const METADATA = {
  od: 219.1,
  tNominal: 10.31,
  fca: 1,
  tStructural: 6.35,
  designCode: "ASME B31.3 — 2024 Edition" as const,
  pipeClass: 2 as const,
  gaugeUncertainty: 0.1,
  metadataUnit: "mm" as const,
  pressureUnit: "MPa" as const,
  designPressure: 3.5,
  allowableStress: 138,
  e: 1,
  w: 1,
  y: 0.4,
  formula: "asme_b31_3_straight_pipe" as const,
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
  flags: [] as string[],
  verdict: "accept" as const,
  citations: ["api574_10_5_1_4", "api570_7_2"],
};

function payload(): NarrativeRequest {
  return {
    kind: "cml",
    evaluatedAt: "E1",
    reading: READING,
    metadata: METADATA,
    extraction: {
      componentContext: { serviceDescription: "Cooling water line." },
      notableFacts: [],
      ptmtNotesSummary: null,
      cautions: [],
    },
    history: null,
  } as unknown as NarrativeRequest;
}

function sseResponse(): Response {
  const usage = JSON.stringify({
    type: "usage",
    promptTokens: 100,
    completionTokens: 50,
    latencyMs: 12,
    model: "fixture-reasoning-model",
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

describe("shouldFetchNarrativeOnToggle — WR-05 recovery, CR-01 close safety", () => {
  const entry = (status: NarrativeEntryState["status"], errorReason?: string) =>
    ({ status, text: "", ...(errorReason ? { errorReason } : {}) }) as NarrativeEntryState;

  it("fetches on the first open", () => {
    expect(shouldFetchNarrativeOnToggle(true, undefined, true)).toBe(true);
  });

  it("retries an errored entry on open once narration is allowed", () => {
    expect(shouldFetchNarrativeOnToggle(true, entry("error", "upstream down"), true)).toBe(true);
  });

  it("keeps the skipped state while extraction is still unavailable", () => {
    expect(shouldFetchNarrativeOnToggle(true, entry("error", EXTRACTION_SKIPPED_REASON), false)).toBe(false);
  });

  it("never refetches cached terminal/active panes on open (UI-31/UI-46)", () => {
    for (const status of ["complete", "streaming", "loading", "fallback"] as const) {
      expect(shouldFetchNarrativeOnToggle(true, entry(status), true)).toBe(false);
    }
  });

  it("CR-01: a closing toggle never fetches — not even for an errored row", () => {
    expect(shouldFetchNarrativeOnToggle(false, undefined, true)).toBe(false);
    expect(shouldFetchNarrativeOnToggle(false, entry("error", EXTRACTION_SKIPPED_REASON), true)).toBe(false);
    expect(shouldFetchNarrativeOnToggle(false, entry("error", "upstream down"), true)).toBe(false);
  });
});

describe("pre-extraction skip recovers on re-open — WR-05", () => {
  it("skipped entry → re-open retries exactly once and completes", async () => {
    const store = createNarrativeStore();
    const key = narrativeKey("E1", "cml", "r-1");

    // The real sequence: "View reasoning" clicked while extraction is running.
    store.open(key, payload(), { allowNarration: false });
    await settle();
    expect(store.get(key)?.status).toBe("error");
    expect(store.get(key)?.errorReason).toBe(EXTRACTION_SKIPPED_REASON);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    // Extraction has completed; the same control is used again (opening).
    expect(shouldFetchNarrativeOnToggle(true, store.get(key), true)).toBe(true);
    store.open(key, payload(), { allowNarration: true });
    await settle();
    expect(store.get(key)?.status).toBe("complete");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("a completed pane stays cached on re-open (no regression)", async () => {
    const store = createNarrativeStore();
    const key = narrativeKey("E1", "cml", "r-1");
    store.open(key, payload(), { allowNarration: true });
    await settle();
    expect(store.get(key)?.status).toBe("complete");
    expect(shouldFetchNarrativeOnToggle(true, store.get(key), true)).toBe(false);
    store.open(key, payload(), { allowNarration: true });
    await settle();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});
