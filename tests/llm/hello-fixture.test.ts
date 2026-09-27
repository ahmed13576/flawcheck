import { describe, it, expect } from "vitest";
import { runValidatedCompletion } from "@/lib/llm/complete";
import { getClient } from "@/lib/llm/client";
import { getExtractionModel, getReasoningModel } from "@/lib/llm/config";
import { HelloSchema } from "@/lib/llm/schemas";

const HAS_KEY = !!process.env.NEBIUS_API_KEY;
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
