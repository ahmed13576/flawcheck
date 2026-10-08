"use client";

/**
 * Results table — Screen 3 primary region (UI-13/14/16..19, UI-24). Real
 * table, th scope=col, 50-row pagination with the 'Showing 1–50 of 4,912'
 * caption. Ten locked columns in exact order; numeric cells font-mono
 * tabular-nums whitespace-nowrap; identifier cells truncate with title; null
 * maps to '—' (+ 'insufficient corrosion history' sub-text) — the strings
 * Infinity/NaN can never render (lib/wizard/format degrades non-finite to
 * '—'). G14: immediate-inspection readings render the fail-tone 'Immediate
 * inspection required' text — never a date or negative interval.
 *
 * Flowstep restyle (03-00b Task 1): token classes throughout, plus the sticky
 * CML/Location + Verdict cluster (binding C1/C3) inside the preserved
 * overflow-x-auto wrapper. 03-01 Task 2 extends the cluster to the 11-column
 * contract: trailing Reasoning column (sticky right-0), Verdict shifted to
 * the Reasoning column's fixed-width right offset, per-row View/Hide
 * reasoning toggles opening colSpan-11 ReasoningPane detail rows, and the
 * one-shot narrative fetch (tracer glue; 03-03's hook supersedes it).
 * resultRowKey namespacing and the locked order of the first ten columns
 * untouched.
 */
import { useMemo, useState } from "react";
import type { ComponentMetadata, ReadingResult, ReadingFlag, Unit } from "@/lib/ingest/session";
import {
  formatFixed,
  formatCaption,
  nextInspectionCell,
  rlCell,
} from "@/lib/wizard/format";
import { VerdictChip, FlagChip } from "@/components/wizard/verdict-chip";
import { FlagDetailRow } from "@/components/wizard/flag-detail-row";
import { ReasoningPane, type NarrativeEntryState } from "@/components/wizard/reasoning-pane";
import { useReasoning } from "@/components/wizard/reasoning-context";
import {
  useNarrativeStream,
  narrativeKey,
} from "@/hooks/use-narrative-stream";
import type { NarrativeRequest, ExtractionResult } from "@/lib/reasoning/schemas";
import type { NarrativeHistory } from "@/lib/reasoning/narrative-context";

export const RESULTS_PAGE_SIZE = 50;

const TOGGLEABLE_FLAGS: ReadingFlag[] = ["measurement_inconsistency", "outlier"];

const NUMERIC_CELL = "border border-border px-3 py-2 font-mono tabular-nums whitespace-nowrap";

/**
 * Sticky cluster (binding C1/C3, 03-00b → extended to the 11-column contract
 * by 03-01): the first column (CML/Location) pins left; the Verdict and the
 * trailing Reasoning column pin right — Verdict at the Reasoning column's
 * fixed width offset so BOTH stay visible during horizontal scroll, and the
 * Reasoning toggle stays reachable at 1366×768. Cells carry OPAQUE token
 * backgrounds (bg-card thead / bg-background body) — a translucent sticky
 * cell would show scrolled content underneath — and a z-index above plain
 * cells. Module-level string constants keep the classes static for Tailwind's
 * scanner. UI auditor note: the Verdict offset extension + Reasoning column
 * are 03-01's additions on top of 03-00b's cluster.
 */
const STICKY_LEFT_TH = "sticky left-0 z-30 bg-card";
const STICKY_LEFT_TD = "sticky left-0 z-10 bg-background";
const STICKY_RIGHT_TH = "sticky right-0 z-30 bg-card";
const STICKY_RIGHT_TD = "sticky right-0 z-10 bg-background";
/** Reasoning column width = the fixed right offset for the Verdict column. */
const REASONING_COL_WIDTH = "w-[9.5rem]";
const STICKY_VERDICT_TH = "sticky right-[9.5rem] z-30 bg-card";
const STICKY_VERDICT_TD = "sticky right-[9.5rem] z-10 bg-background";

const REASONING_TOGGLE =
  "inline-flex h-6 items-center gap-1 rounded border border-border px-2 text-xs font-semibold hover:border-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

/**
 * CML narrative request body (CR-01). Exported pure for the node test-suite.
 * The provider's extraction pack rides along when extraction is complete —
 * the route's Pitfall-5 guard 422s every enabled cml request carrying
 * `extraction: null`; while extraction is pending/failed the caller does not
 * open panes at all (allowNarration is false → the store answers with the
 * UI-41 error entry instead of fetching). `history` carries the reading's
 * positional campaign history (IN-01 seam) — null for a first campaign.
 */
