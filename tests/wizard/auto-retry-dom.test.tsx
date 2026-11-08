// @vitest-environment jsdom
/**
 * Phase 14 Task 1 — the DOM-level proof the Phase 13 limitation asked for.
 * The suite was node/SSR, so the auto-retry `useEffect` never executed. These
 * tests render the real components under the real reasoning context, flip
 * `allowNarration` from false to true, and assert the store's fetch count.
 *
 * Mutation check (recorded in the phase summary): commenting out the effect in
 * results-table.tsx or ptmt-triage-list.tsx makes the corresponding test fail.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  ReasoningContext,
  type ExtractionStatus,
  type ReasoningContextValue,
} from "@/components/wizard/reasoning-context";
import { ResultsTable } from "@/components/wizard/results-table";
import { PtmtTriageList } from "@/components/wizard/ptmt-triage-list";
import type {
  ComponentMetadata,
  PtmIndicationResult,
  ReadingResult,
} from "@/lib/ingest/session";
import type { ExtractionResult, NarrativeRequest } from "@/lib/reasoning/schemas";
import { createNarrativeStore, narrativeKey } from "@/hooks/use-narrative-stream";

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

const SECOND = { ...READING, readingId: "r-2" } as ReadingResult;

const PACK: ExtractionResult = {
  componentContext: { serviceDescription: "Cooling water line." },
  notableFacts: [],
  ptmtNotesSummary: null,
  cautions: [],
};

const INDICATION = {
  id: "ind-1",
  method: "MT",
  morphology: "linear",
  lengthMm: 4.2,
  widthMm: 0.8,
  count: 1,
  edgeSeparationMm: null,
  crackSuspect: false,
  description: "Linear indication",
  verdict: "reject",
  detail: "Escalate.",
  citationId: "asme_b31_3_344_3_2",
} as unknown as PtmIndicationResult;

const CML_PAYLOAD = {
  kind: "cml",
  evaluatedAt: "E1",
  reading: READING,
  metadata: METADATA,
  extraction: PACK,
  history: null,
} as unknown as NarrativeRequest;

const PTMT_PAYLOAD = {
  kind: "ptmt",
  evaluatedAt: "E1",
  indication: INDICATION,
} as unknown as NarrativeRequest;

const RUNNING: ExtractionStatus = { state: "running" };
const COMPLETE: ExtractionStatus = {
  state: "complete",
  pack: PACK,
  usage: { promptTokens: 100, completionTokens: 50, latencyMs: 1200, model: "fixture-model" },
};

function sseResponse(): Response {
  const usage = JSON.stringify({
    type: "usage",
    promptTokens: 100,
    completionTokens: 50,
    latencyMs: 12,
    model: "fixture-model",
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

function contextValue(
  store: ReturnType<typeof createNarrativeStore>,
  extraction: ExtractionStatus,
): ReasoningContextValue {
  return {
    store,
    extraction,
    allowNarration: extraction.state === "complete" || extraction.state === "disabled",
    historyFor: () => null,
    metadataUnit: "mm",
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.stubGlobal("fetch", vi.fn(async () => sseResponse()));
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("CML auto-retry effect (DOM)", () => {
  it("does not fetch while extraction is running, then retries exactly once on completion", async () => {
    const store = createNarrativeStore();
    const key = narrativeKey("E1", "cml", "r-1-0");
    store.open(key, CML_PAYLOAD, { allowNarration: false });

    await act(async () => {
      root.render(
        <ReasoningContext.Provider value={contextValue(store, RUNNING)}>
          <ResultsTable
            readings={[READING]}
            page={1}
            onPageChange={() => {}}
            metadata={METADATA}
            evaluatedAt="E1"
          />
        </ReasoningContext.Provider>,
      );
    });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    await act(async () => {
      root.render(
        <ReasoningContext.Provider value={contextValue(store, COMPLETE)}>
          <ResultsTable
            readings={[READING]}
            page={1}
            onPageChange={() => {}}
            metadata={METADATA}
            evaluatedAt="E1"
          />
        </ReasoningContext.Provider>,
      );
    });
    await flush();

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(store.get(key)?.status).toBe("complete");

    // A filter/page re-render must not duplicate the request.
    await act(async () => {
      root.render(
        <ReasoningContext.Provider value={contextValue(store, COMPLETE)}>
          <ResultsTable
            readings={[READING]}
            page={1}
            onPageChange={() => {}}
            metadata={METADATA}
            evaluatedAt="E1"
          />
        </ReasoningContext.Provider>,
      );
    });
    await flush();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("StrictMode double-invoked effects still issue one request", async () => {
    const store = createNarrativeStore();
    const key = narrativeKey("E1", "cml", "r-1-0");
    store.open(key, CML_PAYLOAD, { allowNarration: false });

    await act(async () => {
      root.render(
        <StrictMode>
          <ReasoningContext.Provider value={contextValue(store, COMPLETE)}>
            <ResultsTable
              readings={[READING]}
              page={1}
              onPageChange={() => {}}
              metadata={METADATA}
              evaluatedAt="E1"
            />
          </ReasoningContext.Provider>
        </StrictMode>,
      );
    });
    await flush();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("scans the unfiltered register and keys the filtered row at its absolute index", async () => {
    const store = createNarrativeStore();
    const key = narrativeKey("E1", "cml", "r-2-1");
    store.open(key, CML_PAYLOAD, { allowNarration: false });
    const register = {
      readings: [READING, SECOND],
      indexByReading: new Map<ReadingResult, number>([
        [READING, 0],
        [SECOND, 1],
      ]),
    };

    await act(async () => {
      root.render(
        <ReasoningContext.Provider value={contextValue(store, RUNNING)}>
          <ResultsTable
            readings={[SECOND]}
            register={register}
            page={1}
            onPageChange={() => {}}
            metadata={METADATA}
            evaluatedAt="E1"
          />
        </ReasoningContext.Provider>,
      );
    });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    await act(async () => {
      root.render(
        <ReasoningContext.Provider value={contextValue(store, COMPLETE)}>
          <ResultsTable
            readings={[SECOND]}
            register={register}
            page={1}
            onPageChange={() => {}}
            metadata={METADATA}
            evaluatedAt="E1"
          />
        </ReasoningContext.Provider>,
      );
    });
    await flush();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(store.get(key)?.status).toBe("complete");
  });

  it("does not auto-retry a generic upstream error", async () => {
    const store = createNarrativeStore();
    const key = narrativeKey("E1", "cml", "r-1-0");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "upstream down" }), { status: 502 })),
    );
    store.retry(key, CML_PAYLOAD);
    await flush();
    expect(store.get(key)?.status).toBe("error");
    const callsAfterFailure = vi.mocked(fetch).mock.calls.length;

    await act(async () => {
      root.render(
        <ReasoningContext.Provider value={contextValue(store, COMPLETE)}>
          <ResultsTable
            readings={[READING]}
            page={1}
            onPageChange={() => {}}
            metadata={METADATA}
            evaluatedAt="E1"
          />
        </ReasoningContext.Provider>,
      );
    });
    await flush();
    expect(vi.mocked(fetch).mock.calls.length).toBe(callsAfterFailure);
  });
});

describe("PT/MT retry control (DOM)", () => {
  it("renders exactly one disabled control with the gate message before extraction", async () => {
    const store = createNarrativeStore();
    store.open(narrativeKey("E1", "ptmt", "ind-1"), PTMT_PAYLOAD, { allowNarration: false });

    await act(async () => {
      root.render(
        <ReasoningContext.Provider value={contextValue(store, RUNNING)}>
          <PtmtTriageList indications={[INDICATION]} evaluatedAt="E1" />
        </ReasoningContext.Provider>,
      );
    });
    const open = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("View reasoning"),
    );
    await act(async () => {
      open?.click();
    });

    const retries = Array.from(container.querySelectorAll("button")).filter((b) =>
      b.textContent?.includes("Retry narrative"),
    );
    expect(retries).toHaveLength(1);
    expect(retries[0]?.disabled).toBe(true);
    expect(container.textContent).toContain("Retry becomes available when extraction finishes.");
  });
});

describe("PT/MT auto-retry effect (DOM)", () => {
  it("retries a skipped indication exactly once when extraction completes", async () => {
    const store = createNarrativeStore();
    const key = narrativeKey("E1", "ptmt", "ind-1");
    store.open(key, PTMT_PAYLOAD, { allowNarration: false });

    await act(async () => {
      root.render(
        <ReasoningContext.Provider value={contextValue(store, RUNNING)}>
          <PtmtTriageList indications={[INDICATION]} evaluatedAt="E1" />
        </ReasoningContext.Provider>,
      );
    });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    await act(async () => {
      root.render(
        <ReasoningContext.Provider value={contextValue(store, COMPLETE)}>
          <PtmtTriageList indications={[INDICATION]} evaluatedAt="E1" />
        </ReasoningContext.Provider>,
      );
    });
    await flush();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(store.get(key)?.status).toBe("complete");
  });
});
