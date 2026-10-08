"use client";

/**
 * Metadata form — Screen 2 region 5 (UI-SPEC Metadata form contract, UI-10/
 * UI-11), restyled per the Flowstep Screen 2 mock (03-00). Every default and
 * validation copy verbatim; no field additions or removals, no handler
 * changes. Fields are grouped under the mock's uppercase muted section
 * headers — COMPONENT GEOMETRY / CLASSIFICATION / DESIGN CONDITIONS; the
 * global unit segmented control (mm default) sits top-right in the card
 * header and applies to all numeric metadata fields; the OQ1 MPa | psi
 * selector records pressureUnit (P and S share it); E/W/Y live inside a
 * collapsed <details> with the Ferritic-steel Y hint (ASME B31.3 Table
 * 304.1.1). Validation state comes from the reducer's metadataProblems
 * (strict numeric grammar — never bare Number()).
 */
import { CheckCircle2 } from "lucide-react";
import { UnitSegmented, THICKNESS_UNIT_OPTIONS, PRESSURE_UNIT_OPTIONS } from "@/components/wizard/unit-segmented";
import type { MetadataDraft, MetadataDraftField, MetadataProblem } from "@/lib/wizard/reducer";
import type { Unit } from "@/lib/ingest/session";

function FieldError({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <span role="alert" className="text-xs text-fail">
      {messages[0]}
    </span>
  );
}

const NUMERIC_INPUT_CLASS = "h-10 rounded-lg border bg-input px-3 text-sm";

function SectionHeader({ children }: { children: string }) {
  return (
    <p className="text-xs uppercase tracking-widest text-muted-foreground">{children}</p>
  );
}

