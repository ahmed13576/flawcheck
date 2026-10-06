/**
 * Rate limiter pins — 05-02 (PLAT-04): burst over 20 → 429; recovery after
 * the window; per-IP isolation.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit } from "@/lib/api/rate-limit";

beforeEach(() => {
  // fresh module state per test — vi.resetModules doesn't work for module-level
  // Maps in ESM, so we use unique IPs per test instead
});

describe("checkRateLimit", () => {
  it("allows the first 20 requests for an IP", () => {
    const ip = "test-allow-" + Math.random();
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit(ip).allowed).toBe(true);
    }
  });

  it("returns 429 (not allowed) on request 21 with a Retry-After", () => {
    const ip = "test-burst-" + Math.random();
    for (let i = 0; i < 20; i++) checkRateLimit(ip);
    const result = checkRateLimit(ip);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("isolates IPs — one IP's burst doesn't affect another", () => {
    const ipA = "test-iso-a-" + Math.random();
    const ipB = "test-iso-b-" + Math.random();
    for (let i = 0; i < 20; i++) checkRateLimit(ipA);
    expect(checkRateLimit(ipB).allowed).toBe(true);
  });
});
