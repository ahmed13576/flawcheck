/**
 * WBT-S6 demo-subset generator (06-02 Task 2, UI-6.24) — ONE-OFF script,
 * Node built-ins only (fs/path): zero new packages (T-06-02-SC).
 *
 * Provenance: derived from Zenodo record 16780668 (CC BY 4.0 — see
 * lib/demo/ATTRIBUTION.md; attribution unchanged), filtered to the primary
 * tank section WBT-S6 (420 readings, 40 grid points, mid-range of the
 * 382-438 tank spread).
 *
 * FILTER RULE (locked — research P3): filter by Tank identity ONLY, NEVER by
 * Measurement_Date or campaign index. groupByCml derives campaign history
 * from the date-sorted group, so a date window would amputate history and
 * manufacture insufficient_history rows. Original row order and the exact
 * six-column schema are preserved (alias auto-guess compatibility).
 *
 * Regenerate:
 *   node scripts/generate-demo-subset.mjs
 *
 * Outputs (both committed):
 *   - lib/demo/fixtures/zenodo-16780668-ut-register-subset.json
 *   - public/sample-ut-register-subset.csv
 *
 * Hard-fails (nonzero exit) if: retained rows fall outside 200-500, more
 * than one distinct Tank remains, or any retained CML (Tank + Grid_Position)
 * has fewer than 2 distinct campaigns.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "lib/demo/fixtures/zenodo-16780668-ut-register.json");
const JSON_OUT = join(ROOT, "lib/demo/fixtures/zenodo-16780668-ut-register-subset.json");
const CSV_OUT = join(ROOT, "public/sample-ut-register-subset.csv");

const TANK = "WBT-S6";
const HEADERS = [
  "Reading_ID",
  "Tank",
  "Grid_Position",
  "Original_Scantling_mm",
  "Measured_Thickness_mm",
  "Measurement_Date",
];

const rows = JSON.parse(readFileSync(SOURCE, "utf8"));
const subset = rows.filter((row) => row.Tank === TANK);

// --- hard gates ----------------------------------------------------------------
function fail(message) {
  console.error(`generate-demo-subset: ${message}`);
  process.exit(1);
}

if (subset.length < 200 || subset.length > 500) {
  fail(`retained row count ${subset.length} outside the 200-500 target`);
}

const tanks = new Set(subset.map((row) => row.Tank));
if (tanks.size !== 1) {
  fail(`expected exactly one Tank, found: ${[...tanks].join(", ")}`);
}

const campaignsByCml = new Map();
for (const row of subset) {
  const key = `${row.Tank}|${row.Grid_Position}`;
  if (!campaignsByCml.has(key)) campaignsByCml.set(key, new Set());
  campaignsByCml.get(key).add(row.Measurement_Date);
}
for (const [cml, dates] of campaignsByCml) {
  if (dates.size < 2) {
    fail(`CML ${cml} has only ${dates.size} campaign(s) — history would be amputated`);
  }
}

// --- outputs ---------------------------------------------------------------------
// Same shape as the full fixture import: a JSON array of row objects.
writeFileSync(JSON_OUT, JSON.stringify(subset, null, "\t") + "\n");

const csvLines = [HEADERS.join(",")];
for (const row of subset) {
  csvLines.push(HEADERS.map((header) => row[header] ?? "").join(","));
}
writeFileSync(CSV_OUT, csvLines.join("\n") + "\n");

console.log(
  `generate-demo-subset: wrote ${subset.length} rows ` +
    `(${campaignsByCml.size} CMLs, min ${Math.min(...[...campaignsByCml.values()].map((d) => d.size))} campaigns) ` +
    `to ${JSON_OUT} and ${CSV_OUT}`,
);
