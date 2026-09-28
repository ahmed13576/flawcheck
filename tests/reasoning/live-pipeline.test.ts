/**
 * LIVE pipeline proof — 03-02 Task 3 (Assumption A11: prompt-design behavior
 * must be proven against the real models; a failure here is a prompt-tuning
 * finding, never a reason to loosen a lint).
 *
 * Hermeticity (WR-08 pattern, copied from tests/llm/hello-fixture.test.ts):
 * the default `npm test` run SKIPS this file cleanly (green AND
 * key-independent). Opt in explicitly with:
 *   FLAWCHECK_LIVE_LLM=1 npm test   (requires NEBIUS_API_KEY from .env.local)
 *
 * Makes REAL paid calls (~$0.001: one batched extraction + one streamed
 * narrative at reasoning_effort "low").
 */
import { describe, it, expect } from "vitest";
import { POST as extractPOST } from "@/app/api/reasoning/extract/route";
import { POST as narrativePOST } from "@/app/api/reasoning/narrative/route";
import { ExtractionResultSchema, parseNarrativeFrame } from "@/lib/reasoning/schemas";
import type { ComponentMetadata, ReadingResult } from "@/lib/ingest/session";

const HAS_KEY = !!process.env.NEBIUS_API_KEY;
const LIVE_GATE = ["1", "true"].includes(String(process.env.FLAWCHECK_LIVE_LLM ?? "").toLowerCase());
const LIVE_READY = HAS_KEY && LIVE_GATE;

const METADATA: ComponentMetadata = {
  od: 219.1,
  tNominal: 10.31,
  fca: 1.0,
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
};

const READING: ReadingResult = {
  readingId: "r-1",
  location: "North header",
  cml: "CML-01",
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
  citations: ["api574_10_5_1_4", "api570_7_2"],
};

const NOTES =
  "Sample data (builder-authored, honestly labeled): external surface coating intact; minor surface rust at supports; no linear indications reported at this location.";

const DIGEST = {
  total: 1,
  locations: 1,
  accept: 1,
  reCheck: 0,
  fail: 0,
  dateRange: { from: "2025-01-15", to: "2025-01-15" },
  units: { csvThickness: "mm", metadata: "mm" },
};

describe.skipIf(!LIVE_READY)("live pipeline: extraction + narrative (A11)", () => {
  it(
    "extracts a valid pack and streams a narrative that passes all four final lints",
    { timeout: 120_000 },
    async () => {
      const extractRes = await extractPOST(
        new Request("http://localhost/api/reasoning/extract", {
          method: "POST",
          body: JSON.stringify({
            metadata: METADATA,
            notes: NOTES,
            indications: [],
            populationDigest: DIGEST,
          }),
        }),
      );
      expect(extractRes.status).toBe(200);
      const extractJson = (await extractRes.json()) as { extraction: unknown; disabled?: boolean };
      expect(extractJson.disabled).toBeUndefined();
      const parsed = ExtractionResultSchema.safeParse(extractJson.extraction);
      expect(parsed.success).toBe(true);

      const narrativeRes = await narrativePOST(
        new Request("http://localhost/api/reasoning/narrative", {
          method: "POST",
          body: JSON.stringify({
            kind: "cml",
            evaluatedAt: new Date().toISOString(),
            reading: READING,
            metadata: METADATA,
            extraction: extractJson.extraction,
            history: null,
          }),
        }),
      );
      expect(narrativeRes.status).toBe(200);
      const raw = await narrativeRes.text();
      const frames = raw
        .split("\n\n")
        .map((c) => c.replace(/^data: /, "").trim())
        .filter((p) => p.length > 0)
        .map((p) => parseNarrativeFrame(p));

      const rejected = frames.find((f) => f?.type === "rejected");
      const error = frames.find((f) => f?.type === "error");
      // If a lint rejected the real narrative, that is a PROMPT-TUNING finding
      // — record it in the summary; never loosen a lint to make this pass.
      expect(rejected ?? error).toBeUndefined();
      const usage = frames.find((f) => f?.type === "usage") as
        | { promptTokens: number; completionTokens: number; latencyMs: number; model: string }
        | undefined;
      expect(usage).toBeDefined();
      expect(usage?.completionTokens ?? 0).toBeGreaterThan(0);
      const narrative = frames
        .filter((f) => f?.type === "delta")
        .map((f) => (f as { text: string }).text)
        .join("");
      expect(narrative).toContain("Verdict: ACCEPT.");
    },
  );
});
