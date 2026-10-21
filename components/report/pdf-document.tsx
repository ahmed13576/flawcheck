/**
 * PDF document renderer — 04-02 Task 2, restructured by 06-01 Task 2 (SERVER
 * module, no "use client"). Mirrors the on-screen ReportDocument per the
 * locked decision: same data, same citations, same disclaimers — two
 * renderers, one content source (lib/report/content.ts + lib/wizard/format.ts).
 * Nothing is imported from components/report/report-document.tsx (it carries
 * a "use client" directive). Every clause reference is composed by
 * citationRef from the citations.json record fields — cite-don't-quote; no
 * hardcoded clause strings.
 *
 * 06-01: the document renders TWO <Page> elements — page 1 is the executive
 * dashboard (disposition banner, summary card, code-breakdown stats, top-10
 * worst locations, what-to-do-next, CSV pointer, verdict-glossary footer),
 * page 2+ carries the unchanged detail register (UI-6.13/UI-6.14).
 *
 * Styling: built-in Helvetica (body) + Courier (numeric) — NO Font.register
 * (avoids the react-pdf server font-registration gotcha entirely). Text
 * nodes keep output selectable (UI-57).
 */
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { ReportSnapshot, ReportSignOff } from "@/lib/report/session-snapshot";
import type { ReportAudit } from "@/lib/report/audit";
import {
  citationRef,
  buildConclusions,
  earliestNextInspection,
  REPORT_UNIT_ASSUMPTION_COPY,
  buildCodeBreakdown,
  buildCsvPointerLine,
  buildDispositionBannerSentence,
  buildWhatToDoNextLine,
  VERDICT_GLOSSARY,
  VERDICT_GLOSSARY_ORDER,
} from "@/lib/report/content";
import { formatFixed, formatFlagLabel } from "@/lib/wizard/format";
import { verdictLabel } from "@/components/wizard/verdict-chip";
import { calcTrendCurveGeometry, type TrendPoint, type CmlHeatmapItem } from "@/lib/analytics/geometry";
import { buildLatestPerCml } from "@/lib/analytics/adapters";
import { PdfTrendCurve } from "@/components/report/pdf-trend-curve";
import { PdfHeatmap } from "@/components/report/pdf-heatmap";

