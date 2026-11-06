import type { LocalizedText } from "@/types";
import { AVAILABILITY } from "@/data/packaging-availability/data";

/** Catalogue families in browse order (availability family slugs). */
export const CATALOGUE_FAMILIES = [
  "corrugated",
  "folding-carton",
  "rigid-box",
  "paper-tube",
  "food-service",
  "flexible",
  "glass",
  "rigid-plastic",
  "cosmetic-pharma",
  "metal",
  "envelope-mailer",
  "pallet-box",
  "labels",
] as const;
export type CatalogueFamily = (typeof CATALOGUE_FAMILIES)[number];

const FALLBACK: LocalizedText = { ar: "أخرى", en: "Other" };

export function familyName(slug: string): LocalizedText {
  return AVAILABILITY[slug]?.name ?? FALLBACK;
}

export function subFamilyName(slug: string): LocalizedText {
  return AVAILABILITY[slug]?.name ?? familyName(slug.split("/")[0]);
}

/** Plain, serialisable taxonomy for the browser (names only). */
export interface TaxonomyNode {
  slug: string;
  name: LocalizedText;
  children: { slug: string; name: LocalizedText }[];
}

export function taxonomy(subFamiliesInUse: Iterable<string>): TaxonomyNode[] {
  const used = new Set(subFamiliesInUse);
  return CATALOGUE_FAMILIES.map((f) => ({
    slug: f,
    name: familyName(f),
    children: [...used]
      .filter((s) => s.split("/")[0] === f && s.includes("/"))
      .sort()
      .map((s) => ({ slug: s, name: subFamilyName(s) })),
  })).filter((n) => n.children.length > 0 || used.has(n.slug));
}
