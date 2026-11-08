// @vitest-environment jsdom
/**
 * Phase 14 Task 6 — the report round-trip must not re-run extraction or drop
 * the narrative cache when ScreenResults unmounts and remounts for the same
 * evaluatedAt (F-14-03).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  ReasoningProvider,
  __resetReasoningEvaluationCache,
  useReasoning,
  type ReasoningContextValue,
} from "@/components/wizard/reasoning-context";
import type {
  ComponentMetadata,
  EvaluationResults,
  TargetField,
} from "@/lib/ingest/session";
import type { NarrativeRequest } from "@/lib/reasoning/schemas";
import { narrativeKey } from "@/hooks/use-narrative-stream";

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

const RESULTS: EvaluationResults = {
  readings: [],
  summary: { total: 0, locations: 0, accept: 0, reCheck: 0, fail: 0 },
  indications: [],
  citationsUsed: [],
};

const MAPPING: Record<TargetField, string | null> = {
  readingId: null,
  measuredThickness: null,
  measurementDate: null,
  tInitial: null,
  tPrevious: null,
  tank: null,
};

const PTMT_PAYLOAD = {
  kind: "ptmt",
  evaluatedAt: "E-cache",
  indication: { id: "kept" },
} as unknown as NarrativeRequest;

let container: HTMLDivElement;
let root: Root;
let captured: ReasoningContextValue | null;

function Probe() {
  const value = useReasoning();
  useEffect(() => {
    captured = value;
  }, [value]);
  return null;
}

function tree(evaluatedAt: string) {
  return (
    <ReasoningProvider
      results={RESULTS}
      metadata={METADATA}
      notes=""
      indications={[]}
      units={{ csvThickness: "mm", metadata: "mm" }}
      evaluatedAt={evaluatedAt}
      rows={[]}
      mapping={MAPPING}
    >
      <Probe />
    </ReasoningProvider>
  );
}

async function mount(evaluatedAt: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(tree(evaluatedAt));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function unmount(): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  container.remove();
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  __resetReasoningEvaluationCache();
  captured = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ disabled: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe("ReasoningProvider evaluation cache (F-14-03)", () => {
  it("reuses the extraction and the narrative store across a remount", async () => {
    await mount("E-cache");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    const first = captured;
    expect(first?.extraction.state).toBe("disabled");

    // A pane the user opened before extraction: the cache must preserve it.
    const key = narrativeKey("E-cache", "ptmt", "kept");
    first!.store.open(key, PTMT_PAYLOAD, { allowNarration: false });
    expect(first!.store.get(key)?.status).toBe("error");

    await unmount();
    await mount("E-cache");

    // No second extraction, same store, same extraction state, same entry.
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(captured?.store).toBe(first!.store);
    expect(captured?.extraction.state).toBe("disabled");
    expect(captured?.store.get(key)?.status).toBe("error");
  });

  it("still extracts once for a new evaluatedAt", async () => {
    await mount("E-cache");
    await unmount();
    await mount("E-cache-2");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(captured?.extraction.state).toBe("disabled");
  });
});
