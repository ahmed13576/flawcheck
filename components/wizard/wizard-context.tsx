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

interface WizardContextValue {
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
}

const WizardContext = createContext<WizardContextValue | null>(null);

const WIZARD_SESSION_KEY = "flawcheck:wizard-state:v1";

function getInitialState(): WizardState {
  if (typeof sessionStorage !== "undefined") {
    try {
      const saved = sessionStorage.getItem(WIZARD_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && parsed.ui && parsed.csv) {
          return parsed as WizardState;
        }
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
        sessionStorage.setItem(WIZARD_SESSION_KEY, JSON.stringify(state));
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
