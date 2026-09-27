import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  blockingChecks,
  createInitialState,
  draftFromMetadata,
  TRACER_METADATA_PRESET,
  wizardReducer,
  type WizardState,
} from "@/lib/wizard/reducer";
import type { EvaluationResults } from "@/lib/ingest/session";

/**
 * CR-02 regression pin: the app's own advertised upload format
 * (public/sample-ut-register.csv — the exact six-column layout the Screen 1
 * format guide shows) must evaluate from DERIVED campaign history.
 *
 * Original_Scantling_mm is a constant nominal design scantling (20 in every
 * row) — auto-guess must never map it to t-initial, or the wide-format
 * precedence in lib/ingest/group feeds the constant into CR_LT/CR_ST and
 * fabricates corrosion rates. Empirically (pre-fix, through the real reducer):
 * A01-2025 (true rate 0.029996 mm/yr) reported CR_LT 1.079852, and B02-2025 —
 * zero measured degradation (2.0 -> 2.0, truly insufficient history) —
 * reported CR 1.799754 with a FALSE immediate_inspection flag.
 */

const csv = readFileSync(
  join(__dirname, "..", "..", "public", "sample-ut-register.csv"),
  "utf8",
);

const parsed = wizardReducer(createInitialState(), {
  type: "parse-file",
  filename: "sample-ut-register.csv",
  content: csv,
});

// Fill the metadata form with the tracer preset values (a valid draft) so the
// Run Evaluation gate opens — the exact user flow after upload.
const withDraft: WizardState = {
  ...parsed,
  ui: { ...parsed.ui, metadataDraft: draftFromMetadata(TRACER_METADATA_PRESET) },
};
const evaluated = wizardReducer(withDraft, { type: "run-evaluation" });
const results = evaluated.results as EvaluationResults;

describe("CR-02 regression — the advertised sample register evaluates from derived history", () => {
  it("auto-guess leaves Original_Scantling_mm unmapped (constant nominal, not t-initial)", () => {
    expect(parsed.mapping.tInitial).toBeNull();
    expect(parsed.mapping.tPrevious).toBeNull();
    expect(parsed.mapping.measuredThickness).toBe("Measured_Thickness_mm");
    expect(parsed.mapping.readingId).toBe("Reading_ID");
    expect(parsed.mapping.tank).toBe("Tank");
  });

  it("the upload validates clean and reaches Screen 3 through the real gate chain", () => {
    expect(blockingChecks(parsed).rowErrors).toBe(0);
    expect(evaluated.ui.screen).toBe(3);
    expect(results.readings).toHaveLength(6);
  });

  it("A01-2025 CR_LT comes from measured campaign history (0.029996 mm/yr), not the scantling", () => {
    const a01 = results.readings.find((r) => r.readingId === "A01-2025")!;
    // (9.5 - 9.2) mm over 10.001369 yr (G13 delta) — the tracer golden rate.
    // The fabricated scantling rate was 1.079852 ((20 - 9.2) / 10.001369).
    expect(a01.rawCrLtMmYr).toBe(0.029996);
    expect(a01.verdict).toBe("accept");
    expect(a01.flags).not.toContain("immediate_inspection");
  });

  it("B02 (zero measured degradation) is insufficient history — NO fabricated CR, NO false immediate inspection", () => {
    const b02 = results.readings.find((r) => r.readingId === "B02-2025")!;
    // 2.0 -> 2.0 over 10 yr: the MEASURED rate is 0 (insufficient history),
    // never the fabricated 1.799754 from the constant scantling.
    expect(b02.rawCrLtMmYr).toBe(0);
    expect(b02.flags).toContain("insufficient_history");
    expect(b02.flags).not.toContain("immediate_inspection");
    expect(b02.rlYears).toBeNull();
    expect(b02.nextInspection).toBeNull();
  });

  it("no reading anywhere carries a fabricated immediate_inspection flag", () => {
    const immediate = results.readings.filter((r) =>
      r.flags.includes("immediate_inspection"),
    );
    expect(immediate).toEqual([]);
    // C03 sits exactly at t-required: re_check verdict with insufficient
    // history — pre-fix it reported RL 0/immediate under this same verdict.
    const c03 = results.readings.find((r) => r.readingId === "C03-2025")!;
    expect(c03.verdict).toBe("re_check");
    expect(c03.flags).toContain("insufficient_history");
    expect(c03.flags).not.toContain("immediate_inspection");
  });
});
