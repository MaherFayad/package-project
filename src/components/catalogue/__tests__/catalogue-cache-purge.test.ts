import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
const loadVendorsForMatch = vi.fn(async () => [] as unknown[]);
vi.mock("@/lib/configurator/server", () => ({ loadVendorsForMatch: () => loadVendorsForMatch() }));

describe("getCatalogueData per-process memo (R7 fix: purge clears it)", () => {
  beforeEach(() => {
    vi.resetModules();
    loadVendorsForMatch.mockClear();
  });

  it("serves the memo inside the TTL, and rebuilds right after purgeCatalogCache()", async () => {
    const { getCatalogueData } = await import("@/components/catalogue/server");
    const { purgeCatalogCache } = await import("@/lib/catalog-cache");
    const a = await getCatalogueData();
    expect(await getCatalogueData()).toBe(a);
    expect(loadVendorsForMatch).toHaveBeenCalledTimes(1);
    purgeCatalogCache();
    const b = await getCatalogueData();
    expect(b).not.toBe(a);
    expect(loadVendorsForMatch).toHaveBeenCalledTimes(2);
  });

  it("still expires the Next tag and the layout path", async () => {
    const cache = await import("next/cache");
    const { purgeCatalogCache, CATALOG_CACHE_TAG } = await import("@/lib/catalog-cache");
    purgeCatalogCache();
    expect(cache.revalidateTag).toHaveBeenCalledWith(CATALOG_CACHE_TAG);
    expect(cache.revalidatePath).toHaveBeenCalledWith("/[locale]", "layout");
  });
});
