"use client";

/**
 * Metadata form — Screen 2 region 5 (UI-SPEC Metadata form contract, UI-10/
 * UI-11). Every default and validation copy verbatim; the global unit
 * segmented control (mm default) applies to all numeric metadata fields; the
 * OQ1 MPa | psi selector records pressureUnit (P and S share it); E/W/Y live
 * inside a collapsed <details>. Validation state comes from the reducer's
 * metadataProblems (strict numeric grammar — never bare Number()).
 */
import { UnitSegmented, THICKNESS_UNIT_OPTIONS, PRESSURE_UNIT_OPTIONS } from "@/components/wizard/unit-segmented";
import type { MetadataDraft, MetadataDraftField, MetadataProblem } from "@/lib/wizard/reducer";
import type { Unit } from "@/lib/ingest/session";

function FieldError({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <span role="alert" className="text-xs text-[#f87171]">
      {messages[0]}
    </span>
  );
}

const NUMERIC_INPUT_CLASS =
  "rounded border bg-[#0a0a0a] px-3 py-2 text-sm";

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
    <div className="flex flex-col gap-1">
      <label htmlFor={`meta-${field}`} className="text-xs text-[#a3a3a3]">
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
          errorsFor(field).length > 0 ? "border-red-500/50" : "border-[#262626]"
        } font-mono tabular-nums whitespace-nowrap`}
        step={opts.step}
      />
      {opts.caption && <span className="text-xs text-[#a3a3a3]">{opts.caption}</span>}
      <FieldError messages={errorsFor(field)} />
    </div>
  );

  return (
    <section
      aria-label="Component metadata"
      className="rounded-lg border border-[#262626] bg-[#171717] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">Component metadata</p>
        <UnitSegmented
          options={THICKNESS_UNIT_OPTIONS}
          value={metadataUnit}
          onChange={(value) => onMetadataUnit(value as Unit)}
          ariaLabel="Metadata unit — applies to all numeric metadata fields"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {numberField("od", "Outer diameter (OD)")}
        {numberField("tNominal", "Nominal thickness (t-nom)")}
        {numberField("fca", "Future corrosion allowance (FCA)")}
        {numberField("tStructural", "Structural min thickness", {
          caption: "From API 574 Annex D tables — leave 0 if not applicable.",
        })}
        {numberField("gaugeUncertainty", `Gauge uncertainty (± ${metadataUnit})`, {
          step: "0.05",
        })}

        <div className="flex flex-col gap-1">
          <label htmlFor="meta-designCode" className="text-xs text-[#a3a3a3]">
            Design Code
          </label>
          <select
            id="meta-designCode"
            value={draft.designCode}
            onChange={(event) => onField("designCode", event.target.value)}
            className="rounded border border-[#262626] bg-[#0a0a0a] px-3 py-2 text-sm"
          >
            <option value="ASME B31.3 — 2024 Edition">ASME B31.3 — 2024 Edition</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="meta-pipeClass" className="text-xs text-[#a3a3a3]">
            Piping Class
          </label>
          <select
            id="meta-pipeClass"
            value={draft.pipeClass}
            onChange={(event) => onField("pipeClass", event.target.value)}
            aria-invalid={errorsFor("pipeClass").length > 0 || undefined}
            className={`${NUMERIC_INPUT_CLASS} ${
              errorsFor("pipeClass").length > 0 ? "border-red-500/50" : "border-[#262626]"
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

      <fieldset className="mt-6 rounded border border-[#262626] p-4">
        <legend className="px-1 text-sm font-semibold">Design conditions</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {numberField("designPressure", `Design pressure (P, ${draft.pressureUnit})`)}
          {numberField("allowableStress", `Allowable stress (S, ${draft.pressureUnit})`)}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#a3a3a3]">Pressure unit</span>
            <UnitSegmented
              options={PRESSURE_UNIT_OPTIONS}
              value={draft.pressureUnit}
              onChange={(value) => onField("pressureUnit", value)}
              ariaLabel="Pressure unit — design pressure and allowable stress share it"
            />
          </div>
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-[#2563eb] underline underline-offset-2">
            Advanced: E, W, Y
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {numberField("e", "Quality factor E")}
            {numberField("w", "Weld joint reduction W")}
            {numberField("y", "Y-factor Y")}
          </div>
        </details>
      </fieldset>

      <fieldset className="mt-4 rounded border border-[#262626] p-4">
        <legend className="px-1 text-sm font-semibold">Required thickness formula</legend>
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
    </section>
  );
}
