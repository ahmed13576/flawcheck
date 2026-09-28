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

/** Single grammar: ids constrained to [a-z0-9_]+ (all 15 allowlist ids match). */
const CITE_TOKEN = /\[\[cite:([a-z0-9_]+)\]\]/g;
/** Trailing partial open — the chunk-boundary case. */
const PARTIAL_TAIL = /\[\[cite:[a-z0-9_]*$/;

export function tokenize(narrative: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of narrative.matchAll(CITE_TOKEN)) {
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
