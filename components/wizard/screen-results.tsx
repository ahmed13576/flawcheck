"use client";

/**
 * Screen 3 — Evaluation Results, read-only, Flowstep restyle (03-00b Task 1,
 * flowstep-gui/Screen 3.png binding layout): hero card + 4 KPI stat cards fed
 * ONLY by real summary counts (the mock's 3,812/876/224/42 are placeholder
 * data — never rendered), All findings / Needs attention tabs + CML search
 * (LOCAL component state — the reducer is untouched; filter changes reset the
 * table's page via the existing set-page action), sticky summary strip, the
 * results table with the sticky CML+Verdict cluster, PT/MT "Recommended next
 * step" triage cards, mono footnotes, and the footer nav with "Open report
 * preview" ENABLED (04-01 Task 3, UI-56: the CTA unlocks — it routes to
 * /report). Zero-result edge (UI-15) and the demo provenance banner (UI-21,
 * wizard root) are preserved; focus lands on this screen's heading (UI-22).
 *
 * ScreenResultsContent is the pure presentational layer (node-testable — the
 * FS-09..FS-11 pins render it directly); ScreenResults wires the wizard
 * context, the report-snapshot auto-write/Save-review path, pagination
 * dispatch, and the /report navigation. The live audit writer (REPT-02,
 * 04-01) renders inside the ReasoningProvider so telemetry is resolved from
 * the REAL extraction state + narrative store — never fabricated (UI-54).
 */
