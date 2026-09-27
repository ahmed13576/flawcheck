/**
 * Outlier detection per CML population — modified z-score (median/MAD),
 * Iglewicz-Hoaglin. CALC-04 lives in REQUIREMENTS, not in the criteria JSON:
 * statistical QC is engineering code, while code-acceptance rules stay in
 * lib/criteria/*.json (open question OQ4 resolution). The z threshold is a
 * named exported constant here — the only place it exists.
 *
 * Population rule: n >= 4 readings required; MAD === 0 (degenerate population)
 * yields no flags; outliers warn — they never override the verdict banding
 * (UI-18).
 */
import { roundTo } from "./round";

/** Iglewicz-Hoaglin recommended threshold on |modified z|. OQ4: engineering code, not criteria JSON. */
export const OUTLIER_Z_THRESHOLD = 3.5;

/** Iglewicz-Hoaglin consistency constant for the normal distribution. */
const MAD_SCALE = 0.6745;

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface ModifiedZResult {
  scores: number[]; // signed modified z per input value, 4 dp canonical
  median: number;
  mad: number;
}

export function modifiedZScores(values: number[]): ModifiedZResult {
  const med = median(values);
  const madRaw = median(values.map((v) => Math.abs(v - med)));
  // Degenerate population (MAD 0): no spread information — scores of 0, no flags.
  const scores =
    madRaw === 0
      ? values.map(() => 0)
      : values.map((v) => roundTo((MAD_SCALE * (v - med)) / madRaw, 4));
  // Canonical rounding at the public exit (R4): the surfaced MAD is a
  // thickness-scale quantity — 6 dp removes the |a-b| subtraction drift
  // (e.g. |9.19 - 9.2| -> 0.009999999999997868 -> 0.01) without ever
  // disturbing the score arithmetic, which rounds at its own exit.
  return { scores, median: med, mad: roundTo(madRaw, 6) };
}

export interface OutlierHistoryReading {
  id: string;
  value: number;
}

export interface OutlierFlag extends OutlierHistoryReading {
  z: number;
  median: number;
  mad: number;
}

/**
 * Flag re-shoot candidates in one CML's thickness population. Populations
 * smaller than 4 readings never flag; MAD 0 never flags; |z| strictly above
 * the threshold flags. Signed z is surfaced (detail display may show |z|).
 */
export function flagOutliers(history: OutlierHistoryReading[]): OutlierFlag[] {
  if (history.length < 4) return [];
  const { scores, median: med, mad } = modifiedZScores(history.map((h) => h.value));
  if (mad === 0) return [];
  const flagged: OutlierFlag[] = [];
  history.forEach((reading, i) => {
    if (Math.abs(scores[i]) > OUTLIER_Z_THRESHOLD) {
      flagged.push({ ...reading, z: scores[i], median: med, mad });
    }
  });
  return flagged;
}
