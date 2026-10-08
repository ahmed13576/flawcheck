"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  createInitialState,
  wizardReducer,
  type WizardAction,
  type WizardState,
} from "@/lib/wizard/reducer";
import { readReportSnapshot } from "@/lib/report/session-snapshot";

interface WizardContextValue {
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
}

const WizardContext = createContext<WizardContextValue | null>(null);

const WIZARD_SESSION_KEY = "flawcheck:wizard-state:v1";

function serializeWizardState(state: WizardState): string {
  if (state.source.isDemo) {
    // For demo scenario, save compact descriptor to prevent hitting browser 5MB sessionStorage quota
    return JSON.stringify({
      __compactDemo: true,
      ui: state.ui,
      ptmt: state.ptmt,
    });
  }
  // For uploaded CSV, strip redundant heavy raw text string before saving
  const copy = {
    ...state,
    csv: { ...state.csv, content: "" },
  };
  return JSON.stringify(copy);
}

function getInitialState(): WizardState {
  if (typeof sessionStorage !== "undefined") {
    try {
      const saved = sessionStorage.getItem(WIZARD_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.__compactDemo) {
          // Re-hydrate demo scenario cleanly
          const demoBase = wizardReducer(createInitialState(), { type: "load-demo" });
          const evaluated = wizardReducer(demoBase, { type: "run-evaluation" });
          return {
            ...evaluated,
            ui: { ...evaluated.ui, ...(parsed.ui ?? {}) },
            ptmt: parsed.ptmt ? { ...evaluated.ptmt, ...parsed.ptmt } : evaluated.ptmt,
          };
        }
        if (parsed && typeof parsed === "object" && parsed.ui && parsed.csv) {
          return parsed as WizardState;
        }
      }
    } catch {
      // ignore
    }

    // Fallback: If WIZARD_SESSION_KEY was evicted or failed to save, but report snapshot exists,
    // restore Screen 3 state from snapshot so "Back to results" never loses evaluation results!
    try {
      const snap = readReportSnapshot();
      if (snap && snap.readings && snap.readings.length > 0) {
        const initial = createInitialState();
        return {
          ...initial,
          source: { filename: snap.sourceName, isDemo: false, ingestedAt: snap.evaluatedAt },
          units: snap.units,
          metadata: snap.metadata,
          results: {
            summary: snap.summary,
            readings: snap.readings,
            indications: snap.indications,
            citationsUsed: [],
          },
          ptmt: { notes: snap.notes, indications: snap.indications },
          ui: {
            ...initial.ui,
            screen: 3,
            evaluatedAt: snap.evaluatedAt,
          },
        };
      }
    } catch {
      // ignore
    }
  }
  return createInitialState();
}

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, undefined, getInitialState);

  useEffect(() => {
    if (typeof sessionStorage !== "undefined") {
      try {
        sessionStorage.setItem(WIZARD_SESSION_KEY, serializeWizardState(state));
      } catch {
        // Storage full/unavailable: session-only convenience
      }
    }
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used within a WizardProvider");
  return ctx;
}
