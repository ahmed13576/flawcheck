"use client";

/**
 * /report — the UNLOCKED Screen 4 report route (04-03 Task 2): reads the
 * session-only snapshot + audit on mount, redirects to / when absent, and
 * wires the full ReportDocument contract: sign-off persistence (sessionStorage
 * via withSignOff), Download PDF (POST /api/report/pdf → blob download), Print
 * (window.print — the same document, print CSS hides chrome), and the audit
 * record from Screen 3's writer. After load it also fires the PLAT-03
 * post-acceptance Tavily code-edition lookup (GET /api/tavily) — degrade-to-
 * hidden: absent key, timeout, or failure renders no block, never an error.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  readReportSnapshot,
  writeReportSnapshot,
  withSignOff,
  type ReportSnapshot,
  type ReportSignOff,
} from "@/lib/report/session-snapshot";
import { readReportAudit } from "@/lib/report/audit";
import type { ReportAudit } from "@/lib/report/audit";
import { ReportDocument } from "@/components/report/report-document";

const SIGN_OFF_KEY = "flawcheck:report-signoff:v1";

function readSignOff(): ReportSignOff | null {
  try {
    const raw = sessionStorage.getItem(SIGN_OFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReportSignOff>;
    if (
      typeof parsed.name === "string" &&
      typeof parsed.certification === "string" &&
      typeof parsed.date === "string" &&
      typeof parsed.signature === "string"
    ) {
      return parsed as ReportSignOff;
    }
    return null;
  } catch {
    return null;
  }
}

function writeSignOff(signOff: ReportSignOff): void {
  try {
    sessionStorage.setItem(SIGN_OFF_KEY, JSON.stringify(signOff));
  } catch {
    // sessionStorage full/unavailable — sign-off stays session-only in memory
  }
}

export default function ReportPage() {
  const router = useRouter();
  const snapshot = readReportSnapshot();
  const audit: ReportAudit | null = readReportAudit();
  const hasSnapshot = snapshot !== null;

  const [signOff, setSignOff] = useState<ReportSignOff | null>(() => readSignOff());
  const [pdfPending, setPdfPending] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [codeEditionSources, setCodeEditionSources] = useState<
    Array<{ title: string; url: string }> | null
  >(null);

  // PLAT-03: one post-acceptance lookup per report view. Deps are the two
  // stable identity strings (the snapshot object itself is re-read per render).
  const designCode = snapshot?.metadata.designCode ?? null;
  const evaluatedAt = snapshot?.evaluatedAt ?? null;
  useEffect(() => {
    if (!designCode || !evaluatedAt) return;
    let disposed = false;
    fetch(
      `/api/tavily?designCode=${encodeURIComponent(designCode)}&evaluatedAt=${encodeURIComponent(evaluatedAt)}`,
    )
      .then((res) => (res.ok ? (res.json() as Promise<unknown>) : null))
      .then((json) => {
        if (disposed || !json || typeof json !== "object") return;
        const results = (json as { results?: Array<{ title: string; url: string }> })
          .results;
        if (results && results.length > 0) setCodeEditionSources(results);
      })
      .catch(() => {
        // degrade silently — the lookup must never block the report
      });
    return () => {
      disposed = true;
    };
  }, [designCode, evaluatedAt]);

  useEffect(() => {
    if (!hasSnapshot) {
      router.replace("/");
    }
  }, [hasSnapshot, router]);

  const changeSignOff = (next: ReportSignOff) => {
    setSignOff(next);
    writeSignOff(next);
  };

  const downloadPdf = async () => {
    if (!snapshot || !signOff) return;
    setPdfPending(true);
    setPdfError(null);
    try {
      // the signed-off snapshot is what the PDF renders
      const signed = withSignOff(snapshot, signOff);
      const auditNow: ReportAudit | null = audit;
      const res = await fetch("/api/report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot: signed, audit: auditNow }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setPdfError(json.error ?? `PDF generation failed (${res.status}).`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `flawcheck-report-${snapshot.evaluatedAt.slice(0, 10)}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : String(e));
    } finally {
      setPdfPending(false);
    }
  };

  const printReport = () => {
    // re-write the snapshot WITH the sign-off so window.print()'s document is
    // the signed version (the print CSS hides chrome; the browser supplies the
    // dialog — no separate route needed, the same page IS the print variant)
    if (snapshot && signOff) writeReportSnapshot(withSignOff(snapshot, signOff));
    window.print();
  };

  if (!snapshot) return null; // absent snapshot → redirecting home

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 print:px-0 print:py-0 print:max-w-none">
      <ReportDocument
        snapshot={snapshot}
        signOff={signOff}
        onSignOffChange={changeSignOff}
        audit={audit}
        codeEditionSources={codeEditionSources}
        onDownloadPdf={downloadPdf}
        onPrint={printReport}
        pdfPending={pdfPending}
        pdfError={pdfError}
        variant="preview"
        onBack={() => router.push("/")}
      />
      {/* Print CSS: hide the dark chrome + action footer when printing (04-03
          print-variant contract delivered at the page level — the same
          document serves preview and print, no separate route needed). */}
      <style>{`
        @media print {
          body { background: #ffffff; }
          nav, .print\\:hidden { display: none !important; }
        }
      `}</style>
    </main>
  );
}
