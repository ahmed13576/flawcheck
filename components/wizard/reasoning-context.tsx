"use client";

/**
 * ReasoningProvider — 03-04 Task 1 (Pattern R1/R7): owns the session's
 * narrative store, the ONE batched extraction per evaluation (state machine
 * pending → running → complete | failed | disabled; a 200 {disabled:true}
 * maps to `disabled` per open-question resolution 3), and the positionally
 * aligned history seam (groupByCml re-run per evaluatedAt — lib/calc/
 * evaluate.ts maps inputs to readings 1:1 in order).
 *
 * allowNarration is true only when extraction is complete OR disabled —
 * never failed (Pitfall 5 client gate, UI-41). No hardcoded model IDs:
 * badges come only from server responses (PLAT-05).
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createNarrativeStore,
  type NarrativeStore,
} from "@/hooks/use-narrative-stream";
import type {
  EvaluationInput,
  EvaluationResults,
  ComponentMetadata,
  PtmIndication,
  ParsedRow,
} from "@/lib/ingest/session";
import type { NarrativeHistory } from "@/lib/reasoning/narrative-context";
import { groupByCml } from "@/lib/ingest/group";
import type { TargetField } from "@/lib/ingest/session";
import type { Unit } from "@/lib/ingest/session";

export type ExtractionStatus =
  | { state: "pending" }
  | { state: "running" }
  | { state: "complete"; usage: { promptTokens: number; completionTokens: number; latencyMs: number; model: string } }
  | { state: "failed"; message: string }
  | { state: "disabled" };

export interface ReasoningContextValue {
  store: NarrativeStore;
  extraction: ExtractionStatus;
  allowNarration: boolean;
  historyFor(index: number): NarrativeHistory | null;
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

export interface ReasoningProviderProps {
  results: EvaluationResults;
  metadata: ComponentMetadata;
  notes: string;
  indications: PtmIndication[];
  units: { csvThickness: Unit; metadata: Unit };
  evaluatedAt: string;
  /** Wizard session slices needed to re-run groupByCml for the history seam. */
  rows: ParsedRow[];
  mapping: Record<TargetField, string | null>;
  children: ReactNode;
}

export function ReasoningProvider({
  results,
  metadata,
  notes,
  indications,
  units,
  evaluatedAt,
  rows,
  mapping,
  children,
}: ReasoningProviderProps) {
  // Single-store-per-mount: useState's lazy initializer creates exactly one
  // store (the previous lazy-ref write-during-render tripped the React lint).
  const [store] = useState<NarrativeStore>(() => createNarrativeStore());

  const firedForRef = useRef<Set<string>>(new Set());
  const [extraction, setExtraction] = useState<ExtractionStatus>({ state: "pending" });

  // Positionally aligned history seam: re-run groupByCml per evaluatedAt with
  // the SAME rows/mapping/units the reducer used — evaluate() maps inputs to
  // readings 1:1 in order, so index i here corresponds to readings[i].
  const inputs = useMemo<EvaluationInput[]>(
    () => groupByCml(rows, mapping, { csvThicknessUnit: units.csvThickness }),
    [rows, mapping, units.csvThickness],
  );
  const historyFor = (index: number): NarrativeHistory | null => {
    const input = inputs[index];
    if (!input) return null;
    return {
      tInitialMm: input.tInitialMm,
      tPreviousMm: input.tPreviousMm,
      dtLtYears: input.dtLtYears,
      dtStYears: input.dtStYears,
    };
  };

  // ONE batched extraction per evaluatedAt (client-computed digest per R1).
  useEffect(() => {
    if (!evaluatedAt || firedForRef.current.has(evaluatedAt)) return;
    firedForRef.current.add(evaluatedAt);
    setExtraction({ state: "running" });
    const dates = results.readings.map((r) => r.date).sort();
    const digest = {
      total: results.summary.total,
      locations: results.summary.locations,
      accept: results.summary.accept,
      reCheck: results.summary.reCheck,
      fail: results.summary.fail,
      dateRange: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
      units: { csvThickness: units.csvThickness, metadata: units.metadata },
    };
    let cancelled = false;
    fetch("/api/reasoning/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata, notes, indications, populationDigest: digest }),
    })
      .then(async (res) => {
        if (cancelled) return;
        const json = (await res.json()) as {
          extraction: unknown;
          usage: { promptTokens: number; completionTokens: number; latencyMs: number; model: string } | null;
          disabled?: boolean;
          error?: string;
        };
        if (json.disabled) {
          setExtraction({ state: "disabled" });
          return;
        }
        if (!res.ok) {
          setExtraction({ state: "failed", message: json.error ?? `extraction failed (${res.status})` });
          return;
        }
        if (!json.usage) {
          setExtraction({ state: "failed", message: "extraction response missing usage" });
          return;
        }
        setExtraction({ state: "complete", usage: json.usage });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setExtraction({ state: "failed", message: e instanceof Error ? e.message : String(e) });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per evaluatedAt
  }, [evaluatedAt]);

  const value = useMemo<ReasoningContextValue>(
    () => ({
      store,
      extraction,
      allowNarration: extraction.state === "complete" || extraction.state === "disabled",
      historyFor,
    }),
    // historyFor depends on `inputs`; extraction gates narration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, extraction, inputs],
  );

  return <ReasoningContext.Provider value={value}>{children}</ReasoningContext.Provider>;
}

/**
 * Store access with a module-level fallback: renders outside a provider
 * (flowstep-restyle markup tests, non-provider embeds) get a standalone
 * store and narration enabled — provider-gated semantics apply only inside
 * Screen 3.
 */
/** Module-level fallback store — eager (tiny, inert until used). */
const fallbackStoreSingleton: NarrativeStore = createNarrativeStore();

/** Test seam: prime the fallback store (pipeline-status-bar markup tests). */
export function __getFallbackStoreForTests(): NarrativeStore {
  return fallbackStoreSingleton;
}

export function useReasoning(): ReasoningContextValue {
  const ctx = useContext(ReasoningContext);
  if (ctx) return ctx;
  return {
    store: fallbackStoreSingleton,
    extraction: { state: "disabled" },
    allowNarration: true,
    historyFor: () => null,
  };
}
