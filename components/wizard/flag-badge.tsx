/**
 * Flag & row-status badges — UI-SPEC Flag Chip Contract (rounded-rect base,
 * distinct from verdict pills): 'inline-flex h-6 items-center rounded border
 * px-2 text-xs font-semibold uppercase tracking-wide'. Text is the semantics;
 * color is never the sole channel (a11y floor 5).
 */
const FLAG_BADGE_BASE_CLASS =
  "inline-flex h-6 items-center rounded border px-2 text-xs font-semibold uppercase tracking-wide";

export type FlagBadgeTone = "error" | "warning" | "amber" | "neutral";

const FLAG_BADGE_TONES: Record<FlagBadgeTone, string> = {
  // Blocking row errors (UI-09): red family; #dc2626 renders #f87171 on dark.
  error: "border-red-500/40 text-red-400",
  warning: "border-amber-500/40 text-amber-400",
  amber: "border-amber-500/40 text-amber-400",
  neutral: "border-gray-600 text-gray-400",
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