export function narrativeRequestBody(
  reading: ReadingResult,
  metadata: ComponentMetadata,
  evaluatedAt: string,
  opts: {
    /** CR-03: the declared metadata unit — required by the strict schema. */
    metadataUnit?: Unit;
    extraction?: ExtractionResult | null;
    history?: NarrativeHistory | null;
  } = {},
): Extract<NarrativeRequest, { kind: "cml" }> {
  return {
    kind: "cml",
    evaluatedAt,
    reading,
    metadata: { ...metadata, metadataUnit: opts.metadataUnit ?? "mm" },
    extraction: opts.extraction ?? null,
    history: opts.history ?? null,
  };
}

/**
 * WR-04: 'duplicate reading ID' is a warning that never blocks, so identical
 * IDs can co-locate in results.readings. Keys and detail-* DOM ids therefore
 * namespace by the reading's absolute position — readingId alone would
 * duplicate React keys and break the aria-expanded/aria-controls wiring.
 */
export function resultRowKey(readingId: string, index: number): string {
  return `${readingId}-${index}`;
}

function FlagChipButton({
  rowKey,
  flag,
  expanded,
  onToggle,
}: {
  rowKey: string;
  flag: ReadingFlag;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (flag === "immediate_inspection") {
    return (
      <span className="inline-flex h-6 items-center rounded border border-red-500/40 px-2 text-xs font-semibold uppercase tracking-wide text-red-400">
        IMMEDIATE INSPECTION REQUIRED
      </span>
    );
  }
  if (!TOGGLEABLE_FLAGS.includes(flag)) {
    return <FlagChip flag={flag} />;
  }
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={`detail-${rowKey}-${flag}`}
      onClick={onToggle}
      className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
    >
      <FlagChip flag={flag} />
    </button>
  );
}

/**
 * Full-width (colSpan 11) reasoning detail row beneath a CML row — the
 * FlagDetailRow pattern extended (UI-25). Exported pure so the node test-suite
 * can SSR-render it directly (expansion is client state).
 */
