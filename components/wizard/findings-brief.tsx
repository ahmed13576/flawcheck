/**
 * Screen 3 "What we found" brief (REPT-04, UI-6.1/UI-6.2) — a PRESENTATIONAL
 * component over the 06-01 pure builder (buildFindingsBrief in
 * lib/report/content.ts). The component adds ZERO copy of its own: it calls
 * the builder and renders the result verbatim, so the brief is composed by
 * the deterministic TypeScript template from engine output (summary +
 * readings) — NOT LLM-generated (06-CONTEXT locked decision 1).
 *
 * Server-safe by construction: imports the PURE builder from the content seam
 * and the repo-protected VerdictChip; imports NOTHING from narrative stores,
 * reasoning contexts, telemetry, or any wall-clock hook (UI-6.4, T-06-02-02
 * — the summary of record carries engine facts only). Zero clause citations
 * anywhere in the brief body (UI-6.3) — the tables below carry them all.
 *
 * Markup contract (UI-6.1/UI-6.2, locked): one <section aria-label="What we
 * found"> read in DOM order by screen readers (a11y floor 1 — no additional
 * headings inside):
 *   1. disposition line   — text-lg font-semibold
 *   2. next-action line   — text-sm font-semibold (builder's "Next action: "
 *                           prefix contract, rendered exactly)
 *   3. narrative          — text-sm text-muted-foreground
 *   4. worst-locations    — real <ul> of at most 5 one-line rows (name in
 *                           font-mono text-sm with truncate + title, the
 *                           VerdictChip, the why string); rendered ONLY when
 *                           the builder's worstLocations array is non-empty —
 *                           all-accept sessions render no list, no placeholder.
 */
import {
  buildFindingsBrief,
  type FindingsBrief as FindingsBriefData,
} from "@/lib/report/content";
import { VerdictChip } from "@/components/wizard/verdict-chip";
import type { EvaluationResults, ReadingResult } from "@/lib/ingest/session";

function BriefList({ brief }: { brief: FindingsBriefData }) {
  if (brief.worstLocations.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {brief.worstLocations.map((entry, index) => (
        <li
          key={`${entry.name}-${index}`}
          className="flex flex-wrap items-center gap-2 text-sm"
        >
          <span
            className="truncate font-mono text-sm"
            title={entry.name}
          >
            {entry.name}
          </span>
          <VerdictChip verdict={entry.verdict} />
          <span className="text-sm text-muted-foreground">{entry.why}</span>
        </li>
      ))}
    </ul>
  );
}

export function FindingsBrief({
  summary,
  readings,
}: {
  summary: EvaluationResults["summary"];
  readings: ReadingResult[];
}) {
  // The builder owns every sentence and the worst-list — rendered verbatim.
  const brief = buildFindingsBrief(summary, readings);
  return (
    <section
      aria-label="What we found"
      className="flex flex-col gap-2 rounded-none border border-border bg-card p-6"
    >
      <p className="text-lg font-semibold">{brief.dispositionSentence}</p>
      <p className="text-sm font-semibold">{brief.nextActionSentence}</p>
      <p className="text-sm text-muted-foreground">{brief.narrative}</p>
      <BriefList brief={brief} />
    </section>
  );
}
