/**
 * Long-format CML grouping (research R6) — the ingest->calc seam. The Zenodo
 * register is one row per reading per annual campaign (~447 CMLs x ~11
 * campaigns): group valid rows by CML identity (mapped Tank + a
 * grid-position column when present; Reading_ID fallback when Tank is
 * unmapped), sort each group by parsed date ascending (stable), and derive
 * per reading i:
 *   t_initial  = group[0].thickness      (null for the first campaign)
 *   t_previous = group[i-1].thickness    (null for the first campaign)
 *   dtLt/dtSt  = daysToYears(day gaps)   (365.25 convention, G13)
 *
 * Identity semantics (pinned by the UI-SPEC demo line "4,912 readings · 12
 * locations"): `location` is the mapped Tank (the summary's location count);
 * `cml` is the tank + grid-position identity (the fixed measurement point —
 * the campaign history group and the per-CML outlier population).
 *
 * Wide-format gauge exports: when the t-initial/t-previous columns ARE
 * mapped, their values take precedence over the derived thickness values
 * (the Δt years remain date-derived — the wide columns carry no dates).
 *
 * Unmapped Tank: every row is its own CML with null history — verdicts still
 * compute (CR-degradation policy). First-campaign readings carry no history
 * (OQ3 accepted: ~9% of demo rows show INSUFFICIENT HISTORY).
 *
 * ING-05: CSV thickness cells are declared in units.csvThickness and
 * converted to canonical mm with the exact constants at this seam — the
 * engine consumes mm only.
 */
import { daysBetweenUtc, daysToYears, parseIsoUtc } from "../calc/dates";
import { toMm } from "../calc/units";
import { normalizeHeader } from "./map";
import { parseNumericCell } from "./validate";
import type { EvaluationInput, ParsedRow, TargetField, Unit } from "./session";

export interface GroupOptions {
  /** Declared unit of the CSV thickness column (converted to canonical mm here). */
  csvThicknessUnit: Unit;
  /**
   * Column holding the grid position (the second half of the CML identity).
   * Detected from the rows when omitted; null disables the tank+grid key.
   */
  gridPositionColumn?: string | null;
}

function detectGridPositionColumn(rows: ParsedRow[]): string | null {
  const first = rows[0];
  if (!first) return null;
  return (
    Object.keys(first.cells).find((header) => normalizeHeader(header) === "gridposition") ??
    null
  );
}

function cellOf(row: ParsedRow, header: string | null | undefined): string {
  return header ? row.cells[header] ?? "" : "";
}

function thicknessMmOf(
  row: ParsedRow,
  header: string | null,
  unit: Unit,
): number | null {
  const raw = cellOf(row, header).trim();
  const parsed = parseNumericCell(raw);
  return parsed === null ? null : toMm(parsed, unit);
}

export function groupByCml(
  validRows: ParsedRow[],
  mapping: Record<TargetField, string | null>,
  options: GroupOptions,
): EvaluationInput[] {
  const gridPositionColumn =
    options.gridPositionColumn === undefined
      ? detectGridPositionColumn(validRows)
      : options.gridPositionColumn;

  const groups = new Map<string, ParsedRow[]>();
  for (const row of validRows) {
    const tankValue = cellOf(row, mapping.tank);
    const readingIdValue = cellOf(row, mapping.readingId) || `row-${row.row}`;
    // Tank unmapped -> each row is its own CML (fall back to Reading_ID).
    const identity = tankValue
      ? `${tankValue}|${gridPositionColumn ? cellOf(row, gridPositionColumn) : ""}`
      : readingIdValue;
    const list = groups.get(identity) ?? [];
    list.push(row);
    groups.set(identity, list);
  }

  const inputs: EvaluationInput[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => {
      const da = parseIsoUtc(cellOf(a, mapping.measurementDate))?.getTime() ?? 0;
      const db = parseIsoUtc(cellOf(b, mapping.measurementDate))?.getTime() ?? 0;
      return da - db; // Array.sort is stable — equal dates keep file order
    });

    sorted.forEach((row, i) => {
      const dateStr = cellOf(row, mapping.measurementDate);
      const d0 = parseIsoUtc(cellOf(sorted[0], mapping.measurementDate));
      const dPrev = i > 0 ? parseIsoUtc(cellOf(sorted[i - 1], mapping.measurementDate)) : null;
      const tActual = thicknessMmOf(row, mapping.measuredThickness, options.csvThicknessUnit);

      // Wide-format mapped columns take precedence over derived history.
      const mappedInitial = thicknessMmOf(row, mapping.tInitial, options.csvThicknessUnit);
      const mappedPrevious = thicknessMmOf(row, mapping.tPrevious, options.csvThicknessUnit);
      const derivedInitial =
        i === 0 ? null : thicknessMmOf(sorted[0], mapping.measuredThickness, options.csvThicknessUnit);
      const derivedPrevious =
        i === 0
          ? null
          : thicknessMmOf(sorted[i - 1], mapping.measuredThickness, options.csvThicknessUnit);
      const tInitial = mappedInitial ?? derivedInitial;
      const tPrevious = mappedPrevious ?? derivedPrevious;

      const tankValue = cellOf(row, mapping.tank);
      const readingIdValue = cellOf(row, mapping.readingId) || `row-${row.row}`;
      const gridValue = gridPositionColumn ? cellOf(row, gridPositionColumn) : "";

      inputs.push({
        readingId: readingIdValue,
        // location = tank (the summary's location count); Reading_ID fallback.
        location: tankValue || readingIdValue,
        // cml = tank + grid identity (the fixed point: history group + outlier population).
        cml: tankValue && gridValue ? `${tankValue} / ${gridValue}` : tankValue || readingIdValue,
        date: dateStr,
        tActualMm: tActual ?? Number.NaN,
        tInitialMm: tInitial,
        tPreviousMm: tPrevious,
        dtLtYears: i === 0 || !d0 || tInitial === null ? null : daysToYears(daysBetweenUtc(d0, parseIsoUtc(dateStr)!)),
        dtStYears:
          i === 0 || !dPrev || tPrevious === null
            ? null
            : daysToYears(daysBetweenUtc(dPrev, parseIsoUtc(dateStr)!)),
      });
    });
  }
  return inputs;
}
