"use client";

/**
 * Wizard root — header chrome (FlawCheck / NDT Inspection Copilot), step
 * indicator, demo provenance banner (UI-21: persists on Screens 2-3), and the
 * three screens. Focus moves to the new screen's <h1> after transitions
 * (UI-22, a11y floor 8).
 */
import { useCallback, useEffect, useMemo } from "react";
import { StepIndicator } from "@/components/wizard/step-indicator";
import { WizardProvider, useWizard } from "@/components/wizard/wizard-context";
import { ScreenIngest } from "@/components/wizard/screen-ingest";
import { ScreenReview } from "@/components/wizard/screen-review";
import { ScreenResults } from "@/components/wizard/screen-results";
import { MetadataForm } from "@/components/wizard/metadata-form";
import { PtmtEntry } from "@/components/wizard/ptmt-entry";
import { ConfirmDialog } from "@/components/wizard/confirm-dialog";
import { metadataProblems, type MetadataDraftField } from "@/lib/wizard/reducer";

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

function WizardRoot() {
  const { state, dispatch } = useWizard();
  const { ui } = state;

  const metadataProblemsMemo = useMemo(
    () => metadataProblems(ui.metadataDraft),
    [ui.metadataDraft],
  );
  const handleMetadataField = useCallback(
    (field: MetadataDraftField, value: string) =>
      dispatch({ type: "set-metadata-field", field, value }),
    [dispatch],
  );

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
    <div
      className={`mx-auto w-full px-4 py-8 ${
        ui.screen === 3 ? "max-w-6xl" : "max-w-4xl"
      }`}
    >
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
        {ui.screen === 2 && (
          <ScreenReview>
            <MetadataForm
              draft={ui.metadataDraft}
              metadataUnit={state.units.metadata}
              problems={metadataProblemsMemo}
              onField={handleMetadataField}
              onMetadataUnit={(unit) => dispatch({ type: "set-metadata-unit", unit })}
            />
            <PtmtEntry
              notes={state.ptmt.notes}
              indications={state.ptmt.indications}
              onNotes={(notes) => dispatch({ type: "set-ptmt-notes", notes })}
            />
          </ScreenReview>
        )}
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
