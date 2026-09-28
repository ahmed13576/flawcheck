"use client";

/**
 * CitationChip — 03-01 Task 2 (03-UI-SPEC "Citation Chip Contract"). The chip
 * takes an ALREADY-RESOLVED citations.json record and renders only that
 * record's fields — it never guesses a label (SC3: LLM free text can never
 * enter the label; the pane/tokenizer own the resolve-or-blank decision).
 *
 * Label: `{record.code} {record.clause}` verbatim — NO § is synthesized; the
 * clause string is authoritative as stored. Hue note: the Phase-2 blue accent
 * remaps to the Flowstep orange primary (03-00) — a hue change only; the
 * chip's data contract is untouched (flagged to the UI auditor in 03-01's
 * summary).
 *
 * Press toggles an inline detail block rendered directly BELOW the chip's
 * text block (never absolute-positioned — it would clip inside the table's
 * overflow-x-auto). The parent pane owns one-detail-open-at-a-time and
 * receives toggles via onToggle(id).
 */
import { criteria } from "@/lib/calc/criteria";

export type CitationRecord = (typeof criteria.citations)[number];

export function CitationChip({
  record,
  expanded,
  onToggle,
}: {
  record: CitationRecord;
  expanded: boolean;
  onToggle?: (id: string) => void;
}) {
  const detailId = `cite-detail-${record.id}`;
  return (
    <span className="inline-flex flex-col gap-1 align-top">
      <button
        type="button"
        className="inline-flex h-6 items-center whitespace-nowrap rounded border border-primary/30 bg-primary/10 px-2 text-xs font-semibold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={() => onToggle?.(record.id)}
      >
        {`${record.code} ${record.clause}`}
      </button>
      {expanded && (
        <span id={detailId} className="flex max-w-md flex-col gap-0.5 text-xs">
          <span className="font-semibold">{record.title}</span>
          <span>{`${record.code} — ${record.edition}`}</span>
          <span>{`verified ${record.verified}`}</span>
          <span className="text-muted-foreground">{record.scope_note}</span>
        </span>
      )}
    </span>
  );
}
