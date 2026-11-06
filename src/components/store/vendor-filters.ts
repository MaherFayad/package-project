/**
 * Vendor directory filters (owner: storefront). Pure: parses untrusted search params with zod
 * (invalid values are dropped, never thrown) and filters/sorts a vendor list.
 */
import { z } from "zod";
import type { EgyptCity, FinishCode, LocalizedText, StructureCode, VendorCapabilities, VendorCertification } from "@/types";
import { EGYPT_CITIES, STRUCTURE_CODES } from "@/types";

export const FILTER_FINISHES = ["MATTE_LAMINATION", "GLOSS_LAMINATION", "SPOT_UV"] as const satisfies readonly FinishCode[];
export const LEAD_TIME_OPTIONS = [5, 7, 10, 14] as const;
export const VENDOR_SORTS = ["recommended", "rating", "leadTime", "onTime"] as const;
export type VendorSort = (typeof VENDOR_SORTS)[number];

export interface VendorFilters {
  city?: EgyptCity;
  structure?: StructureCode;
  finish?: (typeof FILTER_FINISHES)[number];
  digital?: boolean;
  foodSafe?: boolean;
  /** Typical lead time at most this many days. */
  maxLead?: number;
  sort: VendorSort;
}

/** Minimal vendor shape the directory needs (serialisable). */
export interface VendorListItem {
  id: string;
  slug: string;
  name: LocalizedText;
  city: EgyptCity;
  cityName: LocalizedText;
  bio: LocalizedText;
  logoUrl: string | null;
  coverUrl: string | null;
  rating: number;
  ratingCount: number;
  onTimePct: number;
  /** R5-JR-05 (admin round 8): false = under the minimum deliveries, show "New on Elba". */
  onTimeShown?: boolean;
  leadTimeDays: number;
  minOrderQty: number;
  verified: boolean;
  foodSafe: boolean;
  capabilities: VendorCapabilities;
  certifications: VendorCertification[];
}

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const flag = z.enum(["1", "true", "on"]).transform(() => true);

const fields = {
  city: z.enum(EGYPT_CITIES),
  structure: z.enum(STRUCTURE_CODES),
  finish: z.enum(FILTER_FINISHES),
  digital: flag,
  foodSafe: flag,
  maxLead: z.coerce.number().int().refine((n) => (LEAD_TIME_OPTIONS as readonly number[]).includes(n)),
  sort: z.enum(VENDOR_SORTS),
};

/** Parse URL search params. Unknown or invalid values are ignored. */
export function parseVendorFilters(raw: Raw): VendorFilters {
  const out: VendorFilters = { sort: "recommended" };
  for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
    const v = first(raw[key]);
    if (v === undefined || v === "") continue;
    const r = fields[key].safeParse(v);
    if (r.success) (out as unknown as Record<string, unknown>)[key] = r.data;
  }
  return out;
}

/** Back to a query string (only set filters), for links such as "clear one filter". */
export function filtersToQuery(f: VendorFilters): string {
  const q = new URLSearchParams();
  if (f.city) q.set("city", f.city);
  if (f.structure) q.set("structure", f.structure);
  if (f.finish) q.set("finish", f.finish);
  if (f.digital) q.set("digital", "1");
  if (f.foodSafe) q.set("foodSafe", "1");
  if (f.maxLead) q.set("maxLead", String(f.maxLead));
  if (f.sort !== "recommended") q.set("sort", f.sort);
  return q.toString();
}

export function activeFilterCount(f: VendorFilters): number {
  return [f.city, f.structure, f.finish, f.digital, f.foodSafe, f.maxLead].filter(Boolean).length;
}

/** Same blend the pricing engine uses for "best match" quality: rating + on-time. */
export function vendorQualityScore(v: Pick<VendorListItem, "rating" | "onTimePct" | "leadTimeDays" | "verified">): number {
  const rating = Math.max(0, Math.min(5, v.rating)) / 5;
  const onTime = Math.max(0, Math.min(100, v.onTimePct)) / 100;
  const speed = 1 - Math.min(Math.max(v.leadTimeDays, 1), 21) / 21;
  return rating * 0.4 + onTime * 0.35 + speed * 0.15 + (v.verified ? 0.1 : 0);
}

export function filterVendors<T extends VendorListItem>(vendors: T[], f: VendorFilters): T[] {
  const list = vendors.filter((v) => {
    if (f.city && v.city !== f.city) return false;
    if (f.structure && !v.capabilities.structures.includes(f.structure)) return false;
    if (f.finish && !v.capabilities.finishes.includes(f.finish)) return false;
    if (f.digital && !v.capabilities.digitalShortRun) return false;
    if (f.foodSafe && !v.foodSafe) return false;
    if (f.maxLead && v.leadTimeDays > f.maxLead) return false;
    return true;
  });
  const by: Record<VendorSort, (a: T, b: T) => number> = {
    recommended: (a, b) => vendorQualityScore(b) - vendorQualityScore(a),
    rating: (a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount,
    leadTime: (a, b) => a.leadTimeDays - b.leadTimeDays || b.rating - a.rating,
    onTime: (a, b) => b.onTimePct - a.onTimePct || b.rating - a.rating,
  };
  return [...list].sort((a, b) => by[f.sort](a, b) || a.slug.localeCompare(b.slug));
}
