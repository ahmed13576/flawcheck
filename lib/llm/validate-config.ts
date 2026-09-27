import type { OpenAI } from "openai";
import { getClient } from "@/lib/llm/client";
import { getExtractionModel, getReasoningModel } from "@/lib/llm/config";

export interface ModelValidation {
  ok: boolean;
  missing: string[];
  checkedAt: string;
  error?: string;
}

// Cache lives on globalThis so dev/HMR module reloads share one result.
// Cache-on-write, no mutex: concurrent health requests may duplicate live
// validations before the cache fills — harmless (FA-04).
const CACHE_KEY = Symbol.for("flawcheck.model-validation");
const store = globalThis as unknown as Record<symbol, ModelValidation | undefined>;

export async function validateModelConfig(opts?: { client?: OpenAI }): Promise<ModelValidation> {
  const checkedAt = new Date().toISOString();
  // Read the configured IDs FIRST: missing env vars reject (config accessor
  // contract — the error names the variable, FA-02). The catalog listing call
  // itself never throws out of this function.
  const configured = [getReasoningModel(), getExtractionModel()];
  try {
    const client = opts?.client ?? getClient();
    const page = await client.models.list();
    const catalogIds = new Set<string>();
    // for-await works on both the SDK's async-iterable page and a plain array
    // (offline tests inject a plain array) — no shape coupling.
    for await (const m of page) {
      if (m && typeof m.id === "string") catalogIds.add(m.id);
    }
    // EXACT string match — no trim, no case folding, no aliasing (FA-01).
    const missing = configured.filter((id) => !catalogIds.has(id));
    return { ok: missing.length === 0, missing, checkedAt };
  } catch (e) {
    return {
      ok: false,
      missing: [],
      checkedAt,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// Startup path: validate, cache, log explicitly — NEVER crashes startup.
export async function validateAndCacheModelConfig(): Promise<ModelValidation> {
  try {
    const v = await validateModelConfig();
    store[CACHE_KEY] = v;
    if (v.ok) {
      console.log("[validate-config] model routing OK (both configured IDs present in live catalog)");
    } else {
      console.warn(
        `[validate-config] model routing INVALID — missing configured IDs: ${v.missing.join(", ")}`,
      );
    }
    return v;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const v: ModelValidation = { ok: false, missing: [], checkedAt: new Date().toISOString(), error: msg };
    store[CACHE_KEY] = v;
    console.error(`[validate-config] startup validation failed (startup continues): ${msg}`);
    return v;
  }
}

// Always-current entry point: cached result when fresh, otherwise re-validate
// live and re-cache. register() is only the per-instance fast-fail.
export async function getModelValidation(maxAgeMs = 60000): Promise<ModelValidation> {
  const cached = store[CACHE_KEY];
  if (cached && Date.now() - Date.parse(cached.checkedAt) < maxAgeMs) {
    return cached;
  }
  return validateAndCacheModelConfig();
}
