/**
 * Narrative store + React hook — 03-03 Task 1 (Pattern R5).
 *
 * The store is framework-free so the whole state machine is node-testable
 * with zero new packages: cache keyed by `${evaluatedAt}::${kind}::${id}`
 * (re-evaluation produces a fresh evaluatedAt, so stale entries become
 * unreachable — no expiry logic, UI-45), one AbortController per key, a FIFO
 * cap of 3 concurrent narrative fetches (A3), and frame-driven transitions
 * matching NarrativeEntryState exactly (components/wizard/reasoning-pane.tsx).
 *
 * UI-41 client gate (Pitfall 5): open() with allowNarration=false sets an
 * error entry and issues ZERO fetches.
 */
import { useSyncExternalStore } from "react";
import { safeTailHold } from "@/lib/reasoning/tokenizer";
import { parseNarrativeFrame, type NarrativeRequest } from "@/lib/reasoning/schemas";

export type NarrativeKey = string;

export interface NarrativeEntryState {
  status: "loading" | "streaming" | "complete" | "error" | "fallback";
  text: string;
  model?: string;
  usage?: { promptTokens: number; completionTokens: number; latencyMs: number } | null;
  errorReason?: string;
  fallbackText?: string;
}

export interface StoreTotals {
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

export const FIFO_CAP = 3;
export const EXTRACTION_SKIPPED_REASON =
  "Extraction failed — narrative generation was skipped.";

export interface NarrativeStore {
  get(key: NarrativeKey): NarrativeEntryState | undefined;
  subscribe(listener: () => void): () => void;
  version(): number;
  open(key: NarrativeKey, payload: NarrativeRequest, opts: { allowNarration: boolean }): void;
  retry(key: NarrativeKey, payload: NarrativeRequest): void;
  abort(key: NarrativeKey): void;
  totals(): StoreTotals;
  fallbackServed(): boolean;
  unresolvedCitations(): string[];
}

export function narrativeKey(evaluatedAt: string, kind: "cml" | "ptmt", id: string): NarrativeKey {
  return `${evaluatedAt}::${kind}::${id}`;
}

export function createNarrativeStore(): NarrativeStore {
  const entries = new Map<NarrativeKey, NarrativeEntryState>();
  const controllers = new Map<NarrativeKey, AbortController>();
  const unresolved = new Set<string>();
  const listeners = new Set<() => void>();
  const pending: Array<() => void> = [];
  let inFlight = 0;
  let fallbackServedFlag = false;
  let version = 0;

  const emit = () => {
    version++;
    for (const l of listeners) l();
  };
  const setEntry = (key: NarrativeKey, entry: NarrativeEntryState) => {
    entries.set(key, entry);
    emit();
  };
  /** Enqueue behind the FIFO cap (A3) or start immediately. */
  const enqueue = (key: NarrativeKey, payload: NarrativeRequest) => {
    const start = () => runFetch(key, payload);
    if (inFlight >= FIFO_CAP) pending.push(start);
    else {
      inFlight++;
      start();
    }
  };

  function runFetch(key: NarrativeKey, payload: NarrativeRequest) {
    const controller = new AbortController();
    controllers.set(key, controller);
    const finish = () => {
      inFlight--;
      controllers.delete(key);
      pump();
    };
    fetch("/api/reasoning/narrative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then(async (res) => {
        await consumeNarrativeStream(res, {
          onDelta: (text) => {
            const cur = entries.get(key);
            if (!cur || cur.status === "complete" || cur.status === "fallback") return;
            setEntry(key, { ...cur, status: "streaming", text: cur.text + text });
          },
          onUsage: (u) => {
            setEntry(key, {
              status: "complete",
              text: entries.get(key)?.text ?? "",
              model: u.model,
              usage: {
                promptTokens: u.promptTokens,
                completionTokens: u.completionTokens,
                latencyMs: u.latencyMs,
              },
            });
          },
          onRejected: (_reason, fallback) => {
            fallbackServedFlag = true;
            setEntry(key, { status: "fallback", text: "", fallbackText: fallback });
          },
          onFallback: (fallback) => {
            fallbackServedFlag = true;
            setEntry(key, { status: "fallback", text: "", fallbackText: fallback });
          },
          onError: (message) => {
            setEntry(key, { status: "error", text: "", errorReason: message });
          },
          onDone: () => {
            const cur = entries.get(key);
            if (cur && cur.status !== "complete" && cur.status !== "fallback" && cur.status !== "error") {
              setEntry(key, { ...cur, status: "complete" });
            }
          },
        });
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) {
          setEntry(key, {
            status: "error",
            text: "",
            errorReason: e instanceof Error ? e.message : String(e),
          });
        }
      })
      .finally(finish);
  }

  function pump() {
    while (inFlight < FIFO_CAP && pending.length > 0) {
      const start = pending.shift();
      if (!start) return;
      inFlight++;
      start();
    }
  }

  return {
    get: (key) => entries.get(key),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    version: () => version,

    open(key, payload, opts) {
      const cur = entries.get(key);
      if (cur && (cur.status === "complete" || cur.status === "streaming" || cur.status === "loading")) {
        return; // UI-31 cache: completed/streaming panes never refetch
      }
      if (!opts.allowNarration) {
        setEntry(key, { status: "error", text: "", errorReason: EXTRACTION_SKIPPED_REASON });
        return;
      }
      setEntry(key, { status: "loading", text: "" });
      enqueue(key, payload);
    },

    retry(key, payload) {
      controllers.get(key)?.abort();
      controllers.delete(key);
      setEntry(key, { status: "loading", text: "" });
      enqueue(key, payload);
    },

    abort(key) {
      controllers.get(key)?.abort();
      controllers.delete(key);
    },

    totals() {
      let promptTokens = 0;
      let completionTokens = 0;
      let latencyMs = 0;
      for (const e of entries.values()) {
        if (e.status === "complete" && e.usage) {
          promptTokens += e.usage.promptTokens;
          completionTokens += e.usage.completionTokens;
          latencyMs += e.usage.latencyMs;
        }
      }
      return { promptTokens, completionTokens, latencyMs };
    },

    fallbackServed: () => fallbackServedFlag,

    unresolvedCitations: () => Array.from(unresolved),
  };
}

