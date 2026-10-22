"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

export const WIZARD_SESSION_KEY = "flawcheck:wizard-state:v1";

export function serializeWizardState(state: WizardState): string {
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

/**
 * HYDRATION-SAFE: called only from a post-hydration effect — NEVER during
 * render. The reducer's lazy initializer runs on the server (prerender →
 * createInitialState, Screen 1) and again on the first client render; reading
 * sessionStorage there makes the two trees disagree when a saved session
 * exists (server renders Screen 1, client restores Screen 3) and Next discards
 * the server HTML — the hydration-mismatch crash seen on deployed builds.
 * Initial state is always createInitialState() so it byte-matches the server.
 *
 * Exported pure for the node test-suite (never called during render).
 */
export function readSavedWizardState(): WizardState | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const saved = sessionStorage.getItem(WIZARD_SESSION_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.__compactDemo) {
        // Re-hydrate demo scenario cleanly. CR-03: the scope stored on the
        // ui decides subset vs FULL register — always rebuild from the same
        // scope the user originally loaded (the full-register demo must not
        // silently collapse to the 420-row subset), and re-run the
        // evaluation only when the saved session had results.
        const restoredDemoScope = parsed.ui?.demoScope;
        const demoBase = wizardReducer(createInitialState(), {
          type: restoredDemoScope === "full" ? "load-demo-full" : "load-demo",
        });
        const hadResults = Boolean(parsed.ui?.evaluatedAt);
        const evaluated = hadResults
          ? wizardReducer(demoBase, { type: "run-evaluation" })
          : demoBase;
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
  return null;
}

export function WizardProvider({ children }: { children: ReactNode }) {
  // Always start from the identical server state (hydration-safe by construction);
  // any saved session is restored a moment after mount via the effect below.
  const [state, dispatch] = useReducer(wizardReducer, undefined, createInitialState);
  // The FIRST save-effect run corresponds to the pristine mount state — if it
  // wrote to storage it would clobber the saved session before the restore
  // dispatch re-renders. Skipping it preserves the session (d2bca54 guarantee).
  const skipFirstSaveRef = useRef(true);

  useEffect(() => {
    const saved = readSavedWizardState();
    if (saved) dispatch({ type: "restore-session", state: saved });
  }, []);

  useEffect(() => {
    if (skipFirstSaveRef.current) {
      skipFirstSaveRef.current = false;
      return;
    }
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
