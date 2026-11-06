import { STRUCTURE_CODES, type Dims, type DimsPreset, type StructureCode } from "@/types";
import { DEFAULT_DIMS, STRUCTURES } from "@/lib/dieline";
import { modelByCode } from "@/lib/library";

/**
 * Static catalog facts the designer needs on the client (mirrors prisma/seed.ts). Server pages
 * read the Structure rows from the DB and fall back to this when the DB is empty.
 */
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
  ROLL_LABEL: STRUCTURES.ROLL_LABEL.slug,
  PRINTED_POUCH: STRUCTURES.PRINTED_POUCH.slug,
  PRINTED_TUBE: STRUCTURES.PRINTED_TUBE.slug,
};

/** Accepts a slug ("mailer-box") or a code in any case ("fefco_0427"). */
export function structureFromParam(param: string): StructureCode | null {
  const p = decodeURIComponent(param).trim();
  const bySlug = (Object.entries(STRUCTURE_SLUGS) as [StructureCode, string][]).find(([, s]) => s === p.toLowerCase());
  if (bySlug) return bySlug[0];
  const upper = p.toUpperCase().replace(/-/g, "_");
  return (STRUCTURE_CODES as readonly string[]).includes(upper) ? (upper as StructureCode) : null;
}

/** Editor URL for a core structure or ANY library model code (family style, container). */
export function designerPath(locale: string, code: StructureCode | string, query?: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v) q.set(k, v);
  const qs = q.toString();
  const slug = STRUCTURE_SLUGS[code as StructureCode] ?? modelByCode(code)?.slug ?? STRUCTURE_SLUGS.FEFCO_0427;
  return `/${locale}/design/${slug}${qs ? `?${qs}` : ""}`;
}

/** Catalog presets (copied from the seed; the DB copy wins when present). */
export const FALLBACK_PRESETS: Record<StructureCode, DimsPreset[]> = {
  FEFCO_0427: [
    { id: "accessories", name: { ar: "إكسسوارات", en: "Accessories" }, dims: { L: 180, W: 120, H: 50 }, standard: true },
    { id: "tshirt", name: { ar: "تيشيرت", en: "T-shirt" }, dims: { L: 300, W: 220, H: 60 }, standard: true },
    { id: "shoe", name: { ar: "حذاء", en: "Shoe box" }, dims: { L: 330, W: 200, H: 120 }, standard: true },
    { id: "cosmetics-kit", name: { ar: "طقم مستحضرات", en: "Cosmetics kit" }, dims: { L: 250, W: 180, H: 80 } },
  ],
  FEFCO_0201: [
    { id: "small", name: { ar: "صغيرة", en: "Small" }, dims: { L: 200, W: 150, H: 100 }, standard: true },
    { id: "medium", name: { ar: "متوسطة", en: "Medium" }, dims: { L: 300, W: 200, H: 150 }, standard: true },
    { id: "large", name: { ar: "كبيرة", en: "Large" }, dims: { L: 400, W: 300, H: 250 }, standard: true },
  ],
  ECMA_RTE: [
    { id: "perfume-50ml", name: { ar: "عطر 50 مل", en: "Perfume 50 ml" }, dims: { L: 55, W: 45, H: 130 }, standard: true },
    { id: "perfume-100ml", name: { ar: "عطر 100 مل", en: "Perfume 100 ml" }, dims: { L: 65, W: 55, H: 160 }, standard: true },
    { id: "cream-jar", name: { ar: "برطمان كريم", en: "Cream jar" }, dims: { L: 70, W: 70, H: 70 } },
  ],
  ECMA_STE: [
    { id: "tea", name: { ar: "علبة شاي", en: "Tea box" }, dims: { L: 90, W: 60, H: 140 }, standard: true },
    { id: "soap", name: { ar: "صابون", en: "Soap bar" }, dims: { L: 95, W: 35, H: 65 }, standard: true },
  ],
  PIZZA: [
    { id: "pizza-25", name: { ar: "بيتزا 25 سم", en: "Pizza 25 cm" }, dims: { L: 260, W: 260, H: 40 }, standard: true },
    { id: "pizza-30", name: { ar: "بيتزا 30 سم", en: "Pizza 30 cm" }, dims: { L: 310, W: 310, H: 40 }, standard: true },
    { id: "pizza-35", name: { ar: "بيتزا 35 سم", en: "Pizza 35 cm" }, dims: { L: 360, W: 360, H: 45 }, standard: true },
  ],
  SLEEVE: [
    { id: "dessert-tray", name: { ar: "علبة حلويات", en: "Dessert tray" }, dims: { L: 220, W: 150, H: 60 }, standard: true },
    { id: "meal-box", name: { ar: "علبة وجبة", en: "Meal box" }, dims: { L: 230, W: 160, H: 70 } },
  ],
  FEFCO_0320: STRUCTURES.FEFCO_0320.presets,
  ECMA_CLB: STRUCTURES.ECMA_CLB.presets,
  ECMA_SLB: STRUCTURES.ECMA_SLB.presets,
  FEFCO_0422: STRUCTURES.FEFCO_0422.presets,
  GABLE_BOX: STRUCTURES.GABLE_BOX.presets,
  PAPER_TUBE: STRUCTURES.PAPER_TUBE.presets,
  RIGID_BOX: STRUCTURES.RIGID_BOX.presets,
  ROLL_LABEL: STRUCTURES.ROLL_LABEL.presets,
  PRINTED_POUCH: STRUCTURES.PRINTED_POUCH.presets,
  PRINTED_TUBE: STRUCTURES.PRINTED_TUBE.presets,
};

/** Product shortcuts shown on the picker ("shoe box", "perfume 50 ml", ...). */
export const PRODUCT_PRESETS = [
  { key: "tshirt", structureCode: "FEFCO_0427", presetId: "tshirt" },
  { key: "shoe", structureCode: "FEFCO_0427", presetId: "shoe" },
  { key: "perfume50", structureCode: "ECMA_RTE", presetId: "perfume-50ml" },
  { key: "pizza30", structureCode: "PIZZA", presetId: "pizza-30" },
] as const satisfies readonly { key: string; structureCode: StructureCode; presetId: string }[];

export type ProductPresetKey = (typeof PRODUCT_PRESETS)[number]["key"];

/** Dims for a preset id, or the structure default. */
export function presetDims(code: StructureCode, presetId: string | null | undefined, presets = FALLBACK_PRESETS[code]): Dims {
  const p = presetId ? presets.find((x) => x.id === presetId) : undefined;
  return p ? { ...p.dims } : { ...DEFAULT_DIMS[code] };
}

/** The preset whose dims equal `dims` (±0.5 mm), if any. */
export function matchingPreset(code: StructureCode, dims: Dims, presets = FALLBACK_PRESETS[code]): DimsPreset | null {
  return (
    presets.find((p) => Math.abs(p.dims.L - dims.L) < 0.5 && Math.abs(p.dims.W - dims.W) < 0.5 && Math.abs(p.dims.H - dims.H) < 0.5) ??
    null
  );
}
