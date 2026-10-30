import { describe, expect, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { POST as pdfPost } from "@/app/api/report/pdf/route";
import { POST as csvPost } from "@/app/api/report/csv/route";
import { createDemoSession } from "@/lib/demo/demo-scenario";
import { groupByCml } from "@/lib/ingest/group";
import { evaluate } from "@/lib/calc/evaluate";
import { buildReportSnapshot, withSignOff } from "@/lib/report/session-snapshot";
import { buildAuditSteps } from "@/lib/report/audit";

function snapshot() {
  const session = createDemoSession("subset");
  const inputs = groupByCml(session.rows, session.mapping, { csvThicknessUnit: session.units.csvThickness });
  const results = evaluate(inputs, session.metadata, session.units, { ptmtIndications: session.ptmt.indications });
  const snap = buildReportSnapshot({ ...session, results }, "2026-10-25T00:00:00.000Z")!;
  return withSignOff(snap, { name: "NDT Review", certification: "ASNT NDT Level II (examination only)", date: "2026-10-25", signature: "NDT Review" });
}

function pdfInfo(bytes: Buffer): { producer: string; creator: string } {
  const latin = bytes.toString("latin1");
  const deref = (objectNumber: string) => {
    const m = latin.match(new RegExp(`${objectNumber}\\s+0\\s+obj\\s*\\(([^)]*)\\)`));
    return m ? m[1] : "unknown";
  };
  const field = (name: string) => {
    const direct = latin.match(new RegExp(`/${name}\\s*\\(([^)]*)\\)`));
    if (direct) return direct[1];
    const ref = latin.match(new RegExp(`/${name}\\s+(\\d+)\\s+0\\s+R`));
    return ref ? deref(ref[1]) : "unknown";
  };
  return { producer: field("Producer"), creator: field("Creator") };
}

describe("generate WBT-S6 report through shipped app routes", () => {
  it("writes exact PDF and CSV route bytes plus provenance", async () => {
    // Repo-relative by default: this test runs inside `npm test`, so it must
    // never write outside the working tree. `scratch/` is gitignored (twice,
    // .gitignore lines 49 and 65), so generated reports stay out of git and out
    // of the deploy. Override with FLAWCHECK_OUTPUT_DIR when needed.
    const outDir = process.env.FLAWCHECK_OUTPUT_DIR ?? join(process.cwd(), "scratch", "report-output");
    mkdirSync(outDir, { recursive: true });
    const snap = snapshot();
    const audit = { evaluatedAt: snap.evaluatedAt, inputHash: "0".repeat(64), steps: buildAuditSteps(null, null) };
    const pdfRes = await pdfPost(new Request("http://localhost/api/report/pdf", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ snapshot: snap, audit }) }));
    const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
    expect(pdfRes.status).toBe(200);
    expect(pdfBytes.subarray(0, 4).toString()).toBe("%PDF");
    const csvRes = await csvPost(new Request("http://localhost/api/report/csv", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ snapshot: snap }) }));
    const csvBytes = Buffer.from(await csvRes.arrayBuffer());
    expect(csvRes.status).toBe(200);
    const csvSha = createHash("sha256").update(csvBytes).digest("hex");
    expect(csvRes.headers.get("x-flawcheck-csv-sha256")).toBe(csvSha);
    const pdfSha = createHash("sha256").update(pdfBytes).digest("hex");
    const info = pdfInfo(pdfBytes);
    writeFileSync(join(outDir, "flawcheck-wbt-s6-examination-report.pdf"), pdfBytes);
    writeFileSync(join(outDir, "wbt-s6-canonical-cml-register.csv"), csvBytes);
    writeFileSync(join(outDir, "wbt-s6-canonical-cml-register.sha256.txt"), `${csvSha}  wbt-s6-canonical-cml-register.csv\n`);
    const provenance = [
      "FlawCheck WBT-S6 app-route provenance",
      "Command: npm run generate:wbt-s6-report",
      `PDF bytes: ${pdfBytes.length}`,
      `PDF SHA-256: ${pdfSha}`,
      `PDF Producer: ${info.producer}`,
      `PDF Creator: ${info.creator}`,
      `CSV bytes: ${csvBytes.length}`,
      `CSV SHA-256: ${csvSha}`,
    ].join("\n") + "\n";
    writeFileSync(join(outDir, "app-route-provenance.txt"), provenance);
    console.log(provenance);
  }, 60000);
});
