/**
 * Tavily post-acceptance code-edition lookup — 05-01 (PLAT-03).
 * One basic search per evaluation; cached by evaluatedAt; degrades to null
 * on timeout, failure, or absent TAVILY_API_KEY — never blocks acceptance.
 * Results link OUT to sources; code text is never re-served (cite-don't-quote).
 */
const TAVILY_BASE = "https://api.tavily.com";

export interface TavilyResult {
  title: string;
  url: string;
}

export interface TavilyLookupResult {
  results: TavilyResult[] | null;
  cached: boolean;
}

const cache = new Map<string, TavilyLookupResult>();

export async function tavilyCodeEditionLookup(
  designCode: string,
  evaluatedAt: string,
): Promise<TavilyLookupResult> {
  if (cache.has(evaluatedAt)) {
    return { results: cache.get(evaluatedAt)!.results, cached: true };
  }
  const key = process.env.TAVILY_API_KEY;
  if (!key) return { results: null, cached: false };

  const query = `${designCode} latest edition errata thickness evaluation requirements`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${TAVILY_BASE}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: 3,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return { results: null, cached: false };
    const json = (await res.json()) as {
      results?: Array<{ title: string; url: string }>;
    };
    const results = (json.results ?? []).slice(0, 3).map((r) => ({
      title: r.title,
      url: r.url,
    }));
    const result: TavilyLookupResult = { results: results.length > 0 ? results : null, cached: false };
    cache.set(evaluatedAt, result);
    return result;
  } catch {
    return { results: null, cached: false };
  }
}
