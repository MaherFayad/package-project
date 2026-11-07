import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Tag of the cross-request catalogue cache (src/components/store/data.ts `CATALOG_TAG`): structures,
 * materials, vendors, rate cards and the pricing config behind every public "from" price.
 */
export const CATALOG_CACHE_TAG = "catalog";

let purgedAt = 0;

/** Time of the last purge in this process (ms). An in-process memo built at or before it is stale. */
export function catalogPurgedAt(): number {
  return purgedAt;
}

/**
 * Expire the public catalogue right after an edit that changes a public price (admin margin, zones,
 * FX/board index; a vendor rate card). Without it, public pages kept the old price while checkout
 * already charged the new one (R4-04; one price on every surface, B-26).
 *
 * Both are needed: the tag expires the shared data cache (300 s TTL), and the path expires the
 * prerendered ISR pages (`/boxes/...`, `revalidate = 3600`). Those pages are built while the data
 * cache is bypassed (`next build`, see store/data.ts), so they do not carry the `catalog` tag and a
 * tag-only purge left them stale for up to an hour (measured live).
 * Outside a request (scripts, unit tests) there is nothing to purge, so errors are ignored.
 */
export function purgeCatalogCache(): void {
  // The per-process memo in getCatalogueData() (src/components/catalogue/server.ts) is not a Next
  // cache, so revalidateTag never reached it and badges lagged up to 5 minutes (R7 fix).
  purgedAt = Math.max(Date.now(), purgedAt + 1);
  try {
    revalidateTag(CATALOG_CACHE_TAG);
    revalidatePath("/[locale]", "layout");
  } catch {
    /* not in a request scope */
  }
}
