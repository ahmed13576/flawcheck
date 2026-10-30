/** Server-side PDF renderer for the deterministic FlawCheck report.
 *
 * Layout (Phase 7 merge): three landscape A4 pages.
 *   Page 1 — executive triage: component context, population reconciliation,
 *            Priority-1 surface indications, Top-10 unique CMLs, spatial
 *            severity heatmap, verdict glossary, report limits.
 *   Page 2 — Master CML Register: exactly one row per CML (40 rows), wrap=false.
 *   Page 3 — degradation trend for the governing CML, PT/MT indication triage,
 *            audit appendix, and the four-field inspector sign-off.
 *
 * This renderer replaced the 20-page reading-by-reading conclusion dump that the
 * technical audit condemned; the per-reading "is below the calculated required
 * thickness" list is deliberately not reproduced here.
 *
 * Every value is a TypeScript-evaluated field. Clause references are composed by
 * citationRef from citations.json — cite-don't-quote, no hardcoded clause text.
 * Thresholds are derived from snapshot metadata, not from demo literals.
 * Styling: built-in Helvetica (body) + Courier (numeric) — no Font.register.
 */
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { ReportSnapshot, ReportSignOff } from "@/lib/report/session-snapshot";
import type { ReportAudit } from "@/lib/report/audit";
import type { ReadingResult } from "@/lib/ingest/session";
import type { TrendPoint, CmlHeatmapItem } from "@/lib/analytics/geometry";
import {
  buildCodeBreakdown,
  buildCsvPointerLine,
  citationRef,
  REPORT_UNIT_ASSUMPTION_COPY,
  VERDICT_GLOSSARY,
  VERDICT_GLOSSARY_ORDER,
} from "@/lib/report/content";
import { formatFixed, formatFlagLabel } from "@/lib/wizard/format";
import { verdictLabel } from "@/components/wizard/verdict-chip";
import { calcTrendCurveGeometry } from "@/lib/analytics/geometry";
import { PdfTrendCurve } from "@/components/report/pdf-trend-curve";
import { PdfHeatmap } from "@/components/report/pdf-heatmap";
import { buildCmlSummaries, topCriticalCmls, type CmlSummaryRow } from "@/lib/calc/cml-summary";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 7, color: "#111111", padding: 16, paddingBottom: 22 },
  title: { fontSize: 14, fontWeight: 700 },
  subtitle: { fontSize: 7.5, color: "#333333", marginTop: 2 },
  section: { fontSize: 8.6, fontWeight: 700, marginTop: 4, marginBottom: 1.5 },
  small: { fontSize: 6, lineHeight: 1.1 },
  metaRowSmall: { fontSize: 5.8, color: "#444444", marginTop: 1.5 },
  mono: { fontFamily: "Courier", fontSize: 5.4 },
  monoSmall: { fontFamily: "Courier", fontSize: 5.4, color: "#444444" },
  card: { borderWidth: 0.6, borderColor: "#b8c4d6", padding: 4, marginTop: 3, backgroundColor: "#f6f8fb" },
  alert: { borderWidth: 0.8, borderColor: "#991b1b", padding: 4, marginTop: 3, backgroundColor: "#fff1f2" },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 2 },
  gridCell: { width: "33.33%", paddingRight: 4, marginBottom: 1.5 },
  gridLabel: { fontSize: 5.6, color: "#666666" },
  gridValue: { fontSize: 6.6 },
  row: { flexDirection: "row", borderBottomWidth: 0.35, borderBottomColor: "#d1d5db", minHeight: 8.4, alignItems: "stretch" },
  headRow: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: "#111111", backgroundColor: "#e8eef8", minHeight: 10, alignItems: "center" },
  c: { paddingHorizontal: 1.6, paddingVertical: 0.8, fontSize: 5.3, lineHeight: 1.02 },
  h: { paddingHorizontal: 1.6, paddingVertical: 1.1, fontSize: 5.3, fontWeight: 700, lineHeight: 1.02 },
  footer: { position: "absolute", bottom: 7, left: 16, right: 16, textAlign: "center", fontSize: 5.6, color: "#555555" },
});

