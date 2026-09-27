import { describe, it, expect } from "vitest";
import type { OpenAI } from "openai";
import { runValidatedCompletion } from "@/lib/llm/complete";
import { HelloSchema } from "@/lib/llm/schemas";

// Offline contract lock for runValidatedCompletion (PLAT-02):
// - forced bad output  -> EXACTLY 2 create() calls, then resolves with the parsed value
// - persistent bad output -> EXACTLY 2 create() calls (never 3), then a clear rejection
//   naming the model AND carrying the Zod issue text
// - immediate success  -> EXACTLY 1 create() call (no retry on success)
// No network, no API key — the fake is a minimal object double-cast to the OpenAI type.

const MODEL_ID = "test-model"; // neutral fake ID — never a real vendor model ID

const BASE = {
  system: "You are a test fixture.",
  user: "Reply with the JSON.",
  schema: HelloSchema,
  schemaHint: '{ "ok": true, "model_note": string }',
};

interface RecordedCall {
  messages: Array<{ role: string; content: string }>;
}

function makeFakeClient(responses: string[]) {
  const calls: RecordedCall[] = [];
  let n = 0;
  const create = async (params: { messages: Array<{ role: string; content: string }> }) => {
    n += 1;
    calls.push({ messages: params.messages });
    const content = responses[Math.min(n - 1, responses.length - 1)];
    return { choices: [{ message: { content } }] };
  };
  const client = { chat: { completions: { create } } } as unknown as OpenAI;
  return { client, callCount: () => n, calls };
}

// The Zod issue text, computed independently: parse the same bad payload directly
// with the same schema and take its error message. complete.ts embeds e.message
// from the identical parse, so this fragment must appear in the final rejection.
const BAD_PAYLOAD = JSON.stringify({ ok: false, model_note: "wrong" });
const EXPECTED_ISSUE_TEXT = (() => {
  try {
    HelloSchema.parse(JSON.parse(BAD_PAYLOAD));
    return ""; // unreachable — payload is schema-invalid by construction
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
})();

describe("runValidatedCompletion retry contract (offline)", () => {
  it("retries exactly once on bad output, then resolves; second call carries the correction", async () => {
    const fake = makeFakeClient(["this is not json at all", JSON.stringify({ ok: true, model_note: "fixed" })]);

    const out = await runValidatedCompletion({ ...BASE, client: fake.client, model: MODEL_ID });

    expect(out).toEqual({ ok: true, model_note: "fixed" });
    expect(fake.callCount()).toBe(2); // exactly one bounded retry

    const second = fake.calls[1];
    const correction = second.messages[second.messages.length - 1];
    expect(correction.role).toBe("user");
    expect(correction.content).toContain("failed validation"); // cites the first attempt's validation error
  });

  it("after exactly 2 attempts rejects naming the model AND carrying the Zod issue text", async () => {
    const fake = makeFakeClient([BAD_PAYLOAD]); // every attempt returns schema-violating JSON

    await expect(runValidatedCompletion({ ...BASE, client: fake.client, model: MODEL_ID })).rejects.toThrow(
      /Validated call failed after 1 retry/,
    );

    let message = "";
    try {
      await runValidatedCompletion({ ...BASE, client: fake.client, model: MODEL_ID });
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    expect(message).toContain(MODEL_ID); // names the model
    expect(message).toContain(EXPECTED_ISSUE_TEXT); // carries the Zod issue text
    expect(fake.callCount()).toBe(4); // 2 from the rejected run above + 2 here — never 3 per call
  });

  it("does not retry when the first response is already schema-valid", async () => {
    const fake = makeFakeClient([JSON.stringify({ ok: true, model_note: "first try" })]);

    const out = await runValidatedCompletion({ ...BASE, client: fake.client, model: MODEL_ID });

    expect(out).toEqual({ ok: true, model_note: "first try" });
    expect(fake.callCount()).toBe(1); // no retry on success
  });
});
