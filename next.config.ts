import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy for every page (OWASP ASVS 4.0.3 V14.4.3 / V14.4.7, Top 10 A05:2021).
 * - Everything is first-party: fonts are self-hosted by next/font, 3D environments are generated
 *   in-browser, payments redirect via window.location (not restricted by CSP).
 * - 'unsafe-inline' scripts are required by Next's inline hydration data unless every page opts
 *   into per-request nonces (which would disable static rendering); 'unsafe-eval' only in dev
 *   (React Refresh). blob:/data: cover canvas captures, thumbnails and three.js texture loads.
 * - frame-ancestors 'none' + X-Frame-Options DENY: no clickjacking of the proof approval /
 *   payment steps.
 */
export function contentSecurityPolicy(dev = isDev): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' blob: data:${dev ? " ws: wss:" : ""}`,
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** HSTS only when the site is really served over HTTPS (never on http://localhost e2e runs). */
const httpsSite = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

export function securityHeaders(dev = isDev, https = httpsSite): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(dev) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ...(!dev && https ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
  ];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The floating dev badge sat on top of the admin/vendor side-nav footer ("Back to store").
  // Build and runtime errors still open the dev overlay.
  devIndicators: false,
  // Optional separate build dir (e.g. NEXT_DIST_DIR=.next/mkt) so parallel dev servers and builds don't clash.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // three / r3f ship ESM that Next handles natively; transpile drei helpers for safety.
  transpilePackages: ["three"],
  experimental: {
    optimizePackageImports: ["lucide-react", "@react-three/drei"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders() },
      // API responses are data, never cached by shared caches unless a route says otherwise.
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
};

export default nextConfig;