import { useEffect, useRef, useState, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { useWizard } from "@/components/wizard/wizard-context";
import { SummaryStrip } from "@/components/wizard/summary-strip";
import { ReasoningProvider, useReasoning } from "@/components/wizard/reasoning-context";
import { PipelineStatusBar } from "@/components/wizard/pipeline-status-bar";
import { ResultsTable } from "@/components/wizard/results-table";
import { PtmtTriageList } from "@/components/wizard/ptmt-triage-list";
import { formatEvaluatedAt } from "@/lib/wizard/format";
import { Button } from "@/components/ui/button";
import {
  buildReportSnapshot,
  writeReportSnapshot,
} from "@/lib/report/session-snapshot";
import {
  buildAuditSteps,
  computeInputHash,
  writeReportAudit,
  type AuditTelemetry,
  type ReportAudit,
} from "@/lib/report/audit";
import { REPORT_UNIT_ASSUMPTION_COPY } from "@/lib/report/content";
import type {
  ComponentMetadata,
  EvaluationResults,
  ParsedRow,
  PtmIndication,
  ReadingResult,
  Unit,
} from "@/lib/ingest/session";
import type { TargetField } from "@/lib/ingest/session";

export type ResultsTab = "all" | "attention";

/**
 * Filter changes (tab or query) always reset the table's page to 1 — the
 * pagination mechanics themselves are untouched (RESULTS_PAGE_SIZE stays 50).
 * Exported so the FS-10 pin covers the reset contract in the node suite
 * (no DOM events there).
 */
export const FILTER_RESET_PAGE = 1;

/**
 * "Needs attention" (mock tab semantics): any re_check/reject verdict OR any
 * data-quality flag. Exported pure for the node test-suite.
 */
export function needsAttention(reading: ReadingResult): boolean {
  return (
    reading.verdict === "re_check" ||
    reading.verdict === "reject" ||
    reading.flags.length > 0
  );
}

/**
 * Tab + search compose; the query matches the CML id or the location
 * description case-insensitively. Pure — the page reset on filter change is
 * dispatched by the container (the reducer is untouched).
 */
export function filterReadings(
  readings: ReadingResult[],
  tab: ResultsTab,
  query: string,
): ReadingResult[] {
  const q = query.trim().toLowerCase();
  if (tab === "all" && q === "") return readings;
  return readings.filter((reading) => {
    if (tab === "attention" && !needsAttention(reading)) return false;
    if (q !== "") {
      const haystack = `${reading.cml ?? ""} ${reading.location}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function KpiCard({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono text-xl ${valueClass ?? ""}`}>
        {value.toLocaleString("en-US")}
      </span>
    </div>
  );
}

export interface ScreenResultsContentProps {
  results: EvaluationResults;
  units: { csvThickness: Unit; metadata: Unit };
  sourceFilename: string;
  csvRowCount: number;
  evaluatedAt: string | null;
  /** Session metadata slice for the results table's narrative glue (03-01). */
  metadata: ComponentMetadata;
  page: number;
  onPageChange: (page: number) => void;
  onBackToMetadata: () => void;
  onSaveReview: () => void;
  onOpenReport: () => void;
  /** Session slices for the reasoning provider (03-04): extraction input +
   * groupByCml history seam. */
  rows: ParsedRow[];
  mapping: Record<TargetField, string | null>;
  notes: string;
  indications: PtmIndication[];
}

export function ScreenResultsContent({
  results,
  units,
  sourceFilename,
  csvRowCount,
  evaluatedAt,
  metadata,
  page,
  onPageChange,
  onBackToMetadata,
  onSaveReview,
  onOpenReport,
  rows,
  mapping,
  notes,
  indications,
}: ScreenResultsContentProps) {
  const [tab, setTab] = useState<ResultsTab>("all");
  const [unresolvedCitations, setUnresolvedCitations] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [savedVisible, setSavedVisible] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleReadings = useMemo(
    () => filterReadings(results.readings, tab, query),
    [results.readings, tab, query],
  );

  // Filter changes compose and reset the table's page to 1 — pagination
  // mechanics themselves are untouched (RESULTS_PAGE_SIZE stays 50).
  const changeTab = (next: ResultsTab) => {
    setTab(next);
    onPageChange(FILTER_RESET_PAGE);
  };
  const changeQuery = (value: string) => {
    setQuery(value);
    onPageChange(FILTER_RESET_PAGE);
  };

  const handleSave = () => {
    onSaveReview();
    setSavedVisible(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSavedVisible(false), 2500);
  };

  const summary = results.summary;
  const TAB_IDLE =
    "rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground";
  const TAB_ACTIVE = "rounded-lg bg-secondary px-3 py-2 text-sm font-semibold";

  return (
    <section aria-label="Screen 3 — Results">
      <ReasoningProvider
        key={evaluatedAt ?? "none"}
        results={results}
        metadata={metadata}
        notes={notes}
        indications={indications}
        units={units}
        evaluatedAt={evaluatedAt ?? ""}
        rows={rows}
        mapping={mapping}
      >
        <AuditWriter
          evaluatedAt={evaluatedAt}
          rows={rows}
          mapping={mapping}
          units={units}
        />
        <StatusRegion />
        <div key={evaluatedAt ?? "none"} className="flex flex-col gap-6">
        <SummaryStrip summary={summary} />

        {/* Hero card — copy strings from Screen 3.png; n is the REAL count. */}
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-8">
          <span className="text-xs font-semibold uppercase tracking-[1.5px] text-primary">
            Evaluation complete
          </span>
          <h1
            tabIndex={-1}
            data-screen-heading
            className="text-3xl font-semibold tracking-tight"
          >
            Your findings are ready
          </h1>
          <p className="text-base text-muted-foreground">
            {`We've checked ${summary.total.toLocaleString("en-US")} readings and surfaced the items that deserve a closer look.`}
          </p>
        </section>

        {/* KPI stat cards — real evaluation counts only (never mock numbers). */}
        <section aria-label="Finding metrics" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Accepted" value={summary.accept} valueClass="text-green-400" />
          <KpiCard label="Re-check" value={summary.reCheck} valueClass="text-amber-400" />
          <KpiCard label="Fail" value={summary.fail} valueClass="text-red-400" />
          <KpiCard label="Locations" value={summary.locations} />
        </section>

        {/* Tabs + search + legend — LOCAL state only. */}
        <section aria-label="Findings controls" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2" role="group" aria-label="Findings filter">
              <button
                type="button"
                aria-pressed={tab === "all"}
                onClick={() => changeTab("all")}
                className={tab === "all" ? TAB_ACTIVE : TAB_IDLE}
              >
                All findings
              </button>
              <button
                type="button"
                aria-pressed={tab === "attention"}
                onClick={() => changeTab("attention")}
                className={tab === "attention" ? TAB_ACTIVE : TAB_IDLE}
              >
                Needs attention
              </button>
            </div>
            <div className="relative w-80 max-w-full">
              <Search
                className="absolute left-3 top-2.5 size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="text"
                aria-label="Search CML or location"
                placeholder="Search CML or location"
                value={query}
                onChange={(event) => changeQuery(event.target.value)}
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div
            aria-label="Finding legend"
            className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground"
          >
            <span>Legend</span>
            <span className="text-green-400">● Accepted</span>
            <span className="text-amber-400">● Re-check</span>
            <span className="text-red-400">● Fail</span>
          </div>
        </section>

        {visibleReadings.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No readings match the current filters.
          </p>
        ) : (
          <ResultsTable
            readings={visibleReadings}
            page={page}
            onPageChange={onPageChange}
            metadata={metadata}
            evaluatedAt={evaluatedAt ?? undefined}
          />
        )}

        <PtmtTriageList
            indications={results.indications}
            evaluatedAt={evaluatedAt}
            onUnresolvedCitation={(id) =>
              setUnresolvedCitations((prev) => {
                if (prev.has(id)) return prev;
                const next = new Set(prev);
                next.add(id);
                return next;
              })
            }
          />
          {unresolvedCitations.size > 0 ? (
            <p className="font-mono text-xs text-muted-foreground">
              {`Citation audit: ${unresolvedCitations.size} unresolved citation(s) blocked at renderer.`}
            </p>
          ) : null}

        <div
          className="flex flex-col gap-2 pb-2 font-mono text-xs text-muted-foreground"
          role="status"
          aria-label="Evaluation completion"
        >
          <span>
            {REPORT_UNIT_ASSUMPTION_COPY.replace("{csv}", units.csvThickness).replace(
              "{meta}",
              units.metadata,
            )}
          </span>
          <span>
            {`Source: ${sourceFilename} · ${csvRowCount.toLocaleString("en-US")} rows` +
              (evaluatedAt ? ` · evaluated ${formatEvaluatedAt(evaluatedAt)}` : "")}
          </span>
        </div>

        {/* Footer nav — Back left; Save review + disabled preview right. */}
        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <button
            type="button"
            onClick={onBackToMetadata}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to metadata
          </button>
          <div className="flex items-center gap-3">
            {savedVisible && (
              <span role="status" className="text-xs text-muted-foreground">
                Saved — this session only
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleSave}>
              Save review
            </Button>
            <Button size="sm" onClick={onOpenReport}>
              Open report preview
            </Button>
          </div>
        </footer>
        </div>
      </ReasoningProvider>
    </section>
  );
}

/**
 * Live audit writer (REPT-02, 04-01): keyed on (evaluatedAt, extraction,
 * storeVersion) — writes the honest telemetry record to sessionStorage once
 * extraction completes (or fails/disables, with null fields). Re-evaluation
 * remounts the provider and rewrites the record; never a stale write.
 */
function AuditWriter({
  evaluatedAt,
  rows,
  mapping,
  units,
}: {
  evaluatedAt: string | null;
  rows: ParsedRow[];
  mapping: Record<TargetField, string | null>;
  units: { csvThickness: Unit; metadata: Unit };
}) {
  const { store, extraction } = useReasoning();
  useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.version(),
    () => store.version(),
  );
  const inputHashRef = useRef<Promise<string> | null>(null);
  useEffect(() => {
    if (!evaluatedAt) return;
    let cancelled = false;
    const extractionTelemetry =
      extraction.state === "complete"
        ? {
            promptTokens: extraction.usage.promptTokens,
            completionTokens: extraction.usage.completionTokens,
            latencyMs: extraction.usage.latencyMs,
            model: extraction.usage.model,
          }
        : null;
    const narrativeTelemetry =
      store.narrativeModel() !== null
        ? {
            model: store.narrativeModel() as string,
            promptTokens: store.totals().promptTokens,
            completionTokens: store.totals().completionTokens,
            latencyMs: store.totals().latencyMs,
          }
        : null;
    if (!inputHashRef.current) {
      inputHashRef.current = computeInputHash(rows, mapping, units);
    }
    inputHashRef.current.then((hash) => {
      if (cancelled) return;
      writeReportAudit({
        evaluatedAt,
        inputHash: hash,
        steps: buildAuditSteps(extractionTelemetry, narrativeTelemetry),
      });
    });
    return () => {
      cancelled = true;
    };
    // storeVersion via subscription drives re-writes on narrative completion
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluatedAt, extraction, store.version()]);

  return null; // writes only — renders nothing
}

/** Status bar + extraction-failure banner (consumes the provider). */
/** Status bar + extraction-failure banner (consumes the provider). */
function StatusRegion() {
  const { extraction } = useReasoning();
  return (
    <>
      {extraction.state === "failed" ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Extraction failed: {extraction.message}. Narrative generation was
          skipped — verdicts below are computed and unaffected. Correct the
          input and re-run the evaluation.
        </div>
      ) : null}
      <PipelineStatusBar />
    </>
  );
}

