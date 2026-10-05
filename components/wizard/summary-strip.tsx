"use client";

/**
 * Summary strip — Screen 3 region 2, Flowstep restyle (03-00b Task 1, Screen
 * 3.png): sticky bar under the header with an opaque token background.
 * '{n} readings · {m} locations' + colored ACCEPT / RE-CHECK / FAIL counts
 * from EvaluationResults.summary (REAL counts only) with the 'Read-only
 * evaluation results' note right. Content sources unchanged (UI-SPEC).
 */
import type { EvaluationResults } from "@/lib/ingest/session";

export function SummaryStrip({ summary }: { summary: EvaluationResults["summary"] }) {
  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <span className="font-mono tabular-nums whitespace-nowrap">
          {summary.total.toLocaleString("en-US")} readings · {summary.locations} locations
        </span>
        <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
        <span className="whitespace-nowrap text-xs font-semibold text-green-400">
          {summary.accept.toLocaleString("en-US")} ACCEPT
        </span>
        <span className="whitespace-nowrap text-xs font-semibold text-amber-400">
          {summary.reCheck.toLocaleString("en-US")} RE-CHECK
        </span>
        <span className="whitespace-nowrap text-xs font-semibold text-red-400">
          {summary.fail.toLocaleString("en-US")} FAIL
        </span>
      </div>
      <span className="text-xs text-muted-foreground">Read-only evaluation results</span>
    </div>
  );
}
