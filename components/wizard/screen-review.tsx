"use client";

/**
 * Screen 2 — Data Review & Component Metadata (UI-SPEC Screen Layout
 * Contract), restyled per the Flowstep Screen 2 mock (03-00): hero card with
 * status chips (readings parsed / attention items / Sample data), the mapping
 * + parsed-rows + metadata + PT/MT cards (children), and the sticky footer
 * action bar: Back to ingest · step status · live blocker summary · Run
 * evaluation. State is preserved by construction (back-navigation never clears
 * the store). The blocker summary text (aria-live) and the Run Evaluation gate
 * are byte-identical to the Phase-2 contract.
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
  const attentionItems =
    blockers.rowErrors +
    blockers.unmappedRequired.length +
    blockers.metadataProblems.length +
    (blockers.unitsUndeclared ? 1 : 0);

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
      <div className="rounded-2xl border border-border bg-card p-8">
        <h1
          tabIndex={-1}
          data-screen-heading
          className="text-2xl font-semibold tracking-tight"
        >
          Review your inspection setup
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything looks ready for evaluation. Take a moment to confirm the highlighted
          assumptions.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
            {state.csv.rowCount.toLocaleString("en-US")} readings parsed
          </span>
          {attentionItems > 0 && (
            <span className="rounded-full bg-primary/15 px-3 py-1 text-xs text-primary">
              {attentionItems} attention {attentionItems === 1 ? "item" : "items"}
            </span>
          )}
          {state.source.isDemo && (
            <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
              Sample data
            </span>
          )}
        </div>
        {state.source.filename && (
          <p className="mt-3 text-xs text-muted-foreground">
            Register: {state.source.filename} · CSV thickness unit: {state.units.csvThickness}
          </p>
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

      <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border bg-card/95 px-1 py-3 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => dispatch({ type: "set-screen", screen: 1 })}
          className="rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Back to ingest
        </button>
        <span className="hidden text-xs text-muted-foreground lg:inline">
          Step 2 of 4 · Review complete when required fields are resolved
        </span>
        <div className="flex flex-wrap items-center gap-4">
          <p
            aria-live="polite"
            className="rounded-lg bg-primary/10 px-4 py-2 text-sm text-primary"
          >
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
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {state.ui.evaluating ? "Evaluating…" : "Run evaluation"}
          </button>
        </div>
      </div>
      {state.ui.evaluationError && (
        <p role="alert" className="mt-2 text-sm text-fail">
          Evaluation failed: {state.ui.evaluationError}. Check the review table and try again.
        </p>
      )}
    </section>
  );
}
