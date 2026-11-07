import type { NextConfig } from "next";
import { createRequire } from "node:module";
import { contentSecurityPolicy as csp, securityHeaders as headersFor } from "./src/lib/security-headers";

const isDev = process.env.NODE_ENV !== "production";

/** HSTS only when the site is really served over HTTPS (never on http://localhost e2e runs). */
const httpsSite = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

/** Full CSP (see src/lib/security-headers.ts; middleware sends the same policy on pages). */
export function contentSecurityPolicy(dev = isDev): string {
  return csp(dev);
}

export function securityHeaders(dev = isDev, https = httpsSite): { key: string; value: string }[] {
  return headersFor(dev, https);
}

/** Security headers for /api responses: everything except the page CSP (routes set their own). */
export function apiHeaders(dev = isDev, https = httpsSite): { key: string; value: string }[] {
  return headersFor(dev, https).filter((h) => h.key !== "Content-Security-Policy");
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the workspace root: a stray lockfile in a parent folder (e.g. the user's home dir)
  // otherwise makes Next infer the wrong root and resolve modules from outside the project.
  outputFileTracingRoot: process.cwd(),
  // The floating dev badge sat on top of the admin/vendor side-nav footer ("Back to store").
  // Build and runtime errors still open the dev overlay.
  devIndicators: false,
  // Optional separate build dir (e.g. NEXT_DIST_DIR=.next/mkt) so parallel dev servers and builds don't clash.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // three / r3f ship ESM that Next handles natively; transpile drei helpers for safety.
  transpilePackages: ["three"],
  // Cloudflare Workers (OpenNext): ship the generated Prisma client and its workerd build as-is.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  experimental: {
    optimizePackageImports: ["lucide-react", "@react-three/drei"],
    // PERF-17: per-route CSS so admin/vendor pages stop loading designer and marketing CSS.
    cssChunking: "strict",
    // PERF-R4-01: inline every route's CSS into the HTML <head>. With strict chunking a store
    // page linked 20 render-blocking CSS files (43 KB gzip); on Slow 4G (562 ms RTT, 6
    // connections) that was 3-4 round trips before the first paint. Inline, the CSS arrives
    // with the HTML and FCP/LCP no longer wait on it. Production only (dev keeps <link>s).
    // OFF for the Cloudflare Workers build (ELBA_TARGET=cloudflare, npm run cf:build): Next copies
    // each route's inlined CSS into every page's client-reference manifest (~1 MB x 87 pages),
    // and OpenNext bundles all manifests into the Worker: 14.3 MiB gzip against the 10 MiB limit.
    // There the CSS files come from Cloudflare's cache over HTTP/2-3 (docs/DEPLOY-CLOUDFLARE.md).
    inlineCss: process.env.ELBA_TARGET !== "cloudflare",
  },
  // R5-PL-11: replace Next's strict CSS chunking plugin with the vendored copy that never merges
  // a module into a chunk used by routes that do not import it (scripts/next/css-chunking-plugin.cjs).
  webpack(config) {
    const i = config.plugins.findIndex((p: { constructor?: { name?: string } }) => p?.constructor?.name === "CssChunkingPlugin");
    if (i >= 0 && (config.plugins[i] as { strict?: boolean }).strict) {
      const { CssChunkingPlugin } = createRequire(`${process.cwd()}/`)("./scripts/next/css-chunking-plugin.cjs");
      config.plugins[i] = new CssChunkingPlugin(true);
    }
    return config;
  },
  async headers() {
    return [
      // Pages, static files and everything else: the full set (middleware repeats it on pages).
      { source: "/((?!api/).*)", headers: securityHeaders() },
      // API: the same headers WITHOUT the page CSP. A header set here replaces the one a route
      // handler sets, and the routes that serve user files (/api/vendor/files, the dieline SVG)
      // send their own `sandbox` CSP, which the page policy (inline scripts allowed) used to
      // overwrite. JSON and PDFs are served with nosniff and need no document CSP.
      { source: "/api/:path*", headers: [...apiHeaders(), { key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
};

export default nextConfig;
