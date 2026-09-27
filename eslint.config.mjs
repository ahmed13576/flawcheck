import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // R8 forbidden-import gate: lib/calc is the deterministic ground truth.
  // The calc engine must never import the LLM layer, and must stay free of
  // react/next/node builtins so the vitest node env and the browser both run
  // it unchanged. Belt-and-braces guard: tests/ingest/boundary-imports.test.ts.
  {
    files: ["lib/calc/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/llm", "**/lib/llm/*", "**/llm/*"],
              message:
                "The calc engine is deterministic ground truth — LLM imports forbidden (handoff.md invariant 2).",
            },
            {
              group: ["react", "react-dom", "next", "next/*", "node:*"],
              message:
                "lib/calc must stay pure: no react/next/node builtins — vitest node env and browser must both run it.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
