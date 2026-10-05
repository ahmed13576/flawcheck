/**
 * Flag & row-status badges — UI-SPEC Flag Chip Contract (rounded-rect base,
 * distinct from verdict pills), tokenized in 03-00: 'inline-flex h-6 items-center
 * rounded border px-2 text-xs font-semibold uppercase tracking-wide'. Text is
 * the semantics; color is never the sole channel (a11y floor 5). Tones map to
 * the repo-protected verdict tokens: error → --fail family (#f87171, identical
 * to the Phase-2 red-400), warning/amber → --recheck family (#fbbf24, identical
 * to the Phase-2 amber-400), neutral → muted token.
 */
const FLAG_BADGE_BASE_CLASS =
  "inline-flex h-6 items-center rounded border px-2 text-xs font-semibold uppercase tracking-wide";

export type FlagBadgeTone = "error" | "warning" | "amber" | "neutral";

const FLAG_BADGE_TONES: Record<FlagBadgeTone, string> = {
  // Blocking row errors (UI-09): fail family — renders #f87171 on dark.
  error: "border-fail/40 text-fail",
  warning: "border-recheck/40 text-recheck",
  amber: "border-recheck/40 text-recheck",
  neutral: "border-border text-muted-foreground",
};

export function FlagBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: FlagBadgeTone;
}) {
  return <span className={`${FLAG_BADGE_BASE_CLASS} ${FLAG_BADGE_TONES[tone]}`}>{label}</span>;
}
