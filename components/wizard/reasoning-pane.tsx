"use client";

/**
 * ReasoningPane — 03-01 Task 2 (03-UI-SPEC "Reasoning-Pane Layout Contract").
 * Region order: (a) the deterministic chain — INPUTS / CLAUSE / LIMIT /
 * VERDICT rendered from the session's ReadingResult, visible in EVERY state
 * including error and fallback (UI-26); (b) the narrative region in one of
 * five states (loading / streaming / complete / error / fallback); (c) the
 * badge line — model badge + `tokens {n} · {s} s · —` (cost renders `—`
 * always: no price map exists, open-question resolution 2) and audit-stamp
 * lines.
 *
 * Citation rendering is renderer-enforced (UI-34/35): the pane tokenizes
 * narrative text itself; a resolved id renders a CitationChip labeled from
 * citations.json record fields; an UNRESOLVED id renders ZERO glyphs at its
 * position and gains an amber audit-stamp line naming it. An empty citations
 * array renders `—` in the CLAUSE segment (UI-48).
 *
 * Narrative region: `max-h-96 overflow-y-auto` (UI-46); prose wraps
 * (`whitespace-pre-wrap break-words`), metrics and chip labels never wrap
 * (UI-47). Model badges/caret never use the primary orange (03-00 accent
 * reserve: orange is primary-action only). entry shape = Plan 03-03's store
 * output — NarrativeEntryState is the contract between this pane and the
 * future hook.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { criteria } from "@/lib/calc/criteria";
import { formatFixed } from "@/lib/wizard/format";
import { VerdictChip } from "@/components/wizard/verdict-chip";
import { CitationChip, type CitationRecord } from "@/components/wizard/citation-chip";
import { tokenize } from "@/lib/reasoning/tokenizer";
import type { ComponentMetadata, PtmIndicationResult, ReadingResult } from "@/lib/ingest/session";

export interface NarrativeEntryState {
  status: "loading" | "streaming" | "complete" | "error" | "fallback";
  text: string;
  model?: string;
  usage?: { promptTokens: number; completionTokens: number; latencyMs: number } | null;
  errorReason?: string;
  fallbackText?: string;
}

const CITATION_RECORDS = criteria.citations as readonly CitationRecord[];

function recordFor(id: string): CitationRecord | null {
  return CITATION_RECORDS.find((c) => c.id === id) ?? null;
}

const STEP_LABEL = "text-xs uppercase tracking-wide text-muted-foreground";
const CHAIN_VALUE = "font-mono text-sm tabular-nums";
const METRICS = "font-mono text-xs tabular-nums whitespace-nowrap text-muted-foreground";
const NO_METRICS = "— · — · —";

/** Verdict basis text restating the verdicts.ts band comparison (locked order). */
function verdictBasis(reading: ReadingResult, metadata: ComponentMetadata): string {
  const tAct = formatFixed(reading.tActualMm, 2);
  const tReq = formatFixed(reading.tRequiredMm, 2);
  const unc = formatFixed(metadata.gaugeUncertainty, 2);
  if (reading.verdict === "reject") {
    return `t-actual ${tAct} mm < t-required ${tReq} mm`;
  }
  if (reading.verdict === "re_check") {
    return `t-required ${tReq} mm ≤ t-actual ${tAct} mm < t-required + ${unc} mm gauge uncertainty`;
  }
  return `t-actual ${tAct} mm ≥ t-required + ${unc} mm gauge uncertainty`;
}

/** Chip-or-nothing renderer for tokenized narrative text (zero-glyph rule). */
function NarrativeText({
  text,
  openCitation,
  onCitationToggle,
}: {
  text: string;
  openCitation: string | null;
  onCitationToggle: (id: string) => void;
}) {
  const segments = tokenize(text);
  const chunks: ReactNode[] = [];
  segments.forEach((segment, i) => {
    if (segment.kind === "text") {
      if (segment.value.length > 0) chunks.push(<span key={`t-${i}`}>{segment.value}</span>);
      return;
    }
    if (segment.kind === "incomplete") return; // zero glyphs (truncation case)
    const record = segment.resolved ? recordFor(segment.id) : null;
    if (!record) {
      // UI-35: zero glyphs at position; the id surfaces via the audit stamp
      // (the pane derives the unresolved list synchronously from the text).
      return;
    }
    chunks.push(
      <CitationChip
        key={`c-${i}-${segment.id}`}
        record={record}
        expanded={openCitation === segment.id}
        onToggle={onCitationToggle}
      />,
    );
  });
  return <>{chunks}</>;
}

/**
 * Distinct unresolved citation ids in a narrative text — resolved= false
 * cites plus incomplete (truncated) tokens. Pure, so the audit stamp renders
 * synchronously (SSR included).
 */
