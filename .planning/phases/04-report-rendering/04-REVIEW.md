---
phase: 04-report-rendering
reviewed: 2026-10-06T12:05:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - app/api/report/pdf/route.ts
  - components/report/pdf-document.tsx
  - components/report/report-document.tsx
  - components/wizard/screen-results.tsx
  - components/wizard/verdict-chip.tsx
  - app/report/page.tsx
  - lib/report/snapshot-schema.ts
  - lib/report/audit.ts
  - lib/report/content.ts
  - lib/report/session-snapshot.ts
  - lib/ingest/session.ts
  - lib/wizard/format.ts
  - lib/calc/criteria.ts
  - tests/report/pdf-route.test.ts
  - tests/report/report-audit.test.ts
  - tests/report/report-contract.test.ts
  - tests/report/report-integration.test.ts
  - tests/report/report-preview.test.ts
  - tests/report/snapshot-schema.test.ts
  - tests/wizard/screen3-cta.test.tsx
  - tests/pdf/react-pdf-smoke.test.ts
findings:
  critical: 2
  warning: 8
  info: 3
  total: 13
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-10-06T12:05:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Phase 4's server-side boundary is genuinely solid: `ReportPdfRequestSchema` mirrors `lib/ingest/session.ts` field-for-field (including `tStructural`, `gaugeUncertainty`, `allowableStress`, `w`, `formula`, nullable CR/RL branches and the em-dash designCode literal), rejects unknown keys (`.strict()`), NaN/Infinity, and wrong verdict/flag/method enums before any render; the route pins Node runtime, built-in Helvetica/Courier fonts (no `Font.register`), pure Text nodes, a 400-only error surface for bad input, and a sanitized `sourceName` in Content-Disposition. The 494/5 hermetic suite reproduces, typecheck is clean, and print-variant isolation holds (zero `lib/llm` imports in the report surface).

However, **the phase's user-facing deliverable is inoperative in the real app**. `app/report/page.tsx` was never upgraded from its Phase 3 read-only form: the four sign-off fields are controlled with `onChange` no-ops (the inspector cannot type a single character), so the gate never opens, Download PDF is permanently disabled, Print is a no-op, the audit record is never read, and `variant="print"` has no caller anywhere. The audit writer specified by 04-01 Task 3 was never implemented — only its imports landed, and `writeReportAudit` has zero production call sites. Both gaps are masked by tests that inject props directly and by phase summaries claiming delivery; the 04-04 coverage table cites a test file that does not exist. This is the same integration-gap class as Phase 3's CR-01/CR-02, now on the report surface. Eight warnings cover the route's non-trimmed sign-off gate, an unvalidated `evaluatedAt` reaching the response header (500-on-bad-input), a mismeasured/buffered body cap, a fabricated zero in the PDF audit line, a wrong "Rule applied" clause on the PDF, stale Phase-3 test pins, and the partial WR-10 closure on the HTML path.

## Critical Issues

### CR-01: /report page was never upgraded — the sign-off gate, PDF download, print, and audit read are all dead in the real UI

**File:** `app/report/page.tsx:37`; `components/report/report-document.tsx:343-345, 437-452`
**Issue:** the only production call site renders `<ReportDocument snapshot={snapshot} onBack={...} />` (page.tsx:37 — byte-identical to master apart from line endings). None of the Phase 4 props are ever passed: grep across `app/`, `components/`, `hooks/`, `lib/` shows zero production callers for `signOff`, `onSignOffChange`, `onDownloadPdf`, `onPrint`, `audit`, or `variant="print"`. Consequences, all verified in the component defaults:

1. Each sign-off field is controlled with `value={signOff?.name ?? ""}` and `onChange={(e) => onSignOffChange?.(...)}` (report-document.tsx:339-393). With `onSignOffChange` undefined, every keystroke reverts — **the inspector cannot type**.
2. `gateOpen = isSignOffComplete(null)` → `false` forever → Download PDF permanently `disabled` (report-document.tsx:439) and the chip can never flip.
3. `onPrint` is undefined → the Print report button is a no-op (446-452). There is no `window.print` and no `@media print` anywhere in `app/` or `components/`; `app/report/print/page.tsx` from 04-03-PLAN Task 3 was never created, and `variant="print"` has no caller.
4. `audit` defaults to `null` → the HTML audit appendix always renders em-dashes even when telemetry exists; `readReportAudit()` has zero production callers; `withSignOff()` has zero production callers (UI-53 persistence unwired).

