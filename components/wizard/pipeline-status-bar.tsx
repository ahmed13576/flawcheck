"use client";

/**
 * PipelineStatusBar — 03-04 Task 1 (Pattern R7): one row per pipeline step
 * with runtime-resolved model badges (never hardcoded — PLAT-05) and honest
 * metrics. Cost renders `—` ALWAYS (open-question resolution 2: no price map
 * in .ts, no NEBIUS_PRICE_* env — tokens·seconds is the honest metric).
 * Placement: between the sticky summary strip and the results table (03-00b
 * region order).
 */
import { useReasoning, type ExtractionStatus } from "@/components/wizard/reasoning-context";
import { useSyncExternalStore } from "react";

const BADGE =
  "inline-flex h-6 items-center rounded border border-border px-2 text-xs font-semibold text-muted-foreground";
const FAILED_BADGE =
  "inline-flex h-6 items-center rounded border border-destructive/30 bg-destructive/10 px-2 text-xs font-semibold uppercase tracking-wide text-destructive";
const FALLBACK_CHIP =
  "inline-flex h-6 items-center rounded border border-border bg-secondary px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const METRICS = "text-xs text-muted-foreground font-mono tabular-nums whitespace-nowrap";
const ROLE = "text-sm";
const HEADING = "text-xs font-semibold uppercase tracking-[1.5px] text-muted-foreground";

function metricsText(promptTokens: number, completionTokens: number, latencyMs: number): string {
  const tokens = (promptTokens + completionTokens).toLocaleString("en-US");
  return `tokens ${tokens} · ${(latencyMs / 1000).toFixed(1)} s · —`;
}

export function PipelineStatusBar({
  extractionOverride,
}: {
  /** Test seam: SSR markup tests cannot run effects, so they inject the
   * extraction state directly (the provider path is exercised by the
   * flowstep-restyle screen tests, which render the pending row). */
  extractionOverride?: ExtractionStatus;
}) {
  const ctx = useReasoning();
  const extraction = extractionOverride ?? ctx.extraction;
  const store = ctx.store;
  useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.version(),
    () => store.version(),
  );

  const extractionRow = (() => {
    switch (extraction.state) {
      case "pending":
        return <span className={METRICS}>pending</span>;
      case "running":
        return (
          <span className={METRICS} role="status">
            running…
          </span>
        );
      case "complete":
        return (
          <>
            <span className={BADGE}>{extraction.usage.model}</span>
            <span className={METRICS}>
              {metricsText(extraction.usage.promptTokens, extraction.usage.completionTokens, extraction.usage.latencyMs)}
            </span>
          </>
        );
      case "failed":
        return (
          <>
            <span className={FAILED_BADGE}>failed</span>
            <span className={METRICS}>— · — · —</span>
          </>
        );
      case "disabled":
        return (
          <>
            <span className={BADGE}>—</span>
            <span className={METRICS}>fallback mode</span>
          </>
        );
    }
  })();

  const narrativeRow = (() => {
    if (extraction.state === "failed") {
      return (
        <>
          <span className={FAILED_BADGE}>skipped</span>
          <span className={METRICS}>— · — · —</span>
        </>
      );
    }
    if (extraction.state === "disabled" || store.fallbackServed()) {
      // A served fallback means at least one pane shows the deterministic
      // narrative — the chip replaces the badge and metrics stay dashes
      // (rejected narratives' metrics are never fabricated).
      return (
        <>
          <span className={FALLBACK_CHIP}>deterministic fallback</span>
          <span className={METRICS}>— · — · —</span>
        </>
      );
    }
    const streaming = store.streamingCount();
    if (streaming > 0) {
      return (
        <span className={METRICS} role="status">
          running…
        </span>
      );
    }
    const totals = store.totals();
    const hasAny = totals.promptTokens > 0 || totals.completionTokens > 0 || totals.latencyMs > 0;
    if (!hasAny) {
      return <span className={METRICS}>pending</span>;
    }
    const model = store.narrativeModel();
    return (
      <>
        {model ? <span className={BADGE}>{model}</span> : null}
        <span className={METRICS}>{metricsText(totals.promptTokens, totals.completionTokens, totals.latencyMs)}</span>
      </>
    );
  })();

  return (
    <section aria-label="Pipeline" className="rounded-lg border border-border bg-card p-4">
      <p className={HEADING}>Pipeline</p>
      <dl className="mt-2 flex flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <dt className={ROLE}>Extraction</dt>
          {extractionRow}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <dt className={ROLE}>Narrative</dt>
          {narrativeRow}
        </div>
      </dl>
    </section>
  );
}
