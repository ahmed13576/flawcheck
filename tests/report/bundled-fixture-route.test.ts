import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { POST as pdfPost } from "@/app/api/report/pdf/route";
import { POST as csvPost } from "@/app/api/report/csv/route";
import { createDemoSession } from "@/lib/demo/demo-scenario";
import { groupByCml } from "@/lib/ingest/group";
import { evaluate } from "@/lib/calc/evaluate";
import { buildReportSnapshot, withSignOff } from "@/lib/report/session-snapshot";
import { buildAuditSteps } from "@/lib/report/audit";

function productionSnapshot() {
  const session = createDemoSession("subset");
  const inputs = groupByCml(session.rows, session.mapping, { csvThicknessUnit: session.units.csvThickness });
  const results = evaluate(inputs, session.metadata, session.units, { ptmtIndications: session.ptmt.indications });
  const snapshot = buildReportSnapshot({ ...session, results }, "2026-10-25T00:00:00.000Z")!;
  return withSignOff(snapshot, { name: "QA", certification: "ASNT NDT Level II", date: "2026-10-25", signature: "QA" });
}

describe("bundled fixture through production report routes", () => {
  it("runs createDemoSession -> groupByCml -> evaluate -> /api/report/pdf and returns %PDF", async () => {
    const snapshot = productionSnapshot();
    const audit = { evaluatedAt: snapshot.evaluatedAt, inputHash: "f".repeat(64), steps: buildAuditSteps(null, null) };
    const res = await pdfPost(new Request("http://localhost/api/report/pdf", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ snapshot, audit }) }));
    const body = Buffer.from(await res.arrayBuffer());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
    expect(body.subarray(0, 4).toString()).toBe("%PDF");
  }, 60000);

  it("CSV route emits canonical LF bytes and matching server SHA-256", async () => {
    const snapshot = productionSnapshot();
    const res = await csvPost(new Request("http://localhost/api/report/csv", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ snapshot, audit: { inputHash: "not-trusted" } }) }));
    const body = Buffer.from(await res.arrayBuffer());
    const seal = createHash("sha256").update(body).digest("hex");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-flawcheck-csv-sha256")).toBe(seal);
    expect(body.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false);
    expect(body.includes(Buffer.from("\r\n"))).toBe(false);
    expect(body.at(-1)).toBe(10);
    expect(body.at(-2)).not.toBe(10);
  });
});
