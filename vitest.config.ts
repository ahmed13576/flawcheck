import { defineConfig } from "vitest/config";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// Load .env.local into process.env for tests (Node-only, zero deps).
// Ambient environment variables always win — we never overwrite an existing var.
const envPath = path.resolve(__dirname, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"] },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
