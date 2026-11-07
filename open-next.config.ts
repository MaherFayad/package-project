import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

/**
 * OpenNext adapter for Cloudflare Workers (docs/DEPLOY-CLOUDFLARE.md).
 * ISR / `revalidate` pages (catalogue, marketing, prices hourly) keep their cache in R2
 * (binding NEXT_INC_CACHE_R2_BUCKET in wrangler.jsonc).
 */
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
