import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, posix, relative } from "node:path";

/**
 * Import boundary guard for lib/calc (Phase 8) — the TS equivalent of the
 * reference repo's test_no_network.py: the deterministic engine must never
 * reach the LLM layer, a UI framework, the network stack or the filesystem.
 *
 * Forbidden specifiers, in ANY form (alias "@/lib/llm/...", relative
 * "../llm/...", bare package, or node: builtin):
 *   lib/llm, react, next, node:fs, node:http, openai
 *
 * Specifiers are extracted with plain regexes over the source text (no AST
 * dependency), and relative specifiers are RESOLVED against the importing
 * file so "../llm/client" is recognized as lib/llm. The walk asserts a
 * non-empty file list so the test cannot pass vacuously. The eslint
 * no-restricted-imports block in eslint.config.mjs is the primary gate;
 * this is the mechanical duplicate that runs in `npm test` even when lint
 * is skipped (same belt-and-braces pattern as tests/ingest/boundary-imports.test.ts).
 */

const REPO_ROOT = join(__dirname, "..", "..");
const CALC_DIR = join(REPO_ROOT, "lib", "calc");

const TS_FILES = readdirSync(CALC_DIR, { recursive: true })
  .map((entry) => join(CALC_DIR, String(entry)))
  .filter((file) => file.endsWith(".ts"));

/** Module specifiers of every static/require/dynamic/side-effect import. */
function moduleSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /\bfrom\s*["']([^"']+)["']/g, // static import + re-export from
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g, // require
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g, // dynamic import
    /(?:^|\n)\s*import\s*["']([^"']+)["']/g, // side-effect import
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function toPosix(p: string): string {
  return p.replaceAll("\\", "/");
}

/**
 * Resolve a specifier to a repo-root-relative POSIX path when possible, so
 * "../llm/config" and "@/lib/llm/client" are both recognized as lib/llm.
 * Bare package names and node: builtins pass through unchanged.
 */
function resolveSpecifier(specifier: string, importerRelPosix: string): string {
  if (specifier.startsWith("@/")) return specifier.slice(2); // "@/" = repo root
  if (specifier.startsWith(".")) {
    return posix.normalize(posix.join(posix.dirname(importerRelPosix), specifier));
  }
  return specifier;
}

/** Returns the forbidden label the specifier violates, or null if clean. */
function forbiddenLabel(specifier: string, resolved: string): string | null {
  if (/(^|\/)lib\/llm(\/|$)/.test(specifier) || /^lib\/llm(\/|$)/.test(resolved)) {
    return "lib/llm";
  }
  if (specifier === "react" || specifier.startsWith("react/")) return "react";
  if (specifier === "next" || specifier.startsWith("next/")) return "next";
  if (specifier === "node:fs" || specifier.startsWith("node:fs/")) return "node:fs";
  if (specifier === "node:http" || specifier.startsWith("node:http")) return "node:http";
  if (specifier === "openai" || specifier.startsWith("openai/")) return "openai";
  return null;
}

describe("import boundary — lib/calc stays pure (no llm, react, next, node builtins, openai)", () => {
  it("finds the calc modules to guard (walk is not vacuous)", () => {
    expect(TS_FILES.length).toBeGreaterThanOrEqual(10);
  });

  it("no lib/calc module imports lib/llm, react, next, node:fs, node:http or openai", () => {
    const violations: string[] = [];
    for (const file of TS_FILES) {
      const source = readFileSync(file, "utf8");
      const importerRel = toPosix(relative(REPO_ROOT, file));
      for (const specifier of moduleSpecifiers(source)) {
        const label = forbiddenLabel(specifier, resolveSpecifier(specifier, importerRel));
        if (label) {
          violations.push(`${file} imports "${specifier}" (forbidden: ${label})`);
        }
      }
    }
    expect(
      violations,
      "forbidden imports inside lib/calc:\n  " + violations.join("\n  "),
    ).toEqual([]);
  });
});
