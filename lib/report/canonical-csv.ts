import { createHash } from "node:crypto";
import type { CmlSummaryRow } from "@/lib/calc/cml-summary";

export const CANONICAL_CSV_TRAILING_NEWLINE = true;

const HEADERS = [
  "CML_ID","Scan_Count","Baseline_mm","Baseline_Date","Baseline_Reading_ID","Previous_mm","Previous_Date","Previous_Reading_ID","Latest_mm","Latest_Date","Latest_Reading_ID","Historical_Minimum_mm","Historical_Minimum_Date","Historical_Minimum_Reading_ID","Pressure_Required_mm","Structural_Required_mm","Governing_Required_mm","Validated_Short_Term_Rate_mm_per_yr","Validated_Long_Term_Rate_mm_per_yr","Governing_Rate_mm_per_yr","Raw_Max_Rate_mm_per_yr","Remaining_Life_yr","Flags","Disposition","Trace",
] as const;

function csvEscape(value: string | number | null): string {
  if (value === null) return "";
  const text = typeof value === "number" ? value.toFixed(3) : value;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function cmlSummariesToCanonicalCsv(rows: CmlSummaryRow[]): string {
  const lines = [HEADERS.join(",")];
  for (const row of rows) {
    lines.push([
      row.cmlId,row.scanCount,row.baselineMm,row.baselineDate,row.baselineReadingId,row.previousMm,row.previousDate,row.previousReadingId,row.latestMm,row.latestDate,row.latestReadingId,row.historicalMinimumMm,row.historicalMinimumDate,row.historicalMinimumReadingId,row.tPressureMm,row.tStructuralMm,row.tRequiredMm,row.validatedShortTermRateMmYr,row.validatedLongTermRateMmYr,row.governingRateMmYr,row.rawMaxRateMmYr,row.remainingLifeYears,row.flags.join("|"),row.disposition,row.trace,
    ].map(csvEscape).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function canonicalCsvBytes(csv: string): Uint8Array {
  return new TextEncoder().encode(csv);
}

export function sha256HexFromCanonicalCsv(csv: string): string {
  return createHash("sha256").update(Buffer.from(canonicalCsvBytes(csv))).digest("hex");
}
