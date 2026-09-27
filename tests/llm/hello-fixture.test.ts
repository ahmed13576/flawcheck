import { describe, it, expect } from "vitest";
import type { OpenAI } from "openai";
import { z } from "zod";
import { runValidatedCompletion } from "@/lib/llm/complete";
import { getClient } from "@/lib/llm/client";
import { getExtractionModel, getReasoningModel } from "@/lib/llm/config";
import { HelloSchema } from "@/lib/llm/schemas";

const HAS_KEY = !!process.env.NEBIUS_API_KEY;

type CreateBody = Parameters<OpenAI["chat"]["completions"]["create"]>[0];
const CALL = {
  system: "You are a test fixture.",
  user: 'Reply with {"ok": true, "model_note": "hello"}',
  schema: HelloSchema,
  schemaHint: '{ "ok": true, "model_note": string }',
  maxCompletionTokens: 300,
  reasoningEffort: "low" as const,
};

describe.skipIf(!HAS_KEY)("hello fixture against routed models", () => {
  it("reasoning model returns Zod-valid JSON", async () => {
    const out = await runValidatedCompletion({ ...CALL, client: getClient(), model: getReasoningModel() });
    expect(out.ok).toBe(true);
    expect(typeof out.model_note).toBe("string");
  });

  it("extraction model returns Zod-valid JSON", async () => {
    const out = await runValidatedCompletion({ ...CALL, client: getClient(), model: getExtractionModel() });
    expect(out.ok).toBe(true);
    expect(typeof out.model_note).toBe("string");
  });
});

// WR-02 live fixture: forces exactly one retry against the real provider.
// The prompt is fully consistent (nothing invites chain-of-thought), but the
// test-only trap schema is unsatisfiable on attempt 1: the schema demands
// retry_nonce === "corrected" while every prompt hint only says `string`, so
// the model's first output fails Zod validation and the retry path runs.
// The Zod error names the path (retry_nonce) and the expected literal
// ("corrected"), which is exactly what the model needs to self-correct.
const RetryTrapSchema = z.object({
  ok: z.literal(true),
  model_note: z.string(),
  retry_nonce: z.literal("corrected"),
});

type RecordedCall = {
  messages: Array<{ role: string; content: string }>;
  reply: string;
};

// Wraps the real client, recording each create() body AND the raw reply it
// produced, so the live retry payload can be asserted without stubbing.
function withRecorder(inner: OpenAI) {
  const calls: RecordedCall[] = [];
  const client = {
    chat: {
      completions: {
        create: async (params: CreateBody) => {
          // The fixture never streams — narrow the SDK's Chat|Stream union to the plain completion.
          const res = (await inner.chat.completions.create(params)) as OpenAI.Chat.ChatCompletion;
          calls.push({
            messages: params.messages as unknown as Array<{ role: string; content: string }>,
            reply: res.choices[0]?.message?.content ?? "",
          });
          return res;
        },
      },
    },
  } as unknown as OpenAI;
  return { client, calls };
}

describe.skipIf(!HAS_KEY)("forced retry against routed models", () => {
  const TRAP = {
    system: "You are a test fixture.",
    user: 'Reply with {"ok": true, "model_note": "hello", "retry_nonce": "any string"}',
    schema: RetryTrapSchema,
    schemaHint: '{ "ok": true, "model_note": string, "retry_nonce": string }',
    maxCompletionTokens: 800,
    reasoningEffort: "low" as const,
  };

  it("reasoning model: retry payload carries the assistant's own bad reply", async () => {
    const { client, calls } = withRecorder(getClient());
    const out = await runValidatedCompletion({ ...TRAP, client, model: getReasoningModel() });

    expect(out.ok).toBe(true);
    expect(out.retry_nonce).toBe("corrected"); // self-corrected from the validation error
    expect(calls.length).toBe(2); // exactly one bounded retry
    expect(calls[1].messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(calls[1].messages[2].content).toBe(calls[0].reply); // verbatim replay of attempt 1
    expect(calls[1].messages[3].content).toContain("failed validation");
  });

  it("extraction model: retry payload carries the assistant's own bad reply", async () => {
    const { client, calls } = withRecorder(getClient());
    const out = await runValidatedCompletion({ ...TRAP, client, model: getExtractionModel() });

    expect(out.ok).toBe(true);
    expect(out.retry_nonce).toBe("corrected");
    expect(calls.length).toBe(2); // exactly one bounded retry
    expect(calls[1].messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(calls[1].messages[2].content).toBe(calls[0].reply); // verbatim replay of attempt 1
    expect(calls[1].messages[3].content).toContain("failed validation");
  });
});
