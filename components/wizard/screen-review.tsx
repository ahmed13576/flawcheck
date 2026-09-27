"use client";

/**
 * Screen 2 — Data Review & Component Metadata (UI-SPEC Screen Layout
 * Contract): session summary bar, column mapping panel, paginated parsed-row
 * table, metadata sections (children), and the sticky footer action bar with
 * the validation summary + Run Evaluation gate. State is preserved by
 * construction (back-navigation never clears the store).
 */
import { useCallback, type ReactNode } from "react";
import { blockingChecks, hasBlockers } from "@/lib/wizard/reducer";
import { useWizard } from "@/components/wizard/wizard-context";
import { ColumnMappingPanel } from "@/components/wizard/column-mapping-panel";
import { ParsedRowTable } from "@/components/wizard/parsed-row-table";
import type { TargetField, Unit } from "@/lib/ingest/session";

function blockerSummary(parts: {
  rowErrors: number;
  unmapped: number;
  metadataProblems: number;
  unitsUndeclared: boolean;
}): string {
  const segments: string[] = [];
  if (parts.rowErrors > 0) {
    segments.push(
      `${parts.rowErrors} row ${parts.rowErrors === 1 ? "error" : "errors"}`,
    );
  }
  if (parts.unmapped > 0) {
    segments.push(
      `${parts.unmapped} unmapped ${parts.unmapped === 1 ? "column" : "columns"}`,
    );
  }
  if (parts.metadataProblems > 0) {
    segments.push(
      `${parts.metadataProblems} metadata ${parts.metadataProblems === 1 ? "problem" : "problems"}`,
    );
  }
  if (parts.unitsUndeclared) {
    segments.push("units not declared");
  }
  return segments.length > 0 ? segments.join(" · ") : "All checks passed";
}

export function ScreenReview({ children }: { children?: ReactNode }) {
  const { state, dispatch } = useWizard();
  const blockers = blockingChecks(state);
  const gated = hasBlockers(blockers);

  const handleMap = useCallback(
    (field: TargetField, header: string | null) =>
      dispatch({ type: "set-mapping", field, header }),
    [dispatch],
  );
  const handleEditCell = useCallback(
    (row: number, header: string, value: string) =>
      dispatch({ type: "set-row-cell", row, header, value }),
    [dispatch],
  );
  const handlePage = useCallback(
    (page: number) => dispatch({ type: "set-page", page }),
    [dispatch],
  );
  const handleCsvUnit = useCallback(
    (unit: Unit) => dispatch({ type: "set-csv-thickness-unit", unit }),
    [dispatch],
  );

  return (
    <section aria-label="Screen 2 — Review & Metadata">
      <h1 tabIndex={-1} data-screen-heading className="text-xl font-semibold">
        Review & metadata
      </h1>

      <div className="mt-6 rounded-lg border border-[#262626] bg-[#171717] p-4 text-sm">
        <span className="font-semibold">{state.source.filename || "Loaded data"}</span>
        <span className="text-[#a3a3a3]"> · </span>
        <span>{state.csv.rowCount.toLocaleString("en-US")} rows</span>
        <span className="text-[#a3a3a3]"> · </span>
        <span>CSV thickness unit: {state.units.csvThickness}</span>
        {state.source.isDemo && (
          <span className="ml-2 inline-flex h-6 items-center rounded border border-gray-600 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            sample data
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <ColumnMappingPanel
          headers={state.csv.headers}
          mapping={state.mapping}
          units={state.units}
          onMap={handleMap}
          onCsvThicknessUnit={handleCsvUnit}
        />
        <ParsedRowTable
          rows={state.rows}
          rowCount={state.csv.rowCount}
          page={state.ui.page}
          mapping={state.mapping}
          issues={state.ui.rowIssues}
          onEditCell={handleEditCell}
          onPageChange={handlePage}
        />
        {children}
      </div>

      <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#262626] bg-[#0a0a0a] px-1 py-3">
        <p aria-live="polite" className="text-sm text-[#a3a3a3]">
          {blockerSummary({
            rowErrors: blockers.rowErrors,
            unmapped: blockers.unmappedRequired.length,
            metadataProblems: blockers.metadataProblems.length,
            unitsUndeclared: blockers.unitsUndeclared,
          })}
        </p>
        <button
          type="button"
          disabled={gated || state.ui.evaluating}
          onClick={() => {
            dispatch({ type: "evaluation-start" });
            // Yield a frame so Evaluating… paints before the sync compute.
            setTimeout(() => dispatch({ type: "run-evaluation" }), 30);
          }}
          className="rounded bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {state.ui.evaluating ? "Evaluating…" : "Run Evaluation"}
        </button>
      </div>
      {state.ui.evaluationError && (
        <p role="alert" className="mt-2 text-sm text-[#f87171]">
          Evaluation failed: {state.ui.evaluationError}. Check the review table and try again.
        </p>
      )}
    </section>
  );
}
