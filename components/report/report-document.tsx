"use client";

/**
 * ReportDocument — the locked Screen 4 preview (03-00b Task 2, Screen 4.png
 * binding layout): a pure presentational component ({ snapshot }) rendering a
 * `data-appearance="light"` subtree so the light token block applies — the
 * warm paper document on the dark chrome. It renders ONLY serialized session
 * slices (metadata, summary, readings, indications) plus citations.json
 * record fields (T-03-21: zero LLM content, zero newly computed values — the
 * only derivations are presentation-level: earliest next-inspection date and
 * the render date). Every numeric cell goes through lib/wizard/format
 * (formatFixed: null/non-finite renders "—" — never Infinity/NaN). Verdict
 * TEXT reuses the repo's ACCEPT/RE-CHECK/FAIL strings via verdictLabel().
 *
 * Generation is gated to Phase 4 (locked decision): Download PDF / Print
 * report render DISABLED, zero PDF generation, zero print CSS.
 */
import { LockKeyhole } from "lucide-react";
import { formatFixed } from "@/lib/wizard/format";
import { flagChipFor, verdictLabel } from "@/components/wizard/verdict-chip";
import type { ReadingResult, Verdict } from "@/lib/ingest/session";
import type { ReportSnapshot, ReportSignOff } from "@/lib/report/session-snapshot";
import type { ReportAudit } from "@/lib/report/audit";
import { REPORT_UNIT_ASSUMPTION_COPY } from "@/lib/report/content";
// 04-01: the pure presentation derivations moved to the shared content seam
// (lib/report/content.ts — one source of truth, two renderers: this HTML
// document and the plan 04-02 server PDF renderer). Re-exported here so the
// existing test imports keep resolving (a move plus re-export — no deletions).
import {
  REINSPECTION_CITATION_ID,
  buildConclusions,
  citationRef,
  earliestNextInspection,
} from "@/lib/report/content";

export {
  buildConclusions,
  citationRef,
  earliestNextInspection,
} from "@/lib/report/content";

/** Verdict tone in the light document — token classes, never raw hex. */
function verdictTextClass(verdict: Verdict): string {
  if (verdict === "accept") return "text-accept";
  if (verdict === "re_check") return "text-recheck";
  return "text-fail";
}

function cmlName(reading: ReadingResult): string {
  return reading.cml
    ? `${reading.cml} — ${reading.location}`
    : reading.location;
}

const PAPER_TD = "border-t border-border px-2 py-3 align-top";
const PAPER_TH = "px-2 py-3 text-left font-normal";

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/** Empty sign-off base for controlled-field merges. */
const EMPTY_SIGN_OFF: ReportSignOff = { name: "", certification: "", date: "", signature: "" };

/**
 * 04-03 sign-off gate — deliberately ALL FOUR fields (UI-SPEC region 2;
 * UI-52's three-field condition is implied by it — do not "fix" to three).
 * Exported pure for the node test-suite.
 */
export function isSignOffComplete(
  signOff: ReportSignOff | null | undefined,
): boolean {
  if (!signOff) return false;
  return (
    signOff.name.trim().length > 0 &&
    signOff.certification.trim().length > 0 &&
    signOff.date.trim().length > 0 &&
    signOff.signature.trim().length > 0
  );
}

