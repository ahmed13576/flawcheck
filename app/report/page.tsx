"use client";

/**
 * /report — the locked Screen 4 report preview route (03-00b Task 2, binding
 * C4/locked decision): reads the session-only report snapshot on mount and
 * redirects to / when absent (direct URL with no evaluation). The document
 * itself is ReportDocument — a pure presentational component rendering the
 * current session's REAL data. Generation (Download PDF / Print) is gated to
 * Phase 4; zero PDF generation, zero print CSS in Phase 3.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  readReportSnapshot,
  type ReportSnapshot,
} from "@/lib/report/session-snapshot";
import { ReportDocument } from "@/components/report/report-document";

export default function ReportPage() {
  const router = useRouter();
  // Read-once derivation: sessionStorage is an external system read during
  // render (client-only page), so no state mirror is needed and the redirect
  // fires from a plain effect without cascading setState (react-hooks v7).
  const snapshot = readReportSnapshot();
  const hasSnapshot = snapshot !== null;

  useEffect(() => {
    if (!hasSnapshot) {
      router.replace("/");
    }
  }, [hasSnapshot, router]);

  if (!snapshot) return null; // absent snapshot → redirecting home

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <ReportDocument snapshot={snapshot} onBack={() => router.push("/")} />
    </main>
  );
}