const styles = StyleSheet.create({
  body: { fontFamily: "Helvetica", fontSize: 9, color: "#111111", padding: 24, paddingBottom: 28 },
  title: { fontSize: 16, fontWeight: 700 },
  chip: { fontSize: 8, fontWeight: 700, color: "#444444" },
  sectionLabel: { fontSize: 11, fontWeight: 700, marginTop: 12 },
  metaRow: { fontSize: 8, color: "#444444", marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  gridCell: { width: "30%" },
  gridLabel: { fontSize: 7, color: "#666666" },
  gridValue: { fontSize: 9 },
  table: { marginTop: 8 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#cccccc", paddingVertical: 3 },
  tableHeader: { fontWeight: 700, borderBottomWidth: 1, borderBottomColor: "#111111" },
  cellName: { width: "22%", fontSize: 8 },
  cellNum: { width: "11%", fontSize: 8, fontFamily: "Courier" },
  cellWide: { width: "15%", fontSize: 8 },
  cellFlags: { width: "13%", fontSize: 8 },
  monoSmall: { fontFamily: "Courier", fontSize: 7, color: "#444444" },
  callout: { backgroundColor: "#fdf3d8", padding: 8, marginTop: 10 },
  calloutTitle: { fontSize: 11, fontWeight: 700 },
  footer: { marginTop: 14, fontSize: 7, color: "#555555" },
  summaryCard: { backgroundColor: "#f3f4f6", padding: 8, marginTop: 8, borderRadius: 3, borderWidth: 0.5, borderColor: "#d1d5db" },
  summaryTitle: { fontSize: 10, fontWeight: 700, color: "#111827" },
  summaryDisposition: { fontSize: 8, fontWeight: 700, color: "#991b1b" },
  summaryStat: { fontSize: 8, color: "#374151" },
  summaryHash: { fontSize: 7, fontFamily: "Courier", color: "#6b7280", marginTop: 4 },
  filterNotice: { fontSize: 7.5, color: "#047857", marginTop: 2, fontStyle: "italic" },
  pageNumber: { position: "absolute", fontSize: 7, bottom: 10, left: 24, right: 24, textAlign: "center", color: "#888888" },
});

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export function getGoverningPdfReadings(
  readings: ReportSnapshot["readings"],
  limit = 100,
): {
  governingReadings: ReportSnapshot["readings"];
  isFiltered: boolean;
  totalCount: number;
} {
  const totalCount = readings.length;
  if (totalCount <= limit) {
    return { governingReadings: readings, isFiltered: false, totalCount };
  }

  const flagged = readings.filter(
    (r) =>
      r.verdict === "reject" ||
      r.verdict === "re_check" ||
      r.flags.includes("immediate_inspection"),
  );
  const flaggedIds = new Set(flagged.map((r) => r.readingId));

  const others = readings.filter((r) => !flaggedIds.has(r.readingId));
  others.sort((a, b) => {
    const rlA = a.rlYears ?? Number.POSITIVE_INFINITY;
    const rlB = b.rlYears ?? Number.POSITIVE_INFINITY;
    return rlA - rlB;
  });

  const remainingQuota = Math.max(0, limit - flagged.length);
  const selectedOthers = others.slice(0, remainingQuota);

  const combined = [...flagged, ...selectedOthers].slice(0, limit);
  return { governingReadings: combined, isFiltered: true, totalCount };
}

/**
 * Top-10 worst locations (06-01, UI-6.17): takes the flagged-first governing
 * slice getGoverningPdfReadings(readings, 10).governingReadings and RL-sorts
 * THAT SLICE ascending with null RL last (the locked RL-ascending decision
 * for the top-10 slice ONLY — the page-2+ register keeps the unsorted
 * governing ordering). Exported pure for the node test-suite.
 */
export function getTop10Worst(
  readings: ReportSnapshot["readings"],
): ReportSnapshot["readings"] {
  const { governingReadings } = getGoverningPdfReadings(readings, 10);
  return [...governingReadings].sort((a, b) => {
    const rlA = a.rlYears ?? Number.POSITIVE_INFINITY;
    const rlB = b.rlYears ?? Number.POSITIVE_INFINITY;
    return rlA - rlB;
  });
}

function flagsLine(reading: ReportSnapshot["readings"][number]): string {
  const labels = reading.flags.map((f) => formatFlagLabel(f)).join(", ");
  return labels.length > 0 ? labels : "—";
}

/**
 * Phase 09 (VIS-01 sovereignty): pure adapters from snapshot readings to
 * geometry-engine inputs — grouping/mapping ONLY, no engineering math (the
 * thickness, t_required, and CR values are precomputed engine outputs passed
 * through verbatim). Exported pure for the node test-suite.
 */

/** Severity order for picking the trend's governing CML: reject first, then re-check, then lowest RL. */
function severityRank(r: ReportSnapshot["readings"][number]): number {
  if (r.verdict === "reject") return 0;
  if (r.verdict === "re_check") return 1;
  return 2;
}

/**
 * Picks the worst reading (reject > re-check > accept, ties by lowest RL,
 * nulls last) and returns the (date, thickness) history of THAT CML sorted
 * by date — the trend curve's precomputed input. CML identity falls back to
 * location when no grid column exists. Single-survey histories are legal
 * (VIS-02 "Insufficient History" edge renders a point + projection).
 */
export function buildGoverningTrendPoints(
  readings: ReportSnapshot["readings"],
): { points: TrendPoint[]; cmlId: string; crGoverningMmYr: number | null } {
  if (readings.length === 0) {
    return { points: [], cmlId: "", crGoverningMmYr: null };
  }
  const worst = [...readings].sort((a, b) => {
    const rank = severityRank(a) - severityRank(b);
    if (rank !== 0) return rank;
    const rlA = a.rlYears ?? Number.POSITIVE_INFINITY;
    const rlB = b.rlYears ?? Number.POSITIVE_INFINITY;
    return rlA - rlB;
  })[0];
  const identity = worst.cml ?? worst.location;
  const history = readings
    .filter((r) => (r.cml ?? r.location) === identity)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ date: r.date, thicknessMm: r.tActualMm }));
  return { points: history, cmlId: identity, crGoverningMmYr: worst.crGoverningMmYr };
}

