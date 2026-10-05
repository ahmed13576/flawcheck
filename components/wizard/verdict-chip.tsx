import type { ReadingFlag, Verdict } from "@/lib/ingest/session";

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

/**
 * Verdict TEXT source for non-chip surfaces (the /report document, 03-00b
 * Task 2). Same ACCEPT/RE-CHECK/FAIL strings as the chip — never a new
 * mapping; chip TEXT is the semantics (a11y floor 5).
 */
export function verdictLabel(verdict: Verdict): string {
  return VERDICT_CHIP_CLASSES[verdict].label;
}

/**
 * Data-quality flag chip — rounded-rect base (distinct from the verdict pill,
 * Flag Chip Contract): OUTLIER and MEASUREMENT INCONSISTENCY amber,
 * INSUFFICIENT HISTORY gray. immediate_inspection has no chip — its locked
 * treatment is the fail-tone 'Immediate inspection required' cell text.
 */
const FLAG_CHIP_BASE_CLASS =
  "inline-flex h-6 items-center rounded border px-2 text-xs font-semibold uppercase tracking-wide";

const FLAG_CHIP_CLASSES: Partial<Record<ReadingFlag, { label: string; classes: string }>> = {
  outlier: { label: "OUTLIER", classes: "border-amber-500/40 text-amber-400" },
  measurement_inconsistency: {
    label: "MEASUREMENT INCONSISTENCY",
    classes: "border-amber-500/40 text-amber-400",
  },
  insufficient_history: {
    label: "INSUFFICIENT HISTORY",
    classes: "border-gray-600 text-gray-400",
  },
};

/** Pure chip-mapping (node-testable): null = the flag renders no chip. */
export function flagChipFor(flag: ReadingFlag): { label: string; classes: string } | null {
  return FLAG_CHIP_CLASSES[flag] ?? null;
}

export function FlagChip({ flag }: { flag: ReadingFlag }) {
  const mapped = flagChipFor(flag);
  if (!mapped) return null;
  return <span className={`${FLAG_CHIP_BASE_CLASS} ${mapped.classes}`}>{mapped.label}</span>;
}
