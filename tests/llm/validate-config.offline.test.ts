import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { OpenAI } from "openai";
import { validateModelConfig } from "@/lib/llm/validate-config";

// Minimal fake shaped as OpenAI via double cast — only models.list is exercised.
// Returns a plain array; validateModelConfig's for-await handles it.
function fakeClient(ids: string[]): OpenAI {
  const list = async () => ids.map((id) => ({ id }));
  return { models: { list } } as unknown as OpenAI;
}

const ENV_KEYS = ["NEBIUS_API_KEY", "NEBIUS_MODEL_REASONING", "NEBIUS_MODEL_EXTRACTION"] as const;
// Neutral test IDs — never real vendor model-ID literals.
const REASONING_ID = "test-reasoning-model";
const EXTRACTION_ID = "test-extraction-model";
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    process.env[k] = k === "NEBIUS_API_KEY" ? "test-key" : k === "NEBIUS_MODEL_REASONING" ? REASONING_ID : EXTRACTION_ID;
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("validateModelConfig (offline, injected fake client)", () => {
  it("ok=true, missing=[] when the catalog contains both configured IDs", async () => {
    const v = await validateModelConfig({
      client: fakeClient([REASONING_ID, EXTRACTION_ID, "some-other-model"]),
    });
    expect(v.ok).toBe(true);
    expect(v.missing).toEqual([]);
    expect(typeof v.checkedAt).toBe("string");
    expect(v.error).toBeUndefined();
  });

  it("ok=false and missing names exactly the absent ID verbatim", async () => {
    const v = await validateModelConfig({ client: fakeClient([REASONING_ID]) });
    expect(v.ok).toBe(false);
    expect(v.missing).toEqual([EXTRACTION_ID]);
  });

  it("rejects when env vars are unset, naming the missing variable", async () => {
    delete process.env.NEBIUS_MODEL_REASONING;
    delete process.env.NEBIUS_MODEL_EXTRACTION;
    delete process.env.NEBIUS_API_KEY;
    await expect(validateModelConfig({ client: fakeClient([]) })).rejects.toThrow(
      /NEBIUS_MODEL_REASONING/,
    );
  });
});
