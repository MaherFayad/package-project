import { describe, expect, it } from "vitest";
import type { VendorListItem } from "../vendor-filters";
import { activeFilterCount, filterVendors, filtersToQuery, parseVendorFilters, vendorQualityScore } from "../vendor-filters";

function vendor(p: Partial<VendorListItem> & { slug: string }): VendorListItem {
  return {
    id: p.slug,
    name: { ar: p.slug, en: p.slug },
    city: "CAIRO",
    cityName: { ar: "", en: "" },
    bio: { ar: "", en: "" },
    logoUrl: null,
    coverUrl: null,
    rating: 4,
    ratingCount: 10,
    onTimePct: 90,
    leadTimeDays: 7,
    minOrderQty: 100,
    verified: true,
    foodSafe: false,
    certifications: [],
    ...p,
    capabilities: {
      structures: ["FEFCO_0427"],
      materials: ["E_FLUTE_KRAFT"],
      finishes: ["NONE"],
      maxColors: 4,
      digitalShortRun: false,
      monthlyCapacityUnits: 1000,
      ...p.capabilities,
    },
  };
}

const list = [
  vendor({ slug: "a", city: "SIXTH_OF_OCTOBER", rating: 4.7, leadTimeDays: 6, onTimePct: 96, capabilities: { structures: ["FEFCO_0427", "PIZZA"], finishes: ["MATTE_LAMINATION"], digitalShortRun: true } as VendorListItem["capabilities"] }),
  vendor({ slug: "b", city: "ALEXANDRIA", rating: 4.2, leadTimeDays: 9, onTimePct: 88, foodSafe: true, capabilities: { structures: ["ECMA_RTE"], finishes: ["SPOT_UV"] } as VendorListItem["capabilities"] }),
  vendor({ slug: "c", city: "OBOUR", rating: 4.9, leadTimeDays: 12, onTimePct: 80, capabilities: { structures: ["FEFCO_0201", "FEFCO_0427"] } as VendorListItem["capabilities"] }),
];

describe("parseVendorFilters", () => {
  it("parses valid params and drops invalid ones", () => {
    expect(parseVendorFilters({ city: "ALEXANDRIA", structure: "PIZZA", finish: "SPOT_UV", foodSafe: "1", digital: "on", maxLead: "7", sort: "rating" })).toEqual({
      city: "ALEXANDRIA",
      structure: "PIZZA",
      finish: "SPOT_UV",
      foodSafe: true,
      digital: true,
      maxLead: 7,
      sort: "rating",
    });
    expect(parseVendorFilters({ city: "<script>", structure: "BOX", finish: "NONE", maxLead: "3", sort: "price", foodSafe: "yes" })).toEqual({ sort: "recommended" });
    expect(parseVendorFilters({ city: ["CAIRO", "GIZA"] })).toEqual({ city: "CAIRO", sort: "recommended" });
  });

  it("round-trips through the query string", () => {
    const f = parseVendorFilters({ city: "OBOUR", maxLead: "14", sort: "onTime", digital: "1" });
    expect(parseVendorFilters(Object.fromEntries(new URLSearchParams(filtersToQuery(f))))).toEqual(f);
    expect(activeFilterCount(f)).toBe(3);
    expect(filtersToQuery({ sort: "recommended" })).toBe("");
  });
});

describe("filterVendors", () => {
  it("filters by city, capability, finish, digital, food safety and lead time", () => {
    const slugs = (f: Parameters<typeof filterVendors>[1]) => filterVendors(list, f).map((v) => v.slug);
    expect(slugs({ sort: "recommended", city: "ALEXANDRIA" })).toEqual(["b"]);
    expect(slugs({ sort: "rating", structure: "FEFCO_0427" })).toEqual(["c", "a"]);
    expect(slugs({ sort: "recommended", finish: "SPOT_UV" })).toEqual(["b"]);
    expect(slugs({ sort: "recommended", digital: true })).toEqual(["a"]);
    expect(slugs({ sort: "recommended", foodSafe: true })).toEqual(["b"]);
    expect(slugs({ sort: "leadTime", maxLead: 10 })).toEqual(["a", "b"]);
    expect(slugs({ sort: "recommended", foodSafe: true, digital: true })).toEqual([]);
  });

  it("sorts and never mutates the input", () => {
    const before = list.map((v) => v.slug);
    expect(filterVendors(list, { sort: "onTime" }).map((v) => v.slug)).toEqual(["a", "b", "c"]);
    expect(list.map((v) => v.slug)).toEqual(before);
  });

  it("scores quality in 0..1 and prefers verified, punctual vendors", () => {
    const good = vendorQualityScore({ rating: 5, onTimePct: 100, leadTimeDays: 1, verified: true });
    const bad = vendorQualityScore({ rating: 1, onTimePct: 40, leadTimeDays: 30, verified: false });
    expect(good).toBeLessThanOrEqual(1);
    expect(bad).toBeGreaterThanOrEqual(0);
    expect(good).toBeGreaterThan(bad);
  });
});
