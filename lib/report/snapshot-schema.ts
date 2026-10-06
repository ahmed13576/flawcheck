/**
 * Report snapshot schema — 04-02 Task 1 (WR-10 closure): the complete Zod
 * contract for the PDF POST body. The Phase 3 parseSnapshot only shallow-
 * checked summary and blindly cast metadata/readings; THIS schema validates
 * every field at the server boundary. Strict objects (unknown keys reject —
 * ASVS V5) and finite refinements on every number (NaN/Infinity payloads
 * reject). Mirrors lib/report/session-snapshot.ts + lib/ingest/session.ts
 * field-for-field. Pure boundary module: imports nothing from components/.
 */
import { z } from "zod";

const finite = z.number().refine((n) => Number.isFinite(n), "must be finite");

const UnitSchema = z.enum(["mm", "in", "mils"]);

export const UnitsSchema = z
  .object({
    csvThickness: UnitSchema,
    metadata: UnitSchema,
  })
  .strict();

export const ReportSignOffSchema = z
  .object({
    name: z.string().min(1),
    certification: z.string().min(1),
    date: z.string().min(1),
    signature: z.string().min(1),
  })
  .strict();

export const ReportMetadataSchema = z
  .object({
    od: finite,
    tNominal: finite,
    fca: finite,
    tStructural: finite,
    designCode: z.literal("ASME B31.3 — 2024 Edition"),
    pipeClass: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    gaugeUncertainty: finite,
    pressureUnit: z.enum(["MPa", "psi"]),
    designPressure: finite,
    allowableStress: finite,
    e: finite,
    w: finite,
    y: finite,
    formula: z.enum(["asme_b31_3_straight_pipe", "barlow_in_service"]),
  })
  .strict();

const ReadingFlagSchema = z.enum([
  "outlier",
  "measurement_inconsistency",
  "insufficient_history",
  "immediate_inspection",
]);

const VerdictSchema = z.enum(["accept", "re_check", "reject"]);

const OutlierSchema = z
  .object({
    z: finite,
    median: finite,
    mad: finite,
  })
  .strict();

const NextInspectionSchema = z
  .object({
    date: z.string().min(1),
    intervalYears: finite,
  })
  .strict();

export const ReadingResultSchema = z
  .object({
    readingId: z.string().min(1),
    location: z.string().min(1),
    cml: z.string().min(1).optional(),
    date: z.string().min(1),
    tActualMm: finite,
    tPressureMm: finite,
    tStructuralMm: finite,
    tRequiredMm: finite,
    crLtMmYr: finite.nullable(),
    crStMmYr: finite.nullable(),
    rawCrLtMmYr: finite.nullable(),
    rawCrStMmYr: finite.nullable(),
    crGoverningMmYr: finite.nullable(),
    rlYears: finite.nullable(),
    nextInspection: NextInspectionSchema.nullable(),
    flags: z.array(ReadingFlagSchema),
    outlier: OutlierSchema.optional(),
    verdict: VerdictSchema,
    citations: z.array(z.string().min(1)),
  })
  .strict();

export const PtmIndicationResultSchema = z
  .object({
    id: z.string().min(1),
    method: z.enum(["PT", "MT"]),
    morphology: z.enum(["linear", "rounded"]),
    lengthMm: finite,
    widthMm: finite,
    count: finite,
    edgeSeparationMm: finite.nullable(),
    crackSuspect: z.boolean(),
    description: z.string().optional(),
    verdict: VerdictSchema,
    detail: z.string().min(1),
    citationId: z.string().min(1),
  })
  .strict();

export const ReportSummarySchema = z
  .object({
    total: finite,
    locations: finite,
    accept: finite,
    reCheck: finite,
    fail: finite,
  })
  .strict();

export const ReportSnapshotSchema = z
  .object({
    evaluatedAt: z.string().min(1),
    sourceName: z.string().min(1),
    units: UnitsSchema,
    metadata: ReportMetadataSchema,
    summary: ReportSummarySchema,
    readings: z.array(ReadingResultSchema),
    indications: z.array(PtmIndicationResultSchema),
    notes: z.string(),
    signOff: ReportSignOffSchema.nullable().optional(),
  })
  .strict();

export const AuditStepSchema = z
  .object({
    step: z.enum(["extraction", "narrative"]),
    model: z.string().min(1).nullable(),
    promptTokens: z.number().int().nullable(),
    completionTokens: z.number().int().nullable(),
    latencyMs: z.number().int().nullable(),
  })
  .strict();

export const ReportAuditSchema = z
  .object({
    evaluatedAt: z.string().min(1),
    inputHash: z.string().min(1),
    steps: z.tuple([AuditStepSchema, AuditStepSchema]), // exactly [extraction, narrative]
  })
  .strict();

export const ReportPdfRequestSchema = z
  .object({
    snapshot: ReportSnapshotSchema,
    audit: ReportAuditSchema.nullable().optional(),
  })
  .strict();

export type ReportPdfRequest = z.infer<typeof ReportPdfRequestSchema>;