function dateOnly(iso: string): string { return iso.slice(0, 10); }
function n(v: number | null, dp: 1 | 2 | 3 = 2): string {
  return v === null || !Number.isFinite(v) ? "N/A" : v.toFixed(dp);
}
function dash(v: string | number | null): string { return v === null || v === "" ? "N/A" : String(v); }
function flags(flagList: readonly string[]): string {
  if (!flagList.length) return "OK";
  const compact: Record<string, string> = {
    immediate_inspection: "IMM",
    insufficient_history: "NOHIST",
    insufficient_interval: "SHORT",
    gauge_deadband: "DEAD",
    long_term_fallback: "LTFB",
    measurement_inconsistency: "INC",
    outlier: "OUT",
  };
  return flagList.map((flag) => compact[flag] ?? formatFlagLabel(flag)).join("|");
}
function rlText(v: number | null): string {
  return v === null ? "N/A — No Measurable Loss" : v <= 0 ? "0.0 — Immediate action" : v.toFixed(1);
}
function sealText(audit: ReportAudit | null | undefined): string {
  return audit?.inputHash ?? "missing-server-seal";
}

function readingSeverity(a: ReadingResult, b: ReadingResult): number {
  const aImm = a.flags.includes("immediate_inspection") ? 0 : 1;
  const bImm = b.flags.includes("immediate_inspection") ? 0 : 1;
  if (aImm !== bImm) return aImm - bImm;
  const rank = (v: ReadingResult["verdict"]) => (v === "reject" ? 0 : v === "re_check" ? 1 : 2);
  const diff = rank(a.verdict) - rank(b.verdict);
  if (diff !== 0) return diff;
  if (a.rlYears === null && b.rlYears === null) return 0;
  if (a.rlYears === null) return 1;
  if (b.rlYears === null) return -1;
  return a.rlYears - b.rlYears;
}

export function getTop10Worst(readings: ReadingResult[]): ReadingResult[] {
  return [...readings].sort(readingSeverity).slice(0, 10);
}

export function getGoverningPdfReadings(readings: ReadingResult[], limit = 100) {
  return {
    governingReadings: getTop10Worst(readings).slice(0, limit),
    isFiltered: readings.length > limit,
    totalCount: readings.length,
  };
}

function cmlCounts(rows: CmlSummaryRow[]) {
  return {
    accept: rows.filter((r) => r.disposition === "accept").length,
    reCheck: rows.filter((r) => r.disposition === "re_check").length,
    fail: rows.filter((r) => r.disposition === "reject").length,
  };
}

function tableRow(cells: Array<string | number>, widths: number[], header = false, key?: string | number) {
  return (
    <View key={key} wrap={false} style={header ? styles.headRow : styles.row}>
      {cells.map((cell, i) => (
        <Text key={i} style={[header ? styles.h : styles.c, { width: `${widths[i]}%` }]}>{String(cell)}</Text>
      ))}
    </View>
  );
}

function telemetryLine(step: ReportAudit["steps"][number]): string {
  const total = (step.promptTokens ?? 0) + (step.completionTokens ?? 0);
  const tokens = total > 0
    ? `${(step.promptTokens ?? 0).toLocaleString("en-US")}/${(step.completionTokens ?? 0).toLocaleString("en-US")}`
    : "—";
  const latency = step.latencyMs === null ? "—" : `${(step.latencyMs / 1000).toFixed(1)} s`;
  return `${step.step}: ${step.model ?? "—"} · tokens ${tokens} · ${latency}`;
}