/**
 * Frame-driven SSE consumption (03-01/03-02 route protocol): TextDecoder over
 * res.body, `data: {...}\n\n` frame buffering, safeTailHold so onDelta never
 * receives a partial `[[cite:` token (Pattern R3). HTTP != 200 → the JSON
 * error body's message reaches onError. Terminal frames (usage/rejected/
 * fallback/error) stop dispatch.
 */
export async function consumeNarrativeStream(
  res: Response,
  handlers: {
    onDelta(text: string): void;
    onUsage(u: {
      promptTokens: number;
      completionTokens: number;
      latencyMs: number;
      model: string;
    }): void;
    onRejected(reason: string, fallback: string): void;
    onFallback(fallback: string): void;
    onError(message: string): void;
    onDone(): void;
  },
): Promise<void> {
  if (!res.ok) {
    let message = `request failed (${res.status})`;
    try {
      const json = (await res.json()) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      // non-JSON error body — keep the generic message
    }
    handlers.onError(message);
    handlers.onDone();
    return;
  }
  if (!res.body) {
    handlers.onError("empty response body");
    handlers.onDone();
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let settled = false;

  const dispatch = (payload: string): boolean => {
    const frame = parseNarrativeFrame(payload);
    if (!frame) return false;
    switch (frame.type) {
      case "delta":
        handlers.onDelta(frame.text);
        return false;
      case "usage":
        handlers.onUsage(frame);
        return true;
      case "rejected":
        handlers.onRejected(frame.reason, frame.fallback);
        return true;
      case "fallback":
        handlers.onFallback(frame.fallback);
        return true;
      case "error":
        handlers.onError(frame.message);
        return true;
      default:
        return false; // meta — reserved
    }
  };

  while (!settled) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });
    // safeTailHold: never release a trailing partial `[[cite:` token (R3)
    const safe = safeTailHold(buffer);
    let releasable = safe;
    buffer = buffer.slice(safe.length);
    const parts = releasable.split("\n\n");
    const trailing = parts.pop() ?? "";
    buffer = trailing + buffer;
    for (const payload of parts) {
      const clean = payload.replace(/^data: /, "").trim();
      if (clean.length === 0) continue;
      if (dispatch(clean)) {
        settled = true;
        break;
      }
    }
  }
  if (!settled) {
    // stream ended without a terminal frame — flush whatever remains
    for (const payload of buffer.split("\n\n")) {
      const clean = payload.replace(/^data: /, "").trim();
      if (clean.length === 0) continue;
      if (dispatch(clean)) {
        settled = true;
        break;
      }
    }
  }
  handlers.onDone();
}

/** React binding: components re-render on store changes without new packages. */
export function useNarrativeStream(store: NarrativeStore): {
  getEntry: (key: NarrativeKey) => NarrativeEntryState | undefined;
  open: NarrativeStore["open"];
  retry: NarrativeStore["retry"];
  abort: NarrativeStore["abort"];
  totals: () => StoreTotals;
  fallbackServed: () => boolean;
  unresolvedCitations: () => string[];
} {
  useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.version(),
    () => store.version(), // getServerSnapshot — SSR markup tests + RSC render
  );
  return {
    getEntry: (key) => store.get(key),
    open: (key, payload, opts) => store.open(key, payload, opts),
    retry: (key, payload) => store.retry(key, payload),
    abort: (key) => store.abort(key),
    totals: () => store.totals(),
    fallbackServed: () => store.fallbackServed(),
    unresolvedCitations: () => store.unresolvedCitations(),
  };
}
