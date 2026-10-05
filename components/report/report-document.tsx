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
import { criteria } from "@/lib/calc/criteria";
import { formatFixed } from "@/lib/wizard/format";
import { flagChipFor, verdictLabel } from "@/components/wizard/verdict-chip";
import type { ReadingResult, Verdict } from "@/lib/ingest/session";
import type { ReportSnapshot } from "@/lib/report/session-snapshot";

type CitationRecord = (typeof criteria.citations)[number];
const CITATION_RECORDS = criteria.citations as readonly CitationRecord[];

/**
 * Allowlist renderer (citation invariant): the ref string is composed ONLY
 * from the citations.json record fields (code, clause) — cite-don't-quote.
 * An unknown id renders ZERO glyphs.
 * Exported pure for the node test-suite.
 */
export function citationRef(id: string): string {
  const record = CITATION_RECORDS.find((c) => c.id === id);
  return record ? `${record.code} §${record.clause}` : "";
}

/**
 * The engine emits this id whenever a dated next-inspection is set
 * (lib/calc/evaluate.ts). The clause STRING is never hardcoded — it is
 * rendered from the citations.json record fields via citationRef().
 */
const REINSPECTION_CITATION_ID = "api570_6_3_3_halflife";

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

export interface ConclusionLine {
  text: string;
  citationId: string | null;
}

/**
 * Phase-3 placeholder conclusions (Phase 4 replaces this list with
 * narrative-driven conclusions): one deterministic line per non-ACCEPT
 * reading and per non-ACCEPT indication, each ending with the clause ref
 * from the citations.json record for an engine-emitted citation id (null id
 * or unknown id → no clause glyphs). Exported pure for the node test-suite.
 */
export function buildConclusions(snapshot: ReportSnapshot): ConclusionLine[] {
  const lines: ConclusionLine[] = [];
  for (const reading of snapshot.readings) {
    if (reading.verdict === "accept") continue;
    const name = reading.cml ?? reading.location;
    if (reading.verdict === "reject") {
      // WR-08: cite the reading's OWN engine-emitted citation (the governing
      // t-required branch varies) — pressure-design clause only as fallback.
      const engineCite =
        reading.citations.find((id) => citationRef(id) !== "") ?? null;
      const citeId =
        engineCite ??
        (citationRef("asme_b31_3_304_1_2") !== "" ? "asme_b31_3_304_1_2" : null);
      lines.push({
        text: `${name} is below the calculated required thickness and requires disposition before continued service.`,
        citationId: citeId,
      });
    } else {
      const cite = reading.citations.find((id) => citationRef(id) !== "") ?? null;
      lines.push({
        text: `${name} requires inspector re-check — data quality or the band boundary must be confirmed before acceptance.`,
        citationId: cite,
      });
    }
  }
  for (const indication of snapshot.indications) {
    if (indication.verdict === "accept") continue;
    const action =
      indication.verdict === "reject"
        ? "requires Level 2/3 inspector evaluation"
        : "requires inspector review before disposition";
    lines.push({
      text: `The ${indication.morphology} ${indication.method} indication ${action}.`,
      citationId: citationRef(indication.citationId) !== "" ? indication.citationId : null,
    });
  }
  return lines;
}

/**
 * Earliest dated next-inspection across the session's readings (ISO strings
 * sort lexicographically). Immediate-inspection readings keep
 * nextInspection null (G14) and never contribute a date. Exported pure.
 */
export function earliestNextInspection(snapshot: ReportSnapshot): string | null {
  const dates = snapshot.readings
    .map((r) => r.nextInspection?.date ?? null)
    .filter((d): d is string => d !== null)
    .sort();
  return dates[0] ?? null;
}

const PAPER_TD = "border-t border-border px-2 py-3 align-top";
const PAPER_TH = "px-2 py-3 text-left font-normal";

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export function ReportDocument({
  snapshot,
  onBack,
  generatedAt,
}: {
  snapshot: ReportSnapshot;
  onBack?: () => void;
  /** ISO timestamp override (tests); defaults to the render wall clock. */
  generatedAt?: string;
}) {
  const generated = dateOnly(generatedAt ?? new Date().toISOString());
  const unit = snapshot.units.metadata;
  const conclusions = buildConclusions(snapshot);
  const nextInspection = earliestNextInspection(snapshot);
  const ruleRef = citationRef(REINSPECTION_CITATION_ID);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {/* Top banner — on the dark chrome, per the mock. */}
      <section
        className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-primary"
        aria-label="Report preview ready"
      >
        <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Report preview ready</p>
          <p className="text-xs text-muted-foreground">
            Generation unlocks in Phase 4. You can review the full layout now.
          </p>
        </div>
      </section>

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
            <span className="whitespace-nowrap rounded-full border border-recheck/40 bg-card px-3 py-1.5 text-[11px] uppercase tracking-wide text-recheck">
              Pending inspector sign-off
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
              <label htmlFor="inspector-name" className="text-xs">Name</label>
              <input
                id="inspector-name"
                placeholder="Full name"
                disabled
                className="h-12 rounded-lg border border-input bg-card px-3 outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="certification" className="text-xs">Certification</label>
              <input
                id="certification"
                placeholder="Certification or license"
                disabled
                className="h-12 rounded-lg border border-input bg-card px-3 outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="signoff-date" className="text-xs">Date</label>
              <input
                id="signoff-date"
                placeholder="YYYY-MM-DD"
                disabled
                className="h-12 rounded-lg border border-input bg-card px-3 outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs">Signature</span>
            <div className="h-10 border-b border-border" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">
              Sign after reviewing the findings.
            </span>
          </div>
        </section>

        <footer className="border-t border-border pt-4 font-mono text-xs leading-5 text-muted-foreground">
          This report is an engineering aid based on supplied measurements and
          stated assumptions. Confirm findings, calculations, and disposition
          through the responsible inspector and applicable procedures.
        </footer>
      </article>

      {/* Action footer — generation gated to Phase 4 (locked decision). */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="h-10 rounded-lg border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
        >
          Back to results
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="h-10 cursor-not-allowed rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground opacity-50"
          >
            Download PDF
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="h-10 cursor-not-allowed rounded-lg border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground opacity-50"
          >
            Print report
          </button>
          <span className="ml-2 text-xs text-muted-foreground">
            Available after inspector sign-off
          </span>
        </div>
      </div>
    </div>
  );
}