export function buildPdfDocument(snapshot: ReportSnapshot, audit: ReportAudit | null | undefined) {
  const signedOff: ReportSignOff | null = snapshot.signOff ?? null;
  const chipText = signedOff ? `SIGNED OFF — ${signedOff.name}` : "Pending inspector sign-off";
  const unitLine = REPORT_UNIT_ASSUMPTION_COPY.replace("{csv}", snapshot.units.csvThickness).replace(
    "{meta}",
    snapshot.units.metadata,
  );

  const cmlRows = buildCmlSummaries(snapshot.readings, snapshot.metadata.gaugeUncertainty);
  const top10 = topCriticalCmls(cmlRows, 10);
  const cml = cmlCounts(cmlRows);
  const breakdown = buildCodeBreakdown(snapshot.summary, snapshot.readings);
  const seal = sealText(audit);
  const ptmtRejects = snapshot.indications.filter((i) => i.verdict === "reject");

  // Thresholds derived from this evaluation's metadata (not demo literals), so a
  // different component or gauge uncertainty prints its own correct bands.
  const tReq = snapshot.metadata.tStructural;
  const gauge = snapshot.metadata.gaugeUncertainty;
  const upper = tReq + gauge;
  const boundaryLine =
    `Governing required benchmark: FAIL below ${tReq.toFixed(2)} mm; ` +
    `RE-CHECK ${tReq.toFixed(2)} through ${upper.toFixed(2)} mm inclusive or active anomaly; ` +
    `ACCEPT only above ${upper.toFixed(2)} mm with no active anomaly.`;

  // Analytics: heatmap grid (historical-minimum governed) and the governing CML trend.
  const heatmapItems = toHeatmapItems(snapshot.readings);
  const trend = buildGoverningTrendPoints(snapshot.readings);
  const trendGeometry =
    trend.points.length >= 2 && trend.crGoverningMmYr !== null && trend.crGoverningMmYr > 0
      ? calcTrendCurveGeometry(
          trend.points,
          trend.tRequiredMm,
          trend.crGoverningMmYr,
          snapshot.metadata.gaugeUncertainty,
          470,
          165,
        )
      : null;

  // Widths sum to 100%. RL needs 11%: at 7% both "N/A — No Measurable Loss" and
  // "0.0 — Immediate action" wrapped mid-word ("Immediate ac-tion"), which is the
  // same split-token class the technical audit condemned.
  const widths = [6, 4, 6, 6, 6, 9, 9, 9, 6, 7, 11, 15, 6];
  const masterHeader = ["CML", "n", "Base", "Prev", "Latest", "Hist min", "P/S/G req", "ST/LT", "Gov", "Raw max", "RL", "Flags", "Disp"];

  const footer = (
    <Text
      fixed
      style={styles.footer}
      render={({ pageNumber, totalPages }) =>
        `FlawCheck NDT Examination Report · Page ${pageNumber} of ${totalPages} · seal ${seal}`
      }
    />
  );

  return (
    <Document
      title="FlawCheck WBT-S6 NDT Examination Report"
      author="FlawCheck deterministic TypeScript report route"
      creator="FlawCheck Next.js app / @react-pdf/renderer"
      producer="FlawCheck Next.js app / @react-pdf/renderer"
    >
      {/* ---------------- Page 1 — executive triage ---------------- */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.title}>FlawCheck WBT-S6 NDT Examination Report</Text>
          <Text style={styles.small}>{chipText}</Text>
        </View>
        <Text style={styles.subtitle}>
          Generated {dateOnly(new Date().toISOString())} · Evaluation date {dateOnly(snapshot.evaluatedAt)} · Source {snapshot.sourceName}
        </Text>
        <Text style={styles.mono}>Canonical CSV/server seal: {seal}</Text>

        {/* 1) Component context */}
        <Text style={styles.section}>Component context</Text>
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
        <Text style={styles.metaRowSmall}>{unitLine}</Text>

        {/* 2) Population reconciliation */}
        <View style={styles.card}>
          <Text style={styles.section}>Population reconciliation</Text>
          <Text style={styles.small}>
            Reading-level verdicts: {snapshot.summary.accept} ACCEPT · {snapshot.summary.reCheck} RE-CHECK · {snapshot.summary.fail} FAIL · total {snapshot.summary.total} readings.
          </Text>
          <Text style={styles.small}>
            CML-level dispositions (historical minimum governs): {cml.accept} ACCEPT · {cml.reCheck} RE-CHECK · {cml.fail} FAIL · total {cmlRows.length} CMLs.
          </Text>
          <Text style={styles.small}>
            Pressure branch: {breakdown.pressure.pass} pass / {breakdown.pressure.fail} fail. Structural branch: {breakdown.structural.pass} pass / {breakdown.structural.fail} fail. {boundaryLine}
          </Text>
        </View>

        {/* 3) Priority-1 surface indications */}
        <View style={styles.alert}>
          <Text style={styles.section}>Priority 1 deterministic surface indication</Text>
          {ptmtRejects.length ? (
            ptmtRejects.map((i) => (
              <Text key={i.id} style={styles.small}>
                Priority 1 · {i.method} {i.morphology} indication · L {n(i.lengthMm, 1)} × W {n(i.widthMm, 1)} mm · {verdictLabel(i.verdict)} · field label overridden by deterministic ASME B31.3 surface indication rule ({citationRef(i.citationId)}) · NDT examination, API inspection, and engineering/FFS decisions remain separate responsible roles.
              </Text>
            ))
          ) : (
            <Text style={styles.small}>No rejected PT/MT indications recorded.</Text>
          )}
        </View>

        {/* 4) Top-10 unique CMLs */}
        <Text style={styles.section}>Top 10 unique CMLs (historical minimum first)</Text>
        {tableRow(["Rank", "CML", "Hist min/latest", "Req P/S/G", "Valid ST/LT", "Gov/raw", "RL", "Flags", "Disposition"], [6, 14, 15, 13, 14, 13, 12, 15, 8], true)}
        {top10.map((r, i) =>
          tableRow(
            [
              i + 1,
              r.cmlId,
              `${n(r.historicalMinimumMm)}/${n(r.latestMm)}`,
              `${n(r.tPressureMm)}/${n(r.tStructuralMm)}/${n(r.tRequiredMm)}`,
              `${n(r.validatedShortTermRateMmYr, 3)}/${n(r.validatedLongTermRateMmYr, 3)}`,
              `${n(r.governingRateMmYr, 3)}/${n(r.rawMaxRateMmYr, 3)}`,
              rlText(r.remainingLifeYears),
              flags(r.flags),
              verdictLabel(r.disposition),
            ],
            [6, 14, 15, 13, 14, 13, 12, 15, 8],
            false,
            r.cmlId,
          ),
        )}

        {/* 5) Spatial severity heatmap */}
        {heatmapItems.length > 0 && (
          <View style={{ marginTop: 4 }}>
            <Text style={styles.section}>Spatial severity heatmap</Text>
            {/* Width sized to the 10x4 grid so the SVG has no dead space:
                cellSize = min(width/10, height/4), so 210x84 gives 21pt cells. */}
            <PdfHeatmap cmls={heatmapItems} width={210} height={84} />
            <Text style={styles.monoSmall}>
              One cell per CML, coloured by historical-minimum disposition. Vector art, no rasterization.
            </Text>
          </View>
        )}

        {/* 6) Verdict glossary */}
        <Text style={styles.section}>Verdict glossary</Text>
        {VERDICT_GLOSSARY_ORDER.map((verdict) => {
          const entry = VERDICT_GLOSSARY[verdict];
          return (
            <View key={verdict}>
              <Text style={styles.small}>{`${verdictLabel(verdict)} — ${entry.plain}`}</Text>
              <Text style={styles.monoSmall}>{entry.citationId ? citationRef(entry.citationId) : ""}</Text>
            </View>
          );
        })}

        {/* 7) Report limits */}
        <Text style={styles.section}>Report limits</Text>
        <Text style={styles.small}>
          This is a deterministic NDT examination aid based on supplied measurements and assumptions. It is not professional engineering certification, guaranteed code compliance, inspector replacement, API 570 interval approval, Fitness-for-Service approval, formal PDF/UA conformance, or final continued-service authorization.
        </Text>
        <Text style={styles.monoSmall}>{buildCsvPointerLine(snapshot.summary.total)}</Text>
        {footer}
      </Page>

      {/* ---------------- Page 2 — Master CML Register ---------------- */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Master CML Register — exactly one row per WBT-S6 CML</Text>
        <Text style={styles.subtitle}>
          All {snapshot.summary.total} readings reconcile to these {cmlRows.length} CML rows. Historical minimum governs disposition; latest and minimum are both shown.
        </Text>
        {tableRow(masterHeader, widths, true)}
        {cmlRows.map((r) =>
          tableRow(
            [
              r.cmlId.replace("WBT-S6 / ", "WBT-S6/"),
              r.scanCount,
              n(r.baselineMm),
              dash(r.previousMm === null ? null : n(r.previousMm)),
              n(r.latestMm),
              `${n(r.historicalMinimumMm)} ${r.historicalMinimumDate}`,
              `${n(r.tPressureMm)}/${n(r.tStructuralMm)}/${n(r.tRequiredMm)}`,
              `${n(r.validatedShortTermRateMmYr, 3)}/${n(r.validatedLongTermRateMmYr, 3)}`,
              n(r.governingRateMmYr, 3),
              n(r.rawMaxRateMmYr, 3),
              rlText(r.remainingLifeYears),
              flags(r.flags),
              verdictLabel(r.disposition),
            ],
            widths,
            false,
            r.cmlId,
          ),
        )}
        {footer}
      </Page>

      {/* ---------------- Page 3 — trend, triage, audit, sign-off ---------------- */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Degradation trend, indication triage, audit and sign-off</Text>

        <Text style={styles.section}>
          {trend.cmlId ? `Degradation projection — ${trend.cmlId}` : "Degradation projection"}
        </Text>
        {trendGeometry ? (
          <PdfTrendCurve
            geometry={trendGeometry}
            caption={`Governing CML ${trend.cmlId} · t_required ${n(trend.tRequiredMm)} mm · CR ${n(trend.crGoverningMmYr, 3)} mm/yr`}
          />
        ) : (
          <Text style={styles.small}>
            No positive validated corrosion rate is available for {trend.cmlId || "any CML"}, so no projection is plotted: a zero-rate projection would imply a guarantee the measurements do not support.
          </Text>
        )}

        <Text style={styles.section}>PT/MT indication triage</Text>
        {snapshot.indications.length === 0 ? (
          <Text style={styles.small}>No PT/MT indications recorded for this evaluation.</Text>
        ) : (
          <View>
            {tableRow(["Method", "Morphology", "Dimensions", "Verdict", "Clause reference"], [10, 18, 20, 16, 36], true)}
            {snapshot.indications.map((ind) =>
              tableRow(
                [
                  ind.method,
                  ind.morphology,
                  `L ${n(ind.lengthMm, 1)} × W ${n(ind.widthMm, 1)} mm`,
                  verdictLabel(ind.verdict),
                  citationRef(ind.citationId),
                ],
                [10, 18, 20, 16, 36],
                false,
                ind.id,
              ),
            )}
          </View>
        )}

        <Text style={styles.section}>Audit appendix</Text>
        <Text style={styles.monoSmall}>input hash: {audit?.inputHash ?? "—"}</Text>
        {audit?.steps ? (
          audit.steps.map((step) => (
            <Text key={step.step} style={styles.monoSmall}>
              {telemetryLine(step)}
            </Text>
          ))
        ) : (
          <Text style={styles.monoSmall}>audit: — (no telemetry recorded)</Text>
        )}

        {/* Inspector sign-off — the same four fields master has always rendered. */}
        <Text style={styles.section}>Inspector sign-off</Text>
        <View style={styles.grid}>
          <View style={{ width: "25%", paddingRight: 4 }}>
            <Text style={styles.gridLabel}>Name</Text>
            <Text style={styles.gridValue}>{signedOff?.name ?? ""}</Text>
          </View>
          <View style={{ width: "25%", paddingRight: 4 }}>
            <Text style={styles.gridLabel}>Certification</Text>
            <Text style={styles.gridValue}>{signedOff?.certification ?? ""}</Text>
          </View>
          <View style={{ width: "25%", paddingRight: 4 }}>
            <Text style={styles.gridLabel}>Date</Text>
            <Text style={styles.gridValue}>{signedOff?.date ?? ""}</Text>
          </View>
          <View style={{ width: "25%", paddingRight: 4 }}>
            <Text style={styles.gridLabel}>Signature</Text>
            <Text style={styles.gridValue}>{signedOff?.signature ?? ""}</Text>
          </View>
        </View>
        {footer}
      </Page>
    </Document>
  );
}

export function buildGoverningTrendPoints(readings: ReadingResult[]): {
  points: TrendPoint[];
  cmlId: string;
  tRequiredMm: number;
  crGoverningMmYr: number | null;
} {
  const rows = buildCmlSummaries(readings);
  const worst = topCriticalCmls(rows, 1)[0];
  if (!worst) return { points: [], cmlId: "", tRequiredMm: 0, crGoverningMmYr: null };
  const points = readings
    .filter((r) => (r.cml ?? r.location) === worst.cmlId)
    .map((r) => ({ date: r.date, thicknessMm: r.tActualMm }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    points,
    cmlId: worst.cmlId,
    tRequiredMm: worst.tRequiredMm,
    crGoverningMmYr: worst.governingRateMmYr,
  };
}

export function toHeatmapItems(readings: ReadingResult[]): CmlHeatmapItem[] {
  return buildCmlSummaries(readings).map((row, i) => ({
    cmlId: row.cmlId,
    x: (i % 10) + 1,
    y: Math.floor(i / 10) + 1,
    tActualMm: row.historicalMinimumMm,
    tRequiredMm: row.tRequiredMm,
    verdict: row.disposition,
    crMmYr: row.governingRateMmYr,
  }));
}