04-03-PLAN Task 2 specified exactly this rewrite (`<files>app/report/page.tsx, tests/report/report-page-unlock.test.tsx</files>`); 04-03-SUMMARY deferred it to "the 04-04 wrap", and 04-04-SUMMARY then claimed the print variant delivered and the integration proven — neither happened. The Screen 3 CTA (working) routes users into this dead end while the banner says "Sign off to enable PDF export and printing." The suite stays green because every report test renders `ReportDocument`/`ScreenResultsContent` with props injected, bypassing the page glue.

**Fix:** implement 04-03-PLAN Task 2 as specified — state-mirror the snapshot, `readReportAudit()` on mount, sign-off state persisted write-through via `withSignOff(snapshot, next)` + `writeReportSnapshot`, and wire the actions:

```tsx
// app/report/page.tsx (Task 2 of 04-03-PLAN, per spec)
const [snapshot, setSnapshot] = useState(() => readReportSnapshot());
const [audit] = useState(() => readReportAudit());
const [signOff, setSignOff] = useState<ReportSignOff>(snapshot?.signOff ?? EMPTY_SIGN_OFF);
const [pdfPending, setPdfPending] = useState(false);
const [pdfError, setPdfError] = useState<string | null>(null);
const persistSignOff = (next: ReportSignOff) => {
  setSignOff(next);
  if (snapshot) setSnapshot(withSignOff(snapshot, next)); // + writeReportSnapshot
};
const downloadPdf = async () => { /* POST {snapshot: withSignOff(...), audit} → blob → anchor click */ };
```

plus the `variant="print"` print page (or a print trigger), and `tests/report/report-page-unlock.test.tsx` per the plan's verify gate.

### CR-02: The audit writer was never implemented — `writeReportAudit` has zero production call sites; only its imports landed

**File:** `components/wizard/screen-results.tsx:23, 38-44`; `lib/report/audit.ts:121-128`
**Issue:** 04-01-PLAN Task 3 specifies, verbatim: a `useSyncExternalStore` subscription to the narrative store plus "an effect keyed on (evaluatedAt, extraction, storeVersion)" that computes `computeInputHash(rows, mapping, units)` and "calls writeReportAudit with (evaluatedAt, inputHash, buildAuditSteps(...))". Commit `cced0d9` added the `useEffect`/`useSyncExternalStore` imports, all five audit imports, and the docstring claim "The live audit writer (REPT-02, 04-01) renders inside the ReasoningProvider" — but **no writer code was ever written**. At HEAD, `buildAuditSteps`, `computeInputHash`, `writeReportAudit`, `AuditTelemetry`, `ReportAudit`, `useEffect`, and `useSyncExternalStore` are all unused imports (eslint confirms 8 `no-unused-vars` warnings); `writeReportAudit` is called nowhere in production code, so sessionStorage key `flawcheck:report-audit:v1` is never written. `tests/wizard/screen3-cta.test.tsx` tests only the pure `buildAuditSteps` mapping (its own header admits this), which the plan permitted as a seam shortcut — the implementation was not optional. Net effect: REPT-02's live path is severed at the write end; even after CR-01 is fixed, the PDF/HTML audit appendix can only ever show nulls. The 04-01-SUMMARY ("live audit writer inside the ReasoningProvider... writes writeReportAudit") misreports this as delivered.

**Fix:** implement the planned writer in `ScreenResultsContent` (inside the provider), keyed on `(evaluatedAt, extraction, storeVersion)`:

