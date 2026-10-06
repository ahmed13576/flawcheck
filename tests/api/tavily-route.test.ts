/**
 * PLAT-03 route test — GET /api/tavily (final milestone review wiring):
 * 400 on missing/oversized params, `{ results: null }` when no TAVILY_API_KEY
 * is configured (degrade, never block), results + cached=false on a mocked
 * upstream success, and cached=true on the second call with the same
 * evaluatedAt (the lookup's per-evaluation cache).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { GET } from "@/app/api/tavily/route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function getReq(designCode: string, evaluatedAt: string): Request {
  return new Request(
    `http://localhost/api/tavily?designCode=${encodeURIComponent(designCode)}&evaluatedAt=${encodeURIComponent(evaluatedAt)}`,
  );
}

describe("GET /api/tavily — post-acceptance code-edition lookup", () => {
  it("400s when designCode or evaluatedAt is missing or oversized", async () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    const missing = await GET(getReq("", "2026-10-07T00:00:00Z"));
    expect(missing.status).toBe(400);
    const noTime = await GET(getReq("ASME B31.3-2024", ""));
    expect(noTime.status).toBe(400);
    const oversized = await GET(getReq("x".repeat(65), "2026-10-07T00:00:00Z"));
    expect(oversized.status).toBe(400);
  });

  it("degrades to results:null with no TAVILY_API_KEY — never fetches, never throws", async () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await GET(getReq("ASME B31.3-2024", "2026-10-07T01:00:00Z"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: null, cached: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns up to 3 results on upstream success and caches by evaluatedAt", async () => {
    vi.stubEnv("TAVILY_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            results: [
              { title: "ASME B31.3 editions", url: "https://example.com/b31-3" },
              { title: "API 570 errata", url: "https://example.com/api-570" },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const first = await GET(getReq("ASME B31.3-2024", "2026-10-07T02:00:00Z"));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      results: [
        { title: "ASME B31.3 editions", url: "https://example.com/b31-3" },
        { title: "API 570 errata", url: "https://example.com/api-570" },
      ],
      cached: false,
    });
    const second = await GET(getReq("ASME B31.3-2024", "2026-10-07T02:00:00Z"));
    expect(await second.json()).toEqual({
      results: [
        { title: "ASME B31.3 editions", url: "https://example.com/b31-3" },
        { title: "API 570 errata", url: "https://example.com/api-570" },
      ],
      cached: true,
    });
  });

  it("degrades to results:null when the upstream errors", async () => {
    vi.stubEnv("TAVILY_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );
    const res = await GET(getReq("API 570", "2026-10-07T03:00:00Z"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: null, cached: false });
  });
});
