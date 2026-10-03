/**
 * CR-02 StrictMode regression pins — the ReasoningProvider extraction effect.
 *
 * React 18/19 StrictMode double-invokes effects on mount (setup → cleanup →
 * setup) WITH refs preserved on the same fiber. The historical deadlock:
 * setup #1 fired the extraction fetch and marked firedForRef; cleanup #1 set
 * `cancelled = true`; setup #2 early-returned on the firedForRef guard; fetch
 * #1's .then saw `cancelled` and DISCARDED the response — `extraction` was
 * pinned at { state: "running" } forever in every dev run (Next defaults
 * reactStrictMode on for the App Router), so allowNarration stayed false and
 * every pane showed EXTRACTION_SKIPPED_REASON.
 *
 * The fix removes the cancellation channel entirely: runExtractionRequest has
 * no abort/cleanup parameter (a cleanup cannot discard the response) and
 * firedForRef keeps the fire-once-per-evaluatedAt guarantee. React 18+
 * tolerates post-unmount setState on the same fiber.
 *
 * These pins simulate exactly that lifecycle at the unit boundary — the
 * hermetic suite is a node environment without a DOM, so react-dom/client
 * effects (and real StrictMode) cannot run here. The simulation mirrors the
 * provider's effect contract: guard → fire → NO cleanup.
 */
import { describe, it, expect, vi } from "vitest";
import {
  runExtractionRequest,
  type ExtractionStatus,
} from "@/components/wizard/reasoning-context";

const USAGE = {
  promptTokens: 790,
  completionTokens: 550,
  latencyMs: 3448,
  model: "fixture-extraction-model",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}

async function settle(times = 12): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

/**
 * The provider's effect contract, extracted verbatim: an evaluatedAt-keyed
 * fire-once guard + the request, and — the CR-02 invariant — NO cleanup that
 * cancels or discards the in-flight request.
 */
function makeStrictModeEffect(
  fetchImpl: typeof fetch,
  onState: (s: ExtractionStatus) => void,
): (evaluatedAt: string) => void {
  const firedFor = new Set<string>();
  return (evaluatedAt: string) => {
    if (!evaluatedAt || firedFor.has(evaluatedAt)) return; // setup #2 early-return
    firedFor.add(evaluatedAt);
    onState({ state: "running" });
    void runExtractionRequest(fetchImpl, { evaluatedAt }, onState);
    // cleanup #1: deliberately registers nothing — no cancellation, ever.
  };
}

describe("CR-02 — extraction survives StrictMode setup → cleanup → setup", () => {
  it("the guard dedupes the double-invoke; the FIRST request settles the state (never stuck running)", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ extraction: { componentContext: { serviceDescription: "x" } }, usage: USAGE }),
    );
    const states: ExtractionStatus[] = [];
    const effect = makeStrictModeEffect(fetchMock, (s) => states.push(s));

    effect("E1"); // setup #1 — fires the fetch
    effect("E1"); // cleanup #1 (no-op) + setup #2 — early-returns on the guard
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1); // ONE paid call, not two
    const final = states[states.length - 1];
    // The regression asserted the FINAL state — the discarded response left
    // { state: "running" } forever; the fix settles "complete".
    expect(final).toEqual({ state: "complete", usage: USAGE });
  });

  it("re-fires for a NEW evaluatedAt (re-evaluation) even after a previous one completed", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ extraction: { componentContext: { serviceDescription: "x" } }, usage: USAGE }),
    );
    const states: ExtractionStatus[] = [];
    const effect = makeStrictModeEffect(fetchMock, (s) => states.push(s));

    effect("E1");
    await settle();
    effect("E1"); // same evaluation — still deduped
    effect("E2"); // re-evaluation — must fire again
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(states[states.length - 1]).toEqual({ state: "complete", usage: USAGE });
  });

  it("runExtractionRequest maps the route contract: disabled / non-200 / missing usage / success / throw", async () => {
    const states: ExtractionStatus[] = [];
    const collect = (s: ExtractionStatus) => states.push(s);
    const body = { evaluatedAt: "E1" };

    await runExtractionRequest(
      async () => jsonResponse({ extraction: null, usage: null, disabled: true }),
      body,
      collect,
    );
    expect(states.pop()).toEqual({ state: "disabled" });

    await runExtractionRequest(
      async () => jsonResponse({ error: "upstream boom" }, 502),
      body,
      collect,
    );
    expect(states.pop()).toEqual({ state: "failed", message: "upstream boom" });

    await runExtractionRequest(
      async () => jsonResponse({ extraction: null, usage: null }),
      body,
      collect,
    );
    expect(states.pop()).toEqual({ state: "failed", message: "extraction response missing usage" });

    await runExtractionRequest(
      async () => jsonResponse({ extraction: { componentContext: { serviceDescription: "x" } }, usage: USAGE }),
      body,
      collect,
    );
    expect(states.pop()).toEqual({ state: "complete", usage: USAGE });

    await runExtractionRequest(async () => {
      throw new Error("network reset");
    }, body, collect);
    expect(states.pop()).toEqual({ state: "failed", message: "network reset" });
  });
});
