/**
 * Tokenizer — 03-01 Task 1 (Pattern R3, 03-RESEARCH.md). Pure segment model
 * for `[[cite:<id>]]` tokens over narrative text; the renderer (ReasoningPane)
 * consumes segments and the allowlist decides visibility — an id absent from
 * citations.json yields `resolved: false` so the renderer can emit ZERO glyphs
 * (UI-35) and feed the audit stamp.
 *
 * Edge cases (each named-tested):
 * - unknown id → `{ kind: "cite", resolved: false }`
 * - unterminated `[[cite:` prefix (stream truncation, Pitfall 3) → ONE
 *   `{ kind: "incomplete" }` segment — stripped + audited, never machinery text
 * - token adjacent to numbers (`4.20[[cite:api570_7_2]] mm`) segments cleanly
 *
 * `safeTailHold` is the client buffer helper Plan 03-03 uses so a trailing
 * partial token never flashes mid-stream.
 */
import { citationIdExists } from "@/lib/calc/criteria";

export type Segment =
  | { kind: "text"; value: string }
  | { kind: "cite"; id: string; resolved: boolean }
  | { kind: "incomplete" };

/**
 * WR-05: ANY literal `[[cite:…]]` shape is a citation token. The strict id
 * grammar ([a-z0-9_]+) decided RESOLUTION historically — a malformed id like
 * `[[cite:FOO]]` or `[[cite:]]` fell through as plain TEXT and reached the
 * reader as machinery. Widening the token charset keeps the strict grammar as
 * the ALLOWLIST decision only: a malformed id resolves false → zero glyphs +
 * the audit stamp, never machinery text.
 */
const CITE_TOKEN = /\[\[cite:([^\]\n]*)\]\]/g;
/** Trailing partial open — the chunk-boundary case (any id charset). */
const PARTIAL_TAIL = /\[\[cite:[^\]\n]*$/;

export function tokenize(narrative: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  // Local fresh regex — shared global regex state corrupts matchAll.
  // WR-05 widened charset: ANY [[cite:…]] shape is a citation token; a
  // malformed id resolves false → zero glyphs + audit stamp, never machinery.
  for (const match of narrative.matchAll(/\[\[cite:([^\]\n]*)\]\]/g)) {
    const idx = match.index ?? 0;
    if (idx > last) {
      segments.push({ kind: "text", value: narrative.slice(last, idx) });
    }
    const id = match[1];
    segments.push({ kind: "cite", id, resolved: citationIdExists(id) });
    last = idx + match[0].length;
  }
  const tail = narrative.slice(last);
  const partial = tail.match(PARTIAL_TAIL);
  if (partial) {
    const prefix = tail.slice(0, partial.index ?? 0);
    if (prefix.length > 0) {
      segments.push({ kind: "text", value: prefix });
    }
    segments.push({ kind: "incomplete" });
  } else if (tail.length > 0) {
    segments.push({ kind: "text", value: tail });
  }
  return segments;
}

/**
 * Hold back a trailing partial `[[cite:…` so machinery text never flashes
 * mid-stream (Pattern R3 chunk-boundary safety). Prose without a partial
 * token passes through unchanged.
 */
export function safeTailHold(acc: string): string {
  return acc.replace(PARTIAL_TAIL, "");
}
