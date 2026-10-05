/**
 * Report session snapshot — 03-00b Task 1. Session-only serialization of the
 * current evaluation session for the locked /report preview (Screen 4):
 * writeReportSnapshot/readReportSnapshot over sessionStorage key
 * `flawcheck:report-snapshot:v1`. The snapshot is the user's own current-
 * session data in their own browser (T-03-20): nothing persists beyond the
 * session, nothing transmits, no PDF. readReportSnapshot hand-rolls a
 * defensive shape check — sessionStorage can hold anything — and returns null
 * on absent/corrupt payloads.
 */
import type {
  ComponentMetadata,
  EvaluationResults,
  EvaluationSession,
  ReadingResult,
  Unit,
} from "@/lib/ingest/session";

export const REPORT_SNAPSHOT_KEY = "flawcheck:report-snapshot:v1";

/**
 * Inspector sign-off — 04-01 Task 1. Exactly four fields, all required for a
 * complete sign-off (the /report gate checks all four non-empty). Stored on
 * the snapshot under the optional `signOff` key, session-scope only (locked
 * decision: sessionStorage alongside the snapshot, no server persistence).
 */
export interface ReportSignOff {
  name: string;
  certification: string;
  date: string;
  signature: string;
}

export interface ReportSnapshot {
  evaluatedAt: string;
  sourceName: string;
  units: { csvThickness: Unit; metadata: Unit };
  metadata: ComponentMetadata;
  summary: EvaluationResults["summary"];
  readings: ReadingResult[];
  indications: EvaluationResults["indications"];
  notes: string;
  /** 04-01: optional validated sign-off; corrupt shapes degrade to absent. */
  signOff?: ReportSignOff | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Defensive parse: every field shape-checked; anything else → null. */
function parseSnapshot(raw: unknown): ReportSnapshot | null {
  if (!isRecord(raw)) return null;
  const { evaluatedAt, sourceName, units, metadata, summary, readings, indications, notes } = raw;
  if (typeof evaluatedAt !== "string" || typeof sourceName !== "string") return null;
  if (typeof notes !== "string") return null;
  if (!isRecord(units)) return null;
  const { csvThickness, metadata: metadataUnit } = units;
  if (csvThickness !== "mm" && csvThickness !== "in" && csvThickness !== "mils") return null;
  if (metadataUnit !== "mm" && metadataUnit !== "in" && metadataUnit !== "mils") return null;
  if (!isRecord(metadata)) return null;
  if (!isRecord(summary)) return null;
  for (const key of ["total", "locations", "accept", "reCheck", "fail"]) {
    if (typeof summary[key] !== "number" || !Number.isFinite(summary[key])) return null;
  }
  if (!Array.isArray(readings) || !Array.isArray(indications)) return null;
  // 04-01: signOff — keep only when all four fields are non-empty strings;
  // anything else (missing key, null, wrong type, empty field) DEGRADES to
  // absent while the rest of the snapshot stays valid. Never throws.
  const rawSignOff = raw.signOff;
  if (isRecord(rawSignOff)) {
    const { name, certification, date, signature } = rawSignOff;
    const fields = [name, certification, date, signature];
    if (fields.every((f) => typeof f === "string" && f.length > 0)) {
      return {
        evaluatedAt,
        sourceName,
        units: { csvThickness, metadata: metadataUnit },
        metadata: metadata as unknown as ComponentMetadata,
        summary: summary as EvaluationResults["summary"],
        readings: readings as ReadingResult[],
        indications: indications as EvaluationResults["indications"],
        notes,
        signOff: { name, certification, date, signature } as ReportSignOff,
      };
    }
  }
  return {
    evaluatedAt,
    sourceName,
    units: { csvThickness, metadata: metadataUnit },
    metadata: metadata as unknown as ComponentMetadata,
    summary: summary as EvaluationResults["summary"],
    readings: readings as ReadingResult[],
    indications: indications as EvaluationResults["indications"],
    notes,
  };
}

/**
 * Pure read-modify-write helper (04-01): returns a NEW snapshot object with
 * the sign-off applied — the /report page persists sign-off edits through
 * this. Never mutates the input snapshot.
 */
export function withSignOff(
  snapshot: ReportSnapshot,
  signOff: ReportSignOff,
): ReportSnapshot {
  return { ...snapshot, signOff: { ...signOff } };
}

/**
 * Shared builder for the two write paths (03-00b Task 1): the auto-write
 * effect in the wizard root (keeps /report reviewable by direct URL) and the
 * Screen 3 "Save review" button. Returns null when no evaluation exists —
 * callers skip the write. evaluatedAt falls back to wall-clock when the UI
 * timestamp is absent (run-evaluation always sets it; defensive only).
 */
export function buildReportSnapshot(
  session: EvaluationSession,
  evaluatedAt: string | null,
): ReportSnapshot | null {
  if (!session.results) return null;
  return {
    evaluatedAt: evaluatedAt ?? new Date().toISOString(),
    sourceName: session.source.filename,
    units: session.units,
    metadata: session.metadata,
    summary: session.results.summary,
    readings: session.results.readings,
    indications: session.results.indications,
    notes: session.ptmt.notes,
  };
}

export function writeReportSnapshot(snapshot: ReportSnapshot): void {
  if (typeof sessionStorage === "undefined") return; // SSR/node safety: no-op
  try {
    sessionStorage.setItem(REPORT_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage full/unavailable: session-only convenience, never a failure.
  }
}

export function readReportSnapshot(): ReportSnapshot | null {
  if (typeof sessionStorage === "undefined") return null; // SSR/node safety
  try {
    const raw = sessionStorage.getItem(REPORT_SNAPSHOT_KEY);
    if (raw === null) return null;
    return parseSnapshot(JSON.parse(raw));
  } catch {
    return null; // corrupt payload or storage error → the route redirects home
  }
}
