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

/**
 * Client IP for rate limiting and audit logs.
 *
 * `X-Forwarded-For` is a list the CLIENT can pre-fill: each proxy APPENDS the address it saw.
 * Taking the first entry (as before) let anyone send a fresh fake IP per request and skip every
 * per-IP limit. We trust only the entries added by our own proxies: `TRUSTED_PROXY_HOPS`
 * (default 1, e.g. one load balancer or Vercel's edge) counts from the right.
 * `X-Real-IP`, set (not appended) by nginx and Vercel, wins when present. Behind an edge that
 * passes a client's own `X-Real-IP` through unchanged (a bare cloud load balancer), set
 * `TRUST_X_REAL_IP=0`: otherwise a client could send a fresh value per request and skip the per-IP
 * OTP limits (SMS pumping). Technical R4-13; OWASP ASVS 4.0.3 V11.1.4 (anti-automation).
 */
export function clientIp(headers: Headers): string {
  // Cloudflare (production on Workers, TRUST_CF_CONNECTING_IP=1 in wrangler.jsonc): the edge sets
  // CF-Connecting-IP itself and overwrites any value the client sent, while X-Real-IP and
  // X-Forwarded-For pass through from the client unchanged. Trust ONLY that header there.
  if (process.env.TRUST_CF_CONNECTING_IP === "1") return headers.get("cf-connecting-ip")?.trim() || "unknown";
  const real = process.env.TRUST_X_REAL_IP === "0" ? undefined : headers.get("x-real-ip")?.trim();
  if (real) return real;
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!chain.length) return "unknown";
  const hops = Math.max(1, Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "1", 10) || 1);
  return chain[Math.max(0, chain.length - hops)];
}
