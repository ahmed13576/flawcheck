# UNINSTALL.md — Package Install Ledger

Running record of every package-adding install performed on this repo, per phase, so the
entire dependency surface can be reversed exactly. Append one `## Phase N` section per phase
(never rewrite earlier entries).

---

## Phase 1 — Platform Spike

**Date:** 2026-09-27
**Approval:** single user-approved install gate (checkpoint 01-01 Task 1; the exact commands below were approved verbatim before execution)
**node_modules footprint at install time:** 559M (`du -sh node_modules`, Git Bash, 2026-09-27, 445 packages audited)

### Production dependencies (direct)

| Package | Version |
|---------|---------|
| next | 16.3.6 |
| react | 19.3.0 |
| react-dom | 19.3.0 |
| zod | 4.6.5 |
| openai | 7.23.0 |
| @react-pdf/renderer | 4.9.0 |

### Dev dependencies (direct)

| Package | Version |
|---------|---------|
| typescript | ^5.9.3 (resolved 5.9.3) |
| vitest | 5.0.2 |
| @types/node | ^24.19.0 (resolved 24.19.0) |
| @types/react | ^19.3.0 (resolved 19.3.0) |
| @types/react-dom | ^19.3.0 (resolved 19.3.0) |

### Scaffold-injected (same single approval, merged package.json ranges)

| Package | Version |
|---------|---------|
| tailwindcss | ^4 (resolved 4.3.3) |
| @tailwindcss/postcss | ^4 (resolved 4.3.3) |
| eslint | ^9 (resolved 9.39.5) |
| eslint-config-next | 16.3.6 |

(postcss itself arrives as a transitive dependency of `@tailwindcss/postcss` — not a direct entry)

### Exact removal commands

```bash
# 1. Uninstall direct packages (from repo root)
npm uninstall next react react-dom zod openai @react-pdf/renderer
npm uninstall -D typescript vitest @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss eslint eslint-config-next

# 2. Remove the install artifacts
rm -rf node_modules          # Git Bash; PowerShell: Remove-Item -Recurse -Force node_modules
rm package-lock.json         # PowerShell: Remove-Item -Force package-lock.json

# 3. Remove the scaffold/app files this phase created (optional — see git history of build/phase-1)
#    app/ public/ instrumentation.ts vitest.config.ts next.config.ts tsconfig.json
#    next-env.d.ts eslint.config.mjs postcss.config.mjs next.config.ts AGENTS.nextjs.md
#    lib/llm/ tests/ scripts/ docs/ .env.example
#    (lib/criteria/ is builder-vetted ground truth — do NOT delete)

# 4. Delete this phase's section from UNINSTALL.md
```
