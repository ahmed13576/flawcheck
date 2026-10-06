/**
 * Per-IP rate limiter — 05-02 (PLAT-04): in-memory token bucket, 20 req/min
 * per IP. Returns 429 + Retry-After when exceeded. Session-scoped (resets on
 * server restart) — sufficient for the hackathon demo; Phase 5 post-ship would
 * use a durable store.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

const buckets = new Map<string, { count: number; windowStart: number }>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(ip);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    bucket = { count: 0, windowStart: now };
    buckets.set(ip, bucket);
  }
  bucket.count++;
  if (bucket.count > MAX_REQUESTS) {
    const elapsed = now - bucket.windowStart;
    const retryAfterSeconds = Math.max(1, Math.ceil((WINDOW_MS - elapsed) / 1000));
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Extract the client IP from a Request (Vercel / local). */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Rate-limit response helper: 429 with the Retry-After header. */
export function rateLimitedResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { error: "rate limited — try again shortly" },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