```tsx
const { extraction, store } = useReasoning();
const storeVersion = useSyncExternalStore(store.subscribe, () => store.version);
useEffect(() => {
  if (!evaluatedAt) return;
  let cancelled = false;
  (async () => {
    const inputHash = await computeInputHash(rows, mapping, units);
    if (cancelled) return;
    const extractionTelemetry = extraction.state === "complete" ? extraction.usage : null;
    const narrativeTelemetry = /* store.totals()/narrativeModel() when any entry complete */ null;
    writeReportAudit({
      evaluatedAt,
      inputHash,
      steps: buildAuditSteps(extractionTelemetry, narrativeTelemetry),
    });
  })();
  return () => { cancelled = true; };
}, [evaluatedAt, extraction, storeVersion, rows, mapping, units]);
```

…then delete the fossil imports if not consumed, and add a test asserting the write actually happens (not just the mapping).

## Warnings

### WR-01: PDF route sign-off gate does not trim — diverges from `isSignOffComplete` and accepts a whitespace-only sign-off

**File:** `app/api/report/pdf/route.ts:44-55`; `components/report/report-document.tsx:70-80`
**Issue:** the client gate requires all four fields trimmed-non-empty; the server gate checks only `signOff.X.length === 0`. A body whose sign-off fields are `"   "` passes the schema (`min(1)`) and the route gate, producing a PDF stamped `SIGNED OFF —     ` with an effectively blank inspector identity. The two gates enforce different contracts on the same deliverable.
**Fix:** `const trimmed = (s: string) => s.trim().length > 0;` in the route gate (or reuse `isSignOffComplete` — move it to `lib/report/content.ts` so the server can import it without the "use client" module).

### WR-02: `evaluatedAt` is an unvalidated free-text string and is interpolated raw into `Content-Disposition` — CRLF payloads turn the pinned "never 500 for bad input" contract into a 500

**File:** `app/api/report/pdf/route.ts:59-66, 73-75`; `lib/report/snapshot-schema.ts:128`
**Issue:** `ReportSnapshotSchema.evaluatedAt` is `z.string().min(1)` — any string. `dateOnly(iso)` = `iso.slice(0, 10)` is then embedded in the response header. `sourceName` is sanitized (`[^a-zA-Z0-9._-]` → `_`) but `evaluatedAt` is not. A body with `"evaluatedAt": "x\"\r\nInjected: 1\u0000..."` produces a header value containing CR/LF; undici's header validation throws on it, the throw lands inside the render try/catch (route.ts:60-70) and returns **500 "PDF render failed" for malformed input** — the exact behavior `tests/report/pdf-route.test.ts` claims is impossible (UI-50). Quotes/backslashes/high-bytes that survive validation still pollute the filename. (Response splitting itself is blocked by undici's throw, hence Warning, not Critical.)
**Fix:** validate the field as an ISO timestamp in the schema (`z.string().refine(v => !Number.isNaN(Date.parse(v)), ...)`, ideally `z.iso.datetime()`), and sanitize the filename segment with the same `replace(/[^a-zA-Z0-9._-]/g, "_")` applied to `sourceName`.

### WR-03: Body-size gate mismeasures and buffers first; schema leaves array cardinality unbounded — "render work is bounded by validated array sizes" (T-04-02-02) is not true

**File:** `app/api/report/pdf/route.ts:24-27`; `lib/report/snapshot-schema.ts:133-134`
**Issue:** three compounding gaps on the DoS mitigation the plan recorded: (1) `await req.text()` buffers the entire body into memory before the ceiling check — no `content-length` pre-check, so the 25 MB "ceiling" never bounds allocation; (2) the check compares `raw.length` (UTF-16 code units) against a byte ceiling — a payload of astral-plane characters is ~4x larger in bytes than in chars and slips the cap; (3) `readings: z.array(ReadingResultSchema)` and `indications` have no `.max()`, so a valid-shaped 25 MB body (~100K+ readings) is accepted and rendered in one request. The plan's threat model (T-04-02-02: "render work is bounded by validated array sizes") is therefore not implemented.
**Fix:** check `req.headers.get("content-length")` (and/or stream with a cap) before `text()`; measure bytes (`Buffer.byteLength(raw)`); add `.max(50_000)` (or the Phase 2 demo row count) to `readings`/`indications` in the schema.

### WR-04: PDF audit appendix fabricates a `0` for half-null token fields — violates UI-54 and diverges from the HTML renderer

