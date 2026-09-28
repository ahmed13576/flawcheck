"use client";

/**
 * PT/MT triage list — Screen 3 region 4 (ING-04 carried into results), restyled
 * per the Flowstep mock's "Recommended next step" pattern (03-00b Task 1,
 * Screen 3.png): one card per indication with the arrow icon in an
 * orange-tinted circle, the [PT]/[MT] method tag, morphology + dimensions
 * line, verdict chip right, and the mono clause line from the existing engine
 * data (ASME B31.3 §344.3.2 MT / §344.4.2 PT — auto-selected by method).
 * Empty state per the Copywriting Contract (UI-20).
 */
import { ArrowRight } from "lucide-react";
import type { EvaluationResults, PtmIndicationResult } from "@/lib/ingest/session";
import { VerdictChip } from "@/components/wizard/verdict-chip";
import { FlagBadge } from "@/components/wizard/flag-badge";

function clauseRefForMethod(method: "PT" | "MT"): string {
  return method === "MT" ? "ASME B31.3 §344.3.2" : "ASME B31.3 §344.4.2";
}

/**
 * WR-05: the engine re-derives morphology from the criteria definition
 * (lib/calc/ptmt: linear iff L > 3W, strictly) and the verdict comes from THAT
 * classification — the user-declared value is not an input. When the declared
 * value disagrees with the dimensions, labeling it as fact next to the derived
 * verdict is contradictory on a safety triage surface, so it renders as
 * 'declared: X (informational)' and names the classification that governed.
 * Exported pure for the node test-suite.
 */
export function dimensionsLine(
  ind: Pick<PtmIndicationResult, "morphology" | "lengthMm" | "widthMm">,
): string {
  const dims = `L ${ind.lengthMm.toFixed(1)} × W ${ind.widthMm.toFixed(1)} mm`;
  const derived: "linear" | "rounded" =
    ind.lengthMm > 3 * ind.widthMm ? "linear" : "rounded"; // strict > (P7a boundary)
  if (ind.morphology === derived) {
    const morphology = derived === "linear" ? "Linear" : "Rounded";
    return `${morphology} indication ${dims}`;
  }
  return `declared: ${ind.morphology} (informational) — ${dims} classifies ${derived} per ASME B31.3 (L > 3W governs the verdict)`;
}

export function PtmtTriageList({ indications }: { indications: EvaluationResults["indications"] }) {
  if (indications.length === 0) {
    return (
      <section aria-label="PT/MT triage" className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-xl font-semibold">PT/MT triage</h2>
        <p className="mt-2 text-sm font-semibold">No PT/MT indications recorded</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add structured indications or notes in the metadata form to triage surface flaws.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="PT/MT triage" className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">PT/MT triage</h2>
      {indications.map((indication) => (
        <article
          key={indication.id}
          className="flex gap-4 rounded-xl border border-border bg-card p-6"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
            <ArrowRight className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-1 flex-col gap-3">
            <h3 className="font-semibold">Recommended next step</h3>
            <div className="flex flex-wrap items-center gap-2">
              <FlagBadge label={`[${indication.method}]`} tone="neutral" />
              <span className="text-sm text-muted-foreground">{dimensionsLine(indication)}</span>
            </div>
            <p className="text-sm text-muted-foreground">{indication.detail}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {clauseRefForMethod(indication.method)}
            </p>
          </div>
          <VerdictChip verdict={indication.verdict} />
        </article>
      ))}
    </section>
  );
}
