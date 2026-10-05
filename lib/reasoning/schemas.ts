/**
 * Reasoning schemas — 03-01 Task 1. Zod v4, `.strict()` on every request body
 * (ASVS V5: unknown/misspelled fields are rejected with 400 before any
 * processing — T-03-02). The SSE frame union (NarrativeFrameSchema) is the
 * FULL typed protocol from day one: meta/delta/usage/rejected/fallback/error
 * — Plan 03-02 inserts the Super-120B upstream stream ahead of the fallback
 * branch WITHOUT changing this protocol; this plan emits only fallback frames
 * (no fabricated meta/usage).
 *
 * Ownership (checker round 1, schemas race): the cml variant's `history`
 * block is DEFINED HERE and nowhere else — 03-02's route and 03-03's request
 * builder both consume it; neither re-declares or re-extends it. 03-02 may
 * add ExtractionRequestSchema to this file; these exports are final.
 */
import { z } from "zod";
import type { ReadingResult, ReadingFlag, Verdict } from "@/lib/ingest/session";

/* ------------------------------------------------------------------ */
/* Reading / indication / metadata mirrors (field-for-field, hand-     */
/* written against lib/ingest/session.ts lines 37-149)                 */
/* ------------------------------------------------------------------ */

const VerdictSchema = z.enum(["accept", "re_check", "reject"]);

const ReadingFlagSchema = z.enum([
  "outlier",
  "measurement_inconsistency",
  "insufficient_history",
  "immediate_inspection",
]);

const ReadingResultSchema = z.object({
  readingId: z.string().min(1),
  location: z.string().min(1),
  cml: z.string().min(1).optional(),
  date: z.string().min(1),
  tActualMm: z.number(),
  tPressureMm: z.number(),
  tStructuralMm: z.number(),
  tRequiredMm: z.number(),
  crLtMmYr: z.number().nullable(),
  crStMmYr: z.number().nullable(),
  rawCrLtMmYr: z.number().nullable(),
  rawCrStMmYr: z.number().nullable(),
  crGoverningMmYr: z.number().nullable(),
  rlYears: z.number().nullable(),
  nextInspection: z
    .object({ date: z.string().min(1), intervalYears: z.number() })
    .nullable(),
  flags: z.array(ReadingFlagSchema),
  outlier: z
    .object({ z: z.number(), median: z.number(), mad: z.number() })
    .optional(),
  verdict: VerdictSchema,
  citations: z.array(z.string().min(1)),
});

const PtmIndicationResultSchema = z.object({
  id: z.string().min(1),
  method: z.enum(["PT", "MT"]),
  morphology: z.enum(["linear", "rounded"]),
  lengthMm: z.number(),
  widthMm: z.number(),
  count: z.number(),
  edgeSeparationMm: z.number().nullable(),
  crackSuspect: z.boolean(),
  description: z.string().optional(),
  verdict: VerdictSchema,
  detail: z.string().min(1),
  citationId: z.string().min(1),
});

const MetadataSliceSchema = z.object({
  od: z.number(),
  tNominal: z.number(),
  fca: z.number(),
  tStructural: z.number(),
  designCode: z.literal("ASME B31.3 — 2024 Edition"),
  pipeClass: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  gaugeUncertainty: z.number(),
  /**
   * CR-03: ComponentMetadata numerics arrive in the DECLARED metadata unit
   * (the engine converts at eval entry — lib/calc/evaluate.ts). Without the
   * unit, the reasoning layer mixed a possibly in/mils-denominated gauge
   * uncertainty into canonical-mm arithmetic. Consumers convert via
   * lib/calc's toMm BEFORE any arithmetic/allowlist/prompt use.
   */
  metadataUnit: z.enum(["mm", "in", "mils"]),
  pressureUnit: z.enum(["MPa", "psi"]),
  designPressure: z.number(),
  allowableStress: z.number(),
  e: z.number(),
  w: z.number(),
  y: z.number(),
  formula: z.enum(["asme_b31_3_straight_pipe", "barlow_in_service"]),
});

/** Inferred shape of the metadata slice (ComponentMetadata + metadataUnit). */
export type MetadataSlice = z.infer<typeof MetadataSliceSchema>;

/**
 * Campaign history slice consumed by 03-02's route / 03-03's request builder.
 * Nullable members mirror the grouping stage: a first-campaign reading has no
 * prior thickness and no elapsed intervals. DEFINED HERE ONLY.
 */
