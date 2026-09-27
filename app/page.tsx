"use client";

import { StepIndicator } from "@/components/wizard/step-indicator";
import { VerdictChip } from "@/components/wizard/verdict-chip";
import { WizardProvider, useWizard } from "@/components/wizard/wizard-context";

/**
 * Wizard root (Plan 02-01 tracer). Screen 1 shows the heading + muted
 * subtitle from the UI-SPEC Screen 1 contract and a "Load sample data" button
 * (the tracer stand-in for the Screen-1 CTAs — the full dropzone/demo/split
 * layout is Plan 02-04's job). When results exist, a minimal results view
 * renders one row per reading with verdict chips — chips visibly on screen is
 * the tracer's far end.
 */
function WizardRoot() {
  const { state, dispatch } = useWizard();
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <StepIndicator current={state.results ? 3 : 1} />

      <h1 className="mt-6 text-xl font-semibold">Ingest inspection data</h1>
      <p className="mt-1 text-sm text-[#a3a3a3]">
        Upload an ultrasonic thickness register to evaluate against API 570 /
        ASME B31.3.
      </p>

      <section className="mt-6 rounded-lg border border-[#262626] bg-[#171717] p-6">
        <button
          type="button"
          onClick={() => dispatch({ type: "load-sample" })}
          className="rounded bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Load sample data
        </button>
        <p className="mt-2 text-xs text-[#a3a3a3]">
          Tracer slice — loads a committed 6-row sample register and runs it
          through the deterministic calc engine.
        </p>
      </section>

      {state.results && (
        <section className="mt-8" aria-label="Evaluation results (tracer)">
          <h2 className="text-xl font-semibold">
            Results — {state.results.summary.total} readings ·{" "}
            {state.results.summary.locations} locations
          </h2>
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
                {state.results.readings.map((reading) => (
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
        </section>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <WizardProvider>
      <WizardRoot />
    </WizardProvider>
  );
}
