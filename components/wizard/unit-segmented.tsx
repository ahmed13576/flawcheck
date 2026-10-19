"use client";

/**
 * Segmented unit control — UI-SPEC metadata form: the global mm | in | mils
 * selector (default mm) and the OQ1 MPa | psi pressure selector are both
 * segmented controls, tokenized per the Flowstep mock in 03-00 (active = orange
 * primary). Buttons carry aria-pressed; the group is labelled.
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
    <div role="group" aria-label={ariaLabel} className="inline-flex rounded-none border border-border p-0.5 bg-background">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`rounded-none px-3 py-1 text-sm font-medium font-mono ${
              active
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted-foreground hover:text-foreground"
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
