/**
 * One source of truth for the security response headers (OWASP ASVS 4.0.3 V14.4.1-V14.4.7,
 * Top 10 A05:2021). Used by `next.config.ts` (every route, including /api and static files) AND by
 * `src/middleware.ts`: a header set in middleware replaces the config one, so both must send the
 * same full policy (round 2: the middleware's short CSP had silently replaced the full one on
 * every page). Edge-safe: no Node APIs.
 *
 * CSP notes
 * - Everything is first-party: fonts are self-hosted by next/font, 3D environments and label art
 *   are generated in the browser, payments leave through window.location (navigation is not
 *   restricted by CSP), the courier tracking link is a plain link.
 * - script-src 'unsafe-inline' is required by Next's inline hydration data and the cookie-bar
 *   pre-paint script unless every page renders with per-request nonces (which disables static
 *   rendering; see technical.md T-30). 'unsafe-eval' only in dev (React Refresh).
 * - blob:/data: cover canvas captures, thumbnails, uploaded-image previews (createObjectURL),
 *   three.js texture loads and blob workers.
 * - frame-ancestors 'none' + X-Frame-Options DENY: no clickjacking of proof approval / payment.
 */
export function contentSecurityPolicy(dev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' blob: data:${dev ? " ws: wss:" : ""}`,
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export const PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()";
export const HSTS = "max-age=31536000; includeSubDomains";

/** The full header set. HSTS only for production over HTTPS (never on http://localhost e2e runs). */
export function securityHeaders(dev: boolean, https: boolean): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(dev) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ...(!dev && https ? [{ key: "Strict-Transport-Security", value: HSTS }] : []),
  ];
}

/** Set the full header set on a response (middleware). */
export function applySecurityHeaders(headers: Headers, opts: { dev: boolean; https: boolean }): void {
  for (const h of securityHeaders(opts.dev, opts.https)) headers.set(h.key, h.value);
}
