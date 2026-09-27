"use client";

/**
 * Screen 3 — Evaluation Results, read-only (UI-SPEC Screen Layout Contract):
 * summary strip, paginated CML results table, PT/MT triage cards, footnotes.
 * Container widens to max-w-6xl (handled by the wizard root). Zero-result
 * edge (UI-15): an empty readings array renders the results empty-state copy,
 * never a bare table shell. Demo provenance banner persists (UI-21, rendered
 * by the wizard root); focus lands on this screen's heading (UI-22).
 */
import { useWizard } from "@/components/wizard/wizard-context";
import { SummaryStrip } from "@/components/wizard/summary-strip";
import { ResultsTable } from "@/components/wizard/results-table";
import { PtmtTriageList } from "@/components/wizard/ptmt-triage-list";
import { formatEvaluatedAt } from "@/lib/wizard/format";

const UNIT_ASSUMPTION_COPY =
  "Units: CSV thickness in {csv}, metadata in {meta}. All values converted to mm (canonical).";

export function ScreenResults() {
  const { state, dispatch } = useWizard();
  const results = state.results;

  return (
    <section aria-label="Screen 3 — Results">
      <h1 tabIndex={-1} data-screen-heading className="text-xl font-semibold">
        Results
      </h1>

      {!results || results.readings.length === 0 ? (
        <div className="mt-6 rounded-lg border border-[#262626] bg-[#171717] p-6">
          <p className="text-sm font-semibold">No evaluation yet</p>
          <p className="mt-1 text-sm text-[#a3a3a3]">
            Ingest a CSV and confirm metadata, then run the evaluation to see verdicts here.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <SummaryStrip summary={results.summary} />
          <ResultsTable
            readings={results.readings}
            page={state.ui.page}
            onPageChange={(page) => dispatch({ type: "set-page", page })}
          />
          <PtmtTriageList indications={results.indications} />
          <div className="flex flex-col gap-1 pb-4 text-xs text-[#a3a3a3]">
            <p>
              {UNIT_ASSUMPTION_COPY.replace("{csv}", state.units.csvThickness).replace(
                "{meta}",
                state.units.metadata,
              )}
            </p>
            <p>
              {`Source: ${state.source.filename} · ${state.csv.rowCount.toLocaleString("en-US")} rows` +
                (state.ui.evaluatedAt
                  ? ` · evaluated ${formatEvaluatedAt(state.ui.evaluatedAt)}`
                  : "")}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
