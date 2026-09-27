// Dump the live /v1/models catalog to docs/model-catalog.json (committed artifact).
// Plain .mjs on purpose: run via `npm run catalog` (node --env-file=.env.local) —
// deliberately NOT part of the lib/llm module graph; reads env vars directly.
import { writeFileSync } from "node:fs";
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1/",
  apiKey: process.env.NEBIUS_API_KEY,
});

// NOTE (shape, A5): the SDK's models.list() resolves to a Page — async-iterable
// (Symbol.asyncIterator) but NOT sync-spreadable ([...page] throws). The payload
// array is .data: [{ id, created, object, owned_by }, ...].
const page = await client.models.list();
const models = [...page.data].sort((a, b) => a.id.localeCompare(b.id)); // ascending by id (FA-03)
writeFileSync(
  "docs/model-catalog.json",
  JSON.stringify({ dumpedAt: new Date().toISOString(), count: models.length, models }, null, 2) + "\n",
);
console.log(`Wrote docs/model-catalog.json (${models.length} models)`);
// Node 24.14/win32: the SDK's pooled keep-alive socket races process teardown and
// trips a libuv assertion (win/async.c) that turns the exit code nonzero even
// after a successful run. Letting the socket settle before exiting avoids it.
await new Promise((resolve) => setTimeout(resolve, 500));
process.exit(0);