export function ReasoningDetailRow({
  rowKey,
  reading,
  metadata,
  metadataUnit,
  entry,
  onRetry,
}: {
  rowKey: string;
  reading: ReadingResult;
  metadata?: ComponentMetadata;
  /** CR-03: declared metadata unit — the pane converts gauge uncertainty to mm. */
  metadataUnit?: Unit;
  entry?: NarrativeEntryState;
  onRetry?: () => void;
}) {
  const effectiveEntry: NarrativeEntryState =
    entry ?? {
      status: "error",
      text: "",
      errorReason: "narrative request unavailable in this render context",
    };
  return (
    <tr className="bg-background">
      <td id={`reasoning-${rowKey}`} colSpan={11} className="px-6 py-2">
        {metadata ? (
          <>
            <ReasoningPane
              reading={reading}
              metadata={metadata}
              metadataUnit={metadataUnit}
              entry={effectiveEntry}
            />
            {effectiveEntry.status === "error" && onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
              >
                Retry narrative
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Reasoning pane requires the session metadata slice.
          </p>
        )}
      </td>
    </tr>
  );
}

export function ResultsTable({
  readings,
  page,
  onPageChange,
  metadata,
  evaluatedAt,
}: {
  readings: ReadingResult[];
  page: number;
  onPageChange: (page: number) => void;
  /** Session slice for the narrative tracer glue (absent → panes render the
   * error state; the demo path always supplies both via Screen 3). */
  metadata?: ComponentMetadata;
  evaluatedAt?: string;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [reasoningOpen, setReasoningOpen] = useState<Record<string, boolean>>({});
  // CR-01/WR-01: ONE provider-owned store + narration gate for the whole app —
  // a second module-level store here would double the FIFO cap, hide CML
  // narratives from the status bar, and bypass the UI-41 allowNarration gate.
  const { store, extraction, allowNarration, historyFor, metadataUnit } = useReasoning();
  const { getEntry } = useNarrativeStream(store);

  const pageCount = Math.max(1, Math.ceil(readings.length / RESULTS_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * RESULTS_PAGE_SIZE;
    return readings.slice(start, start + RESULTS_PAGE_SIZE);
  }, [readings, safePage]);

  const start = (safePage - 1) * RESULTS_PAGE_SIZE + 1;
  const end = Math.min(safePage * RESULTS_PAGE_SIZE, readings.length);
  const colCount = 11;

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  /** The provider's extraction pack — null while extraction is pending/failed
   * (allowNarration is false then, so open() errors with the UI-41 reason
   * instead of fetching and the route never sees a null-pack enabled call). */
  const extractionPack = extraction.state === "complete" ? extraction.pack : null;

  const toggleReasoning = (rowKey: string, reading: ReadingResult, dataIndex: number) => {
    setReasoningOpen((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }));
    // Store-backed lazy open (UI-31/UI-44): first open fetches; re-opens hit
    // the evaluatedAt-keyed cache and issue zero fetches. Metadata/evaluatedAt
    // absent → entryFor renders the error state (demo path always supplies).
    if (metadata === undefined || evaluatedAt === undefined) return;
    const key = narrativeKey(evaluatedAt, "cml", rowKey);
    if (store.get(key) !== undefined) return;
    store.open(
      key,
      narrativeRequestBody(reading, metadata, evaluatedAt, {
        metadataUnit,
        extraction: extractionPack,
        history: historyFor(dataIndex),
      }),
      { allowNarration },
    );
  };

  const retryNarrative = (rowKey: string, reading: ReadingResult, dataIndex: number) => {
    if (metadata === undefined || evaluatedAt === undefined) return;
    store.retry(
      narrativeKey(evaluatedAt, "cml", rowKey),
      narrativeRequestBody(reading, metadata, evaluatedAt, {
        metadataUnit,
        extraction: extractionPack, // rebuilt with the CURRENT extraction state (WR-03)
        history: historyFor(dataIndex),
      }),
    );
  };

  const entryFor = (rowKey: string): NarrativeEntryState =>
    (evaluatedAt !== undefined ? getEntry(narrativeKey(evaluatedAt, "cml", rowKey)) : undefined) ?? {
      status: "error",
      text: "",
      errorReason: "narrative request unavailable in this render context",
    };

  return (
    <section aria-label="CML results" className="rounded-lg border border-border bg-card p-4">
      <div className="overflow-x-auto">
        <p className="sr-only sm:not-sr-only text-[11px] text-muted-foreground pb-1">
          Tip: Scroll horizontally to view all measurements and verdicts. Sticky columns remain pinned.
        </p>
        <table className="min-w-[1100px] w-full border-collapse text-sm">
          <caption className="px-1 pb-2 text-left text-xs text-muted-foreground">
            {formatCaption(start, end, readings.length)}
          </caption>
          <thead>
            <tr className="bg-card text-left">
              <th scope="col" className={`border border-border px-3 py-2 whitespace-nowrap ${STICKY_LEFT_TH}`}>CML / Location</th>
              <th scope="col" className="border border-border px-3 py-2 whitespace-nowrap">t-actual (mm)</th>
              <th scope="col" className="border border-border px-3 py-2 whitespace-nowrap">t-required (mm)</th>
              <th scope="col" className="border border-border px-3 py-2 whitespace-nowrap">CR_LT (mm/yr)</th>
              <th scope="col" className="border border-border px-3 py-2 whitespace-nowrap">CR_ST (mm/yr)</th>
              <th scope="col" className="border border-border px-3 py-2 whitespace-nowrap">CR governing (mm/yr)</th>
              <th scope="col" className="border border-border px-3 py-2 whitespace-nowrap">RL (yr)</th>
              <th scope="col" className="border border-border px-3 py-2 whitespace-nowrap min-w-[13rem]">Next inspection</th>
              <th scope="col" className="border border-border px-3 py-2 whitespace-nowrap">Flags</th>
              <th scope="col" className={`border border-border px-3 py-2 whitespace-nowrap ${STICKY_VERDICT_TH}`}>Verdict</th>
              <th scope="col" className={`border border-border px-3 py-2 whitespace-nowrap ${STICKY_RIGHT_TH} ${REASONING_COL_WIDTH}`}>Reasoning</th>
            </tr>
          </thead>
          <tbody>
            {pageSlice.map((reading, i) => {
              const rl = rlCell(reading);
              const next = nextInspectionCell(reading);
              // Absolute position in the FULL readings array — the history seam
              // is positionally aligned to it (groupByCml 1:1 with inputs).
              const dataIndex = start - 1 + i;
              const rowKey = resultRowKey(reading.readingId, dataIndex);
              return (
                [
                  <tr key={rowKey} className="bg-background">
                    <td className={`border border-border px-3 py-2 ${STICKY_LEFT_TD}`}>
                      <span
                        className="block max-w-[14rem] truncate"
                        title={reading.cml ?? reading.location}
                      >
                        {reading.cml ?? reading.location}
                      </span>
                    </td>
                    <td className={NUMERIC_CELL}>{formatFixed(reading.tActualMm, 2)}</td>
                    <td className={NUMERIC_CELL}>{formatFixed(reading.tRequiredMm, 2)}</td>
                    <td className={NUMERIC_CELL}>{formatFixed(reading.crLtMmYr, 3)}</td>
                    <td className={NUMERIC_CELL}>{formatFixed(reading.crStMmYr, 3)}</td>
                    <td className={`${NUMERIC_CELL} font-semibold`}>
                      {formatFixed(reading.crGoverningMmYr, 3)}
                    </td>
                    <td className={NUMERIC_CELL}>
                      {rl.kind === "dash" ? (
                        <>
                          <span>—</span>
                          {rl.subText && (
                            <span className="block text-xs font-normal text-[#a3a3a3]">
                              {rl.subText}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span>{rl.text}</span>
                          {rl.subText && (
                            <span className="block text-[10px] font-semibold tracking-tight text-fail">
                              {rl.subText}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="border border-border px-3 py-2 whitespace-nowrap min-w-[13rem]">
                      {next.kind === "immediate" ? (
                        <span className="font-semibold text-fail">
                          Immediate inspection required
                        </span>
                      ) : next.kind === "date" ? (
                        <>
                          <span className="font-mono tabular-nums">{next.date}</span>
                          <span className="ml-1 text-xs text-muted-foreground">
                            {`(interval ${next.intervalYears.toFixed(1)} yr)`}
                          </span>
                        </>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td className="border border-border px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {reading.flags.map((flag) => (
                          <FlagChipButton
                            key={flag}
                            rowKey={rowKey}
                            flag={flag}
                            expanded={Boolean(expanded[`${rowKey}-${flag}`])}
                            onToggle={() => toggle(`${rowKey}-${flag}`)}
                          />
                        ))}
                      </div>
                    </td>
                    <td className={`border border-border px-3 py-2 ${STICKY_VERDICT_TD}`}>
                      <VerdictChip verdict={reading.verdict} />
                    </td>
                    <td className={`border border-border px-3 py-2 ${STICKY_RIGHT_TD} ${REASONING_COL_WIDTH}`}>
                      <button
                        type="button"
                        className={REASONING_TOGGLE}
                        aria-expanded={Boolean(reasoningOpen[rowKey])}
                        aria-controls={`reasoning-${rowKey}`}
                        onClick={() => toggleReasoning(rowKey, reading, dataIndex)}
                      >
                        <svg
                          viewBox="0 0 16 16"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          aria-hidden="true"
                          className={`transition-transform motion-reduce:transition-none ${reasoningOpen[rowKey] ? "rotate-180" : ""}`}
                        >
                          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {reasoningOpen[rowKey] ? "Hide reasoning" : "View reasoning"}
                      </button>
                    </td>
                  </tr>,
                  ...reading.flags
                    .filter(
                      (flag) =>
                        TOGGLEABLE_FLAGS.includes(flag) && expanded[`${rowKey}-${flag}`],
                    )
                    .map((flag) => (
                      <FlagDetailRow
                        key={`${rowKey}-${flag}`}
                        rowKey={rowKey}
                        reading={reading}
                        flag={flag}
                        colSpan={colCount}
                      />
                    )),
                  ...(reasoningOpen[rowKey]
                    ? [
                        <ReasoningDetailRow
                          key={`${rowKey}-reasoning`}
                          rowKey={rowKey}
                          reading={reading}
                          metadata={metadata}
                          metadataUnit={metadataUnit}
                          entry={entryFor(rowKey)}
                          onRetry={
                            metadata !== undefined && evaluatedAt !== undefined
                              ? () => retryNarrative(rowKey, reading, dataIndex)
                              : undefined
                          }
                        />,
                      ]
                    : []),
                ]
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="rounded border border-border px-3 py-1.5 font-semibold hover:border-muted-foreground disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-xs text-muted-foreground">
          Page {safePage.toLocaleString("en-US")} of {pageCount.toLocaleString("en-US")}
        </span>
        <button
          type="button"
          disabled={safePage >= pageCount}
          onClick={() => onPageChange(safePage + 1)}
          className="rounded border border-border px-3 py-1.5 font-semibold hover:border-muted-foreground disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </section>
  );
}
