import type { OpenAI } from "openai";
import type { ZodType } from "zod";

export interface ValidatedCallOptions<T> {
  client: OpenAI; // injected — offline tests pass a fake
  model: string; // env-configured ID
  system: string;
  user: string;
  schema: ZodType<T>; // used for validation
  schemaHint: string; // human-readable JSON shape included in the system prompt
  maxCompletionTokens?: number;
  reasoningEffort?: "low" | "medium" | "high"; // low|medium|high ONLY (verified 2026-09-26) — anything wider 422s
  /**
   * Optional usage tap (03-02, PLAT-05): invoked with the FINAL successful
   * response's token counts when the provider reports them. Additive and
   * backward-compatible — the return contract stays `T` (Phase 1 pins it);
   * fakes without a `usage` field simply never fire it.
   */
  usageSink?: (u: { promptTokens: number; completionTokens: number }) => void;
}

export async function runValidatedCompletion<T>(o: ValidatedCallOptions<T>): Promise<T> {
  const messages = [
    {
      role: "system" as const,
      content: `${o.system}\nRespond ONLY with JSON matching this shape:\n${o.schemaHint}`,
    },
    { role: "user" as const, content: o.user },
  ];

  const call = (extra: object) =>
    o.client.chat.completions.create({
      model: o.model,
      messages,
      response_format: { type: "json_object" },
      ...(o.maxCompletionTokens ? { max_completion_tokens: o.maxCompletionTokens } : {}),
      ...(o.reasoningEffort ? { reasoning_effort: o.reasoningEffort } : {}),
      ...extra,
    });

  let lastError = "";
  let previousRaw = ""; // the model's own bad reply — replayed as an assistant turn on retry
  for (let attempt = 0; attempt < 2; attempt++) {
    // exactly one bounded retry
    const res = await call(
      attempt === 1
        ? {
            messages: [
              ...messages,
              // The model must see its own bad output before the correction —
              // "reply again with corrected JSON" otherwise references a reply
              // it was never shown (WR-02).
              { role: "assistant" as const, content: previousRaw },
              {
                role: "user" as const,
                content: `That reply failed validation: ${lastError}. Reply again with corrected JSON only.`,
              },
            ],
          }
        : {},
    );
    const raw = res.choices[0]?.message?.content ?? "";
    previousRaw = raw;
    try {
      const parsedValue = o.schema.parse(parseJsonLoose(raw));
      const u = res.usage;
      if (o.usageSink && u) {
        o.usageSink({
          promptTokens: u.prompt_tokens ?? 0,
          completionTokens: u.completion_tokens ?? 0,
        });
      }
      return parsedValue;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`Validated call failed after 1 retry (model=${o.model}): ${lastError}`);
}

/**
 * Tolerant JSON parse (live finding 2026-09-27: Lightning occasionally wraps
 * the JSON object in a prose preamble — "Here's a…" — even under
 * response_format json_object). Direct parse first; on failure, extract the
 * first BALANCED `{…}` block (string/escape aware) and parse that. This is
 * transport hardening, not a content lint — validation (schema.parse) is
 * unchanged and the bounded retry still applies.
 */
function parseJsonLoose(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // CoT-aware candidate order: reasoning models may emit visible thinking
    // before the final answer, and the thinking can itself contain brace
    // examples — so candidates are tried LAST-first (the answer comes last).
    const blocks = extractBalancedObjects(raw);
    let lastError: unknown = new SyntaxError("no JSON object found in reply");
    for (let i = blocks.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(blocks[i]);
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError;
  }
}

/** All top-level balanced `{…}` blocks in `raw` (string/escape aware). */
function extractBalancedObjects(raw: string): string[] {
  const blocks: string[] = [];
  const start = raw.indexOf("{");
  if (start === -1) return blocks;
  let depth = 0;
  let inStr = false;
  let esc = false;
  let open = -1;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") {
      if (depth === 0) open = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && open !== -1) {
        blocks.push(raw.slice(open, i + 1));
        open = -1;
      }
    }
  }
  return blocks;
}
