"use client";

/**
 * Screen 1 — Landing & Ingestion (UI-SPEC Screen Layout Contract + states
 * table), restyled per the Flowstep Screen 1 mock (03-00). Six states: idle;
 * parsing (dropzone + demo disabled, role=status 'Parsing {filename}…');
 * invalid-file inline error; parse-failure panel (replaces dropzone content);
 * zero-rows panel; success navigates to Screen 2 (focus handled by the wizard
 * root). The 25 MB (raised from 5 MB — user-directed design adoption) /
 * 50,000-row caps (T-02-06/T-03-19) gate BEFORE any read/tokenize. Demo loads
 * the committed Zenodo subset with zero network beyond page load (CONTEXT.md
 * lock) and carries provenance. Footer nav: Back (disabled at step 1) /
 * Continue to review (gated on loaded rows).
 */
import { ChevronRight, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { MAX_FILE_BYTES } from "@/lib/ingest/validate";
import { useWizard } from "@/components/wizard/wizard-context";
import { Dropzone } from "@/components/wizard/dropzone";

function isCsvFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
}

export function ScreenIngest() {
  const { state, dispatch } = useWizard();
  const { ui } = state;
  const parsing = ui.parsing;
  const error = ui.ingestError;
  const rowsLoaded = state.csv.rowCount > 0;

  const handleFile = (file: File) => {
    // Invalid file type: client-side check BEFORE any read (UI-02).
    if (!isCsvFile(file)) {
      dispatch({ type: "parse-invalid", filename: file.name });
      return;
    }
    // T-02-06: hard 25 MB cap before reading the file into memory.
    if (file.size > MAX_FILE_BYTES) {
      dispatch({ type: "parse-too-large", filename: file.name, sizeBytes: file.size });
      return;
    }
    dispatch({ type: "start-parse", filename: file.name });
    file
      .text()
      .then((content) => dispatch({ type: "parse-file", filename: file.name, content }))
      .catch(() => dispatch({ type: "cancel-parse" }));
  };

  const handleFileChosen = (file: File) => {
    // WR-06: the type/size gates run BEFORE any read on BOTH paths. The
    // replace flow used to read the entire file into memory (and stage its
    // contents in the reducer) before assertFileBytes fired at confirm-replace
    // — a multi-hundred-MB non-CSV drop was fully read and held. The
    // documented budget ("caps gate BEFORE any read") applies here too: the
    // same parse-invalid / parse-too-large dispatches fire pre-read.
    if (!isCsvFile(file)) {
      dispatch({ type: "parse-invalid", filename: file.name });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      dispatch({ type: "parse-too-large", filename: file.name, sizeBytes: file.size });
      return;
    }
    // UI-03: dropping/browsing while rows are loaded asks before replacing.
    if (rowsLoaded) {
      file
        .text()
        .then((content) =>
          dispatch({ type: "stage-replace", pending: { filename: file.name, content } }),
        )
        .catch(() => undefined);
      return;
    }
    handleFile(file);
  };

  // Panels that replace the dropzone content (parse failure / zero rows /
  // over-limit caps surface loudly with a way back to idle).
  const panelError =
    error && error.kind !== "invalid-file" ? error : null;

  return (
    <section aria-label="Screen 1 — Ingestion">
      <h1
        tabIndex={-1}
        data-screen-heading
        className="text-3xl font-semibold tracking-tight outline-none focus:outline-none focus-visible:outline-none"
      >
        Start with your inspection data
      </h1>
      <p className="mt-2 text-base text-muted-foreground">
        Upload a register or explore a guided sample. We’ll keep every step visible and
        explain what needs attention.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        {panelError ? (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
          >
            {panelError.kind === "parse-failure" && (
              <>
                <p className="text-sm font-semibold">
                  Could not parse {panelError.filename}.
                </p>
                <ul className="flex flex-col gap-1 font-mono text-xs text-fail">
                  {panelError.errors.slice(0, 5).map((parseError, index) => (
                    <li key={`${parseError.line}-${index}`}>
                      line {parseError.line} — {parseError.problem}
                    </li>
                  ))}
                </ul>
                {panelError.errors.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    + {panelError.errors.length - 5} more problem(s) not shown.
                  </p>
                )}
              </>
            )}
            {panelError.kind === "zero-rows" && (
              <p className="text-sm font-semibold">
                No data rows found in {panelError.filename}. The file has headers but no
                measurements.
              </p>
            )}
            {panelError.kind === "too-large" && (
              <p className="text-sm font-semibold">{panelError.message}</p>
            )}
            {panelError.kind === "too-many-rows" && (
              <p className="text-sm font-semibold">{panelError.message}</p>
            )}
            <div>
              <button
                type="button"
                onClick={() => dispatch({ type: "dismiss-ingest-error" })}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                Try another file
              </button>
            </div>
          </div>
        ) : (
          <>
            <Dropzone disabled={parsing !== null} onFile={handleFileChosen} />
            {error && error.kind === "invalid-file" && (
              <p role="alert" className="text-sm text-fail">
                {error.filename} is not a CSV. Upload a .csv file exported from your thickness
                gauge.
              </p>
            )}
            {parsing && (
              <p role="status" className="text-sm text-muted-foreground">
                Parsing {parsing.filename}…
              </p>
            )}
          </>
        )}

        <div
          className="flex items-center gap-8 text-sm text-muted-foreground"
          aria-label="Workspace assurances"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            <span>Secure workspace</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-primary" aria-hidden="true" />
            <span>Offline-ready evaluation</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            <span>Sample data available</span>
          </div>
        </div>

        <div className="flex items-center gap-4" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          <span className="text-sm text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={parsing !== null}
            onClick={() => dispatch({ type: "load-demo" })}
            className="flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Explore a sample inspection
          </button>
          <div className="rounded-lg border border-primary/20 bg-primary/10 p-4 text-center">
            <p className="font-mono text-sm text-muted-foreground">
              Zenodo record 16780668 subset — 4,912 real readings. Runs offline.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
          <a
            href="/sample-ut-register.csv"
            download
            className="text-primary underline underline-offset-4"
          >
            Download sample CSV
          </a>
          <span className="text-muted-foreground" aria-hidden="true">
            ·
          </span>
          <details className="text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-primary underline underline-offset-4">
              <ChevronRight className="size-4" aria-hidden="true" />
              <span>View format guide</span>
            </summary>
            <div className="mt-3 max-w-lg rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Expected columns</p>
              <p className="mt-1">
                Reading_ID, Tank, Grid_Position, Original_Scantling_mm, Measured_Thickness_mm,
                Measurement_Date — aliases like id, thickness, or date also auto-map.
              </p>
              <p className="mt-2 font-semibold text-foreground">Example row</p>
              <p className="mt-1 font-mono">
                A01-2015,A01,N-3,20,9.5,2015-01-15
              </p>
              <p className="mt-2">
                Units: thickness values in millimeters by default — declare in or mils in the
                mapping panel after upload if your gauge exports those.
              </p>
            </div>
          </details>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 mt-8 flex w-full max-w-full flex-wrap items-center justify-between gap-4 border-t border-border bg-background/95 px-2 py-3 backdrop-blur-sm pb-safe">
        <button
          type="button"
          disabled
          className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          disabled={!rowsLoaded || parsing !== null}
          onClick={() => dispatch({ type: "set-screen", screen: 2 })}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Continue to review
        </button>
      </div>
    </section>
  );
}
