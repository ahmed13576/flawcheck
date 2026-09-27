"use client";

/**
 * Summary strip — Screen 3 region 2 (UI-SPEC): '{n} readings · {m} locations
 * — {a} ACCEPT · {b} RE-CHECK · {c} FAIL' from EvaluationResults.summary,
 * mini verdict chips, mono numerals.
 */
import type { EvaluationResults } from "@/lib/ingest/session";
import { VerdictChip } from "@/components/wizard/verdict-chip";

export function SummaryStrip({ summary }: { summary: EvaluationResults["summary"] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#262626] bg-[#171717] p-4 text-sm">
      <span className="font-mono tabular-nums whitespace-nowrap">
        {summary.total.toLocaleString("en-US")} readings · {summary.locations} locations
      </span>
      <span className="text-[#a3a3a3]">—</span>
      <VerdictChip verdict="accept" />
      <span className="font-mono tabular-nums">{summary.accept.toLocaleString("en-US")}</span>
      <span className="text-[#a3a3a3]">·</span>
      <VerdictChip verdict="re_check" />
      <span className="font-mono tabular-nums">{summary.reCheck.toLocaleString("en-US")}</span>
      <span className="text-[#a3a3a3]">·</span>
      <VerdictChip verdict="reject" />
      <span className="font-mono tabular-nums">{summary.fail.toLocaleString("en-US")}</span>
    </div>
  );
}
