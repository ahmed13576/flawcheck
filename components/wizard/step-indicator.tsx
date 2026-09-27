/**
 * Wizard step indicator — Copywriting Contract: `1 Ingest · 2 Review &
 * Metadata · 3 Results · 4 Report`, connected line segments between steps per
 * the Flowstep mock (03-00). Active step in the orange primary token, inactive
 * muted. Step 4 (Report) is LOCKED (binding C4): muted, no accent, NEVER
 * aria-current, no interactive affordance — Phase 4 unlocks it. Forced-dark
 * Flowstep tokens, never dark: variants.
 */
const STEPS = [
  { label: "1 Ingest", locked: false },
  { label: "2 Review & Metadata", locked: false },
  { label: "3 Results", locked: false },
  { label: "4 Report", locked: true },
] as const;

export function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Wizard steps">
      <ol className="flex flex-wrap items-center gap-x-2 text-sm">
        {STEPS.map((step, index) => {
          const stepNumber = (index + 1) as 1 | 2 | 3;
          const isActive = !step.locked && stepNumber === current;
          return (
            <li key={step.label} className="flex items-center gap-2">
              {index > 0 && (
                <span className="h-px w-6 bg-border sm:w-10" aria-hidden="true" />
              )}
              <span
                aria-current={isActive ? "step" : undefined}
                className={
                  isActive
                    ? "font-semibold text-primary"
                    : step.locked
                      ? "text-muted-foreground/60"
                      : "text-muted-foreground"
                }
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
