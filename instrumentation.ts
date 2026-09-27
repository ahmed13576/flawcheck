// Next.js instrumentation hook — runs once per server instance, before serving.
// Gate on the Node runtime: the validation module reads env vars and makes a
// live network call, neither of which exists on the edge runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateAndCacheModelConfig } = await import("./lib/llm/validate-config");
    // Never throws: validateAndCacheModelConfig swallows and logs so startup
    // cannot crash on validation problems.
    await validateAndCacheModelConfig();
  }
}
