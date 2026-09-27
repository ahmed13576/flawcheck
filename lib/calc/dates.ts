/**
 * Strict-ISO date math — all UTC, all deterministic, never `new Date(string)`
 * for user data (research Pitfall 1: `new Date('2026-02-31')` silently rolls
 * to 2026-03-03 and locale-prefixed strings pick up timezone offsets).
 *
 * Conventions pinned by golden case G13:
 * - Δt_years = UTC-day difference / 365.25 (research R5 convention)
 * - addYearsUtc: whole-year part via calendar arithmetic with a Feb 29 -> Feb
 *   28 clamp; fractional part as fraction * 365 days (research A2 convention,
 *   documented here as the module's pinned rule)
 */
import { roundTo } from "./round";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  // month is 1-based (as captured by the ISO regex: 01-12).
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

/** Strict `YYYY-MM-DD` parse with manual leap-aware component validation. */
export function parseIsoUtc(input: string): Date | null {
  const m = ISO_DATE_RE.exec(input);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoUtc(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Whole-day difference between two UTC dates (to - from). */
export function daysBetweenUtc(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/**
 * Δt_years = UTC-day difference / 365.25, rounded to 6 dp at the exit
 * (canonical-rounding policy R4). Pinned by G13: 3653 days -> 10.001369 yr.
 */
export function daysToYears(days: number): number {
  return roundTo(days / 365.25, 6);
}

/**
 * measurement date + interval years, anchored to the measurement date (never
 * Date.now — the engine stays time-independent and pure).
 */
export function addYearsUtc(dateIso: string, years: number): string {
  const parsed = parseIsoUtc(dateIso);
  if (!parsed) throw new Error(`invalid ISO date: ${dateIso}`);
  const whole = Math.trunc(years);
  const fraction = years - whole;
  const year = parsed.getUTCFullYear() + whole;
  let day = parsed.getUTCDate();
  // Feb 29 clamps to Feb 28 when the target year is not a leap year.
  if (parsed.getUTCMonth() === 1 && day === 29 && !isLeapYear(year)) day = 28;
  let out = new Date(Date.UTC(year, parsed.getUTCMonth(), day));
  if (fraction > 0) {
    out = new Date(out.getTime() + Math.round(fraction * 365) * MS_PER_DAY);
  }
  return formatIsoUtc(out);
}
