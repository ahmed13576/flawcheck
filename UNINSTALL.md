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

---

## Phase 2 — Ingestion & Calc Engine

**Date:** 2026-09-27
**Status:** no new packages — the ingestion and calc engines were built entirely on
Phase 1's pinned dependency set (researcher-confirmed zero-dependency feasibility; no
checkpoint required). Zero install tasks ran in any Phase 2 plan; `node_modules` is
unchanged by Phase 2. CSV transform tooling for the demo fixture used the system Python
3 stdlib (csv/json/zipfile) outside the repo dependency surface, and the fixture zip
stayed in gitignored `scratch/`.

---

## Phase 3 — Flowstep GUI Integration

**Date:** 2026-09-27
**Approval:** user-directed Flowstep design adoption ("incorporate all the 4 screens
according to this new design without breaking functionality" — 03-CONTEXT Flowstep
addendum, 2026-09-27) + blocking human-verify checkpoint (03-00 Task 1, gate
`blocking-human`, ratified by orchestrator 2026-09-27 after two install-approval
prompts with no objection recorded). This is the phase's ONLY install task; any
package beyond these five requires a NEW user checkpoint. Versions pinned verbatim
from `flowstep-gui/Screen-1/package.json`.
**node_modules footprint at install time:** 39K (class-variance-authority) +
23K (clsx) + 43M (lucide-react, icon set) + 1.1M (tailwind-merge) + 56K
(tw-animate-css) ≈ 44.2M added.

### Registry verification findings (npm view, 2026-09-27, read-only)

| Package @ range | Resolves to | Maintainer | Repo / Homepage | License | Finding |
|---|---|---|---|---|---|
| class-variance-authority@^0.7.1 | 0.7.1 | joebell93 (Joe Bell — cva's actual author) | github.com/joe-bell/cva | Apache-2.0 | Legitimate, canonical repo |
| clsx@^2.1.1 | 2.1.1 | lukeed (Luke Edwards) | github.com/lukeed/clsx | MIT | Legitimate, canonical repo |
| lucide-react@^0.562.0 | 0.562.0 | ericfennis (Lucide creator) | lucide.dev | ISC | Legitimate, canonical repo |
| tailwind-merge@^3.4.0 | 3.7.0 | dcas (dcastil) | github.com/dcastil/tailwind-merge | MIT | Legitimate, canonical repo |
| tw-animate-css@^1.4.0 | 1.4.0 | wombosvideo | github.com/Wombosvideo/tw-animate-css | MIT | Legitimate, canonical repo |

No typosquat flags — every package name matches its canonical repository and the
well-known maintainer expected for it. `npm ls` reports 0 vulnerabilities.
Note: `tailwind-merge` resolved to 3.7.0 within the ^3.4.0 range.

### Production dependencies (direct)

| Package | Version |
|---------|---------|
| class-variance-authority | ^0.7.1 (resolved 0.7.1) |
| clsx | ^2.1.1 (resolved 2.1.1) |
| lucide-react | ^0.562.0 (resolved 0.562.0) |
| tailwind-merge | ^3.4.0 (resolved 3.7.0) |
| tw-animate-css | ^1.4.0 (resolved 1.4.0) |

### Exact removal commands

```bash
# 1. Uninstall the five Flowstep design packages (from repo root)
npm uninstall class-variance-authority clsx lucide-react tailwind-merge tw-animate-css

# 2. (Optional) remove the design-system files Phase 3 added — see git history of build/phase-3
#    lib/utils.ts  components/ui/  (primitives)
#    Flowstep token blocks in app/globals.css and the restyled wizard components

# 3. Delete this phase's section from UNINSTALL.md
```
