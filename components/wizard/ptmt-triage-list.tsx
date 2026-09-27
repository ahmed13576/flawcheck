"use client";

/**
 * PT/MT triage list — Screen 3 region 4 (ING-04 carried into results): one
 * surface card per indication with the [PT]/[MT] method tag, morphology +
 * dimensions line, verdict chip, and the muted rule line with the engine
 * detail copy + the clause ref auto-selected by method (ASME B31.3 §344.3.2
 * MT / §344.4.2 PT). Empty state per the Copywriting Contract (UI-20).
 */
import type { EvaluationResults } from "@/lib/ingest/session";
import { VerdictChip } from "@/components/wizard/verdict-chip";
import { FlagBadge } from "@/components/wizard/flag-badge";

function clauseRefForMethod(method: "PT" | "MT"): string {
  return method === "MT" ? "ASME B31.3 §344.3.2" : "ASME B31.3 §344.4.2";
}

function dimensionsLine(ind: EvaluationResults["indications"][number]): string {
  const morphology = ind.morphology === "linear" ? "Linear" : "Rounded";
  return `${morphology} indication L ${ind.lengthMm.toFixed(1)} × W ${ind.widthMm.toFixed(1)} mm`;
}

export function PtmtTriageList({ indications }: { indications: EvaluationResults["indications"] }) {
  if (indications.length === 0) {
    return (
      <section aria-label="PT/MT triage" className="rounded-lg border border-[#262626] bg-[#171717] p-6">
        <p className="text-sm font-semibold">No PT/MT indications recorded</p>
        <p className="mt-1 text-sm text-[#a3a3a3]">
          Add structured indications or notes in the metadata form to triage surface flaws.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="PT/MT triage" className="flex flex-col gap-3">
      {indications.map((indication) => (
        <div
          key={indication.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[#262626] bg-[#171717] p-4"
        >
          <FlagBadge label={`[${indication.method}]`} tone="neutral" />
          <span className="text-sm">{dimensionsLine(indication)}</span>
          <VerdictChip verdict={indication.verdict} />
          <p className="w-full text-xs text-[#a3a3a3]">
            {indication.detail} — {clauseRefForMethod(indication.method)}
          </p>
        </div>
      ))}
    </section>
  );
}
