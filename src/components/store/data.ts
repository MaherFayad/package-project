import "server-only";
import { stripContactDetails } from "@/components/vendor/lib/contact";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import type {
  Dims,
  DimsPreset,
  EgyptCity,
  MaterialCode,
  Piasters,
  StructureCode,
  StructureFamily,
  StructureParamLimits,
  VendorCapabilities,
  VendorCertification,
  VendorMachine,
  LocalizedText,
} from "@/types";
import { db } from "@/lib/db";
import { fromJson } from "@/lib/json";
import { defaultMaterialFor, materialFitsStructure } from "@/lib/dieline";
import { headlineInput, priceTable, toPublicOffer, type PricingData, type VendorOffer } from "@/lib/pricing";
import { loadPricingData } from "@/lib/pricing/server";
import { loadPricingConfig } from "@/components/admin/server/settings";
import type { VendorListItem } from "./vendor-filters";

/** Storefront read models (owner: storefront). All DB access for public pages goes through here. */

/**
 * Catalogue reads are shared across requests (PERF-20): structures, materials, vendors, rate cards
 * and pricing settings change only when an admin or a vendor edits them. Each loader is cached in
 * the Next data cache under the `catalog` tag for at most CATALOG_TTL_S, and the edits already
 * purge it: every catalogue mutation calls `revalidatePath("/[locale]", "layout")` (admin and
 * vendor actions, vendor uploads), which expires these entries through their implicit route tags;
 * `revalidateTag(CATALOG_TAG)` does the same explicitly. `react.cache` on top dedupes within one
 * render. Only JSON-safe values are cached (no Dates). Display only: checkout and orders re-price
 * from the database (src/lib/orders/service.ts), never from this cache.
 */
export const CATALOG_TAG = "catalog";
const CATALOG_TTL_S = 300;
function catalogCached<A extends unknown[], R>(key: string, fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  const shared = unstable_cache(fn, ["store", key], { tags: [CATALOG_TAG], revalidate: CATALOG_TTL_S });
  // `next build` must read the database as it is: the data cache lives in .next/cache and outlives
  // the server that wrote it, so a build could otherwise bake an entry from an earlier run (a
  // vendor suspended then, a since-reseeded database) into the static pages.
  return cache((...args: A) => (process.env.NEXT_PHASE === "phase-production-build" ? fn(...args) : shared(...args)));
}

export interface MaterialView {
  code: MaterialCode;
  family: StructureFamily;
  name: LocalizedText;
  gsm: number;
  thicknessMm: number;
  foodSafe: boolean;
}

export interface StructureView {
  code: StructureCode;
  slug: string;
  family: StructureFamily;
  name: LocalizedText;
  description: LocalizedText;
  params: StructureParamLimits;
  defaultDims: Dims;
  presets: DimsPreset[];
}

export const listMaterials = catalogCached("materials", async (): Promise<MaterialView[]> => {
  const rows = await db.material.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { code: true, family: true, nameAr: true, nameEn: true, gsm: true, thicknessMm: true, foodSafe: true },
  });
  return rows.map((m) => ({
    code: m.code as MaterialCode,
    family: m.family as StructureFamily,
    name: { ar: m.nameAr, en: m.nameEn },
    gsm: m.gsm,
    thicknessMm: m.thicknessMm,
    foodSafe: m.foodSafe,
  }));
});

export const listStructures = catalogCached("structures", async (): Promise<StructureView[]> => {
  const rows = await db.structure.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { code: true, slug: true, family: true, nameAr: true, nameEn: true, descriptionAr: true, descriptionEn: true, params: true, defaultDims: true, presets: true },
  });
  return rows.map((s) => ({
    code: s.code as StructureCode,
    slug: s.slug,
    family: s.family as StructureFamily,
    name: { ar: s.nameAr, en: s.nameEn },
    description: { ar: s.descriptionAr, en: s.descriptionEn },
    params: fromJson<StructureParamLimits>(s.params),
    defaultDims: fromJson<Dims>(s.defaultDims),
    presets: fromJson<DimsPreset[]>(s.presets) ?? [],
  }));
});

export async function getStructureBySlug(slug: string): Promise<StructureView | null> {
  return (await listStructures()).find((s) => s.slug === slug) ?? null;
}

export function materialsFor(code: StructureCode, materials: MaterialView[]): MaterialView[] {
  return materials.filter((m) => materialFitsStructure(m.code, code));
}

/** The vendor columns the storefront shows (no payout details, contact data or internal notes). */
const VENDOR_LIST_SELECT = {
  id: true,
  slug: true,
  nameAr: true,
  nameEn: true,
  city: true,
  cityAr: true,
  cityEn: true,
  bioAr: true,
  bioEn: true,
  logoUrl: true,
  coverUrl: true,
  rating: true,
  ratingCount: true,
  onTimePct: true,
  leadTimeDays: true,
  minOrderQty: true,
  verified: true,
  foodSafe: true,
  capabilities: true,
  certifications: true,
} as const;
type VendorListRow = { [K in keyof typeof VENDOR_LIST_SELECT]: Awaited<ReturnType<typeof db.vendor.findFirstOrThrow>>[K] };