export const HistorySchema = z.object({
  tInitialMm: z.number().nullable(),
  tPreviousMm: z.number().nullable(),
  dtLtYears: z.number().nullable(),
  dtStYears: z.number().nullable(),
});

/* ------------------------------------------------------------------ */
/* Extraction result (final R1 shape — 03-02 adds only its request)    */
/* ------------------------------------------------------------------ */

const SHORT_TEXT = z.string().min(1).max(200);
const SHORT_LIST = z.array(SHORT_TEXT).max(5);

export const ExtractionResultSchema = z.object({
  componentContext: z.object({
    serviceDescription: z.string().min(1).max(600),
  }),
  notableFacts: SHORT_LIST,
  ptmtNotesSummary: z
    .object({
      relevant: z.boolean(),
      points: SHORT_LIST,
    })
    .nullable(),
  cautions: SHORT_LIST,
});

/* ------------------------------------------------------------------ */
/* Request bodies (strict — T-03-02)                                   */
/* ------------------------------------------------------------------ */

export const NarrativeRequestSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("cml"),
      evaluatedAt: z.string().min(1),
      reading: ReadingResultSchema,
      metadata: MetadataSliceSchema,
      extraction: ExtractionResultSchema.nullable(),
      history: HistorySchema.nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("ptmt"),
      evaluatedAt: z.string().min(1),
      indication: PtmIndicationResultSchema,
    })
    .strict(),
]);

/* ------------------------------------------------------------------ */
/* Extraction request/response (03-02 Task 2)                          */
/* ------------------------------------------------------------------ */

export const PopulationDigestSchema = z.object({
  total: z.number().int(),
  locations: z.number().int(),
  accept: z.number().int(),
  reCheck: z.number().int(),
  fail: z.number().int(),
  dateRange: z
    .object({ from: z.string(), to: z.string() })
    .nullable(),
  units: z.object({ csvThickness: z.string(), metadata: z.string() }),
});

export const ExtractionRequestSchema = z
  .object({
    metadata: MetadataSliceSchema,
    notes: z.string(),
    indications: z.array(PtmIndicationResultSchema),
    populationDigest: PopulationDigestSchema,
  })
  .strict();

export type PopulationDigest = z.infer<typeof PopulationDigestSchema>;
export type ExtractionRequest = z.infer<typeof ExtractionRequestSchema>;
export interface ExtractionUsage {
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  model: string;
}
export interface ExtractionResponse {
  extraction: ExtractionResult | null;
  usage: ExtractionUsage | null;
  disabled?: true;
}

/**
 * LLM availability gate — SINGLE definition (03-02; the narrative route
 * re-exports it for its 03-01 tests): true when the explicit kill-switch is
 * set OR no API key is configured. Naming per 03-RESEARCH assumption A4
 * (FLAWCHECK_DISABLE_LLM).
 */
export function isLlmDisabled(): boolean {
  const kill = process.env.FLAWCHECK_DISABLE_LLM;
  return kill === "1" || kill === "true" || !process.env.NEBIUS_API_KEY;
}

/* ------------------------------------------------------------------ */
/* SSE frame union — the full typed protocol                           */
/* ------------------------------------------------------------------ */

export const NarrativeFrameSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("meta"), model: z.string().min(1) }),
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({
    type: z.literal("usage"),
    promptTokens: z.number().int(),
    completionTokens: z.number().int(),
    latencyMs: z.number().int(),
    model: z.string().min(1),
  }),
  z.object({
    type: z.literal("rejected"),
    reason: z.enum(["numeric_lint", "verdict_lint", "citation_lint", "verbatim_lint"]),
    fallback: z.string().min(1),
  }),
  z.object({
    type: z.literal("fallback"),
    fallback: z.string().min(1),
    reason: z.literal("llm_disabled"),
  }),
  z.object({ type: z.literal("error"), message: z.string().min(1) }),
]);

export type NarrativeRequest = z.infer<typeof NarrativeRequestSchema>;
export type NarrativeFrame = z.infer<typeof NarrativeFrameSchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
export type { ReadingResult, ReadingFlag, Verdict };

/**
 * Parse one SSE `data:` payload into a typed frame (client helper — 03-01
 * Task 2's tracer glue reads the stream with this; returns null for the
 * `[DONE]` sentinel or any unparseable payload).
 */
export function parseNarrativeFrame(payload: string): NarrativeFrame | null {
  if (payload.trim() === "[DONE]") return null;
  try {
    const parsed = NarrativeFrameSchema.safeParse(JSON.parse(payload));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
