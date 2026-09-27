/**
 * Row validation — the loud-failure guarantee (ING-02). Two error spaces, two
 * numbering spaces (research R2):
 * - Parse errors (tokenization) are thrown as CsvParseError { line, problem }
 *   and render as `line {n} — {problem}` — physical file lines.
 * - Semantic row issues are COLLECTED DATA (RowIssue), never exceptions, and
 *   render in the locked pattern `Row {n}: {field} — {problem} ({value}).`
 *   where `row` is the 1-based data-row index in original file order.
 *
 * Every numeric cell passes the strict grammar first (never bare Number():
 * Number('') === 0, Number('0x1A') === 26, Number('Infinity') === Infinity —
 * all demonstrated traps); dates delegate to lib/calc parseIsoUtc (strict
 * ISO — future-dated readings are a WARNING, not an error).
 *
 * Zod at every parse boundary (house pattern): buildParsedRows validates the
 * row shape defensively; the row cap enforces the T-02-06 DoS budget loudly.
 */
import { z } from "zod";
import { buildCells } from "./csv";
import { parseIsoUtc } from "../calc/dates";
import type { ParsedRow, RowIssue, TargetField } from "./session";

export const MAX_ROWS = 50_000; // T-02-06: hard row cap before any heavy work
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // T-02-06: 5 MB hard cap

export class InputLimitError extends Error {}

/** Loud over-limit error — callers surface it in the error panel, never freeze. */
export function assertFileBytes(bytes: number): void {
  if (bytes > MAX_FILE_BYTES) {
    throw new InputLimitError(
      `File is too large (${(bytes / 1024 / 1024).toFixed(1)} MB). The limit is 5 MB.`,
    );
  }
}

export function assertRowCount(count: number): void {
  if (count > MAX_ROWS) {
    throw new InputLimitError(
      `File has ${count.toLocaleString("en-US")} data rows. The limit is ${MAX_ROWS.toLocaleString("en-US")}.`,
    );
  }
}

// --- zod schemas (house pattern: Zod at every parse boundary) ---------------

export const rowIssueSchema = z.object({
  row: z.number().int().min(1),
  field: z.string(),
  severity: z.enum(["error", "warning"]),
  message: z.string(),
});

export const parsedRowSchema = z.object({
  row: z.number().int().min(1),
  cells: z.record(z.string(), z.string()),
  issues: z.array(rowIssueSchema),
});

export type ParsedRowInput = z.infer<typeof parsedRowSchema>;

// --- strict numeric grammar (research R3 item 8) ----------------------------

const NUMERIC_CELL_RE = /^[+-]?(\d+(\.\d+)?|\.\d+)$/;

/**
 * Strict numeric parse: the grammar gates every coercion. Returns null for
 * anything that is not a plain decimal number — '0x1A', 'Infinity', '19,5'
 * and '19.5abc' can never become numbers here.
 */
export function parseNumericCell(raw: string): number | null {
  if (!NUMERIC_CELL_RE.test(raw)) return null;
  return Number(raw);
}

// --- row construction --------------------------------------------------------

/**
 * Build ParsedRow[] from tokenized records. Rows are 1-based data-row order
 * (physical file lines are the tokenizer's business — R2). Ragged rows are
 * loud: short rows yield blank trailing cells (missing-value errors follow
 * from validation); extra cells are preserved verbatim in the row's issue
 * list — never silently truncated.
 */
export function buildParsedRows(headers: string[], records: string[][]): ParsedRow[] {
  assertRowCount(records.length);
  return records.map((record, i) => {
    const row = i + 1;
    const issues: RowIssue[] = [];
    if (record.length > headers.length) {
      const extras = record.slice(headers.length);
      issues.push({
        row,
        field: "Columns",
        severity: "error",
        message: `${issuePrefix(row, "Columns")} ${record.length - headers.length} extra value(s) beyond the ${headers.length} header columns (${extras.join(", ")}).`,
      });
    }
    // cells keyed null-prototyped; trailing missing headers become "" so the
    // validation layer emits missing-value errors for mapped fields.
    return { row, cells: buildCells(headers, record), issues };
  });
}

// --- issue formatting (one formatter so the pattern can never drift) ---------

function issuePrefix(row: number, field: string): string {
  return `Row ${row}: ${field} —`;
}

function issue(row: number, field: string, problem: string, severity: "error" | "warning"): RowIssue {
  return { row, field, severity, message: `${issuePrefix(row, field)} ${problem}.` };
}

// --- the collector -----------------------------------------------------------

export interface ValidateOptions {
  /** Metadata outer diameter in canonical mm; 0 disables the thickness-vs-OD check. */
  odMm?: number;
  /** Today as YYYY-MM-DD (UTC) for the future-date WARNING; defaults to the real clock. */
  todayIso?: string;
}

