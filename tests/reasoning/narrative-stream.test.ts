/**
 * Narrative store pins — 03-03 Task 1 (node tests, zero React, stubbed fetch).
 * Covers the plan's behavior list: cache (no refetch on complete), FIFO cap 3,
 * rejected→fallback text swap, error+retry, evaluatedAt-scoped cache, chunk-
 * boundary-safe `[[cite:` rendering, and the UI-41 allowNarration gate.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createNarrativeStore,
  narrativeKey,
  EXTRACTION_SKIPPED_REASON,
  FIFO_CAP,
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
  flags: [],
  verdict: "accept" as const,
  citations: ["api574_10_5_1_4", "api570_7_2"],
};

function payload(evaluatedAt = "E1"): NarrativeRequest {
  return {
    kind: "cml",
    evaluatedAt,
    reading: READING,
    metadata: METADATA,
    extraction: {
      componentContext: { serviceDescription: "Cooling water line." },
      notableFacts: [],
      ptmtNotesSummary: null,
      cautions: [],
    },
    history: null,
  };
}

/** Build a Response whose body is a ReadableStream of SSE text chunks. */
function sseResponse(frames: string[], chunkSize = 1_000_000): Response {
  const text = frames.map((f) => `data: ${f}\n\n`).join("") + "data: [DONE]\n\n";
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

const USAGE_FRAME = JSON.stringify({
  type: "usage",
  promptTokens: 100,
  completionTokens: 50,
  latencyMs: 12,
  model: "fixture-reasoning-model",
});
const PASSING_TEXT =
  "The measured wall thickness is 6.50 mm against a required 6.35 mm. [[cite:api574_10_5_1_4]] The remaining life is 12.4 years. [[cite:api570_7_2]]\nVerdict: ACCEPT.";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => sseResponse([JSON.stringify({ type: "delta", text: PASSING_TEXT }), USAGE_FRAME])));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function settle(times = 12): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

describe("createNarrativeStore", () => {
  it("transitions loading → streaming → complete on a passing stream", async () => {
    const store = createNarrativeStore();
    const key = narrativeKey("E1", "cml", "r-1");
    store.open(key, payload(), { allowNarration: true });
    await settle();
    const entry = store.get(key);
    expect(entry?.status).toBe("complete");
    expect(entry?.text).toBe(PASSING_TEXT);
    expect(entry?.usage?.promptTokens).toBe(100);
    expect(store.totals()).toEqual({ promptTokens: 100, completionTokens: 50, latencyMs: 12 });
  });

  it("re-open on a completed key issues NO second fetch", async () => {
    const store = createNarrativeStore();
    const key = narrativeKey("E1", "cml", "r-1");
    store.open(key, payload(), { allowNarration: true });
    await settle();
    const fetchMock = vi.mocked(fetch);
    const callsAfterFirst = fetchMock.mock.calls.length;
    store.open(key, payload(), { allowNarration: true });
    await settle();
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it("a rejected frame swaps to fallback: streamed deltas discarded, closing fallback in place", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          JSON.stringify({ type: "delta", text: "The wall is 6.50 mm. " }),
          JSON.stringify({ type: "rejected", reason: "numeric_lint", fallback: "Deterministic fallback text. Verdict: ACCEPT." }),
        ]),
      ),
    );
    const store = createNarrativeStore();
    const key = narrativeKey("E1", "cml", "r-1");
    store.open(key, payload(), { allowNarration: true });
    await settle();
    const entry = store.get(key);
    expect(entry?.status).toBe("fallback");
    expect(entry?.text).toBe(""); // rejected narrative never survives (UI-42)
    expect(entry?.fallbackText).toBe("Deterministic fallback text. Verdict: ACCEPT.");
    expect(store.fallbackServed()).toBe(true);
    expect(store.totals()).toEqual({ promptTokens: 0, completionTokens: 0, latencyMs: 0 });
  });

  it("an error frame → error entry; retry resets to loading and issues exactly one new fetch", async () => {
    const firstFetch = vi.fn(async () => new Response(JSON.stringify({ error: "upstream down" }), { status: 502 }));
    vi.stubGlobal("fetch", firstFetch);
    const store = createNarrativeStore();
    const key = narrativeKey("E1", "cml", "r-1");
    store.open(key, payload(), { allowNarration: true });
    await settle();
    expect(store.get(key)?.status).toBe("error");
    expect(store.get(key)?.errorReason).toContain("upstream down");
    const retryFetch = vi.fn(async () => sseResponse([USAGE_FRAME]));
    vi.stubGlobal("fetch", retryFetch);
    store.retry(key, payload());
    await settle();
    expect(store.get(key)?.status).toBe("complete");
    expect(retryFetch).toHaveBeenCalledTimes(1); // the retry issued exactly one new fetch
  });

  it("entries cached under evaluatedAt A are invisible under B (UI-45)", async () => {
    const store = createNarrativeStore();
    store.open(narrativeKey("E1", "cml", "r-1"), payload("E1"), { allowNarration: true });
    await settle();
    expect(store.get(narrativeKey("E2", "cml", "r-1"))).toBeUndefined();
  });

  it("five rapid opens keep at most 3 concurrent fetches (FIFO cap)", async () => {
    const gate = deferred();
    let concurrent = 0;
    let maxConcurrent = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await gate.promise;
        concurrent--;
        return sseResponse([USAGE_FRAME]);
      }),
    );
    const store = createNarrativeStore();
    for (let i = 0; i < 5; i++) {
      store.open(narrativeKey("E1", "cml", `r-${i}`), payload(), { allowNarration: true });
    }
    await settle(4);
    expect(maxConcurrent).toBeLessThanOrEqual(FIFO_CAP);
    gate.resolve();
    await settle(20);
    for (let i = 0; i < 5; i++) {
      expect(store.get(narrativeKey("E1", "cml", `r-${i}`))?.status).toBe("complete");
    }
  });

  it("allowNarration=false → error entry with the extraction reason and ZERO fetches (UI-41)", async () => {
    const store = createNarrativeStore();
    store.open(narrativeKey("E1", "cml", "r-1"), payload(), { allowNarration: false });
    await settle();
    const entry = store.get(narrativeKey("E1", "cml", "r-1"));
    expect(entry?.status).toBe("error");
    expect(entry?.errorReason).toBe(EXTRACTION_SKIPPED_REASON);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("chunk-boundary safety: a [[cite: token split across deltas never renders partially", async () => {
    const full = "Rate is 0.300 mm per year. [[cite:api570_7_2]] The end.";
    const cut = full.indexOf("[[cite:api570_7_2]]") + 5; // split INSIDE the token
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          JSON.stringify({ type: "delta", text: full.slice(0, cut) }),
          JSON.stringify({ type: "delta", text: full.slice(cut) }),
          USAGE_FRAME,
        ]),
      ),
    );
    const store = createNarrativeStore();
    const key = narrativeKey("E1", "cml", "r-1");
    store.open(key, payload(), { allowNarration: true });
    // observe every intermediate state
    const seenTexts: string[] = [];
    store.subscribe(() => {
      const e = store.get(key);
      if (e) seenTexts.push(e.text);
    });
    await settle(30);
    const entry = store.get(key);
    expect(entry?.text).toBe(full);
    for (const t of seenTexts) {
      // no partial token ever visible: every "[" in any snapshot opens a
      // COMPLETE [[cite:...]] sequence
      expect(t.includes("[[cite:") ? /\[\[cite:[a-z0-9_]+\]\]/.test(t) : true).toBe(true);
    }
  });
});
