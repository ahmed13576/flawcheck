"use client";

/**
 * Screen 1 — Landing & Ingestion (UI-SPEC Screen Layout Contract + states
 * table). Six states: idle; parsing (dropzone + demo disabled, role=status
 * 'Parsing {filename}…'); invalid-file inline error; parse-failure panel
 * (replaces dropzone content); zero-rows panel; success navigates to Screen 2
 * (focus handled by the wizard root). The 5 MB / 50,000-row caps (T-02-06)
 * gate BEFORE any read/tokenize. Demo loads the committed Zenodo subset with
 * zero network beyond page load (CONTEXT.md lock) and carries provenance.
 */
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
    // T-02-06: hard 5 MB cap before reading the file into memory.
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
      <h1 tabIndex={-1} data-screen-heading className="text-xl font-semibold">
        Ingest inspection data
      </h1>
      <p className="mt-1 text-sm text-[#a3a3a3]">
        Upload an ultrasonic thickness register to evaluate against API 570 / ASME B31.3.
      </p>

      <div className="mt-6 rounded-lg border border-[#262626] bg-[#171717] p-6">
        {panelError ? (
          <div role="alert" className="flex flex-col gap-3">
            {panelError.kind === "parse-failure" && (
              <>
                <p className="text-sm font-semibold">
                  Could not parse {panelError.filename}.
                </p>
                <ul className="flex flex-col gap-1 font-mono text-xs text-[#f87171]">
                  {panelError.errors.slice(0, 5).map((parseError, index) => (
                    <li key={`${parseError.line}-${index}`}>
                      line {parseError.line} — {parseError.problem}
                    </li>
                  ))}
                </ul>
                {panelError.errors.length > 5 && (
                  <p className="text-xs text-[#a3a3a3]">
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
                className="rounded border border-[#262626] px-4 py-2 text-sm font-semibold hover:border-gray-500"
              >
                Try another file
              </button>
            </div>
          </div>
        ) : (
          <>
            <Dropzone disabled={parsing !== null} onFile={handleFileChosen} />
            {error && error.kind === "invalid-file" && (
              <p role="alert" className="mt-3 text-sm text-[#f87171]">
                {error.filename} is not a CSV. Upload a .csv file exported from your thickness
                gauge.
              </p>
            )}
            {parsing && (
              <p role="status" className="mt-3 text-sm text-[#a3a3a3]">
                Parsing {parsing.filename}…
              </p>
            )}
          </>
        )}

        <div className="my-6 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-[#262626]" />
          <span className="text-xs text-[#a3a3a3]">or</span>
          <span className="h-px flex-1 bg-[#262626]" />
        </div>

        <button
          type="button"
          disabled={parsing !== null}
          onClick={() => dispatch({ type: "load-demo" })}
          className="rounded bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Load Demo Scenario
        </button>
        <p className="mt-2 text-xs text-[#a3a3a3]">
          Zenodo record 16780668 subset — 4,912 real readings. Runs offline.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-[#262626] pt-4">
          <a
            href="/sample-ut-register.csv"
            download
            className="text-sm text-[#2563eb] underline underline-offset-2"
          >
            Download sample CSV
          </a>
          <details className="text-sm">
            <summary className="cursor-pointer text-sm text-[#2563eb] underline underline-offset-2">
              View format guide
            </summary>
            <div className="mt-3 max-w-lg text-xs text-[#a3a3a3]">
              <p className="font-semibold text-[#ededed]">Expected columns</p>
              <p className="mt-1">
                Reading_ID, Tank, Grid_Position, Original_Scantling_mm, Measured_Thickness_mm,
                Measurement_Date — aliases like id, thickness, or date also auto-map.
              </p>
              <p className="mt-2 font-semibold text-[#ededed]">Example row</p>
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
    </section>
  );
}