function toListItem(v: VendorListRow): VendorListItem {
  return {
    id: v.id,
    slug: v.slug,
    name: { ar: v.nameAr, en: v.nameEn },
    city: v.city as EgyptCity,
    cityName: { ar: v.cityAr, en: v.cityEn },
    // B-08: never publish contact details, even in text saved before the vendor-side filter existed.
    bio: { ar: stripContactDetails(v.bioAr), en: stripContactDetails(v.bioEn) },
    logoUrl: v.logoUrl,
    coverUrl: v.coverUrl,
    rating: v.rating,
    ratingCount: v.ratingCount,
    onTimePct: v.onTimePct,
    leadTimeDays: v.leadTimeDays,
    minOrderQty: v.minOrderQty,
    verified: v.verified,
    foodSafe: v.foodSafe,
    capabilities: fromJson<VendorCapabilities>(v.capabilities),
    certifications: fromJson<VendorCertification[]>(v.certifications) ?? [],
  };
}

/** Active vendors only (pending/suspended vendors are never listed publicly). */
export const listVendors = catalogCached("vendors", async (): Promise<VendorListItem[]> => {
  const rows = await db.vendor.findMany({ where: { status: "ACTIVE" }, orderBy: { rating: "desc" }, select: VENDOR_LIST_SELECT });
  return rows.map(toListItem);
});

export interface VendorProfile extends VendorListItem {
  machines: VendorMachine[];
  serviceAreas: EgyptCity[];
  joinedAt: string;
  portfolio: { id: string; imageUrl: string; caption: LocalizedText; structureCode: StructureCode | null }[];
  reviews: { id: string; rating: number; body: string | null; author: string; createdAt: string }[];
}

/** First name only: reviewers are private individuals (PDPL data minimisation). */
export function reviewerDisplayName(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first.slice(0, 24);
}

export const getVendorBySlug = catalogCached("vendor-by-slug", async (slug: string): Promise<VendorProfile | null> => {
  const v = await db.vendor.findFirst({
    where: { slug, status: "ACTIVE" },
    select: {
      ...VENDOR_LIST_SELECT,
      machines: true,
      serviceAreas: true,
      joinedAt: true,
      // B-08: only photos Elba has reviewed are public.
      portfolio: { where: { status: "APPROVED" }, orderBy: { sortOrder: "asc" }, select: { id: true, imageUrl: true, captionAr: true, captionEn: true, structureCode: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, rating: true, body: true, createdAt: true, author: { select: { name: true } } },
      },
    },
  });
  if (!v) return null;
  return {
    ...toListItem(v),
    machines: fromJson<VendorMachine[]>(v.machines) ?? [],
    serviceAreas: fromJson<EgyptCity[]>(v.serviceAreas) ?? [],
    joinedAt: v.joinedAt.toISOString(),
    portfolio: v.portfolio.map((p) => ({
      id: p.id,
      imageUrl: p.imageUrl,
      caption: { ar: stripContactDetails(p.captionAr), en: stripContactDetails(p.captionEn) },
      structureCode: (p.structureCode as StructureCode | null) ?? null,
    })),
    reviews: v.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      author: reviewerDisplayName(r.author.name),
      createdAt: r.createdAt.toISOString(),
    })),
  };
});

// ───────────────────────────── "From" prices ─────────────────────────────

export interface PriceFromRow {
  quantity: number;
  /** All-in per box ex-VAT (setup, die if any, delivery to Greater Cairo). */
  unitPiasters: Piasters;
  /** Total ex-VAT. */
  subtotalPiasters: Piasters;
  deliveryDays: number;
}

export interface PriceFrom {
  material: MaterialCode;
  rows: PriceFromRow[];
  validUntil: string | null;
  vendorCount: number;
}

const pricingData = catalogCached("pricing-data", async (): Promise<PricingData> => loadPricingData());
const pricingConfig = catalogCached("pricing-config", () => loadPricingConfig());

/**
 * Public prices for the catalogue, from the ONE journey price source (B-26,
 * `@/lib/pricing/headline`): headline defaults (full colour, outside print, no finish, default
 * board, Greater Cairo) and the best-match offer per quantity tier, which is the vendor checkout
 * pre-selects. The designer badge and checkout use the same rule, so a 500-box mailer shows one
 * price and one lead time from landing to payment. (Was: 1 colour here, the cheapest offer in
 * the designer, best match in checkout: three different numbers.)
 * Only public numbers leave this function (vendor buy price and margin are stripped).
 * The buyer's exact instant price stays behind the free account in the designer (G2 gate).
 */
export async function getPriceFrom(code: StructureCode, dims: Dims, material?: MaterialCode): Promise<PriceFrom> {
  const mat = material && materialFitsStructure(material, code) ? material : defaultMaterialFor(code);
  try {
    const data = await pricingData();
    const table = priceTable(
      headlineInput(code, dims, mat),
      data,
      { config: await pricingConfig() },
    );
    const rows: PriceFromRow[] = [];
    let validUntil: string | null = null;
    for (const r of table) {
      if (!r.best) continue;
      const o = toPublicOffer(r.best as VendorOffer);
      validUntil = validUntil ?? o.validUntil;
      rows.push({ quantity: r.quantity, unitPiasters: o.unitPiasters, subtotalPiasters: o.subtotalPiasters, deliveryDays: o.deliveryDays });
    }
    const vendorCount = data.vendors.filter((v) => v.status === "ACTIVE" && v.capabilities.structures.includes(code)).length;
    return { material: mat, rows, validUntil, vendorCount };
  } catch {
    // Invalid size for pricing or engine error: the page still renders, without prices.
    return { material: mat, rows: [], validUntil: null, vendorCount: 0 };
  }
}

/** Cheapest per-box price at the largest instant tier (for catalogue cards). */
export async function getLowestUnit(code: StructureCode, dims: Dims): Promise<Piasters | null> {
  const p = await getPriceFrom(code, dims);
  if (!p.rows.length) return null;
  return Math.min(...p.rows.map((r) => r.unitPiasters));
}
