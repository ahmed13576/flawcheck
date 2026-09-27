import { describe, it, expect } from "vitest";
import {
  addYearsUtc,
  daysBetweenUtc,
  daysToYears,
  parseIsoUtc,
} from "@/lib/calc/dates";

describe("dates — G13 day-difference convention", () => {
  it("2015-01-15 -> 2025-01-15 = 3653 UTC days = 10.001369 yr", () => {
    const from = parseIsoUtc("2015-01-15")!;
    const to = parseIsoUtc("2025-01-15")!;
    expect(daysBetweenUtc(from, to)).toBe(3653);
    expect(daysToYears(3653)).toBe(10.001369);
  });

  it("2024-01-15 -> 2025-01-15 = 366 days (leap year) = 1.002053 yr", () => {
    const from = parseIsoUtc("2024-01-15")!;
    const to = parseIsoUtc("2025-01-15")!;
    expect(daysBetweenUtc(from, to)).toBe(366);
    expect(daysToYears(366)).toBe(1.002053);
  });
});

describe("dates — strict ISO validation (Pitfall 1: never new Date(string))", () => {
  it("rejects '2026-02-31' (would silently roll over to 2026-03-03)", () => {
    expect(parseIsoUtc("2026-02-31")).toBeNull();
  });
  it("rejects '31/02/2026' (non-ISO format)", () => {
    expect(parseIsoUtc("31/02/2026")).toBeNull();
  });
  it("accepts leap day 2024-02-29", () => {
    expect(parseIsoUtc("2024-02-29")).not.toBeNull();
  });
  it("rejects 2023-02-29 (not a leap year)", () => {
    expect(parseIsoUtc("2023-02-29")).toBeNull();
  });
  it("rejects empty and partial strings", () => {
    expect(parseIsoUtc("")).toBeNull();
    expect(parseIsoUtc("2026-02")).toBeNull();
    expect(parseIsoUtc("2026-13-01")).toBeNull();
  });
});

describe("dates — addYearsUtc (research A2 convention, documented in the module)", () => {
  it("Feb 29 + 1 year clamps to Feb 28", () => {
    expect(addYearsUtc("2024-02-29", 1)).toBe("2025-02-28");
  });
  it("whole-year part is calendar arithmetic (month/day preserved)", () => {
    expect(addYearsUtc("2015-01-15", 10)).toBe("2025-01-15");
  });
  it("fractional part is fraction * 365 days after the calendar whole years", () => {
    // 2.5 years from 2025-01-15: whole 2 -> 2027-01-15; 0.5 * 365 = 183 days -> 2027-07-17
    expect(addYearsUtc("2025-01-15", 2.5)).toBe("2027-07-17");
  });
  it("next-inspection anchoring: measurement date + interval, never Date.now", () => {
    // G5 shape: measurement 2025-01-15 + Class-1 interval 5.00 yr
    expect(addYearsUtc("2025-01-15", 5)).toBe("2030-01-15");
  });
});
