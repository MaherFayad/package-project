import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

/** robots.txt (owner: storefront). Private areas and APIs are disallowed; the sitemap is advertised. */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl().replace(/\/$/, "");
  const privatePaths = ["/api/", "/*/account", "/*/orders", "/*/checkout", "/*/vendor$", "/*/vendor/", "/*/admin", "/*/login", "/*/dev/"];
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: privatePaths }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
