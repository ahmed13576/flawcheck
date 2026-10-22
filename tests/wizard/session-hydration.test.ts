/**
 * CR-03 + hydration — demo session re-hydration (wizard-context).
 *
 * Merged from two lineages:
 * - audit/uat-and-fix: full-vs-subset scope restore (CR-03), PT/MT
 *   preservation round-trip, unevaluated-screen-2 restore.
 * - hydration fix (fork B d2bca54 pattern): the provider's initial state is
 *   always createInitialState() (server == first client render); a saved
 *   session is applied from a post-hydration effect via the "restore-session"
 *   action — never inside a lazy initializer. readSavedWizardState is the
 *   pure seam both lineages' logic now lives in.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  readSavedWizardState,
  serializeWizardState,
  WIZARD_SESSION_KEY,
} from "@/components/wizard/wizard-context";
import { createInitialState, wizardReducer } from "@/lib/wizard/reducer";

describe("CR-03 demo session re-hydration (wizard-context)", () => {
  const originalSessionStorage = globalThis.sessionStorage;
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const storageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
      length: 0,
      key: vi.fn(),
    };
    Object.defineProperty(globalThis, "sessionStorage", {
      value: storageMock,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "sessionStorage", {
      value: originalSessionStorage,
      configurable: true,
      writable: true,
    });
  });

  it("CR-03 fix: re-hydrating a full demoScope session restores 4,912 rows (not 420)", () => {
    // 1. User loaded full demo
    const fullDemo = wizardReducer(createInitialState(), { type: "load-demo-full" });
    const evaluatedFull = wizardReducer(fullDemo, { type: "run-evaluation" });
    expect(evaluatedFull.rows).toHaveLength(4912);
    expect(evaluatedFull.ui.demoScope).toBe("full");

    // 2. Serialized to compact demo session
    const serialized = serializeWizardState(evaluatedFull);
    const parsed = JSON.parse(serialized);
    expect(parsed.__compactDemo).toBe(true);
    expect(parsed.ui.demoScope).toBe("full");

    // 3. Stored in sessionStorage
    mockStorage[WIZARD_SESSION_KEY] = serialized;

    // 4. Re-hydrated (e.g. returning from /report)
    const hydrated = readSavedWizardState();
    expect(hydrated?.ui.demoScope).toBe("full");
    expect(hydrated?.rows).toHaveLength(4912);
    expect(hydrated?.csv.rowCount).toBe(4912);
    expect(hydrated?.results?.readings).toHaveLength(4912);
  });

  it("re-hydrating a subset demoScope session restores exactly 420 rows", () => {
    const subsetDemo = wizardReducer(createInitialState(), { type: "load-demo" });
    const evaluatedSubset = wizardReducer(subsetDemo, { type: "run-evaluation" });
    expect(evaluatedSubset.rows).toHaveLength(420);
    expect(evaluatedSubset.ui.demoScope).toBe("subset");

    const serialized = serializeWizardState(evaluatedSubset);
    mockStorage[WIZARD_SESSION_KEY] = serialized;

    const hydrated = readSavedWizardState();
    expect(hydrated?.ui.demoScope).toBe("subset");
    expect(hydrated?.rows).toHaveLength(420);
    expect(hydrated?.csv.rowCount).toBe(420);
    expect(hydrated?.results?.readings).toHaveLength(420);
  });

  it("adversarial stress test: round-trip idempotency and PT/MT preservation across repeated reloads", () => {
    // 1. Full demo with custom PT/MT indication added
    const fullDemo = wizardReducer(createInitialState(), { type: "load-demo-full" });
    const evaluatedFull = wizardReducer(fullDemo, { type: "run-evaluation" });
    const customPtmtState = {
      ...evaluatedFull,
      ptmt: {
        ...evaluatedFull.ptmt,
        notes: "Inspection of high-stress weld seam",
        indications: [
          {
            id: "pt-custom-1",
            method: "PT" as const,
            morphology: "linear" as const,
            lengthMm: 12.5,
            widthMm: 1.0,
            count: 1,
            edgeSeparationMm: null,
            crackSuspect: true,
            verdict: "reject" as const,
            detail: "Linear indication exceeding ASME B31.3 threshold",
            citationId: "asme_b31_3_pt_linear",
          },
        ],
      },
    };

    // 2. Cycle 1: Serialize -> Storage -> Re-hydrate
    const serialized1 = serializeWizardState(customPtmtState);
    expect(JSON.parse(serialized1).__compactDemo).toBe(true);
    mockStorage[WIZARD_SESSION_KEY] = serialized1;

    const hydrated1 = readSavedWizardState();
    expect(hydrated1?.ui.demoScope).toBe("full");
    expect(hydrated1?.rows).toHaveLength(4912);
    expect(hydrated1?.results?.readings).toHaveLength(4912);
    expect(hydrated1?.ptmt.indications).toHaveLength(1);
    expect(hydrated1?.ptmt.indications[0].id).toBe("pt-custom-1");

    // 3. Cycle 2: Re-serialize hydrated state -> Storage -> Re-hydrate again
    const serialized2 = serializeWizardState(hydrated1!);
    expect(JSON.parse(serialized2).__compactDemo).toBe(true);
    mockStorage[WIZARD_SESSION_KEY] = serialized2;

    const hydrated2 = readSavedWizardState();
    expect(hydrated2?.ui.demoScope).toBe("full");
    expect(hydrated2?.rows).toHaveLength(4912);
    expect(hydrated2?.results?.readings).toHaveLength(4912);
    expect(hydrated2?.ptmt.indications).toHaveLength(1);
    expect(hydrated2?.ptmt.indications[0].id).toBe("pt-custom-1");
  });

  it("adversarial stress test: unevaluated Screen 2 demo re-hydrates without premature evaluation", () => {
    // Demo loaded on Screen 2 (Review) without evaluation
    const subsetDemo = wizardReducer(createInitialState(), { type: "load-demo" });
    expect(subsetDemo.ui.screen).toBe(2);
    expect(subsetDemo.results).toBeNull();

    const serialized = serializeWizardState(subsetDemo);
    mockStorage[WIZARD_SESSION_KEY] = serialized;

    const hydrated = readSavedWizardState();
    expect(hydrated?.ui.screen).toBe(2);
    expect(hydrated?.rows).toHaveLength(420);
    expect(hydrated?.results).toBeNull(); // Must not prematurely run evaluation
  });
});

describe("restore-session reducer action (hydration fix)", () => {
  it("replaces the whole state with the saved session", () => {
    const full = wizardReducer(createInitialState(), { type: "load-demo-full" });
    const evaluated = wizardReducer(full, { type: "run-evaluation" });
    const restored = wizardReducer(createInitialState(), {
      type: "restore-session",
      state: evaluated,
    });
    expect(restored.ui.screen).toBe(evaluated.ui.screen);
    expect(restored.ui.evaluatedAt).toBe(evaluated.ui.evaluatedAt);
    expect(restored.results?.summary.total).toBe(evaluated.results?.summary.total);
  });

  it("keeps the pristine state when no session restore is dispatched", () => {
    const initial = createInitialState();
    expect(initial.ui.screen).toBe(1);
    expect(initial.results).toBeNull();
    expect(initial.ui.evaluatedAt).toBeNull();
  });

  it("an unevaluated saved session restores without running the engine", () => {
    const full = wizardReducer(createInitialState(), { type: "load-demo-full" });
    // No run-evaluation was dispatched for this state.
    expect(full.ui.evaluatedAt).toBeNull();
    expect(full.results).toBeNull();
  });
});
