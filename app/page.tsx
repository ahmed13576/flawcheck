"use client";

/**
 * Wizard root — header chrome (FlawCheck / NDT Inspection Copilot), step
 * indicator, demo provenance banner (UI-21: persists on Screens 2-3), and the
 * three screens. Focus moves to the new screen's <h1> after transitions
 * (UI-22, a11y floor 8). Screen 2's full review surface (mapping panel,
 * paginated table, footer gate) is composed here; Plan 02-04 Tasks 2-3
 * extract it into components.
 */
import { useEffect, useRef } from "react";
import { StepIndicator } from "@/components/wizard/step-indicator";
import { VerdictChip } from "@/components/wizard/verdict-chip";
import { WizardProvider, useWizard } from "@/components/wizard/wizard-context";
import { ScreenIngest } from "@/components/wizard/screen-ingest";
import { ConfirmDialog } from "@/components/wizard/confirm-dialog";
import { hasBlockers, blockingChecks } from "@/lib/wizard/reducer";

function DemoBanner() {
  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-[#262626] bg-[#171717] px-4 py-2 text-sm"
    >
      Demo scenario loaded — Zenodo record 16780668 subset (sample data)
    </div>
  );
}

function ScreenReviewInline() {
  const { state, dispatch } = useWizard();
  const blockers = blockingChecks(state);
  const gated = hasBlockers(blockers);
  const started = useRef(false);

  const runEvaluation = () => {
    if (started.current) return;
    started.current = true;
    dispatch({ type: "evaluation-start" });
    // Yield a frame so the button paints Evaluating… before the sync compute.
    setTimeout(() => {
      started.current = false;
      dispatch({ type: "run-evaluation" });
    }, 30);
  };

  return (
    <section aria-label="Screen 2 — Review & Metadata">
      <h1 tabIndex={-1} className="text-xl font-semibold">
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

      <div className="mt-4 rounded-lg border border-[#262626] bg-[#171717] p-4">
        <p className="text-sm font-semibold">Column mapping (auto-guessed)</p>
        <ul className="mt-2 text-xs text-[#a3a3a3]">
          {Object.entries(state.mapping).map(([field, header]) => (
            <li key={field}>
              {field}: {header ?? "— not mapped —"}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-[#262626]">
        <table className="w-full border-collapse text-sm">
          <caption className="px-3 py-2 text-left text-xs text-[#a3a3a3]">
            Showing 1–{state.rows.length.toLocaleString("en-US")} of{" "}
            {state.csv.rowCount.toLocaleString("en-US")}
          </caption>
          <thead>
            <tr className="bg-[#171717] text-left">
              <th scope="col" className="border border-[#262626] px-3 py-2">
                Row
              </th>
              <th scope="col" className="border border-[#262626] px-3 py-2">
                Reading
              </th>
              <th scope="col" className="border border-[#262626] px-3 py-2">
                Tank
              </th>
              <th scope="col" className="border border-[#262626] px-3 py-2">
                Thickness
              </th>
              <th scope="col" className="border border-[#262626] px-3 py-2">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {state.rows.map((row) => (
              <tr key={row.row} className="bg-[#0a0a0a]">
                <td className="border border-[#262626] px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                  {row.row}
                </td>
                <td className="border border-[#262626] px-3 py-2">
                  {state.mapping.readingId ? row.cells[state.mapping.readingId] : "—"}
                </td>
                <td className="border border-[#262626] px-3 py-2">
                  {state.mapping.tank ? row.cells[state.mapping.tank] : "—"}
                </td>
                <td className="border border-[#262626] px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                  {state.mapping.measuredThickness
                    ? row.cells[state.mapping.measuredThickness]
                    : "—"}
                </td>
                <td className="border border-[#262626] px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                  {state.mapping.measurementDate ? row.cells[state.mapping.measurementDate] : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-4 border-t border-[#262626] bg-[#0a0a0a] px-1 py-3">
        <p aria-live="polite" className="text-sm text-[#a3a3a3]">
          {gated
            ? `${blockers.rowErrors} row ${blockers.rowErrors === 1 ? "error" : "errors"} · ${blockers.unmappedRequired.length} unmapped ${blockers.unmappedRequired.length === 1 ? "column" : "columns"} · ${blockers.metadataProblems.length} metadata ${blockers.metadataProblems.length === 1 ? "problem" : "problems"}`
            : "All checks passed"}
        </p>
        <button
          type="button"
          disabled={gated || state.ui.evaluating}
          onClick={runEvaluation}
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

/**
 * Screen 3 — evaluation results. Plan 02-05 delivers the full locked column
 * set; this is the tracer's working results view carried forward so Run
 * Evaluation lands somewhere real.
 */
function ScreenResults() {
  const { state } = useWizard();
  const results = state.results;
  return (
    <section aria-label="Screen 3 — Results">
      <h1 tabIndex={-1} className="text-xl font-semibold">
        Results
      </h1>
      {!results ? (
        <div className="mt-6 rounded-lg border border-[#262626] bg-[#171717] p-6">
          <p className="text-sm font-semibold">No evaluation yet</p>
          <p className="mt-1 text-sm text-[#a3a3a3]">
            Ingest a CSV and confirm metadata, then run the evaluation to see verdicts here.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 rounded-lg border border-[#262626] bg-[#171717] p-4 text-sm">
            <span className="font-mono tabular-nums">
              {results.summary.total.toLocaleString("en-US")} readings ·{" "}
              {results.summary.locations} locations
            </span>
            <span className="text-[#a3a3a3]"> — </span>
            <VerdictChip verdict="accept" /> <span className="font-mono tabular-nums">{results.summary.accept}</span>
            <span className="mx-2">·</span>
            <VerdictChip verdict="re_check" /> <span className="font-mono tabular-nums">{results.summary.reCheck}</span>
            <span className="mx-2">·</span>
            <VerdictChip verdict="reject" /> <span className="font-mono tabular-nums">{results.summary.fail}</span>
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border border-[#262626]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#171717] text-left">
                  <th scope="col" className="border border-[#262626] px-3 py-2">
                    Reading
                  </th>
                  <th scope="col" className="border border-[#262626] px-3 py-2">
                    t-actual (mm)
                  </th>
                  <th scope="col" className="border border-[#262626] px-3 py-2">
                    t-required (mm)
                  </th>
                  <th scope="col" className="border border-[#262626] px-3 py-2">
                    Verdict
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.readings.map((reading) => (
                  <tr key={reading.readingId} className="bg-[#0a0a0a]">
                    <td className="border border-[#262626] px-3 py-2">
                      {reading.readingId}
                    </td>
                    <td className="border border-[#262626] px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                      {reading.tActualMm.toFixed(2)}
                    </td>
                    <td className="border border-[#262626] px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                      {reading.tRequiredMm.toFixed(2)}
                    </td>
                    <td className="border border-[#262626] px-3 py-2">
                      <VerdictChip verdict={reading.verdict} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function WizardRoot() {
  const { state, dispatch } = useWizard();
  const { ui } = state;
  const headingRef = useRef<HTMLHeadingElement>(null);

  // UI-22 / a11y floor 8: after a step transition, focus lands on the
  // new screen's heading.
  useEffect(() => {
    headingRef.current?.focus();
  }, [ui.screen]);

  // Screen 2/3 require a parsed session; if state was lost, fall back to Screen 1.
  useEffect(() => {
    if (ui.screen !== 1 && state.csv.rowCount === 0) {
      dispatch({ type: "set-screen", screen: 1 });
    }
  }, [ui.screen, state.csv.rowCount, dispatch]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-xl font-semibold">FlawCheck</span>
        <span className="text-sm text-[#a3a3a3]">NDT Inspection Copilot</span>
      </header>
      <div className="mt-4">
        <StepIndicator current={ui.screen} />
      </div>
      <div className="mt-6">
        {ui.screen !== 1 && state.source.isDemo && <DemoBanner />}
        {ui.screen === 1 && <ScreenIngest />}
        {ui.screen === 2 && <ScreenReviewInline />}
        {ui.screen === 3 && <ScreenResults />}
      </div>
      <ConfirmDialog
        open={ui.replaceConfirm !== null}
        filename={ui.replaceConfirm?.pending.filename ?? null}
        onCancel={() => dispatch({ type: "cancel-replace" })}
        onReplace={() => dispatch({ type: "confirm-replace" })}
      />
    </div>
  );
}

export default function Home() {
  return (
    <WizardProvider>
      <WizardRoot />
    </WizardProvider>
  );
}