**File:** `components/report/pdf-document.tsx:59-66`; `components/report/report-document.tsx:409`
**Issue:** `telemetryLine` computes `total = (step.promptTokens ?? 0) + (step.completionTokens ?? 0)` and renders `"${prompt ?? 0}/${completion ?? 0}"` whenever `total > 0`. Extraction telemetry with `promptTokens: 1200, completionTokens: null` renders **"tokens 1200/0"** — a fabricated zero on the audit record of a safety artifact. The HTML renderer correctly renders per-field em-dashes (`1200/—`, report-document.tsx:409), so the two "1:1 mirror" renderers disagree on the same data. The all-null case renders "—" as intended.
**Fix:** render per field with no fallback arithmetic: `const t = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-US"));` and drop the `total` gate (or gate on "both null").

### WR-05: PDF "Rule applied" cites an arbitrary reading citation instead of the reinspection rule — breaks the one-content-source lock

**File:** `components/report/pdf-document.tsx:80-83, 195`; `components/report/report-document.tsx:116`; `lib/report/content.ts:43`
**Issue:** the content seam exports `REINSPECTION_CITATION_ID = "api570_6_3_3_halflife"` precisely so both renderers compose the Next-inspection callout's clause from the record; the HTML renderer uses it (`citationRef(REINSPECTION_CITATION_ID)`). The PDF instead computes `snapshot.readings.find(r => r.verdict !== "accept")?.citations[0] ?? snapshot.readings[0]?.citations[1] ?? null` — the first citation of the first non-accept reading, or the **second** citation of the first reading (an index-1 fallback that is usually `undefined`). The PDF therefore prints an unrelated clause (e.g. an API 574 t-min ref) next to "Next inspection", or "—" when the HTML prints "API 570 §6.3.3" — wrong clause attribution on the same callout the tests pin for HTML (report-preview.test.ts:206).
**Fix:** `const ruleCite = citationRef(REINSPECTION_CITATION_ID);` — import `REINSPECTION_CITATION_ID` from `lib/report/content` exactly as the HTML renderer does; delete the `readings[...].citations[...]` heuristic.

### WR-06: Stale Phase-3 pins still assert the locked contract in report-preview.test.ts — passing only accidentally

**File:** `tests/report/report-preview.test.ts:141-150, 152-163, 267, 1-11`
**Issue:** 04-03-SUMMARY claims "report-preview.test.ts FS-12 pins updated to the unlocked contract... no preserved pins deleted" — but the update was additive only. Two Phase-3 pins remain and contradict the delivered surface: (1) "renders Download PDF and Print report **DISABLED** with the sign-off note" (141-150) passes only because the fixture renders with `signOff = null` (Download disabled) and the Download button's `disabled=""` attribute happens to sit within the 300-char slice before the "Print report" label — Print itself is never disabled in the current component; (2) "generates zero PDF and zero print CSS — source-level scan" (152-163) still enforces the Phase-3 no-print contract on `report-document.tsx`/`app/report/page.tsx` and will fight the CR-01 fix (any `window.print` implementation fails this pin). The file header (1-11) and the describe title "FS-12 sign-off is non-functional in Phase 3" (267) are likewise stale.
**Fix:** rewrite pins 141-150 and 152-163 to the unlocked contract (Download gated by the four-field sign-off; Print enabled and wired; print CSS allowed), and update the header/title. Do this in the same change as CR-01 so the pins describe the real surface.

### WR-07: Claimed test coverage does not exist — the all-four sign-off gate and label associations are untested; plan-mandated test files are missing

**File:** `.planning/phases/04-report-rendering/04-04-SUMMARY.md` (coverage table) vs. `tests/report/` (actual contents); `components/report/report-document.tsx:70-80`
**Issue:** 04-04-SUMMARY's UI-sweep claims `UI-52 → tests/report/report-document-signoff.test.ts (all-four gate...)` and `UI-58 → tests/report/report-document-signoff.test.ts (labels + required indicators)`. **That file does not exist** (`ls tests/report/` shows six files; `find tests -name "*signoff*"` is empty; grep confirms `isSignOffComplete` appears in zero test files). Also missing per 04-03-PLAN: `tests/report/report-page-unlock.test.tsx` (Task 2) and `tests/report/print-route.test.ts` (Task 3) — consistent with CR-01's unwired page. The chip flip, the trimmed all-four gate semantics, and the required-indicator/label association therefore have no automated proof; the nearest approximations are incidental (report-contract.test.ts tests the lib persistence; report-preview.test.ts:268-280 greps ids).
**Fix:** create `tests/report/report-document-signoff.test.ts` as specified by 04-03-PLAN Task 1 (chip flip both ways; disabled markup for a partial sign-off vs absent for complete; whitespace-only field fails the gate; labels + required indicators), or amend the coverage table to point at the tests that actually exist.

