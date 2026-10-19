import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Config for the LIVE measured System-1 benchmark (scripts/system1-benchmark/).
 * Mirrors the main config's alias + .env.local loading but includes ONLY the
 * benchmark runner — `npm test` (committed vitest.config.ts, tests/** only)
 * never runs live network calls. Ambient env vars win — never overwritten.
 */
const root = path.resolve(import.meta.dirname, "..", "..");
const envPath = path.join(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

export default {
  test: {
    environment: "node",
    include: ["scripts/system1-benchmark/run-system1-benchmark.test.ts"],
    // The hermetic wiring smoke test (benchmark-wiring-smoke.test.ts) is NOT
    // included here — it runs offline via the scratch/ config and must never
    // be mistaken for a live run.
    exclude: ["scripts/system1-benchmark/benchmark-wiring-smoke.test.ts"],
  },
  resolve: { alias: { "@": root } },
};
