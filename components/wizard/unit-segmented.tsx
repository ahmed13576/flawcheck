"use client";

/**
 * Segmented unit control — UI-SPEC metadata form: the global mm | in | mils
 * selector (default mm) and the OQ1 MPa | psi pressure selector are both
 * segmented controls. Buttons carry aria-pressed; the group is labelled.
 */
export function UnitSegmented({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex rounded border border-[#262626]">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`px-3 py-1.5 text-sm font-semibold first:rounded-l last:rounded-r ${
              active
                ? "bg-[#2563eb] text-white"
                : "bg-transparent text-[#a3a3a3] hover:text-[#ededed]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export const THICKNESS_UNIT_OPTIONS = [
  { value: "mm", label: "mm" },
  { value: "in", label: "in" },
  { value: "mils", label: "mils" },
];

export const PRESSURE_UNIT_OPTIONS = [
  { value: "MPa", label: "MPa" },
  { value: "psi", label: "psi" },
];
