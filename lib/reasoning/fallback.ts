/**
 * Deterministic fallback narratives — 03-01 Task 1 (Pattern R4, D-fallback-first).
 * Pure functions, zero LLM: they restate the engine's inputs → clause → limit →
 * verdict as cited prose. Citation tokens are emitted ONLY through `cite()`,
 * which returns an empty string unless the id is a member of the engine-emitted
 * citation set (reading.citations / indication.citationId) — the fallback can
 * never cite outside the engine's own citations, and the renderer allowlist is
 * the second gate behind that.
 *
 * Every number passes through formatFixed at table precision (thickness 2dp,
 * rates 3dp, years 1dp) so chain, table, and fallback agree byte-for-byte
 * (UI-27). The gauge-uncertainty band restates the LOCKED comparison order from
 * lib/calc/verdicts.ts (t-actual vs t-required, then vs t-required + gauge
 * uncertainty) — it never re-derives the verdict.
 *
 * Closing sentence (locked copy, UI-33): every narrative ends with
 * `Verdict: {label}. All verdicts are computed in code and unaffected.`
 * where the labels are byte-identical to VerdictChip's mapping
 * (components/wizard/verdict-chip.tsx — the single source; a test pins the
 * identity via verdictLabel()).
 */
import { formatFixed } from "@/lib/wizard/format";
import type {
  ComponentMetadata,
  PtmIndicationResult,
  ReadingResult,
  Verdict,
} from "@/lib/ingest/session";

/** Byte-identical to VerdictChip's labels (verdict-chip.tsx lines 11-24). */
export const VERDICT_LABELS: Record<Verdict, string> = {
  accept: "ACCEPT",
  re_check: "RE-CHECK",
  reject: "FAIL",
};

export const FALLBACK_CLOSING_SENTENCE =
  "All verdicts are computed in code and unaffected.";

/** Engine citation ids the fallback branches key on (lib/calc/evaluate.ts). */
const CITE_STRUCTURAL = "api574_10_5_1_4";
const CITE_RL = "api570_7_2";

/** `[[cite:<id>]]` only when the engine emitted the id for this reading. */
function cite(allowed: readonly string[], id: string): string {
  return allowed.includes(id) ? ` [[cite:${id}]]` : "";
}

/**
 * Deterministic cited narrative for one CML reading. Conditional assembly per
 * Pattern R4: pressure/structural branch only on engine citation membership,
 * rates only when non-null, RL only when computed, immediate-inspection
 * consequence without any date or negative interval (G14).
 */
export function fallbackNarrative(
  reading: ReadingResult,
  metadata: ComponentMetadata,
): string {
  const allowed = reading.citations;
  const name = reading.cml ?? reading.location;
  const lines: string[] = [];

  lines.push(
    `Reading ${reading.readingId} at ${name}: t-actual is ${formatFixed(reading.tActualMm, 2)} mm against t-required ${formatFixed(reading.tRequiredMm, 2)} mm.`,
  );

  if (allowed.includes(CITE_STRUCTURAL)) {
    lines.push(
      `The required thickness is the larger of the ASME B31.3 pressure design thickness and the API 574 structural minimum.${cite(allowed, CITE_STRUCTURAL)}`,
    );
  }

  const rateParts: string[] = [];
  if (reading.crLtMmYr !== null) {
    rateParts.push(
      `long-term ${formatFixed(reading.crLtMmYr, 3)} mm/yr${cite(allowed, "api570_7_1_2_lt")}`,
    );
  }
  if (reading.crStMmYr !== null) {
    rateParts.push(
      `short-term ${formatFixed(reading.crStMmYr, 3)} mm/yr${cite(allowed, "api570_7_1_2_st")}`,
    );
  }
  if (rateParts.length > 0 && reading.crGoverningMmYr !== null) {
    lines.push(
      `Corrosion rates: ${rateParts.join(", ")}; the governing rate is ${formatFixed(reading.crGoverningMmYr, 3)} mm/yr.${cite(allowed, "api570_7_1_2_governing")}`,
    );
  } else {
    lines.push(
      "Corrosion history is insufficient at this location, so no corrosion rate is quoted and none was assumed.",
    );
  }

  if (reading.rlYears !== null) {
    lines.push(
      `Remaining life is ${formatFixed(reading.rlYears, 1)} yr.${cite(allowed, CITE_RL)}`,
    );
  }

  if (reading.flags.includes("immediate_inspection")) {
    lines.push(
      "Remaining life is at or below zero, so this location requires immediate inspection — no next-inspection date is scheduled and none should be read from the table.",
    );
  }

  // Gauge-uncertainty band in the locked comparison order (verdicts.ts):
  // 1) t-actual vs t-required; 2) t-actual vs t-required + gauge uncertainty.
  const unc = metadata.gaugeUncertainty;
  const tReq = formatFixed(reading.tRequiredMm, 2);
  const tAct = formatFixed(reading.tActualMm, 2);
  const basis =
    reading.verdict === "reject"
      ? `${tAct} mm is below t-required ${tReq} mm, so the reading is in the reject band.`
      : reading.verdict === "re_check"
        ? `${tAct} mm is not below t-required ${tReq} mm but is below t-required plus gauge uncertainty (${formatFixed(reading.tRequiredMm + unc, 2)} mm ± ${formatFixed(unc, 2)} mm), so the reading is in the re-check band.`
        : `${tAct} mm is not below t-required ${tReq} mm nor below t-required plus gauge uncertainty (${formatFixed(reading.tRequiredMm + unc, 2)} mm ± ${formatFixed(unc, 2)} mm), so the reading is in the accept band.`;
  lines.push(basis);

  lines.push(`Verdict: ${VERDICT_LABELS[reading.verdict]}. ${FALLBACK_CLOSING_SENTENCE}`);
  return lines.join("\n\n");
}

/**
 * Deterministic cited narrative for one PT/MT indication: restates the
 * dimensions (L, W, count) and the engine `detail` verdict basis, citing only
 * `indication.citationId`. `thresholds` is the criteria.ptmt definition object
 * (repo-vetted values); the prose deliberately quotes no threshold numerals so
 * the 03-02 numeric lint's allowlist stays tight (Pitfall 4).
 */
export function fallbackNarrativeForIndication(
  indication: PtmIndicationResult,
  thresholds: unknown,
): string {
  void thresholds; // the template restates only the engine's own detail copy
  const morphology = indication.morphology === "linear" ? "linear" : "rounded";
  const lines: string[] = [];
  lines.push(
    `The ${morphology} ${indication.method} indication measures L ${formatFixed(indication.lengthMm, 1)} × W ${formatFixed(indication.widthMm, 1)} mm (${indication.count} recorded).`,
  );
  lines.push(`${indication.detail} [[cite:${indication.citationId}]]`);
  lines.push(`Verdict: ${VERDICT_LABELS[indication.verdict]}. ${FALLBACK_CLOSING_SENTENCE}`);
  return lines.join("\n\n");
}
