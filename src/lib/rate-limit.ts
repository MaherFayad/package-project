/**
 * Tiny in-memory fixed-window rate limiter (per server process).
 * Good enough for dev and a single instance; swap for Redis in production.
 */
type Bucket = { count: number; resetAt: number };
const stores = new Map<string, Map<string, Bucket>>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(
  namespace: string,
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  let store = stores.get(namespace);
  if (!store) {
    store = new Map();
    stores.set(namespace, store);
  }
  const now = Date.now();
  let b = store.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    store.set(key, b);
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  if (store.size > 10_000) {
    for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
  }
  return { ok: true, remaining: limit - b.count, retryAfterSec: 0 };
}

/** Test helper. */
export function __resetRateLimits() {
  stores.clear();
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown"
  );
}
