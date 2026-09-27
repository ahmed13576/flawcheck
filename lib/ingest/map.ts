/**
 * Column mapping — header normalization and auto-guess against the UI-SPEC
 * alias table (verbatim), plus CSV thickness-unit auto-guess from the header
 * suffix (ING-05: units are declared per input).
 *
 * Security note (T-02-08): this module reads parsed cells via an explicit
 * header list; cells arrive null-prototyped from csv.ts buildCells and
 * parsed header text is never spread into plain objects.
 */
import type { TargetField, Unit } from "./session";

/**
 * Lowercase and strip every non-alphanumeric character — so 'Reading_ID',
 * 'Measured-Thickness (mm)' and a BOM-prefixed '\ufeffTank' all normalize to
 * their bare alias forms.
 */
export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * UI-SPEC column-mapping alias table, verbatim (order matters — the first
 * alias with a matching header wins):
 *
 * | Field            | Required | Aliases                                                            |
 * |------------------|----------|--------------------------------------------------------------------|
 * | Reading ID       | yes      | readingid, id, pointid, cml, gridposition                          |
 * | Measured Thickness | yes    | measuredthicknessmm, measuredthickness, thickness, wallthickness, tactual |
 * | Measurement Date | yes      | measurementdate, date, inspectiondate                              |
 * | t-initial        | no       | originalscantlingmm, originalscantling, initialthickness, tinitial |
 * | t-previous       | no       | previousthickness, tprevious, lastthickness                        |
 * | Tank / Location  | no       | tank, location, component, cml                                     |
 */
const ALIASES: Array<{ field: TargetField; aliases: string[] }> = [
  {
    field: "readingId",
    aliases: ["readingid", "id", "pointid", "cml", "gridposition"],
  },
  {
    field: "measuredThickness",
    aliases: [
      "measuredthicknessmm",
      "measuredthickness",
      "thickness",
      "wallthickness",
      "tactual",
    ],
  },
  {
    field: "measurementDate",
    aliases: ["measurementdate", "date", "inspectiondate"],
  },
  {
    field: "tInitial",
    aliases: ["originalscantlingmm", "originalscantling", "initialthickness", "tinitial"],
  },
  {
    field: "tPrevious",
    aliases: ["previousthickness", "tprevious", "lastthickness"],
  },
  {
    field: "tank",
    aliases: ["tank", "location", "component", "cml"],
  },
];

const EMPTY_MAPPING: Record<TargetField, string | null> = {
  readingId: null,
  measuredThickness: null,
  measurementDate: null,
  tInitial: null,
  tPrevious: null,
  tank: null,
};

/**
 * Auto-guess a mapping from raw headers. Each field scans its aliases in
 * order and takes the first header whose normalized form matches; fields
 * with no match map to null (every dropdown stays overridable — UI-07).
 */
export function autoGuess(
  headers: string[],
): Record<TargetField, string | null> {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const mapping: Record<TargetField, string | null> = { ...EMPTY_MAPPING };
  for (const { field, aliases } of ALIASES) {
    for (const alias of aliases) {
      const hit = normalized.find((h) => h.norm === alias);
      if (hit) {
        mapping[field] = hit.raw;
        break;
      }
    }
  }
  return mapping;
}

/**
 * CSV thickness unit from the measured-thickness header suffix: _mm -> mm,
 * _in -> in, _mils -> mils; default mm when no suffix (or nothing mapped).
 */
export function csvThicknessUnitFromHeader(header: string | null): Unit {
  if (!header) return "mm";
  const norm = normalizeHeader(header);
  if (norm.endsWith("mils")) return "mils";
  if (norm.endsWith("in")) return "in";
  return "mm";
}
