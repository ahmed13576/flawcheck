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
      return o.schema.parse(JSON.parse(raw));
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`Validated call failed after 1 retry (model=${o.model}): ${lastError}`);
}
