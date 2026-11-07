/**
 * Pure adapters from evaluation results to geometry-engine inputs — Phase 09.
 *
 * These functions do grouping/selection/mapping only. Every thickness,
 * t_required, corrosion-rate, and verdict value flows through VERBATIM from
 * lib/calc evaluate() output; no engineering arithmetic happens here. Shared
 * by the web analytics host (components/wizard/screen-results.tsx) and the
 * PDF report (components/report/pdf-document.tsx).
 */
import type { TrendPoint, CmlHeatmapItem, FanSeries } from "@/lib/analytics/geometry";
import type { ReadingResult, Verdict } from "@/lib/ingest/session";
import { buildCmlSummaries, topCriticalCmls } from "@/lib/calc/cml-summary";

/** Severity order for picking the trend's governing CML: reject > re-check > accept. */
export function severityRank(verdict: Verdict): number {
  if (verdict === "reject") return 0;
  if (verdict === "re_check") return 1;
  return 2;
}

/** Identity used to group readings to one CML (tank + grid when present). */
export function cmlIdentity(r: ReadingResult): string {
  return r.cml ?? r.location;
}

/**
 * Picks the governing CML (worst latest verdict, ties by lowest safety
 * margin) and returns its full (date, thickness) history sorted by date,
 * plus its t_required and governing CR — all precomputed engine outputs.
 */
export function buildGoverningTrendPoints(
  readings: ReadingResult[],
): {
  points: TrendPoint[];
  cmlId: string;
  crGoverningMmYr: number | null;
  tRequiredMm: number;
} {
  if (readings.length === 0) {
    return { points: [], cmlId: "", crGoverningMmYr: null, tRequiredMm: 0 };
  }

  // Latest reading per CML identity.
  const latest = new Map<string, ReadingResult>();
  for (const r of readings) {
    const id = cmlIdentity(r);
    const current = latest.get(id);
    if (!current || r.date > current.date) latest.set(id, r);
  }

  const rank = (v: Verdict) => severityRank(v);
  const margin = (r: ReadingResult) =>
    r.tRequiredMm > 0 ? (r.tActualMm - r.tRequiredMm) / r.tRequiredMm : Number.POSITIVE_INFINITY;

  const latestList = [...latest.values()].sort((a, b) => {
    const rankDiff = rank(a.verdict) - rank(b.verdict);
    if (rankDiff !== 0) return rankDiff;
    return margin(a) - margin(b);
  });

  const worst = latestList[0];
  const identity = cmlIdentity(worst);
  const points = readings
    .filter((r) => cmlIdentity(r) === identity)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ date: r.date, thicknessMm: r.tActualMm }));

  return {
    points,
    cmlId: identity,
    crGoverningMmYr: worst.crGoverningMmYr,
    tRequiredMm: worst.tRequiredMm,
  };
}

/**
 * Phase 09 fan-plot adapter: the `limit` most limiting CMLs (the existing
 * topCriticalCmls selection — historical minimum first), each with its FULL
 * date-ordered (date, thickness) history plus the precomputed t_required and
 * governing rate from its CmlSummaryRow. Grouping uses the same identity as
 * everywhere else (r.cml ?? r.location); zero grouping/selection arithmetic
 * beyond topCriticalCmls itself.
 */
export function buildLimitingSeries(readings: ReadingResult[], limit = 5): FanSeries[] {
  const rows = buildCmlSummaries(readings);
  return topCriticalCmls(rows, limit).map((row) => ({
    cmlId: row.cmlId,
    points: readings
      .filter((r) => cmlIdentity(r) === row.cmlId)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({ date: r.date, thicknessMm: r.tActualMm })),
    tRequiredMm: row.tRequiredMm,
    governingRateMmYr: row.governingRateMmYr,
  }));
}

/**
 * Reduces readings to one item per CML identity (latest reading wins) and
 * assigns row-major grid coordinates — the heatmap's precomputed input.
 */
export function buildLatestPerCml(readings: ReadingResult[]): CmlHeatmapItem[] {
  const rows = buildCmlSummaries(readings);
  // Preserve the WBT-S6 A-D by 1-10 orientation where present; fall back to
  // row-major order for other IDs. Historical minimum governs disposition.
  return rows.map((row, i) => {
    const tail = row.cmlId.split("/").pop()?.trim() ?? row.cmlId;
    const match = /^([A-D])(\d{1,2})$/.exec(tail);
    const x = match ? Number(match[2]) : (i % 10) + 1;
    const y = match ? "ABCD".indexOf(match[1]) + 1 : Math.floor(i / 10) + 1;
    return {
      cmlId: row.cmlId,
      x,
      y,
      tActualMm: row.historicalMinimumMm,
      tRequiredMm: row.tRequiredMm,
      verdict: row.disposition,
      crMmYr: row.governingRateMmYr,
    };
  });
}