export function ReportDocument({
  snapshot,
  onBack,
  generatedAt,
  signOff = null,
  onSignOffChange,
  audit = null,
  onDownloadPdf,
  onPrint,
  pdfPending = false,
  pdfError = null,
  variant = "preview",
}: {
  snapshot: ReportSnapshot;
  onBack?: () => void;
  /** ISO timestamp override (tests); defaults to the render wall clock. */
  generatedAt?: string;
  /** 04-03: session sign-off (null → pending chip + empty form). */
  signOff?: ReportSignOff | null;
  onSignOffChange?: (next: ReportSignOff) => void;
  audit?: ReportAudit | null;
  onDownloadPdf?: () => void;
  onPrint?: () => void;
  pdfPending?: boolean;
  pdfError?: string | null;
  /** "print" omits the preview banner + action footer (browser supplies chrome). */
  variant?: "preview" | "print";
}) {
  const generated = dateOnly(generatedAt ?? new Date().toISOString());
  const gateOpen = isSignOffComplete(signOff);
  const signOffName = signOff?.name ?? "";
  const unit = snapshot.units.metadata;
  const conclusions = buildConclusions(snapshot);
  const nextInspection = earliestNextInspection(snapshot);
  const ruleRef = citationRef(REINSPECTION_CITATION_ID);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {/* Top banner — on the dark chrome, per the mock. */}
      {variant === "preview" ? (
        <section
          className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-primary"
          aria-label="Report preview ready"
        >
          <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Report ready</p>
            <p className="text-xs text-muted-foreground">
              Sign off to enable PDF export and printing.
            </p>
          </div>
        </section>
      ) : null}

      {/* The warm paper document — light tokens under data-appearance="light". */}
      <article
        data-appearance="light"
        aria-label="Printable inspection report"
        className="flex flex-col gap-6 rounded-xl border border-border bg-background p-8 text-foreground shadow-[0px_18px_45px_rgba(0,_0,_0,_0.28)]"
      >
        <header className="flex flex-col gap-4 border-b border-border pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="size-3 rounded-full bg-accept" aria-hidden="true" />
              <h1 className="text-2xl font-semibold tracking-tight">
                FlawCheck Inspection Report
              </h1>
            </div>
            <span className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-wide ${gateOpen ? "border-accept/40 bg-card text-accept" : "border-recheck/40 bg-card text-recheck"}`}>
              {gateOpen ? `SIGNED OFF — ${signOffName}` : "Pending inspector sign-off"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 font-mono text-xs text-muted-foreground">
            <div>
              <span className="block text-[10px] uppercase tracking-wide">Generated</span>
              <span>{generated}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide">Source</span>
              <span>{snapshot.sourceName}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide">Evaluation date</span>
              <span>{dateOnly(snapshot.evaluatedAt)}</span>
            </div>
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">
            {REPORT_UNIT_ASSUMPTION_COPY.replace("{csv}", snapshot.units.csvThickness).replace(
              "{meta}",
              snapshot.units.metadata,
            )}
          </p>
        </header>

        <section className="flex flex-col gap-4 border-b border-border pb-6">
          <h2 className="text-xl font-semibold tracking-tight">Component context</h2>
          <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">OD</dt>
              <dd className="font-mono">{`${formatFixed(snapshot.metadata.od, 1)} ${unit}`}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">t-nom</dt>
              <dd className="font-mono">{`${formatFixed(snapshot.metadata.tNominal, 2)} ${unit}`}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Design code</dt>
              <dd>{snapshot.metadata.designCode}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Piping class</dt>
              <dd>{`Class ${snapshot.metadata.pipeClass}`}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">FCA</dt>
              <dd className="font-mono">{`${formatFixed(snapshot.metadata.fca, 1)} ${unit}`}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Evaluation date</dt>
              <dd className="font-mono">{dateOnly(snapshot.evaluatedAt)}</dd>
            </div>
          </dl>
        </section>

        <section className="flex flex-col gap-3 border-b border-border pb-6">
          <h2 className="text-xl font-semibold tracking-tight">CML measurements</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full table-fixed text-left text-xs">
              <thead className="bg-card text-muted-foreground">
                <tr>
                  <th className={PAPER_TH} scope="col">CML / Location</th>
                  <th className={PAPER_TH} scope="col">t-actual</th>
                  <th className={PAPER_TH} scope="col">t-required</th>
                  <th className={PAPER_TH} scope="col">CR gov.</th>
                  <th className={PAPER_TH} scope="col">RL</th>
                  <th className={PAPER_TH} scope="col">Next inspection</th>
                  <th className={PAPER_TH} scope="col">Flags</th>
                  <th className={PAPER_TH} scope="col">Verdict</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {snapshot.readings.map((reading) => (
                  <tr key={reading.readingId} className="border-t border-border">
                    <td className={`${PAPER_TD} font-sans`}>{cmlName(reading)}</td>
                    <td className={PAPER_TD}>{formatFixed(reading.tActualMm, 2)}</td>
                    <td className={PAPER_TD}>{formatFixed(reading.tRequiredMm, 2)}</td>
                    <td className={PAPER_TD}>{formatFixed(reading.crGoverningMmYr, 3)}</td>
                    <td className={PAPER_TD}>
                      {reading.rlYears === null
                        ? "—"
                        : `${formatFixed(reading.rlYears, 1)} yr`}
                    </td>
                    <td className={PAPER_TD}>
                      {reading.nextInspection ? reading.nextInspection.date : "—"}
                    </td>
                    <td className={`${PAPER_TD} font-sans`}>
                      {reading.flags.length === 0
                        ? "—"
                        : reading.flags
                            .map((flag) => flagChipFor(flag)?.label ?? flag)
                            .join(", ")}
                    </td>
                    <td className={`${PAPER_TD} font-sans font-semibold ${verdictTextClass(reading.verdict)}`}>
                      {verdictLabel(reading.verdict)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-3 border-b border-border pb-6">
          <h2 className="text-xl font-semibold tracking-tight">PT/MT indication</h2>
          {snapshot.indications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No PT/MT indications recorded for this evaluation.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-card text-xs text-muted-foreground">
                  <tr>
                    <th className={PAPER_TH} scope="col">Method</th>
                    <th className={PAPER_TH} scope="col">Morphology</th>
                    <th className={PAPER_TH} scope="col">Dimensions</th>
                    <th className={PAPER_TH} scope="col">Verdict</th>
                    <th className={PAPER_TH} scope="col">Clause reference</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.indications.map((indication) => (
                    <tr key={indication.id} className="border-t border-border">
                      <td className={PAPER_TD}>{indication.method}</td>
                      <td className={PAPER_TD}>
                        {indication.morphology === "linear" ? "Linear" : "Rounded"}
                      </td>
                      <td className={`${PAPER_TD} font-mono`}>
                        {`${formatFixed(indication.lengthMm, 1)} × ${formatFixed(indication.widthMm, 1)} mm`}
                      </td>
                      <td className={`${PAPER_TD} font-semibold ${verdictTextClass(indication.verdict)}`}>
                        {verdictLabel(indication.verdict)}
                      </td>
                      {/* Cite-don't-quote: record fields only; unknown id → zero glyphs. */}
                      <td className={PAPER_TD}>{citationRef(indication.citationId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3 border-b border-border pb-6">
          <h2 className="text-xl font-semibold tracking-tight">Clause-cited conclusions</h2>
          {conclusions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              All readings and indications accept — no clause-cited exceptions in this evaluation.
            </p>
          ) : (
            <ol className="flex list-decimal flex-col gap-3 pl-6 text-sm leading-6">
              {conclusions.map((line, i) => (
                <li
                  key={`${i}-${line.citationId ?? "nocite"}`}
                  className="rounded-sm border-l-2 border-l-primary border-y border-r border-y-primary/40 border-r-primary/40 bg-card px-4 py-3"
                >
                  {line.text}
                  {line.citationId && (
                    <span className="text-muted-foreground">{` (${citationRef(line.citationId)})`}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        {nextInspection && (
          <section className="rounded-lg border border-recheck/40 bg-recheck/10 p-5">
            <p className="text-xl font-semibold tracking-tight text-recheck">
              {`Next inspection: ${nextInspection}`}
            </p>
            {ruleRef && (
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {`Rule applied: ${ruleRef}`}
              </p>
            )}
          </section>
        )}

        <section className="flex flex-col gap-4 border-b border-border pb-6">
          <h2 className="text-xl font-semibold tracking-tight">Inspector sign-off</h2>
          <div className="grid gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="inspector-name" className="text-xs">
                Name <span aria-hidden="true" className="text-destructive">*</span>
                <span className="sr-only">required</span>
              </label>
              <input
                id="inspector-name"
                placeholder="Full name"
                value={signOff?.name ?? ""}
                onChange={(e) =>
                  onSignOffChange?.({ ...(signOff ?? EMPTY_SIGN_OFF), name: e.target.value })
                }
                className="h-12 rounded-lg border border-input bg-card px-3 outline-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="certification" className="text-xs">
                Certification <span aria-hidden="true" className="text-destructive">*</span>
                <span className="sr-only">required</span>
              </label>
              <input
                id="certification"
                placeholder="Certification or license"
                value={signOff?.certification ?? ""}
                onChange={(e) =>
                  onSignOffChange?.({ ...(signOff ?? EMPTY_SIGN_OFF), certification: e.target.value })
                }
                className="h-12 rounded-lg border border-input bg-card px-3 outline-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="signoff-date" className="text-xs">
                Date <span aria-hidden="true" className="text-destructive">*</span>
                <span className="sr-only">required</span>
              </label>
              <input
                id="signoff-date"
                type="date"
                placeholder="YYYY-MM-DD"
                value={signOff?.date ?? ""}
                onChange={(e) =>
                  onSignOffChange?.({ ...(signOff ?? EMPTY_SIGN_OFF), date: e.target.value })
                }
                className="h-12 rounded-lg border border-input bg-card px-3 outline-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="signoff-signature" className="text-xs">
                Signature <span aria-hidden="true" className="text-destructive">*</span>
                <span className="sr-only">required</span>
              </label>
              <textarea
                id="signoff-signature"
                placeholder="Sign after reviewing the findings."
                rows={2}
                value={signOff?.signature ?? ""}
                onChange={(e) =>
                  onSignOffChange?.({ ...(signOff ?? EMPTY_SIGN_OFF), signature: e.target.value })
                }
                className="rounded-lg border border-input bg-card px-3 py-2 outline-none"
              />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3 border-b border-border pb-6">
          <h2 className="text-xl font-semibold tracking-tight">Audit appendix</h2>
          <p className="font-mono text-xs break-all text-muted-foreground">
            {`input hash: ${audit?.inputHash ?? "\u2014"}`}
          </p>
          {(audit?.steps ?? [
            { step: "extraction", model: null, promptTokens: null, completionTokens: null, latencyMs: null },
            { step: "narrative", model: null, promptTokens: null, completionTokens: null, latencyMs: null },
          ]).map((step) => (
            <p key={step.step} className="font-mono text-xs break-all text-muted-foreground">
              {`${step.step}: ${step.model ?? "\u2014"} \u00b7 tokens ${step.promptTokens ?? "\u2014"}/${step.completionTokens ?? "\u2014"} \u00b7 ${step.latencyMs === null ? "\u2014" : `${(step.latencyMs / 1000).toFixed(1)} s`}`}
            </p>
          ))}
        </section>

        <footer className="border-t border-border pt-4 font-mono text-xs leading-5 text-muted-foreground">
          This report is an engineering aid based on supplied measurements and
          stated assumptions. Confirm findings, calculations, and disposition
          through the responsible inspector and applicable procedures.
        </footer>
      </article>

      {/* Action footer — omitted in print variant (browser supplies chrome). */}
      {variant === "preview" ? (
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="h-10 rounded-lg border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
        >
          Back to results
        </button>
        <div className="flex items-center gap-3">
          {pdfError ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {pdfError}
            </p>
          ) : null}
          <button
            type="button"
            disabled={!gateOpen || pdfPending}
            aria-busy={pdfPending || undefined}
            onClick={onDownloadPdf}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="h-10 rounded-lg border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            Print report
          </button>
          {!gateOpen ? (
            <span className="text-xs text-muted-foreground">
              Available after inspector sign-off
            </span>
          ) : null}
        </div>
      </div>
      ) : null}
    </div>
  );
}
