/**
 * Server-side narrative lints — 03-02 Task 1 (Pattern R6). Pure string
 * functions with ZERO imports (verified by a source scan in the test suite):
 * every dependency — the allowlist, the citation ids, the expected verdict,
 * the verbatim corpus — is passed in by the caller, which builds all of them
 * from the single buildNarrativeContext object (drift impossible by design).
 *
 * Rejection handling contract: a failing lint never serves the narrative —
 * the route swaps in the deterministic fallback (UI-42 / T-03-05).
 */

/** Structural twin of lib/ingest/session.ts Verdict (kept local: no imports). */
export type LintVerdict = "accept" | "re_check" | "reject";

/**
 * Byte-identical to VerdictChip's labels (components/wizard/verdict-chip.tsx)
 * and to fallback.ts VERDICT_LABELS — pinned equal by the lint test suite
 * without importing either module (this file must stay import-free).
 */
const VERDICT_LABELS: Record<LintVerdict, string> = {
  accept: "ACCEPT",
  re_check: "RE-CHECK",
  reject: "FAIL",
};

const CITE_TOKEN = /\[\[cite:[a-z0-9_]+\]\]/g;
// Mandatory designator strip (Pitfall 1): "ASME B31.3" scans as 31.3 and 3 —
// neither is a precomputed chain value; without the strip every narrative
// naming the code lands in the fallback.
const DESIGNATORS = /ASME B31\.3|API 570|API 574|B31\.3/g;
const NUMBER_LITERAL = /-?\d+(?:\.\d+)?/g;
const VERDICT_LINE = /Verdict:\s*(ACCEPT|RE-CHECK|FAIL)\.?\s*$/;

function round6(v: number): number {
  return Number(v.toFixed(6));
}

/**
 * Numeric-consistency (lint 1): after stripping [[cite:<id>]] tokens (cite ids
 * contain digits) and the fixed designator strings, every numeric literal in
 * the text must be a member of the allowed set (raw 6-dp ∪ 1/2/3-dp variants
 * of the injected values — A6).
 */
export function numericConsistency(text: string, allowed: Set<number>): boolean {
  const stripped = text.replace(CITE_TOKEN, " ").replace(DESIGNATORS, " ");
  const literals = stripped.match(NUMBER_LITERAL) ?? [];
  return literals.every((l) => allowed.has(round6(parseFloat(l))));
}

/**
 * Sentence-boundary split for the mid-stream guard: the route runs the
 * numeric scan on each completed sentence so a contradicting sentence is
 * never relayed (open-question resolution 1 / UI-42). TRIMMED — for linting
 * only; do NOT use for relaying (see sentenceRelayCutoff).
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Exact-byte relay cutoff for the mid-stream guard (03-02 Task 2): the
 * character offset just past the LAST sentence terminator followed by
 * whitespace — `text.slice(0, cutoff)` is the completed-sentence prefix
 * (byte-identical to the source, separators preserved) and `text.slice(cutoff)`
 * the hold-back tail. A terminator at the very end of the buffer is NOT a
 * completed boundary (the stream may continue that "sentence"), so it stays
 * held back until stream end, where the final lints decide. Returns 0 when no
 * completed boundary exists yet.
 */
export function sentenceRelayCutoff(text: string): number {
  const re = /[.!?]\s+/g;
  let cutoff = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    cutoff = m.index + m[0].length;
  }
  return cutoff;
}

/**
 * Verdict-agreement (lint 2): the text must contain exactly one line ending in
 * the verdict contract, and its label must equal the VerdictChip mapping for
 * the engine verdict. Missing, duplicated, or disagreeing labels all reject.
 */
export function verdictAgreement(text: string, verdict: LintVerdict): boolean {
  const matches = [...text.matchAll(new RegExp(VERDICT_LINE.source, "gm"))];
  if (matches.length !== 1) return false;
  const expected = VERDICT_LABELS[verdict];
  return matches[0][1] === expected;
}

/**
 * Citation-allowlist (lint 3, wrong-context hard reject per A8): every
 * [[cite:<id>]] in the text must be in allowedIds — which is ALREADY the
 * subset the engine emitted for this reading, so an id that exists globally
 * but not for this reading still rejects. WR-05: any [[cite: machinery left
 * after stripping the strict-grammar tokens — a malformed id (invalid
 * charset, empty) — rejects too; the machinery must never reach the reader.
 */
export function citationAllowlistLint(text: string, allowedIds: string[]): boolean {
  // Local FRESH regexes: a module-level global regex's lastIndex persists
  // across calls, and matchAll clones WITH that lastIndex — mid-text state
  // yields corrupted matches (undefined groups; found by the WR-05 pins).
  // WR-05: the WIDENED charset for token extraction — any [[cite:…]] shape is
  // a citation token, so a malformed id (FOO, empty) is caught by the
  // allowlist check instead of falling through as raw machinery text.
  const tokens = [...text.matchAll(/\[\[cite:([^\]\n]*)\]\]/g)].map((m) => m[1]);
  if (!tokens.every((id) => allowedIds.includes(id))) return false;
  // WR-05: any [[cite: machinery left after stripping the strict-grammar
  // tokens (a malformed id like FOO, or empty) rejects too — widened charset.
  const machineryScan = text.replace(/\[\[cite:[^\]\n]*\]\]/g, " ");
  return !machineryScan.includes("[[cite:");
}

/**
 * Verbatim-text guard (lint 4, cite-don't-quote): true = clean. Any 8-word
 * window of the narrative overlapping the corpus (citations.json title +
 * scope_note strings) rejects. Honest scope: catches parroting of repo-held
 * criteria text and gross quoting, not memorized paragraphs — the short-length
 * prompt contract is the first line of defense.
 */
export function verbatimNgramLint(text: string, corpus: string[], n = 8): boolean {
  const words = (s: string): string[] => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const corpusNgrams = new Set<string>();
  for (const doc of corpus) {
    const w = words(doc);
    for (let i = 0; i + n <= w.length; i++) {
      corpusNgrams.add(w.slice(i, i + n).join(" "));
    }
  }
  if (corpusNgrams.size === 0) return true;
  const t = words(text);
  for (let i = 0; i + n <= t.length; i++) {
    if (corpusNgrams.has(t.slice(i, i + n).join(" "))) return false;
  }
  return true;
}

export type FinalLintContext = {
  allowedNumbers: Set<number>;
  allowedCitationIds: string[];
  verdict: LintVerdict;
  /** citations.json title + scope_note strings (built by the caller). */
  corpus: string[];
};

export type FinalLintResult =
  | { ok: true }
  | { ok: false; reason: "numeric_lint" | "verdict_lint" | "citation_lint" | "verbatim_lint" };

/** Run all four lints in order; the first failure names its reason. */
export function runFinalLints(text: string, ctx: FinalLintContext): FinalLintResult {
  if (!numericConsistency(text, ctx.allowedNumbers)) return { ok: false, reason: "numeric_lint" };
  if (!verdictAgreement(text, ctx.verdict)) return { ok: false, reason: "verdict_lint" };
  if (!citationAllowlistLint(text, ctx.allowedCitationIds))
    return { ok: false, reason: "citation_lint" };
  if (!verbatimNgramLint(text, ctx.corpus)) return { ok: false, reason: "verbatim_lint" };
  return { ok: true };
}
