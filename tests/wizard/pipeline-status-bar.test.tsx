/**
 * Pipeline status bar markup contract — 03-04 Task 1 (UI-38..UI-43): pending
 * digits-free, running…, complete with runtime-resolved badge + `· —` cost,
 * FAILED badge, disabled `fallback mode`, and the deterministic-fallback chip
 * when the store has served one. The store is primed via the real narrative
 * route contract (stubbed fetch); extraction state is injected through the
 * `extractionOverride` test seam (SSR effects don't run — the provider path
 * renders the pending row in the flowstep-restyle screen tests).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { PipelineStatusBar } from "@/components/wizard/pipeline-status-bar";
import { ReasoningProvider } from "@/components/wizard/reasoning-context";
import {
  createNarrativeStore,
  narrativeKey,
} from "@/hooks/use-narrative-stream";

const MODEL = "test-reasoning-model"; // fixture string — never a vendor literal

function sseResponse(frames: string[]): Response {
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
  promptTokens: 1184,
  completionTokens: 658,
  latencyMs: 3200,
  model: MODEL,
});

async function settle(times = 12): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  process.env.NEBIUS_API_KEY = "fixture-key";
  delete process.env.FLAWCHECK_DISABLE_LLM;
});
afterEach(() => {
  delete process.env.NEBIUS_API_KEY;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PipelineStatusBar markup", () => {
  it("pending renders the word for both steps — no digits", () => {
    const store = createNarrativeStore();
    const html = renderToStaticMarkup(
      createElement(PipelineStatusBar, { extractionOverride: { state: "pending" } }),
    );
    void store;
    expect(html).toContain("pending");
    expect(html).toContain("Extraction");
    expect(html).toContain("Narrative");
    const visible = html.replace(/<[^>]*>/g, " ");
    expect(visible).not.toMatch(/\d/); // digits-free VISIBLE text (classes carry digits)
  });

  it("complete: badge equals the injected model verbatim; metrics carry the em-dash cost", async () => {
    const store = createNarrativeStore();
    (globalThis as { __flawcheckFallbackStore?: unknown }).__flawcheckFallbackStore = store;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sseResponse([USAGE_FRAME])),
    );
    const key = narrativeKey("E1", "cml", "r-1");
    const body = {
      kind: "cml",
      evaluatedAt: "E1",
      reading: {
        readingId: "r-1",
        location: "North header",
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
      },
      metadata: {
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
      },
      extraction: null,
      history: null,
    };
    store.open(key, body as Parameters<typeof store.open>[1], { allowNarration: true });
    await settle();
    const html = renderToStaticMarkup(
      createElement(PipelineStatusBar, {
        extractionOverride: {
          state: "complete",
          usage: { promptTokens: 790, completionTokens: 550, latencyMs: 3448, model: MODEL },
        },
      }),
    );
    expect(html).toContain(MODEL);
    // Extraction row metrics from the override; narrative row aggregates the
    // primed store's completed panes. Both carry the em-dash cost.
    expect(html).toContain("tokens 1,340 · 3.4 s · —");
    expect(html).toContain("tokens 1,842 · 3.2 s · —");
  });

  it("failed extraction renders the FAILED badge with dashes — never fabricated usage", () => {
    delete (globalThis as { __flawcheckFallbackStore?: unknown }).__flawcheckFallbackStore;
    const html = renderToStaticMarkup(
      createElement(PipelineStatusBar, { extractionOverride: { state: "failed", message: "boom" } }),
    );
    expect(html).toContain("failed");
    expect(html).toContain("— · — · —");
  });

  it("disabled renders '—' + 'fallback mode' and the deterministic-fallback chip", () => {
    delete (globalThis as { __flawcheckFallbackStore?: unknown }).__flawcheckFallbackStore;
    const html = renderToStaticMarkup(
      createElement(PipelineStatusBar, { extractionOverride: { state: "disabled" } }),
    );
    expect(html).toContain("fallback mode");
    expect(html).toContain("deterministic fallback");
    expect(html).toContain("— · — · —");
  });
});
