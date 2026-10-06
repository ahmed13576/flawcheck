/**
 * 04-01 Task 2 — audit module tests: computeInputHash determinism and input
 * sensitivity, buildAuditSteps null-passthrough (never fabricated — UI-54),
 * and the writeReportAudit/readReportAudit sessionStorage round-trip with
 * defensive parse. Node environment: sessionStorage is stubbed per test.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  REPORT_AUDIT_KEY,
  buildAuditSteps,
  computeInputHash,
  readReportAudit,
  writeReportAudit,
  type AuditTelemetry,
  type ReportAudit,
} from "@/lib/report/audit";
import type { ParsedRow, TargetField, Unit } from "@/lib/ingest/session";

const MAPPING: Record<TargetField, string | null> = {
  readingId: "A",
  measuredThickness: "B",
  measurementDate: "C",
  tInitial: null,
  tPrevious: null,
  tank: null,
};

const UNITS: { csvThickness: Unit; metadata: Unit } = { csvThickness: "mm", metadata: "mm" };

function rowAt(n: number): ParsedRow {
  return {
    row: n,
    cells: { A: `CML-${n}`, B: `${10 + n}`, C: "2025-01-15" },
    issues: [],
  };
}

const FULL_TELEMETRY: AuditTelemetry = {
  model: "zai-glm-4.7",
  promptTokens: 1200,
  completionTokens: 340,
  latencyMs: 820,
};

/* In-memory sessionStorage stub (node has none), re-installed before each test. */
const backing = new Map<string, string>();
beforeEach(() => {
  backing.clear();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = {
    getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
    setItem: (k: string, v: string) => {
      backing.set(k, v);
    },
    removeItem: (k: string) => {
      backing.delete(k);
    },
    clear: () => {
      backing.clear();
    },
    key: (i: number) => Array.from(backing.keys())[i] ?? null,
    get length() {
      return backing.size;
    },
  };
});
afterEach(() => {
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
});

describe("computeInputHash (SHA-256 over rows + mapping + units)", () => {
  it("is deterministic — identical inputs yield the same 64-char lowercase hex digest", async () => {
    const rows = [rowAt(1), rowAt(2)];
    const a = await computeInputHash(rows, MAPPING, UNITS);
    const b = await computeInputHash([rowAt(1), rowAt(2)], MAPPING, UNITS);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when any row changes", async () => {
    const base = await computeInputHash([rowAt(1)], MAPPING, UNITS);
    const changed = await computeInputHash([rowAt(1), rowAt(2)], MAPPING, UNITS);
    expect(changed).not.toBe(base);
  });

  it("changes when the mapping changes", async () => {
    const base = await computeInputHash([rowAt(1)], MAPPING, UNITS);
    const changed = await computeInputHash([rowAt(1)], { ...MAPPING, tank: "T" }, UNITS);
    expect(changed).not.toBe(base);
  });

  it("changes when a unit changes", async () => {
    const base = await computeInputHash([rowAt(1)], MAPPING, UNITS);
    const changed = await computeInputHash([rowAt(1)], MAPPING, {
      csvThickness: "in",
      metadata: "mm",
    });
    expect(changed).not.toBe(base);
  });
});

describe("buildAuditSteps (null-pass-through, never fabricated — UI-54)", () => {
  it("with both telemetry objects null, both steps carry all-null fields", () => {
    const [extraction, narrative] = buildAuditSteps(null, null);
    expect(extraction.step).toBe("extraction");
    expect(extraction.model).toBeNull();
    expect(extraction.promptTokens).toBeNull();
    expect(extraction.completionTokens).toBeNull();
    expect(extraction.latencyMs).toBeNull();
    expect(narrative.step).toBe("narrative");
    expect(narrative.model).toBeNull();
    expect(narrative.promptTokens).toBeNull();
    expect(narrative.completionTokens).toBeNull();
    expect(narrative.latencyMs).toBeNull();
  });

  it("maps real usage numbers through verbatim and keeps the fixed order (extraction first)", () => {
    const [extraction, narrative] = buildAuditSteps(FULL_TELEMETRY, null);
    expect(extraction).toEqual({ step: "extraction", ...FULL_TELEMETRY });
    expect(narrative.step).toBe("narrative");
    expect(narrative.model).toBeNull();
  });

  it("never substitutes zeros or invented model names for absent fields", () => {
    const partial: AuditTelemetry = { model: null, promptTokens: 10, completionTokens: null, latencyMs: 5 };
    const [step] = buildAuditSteps(partial, null);
    expect(step.model).toBeNull();
    expect(step.completionTokens).toBeNull();
    expect(step.promptTokens).toBe(10);
    expect(step.latencyMs).toBe(5);
  });
});

describe("writeReportAudit / readReportAudit (sessionStorage round-trip)", () => {
  const AUDIT: ReportAudit = {
    evaluatedAt: "2026-09-27T14:32:00Z",
    inputHash: "a".repeat(64),
    steps: [
      { step: "extraction", ...FULL_TELEMETRY },
      { step: "narrative", model: null, promptTokens: null, completionTokens: null, latencyMs: null },
    ],
  };

  it("round-trips through the stubbed sessionStorage under the flawcheck:report-audit:v1 key", () => {
    writeReportAudit(AUDIT);
    expect(backing.has(REPORT_AUDIT_KEY)).toBe(true);
    const read = readReportAudit();
    expect(read).toEqual(AUDIT);
  });

  it("returns null when the key is absent", () => {
    expect(readReportAudit()).toBeNull();
  });

  it("returns null (never throws) for corrupt stored payloads", () => {
    for (const corrupt of ["{not json", "null", "42", "{}", '{"evaluatedAt":"x"}', '{"evaluatedAt":"x","inputHash":"h","steps":[{"step":"ingestion"}]}']) {
      backing.set(REPORT_AUDIT_KEY, corrupt);
      expect(readReportAudit()).toBeNull();
    }
  });

  it("a steps array out of order (narrative first) is corrupt → null", () => {
    backing.set(
      REPORT_AUDIT_KEY,
      JSON.stringify({
        evaluatedAt: "2026-09-27T14:32:00Z",
        inputHash: "a".repeat(64),
        steps: [
          { step: "narrative", model: null, promptTokens: null, completionTokens: null, latencyMs: null },
          { step: "extraction", model: null, promptTokens: null, completionTokens: null, latencyMs: null },
        ],
      }),
    );
    expect(readReportAudit()).toBeNull();
  });
});