/**
 * Maps readings to heatmap layout items: verdict + thickness flow through
 * verbatim; the spatial grid position is a dense row-major layout of the
 * reading order (deterministic, no invented coordinates).
 */
export function toHeatmapItems(
  readings: ReportSnapshot["readings"],
): CmlHeatmapItem[] {
  return buildLatestPerCml(readings);
}

function telemetryLine(step: ReportAudit["steps"][number]): string {
  const total = (step.promptTokens ?? 0) + (step.completionTokens ?? 0);
  const tokens = total > 0
    ? `${(step.promptTokens ?? 0).toLocaleString("en-US")}/${(step.completionTokens ?? 0).toLocaleString("en-US")}`
    : "—";
  const latency = step.latencyMs === null ? "—" : `${(step.latencyMs / 1000).toFixed(1)} s`;
  return `${step.step}: ${step.model ?? "—"} · tokens ${tokens} · ${latency}`;
}

export function buildPdfDocument(
  snapshot: ReportSnapshot,
  audit: ReportAudit | null | undefined,
): React.ReactElement<import("@react-pdf/renderer").DocumentProps> {
  const signedOff: ReportSignOff | null = snapshot.signOff ?? null;
  const chipText = signedOff ? `SIGNED OFF — ${signedOff.name}` : "Pending inspector sign-off";
  const unitLine = REPORT_UNIT_ASSUMPTION_COPY.replace("{csv}", snapshot.units.csvThickness).replace(
    "{meta}",
    snapshot.units.metadata,
  );
  const conclusions = buildConclusions(snapshot);
  const nextInsp = earliestNextInspection(snapshot);
  const ruleCite =
    snapshot.readings.find((r) => r.verdict !== "accept")?.citations[0] ??
    snapshot.readings[0]?.citations[1] ??
    null;

  const { governingReadings, isFiltered, totalCount } = getGoverningPdfReadings(
    snapshot.readings,
    100,
  );

  // Phase 09 visual analytics — pure adapters + the shared geometry engine
  // (PDF-01/PDF-02). The heatmap summarizes every evaluated location on
  // page 1; the trend curve projects the governing CML's degradation above
  // the page-2 register. All values are precomputed engine outputs.
  const heatmapItems = toHeatmapItems(snapshot.readings);
  const { points: trendPoints, cmlId: trendCmlId, crGoverningMmYr: trendCr } =
    buildGoverningTrendPoints(snapshot.readings);
  const trendTRequired = trendPoints.length > 0
    ? snapshot.readings.find(
        (r) => (r.cml ?? r.location) === trendCmlId,
      )?.tRequiredMm ?? 0
    : 0;
  const trendGeometry = calcTrendCurveGeometry(
    trendPoints,
    trendTRequired,
    trendCr ?? 0,
    snapshot.metadata.gaugeUncertainty,
    420,
    200,
  );

  // 06-01 dashboard derivations — pure compositions from the content seam.
  const breakdown = buildCodeBreakdown(snapshot.summary, snapshot.readings);
  const top10 = getTop10Worst(snapshot.readings);
  const dispositionHeading =
    snapshot.summary.fail > 0
      ? "ACTION REQUIRED — DEFECTS DETECTED"
      : snapshot.summary.reCheck > 0
        ? "ATTENTION — RE-CHECK REQUIRED"
        : "ACCEPTABLE FOR CONTINUED SERVICE";
  // WR-01: amber for the RE-CHECK tone — green is reserved for the all-accept
  // disposition; "ATTENTION — RE-CHECK REQUIRED" must not read as acceptable.
  const dispositionTone = snapshot.summary.fail > 0
    ? "#991b1b"
    : snapshot.summary.reCheck > 0
      ? "#b45309"
      : "#047857";
  const count = (n: number) => n.toLocaleString("en-US");

  // The page-number footer renders on EVERY page (UI-6.13) — one render node
  // reused in both Page elements.
  const pageFooter = (
    <Text
      render={({ pageNumber, totalPages }) =>
        `FlawCheck Certified Inspection Report · Page ${pageNumber} of ${totalPages}`
      }
      fixed
      style={styles.pageNumber}
    />
  );

  return (
    <Document>
      {/* ---------------- Page 1 — executive dashboard (UI-6.14) ---------------- */}
      <Page size="A4" style={styles.body}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.title}>FlawCheck Inspection Report</Text>
          <Text style={styles.chip}>{chipText}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 24, marginTop: 6 }}>
          <Text style={styles.metaRow}>GENERATED {dateOnly(new Date().toISOString())}</Text>
          <Text style={styles.metaRow}>SOURCE {snapshot.sourceName}</Text>
          <Text style={styles.metaRow}>EVALUATION DATE {dateOnly(snapshot.evaluatedAt)}</Text>
          <Text style={styles.metaRow}>
            {`REV 0 · REPORT ID ${audit?.inputHash ? audit.inputHash.slice(0, 12) : "—"}`}
          </Text>
        </View>

        {/* 1) Disposition banner — the existing three-tone heading + the locked sentence. */}
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryDisposition, { color: dispositionTone }]}>
            {dispositionHeading}
          </Text>
          <Text style={styles.summaryStat}>{buildDispositionBannerSentence(snapshot.summary)}</Text>
        </View>

        {/* 2) Executive summary card (moved onto page 1; "Total CMLs" → "Total readings" — P5). */}
        <View style={styles.summaryCard}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.summaryTitle}>EXECUTIVE EVALUATION SUMMARY</Text>
            <Text style={[styles.summaryDisposition, { color: dispositionTone }]}>
              {dispositionHeading}
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
            <Text style={styles.summaryStat}>
              Total readings: {count(snapshot.summary.total)}
            </Text>
            <Text style={styles.summaryStat}>
              {`Disposition: ${snapshot.summary.accept} Accept · ${snapshot.summary.reCheck} Re-Check · ${snapshot.summary.fail} Fail`}
            </Text>
            <Text style={styles.summaryStat}>
              Locations: {count(snapshot.summary.locations)}
            </Text>
          </View>
          {audit?.inputHash && (
            <Text style={styles.summaryHash}>
              SHA-256 Register Seal: {audit.inputHash}
            </Text>
          )}
        </View>

        {/* 3) Code-breakdown stats — verdict counts + both governing branches (UI-6.16). */}
        <View style={styles.grid}>
          <View style={styles.gridCell}>
            <Text style={styles.gridLabel}>Verdicts</Text>
            <Text style={styles.gridValue}>
              {`${count(breakdown.verdicts.accept)} Accept · ${count(breakdown.verdicts.reCheck)} Re-check · ${count(breakdown.verdicts.fail)} Fail`}
            </Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.gridLabel}>vs pressure design (B31.3)</Text>
            <Text style={styles.gridValue}>
              {`${count(breakdown.pressure.pass)} pass · ${count(breakdown.pressure.fail)} fail`}
            </Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.gridLabel}>vs structural minimum (API 574)</Text>
            <Text style={styles.gridValue}>
              {`${count(breakdown.structural.pass)} pass · ${count(breakdown.structural.fail)} fail`}
            </Text>
          </View>
        </View>

        {/* 3.5) Spatial severity matrix (PDF-02) — compact vector grid
            adjacent to the top-10 table (CONTEXT decision 4). */}
        <PdfHeatmap cmls={heatmapItems} width={300} height={130} />

        {/* 4) Top-10 worst locations — RL-ascending slice (null RL last). */}
        <Text style={styles.sectionLabel}>Top-10 worst locations</Text>
        <View style={styles.table}>
          <View wrap={false} style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.cellName}>CML / Location</Text>
            <Text style={styles.cellNum}>t-actual (mm)</Text>
            <Text style={styles.cellNum}>t-required (mm)</Text>
            <Text style={styles.cellNum}>RL (yr)</Text>
            <Text style={styles.cellWide}>Verdict</Text>
          </View>
          {top10.map((r) => (
            <View key={r.readingId} wrap={false} style={styles.tableRow}>
              <Text style={styles.cellName}>{r.cml ?? r.location}</Text>
              <Text style={styles.cellNum}>{formatFixed(r.tActualMm, 2)}</Text>
              <Text style={styles.cellNum}>{formatFixed(r.tRequiredMm, 2)}</Text>
              <Text style={styles.cellNum}>
                {r.rlYears === null
                  ? "—"
                  : r.rlYears <= 0
                    ? "0.0 (RETIRED)"
                    : formatFixed(r.rlYears, 1)}
              </Text>
              <Text style={styles.cellWide}>{verdictLabel(r.verdict)}</Text>
            </View>
          ))}
        </View>

        {/* 5) What-to-do-next line (UI-6.18). */}
        <Text style={styles.summaryStat}>{buildWhatToDoNextLine(snapshot.summary)}</Text>

        {/* 6) CSV pointer — static text, no hyperlink this phase (UI-6.19). */}
        <Text style={styles.footer}>{buildCsvPointerLine(totalCount)}</Text>

        {/* 7) Verdict glossary footer — sub-lines ONLY via citationRef (UI-6.12). */}
        <Text style={styles.gridLabel}>Verdict glossary</Text>
        {VERDICT_GLOSSARY_ORDER.map((verdict) => {
          const entry = VERDICT_GLOSSARY[verdict];
          return (
            <View key={verdict}>
              <Text style={styles.footer}>{entry.plain}</Text>
              <Text style={styles.monoSmall}>
                {entry.citationId ? citationRef(entry.citationId) : ""}
              </Text>
            </View>
          );
        })}
        {pageFooter}
      </Page>

      {/* ------------- Page 2+ — unchanged detail register (UI-6.13) ------------- */}
      <Page size="A4" style={styles.body}>
        <Text style={styles.sectionLabel}>Component context</Text>
        <View style={styles.grid}>
          <View style={styles.gridCell}>
            <Text style={styles.gridLabel}>OD</Text>
            <Text style={styles.gridValue}>{formatFixed(snapshot.metadata.od, 1)} mm</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.gridLabel}>t-nom</Text>
            <Text style={styles.gridValue}>{formatFixed(snapshot.metadata.tNominal, 2)} mm</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.gridLabel}>Design code</Text>
            <Text style={styles.gridValue}>{snapshot.metadata.designCode}</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.gridLabel}>Piping class</Text>
            <Text style={styles.gridValue}>Class {snapshot.metadata.pipeClass}</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.gridLabel}>FCA</Text>
            <Text style={styles.gridValue}>{formatFixed(snapshot.metadata.fca, 1)} mm</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.gridLabel}>Evaluation date</Text>
            <Text style={styles.gridValue}>{dateOnly(snapshot.evaluatedAt)}</Text>
          </View>
        </View>
        <Text style={styles.metaRow}>{unitLine}</Text>

        <Text style={styles.sectionLabel}>PT/MT indication triage</Text>
        {snapshot.indications.length === 0 ? (
          <Text style={styles.metaRow}>No PT/MT indications recorded for this evaluation.</Text>
        ) : (
          <View style={styles.table}>
            <View wrap={false} style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.cellNum}>Method</Text>
              <Text style={styles.cellWide}>Morphology</Text>
              <Text style={styles.cellWide}>Dimensions</Text>
              <Text style={styles.cellNum}>Verdict</Text>
              <Text style={styles.cellWide}>Clause reference</Text>
            </View>
            {snapshot.indications.map((ind) => (
              <View key={ind.id} wrap={false} style={styles.tableRow}>
                <Text style={styles.cellNum}>{ind.method}</Text>
                <Text style={styles.cellWide}>{ind.morphology} (declared: informational)</Text>
                <Text style={styles.cellWide}>
                  L {formatFixed(ind.lengthMm, 1)} × W {formatFixed(ind.widthMm, 1)} mm
                </Text>
                <Text style={styles.cellNum}>{verdictLabel(ind.verdict)}</Text>
                <Text style={styles.cellWide}>{citationRef(ind.citationId) || "—"}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Phase 09 (PDF-01): vector degradation projection of the governing
            CML above the detailed register — same geometry as the web chart. */}
        <PdfTrendCurve
          geometry={trendGeometry}
          title={`Degradation Projection — ${trendCmlId || "governing CML"}`}
          caption={`Governing CR ${trendCr === null ? "—" : `${formatFixed(trendCr, 3)} mm/yr`} · gauge uncertainty ±${formatFixed(snapshot.metadata.gaugeUncertainty, 2)} mm · t_required ${formatFixed(trendTRequired, 2)} mm`}
        />

        <Text style={styles.sectionLabel}>
          {isFiltered ? "Governing CML measurements (critical register)" : "CML measurements"}
        </Text>
        {isFiltered && (
          <Text style={styles.filterNotice}>
            {`Showing top ${governingReadings.length} critical locations (all FAIL / RE-CHECK and lowest remaining life points). The complete register of ${totalCount.toLocaleString("en-US")} readings is certified under verification hash: ${audit?.inputHash ?? "archive-seal"}. Full dataset exportable via raw CSV.`}
          </Text>
        )}
        <View style={styles.table}>
          <View wrap={false} style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.cellName}>CML / Location</Text>
            <Text style={styles.cellNum}>t-actual (mm)</Text>
            <Text style={styles.cellNum}>t-required (mm)</Text>
            <Text style={styles.cellNum}>CR gov. (mm/yr)</Text>
            <Text style={styles.cellNum}>RL (yr)</Text>
            <Text style={styles.cellWide}>Next inspection</Text>
            <Text style={styles.cellFlags}>Flags</Text>
            <Text style={styles.cellNum}>Verdict</Text>
          </View>
          {governingReadings.map((r) => (
            <View key={r.readingId} wrap={false} style={styles.tableRow}>
              <Text style={styles.cellName}>{r.cml ?? r.location}</Text>
              <Text style={styles.cellNum}>{formatFixed(r.tActualMm, 2)}</Text>
              <Text style={styles.cellNum}>{formatFixed(r.tRequiredMm, 2)}</Text>
              <Text style={styles.cellNum}>{r.crGoverningMmYr === null ? "—" : formatFixed(r.crGoverningMmYr, 3)}</Text>
              <Text style={styles.cellNum}>
                {r.rlYears === null
                  ? "—"
                  : r.rlYears <= 0
                    ? "0.0 (RETIRED)"
                    : formatFixed(r.rlYears, 1)}
              </Text>
              <Text style={styles.cellWide}>
                {r.nextInspection
                  ? `${r.nextInspection.date} (interval ${formatFixed(r.nextInspection.intervalYears, 1)} yr)`
                  : r.flags.includes("immediate_inspection")
                    ? "Immediate inspection required"
                    : "—"}
              </Text>
              <Text style={styles.cellFlags}>{flagsLine(r)}</Text>
              <Text style={styles.cellNum}>{verdictLabel(r.verdict)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Clause-cited conclusions</Text>
        {conclusions.map((line, i) => (
          <Text key={i} style={{ marginTop: 6, fontSize: 9 }}>
            {i + 1}.  {line.text} ({line.citationId ? citationRef(line.citationId) : "no citation"})
          </Text>
        ))}

        {nextInsp ? (
          <View style={styles.callout}>
            <Text style={styles.calloutTitle}>Next inspection: {nextInsp.split(" ")[0] ?? nextInsp}</Text>
            <Text style={styles.monoSmall}>Rule applied: {ruleCite ? citationRef(ruleCite) : "—"}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Audit appendix</Text>
        {audit ? (
          <View>
            <Text style={styles.monoSmall}>input hash: {audit.inputHash}</Text>
            {audit.steps.map((step) => (
              <Text key={step.step} style={styles.monoSmall}>
                {telemetryLine(step)}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={styles.monoSmall}>audit: — (no telemetry recorded)</Text>
        )}

        <Text style={styles.sectionLabel}>Inspector sign-off</Text>
        <View style={styles.grid}>
          <View style={styles.gridCell}>
            <Text style={styles.gridLabel}>Name</Text>
            <Text style={styles.gridValue}>{signedOff?.name ?? ""}</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.gridLabel}>Certification</Text>
            <Text style={styles.gridValue}>{signedOff?.certification ?? ""}</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.gridLabel}>Date</Text>
            <Text style={styles.gridValue}>{signedOff?.date ?? ""}</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.gridLabel}>Signature</Text>
            <Text style={styles.gridValue}>{signedOff?.signature ?? ""}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          This report is an engineering aid based on supplied measurements and stated assumptions.
          Confirm findings, calculations, and disposition through the responsible inspector and
          applicable procedures.
        </Text>
        {pageFooter}
      </Page>
    </Document>
  );
}
