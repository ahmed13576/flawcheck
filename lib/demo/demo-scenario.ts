/**
 * Demo scenario builder (CONTEXT.md locks: zero network beyond page load;
 * provenance labeled "sample data"). Statically imports the committed Zenodo
 * fixture (real data, CC BY 4.0 — see ATTRIBUTION.md) and assembles an
 * EvaluationSession with builder-authored preset metadata.
 *
 * Demo preset metadata (research A4 recommendation, builder discretion):
 * - t_structural 19.85 mm governs (tank plating — the pressure branch is
 *   negligible at 0.05 MPa design pressure), so t_required = 19.85 mm and the
 *   real thickness spread (18.88-20.0 mm) lands all three verdict bands:
 *   ACCEPT >= 19.95, RE-CHECK [19.85, 19.95), FAIL < 19.85.
 * - gauge uncertainty 0.1 mm, piping Class 2 (10-yr cap in the interval rule).
 *
 * MAPPING IS EXPLICIT (builder decision recorded in the plan): t-initial and
 * t-previous are NOT mapped — Original_Scantling_mm is a constant nominal 20
 * (a design scantling, NOT a measured t-initial). The demo deliberately relies
 * on R6 derived campaign history (first-campaign readings honestly show
 * INSUFFICIENT HISTORY; degradation rates come from the real campaign spread).
 */
import { buildCells } from "@/lib/ingest/csv";
import type {
  ComponentMetadata,
  EvaluationSession,
  ParsedRow,
  PtmIndication,
  TargetField,
} from "@/lib/ingest/session";
import rawFixture from "./fixtures/zenodo-16780668-ut-register.json";
import rawSubsetFixture from "./fixtures/zenodo-16780668-ut-register-subset.json";

/**
 * Demo scope (06-02, UI-6.21/UI-6.22): "subset" — the committed deterministic
 * WBT-S6 tank subset (420 rows, one tank, every CML multi-campaign; the
 * human-sized PRIMARY demo), "full" — the untouched 4,912-row register (the
 * secondary "scale demo"). Both scopes parse through the IDENTICAL
 * buildCells ParsedRow path — no special-casing (T-06-02-01) — and carry the
 * same DEMO_FILENAME source name, metadata preset, mapping, indications, and
 * isDemo provenance; the scope is carried separately by the reducer's
 * ui.demoScope.
 */
export type DemoScope = "subset" | "full";

export const DEMO_FILENAME = "zenodo-16780668-Appendix-A-UT-register.csv";

export const DEMO_HEADERS = [
  "Reading_ID",
  "Tank",
  "Grid_Position",
  "Original_Scantling_mm",
  "Measured_Thickness_mm",
  "Measurement_Date",
] as const;

export const DEMO_METADATA: ComponentMetadata = {
  od: 2000,
  tNominal: 20,
  fca: 0,
  tStructural: 19.85,
  designCode: "ASME B31.3 — 2024 Edition",
  pipeClass: 2,
  gaugeUncertainty: 0.1,
  pressureUnit: "MPa",
  designPressure: 0.05,
  allowableStress: 138,
  e: 1.0,
  w: 1.0,
  y: 0.4,
  formula: "asme_b31_3_straight_pipe",
};

export const DEMO_MAPPING: Record<TargetField, string | null> = {
  readingId: "Reading_ID",
  tank: "Tank",
  measuredThickness: "Measured_Thickness_mm",
  measurementDate: "Measurement_Date",
  tInitial: null,
  tPrevious: null,
};

export const DEMO_NOTES =
  "Sample PT/MT notes (demo): 2025 campaign surface examination of tank shell and annular " +
  "plate welds. One linear MT indication flagged for Level 2/3 escalation; one small rounded " +
  "PT indication recorded as non-relevant per ASME B31.3 surface acceptance criteria.";

export const DEMO_INDICATIONS: PtmIndication[] = [
  {
    id: "demo-ind-mt-linear",
    method: "MT",
    morphology: "linear",
    lengthMm: 4.2,
    widthMm: 0.8,
    count: 1,
    edgeSeparationMm: null,
    crackSuspect: false,
    description: "Linear indication on shell vertical weld (sample)",
  },
  {
    id: "demo-ind-pt-rounded",
    method: "PT",
    morphology: "rounded",
    lengthMm: 1.2,
    widthMm: 0.9,
    count: 1,
    edgeSeparationMm: null,
    crackSuspect: false,
    description: "Rounded indication on annular plate (sample)",
  },
];

export function createDemoSession(scope: DemoScope = "subset"): EvaluationSession {
  const rows = (scope === "full" ? rawFixture : rawSubsetFixture) as unknown as Array<
    Record<string, string>
  >;
  const headers = [...DEMO_HEADERS];
  const parsedRows: ParsedRow[] = rows.map((cells, i) => ({
    row: i + 1,
    // Null-prototype cells — the same construction the tokenizer path uses,
    // so every downstream consumer sees one uniform shape (T-02-08).
    cells: buildCells(headers, headers.map((h) => cells[h] ?? "")),
    issues: [],
  }));

  return {
    source: { filename: DEMO_FILENAME, isDemo: true, ingestedAt: "" },
    csv: { headers, delimiter: ",", rowCount: parsedRows.length },
    mapping: { ...DEMO_MAPPING },
    units: { csvThickness: "mm", metadata: "mm" },
    rows: parsedRows,
    metadata: { ...DEMO_METADATA },
    ptmt: { notes: DEMO_NOTES, indications: DEMO_INDICATIONS.map((i) => ({ ...i })) },
    results: null,
  };
}
