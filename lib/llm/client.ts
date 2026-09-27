import OpenAI from "openai";
import { NEBIUS_BASE_URL, getApiKey } from "@/lib/llm/config";

// The single server-side seam for the API key: everything reads the client from here,
// and the key is only ever touched via the config accessor inside lib/llm/*.
export function getClient(): OpenAI {
  return new OpenAI({
    baseURL: NEBIUS_BASE_URL,
    apiKey: getApiKey(),
  });
}
