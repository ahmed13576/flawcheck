/**
 * Results formatting helpers (pure, node-testable). The UI-SPEC locks the
 * precision per column — thickness 2 dp, rates 3 dp, years 1 dp — and the
 * degradation contract: null renders '—', and the strings Infinity/NaN can
 * never reach the DOM (a non-finite leak degrades to '—' instead, asserted by
 * the render-scan in tests/wizard/results.test.ts).
 */
import type { ReadingResult } from "@/lib/ingest/session";

export type ResultsDp = 1 | 2 | 3;

/** Fixed-precision formatter; non-finite degrades to '—' (never Infinity/NaN). */
export function formatFixed(value: number | null, dp: ResultsDp): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(dp);
}

/** Caption composition for the paginated tables: 'Showing 1–50 of 4,912'. */
export function formatCaption(start: number, end: number, total: number): string {
  return `Showing ${start.toLocaleString("en-US")}–${end.toLocaleString("en-US")} of ${total.toLocaleString("en-US")}`;
}

/** Measurement date renders as the stored ISO YYYY-MM-DD. */
export function formatReadingDate(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * 'evaluated {YYYY-MM-DD HH:mm} UTC' — the UI captures the timestamp at run
 * time. IN-07: the rendered clock is UTC wall-clock, so it carries an explicit
 * ' UTC' marker — a UTC+5:30 user must not read it as their local time.
 */
export function formatEvaluatedAt(iso: string): string {
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

/**
 * G14 immediate-inspection vs dated-interval vs honest-dash cell model.
 * immediate_inspection (RL <= 0 with a valid positive CR) renders the
 * fail-tone 'Immediate inspection required' — never a date, a past date, or a
 * negative interval. insufficient-history renders '—' + the muted sub-text.
 */
export type NextInspectionCell =
  | { kind: "immediate" }
  | { kind: "date"; date: string; intervalYears: number }
  | { kind: "dash"; subText?: string };

export function nextInspectionCell(
  reading: Pick<ReadingResult, "flags" | "nextInspection">,
): NextInspectionCell {
  if (reading.flags.includes("immediate_inspection")) return { kind: "immediate" };
  if (reading.nextInspection) {
    return {
      kind: "date",
      date: formatReadingDate(reading.nextInspection.date),
      intervalYears: reading.nextInspection.intervalYears,
    };
  }
  return {
    kind: "dash",
    subText: reading.flags.includes("insufficient_history")
      ? "insufficient corrosion history"
      : undefined,
  };
}

/** RL cell model: '—' (+ sub-text when insufficient) or the 1-dp years (or 0.0 with RETIRED / IMMEDIATE ACTION). */
export function rlCell(
  reading: Pick<ReadingResult, "rlYears" | "flags">,
): { kind: "dash"; subText?: string } | { kind: "years"; text: string; subText?: string } {
  if (reading.rlYears === null || !Number.isFinite(reading.rlYears)) {
    return {
      kind: "dash",
      subText: reading.flags.includes("insufficient_history")
        ? "insufficient corrosion history"
        : undefined,
    };
  }
  if (reading.rlYears <= 0) {
    return {
      kind: "years",
      text: "0.0",
      subText: "RETIRED / IMMEDIATE ACTION",
    };
  }
  return { kind: "years", text: formatFixed(reading.rlYears, 1) };
}

/** Formats flag into an uppercase human-readable label; ensures immediate_inspection is never raw snake_case. */
export function formatFlagLabel(flag: string): string {
  if (flag === "immediate_inspection") return "IMMEDIATE INSPECTION REQUIRED";
  if (flag === "measurement_inconsistency") return "MEASUREMENT INCONSISTENCY";
  if (flag === "insufficient_history") return "INSUFFICIENT HISTORY";
  if (flag === "outlier") return "OUTLIER";
  return flag.toUpperCase().replace(/_/g, " ");
}
