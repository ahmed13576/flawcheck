/**
 * Wizard step indicator — Copywriting Contract: `1 Ingest · 2 Review & Metadata · 3 Results`.
 * Active step in accent #2563eb, inactive muted #a3a3a3. Forced-dark theme —
 * literal hex, never dark: variants.
 */
const STEPS = ["1 Ingest", "2 Review & Metadata", "3 Results"] as const;

export function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Wizard steps">
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {STEPS.map((step, index) => {
          const stepNumber = (index + 1) as 1 | 2 | 3;
          const isActive = stepNumber === current;
          return (
            <li key={step} className="flex items-center gap-2">
              {index > 0 && (
                <span className="text-[#a3a3a3]" aria-hidden="true">
                  ·
                </span>
              )}
              <span
                aria-current={isActive ? "step" : undefined}
                className={
                  isActive
                    ? "font-semibold text-[#2563eb]"
                    : "text-[#a3a3a3]"
                }
              >
                {step}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
