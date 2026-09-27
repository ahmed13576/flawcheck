// Single source of env routing config. No model-ID literals may appear in this file —
// model IDs come from env only (.env.example documents the recommended current IDs).
export const NEBIUS_BASE_URL =
  process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1/";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v)
    throw new Error(
      `Missing required env var: ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  return v;
}

export function getApiKey() {
  return requiredEnv("NEBIUS_API_KEY");
}

export function getReasoningModel() {
  return requiredEnv("NEBIUS_MODEL_REASONING");
}

export function getExtractionModel() {
  return requiredEnv("NEBIUS_MODEL_EXTRACTION");
}
