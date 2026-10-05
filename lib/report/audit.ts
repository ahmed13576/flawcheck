/**
 * Audit telemetry store — 04-01 Task 2 (REPT-02 data model).
 *
 * Runtime-resolved per the locked decision: model/token/latency values come
 * from the ReasoningProvider extraction state and the narrative store ONLY —
 * never hardcoded model strings, never fabricated numbers (UI-54). When
 * usage is absent the fields stay null; the appendix renders em-dashes.
 *
 * Storage mirrors lib/report/session-snapshot.ts: sessionStorage key
 * `flawcheck:report-audit:v1`, SSR/node no-op guards, try/catch swallow on
 * storage errors, defensive parse returning null on absent/corrupt payloads
 * (browser tab → sessionStorage is a trust boundary — T-04-01-01).
 */
import type { ParsedRow, TargetField, Unit } from "@/lib/ingest/session";

export const REPORT_AUDIT_KEY = "flawcheck:report-audit:v1";

/** One pipeline step's telemetry — every field nullable, never fabricated. */
export interface AuditStep {
  step: "extraction" | "narrative";
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number | null;
}

/** The audit record: exactly two steps — extraction first, narrative second. */
export interface ReportAudit {
  evaluatedAt: string;
  inputHash: string;
  steps: [AuditStep, AuditStep];
}

/**
 * Telemetry input shape for buildAuditSteps — matches the extraction usage
 * block (lib/reasoning/schemas) and the narrative store totals
 * (hooks/use-narrative-stream) with null where usage is absent.
 */
export interface AuditTelemetry {
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number | null;
}

/**
 * Pure: maps the two runtime telemetry objects onto the fixed two-entry steps
 * array (extraction first, narrative second). A null telemetry object — or
 * any null field — passes through verbatim; never substituted with zeros or
 * invented model names (UI-54 / T-04-01-03).
 */
export function buildAuditSteps(
  extraction: AuditTelemetry | null,
  narrative: AuditTelemetry | null,
): [AuditStep, AuditStep] {
  const toStep = (step: "extraction" | "narrative", t: AuditTelemetry | null): AuditStep => ({
    step,
    model: t?.model ?? null,
    promptTokens: t?.promptTokens ?? null,
    completionTokens: t?.completionTokens ?? null,
    latencyMs: t?.latencyMs ?? null,
  });
  return [toStep("extraction", extraction), toStep("narrative", narrative)];
}

/**
 * Fingerprints everything the deterministic evaluation consumed: the parsed
 * CSV rows, the field mapping, and the declared units — serialized as
 * JSON.stringify of an object holding rows, mapping, and units in that key
 * order (insertion-order stable for the same parse path). Returns the SHA-256
 * hex digest (lowercase, 64 chars) via globalThis.crypto.subtle — Node 24 and
 * browsers both provide crypto.subtle.
 */
export async function computeInputHash(
  rows: ParsedRow[],
  mapping: Record<TargetField, string | null>,
  units: { csvThickness: Unit; metadata: Unit },
): Promise<string> {
  const payload = JSON.stringify({ rows, mapping, units });
  const bytes = new TextEncoder().encode(payload);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Defensive step parse: shape-checked or the whole record is corrupt. */
function parseStep(raw: unknown, expected: "extraction" | "narrative"): AuditStep | null {
  if (!isRecord(raw)) return null;
  if (raw.step !== expected) return null;
  const nullableString = (v: unknown): string | null =>
    typeof v === "string" ? v : null;
  const nullableNumber = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  return {
    step: expected,
    model: nullableString(raw.model),
    promptTokens: nullableNumber(raw.promptTokens),
    completionTokens: nullableNumber(raw.completionTokens),
    latencyMs: nullableNumber(raw.latencyMs),
  };
}

/** Defensive parse: absent/corrupt → null (T-04-01-01 mitigation). */
function parseAudit(raw: unknown): ReportAudit | null {
  if (!isRecord(raw)) return null;
  const { evaluatedAt, inputHash, steps } = raw;
  if (typeof evaluatedAt !== "string" || evaluatedAt.length === 0) return null;
  if (typeof inputHash !== "string" || inputHash.length === 0) return null;
  if (!Array.isArray(steps) || steps.length !== 2) return null;
  const extraction = parseStep(steps[0], "extraction");
  const narrative = parseStep(steps[1], "narrative");
  if (!extraction || !narrative) return null;
  return { evaluatedAt, inputHash, steps: [extraction, narrative] };
}

export function writeReportAudit(audit: ReportAudit): void {
  if (typeof sessionStorage === "undefined") return; // SSR/node safety: no-op
  try {
    sessionStorage.setItem(REPORT_AUDIT_KEY, JSON.stringify(audit));
  } catch {
    // Storage full/unavailable: session-only convenience, never a failure.
  }
}

export function readReportAudit(): ReportAudit | null {
  if (typeof sessionStorage === "undefined") return null; // SSR/node safety
  try {
    const raw = sessionStorage.getItem(REPORT_AUDIT_KEY);
    if (raw === null) return null;
    return parseAudit(JSON.parse(raw));
  } catch {
    return null; // corrupt payload or storage error → appendix renders null-audit rows
  }
}
