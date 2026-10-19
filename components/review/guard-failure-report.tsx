/**
 * Decision 6 — Reasoned Guard Failure Report (locked 2026-10-19).
 *
 * Rendered when the semantic guard rejects a generated narrative. The report
 * states three facts in sequence:
 *   1. What the narrative claimed.
 *   2. What the precomputed verdict actually is.
 *   3. That the deterministic fallback was served instead.
 *
 * Decision 6 additionally requires that TWO AUDIENCES be kept distinct:
 *   - Operator/developer remediation: inspect the audit log, fix the prompt
 *     or the lint. This is an internal, diagnostic audience.
 *   - Inspector-facing guidance: the deterministic fallback verdict was
 *     served and is authoritative — trust the fallback verdict. This
 *     audience is never shown prompt-engineering internals.
 *
 * No classification or verification logic lives here. The guard's decision
 * (reject, verdict, fallback status) is accepted verbatim as an input.
 */
import React from "react";
import { FileWarning, UserCog, UserCheck, CheckCircle2, XCircle } from "lucide-react";

export interface GuardFailureReportProps {
  /** What the rejected narrative claimed (summarized or quoted). */
  narrativeClaim: string;
  /** The authoritative precomputed verdict the narrative should have matched. */
  precomputedVerdict: string;
  /** Whether the deterministic fallback was actually served to the end user. */
  deterministicFallbackServed: boolean;
  /** Developer-facing remediation detail (audit log location, prompt/lint fix guidance). */
  developerRemediation: string;
  className?: string;
}

export function GuardFailureReport({
  narrativeClaim,
  precomputedVerdict,
  deterministicFallbackServed,
  developerRemediation,
  className = "",
}: GuardFailureReportProps) {
  return (
    <div
      role="alert"
      data-testid="guard-failure-report"
      aria-label="Semantic guard failure report"
      className={`rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-card-foreground ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-destructive/30 pb-2">
        <FileWarning className="size-5 text-destructive" aria-hidden="true" />
        <h3 className="text-sm font-semibold tracking-wide">
          Semantic guard rejection — reasoned failure report
        </h3>
      </div>

      {/* Fact 1: what the narrative claimed */}
      <div className="mt-3" data-testid="guard-narrative-claim">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          What the narrative claimed
        </p>
        <p className="mt-1 text-sm italic">{narrativeClaim}</p>
      </div>

      {/* Fact 2: what the precomputed verdict actually is */}
      <div className="mt-3" data-testid="guard-precomputed-verdict">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          What the precomputed verdict actually is
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm">
          <XCircle className="size-4 text-destructive" aria-hidden="true" />
          <span className="font-mono font-semibold">{precomputedVerdict}</span>
        </p>
      </div>

      {/* Fact 3: deterministic fallback status */}
      <div className="mt-3" data-testid="guard-fallback-status">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          What was served
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm">
          {deterministicFallbackServed ? (
            <>
              <CheckCircle2 className="size-4 text-accept" aria-hidden="true" />
              <span>
                The deterministic fallback verdict was served. The fallback is
                computed from the same verified criteria data and is fully
                authoritative.
              </span>
            </>
          ) : (
            <>
              <XCircle className="size-4 text-destructive" aria-hidden="true" />
              <span>
                No fallback was served. Downstream consumers must not treat the
                narrative as grounded.
              </span>
            </>
          )}
        </p>
      </div>

      {/* Audience 1: operator / developer remediation */}
      <div
        data-testid="guard-developer-remediation"
        aria-label="Operator and developer remediation"
        className="mt-4 rounded border border-border bg-secondary/40 px-3 py-2"
      >
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <UserCog className="size-3.5" aria-hidden="true" />
          Operator / developer remediation
        </p>
        <ul className="mt-1 list-disc pl-5 text-xs">
          <li>Inspect the audit log for the rejected narrative and the guard's stated reason.</li>
          <li>Fix the prompt or the numeric/citation lint that produced the mismatch.</li>
          {developerRemediation ? <li>{developerRemediation}</li> : null}
        </ul>
      </div>

      {/* Audience 2: inspector-facing guidance — deliberately separate */}
      <div
        data-testid="guard-inspector-guidance"
        aria-label="Inspector guidance"
        className="mt-2 rounded border border-accept/40 bg-accept/5 px-3 py-2"
      >
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <UserCheck className="size-3.5" aria-hidden="true" />
          Inspector guidance
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm">
          <CheckCircle2 className="size-4 text-accept" aria-hidden="true" />
          <span>
            The deterministic fallback verdict was served and is fully
            authoritative. Trust the fallback verdict.
          </span>
        </p>
      </div>
    </div>
  );
}
