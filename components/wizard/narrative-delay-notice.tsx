"use client";

import { AlertTriangle, ChevronDown } from "lucide-react";
import { useId, useState } from "react";

/**
 * Narrative delay notice — explains the first-token latency introduced by the
 * Nebius Token Factory endpoint migration. Collapsed by default so it does not
 * displace the deterministic chain; expanding it carries the full context.
 * No provider model-ID literals: the model is named exactly as on the landing
 * page, so the env-only routing contract still holds.
 */
export function NarrativeDelayNotice() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left outline-none transition-colors hover:bg-amber-500/10 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <AlertTriangle className="size-3.5 shrink-0 text-amber-400" aria-hidden="true" />
        <span className="text-xs font-semibold text-foreground">
          Narrative delay after model migration
        </span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
          {open ? "Hide details" : "Details"}
          <ChevronDown
            className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </span>
      </button>
      <div id={panelId} hidden={!open} className="border-t border-amber-500/20 px-3 py-2">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Nebius Token Factory deprecated the endpoint previously used for this narrative.
          FlawCheck now runs NVIDIA Nemotron 3.5 Super VL, which completes its reasoning before
          it emits the answer, so the narrative can take about 15–21 seconds to start streaming.
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Engineering verdicts and calculations are unaffected; the deterministic fallback is
          instant.
        </p>
      </div>
    </div>
  );
}
