"use client";

/**
 * Wizard root — header chrome (FlawCheck / NDT Inspection Copilot), step
 * indicator, demo provenance banner (UI-21: persists on Screens 2-3), and the
 * three screens. Focus moves to the new screen's <h1> after transitions
 * (UI-22, a11y floor 8).
 */
import { useEffect } from "react";
import { StepIndicator } from "@/components/wizard/step-indicator";
import { VerdictChip } from "@/components/wizard/verdict-chip";
import { WizardProvider, useWizard } from "@/components/wizard/wizard-context";
import { ScreenIngest } from "@/components/wizard/screen-ingest";
import { ScreenReview } from "@/components/wizard/screen-review";
import { ConfirmDialog } from "@/components/wizard/confirm-dialog";

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
      <h1 tabIndex={-1} data-screen-heading className="text-xl font-semibold">
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
          <div className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-[#262626] bg-[#171717] p-4 text-sm">
            <span className="font-mono tabular-nums whitespace-nowrap">
              {results.summary.total.toLocaleString("en-US")} readings ·{" "}
              {results.summary.locations} locations
            </span>
            <span className="text-[#a3a3a3]">—</span>
            <VerdictChip verdict="accept" />
            <span className="font-mono tabular-nums">{results.summary.accept}</span>
            <span className="text-[#a3a3a3]">·</span>
            <VerdictChip verdict="re_check" />
            <span className="font-mono tabular-nums">{results.summary.reCheck}</span>
            <span className="text-[#a3a3a3]">·</span>
            <VerdictChip verdict="reject" />
            <span className="font-mono tabular-nums">{results.summary.fail}</span>
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

  // UI-22 / a11y floor 8: after a step transition, focus lands on the
  // new screen's heading.
  useEffect(() => {
    const heading = document.querySelector<HTMLElement>("[data-screen-heading]");
    heading?.focus();
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
        {ui.screen === 2 && <ScreenReview />}
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
