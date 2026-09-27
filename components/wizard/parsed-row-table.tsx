"use client";

/**
 * Parsed-row table — Screen 2 region 4 (UI-09, UI-13), restyled per the
 * Flowstep Screen 2 mock (03-00). Real <table> with <th scope="col">;
 * paginated exactly 50 rows/page with the caption 'Showing 1–50 of {rowCount}'
 * — pagination by slicing (useMemo page slice + memoized row component), never
 * rendering all rows (research Pitfall 8, no virtualization dependency). First
 * columns = mapped identity fields as inline editable inputs; last column =
 * per-row status badge (token variants: fail family / recheck family).
 * Error rows: fail badge + border-l-2 border-l-fail/60; warning rows: recheck
 * badge, non-blocking; valid rows: no badge. Badges use lib/ingest RowIssue
 * messages verbatim, linked to the offending cell via aria-describedby +
 * aria-invalid. The mock's attention alert counts unique error rows.
 */
import { memo, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import type { ParsedRow, RowIssue, TargetField } from "@/lib/ingest/session";
import { FlagBadge } from "@/components/wizard/flag-badge";

export const PAGE_SIZE = 50;

const COLUMN_FIELDS: TargetField[] = [
  "readingId",
  "tank",
  "measuredThickness",
  "measurementDate",
  "tInitial",
  "tPrevious",
];

const RowTr = memo(function RowTr({
  row,
  columns,
  issues,
  onEditCell,
}: {
  row: ParsedRow;
  columns: Array<{ field: TargetField; header: string }>;
  issues: RowIssue[];
  onEditCell: (row: number, header: string, value: string) => void;
}) {
  const hasError = issues.some((issue) => issue.severity === "error");
  return (
    <tr
      className={`bg-background ${hasError ? "border-l-2 border-l-fail/60" : ""}`}
    >
      <td className="whitespace-nowrap border border-border px-3 py-2 font-mono tabular-nums">
        {row.row}
      </td>
      {columns.map(({ field, header }) => {
        const cellIssues = issues.filter((issue) => cellMatchesField(issue, field));
        const invalid = cellIssues.some((issue) => issue.severity === "error");
        const describedBy = cellIssues
          .map((issue) => `row-${row.row}-issue-${issues.indexOf(issue)}`)
          .join(" ");
        return (
          <td key={field} className="border border-border px-2 py-1">
            <input
              type="text"
              value={row.cells[header] ?? ""}
              aria-label={header}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy || undefined}
              onChange={(event) => onEditCell(row.row, header, event.target.value)}
              className={`w-full min-w-24 rounded border bg-transparent px-2 py-1 text-sm ${
                invalid ? "border-fail/50" : "border-transparent hover:border-border"
              } font-mono tabular-nums whitespace-nowrap`}
            />
          </td>
        );
      })}
      <td className="border border-border px-3 py-2">
        {issues.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-col gap-1">
            {issues.map((issue, index) => (
              <div key={index} className="flex flex-col gap-0.5">
                <FlagBadge
                  label={issue.severity === "error" ? "ERROR" : "WARNING"}
                  tone={issue.severity === "error" ? "error" : "warning"}
                />
                <span
                  id={`row-${row.row}-issue-${index}`}
                  className={`text-xs ${issue.severity === "error" ? "text-fail" : "text-recheck"}`}
                >
                  {issue.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
});

/** RowIssue.field carries the UI label ('Measured thickness'); map it back. */
function cellMatchesField(issue: RowIssue, field: TargetField): boolean {
  switch (field) {
    case "measuredThickness":
      return issue.field === "Measured thickness";
    case "measurementDate":
      return issue.field === "Measurement date";
    case "readingId":
      return issue.field === "Reading ID";
    case "tInitial":
      return issue.field === "Initial thickness";
    case "tPrevious":
      return issue.field === "Previous thickness";
    default:
      return false;
  }
}

export function ParsedRowTable({
  rows,
  rowCount,
  page,
  mapping,
  issues,
  onEditCell,
  onPageChange,
}: {
  rows: ParsedRow[];
  rowCount: number;
  page: number;
  mapping: Record<TargetField, string | null>;
  issues: RowIssue[];
  onEditCell: (row: number, header: string, value: string) => void;
  onPageChange: (page: number) => void;
}) {
  const columns = useMemo(
    () =>
      COLUMN_FIELDS.filter((field) => mapping[field]).map((field) => ({
        field,
        header: mapping[field]!,
      })),
    [mapping],
  );

  const pageCount = Math.max(1, Math.ceil(rowCount / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, safePage]);

  const issuesByRow = useMemo(() => {
    const map = new Map<number, RowIssue[]>();
    for (const issue of issues) {
      const list = map.get(issue.row) ?? [];
      list.push(issue);
      map.set(issue.row, list);
    }
    return map;
  }, [issues]);

  const errorRowCount = useMemo(
    () =>
      new Set(
        issues.filter((issue) => issue.severity === "error").map((issue) => issue.row),
      ).size,
    [issues],
  );

  const start = (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, rowCount);

  return (
    <section aria-label="Parsed rows" className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 border-b border-primary/40 pb-4">
        <h2 className="text-lg font-semibold">Parsed readings</h2>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="px-1 pb-2 text-left text-xs text-muted-foreground">
            Showing {start.toLocaleString("en-US")}–{end.toLocaleString("en-US")} of{" "}
            {rowCount.toLocaleString("en-US")}
          </caption>
          <thead>
            <tr className="bg-secondary text-left">
              <th scope="col" className="border border-border px-3 py-2">
                Row
              </th>
              {columns.map(({ field, header }) => (
                <th key={field} scope="col" className="border border-border px-3 py-2">
                  {header}
                </th>
              ))}
              <th scope="col" className="border border-border px-3 py-2">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {pageSlice.map((row) => (
              <RowTr
                key={row.row}
                row={row}
                columns={columns}
                issues={issuesByRow.get(row.row) ?? []}
                onEditCell={onEditCell}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="rounded-md border border-border px-3 py-1.5 font-medium hover:bg-secondary disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-xs text-muted-foreground">
          Page {safePage.toLocaleString("en-US")} of {pageCount.toLocaleString("en-US")}
        </span>
        <button
          type="button"
          disabled={safePage >= pageCount}
          onClick={() => onPageChange(safePage + 1)}
          className="rounded-md border border-border px-3 py-1.5 font-medium hover:bg-secondary disabled:opacity-50"
        >
          Next
        </button>
      </div>
      {errorRowCount > 0 && (
        <div
          role="alert"
          className="mt-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4"
        >
          <AlertTriangle className="size-5 text-primary" aria-hidden="true" />
          <span className="text-sm text-primary">
            {errorRowCount === 1
              ? "1 row needs attention before evaluation."
              : `${errorRowCount} rows need attention before evaluation.`}
          </span>
        </div>
      )}
    </section>
  );
}
