import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Belt-and-braces purity guard (research R8): walks every TypeScript file
 * under lib/calc with node:fs (allowed in tests) and asserts
 *   1. no import/export (static, side-effect, or dynamic) resolves into the
 *      LLM layer — matched on the module specifier so both alias forms
 *      ("@/lib/llm/...", "lib/llm/...") and relative escapes ("../llm/...")
 *      are caught, and
 *   2. zero occurrences of "Date.now(" or "Math.random(" anywhere in the
 *      source (no time-of-day or randomness may enter the engine).
 *
 * The eslint no-restricted-imports block in eslint.config.mjs is the primary
 * import gate; this is the mechanical duplicate that runs in `npm test` even
 * when lint is skipped.
 */
const FORBIDDEN_SOURCE_STRINGS = ["Date.now(", "Math.random("] as const;

function walkCalcFiles(dir: string): string[] {
  const entries: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      entries.push(...walkCalcFiles(full));
    } else if (name.endsWith(".ts")) {
      entries.push(full);
    }
  }
  return entries;
}

/** Module specifiers of every import/export/dynamic import in the source. */
function moduleSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*["']([^"']+)["']/g, // static + re-export
    /(?:^|\n)\s*import\s*["']([^"']+)["']/g, // side-effect import
    /import\(\s*["']([^"']+)["']\s*\)/g, // dynamic import
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function isLlmSpecifier(specifier: string): boolean {
  // Catches "@/lib/llm/client", "lib/llm", "../llm/config", "../../llm/x".
  return specifier.includes("lib/llm") || specifier.split("/").includes("llm");
}

describe("boundary imports — lib/calc purity is mechanically guarded", () => {
  const calcDir = join(__dirname, "..", "..", "lib", "calc");
  const files = walkCalcFiles(calcDir);

  it("finds the calc modules to guard (walk is not vacuous)", () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it("no lib/calc module imports the LLM layer (alias or relative)", () => {
    const violations: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const specifier of moduleSpecifiers(source)) {
        if (isLlmSpecifier(specifier)) {
          violations.push(`${file} imports "${specifier}"`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("no lib/calc TypeScript file contains Date.now( or Math.random(", () => {
    const violations: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const forbidden of FORBIDDEN_SOURCE_STRINGS) {
        if (source.includes(forbidden)) {
          violations.push(`${file} contains "${forbidden}"`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
