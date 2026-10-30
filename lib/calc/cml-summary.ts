import type { ReadingFlag, ReadingResult, Verdict } from "@/lib/ingest/session";
import { remainingLife } from "./remaining-life";
import { verdictBand } from "./verdicts";

export interface CmlSummaryRow {
  cmlId: string;
  scanCount: number;
  baselineMm: number;
  baselineDate: string;
  baselineReadingId: string;
  previousMm: number | null;
  previousDate: string | null;
  previousReadingId: string | null;
  latestMm: number;
  latestDate: string;
  latestReadingId: string;
  historicalMinimumMm: number;
  historicalMinimumDate: string;
  historicalMinimumReadingId: string;
  tPressureMm: number;
  tStructuralMm: number;
  tRequiredMm: number;
  validatedShortTermRateMmYr: number | null;
  validatedLongTermRateMmYr: number | null;
  governingRateMmYr: number;
  rawMaxRateMmYr: number;
  remainingLifeYears: number | null;
  flags: ReadingFlag[];
  disposition: Verdict;
  trace: string;
}

function cmlIdentity(reading: ReadingResult): string {
  return reading.cml ?? reading.location;
}

function naturalCmlKey(id: string): [string, number] {
  const tail = id.split("/").pop()?.trim() ?? id;
  const match = /^([A-Za-z]+)(\d+)$/.exec(tail);
  return match ? [match[1].toUpperCase(), Number(match[2])] : [tail.toUpperCase(), 0];
}

export function compareNaturalCmlId(a: string, b: string): number {
  const [aPrefix, aNum] = naturalCmlKey(a);
  const [bPrefix, bNum] = naturalCmlKey(b);
  return aPrefix.localeCompare(bPrefix) || aNum - bNum || a.localeCompare(b);
}

function mergeFlags(readings: ReadingResult[]): ReadingFlag[] {
  const active = new Set<ReadingFlag>();
  for (const reading of readings) {
    for (const flag of reading.flags) active.add(flag);
  }
  return [...active].sort();
}

function hasActiveQualityAnomaly(flags: ReadingFlag[]): boolean {
  return flags.some((flag) =>
    flag === "measurement_inconsistency" ||
    flag === "insufficient_interval" ||
    flag === "gauge_deadband" ||
    flag === "outlier",
  );
}

export function buildCmlSummaries(readings: ReadingResult[], gaugeUncertaintyMm = 0.1): CmlSummaryRow[] {
  const grouped = new Map<string, ReadingResult[]>();
  for (const reading of readings) {
    const id = cmlIdentity(reading);
    const list = grouped.get(id) ?? [];
    list.push(reading);
    grouped.set(id, list);
  }

  return [...grouped.entries()].map(([cmlId, cmlReadings]) => {
    const sorted = [...cmlReadings].sort((a, b) => a.date.localeCompare(b.date) || a.readingId.localeCompare(b.readingId));
    const baseline = sorted[0];
    const latest = sorted[sorted.length - 1];
    const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
    const historicalMinimum = [...sorted].sort((a, b) => a.tActualMm - b.tActualMm || a.date.localeCompare(b.date))[0];
    const flags = mergeFlags(sorted);
    const validatedShortTermRateMmYr = latest.crStMmYr;
    const validatedLongTermRateMmYr = latest.crLtMmYr;
    const governingRateMmYr = Math.max(0, ...sorted.map((r) => r.crGoverningMmYr ?? 0));
    const rawMaxRateMmYr = Math.max(0, ...sorted.flatMap((r) => [r.rawCrLtMmYr ?? 0, r.rawCrStMmYr ?? 0]));
    const remainingLifeYears = remainingLife(historicalMinimum.tActualMm, latest.tRequiredMm, governingRateMmYr);
    let disposition = verdictBand(historicalMinimum.tActualMm, latest.tRequiredMm, gaugeUncertaintyMm);
    if (disposition === "accept" && hasActiveQualityAnomaly(flags)) disposition = "re_check";
    const trace = sorted.map((r) => `${r.date}:${r.readingId}:${r.tActualMm.toFixed(2)}mm`).join(" | ");

    return {
      cmlId,
      scanCount: sorted.length,
      baselineMm: baseline.tActualMm,
      baselineDate: baseline.date,
      baselineReadingId: baseline.readingId,
      previousMm: previous?.tActualMm ?? null,
      previousDate: previous?.date ?? null,
      previousReadingId: previous?.readingId ?? null,
      latestMm: latest.tActualMm,
      latestDate: latest.date,
      latestReadingId: latest.readingId,
      historicalMinimumMm: historicalMinimum.tActualMm,
      historicalMinimumDate: historicalMinimum.date,
      historicalMinimumReadingId: historicalMinimum.readingId,
      tPressureMm: latest.tPressureMm,
      tStructuralMm: latest.tStructuralMm,
      tRequiredMm: latest.tRequiredMm,
      validatedShortTermRateMmYr,
      validatedLongTermRateMmYr,
      governingRateMmYr,
      rawMaxRateMmYr,
      remainingLifeYears,
      flags,
      disposition,
      trace,
    };
  }).sort((a, b) => compareNaturalCmlId(a.cmlId, b.cmlId));
}

export function topCriticalCmls(rows: CmlSummaryRow[], limit = 10): CmlSummaryRow[] {
  return [...rows].sort((a, b) =>
    a.historicalMinimumMm - b.historicalMinimumMm ||
    b.governingRateMmYr - a.governingRateMmYr ||
    b.rawMaxRateMmYr - a.rawMaxRateMmYr ||
    compareNaturalCmlId(a.cmlId, b.cmlId),
  ).slice(0, limit);
}
