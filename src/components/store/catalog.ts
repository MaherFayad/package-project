/**
 * Storefront catalogue helpers (owner: storefront). Pure and DB-free so they work in
 * generateStaticParams, sitemap.ts, client components and unit tests.
 */
import type { Dims, Locale, MaterialCode, StructureCode } from "@/types";
import { STRUCTURE_CODES } from "@/types";
import { DEFAULT_DIMS, STRUCTURE_LIMITS, STRUCTURES, validateDims } from "@/lib/dieline";

/** URL slug per structure. Mirrors Structure.slug in prisma/seed.ts (a test keeps them in sync). */
export const STRUCTURE_SLUGS: Record<StructureCode, string> = {
  FEFCO_0427: "mailer-box",
  FEFCO_0201: "shipping-box",
  ECMA_RTE: "reverse-tuck-end",
  ECMA_STE: "straight-tuck-end",
  PIZZA: "pizza-box",
  SLEEVE: "sleeve",
  FEFCO_0320: STRUCTURES.FEFCO_0320.slug,
  ECMA_CLB: STRUCTURES.ECMA_CLB.slug,
  ECMA_SLB: STRUCTURES.ECMA_SLB.slug,
  FEFCO_0422: STRUCTURES.FEFCO_0422.slug,
  GABLE_BOX: STRUCTURES.GABLE_BOX.slug,
  PAPER_TUBE: STRUCTURES.PAPER_TUBE.slug,
  RIGID_BOX: STRUCTURES.RIGID_BOX.slug,
};

export function structureFromSlug(slug: string): StructureCode | null {
  const hit = STRUCTURE_CODES.find((c) => STRUCTURE_SLUGS[c] === slug);
  return hit ?? null;
}

/** Local illustration per structure (generated SVGs under public/seed/structures). */
export function structureImage(code: StructureCode): string {
  return `/seed/structures/${STRUCTURE_SLUGS[code]}.svg`;
}

/**
 * Common sizes that get their own SEO landing page (/[locale]/boxes/[structure]/[size]).
 * Inner mm. Includes every catalogue preset plus popular e-commerce / food sizes.
 * Other valid sizes still render on demand (dynamicParams) but are not in the sitemap.
 */
export const SEO_SIZES: Record<StructureCode, Dims[]> = {
  FEFCO_0427: [
    { L: 180, W: 120, H: 50 },
    { L: 200, W: 150, H: 50 },
    { L: 250, W: 180, H: 80 },
    { L: 300, W: 220, H: 60 },
    { L: 330, W: 200, H: 120 },
    { L: 350, W: 250, H: 100 },
  ],
  FEFCO_0201: [
    { L: 200, W: 150, H: 100 },
    { L: 250, W: 250, H: 250 },
    { L: 300, W: 200, H: 150 },
    { L: 400, W: 300, H: 250 },
    { L: 600, W: 400, H: 400 },
  ],
  ECMA_RTE: [
    { L: 50, W: 50, H: 100 },
    { L: 55, W: 45, H: 130 },
    { L: 60, W: 60, H: 140 },
    { L: 65, W: 55, H: 160 },
  ],
  ECMA_STE: [
    { L: 90, W: 50, H: 150 },
    { L: 90, W: 60, H: 140 },
    { L: 95, W: 35, H: 65 },
    { L: 100, W: 70, H: 200 },
  ],
  PIZZA: [
    { L: 260, W: 260, H: 40 },
    { L: 310, W: 310, H: 40 },
    { L: 360, W: 360, H: 45 },
    { L: 410, W: 410, H: 45 },
  ],
  SLEEVE: [
    { L: 150, W: 100, H: 50 },
    { L: 220, W: 150, H: 60 },
    { L: 300, W: 200, H: 80 },
  ],
  // New structure-library styles: their catalogue presets.
  FEFCO_0320: STRUCTURES.FEFCO_0320.presets.map((p) => p.dims),
  ECMA_CLB: STRUCTURES.ECMA_CLB.presets.map((p) => p.dims),
  ECMA_SLB: STRUCTURES.ECMA_SLB.presets.map((p) => p.dims),
  FEFCO_0422: STRUCTURES.FEFCO_0422.presets.map((p) => p.dims),
  GABLE_BOX: STRUCTURES.GABLE_BOX.presets.map((p) => p.dims),
  PAPER_TUBE: STRUCTURES.PAPER_TUBE.presets.map((p) => p.dims),
  RIGID_BOX: STRUCTURES.RIGID_BOX.presets.map((p) => p.dims),
};

