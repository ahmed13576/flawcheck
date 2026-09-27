"use client";

/**
 * Column mapping panel — Screen 2 region 3 (UI-SPEC Column mapping contract),
 * restyled per the Flowstep Screen 2 mock (03-00). One select per target field
 * in the spec order, required fields marked *; options = all CSV headers +
 * '— not mapped —'. Auto-guess preselection comes from the reducer (lib/ingest
 * autoGuess at ingest time — UI-07); changing any mapping dispatches
 * set-mapping which re-runs row validation immediately. ALL SIX mapping
 * targets are kept — the mock's 4-target layout is a RECORDED DEVIATION
 * (dropping t-initial/t-previous would break R6 wide-format grouping).
 * Unmapped required fields: border-fail/50 + the role=alert banner above the
 * panel with the unmapped-column copy verbatim (UI-08). The CSV thickness unit
 * select sits in this panel (suffix auto-guess, mm default — ING-05).
 */
import { CheckCircle2 } from "lucide-react";
import type { TargetField, Unit } from "@/lib/ingest/session";
import { FlagBadge } from "@/components/wizard/flag-badge";

const TARGET_FIELDS: Array<{
  field: TargetField;
  label: string;
  required: boolean;
  hint?: string;
}> = [
  { field: "readingId", label: "Reading ID", required: true, hint: "Required reading identifier." },
  { field: "measuredThickness", label: "Measured Thickness", required: true, hint: "Required measured value." },
  { field: "measurementDate", label: "Measurement Date", required: true, hint: "Required inspection date." },
  { field: "tInitial", label: "Original / Initial Thickness (t-initial)", required: false },
  { field: "tPrevious", label: "Previous Thickness (t-previous)", required: false },
  { field: "tank", label: "Tank / Location", required: false },
];

const NOT_MAPPED = "— not mapped —";

const UNMAPPED_COPY: Record<string, string> = {
  readingId: "Reading ID",
  measuredThickness: "Measured Thickness",
  measurementDate: "Measurement Date",
};

export function ColumnMappingPanel({
  headers,
  mapping,
  units,
  onMap,
  onCsvThicknessUnit,
}: {
  headers: string[];
  mapping: Record<TargetField, string | null>;
  units: { csvThickness: Unit; metadata: Unit };
  onMap: (field: TargetField, header: string | null) => void;
  onCsvThicknessUnit: (unit: Unit) => void;
}) {
  const unmappedRequired = TARGET_FIELDS.filter(
    ({ field, required }) => required && !mapping[field],
  );

  return (
    <section
      aria-label="Column mapping"
      className="rounded-xl border border-border bg-card p-6"
    >
      <div className="flex items-center gap-2 border-b border-primary/40 pb-4">
        <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Map CSV columns</h2>
        {unmappedRequired.length > 0 && (
          <span className="ml-auto">
            <FlagBadge label={`${unmappedRequired.length} unmapped`} tone="error" />
          </span>
        )}
      </div>

      {unmappedRequired.length > 0 && (
        <div role="alert" className="mt-4 flex flex-col gap-1 rounded-lg border border-fail/40 bg-fail/5 p-3">
          {unmappedRequired.map(({ field }) => (
            <p key={field} className="text-sm text-fail">
              {`Required column '${UNMAPPED_COPY[field]}' is unmapped. Select the matching CSV column to continue.`}
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {TARGET_FIELDS.map(({ field, label, required, hint }) => {
          const value = mapping[field] ?? "";
          const invalid = required && !mapping[field];
          return (
            <div key={field} className="flex flex-col gap-2">
              <label htmlFor={`mapping-${field}`} className="text-xs text-muted-foreground">
                {label}
                {required ? " *" : ""}
              </label>
              <select
                id={`mapping-${field}`}
                value={value}
                onChange={(event) => onMap(field, event.target.value === "" ? null : event.target.value)}
                className={`h-10 rounded-lg border bg-input px-3 text-sm ${
                  invalid ? "border-fail/50" : "border-border"
                }`}
              >
                <option value="">{NOT_MAPPED}</option>
                {headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
              {required && hint && (
                <span className="text-muted-foreground">{hint}</span>
              )}
            </div>
          );
        })}
        <div className="flex flex-col gap-2">
          <label htmlFor="csv-thickness-unit" className="text-xs text-muted-foreground">
            CSV thickness unit
          </label>
          <select
            id="csv-thickness-unit"
            value={units.csvThickness}
            onChange={(event) => onCsvThicknessUnit(event.target.value as Unit)}
            className="h-10 rounded-lg border border-border bg-input px-3 text-sm"
          >
            <option value="mm">mm</option>
            <option value="in">in</option>
            <option value="mils">mils</option>
          </select>
        </div>
      </div>
    </section>
  );
}