export function ScreenResults() {
  const { state, dispatch } = useWizard();
  const router = useRouter();
  const results = state.results;

  if (!results || results.readings.length === 0) {
    // UI-15 zero-result edge — empty-state copy, never a bare table shell.
    return (
      <section aria-label="Screen 3 — Results">
        <h1 tabIndex={-1} data-screen-heading className="text-xl font-semibold">
          Results
        </h1>
        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <p className="text-sm font-semibold">No evaluation yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingest a CSV and confirm metadata, then run the evaluation to see verdicts here.
          </p>
        </div>
      </section>
    );
  }

  const handleSaveReview = () => {
    const snapshot = buildReportSnapshot(state, state.ui.evaluatedAt);
    if (snapshot) writeReportSnapshot(snapshot);
  };

  return (
    <ScreenResultsContent
      results={results}
      units={state.units}
      sourceFilename={state.source.filename}
      csvRowCount={state.csv.rowCount}
      evaluatedAt={state.ui.evaluatedAt}
      metadata={state.metadata}
      page={state.ui.page}
      onPageChange={(page) => dispatch({ type: "set-page", page })}
      onBackToMetadata={() => dispatch({ type: "set-screen", screen: 2 })}
      onSaveReview={handleSaveReview}
      onOpenReport={() => router.push("/report")}
      rows={state.rows}
      mapping={state.mapping}
      notes={state.ptmt.notes}
      indications={results.indications}
    />
  );
}
