"use client";

/**
 * Column mapping panel — Screen 2 region 3 (UI-SPEC Column mapping contract).
 * One select per target field in the spec order, required fields marked *;
 * options = all CSV headers + '— not mapped —'. Auto-guess preselection comes
 * from the reducer (lib/ingest autoGuess at ingest time — UI-07); changing any
 * mapping dispatches set-mapping which re-runs row validation immediately.
 * Unmapped required fields: border-red-500/50 + the role=alert banner above
 * the panel with the unmapped-column copy verbatim (UI-08). The CSV thickness
 * unit select sits in this panel (suffix auto-guess, mm default — ING-05).
 */
import type { TargetField, Unit } from "@/lib/ingest/session";
import { FlagBadge } from "@/components/wizard/flag-badge";

const TARGET_FIELDS: Array<{ field: TargetField; label: string; required: boolean }> = [
  { field: "readingId", label: "Reading ID", required: true },
  { field: "measuredThickness", label: "Measured Thickness", required: true },
  { field: "measurementDate", label: "Measurement Date", required: true },
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
      className="rounded-lg border border-[#262626] bg-[#171717] p-4"
    >
      {unmappedRequired.length > 0 && (
        <div role="alert" className="mb-4 flex flex-col gap-1 rounded border border-red-500/40 bg-red-500/5 p-3">
          {unmappedRequired.map(({ field }) => (
            <p key={field} className="text-sm text-[#f87171]">
              {`Required column '${UNMAPPED_COPY[field]}' is unmapped. Select the matching CSV column to continue.`}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">Column mapping</p>
        {unmappedRequired.length > 0 && (
          <FlagBadge label={`${unmappedRequired.length} unmapped`} tone="error" />
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TARGET_FIELDS.map(({ field, label, required }) => {
          const value = mapping[field] ?? "";
          const invalid = required && !mapping[field];
          return (
            <div key={field} className="flex flex-col gap-1">
              <label htmlFor={`mapping-${field}`} className="text-xs text-[#a3a3a3]">
                {label}
                {required ? " *" : ""}
              </label>
              <select
                id={`mapping-${field}`}
                value={value}
                onChange={(event) => onMap(field, event.target.value === "" ? null : event.target.value)}
                className={`rounded border bg-[#0a0a0a] px-3 py-2 text-sm ${
                  invalid ? "border-red-500/50" : "border-[#262626]"
                }`}
              >
                <option value="">{NOT_MAPPED}</option>
                {headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
        <div className="flex flex-col gap-1">
          <label htmlFor="csv-thickness-unit" className="text-xs text-[#a3a3a3]">
            CSV thickness unit
          </label>
          <select
            id="csv-thickness-unit"
            value={units.csvThickness}
            onChange={(event) => onCsvThicknessUnit(event.target.value as Unit)}
            className="rounded border border-[#262626] bg-[#0a0a0a] px-3 py-2 text-sm"
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
