"use client";

/**
 * PT/MT entry — Screen 2 optional section (ING-04), restyled per the Flowstep
 * Screen 2 mock (03-00): card header "PT/MT Indications (optional)" with the
 * Add indication button top-right; the locked free-text notes textarea carries
 * verbatim into the session; the structured indication repeater (each row's
 * Remove indication button sits below the notes textarea) feeds deterministic
 * triage in lib/calc/ptmt. Numbers must be > 0; edge separation shows only
 * when Count >= 2; row removal is instant (the only non-confirm destructive
 * action per the Copywriting Contract). Handlers byte-identical.
 */
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { parseNumericCell } from "@/lib/ingest/validate";
import type { PtmIndication } from "@/lib/ingest/session";
import { useWizard } from "@/components/wizard/wizard-context";

function PositiveNumberInput({
  id,
  label,
  value,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [raw, setRaw] = useState(String(value));
  const parsed = parseNumericCell(raw.trim());
  const invalid = parsed === null || parsed <= 0;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={raw}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          const next = event.target.value;
          setRaw(next);
          const candidate = parseNumericCell(next.trim());
          if (candidate !== null && candidate > 0) onCommit(candidate);
        }}
        onBlur={() => setRaw(String(value))}
        className={`w-24 rounded-none border bg-input px-2 py-1 text-sm font-mono tabular-nums whitespace-nowrap focus:border-primary focus:outline-none ${
          invalid ? "border-fail/50" : "border-border"
        }`}
      />
    </div>
  );
}

function IndicationRow({
  indication,
  onUpdate,
  onRemove,
}: {
  indication: PtmIndication;
  onUpdate: (patch: Partial<PtmIndication>) => void;
  onRemove: () => void;
}) {
  const [description, setDescription] = useState(indication.description ?? "");
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-none border border-border p-4 bg-background">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Method</span>
        <div className="flex gap-2 text-sm">
          {(["PT", "MT"] as const).map((method) => (
            <label key={method} className="flex items-center gap-1">
              <input
                type="radio"
                name={`method-${indication.id}`}
                checked={indication.method === method}
                onChange={() => onUpdate({ method })}
              />
              {method}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Morphology</span>
        <div className="flex gap-2 text-sm">
          {(["linear", "rounded"] as const).map((morphology) => (
            <label key={morphology} className="flex items-center gap-1">
              <input
                type="radio"
                name={`morphology-${indication.id}`}
                checked={indication.morphology === morphology}
                onChange={() => onUpdate({ morphology })}
              />
              {morphology === "linear" ? "Linear" : "Rounded"}
            </label>
          ))}
        </div>
      </div>

      <PositiveNumberInput
        id={`length-${indication.id}`}
        label="Length (mm)"
        value={indication.lengthMm}
        onCommit={(lengthMm) => onUpdate({ lengthMm })}
      />
      <PositiveNumberInput
        id={`width-${indication.id}`}
        label="Width (mm)"
        value={indication.widthMm}
        onCommit={(widthMm) => onUpdate({ widthMm })}
      />
      <PositiveNumberInput
        id={`count-${indication.id}`}
        label="Count"
        value={indication.count}
        onCommit={(count) => onUpdate({ count: Math.max(1, Math.round(count)) })}
      />

      {indication.count >= 2 && (
        <PositiveNumberInput
          id={`edge-${indication.id}`}
          label="Edge separation (mm)"
          value={indication.edgeSeparationMm ?? 0}
          onCommit={(edgeSeparationMm) => onUpdate({ edgeSeparationMm })}
        />
      )}

      <div className="flex min-w-40 flex-1 flex-col gap-1">
        <label htmlFor={`desc-${indication.id}`} className="text-xs font-medium text-muted-foreground">
          Description (optional)
        </label>
        <input
          id={`desc-${indication.id}`}
          type="text"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            onUpdate({ description: event.target.value });
          }}
          className="rounded-none border border-border bg-input px-2 py-1 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove indication ${indication.id}`}
        className="rounded-none border border-border px-3 py-1.5 text-sm font-medium hover:border-fail/50 hover:text-fail"
      >
        Remove indication
      </button>
    </div>
  );
}

export function PtmtEntry({
  notes,
  indications,
  onNotes,
}: {
  notes: string;
  indications: PtmIndication[];
  onNotes: (notes: string) => void;
}) {
  const { dispatch } = useWizard();
  return (
    <section
      aria-label="PT/MT entry"
      className="rounded-none border border-border bg-card p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold">PT/MT Indications (optional)</h2>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "add-indication" })}
          className="rounded-none border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
        >
          Add indication
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <label htmlFor="ptmt-notes" className="text-sm font-medium text-muted-foreground">
          PT/MT notes (optional)
        </label>
        <textarea
          id="ptmt-notes"
          value={notes}
          onChange={(event) => onNotes(event.target.value)}
          rows={3}
          className="rounded-none border border-border bg-input px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      {indications.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {indications.map((indication) => (
            <IndicationRow
              key={indication.id}
              indication={indication}
              onUpdate={(patch) =>
                dispatch({ type: "update-indication", id: indication.id, patch })
              }
              onRemove={() => dispatch({ type: "remove-indication", id: indication.id })}
            />
          ))}
        </div>
      )}
    </section>
  );
}
