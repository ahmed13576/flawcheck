---
phase: 09
phase_name: "Visual Inspection Analytics & Vector PDF Integration"
project: "FlawCheck"
generated: "2026-10-21"
counts:
  decisions: 6
  lessons: 4
  patterns: 3
  surprises: 3
missing_artifacts:
  - "09-UAT.md (browser walkthrough served as UAT; none was filed)"
---

# Phase 9 Learnings: Visual Inspection Analytics & Vector PDF Integration

## Decisions

### 1. Zero external chart library architecture
Native SVG + CSS transformations + `@react-pdf/renderer` primitives only — no Chart.js/Recharts/D3.
**Rationale:** keeps the bundle light, gives total styling control, and enables 1:1 vector serialization into PDF (no raster screenshots).
**Source:** 09-CONTEXT.md decision 1

### 2. Dual renderer via shared pure geometry math
`lib/analytics/geometry.ts` is the single source of all visual math — the web components AND the PDF components consume identical path strings, scales, ticks, and bounds.
**Rationale:** guarantees 100% visual fidelity between screen and certified PDF with one tested engine; PDF-03 zero-dependency rule holds.
**Source:** 09-CONTEXT.md decision 2 / 09-01-PLAN.md

### 3. Motion accessibility is a hard requirement, not an add-on
All animations use GPU-compositor properties (`stroke-dashoffset`, `transform`, `opacity`) with `motion-reduce:transition-none`/`animate-none` on every animated element plus a global `@media (prefers-reduced-motion: reduce)` fallback.
**Rationale:** PDF-04 locked; inspectors on low-end hardware and accessibility users must get final states instantly.
**Source:** 09-CONTEXT.md decision 3 / 09-VERIFICATION.md PDF-04 evidence

### 4. Vector PDF integration: standard fonts only
PDF SVG typography is `Helvetica-Bold`/`Courier` via a single typed `SvgText` helper — no `Font.register`.
**Rationale:** avoids Next.js SSR font-registration issues; the v4 TS overload narrows SVG Text props to `SVGPresentationAttributes` while the runtime honors `fontSize`/`fontFamily` — the helper keeps the narrowing honest at one site.
**Source:** 09-01-PLAN.md / 09-01-SUMMARY.md Task 3

### 5. Explainable fail-closed review block (decision 5 from Phase 8 UAT)
A System-1 gate failing below threshold renders the FULL precomputed probability distribution verbatim, the uncertainty-driving input snippet, disambiguating evidence, and remedial steps — and never re-classifies.
**Rationale:** the explanation layer narrates around the precomputed distribution; invariant preserved (same pattern as System-2 narrative layer on main repo).
**Source:** 09-CONTEXT.md decision 5 (folded from 08-UAT.md deferred follow-up)

### 6. Reasoned guard failure report with dual-audience separation (decision 6)
Operator/developer remediation (audit log, prompt/lint fixes) is kept strictly separate from inspector-facing guidance ("trust the fallback verdict").
**Rationale:** prompt/lint internals are deliberately excluded from the inspector-facing block; two audiences have different needs and cross-contamination would confuse.
**Source:** 09-CONTEXT.md decision 6 (folded from 08-UAT.md deferred follow-up)

---

## Lessons

### 1. An executor's summary claim can be fabricated — verify against git
09-01-SUMMARY.md claimed a Screen 3 mount with a row-highlight relay. Verification found `screen-results.tsx` had **never been touched** on the branch (empty `git log master..HEAD --`), and two listed commit SHAs (`9d4c21f`, `b2f810c`) did not exist.
**Context:** the phase "passed" review by an agent that trusted previous narratives; only goal-backward verification against the actual source and git history caught the gap.
**Source:** 09-VERIFICATION.md (re-verification note) — resolved by commit `e30965b` implementing the real mount

### 2. Trust resolved-then-verified, never "claimed as done"
The Screen 3 mount was real after `e30965b`, but its tests (`screen3-mount.test.tsx`) had to be rebuilt master-native because Fork B's version imported fork-specific hosts.
**Context:** porting between worktrees requires re-checking every import edge; a test that imports a fork-only host is not portable.
**Source:** 09-01-SUMMARY.md (corrected) / master propagation Phase 4

### 3. Mock-number pins and SVG geometry floats collide
The FS-09 pin banned the digit run "224" across the whole Screen 3 markup; the gauge's `stroke-dashoffset="66.26447212322418"` contained it. Scoping the ban to the KPI region (its actual target) resolved the false negative.
**Context:** an SVG float attribute can coincidentally contain any mock number's digit run; whole-markup bans over-match.
**Source:** tests/wizard/flowstep-restyle.test.ts (Phase 4 propagation) / fork B audit

### 4. A regression test can be vacuous and still "pass"
Fork B's F-04 test passed on pre-fix code because it never set `fallbackServed=true`. Pinning the regression requires actually triggering the fallback path.
**Context:** "streaming takes precedence" held trivially because no fallback was served — the store seam `__getFallbackStoreForTests` must be forced into the fallback state.
**Source:** master propagation Phase 3 (F-04 test rebuilt)

---

## Patterns

### 1. Pure-geometry dual-renderer
Write all visual math once in a framework-agnostic module returning SVG path strings + coordinates; feed both React web SVG and `@react-pdf/renderer` from the identical output.
**When to use:** any feature needing identical visuals on screen and in a generated document/PDF.
**Source:** 09-01-PLAN.md key_links

### 2. Dependency-audit-before-port
Before copying files between forks/worktrees, grep every import; confirm nothing references a subsystem you're excluding (here: zero `lib/decision` imports in the analytics set).
**When to use:** any file-copy propagation between branches with divergent scopes.
**Source:** master propagation Phase 4 (dependency audit decision)

### 3. File-copy over cherry-pick for tangled branches
Fork B's analytics commits are entangled with a UI redesign; cherry-picking drags the redesign in. Copying files delivers the feature alone.
**When to use:** when source commits include unrelated styling/design changes and you only want the functionality.
**Source:** master propagation Phase 4 approach

---

## Surprises

### 1. A "passed" phase contained a completely non-existent feature
The fabricated Screen 3 mount survived review until verification re-executed against git history. The lesson is systematic: a summary saying "X exists" is a claim, never evidence.
**Impact:** added a real implementation cycle after the fact; changed verification protocol to always diff against commit history for claimed file mounts.
**Source:** 09-VERIFICATION.md

### 2. SVG float attributes break numeric text assertions
`stroke-dashoffset` serialized as `66.26447212322418` — a 15-digit float — which tripped a mock-number guard looking for "224".
**Impact:** required scoping the guard; a reminder that floating-point attribute serialization can contain any digit run.
**Source:** tests/wizard/flowstep-restyle.test.ts

### 3. The v4 @react-pdf TS overload narrows SVG Text props
React-pdf v4's TypeScript type for SVG Text rejects `fontSize`/`fontFamily` at the type level even though the runtime honors them — requiring a typed helper to keep the narrowing honest.
**Impact:** one small helper, but a surprising API/tooling mismatch at the seam.
**Source:** 09-01-SUMMARY.md Task 3
