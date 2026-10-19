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
 * VIS-03 (Phase 09): a collapsible "Visual Inspection Analytics" panel mounts
 * above the findings tabs — the CML heatmap (one cell per evaluated CML via
 * the shared buildLatestPerCml adapter), the governing-CML trend curve, and
 * the safety-margin gauge. The heatmap's onSelect relay drives the
 * results-table row highlight (selectedCmlId → ResultsTable
 * highlightedCmlId); all values are precomputed evaluate() outputs — the
 * panel derives no engineering number.
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
import { Search } from "lucide-react";
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
} from "@/lib/report/audit";
import {
  REPORT_UNIT_ASSUMPTION_COPY,
  VERDICT_GLOSSARY,
  VERDICT_GLOSSARY_ORDER,
  citationRef,
} from "@/lib/report/content";
import { FindingsBrief } from "@/components/wizard/findings-brief";
import { verdictLabel } from "@/components/wizard/verdict-chip";
import { CmlHeatmap } from "@/components/analytics/cml-heatmap";
import { TrendCurve } from "@/components/analytics/trend-curve";
import { MetricGauge } from "@/components/analytics/metric-gauge";
import {
  buildGoverningTrendPoints,
  buildLatestPerCml,
} from "@/lib/analytics/adapters";
import { toMm } from "@/lib/calc/units";
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
  accentBorder,
}: {
  label: string;
  value: number;
  valueClass?: string;
  accentBorder?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 rounded-none border border-border bg-card p-4 text-left ${accentBorder ?? ""}`}>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className={`font-mono text-2xl font-semibold ${valueClass ?? ""}`}>
        {value.toLocaleString("en-US")}
      </span>
    </div>
  );
}

/** Hook testid for the heatmap→table highlight relay (VIS-03). */
export const ROW_HIGHLIGHTED_TESTID = "results-row-highlighted";

/**
 * VIS-03 — collapsible "Visual Inspection Analytics" panel (Phase 09).
 *
 * Mounts the three web analytics components above the findings tabs/table.
 * Everything is fed by the pure lib/analytics adapters from the REAL
 * readings: the heatmap receives one item per evaluated CML
 * (buildLatestPerCml — latest reading wins, dense row-major grid), the trend
 * curve the governing CML's dated history (buildGoverningTrendPoints), and
 * the gauge the governing CML's safety margin (t-actual vs t-required with
 * t-nominal as the 100% reference, unit-converted like the eval engine) plus
 * its governing CR. Clicking a heatmap cell relays the CML identity upward —
 * the host table highlights the matching row (see ResultsTable's
 * highlightedCmlId hook). Zero readings render the friendly empty state —
 * never an empty SVG shell. Derives no engineering number: the geometry
 * engine projects precomputed evaluate() outputs only.
 */
function VisualAnalyticsPanel({
  readings,
  metadata,
  selectedCmlId,
  onSelectCml,
}: {
  readings: ReadingResult[];
  metadata: ComponentMetadata;
  selectedCmlId: string | null;
  onSelectCml: (cmlId: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const heatmapItems = useMemo(() => buildLatestPerCml(readings), [readings]);
  const governing = useMemo(
    () => buildGoverningTrendPoints(readings),
    [readings],
  );
  const gaugeReading = useMemo(
    () =>
      governing.points.length > 0
        ? readings.find(
            (r) =>
              (r.cml ?? r.location) === governing.cmlId &&
              r.date === governing.points[governing.points.length - 1].date,
          ) ?? null
        : null,
    [readings, governing],
  );
  const tNominalMm = toMm(metadata.tNominal, "mm");

  return (
    <section
      aria-label="Visual Inspection Analytics"
      data-testid="visual-analytics-panel"
      className="rounded-none border border-border bg-card p-4"
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <h2 className="text-sm font-semibold tracking-wide">
          Visual Inspection Analytics
        </h2>
        <svg
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
          className={expanded ? "rotate-180" : ""}
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {expanded ? (
        heatmapItems.length === 0 ? (
          <p
            data-testid="visual-analytics-empty"
            className="mt-3 rounded border border-border bg-background px-3 py-2 text-sm text-muted-foreground"
          >
            No evaluated CML locations to visualize — run the evaluation on an
            ingested register first.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-4 xl:flex-row">
            <div className="flex-[3]">
              <CmlHeatmap
                cmls={heatmapItems}
                governingClause="API 570 §4.3 — thickness monitoring"
                onSelect={(item) => onSelectCml(item?.cmlId ?? null)}
                selectedCmlId={selectedCmlId}
              />
            </div>
            <div className="flex flex-[2] flex-col gap-4">
              <TrendCurve
                points={governing.points}
                tRequiredMm={governing.tRequiredMm}
                crGoverningMmYr={governing.crGoverningMmYr ?? 0}
                gaugeUncertaintyMm={toMm(metadata.gaugeUncertainty, "mm")}
              />
              <MetricGauge
                label="Governing CML safety margin"
                currentMm={gaugeReading?.tActualMm ?? 0}
                tRequiredMm={governing.tRequiredMm}
                tNominalMm={tNominalMm}
                crMmYr={governing.crGoverningMmYr}
              />
            </div>
          </div>
        )
      ) : null}
    </section>
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
  // VIS-03: the heatmap's selected CML — relayed straight into the results
  // table's row-highlight hook (ResultsTable highlightedCmlId).
  const [selectedCmlId, setSelectedCmlId] = useState<string | null>(null);
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
    "border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground";
  const TAB_ACTIVE = "border-b-2 border-primary px-3 py-2 text-sm font-semibold text-foreground";

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
        <section className="flex flex-col gap-2 rounded-none border border-border bg-card p-6 sm:p-8">
          <p className="text-sm text-muted-foreground">
            Evaluation complete
          </p>
          <h1
            tabIndex={-1}
            data-screen-heading
            className="text-3xl font-semibold tracking-tight outline-none focus:outline-none focus-visible:outline-none"
          >
            Your findings are ready
          </h1>
          <p className="text-base text-muted-foreground">
            {`We've checked ${summary.total.toLocaleString("en-US")} readings and surfaced the items that deserve a closer look.`}
          </p>
        </section>

        {/* "What we found" brief (REPT-04, UI-6.1) — locked position: below
            the hero card, ABOVE the KPI cards, inside the gap-6 stack (no new
            wrapper spacing). Fed exclusively by the 06-01 pure builder. */}
        <FindingsBrief summary={summary} readings={results.readings} />

        {/* KPI stat cards — real evaluation counts only (never mock numbers). */}
        <section aria-label="Finding metrics" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Accepted" value={summary.accept} valueClass="text-green-400" />
          <KpiCard label="Re-check" value={summary.reCheck} valueClass="text-amber-400" />
          <KpiCard label="Fail" value={summary.fail} valueClass="text-red-400" accentBorder="border-l-4 border-l-[var(--fail)]" />
          <KpiCard label="Locations" value={summary.locations} />
        </section>

        {/* VIS-03 — collapsible analytics panel, above the findings controls.
            The heatmap onSelect relay drives the table row highlight below. */}
        <VisualAnalyticsPanel
          readings={results.readings}
          metadata={metadata}
          selectedCmlId={selectedCmlId}
          onSelectCml={setSelectedCmlId}
        />

        {/* Tabs + search + legend — LOCAL state only. */}
        <section aria-label="Findings controls" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 border-b border-border sm:border-b-0" role="group" aria-label="Findings filter">
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
                className="w-full rounded-none border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div
            aria-label="Finding legend"
            className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-mono"
          >
            <span>Legend</span>
            <span className="text-green-400">● Accepted</span>
            <span className="text-amber-400">● Re-check</span>
            <span className="text-red-400">● Fail</span>
          </div>
        </section>

        {visibleReadings.length === 0 ? (
          <p className="rounded-none border border-border bg-card p-6 text-sm text-muted-foreground">
            No readings match the current filters.
          </p>
        ) : (
          <ResultsTable
            readings={visibleReadings}
            page={page}
            onPageChange={onPageChange}
            metadata={metadata}
            evaluatedAt={evaluatedAt ?? undefined}
            highlightedCmlId={selectedCmlId}
          />
        )}

        {/* Verdict glossary footer (REPT-06, UI-6.9/UI-6.10) — one shared
            VERDICT_GLOSSARY constant (same source as the report + PDF
            renderers), rendered beneath the table / empty-state and above the
            mono footnotes. Real text — never a tooltip (UI-6.25); clause
            sub-lines composed ONLY via citationRef. Dot classes match the
            "Finding legend" dots above; chip strings are untouched. */}
        <div aria-label="Verdict glossary" className="flex flex-col gap-1">
          {VERDICT_GLOSSARY_ORDER.map((verdict) => {
            const entry = VERDICT_GLOSSARY[verdict];
            const dotClass =
              verdict === "accept"
                ? "text-green-400"
                : verdict === "re_check"
                  ? "text-amber-400"
                  : "text-red-400";
            return (
              <div key={verdict} className="flex flex-col gap-0.5">
                <p className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={dotClass} aria-hidden="true">●</span>
                  <span className="font-semibold">{verdictLabel(verdict)}</span>
                  <span aria-hidden="true" className="text-muted-foreground">—</span>
                  <span className="text-xs text-muted-foreground">{entry.plain}</span>
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {citationRef(entry.citationId ?? "")}
                </p>
              </div>
            );
          })}
        </div>

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
        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-none border border-border bg-card px-4 py-3">
          <button
            type="button"
            onClick={onBackToMetadata}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to metadata
          </button>
          <div className="flex items-center gap-3">
            {savedVisible && (
              <span role="status" className="font-mono text-xs text-muted-foreground">
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
          className="rounded-none border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
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
        <div className="mt-6 rounded-none border border-border bg-card p-6">
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
