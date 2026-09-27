import type { Verdict } from "@/lib/ingest/session";

/**
 * Verdict chip — UI-SPEC Verdict & Flag Chip Contract. The engine band name
 * `reject` renders as FAIL (the UI label; the engine enum is never leaked).
 * Chip text is the semantics — color is never the sole channel (a11y floor 5).
 */
const VERDICT_CHIP_BASE_CLASS =
  "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-semibold uppercase tracking-wide";

const VERDICT_CHIP_CLASSES: Record<Verdict, { label: string; classes: string }> = {
  accept: {
    label: "ACCEPT",
    classes: "bg-green-500/10 text-green-400 border-green-500/30",
  },
  re_check: {
    label: "RE-CHECK",
    classes: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  reject: {
    label: "FAIL",
    classes: "bg-red-500/10 text-red-400 border-red-500/30",
  },
};

export function VerdictChip({ verdict }: { verdict: Verdict }) {
  const { label, classes } = VERDICT_CHIP_CLASSES[verdict];
  return <span className={`${VERDICT_CHIP_BASE_CLASS} ${classes}`}>{label}</span>;
}