const FIELD_LABELS = {
  readingId: "Reading ID",
  measuredThickness: "Measured thickness",
  measurementDate: "Measurement date",
  tInitial: "Initial thickness",
  tPrevious: "Previous thickness",
} as const;

function cellOf(row: ParsedRow, mapping: Record<TargetField, string | null>, field: TargetField): string {
  const header = mapping[field];
  return header ? row.cells[header] ?? "" : "";
}

/**
 * Collect semantic row issues for the mapped rows. Errors block Run
 * Evaluation; warnings (future date, duplicate ID) never block. The catalog
 * (UI-SPEC verbatim, one formatter):
 *   not a number ('{raw}')          ERROR
 *   missing value                   ERROR
 *   impossible value, must be greater than 0 ({v} mm)   ERROR
 *   impossible value, exceeds outer diameter ({v} mm)   ERROR
 *   not a valid date ('{raw}')      ERROR
 *   date is in the future           WARNING
 *   duplicate reading ID ('{id}')   WARNING
 */
export function rowIssues(
  rows: ParsedRow[],
  mapping: Record<TargetField, string | null>,
  options: ValidateOptions = {},
): RowIssue[] {
  const odMm = options.odMm ?? 0;
  const today = options.todayIso
    ? parseIsoUtc(options.todayIso)
    : parseIsoUtc(new Date().toISOString().slice(0, 10));

  const issues: RowIssue[] = [];
  const seenIds = new Set<string>();

  for (const row of rows) {
    // Structural ragged-row issues attach first (extra cells).
    issues.push(...row.issues);

    // Defensive boundary validation (Zod at the parse boundary).
    const shape = parsedRowSchema.safeParse(row);
    if (!shape.success) {
      issues.push(
        issue(row.row, "Row", `malformed row data (${shape.error.issues.length} problem(s))`, "error"),
      );
      continue;
    }

    // Thickness (required when mapped).
    const thicknessRaw = cellOf(row, mapping, "measuredThickness");
    let thicknessMm: number | null = null;
    if (thicknessRaw.trim() === "") {
      issues.push(issue(row.row, FIELD_LABELS.measuredThickness, "missing value", "error"));
    } else {
      const parsed = parseNumericCell(thicknessRaw);
      if (parsed === null) {
        issues.push(
          issue(row.row, FIELD_LABELS.measuredThickness, `not a number ('${thicknessRaw}')`, "error"),
        );
      } else {
        thicknessMm = parsed;
        if (thicknessMm <= 0) {
          issues.push(
            issue(
              row.row,
              FIELD_LABELS.measuredThickness,
              `impossible value, must be greater than 0 (${thicknessMm} mm)`,
              "error",
            ),
          );
        } else if (odMm > 0 && thicknessMm >= odMm) {
          issues.push(
            issue(
              row.row,
              FIELD_LABELS.measuredThickness,
              `impossible value, exceeds outer diameter (${odMm} mm)`,
              "error",
            ),
          );
        }
      }
    }

    // Measurement date (required when mapped).
    const dateRaw = cellOf(row, mapping, "measurementDate");
    let dateUtc: Date | null = null;
    if (dateRaw.trim() === "") {
      issues.push(issue(row.row, FIELD_LABELS.measurementDate, "missing value", "error"));
    } else {
      dateUtc = parseIsoUtc(dateRaw);
      if (!dateUtc) {
        issues.push(
          issue(row.row, FIELD_LABELS.measurementDate, `not a valid date ('${dateRaw}')`, "error"),
        );
      } else if (today && dateUtc.getTime() > today.getTime()) {
        issues.push(issue(row.row, FIELD_LABELS.measurementDate, "date is in the future", "warning"));
      }
    }

    // Reading ID (required when mapped) + case-sensitive duplicate WARNING.
    const idRaw = cellOf(row, mapping, "readingId");
    if (idRaw.trim() === "") {
      issues.push(issue(row.row, FIELD_LABELS.readingId, "missing value", "error"));
    } else {
      if (seenIds.has(idRaw)) {
        issues.push(
          issue(row.row, FIELD_LABELS.readingId, `duplicate reading ID ('${idRaw}')`, "warning"),
        );
      }
      seenIds.add(idRaw);
    }

    // Optional wide-format numeric columns — loud, never silently coerced.
    for (const field of ["tInitial", "tPrevious"] as const) {
      const raw = cellOf(row, mapping, field);
      if (raw.trim() === "") continue; // optional + absent is legal (CR degradation)
      if (parseNumericCell(raw) === null) {
        issues.push(issue(row.row, FIELD_LABELS[field], `not a number ('${raw}')`, "error"));
      }
    }
  }

  return issues;
}
