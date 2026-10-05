/**
 * PDF document renderer — 04-02 Task 2 (SERVER module, no "use client").
 * Mirrors the on-screen ReportDocument 1:1 per the locked decision: same
 * data, same citations, same disclaimers — two renderers, one content
 * source (lib/report/content.ts + lib/wizard/format.ts). Nothing is
 * imported from components/report/report-document.tsx (it carries a
 * "use client" directive). Every clause reference is composed by
 * citationRef from the citations.json record fields — cite-don't-quote;
 * no hardcoded clause strings.
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
} from "@/lib/report/content";
import { formatFixed } from "@/lib/wizard/format";
import { verdictLabel, flagChipFor } from "@/components/wizard/verdict-chip";

const styles = StyleSheet.create({
  body: { fontFamily: "Helvetica", fontSize: 9, color: "#111111", paddingBottom: 24 },
  title: { fontSize: 16, fontWeight: 700 },
  chip: { fontSize: 8, fontWeight: 700, color: "#444444" },
  sectionLabel: { fontSize: 11, fontWeight: 700, marginTop: 14 },
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
  footer: { marginTop: 18, fontSize: 7, color: "#555555" },
});

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function flagsLine(reading: ReportSnapshot["readings"][number]): string {
  const labels = reading.flags.map((f) => flagChipFor(f)?.label ?? f).join(", ");
  return labels.length > 0 ? labels : "—";
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

  return (
    <Document>
      <Page size="A4" style={styles.body}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.title}>FlawCheck Inspection Report</Text>
          <Text style={styles.chip}>{chipText}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 24, marginTop: 6 }}>
          <Text style={styles.metaRow}>GENERATED {dateOnly(new Date().toISOString())}</Text>
          <Text style={styles.metaRow}>SOURCE {snapshot.sourceName}</Text>
          <Text style={styles.metaRow}>EVALUATION DATE {dateOnly(snapshot.evaluatedAt)}</Text>
        </View>

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

        <Text style={styles.sectionLabel}>CML measurements</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.cellName}>CML / Location</Text>
            <Text style={styles.cellNum}>t-actual (mm)</Text>
            <Text style={styles.cellNum}>t-required (mm)</Text>
            <Text style={styles.cellNum}>CR gov. (mm/yr)</Text>
            <Text style={styles.cellNum}>RL (yr)</Text>
            <Text style={styles.cellWide}>Next inspection</Text>
            <Text style={styles.cellFlags}>Flags</Text>
            <Text style={styles.cellNum}>Verdict</Text>
          </View>
          {snapshot.readings.map((r) => (
            <View key={r.readingId} style={styles.tableRow}>
              <Text style={styles.cellName}>{r.cml ?? r.location}</Text>
              <Text style={styles.cellNum}>{formatFixed(r.tActualMm, 2)}</Text>
              <Text style={styles.cellNum}>{formatFixed(r.tRequiredMm, 2)}</Text>
              <Text style={styles.cellNum}>{r.crGoverningMmYr === null ? "—" : formatFixed(r.crGoverningMmYr, 3)}</Text>
              <Text style={styles.cellNum}>{r.rlYears === null ? "—" : formatFixed(r.rlYears, 1)}</Text>
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

        <Text style={styles.sectionLabel}>PT/MT indication</Text>
        {snapshot.indications.length === 0 ? (
          <Text style={styles.metaRow}>No PT/MT indications recorded for this evaluation.</Text>
        ) : (
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.cellNum}>Method</Text>
              <Text style={styles.cellWide}>Morphology</Text>
              <Text style={styles.cellWide}>Dimensions</Text>
              <Text style={styles.cellNum}>Verdict</Text>
              <Text style={styles.cellWide}>Clause reference</Text>
            </View>
            {snapshot.indications.map((ind) => (
              <View key={ind.id} style={styles.tableRow}>
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
      </Page>
    </Document>
  );
}