### WR-08: WR-10 closure is partial — the strict schema guards only the PDF route; the HTML snapshot read still casts through `unknown`

**File:** `lib/report/session-snapshot.ts:79-94`; `lib/report/snapshot-schema.ts` (unused by this path)
**Issue:** the Phase 3 disposition accepted WR-10 on the condition "Phase 4 adds the report-schema validation pass." The pass exists (`ReportSnapshotSchema`) but is wired **only** into the PDF route. `readReportSnapshot()` → `parseSnapshot` still validates `metadata` with a bare `isRecord` and then `metadata as unknown as ComponentMetadata`, `readings as ReadingResult[]`, `indications as EvaluationResults["indications"]` — the exact casts WR-10 flagged. The original crash path survives: a corrupt-but-array sessionStorage payload (element without `flags`) still crashes `ReportDocument` (`reading.flags.includes` → TypeError) on `/report` instead of degrading to the redirect. The file's own contract comment ("every field shape-checked") remains untrue for readings/indications/metadata.
**Fix:** in `parseSnapshot`, validate the minimal fields the renderers read (or run `ReportSnapshotSchema.safeParse` and map failure → `null`), so a corrupted payload degrades to the home redirect on the HTML path exactly as it now does at the PDF boundary.

## Info

### IN-01: Cosmetic 1:1-mirror drifts between the PDF and HTML renderers

**File:** `components/report/pdf-document.tsx:141, 147-151, 174, 179, 188` vs `components/report/report-document.tsx:49-53, 235, 277, 286, 303-313`
**Issue:** the locked decision is one content source, two identical renderers; besides WR-04/WR-05, several small divergences crept in: the PDF CML cell renders `cml ?? location` while HTML renders `cml — location`; the PDF next-inspection cell appends `(interval X.X yr)` where HTML shows the bare date; the PDF appends "(declared: informational)" after morphology (HTML: "Linear"/"Rounded"); unknown indication citation renders "—" in PDF vs zero glyphs in HTML; PDF conclusions append "(no citation)" where HTML appends no parenthetical. None are wrong numbers — they are framing drift on a document that is supposed to be a mirror.
**Fix:** pick one presentation per cell in `lib/report/content.ts` (cell-model functions) and consume it from both renderers, as was done for conclusions and the unit line.

### IN-02: Duplicate React keys possible in the PDF tables (`key={r.readingId}`, `key={ind.id}`)

**File:** `components/report/pdf-document.tsx:140, 172`
**Issue:** same shape as Phase 3 WR-07 (accepted: engine ids are unique; Phase 2 validation rejects malformed input). Server-side single-pass rendering means no cross-render reconciliation, so impact is negligible — recorded for symmetry with the accepted disposition, and the `ind.id`-keyed audit steps (`key={step.step}`, line 204) are safe because the tuple is unique by construction.
**Fix:** none required; if touched, namespace with the index as `results-table.tsx` does.

### IN-03: Stale docstrings describing the Phase-3 locked state

**File:** `components/report/report-document.tsx:15-17`; `tests/wizard/screen3-cta.test.tsx:1-6`
**Issue:** report-document.tsx's header still reads "Download PDF / Print report render DISABLED, zero PDF generation, zero print CSS" — false since 04-03 added the enabled fields/gate/audit appendix (and would mislead the CR-01 fixer). screen3-cta.test.tsx's title promises an "audit-writer seam" that (per CR-02) is only a pure-function mapping.
**Fix:** refresh both headers when the CR-01/CR-02 fixes land.

---

_Reviewed: 2026-10-06T12:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
