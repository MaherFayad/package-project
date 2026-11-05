import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Optional separate build dir (e.g. NEXT_DIST_DIR=.next/mkt) so parallel dev servers and builds don't clash.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // three / r3f ship ESM that Next handles natively; transpile drei helpers for safety.
  transpilePackages: ["three"],
  experimental: {
    optimizePackageImports: ["lucide-react", "@react-three/drei"],
  },
};

export default nextConfig;
