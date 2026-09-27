"use client";

/**
 * Flag detail row — the inline expansion beneath a CML row (UI-SPEC
 * data-quality flag display contract). Toggled by the flag chip button with
 * aria-expanded/aria-controls. Measurement inconsistency shows the raw
 * negative rate and the clamped 0.00 rate side by side plus the locked
 * apparent-gain sentence; outlier shows the re-shoot-candidate copy. RL is
 * computed from the clamped rate by the engine — Infinity can never render.
 */
import type { ReadingResult, ReadingFlag } from "@/lib/ingest/session";

/** Locked apparent-gain sentence (UI-SPEC negative_cr_policy detail). */
export const APPARENT_GAIN_SENTENCE =
  "Apparent thickness gain detected — possible measurement-point drift, re-coating, or gauge noise.";

function RawRateLine({ label, raw }: { label: "LT" | "ST"; raw: number | null }) {
  if (raw === null || raw >= 0) return null;
  return (
    <p className="font-mono tabular-nums">
      {`Raw CR ${label}: −${Math.abs(raw).toFixed(2)} mm/yr · clamped to 0.00 mm/yr for remaining life`}
    </p>
  );
}

export function FlagDetailContent({
  reading,
  flag,
}: {
  reading: ReadingResult;
  flag: ReadingFlag;
}) {
  if (flag === "measurement_inconsistency") {
    return (
      <div className="flex flex-col gap-1 text-xs text-[#a3a3a3]">
        <RawRateLine label="LT" raw={reading.rawCrLtMmYr} />
        <RawRateLine label="ST" raw={reading.rawCrStMmYr} />
        <p>{APPARENT_GAIN_SENTENCE}</p>
      </div>
    );
  }
  if (flag === "outlier") {
    return (
      <p className="text-xs text-[#a3a3a3]">
        Reading deviates from CML population — re-shoot candidate.
      </p>
    );
  }
  // insufficient_history's degradation is the muted sub-text under the cells —
  // no expandable detail; other flags (immediate_inspection) have no chip.
  return null;
}

export function FlagDetailRow({
  reading,
  flag,
  colSpan,
  rowKey,
}: {
  reading: ReadingResult;
  flag: ReadingFlag;
  colSpan: number;
  /** WR-04: position-namespaced row key — duplicate reading IDs must never
   * produce duplicate detail-* DOM ids (aria-controls wiring). */
  rowKey: string;
}) {
  return (
    <tr className="bg-[#0a0a0a]">
      <td id={`detail-${rowKey}-${flag}`} colSpan={colSpan} className="px-6 py-2">
        <FlagDetailContent reading={reading} flag={flag} />
      </td>
    </tr>
  );
}