export function unresolvedCitationIds(text: string): string[] {
  const ids: string[] = [];
  for (const segment of tokenize(text)) {
    const id =
      segment.kind === "cite"
        ? segment.resolved
          ? null
          : segment.id
        : segment.kind === "incomplete"
          ? "(truncated token)"
          : null;
    if (id !== null && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function clockStamp(): string {
  return new Date().toTimeString().slice(0, 8);
}

export function ReasoningPane({
  reading,
  metadata,
  indication,
  entry,
  onRetry,
  onUnresolvedCitation,
}: {
  /** CML variant: the full ReadingResult chain (mutually exclusive with indication). */
  reading?: ReadingResult;
  metadata?: ComponentMetadata;
  /** PT/MT variant (03-04 Task 2): engine-emitted indication chain. */
  indication?: PtmIndicationResult;
  entry: NarrativeEntryState;
  onRetry?: () => void;
  onUnresolvedCitation?: (id: string) => void;
}) {
  if (!reading && !indication) {
    throw new Error("ReasoningPane requires reading or indication");
  }
  const isPtmt = indication !== undefined;
  const subjectId = indication ? indication.id : (reading as ReadingResult).readingId;
  const [openCitation, setOpenCitation] = useState<string | null>(null);
  const [auditClock] = useState<string>(clockStamp()); // stable per mount

  const toggleCitation = (id: string) =>
    setOpenCitation((prev) => (prev === id ? null : id));

  const ptmtChain = indication ? (
    <div className="flex flex-col gap-3">
      <div>
        <p className={STEP_LABEL}>Inputs</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <span className={`${CHAIN_VALUE} whitespace-nowrap`}>
            <span className="mr-1 font-sans text-xs text-muted-foreground">Method</span>
            {indication.method}
          </span>
          <span className={`${CHAIN_VALUE} whitespace-nowrap`}>
            <span className="mr-1 font-sans text-xs text-muted-foreground">Dimensions</span>
            {`L ${indication.lengthMm.toFixed(1)} × W ${indication.widthMm.toFixed(1)} mm`}
          </span>
          <span className={`${CHAIN_VALUE} whitespace-nowrap`}>
            <span className="mr-1 font-sans text-xs text-muted-foreground">Count</span>
            {indication.count}
          </span>
          <span className={`${CHAIN_VALUE} whitespace-nowrap`}>
            <span className="mr-1 font-sans text-xs text-muted-foreground">Edge separation</span>
            {indication.edgeSeparationMm === null
              ? "—"
              : `${indication.edgeSeparationMm.toFixed(1)} mm`}
          </span>
          <span className={`${CHAIN_VALUE} whitespace-nowrap`}>
            <span className="mr-1 font-sans text-xs text-muted-foreground">Crack suspect</span>
            {indication.crackSuspect ? "yes" : "no"}
          </span>
          {(
            [
              ["Relevance threshold", criteria.ptmt.relevance_threshold_mm],
              ["Max rounded dimension", criteria.ptmt.limits.max_rounded_dimension_mm],
            ] as const
          ).map(([label, value]) => (
            <span key={label} className={`${CHAIN_VALUE} whitespace-nowrap`}>
              <span className="mr-1 font-sans text-xs text-muted-foreground">{label}</span>
              {value} mm
            </span>
          ))}
        </div>
      </div>
      <div>
        <p className={STEP_LABEL}>Clause</p>
        <div className="mt-1 flex flex-wrap items-start gap-2">
          {(() => {
            const record = recordFor(indication.citationId);
            return record ? (
              <CitationChip
                record={record}
                expanded={openCitation === indication.citationId}
                onToggle={toggleCitation}
              />
            ) : null;
          })()}
        </div>
      </div>
      <div>
        <p className={STEP_LABEL}>Limit</p>
        <p className="mt-1 text-sm">{indication.detail}</p>
      </div>
      <div>
        <p className={STEP_LABEL}>Verdict</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <VerdictChip verdict={indication.verdict} />
        </div>
      </div>
    </div>
  ) : null;

  const chain = reading ? (
    <div className="flex flex-col gap-3">
      <div>
        <p className={STEP_LABEL}>Inputs</p>
        <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
          {(
            [
              ["t-actual", formatFixed(reading.tActualMm, 2)],
              ["t-pressure", formatFixed(reading.tPressureMm, 2)],
              ["t-structural", formatFixed(reading.tStructuralMm, 2)],
              ["t-required", formatFixed(reading.tRequiredMm, 2)],
              ["CR_LT", formatFixed(reading.crLtMmYr, 3)],
              ["CR_ST", formatFixed(reading.crStMmYr, 3)],
              ["CR governing", formatFixed(reading.crGoverningMmYr, 3)],
              ["RL", formatFixed(reading.rlYears, 1)],
            ] as const
          ).map(([label, value]) => (
            <span key={label} className={`${CHAIN_VALUE} whitespace-nowrap`}>
              <span className="mr-1 font-sans text-xs text-muted-foreground">{label}</span>
              {value}
            </span>
          ))}
        </div>
      </div>
      <div>
        <p className={STEP_LABEL}>Clause</p>
        <div className="mt-1 flex flex-wrap items-start gap-2">
          {reading.citations.length === 0 ? (
            <span className={CHAIN_VALUE}>—</span> // UI-48: never a silent gap
          ) : (
            reading.citations.map((id) => {
              const record = recordFor(id);
              return record ? (
                <CitationChip
                  key={id}
                  record={record}
                  expanded={openCitation === id}
                  onToggle={toggleCitation}
                />
              ) : null; // engine ids are always in the allowlist; defensive
            })
          )}
        </div>
      </div>
      <div>
        <p className={STEP_LABEL}>Limit</p>
        <p className={`${CHAIN_VALUE} mt-1 whitespace-nowrap`}>
          {`t-required ${formatFixed(reading.tRequiredMm, 2)} mm ± ${formatFixed((metadata as ComponentMetadata).gaugeUncertainty, 2)} mm gauge uncertainty`}
        </p>
        {reading.crGoverningMmYr !== null && (
          <p className={`${CHAIN_VALUE} whitespace-nowrap`}>
            {`CR governing ${formatFixed(reading.crGoverningMmYr, 3)} mm/yr`}
          </p>
        )}
      </div>
      <div>
        <p className={STEP_LABEL}>Verdict</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <VerdictChip verdict={reading.verdict} />
          <span className="text-sm">{verdictBasis(reading, metadata as ComponentMetadata)}</span>
        </div>
      </div>
    </div>
  )
  : ptmtChain;

  const streaming = entry.status === "streaming";
  const narrativeText = entry.status === "fallback" ? (entry.fallbackText ?? "") : entry.text;
  const unresolved = unresolvedCitationIds(narrativeText);

  // Client-side notification hook (the stamp rendering above is synchronous
  // and SSR-safe); reported ids mirror the rendered stamps exactly.
  useEffect(() => {
    if (!onUnresolvedCitation) return;
    for (const id of unresolved) onUnresolvedCitation(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrativeText]);

  return (
    <div
      className="rounded-lg border border-border bg-card p-4"
      aria-label={`Reasoning for ${subjectId}`}
    >
      {chain}

      {/* Narrative region — UI-46: internal scroll so a long rationale never
          pushes the PT/MT list and footnotes below the fold. */}
      <div className="mt-4 max-h-96 overflow-y-auto" aria-busy={streaming || undefined}>
        {entry.status === "loading" && (
          <p role="status" className="text-sm text-muted-foreground">
            Requesting narrative…
          </p>
        )}
        {streaming && (
          <>
            <p
              role="status"
              className="text-xs text-muted-foreground"
            >
              Streaming narrative…
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-normal">
              <NarrativeText
                text={entry.text}
                openCitation={openCitation}
                onCitationToggle={toggleCitation}
                
              />
              <span
                className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-muted-foreground motion-reduce:animate-none"
                aria-hidden="true"
              />
            </p>
          </>
        )}
        {entry.status === "complete" && (
          <p className="whitespace-pre-wrap break-words text-sm leading-normal">
            <NarrativeText
              text={entry.text}
              openCitation={openCitation}
              onCitationToggle={toggleCitation}
              
            />
          </p>
        )}
        {entry.status === "error" && (
          <>
            <p role="alert" className="text-sm text-fail">
              {`Narrative unavailable: ${entry.errorReason ?? "request failed"}. The computed verdict is unaffected.`}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 rounded border border-border px-3 py-1.5 text-sm font-semibold hover:border-muted-foreground"
            >
              Retry narrative
            </button>
          </>
        )}
        {entry.status === "fallback" && (
          <>
            <span className="inline-flex h-6 items-center rounded border border-border px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Deterministic fallback
            </span>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-normal">
              <NarrativeText
                text={narrativeText}
                openCitation={openCitation}
                onCitationToggle={toggleCitation}
                
              />
            </p>
            <p className={`mt-2 ${METRICS}`}>{NO_METRICS}</p>
          </>
        )}
      </div>

      {/* Badge line — 12px; model IDs verbatim (never uppercase-transformed);
          cost is always `—` (no price map, no NEBIUS_PRICE_* env). */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {entry.status === "fallback" && (
          <span className="inline-flex h-6 items-center whitespace-nowrap rounded border border-border px-2 font-semibold uppercase tracking-wide text-muted-foreground">
            Deterministic fallback
          </span>
        )}
        {entry.status === "complete" && entry.model && (
          <span className="inline-flex h-6 items-center whitespace-nowrap rounded border border-gray-600 px-2 font-semibold text-gray-400">
            {entry.model}
          </span>
        )}
        {entry.status === "complete" && (
          <span className={METRICS}>
            {entry.usage
              ? `tokens ${(entry.usage.promptTokens + entry.usage.completionTokens).toLocaleString("en-US")} · ${(entry.usage.latencyMs / 1000).toFixed(1)} s · —`
              : NO_METRICS}
          </span>
        )}
        {unresolved.map((id) => (
          <span key={id} className="w-full text-xs text-amber-400">
            {`Unresolved citation blocked: '${id}' — rendered blank (audit ${auditClock}).`}
          </span>
        ))}
      </div>
    </div>
  );
}