/** "300x200x150" (mm, ASCII x so the URL is stable). */
export function sizeSlug(d: Dims): string {
  return `${d.L}x${d.W}x${d.H}`;
}

/** Parse "300x200x150" (also accepts "300X200X150" and "300×200×150"). Whole mm only. */
export function parseSizeSlug(slug: string): Dims | null {
  const m = /^(\d{2,4})[x×X](\d{2,4})[x×X](\d{2,4})$/.exec(decodeURIComponent(slug).trim());
  if (!m) return null;
  return { L: Number(m[1]), W: Number(m[2]), H: Number(m[3]) };
}

/** Parse + validate a size slug against the structure's limits. */
export function parseValidSize(code: StructureCode, slug: string): Dims | null {
  const dims = parseSizeSlug(slug);
  if (!dims) return null;
  return validateDims(code, dims).ok ? dims : null;
}

/** All SEO (structure, size) pairs for generateStaticParams and the sitemap. */
export function seoSizeParams(): { structure: string; size: string; code: StructureCode; dims: Dims }[] {
  return STRUCTURE_CODES.flatMap((code) =>
    SEO_SIZES[code].map((dims) => ({ structure: STRUCTURE_SLUGS[code], size: sizeSlug(dims), code, dims })),
  );
}

/** Centimetres for SEO titles ("30×20×15 سم"), as Egyptian buyers search in cm. */
export function formatCm(d: Dims): string {
  const cm = (mm: number) => {
    const v = Math.round(mm) / 10;
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  };
  return `${cm(d.L)}×${cm(d.W)}×${cm(d.H)}`;
}

export interface DesignLinkOptions {
  structure?: StructureCode;
  dims?: Dims;
  material?: MaterialCode;
  /** Vendor slug: "Design a box with this printer". */
  vendor?: string;
  /** Saved design id: reopen it in the designer. */
  design?: string;
}

/**
 * Deep link into the free 3D designer. Contract for the designer owner:
 *   /{locale}/design?structure=FEFCO_0427&L=250&W=180&H=80&material=E_FLUTE_KRAFT&vendor=nile-pack
 *   /{locale}/design?design=<savedDesignId>
 * Every parameter is optional; the designer validates and falls back to defaults.
 */
export function designHref(locale: Locale, opts: DesignLinkOptions = {}): string {
  const q = new URLSearchParams();
  if (opts.design) q.set("design", opts.design);
  if (opts.structure) q.set("structure", opts.structure);
  if (opts.dims) {
    q.set("L", String(opts.dims.L));
    q.set("W", String(opts.dims.W));
    q.set("H", String(opts.dims.H));
  }
  if (opts.material) q.set("material", opts.material);
  if (opts.vendor) q.set("vendor", opts.vendor);
  const s = q.toString();
  return `/${locale}/design${s ? `?${s}` : ""}`;
}

export function structureHref(locale: Locale, code: StructureCode): string {
  return `/${locale}/boxes/${STRUCTURE_SLUGS[code]}`;
}

export function sizeHref(locale: Locale, code: StructureCode, dims: Dims): string {
  return `${structureHref(locale, code)}/${sizeSlug(dims)}`;
}

export { DEFAULT_DIMS, STRUCTURE_LIMITS };
