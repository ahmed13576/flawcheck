/**
 * Decision 5 — Explainable Fail-Closed Review Block (locked 2026-10-19).
 *
 * Rendered when a System-1 choice gate fires fail-closed (p < threshold).
 * Presents, around the PRECOMPUTED distribution only:
 *   - the competing classes with their FULL probability distribution,
 *   - the input snippet that drove the uncertainty,
 *   - what evidence would disambiguate,
 *   - remedial steps.
 *
 * Invariant preserved: this layer narrates around the precomputed
 * distribution — it never re-classifies. The chosen class and the full
 * distribution are rendered verbatim from the decision result; this block
 * contains no classification logic whatsoever.
 */
import React from "react";
import { ShieldAlert, FlaskConical, ClipboardList, BarChart3, Search } from "lucide-react";

export interface FailClosedReviewBlockProps {
  /** Precomputed selected class from the System-1 choice gate. */
  choice: string;
  /** FULL precomputed probability distribution across all competing classes. */
  probabilities: Record<string, number>;
  /** The fail-closed threshold (e.g. 0.85) — display only. */
  threshold: number;
  /** Snippet of the input that drove the uncertainty. */
  inputSnippet: string;
  /** Evidence that would disambiguate the decision. */
  disambiguatingEvidence: string[];
  /** Remedial steps for the reviewer. */
  remedialSteps: string[];
  className?: string;
}

/**
 * Pure helper (exported for tests): returns the distribution entries sorted
 * for DISPLAY ONLY (descending). This never re-classifies — the chosen class
 * and every probability are rendered verbatim from the precomputed result.
 */
export function sortDistributionForDisplay(
  probabilities: Record<string, number>
): Array<{ className: string; probability: number }> {
  return Object.entries(probabilities)
    .map(([className, probability]) => ({ className, probability }))
    .sort((a, b) => b.probability - a.probability);
}

export function FailClosedReviewBlock({
  choice,
  probabilities,
  threshold,
  inputSnippet,
  disambiguatingEvidence,
  remedialSteps,
  className = "",
}: FailClosedReviewBlockProps) {
  const distribution = sortDistributionForDisplay(probabilities);
  const distributionKeys = Object.keys(probabilities);
  const choiceInDistribution = distributionKeys.includes(choice);
  const leading = distribution[0];

  return (
    <div
      role="alert"
      data-testid="fail-closed-review-block"
      aria-label="Manual review required"
      className={`rounded-lg border border-amber-500/40 bg-amber-50 p-4 text-slate-900 ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-amber-500/30 pb-2">
        <ShieldAlert className="h-5 w-5 text-amber-600" aria-hidden="true" />
        <h3 className="text-sm font-semibold tracking-wide">
          Manual review required — fail-closed gate triggered
        </h3>
      </div>

      <p className="mt-3 text-sm">
        Selected class:{" "}
        <strong data-testid="fail-closed-choice">{choice}</strong>
        {choiceInDistribution ? " (as classified by the decision engine)" : " (precomputed classification)"}{" "}
        — confidence fell below the p &lt; {threshold} review threshold, so this
        decision is routed to manual review rather than automated processing.
      </p>

      <div className="mt-3" data-testid="fail-closed-distribution">
        <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
          Competing classes — full probability distribution
        </p>
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {distribution.map((entry) => (
            <li key={entry.className} className="flex items-center gap-2 text-xs">
              <span className="w-40 shrink-0 truncate font-mono" title={entry.className}>
                {entry.className}
                {entry.className === choice ? " (selected)" : ""}
              </span>
              <span
                aria-hidden="true"
                className="h-2 rounded bg-amber-400/50"
                style={{ width: `${Math.max(1, Math.min(100, entry.probability * 100))}%` }}
              />
              <span className="w-12 shrink-0 font-mono tabular-nums">
                {(entry.probability * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
        {leading ? (
          <p className="mt-1.5 text-xs text-slate-500">
            Distribution as computed by the decision engine
            {leading.className === choice
              ? ""
              : ` — selected "${choice}", leading option "${leading.className}"`}.
            {" "}This block narrates the precomputed distribution; no re-classification is performed here.
          </p>
        ) : null}
      </div>

      <div className="mt-3">
        <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
          What drove the uncertainty
        </p>
        <blockquote
          data-testid="fail-closed-input-snippet"
          className="mt-1 rounded border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs"
        >
          {inputSnippet}
        </blockquote>
      </div>

      <div className="mt-3">
        <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          What would disambiguate
        </p>
        <ul className="mt-1 list-disc pl-5 text-xs">
          {disambiguatingEvidence.map((e, i) => (
            <li key={`ev-${i}`}>{e}</li>
          ))}
        </ul>
      </div>

      <div className="mt-3">
        <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
          Remedial steps
        </p>
        <ol className="mt-1 list-decimal pl-5 text-xs">
          {remedialSteps.map((s, i) => (
            <li key={`rm-${i}`}>{s}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