export function MetadataForm({
  draft,
  metadataUnit,
  problems,
  onField,
  onMetadataUnit,
}: {
  draft: MetadataDraft;
  metadataUnit: Unit;
  problems: MetadataProblem[];
  onField: (field: MetadataDraftField, value: string) => void;
  onMetadataUnit: (unit: Unit) => void;
}) {
  const errorsFor = (field: MetadataDraftField): string[] =>
    problems.filter((p) => p.field === field).map((p) => p.message);

  const numberField = (
    field: MetadataDraftField,
    label: string,
    opts: { step?: string; caption?: string } = {},
  ) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={`meta-${field}`} className="text-xs text-muted-foreground">
        {label}
      </label>
      <input
        id={`meta-${field}`}
        type="text"
        inputMode="decimal"
        value={draft[field]}
        onChange={(event) => onField(field, event.target.value)}
        aria-invalid={errorsFor(field).length > 0 || undefined}
        className={`${NUMERIC_INPUT_CLASS} ${
          errorsFor(field).length > 0 ? "border-fail/50" : "border-border"
        } font-mono tabular-nums whitespace-nowrap`}
        step={opts.step}
      />
      {opts.caption && <span className="text-xs text-muted-foreground">{opts.caption}</span>}
      <FieldError messages={errorsFor(field)} />
    </div>
  );

  const GEOMETRIC_FIELDS: MetadataDraftField[] = [
    "od",
    "tNominal",
    "fca",
    "tStructural",
    "gaugeUncertainty",
  ];

  const handleUnitChange = (newUnit: Unit) => {
    if (newUnit === metadataUnit) return;
    for (const field of GEOMETRIC_FIELDS) {
      const currentVal = draft[field];
      if (typeof currentVal === "string" && currentVal.trim() !== "") {
        const num = parseFloat(currentVal);
        if (Number.isFinite(num)) {
          let mm = num;
          if (metadataUnit === "in") mm = num * 25.4;
          else if (metadataUnit === "mils") mm = num * 0.0254;

          let converted = mm;
          if (newUnit === "in") converted = mm / 25.4;
          else if (newUnit === "mils") converted = mm / 0.0254;

          const decimals = newUnit === "mm" ? 3 : newUnit === "in" ? 4 : 1;
          const rounded = Number(converted.toFixed(decimals));
          onField(field, String(rounded));
        }
      }
    }
    onMetadataUnit(newUnit);
  };

  return (
    <section
      aria-label="Component metadata"
      className="rounded-xl border border-border bg-card p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/40 pb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Component metadata</h2>
        </div>
        <UnitSegmented
          options={THICKNESS_UNIT_OPTIONS}
          value={metadataUnit}
          onChange={(value) => handleUnitChange(value as Unit)}
          ariaLabel="Metadata unit — applies to all numeric metadata fields"
        />
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <SectionHeader>COMPONENT GEOMETRY</SectionHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {numberField("od", "Outer diameter (OD)")}
          {numberField("tNominal", "Nominal thickness (t-nom)")}
          {numberField("fca", "Future corrosion allowance (FCA)")}
          {numberField("tStructural", "Structural min thickness", {
            caption: "From API 574 Annex D tables — leave 0 if not applicable.",
          })}
          {numberField("gaugeUncertainty", `Gauge uncertainty (± ${metadataUnit})`, {
            step: "0.05",
          })}
        </div>

        <SectionHeader>CLASSIFICATION</SectionHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="meta-designCode" className="text-xs text-muted-foreground">
              Design Code
            </label>
            <select
              id="meta-designCode"
              value={draft.designCode}
              onChange={(event) => onField("designCode", event.target.value)}
              className={`${NUMERIC_INPUT_CLASS} border-border`}
            >
              <option value="ASME B31.3 — 2024 Edition">ASME B31.3 — 2024 Edition</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="meta-pipeClass" className="text-xs text-muted-foreground">
              Piping Class
            </label>
            <select
              id="meta-pipeClass"
              value={draft.pipeClass}
              onChange={(event) => onField("pipeClass", event.target.value)}
              aria-invalid={errorsFor("pipeClass").length > 0 || undefined}
              className={`${NUMERIC_INPUT_CLASS} ${
                errorsFor("pipeClass").length > 0 ? "border-fail/50" : "border-border"
              }`}
            >
              <option value="">Select class</option>
              <option value="1">Class 1</option>
              <option value="2">Class 2</option>
              <option value="3">Class 3</option>
            </select>
            <FieldError messages={errorsFor("pipeClass")} />
          </div>
        </div>

        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-1 text-sm font-medium">Required thickness formula</legend>
          <div className="mt-2 flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="formula"
                checked={draft.formula === "asme_b31_3_straight_pipe"}
                onChange={() => onField("formula", "asme_b31_3_straight_pipe")}
              />
              ASME B31.3 straight pipe (design / new pipe)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="formula"
                checked={draft.formula === "barlow_in_service"}
                onChange={() => onField("formula", "barlow_in_service")}
              />
              Barlow in-service (API 574)
            </label>
          </div>
        </fieldset>

        <SectionHeader>DESIGN CONDITIONS</SectionHeader>
        <fieldset className="rounded-xl border border-border p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {numberField("designPressure", `Design pressure (P, ${draft.pressureUnit})`)}
            {numberField("allowableStress", `Allowable stress (S, ${draft.pressureUnit})`)}
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">Pressure unit</span>
              <UnitSegmented
                options={PRESSURE_UNIT_OPTIONS}
                value={draft.pressureUnit}
                onChange={(value) => onField("pressureUnit", value)}
                ariaLabel="Pressure unit — design pressure and allowable stress share it"
              />
            </div>
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-primary underline underline-offset-4">
              Advanced: E, W, Y
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {numberField("e", "Quality factor E")}
              {numberField("w", "Weld joint reduction W")}
              {numberField("y", "Y-factor Y", {
                caption: "Ferritic steel ≤ 482°C per ASME B31.3 Table 304.1.1",
              })}
            </div>
          </details>
        </fieldset>
      </div>
    </section>
  );
}
