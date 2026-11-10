import { AVAILABILITY } from "@/data/packaging-availability/data";
import { REGIONS, type Region } from "@/data/packaging-availability/types";
import { availabilityForSlug } from "@/data/packaging-availability/mapping";
import { MODELS } from "@/lib/library";
import * as F02 from "@/lib/dieline/families/fefco-02";
import * as F0305 from "@/lib/dieline/families/fefco-03-05";
import * as F04 from "@/lib/dieline/families/fefco-04";
import * as F0607 from "@/lib/dieline/families/fefco-06-07";
import * as F09 from "@/lib/dieline/families/fefco-09";
import * as TUCK from "@/lib/dieline/families/ecma-tuck";
import * as SPEC from "@/lib/dieline/families/ecma-specials";
import * as FOOD from "@/lib/dieline/families/foodservice";
import * as RT from "@/lib/dieline/families/rigid-tubes";
import * as BAGS from "@/lib/dieline/families/bags";
import * as BTL from "@/lib/vessels/families/bottles";
import * as COS from "@/lib/vessels/families/cosmetic-cans";
import * as FLEX from "@/lib/vessels/families/flexible";
import { availabilitySlugFor, standardOf } from "./mapping";
import { CATALOGUE_FAMILIES, familyName, subFamilyName } from "./taxonomy";
import type { AxisKey, CatalogueCard, CatalogueEntry, CataloguePresetRow, CatalogueRender } from "./types";

export * from "./types";
export * from "./taxonomy";
export { availabilitySlugFor, standardOf } from "./mapping";

/* ───────────────────────────── family definitions ───────────────────────────── */

interface FamilyDefLike {
  code: string;
  slug: string;
  name: { ar: string; en: string };
  description: { ar: string; en: string };
  subFamily?: unknown;
  standard?: string | null;
  kind?: string;
}

/** Every family folder's DEFINITIONS with the library source name it is filed under. */
const FAMILY_SOURCES: [string, readonly FamilyDefLike[]][] = [
  ["fefco-02", F02.DEFINITIONS as unknown as FamilyDefLike[]],
  ["fefco-03-05", F0305.DEFINITIONS as unknown as FamilyDefLike[]],
  ["fefco-04", F04.DEFINITIONS as unknown as FamilyDefLike[]],
  ["fefco-06-07", F0607.DEFINITIONS as unknown as FamilyDefLike[]],
  ["fefco-09", F09.DEFINITIONS as unknown as FamilyDefLike[]],
  ["ecma-tuck", TUCK.DEFINITIONS as unknown as FamilyDefLike[]],
  ["ecma-specials", SPEC.DEFINITIONS as unknown as FamilyDefLike[]],
  ["foodservice", FOOD.DEFINITIONS as unknown as FamilyDefLike[]],
  ["rigid-tubes", RT.DEFINITIONS as unknown as FamilyDefLike[]],
  ["bags", BAGS.DEFINITIONS as unknown as FamilyDefLike[]],
  ["vessel-bottles", BTL.DEFINITIONS as unknown as FamilyDefLike[]],
  ["vessel-cosmetic", COS.DEFINITIONS as unknown as FamilyDefLike[]],
  ["vessel-flexible", FLEX.DEFINITIONS as unknown as FamilyDefLike[]],
];

const styleOf = (d: FamilyDefLike | undefined): string =>
  !d ? "" : typeof d.subFamily === "string" ? d.subFamily : ((d.subFamily as { code?: string } | undefined)?.code ?? "");

/** code -> [source, definition] over all family folders (first wins). */
const FAMILY_DEF = new Map<string, [string, FamilyDefLike]>();
for (const [source, list] of FAMILY_SOURCES) for (const d of list) if (!FAMILY_DEF.has(d.code)) FAMILY_DEF.set(d.code, [source, d]);

/* ───────────────────────────── helpers ───────────────────────────── */

function regionsOf(slug: string): Region[] {
  const e = availabilityForSlug(slug);
  if (!e?.regions) return [...REGIONS];
  return REGIONS.filter((r) => e.regions[r] && e.regions[r].level !== "niche");
}

/** Codes, names and standard (no family names: cards add those from the taxonomy). */
function ownSearchText(e: Omit<CatalogueEntry, "search">): string {
  return [
    e.code,
    e.code.replace(/[_-]/g, " "),
    e.name.en,
    e.name.ar,
    e.standard.label,
    e.standard.code ? `${e.standard.system} ${e.standard.code}` : null,
    e.standard.code?.replace(/\./g, " "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function searchText(e: Omit<CatalogueEntry, "search">): string {
  const parts = [
    e.code,
    e.code.replace(/[_-]/g, " "),
    e.slug,
    e.name.en,
    e.name.ar,
    e.standard.label,
    e.standard.code,
    e.standard.code ? `${e.standard.system} ${e.standard.code}` : null,
    e.standard.code?.replace(/\./g, " "),
    familyName(e.family).en,
    familyName(e.family).ar,
    subFamilyName(e.subFamily).en,
    subFamilyName(e.subFamily).ar,
    e.style.replace(/[_-]/g, " "),
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function entry(base: Omit<CatalogueEntry, "family" | "subFamily" | "availableInEgypt" | "regions" | "search" | "standard"> & { standardRef: string | null | undefined }): CatalogueEntry {
  const subFamily = availabilitySlugFor(base.source, base.code, base.style);
  const avail = availabilityForSlug(subFamily);
  const { standardRef, ...rest } = base;
  const e = {
    ...rest,
    family: subFamily.split("/")[0],
    subFamily,
    standard: standardOf(base.code, standardRef),
    availableInEgypt: avail?.egypt ?? "imported",
    regions: regionsOf(subFamily),
  };
  return { ...e, search: searchText(e) };
}

const pickDims = (o: object, keys: AxisKey[]) => Object.fromEntries(keys.filter((k) => typeof (o as Record<string, unknown>)[k] === "number").map((k) => [k, (o as Record<string, number>)[k]])) as Partial<Record<AxisKey, number>>;

/* ───────────────────────────── library models (designer-ready) ───────────────────────────── */

const LIBRARY_ENTRIES: CatalogueEntry[] = MODELS.map((m) => {
  const fam = FAMILY_DEF.get(m.code);
  // A family definition filed under another source (FEFCO_0201 in fefco-02) keeps the library's.
  const style = m.source === "core" || m.source === "vessel-core" ? "" : styleOf(fam?.[1]);
  if (m.kind === "box") {
    const axes: AxisKey[] = m.shape === "cylinder" ? ["D", "H"] : ["L", "W", "H"];
    const dimsOf = (d: { L: number; W: number; H: number }) => (m.shape === "cylinder" ? { D: d.L, H: d.H } : { L: d.L, W: d.W, H: d.H });
    return entry({
      code: m.code,
      slug: m.slug,
      name: m.name,
      description: m.description,
      source: m.source,
      render: "box",
      style,
      standardRef: m.standard,
      designer: true,
      quoteOnly: false,
      axes,
      defaultDims: dimsOf(m.defaultDims),
      presets: m.presets.map((p) => ({ id: p.id, name: p.name, dims: dimsOf(p.dims) })),
    });
  }
  const axes: AxisKey[] = m.limits.G ? ["D", "H", "G"] : ["D", "H"];
  const def = m.presets.find((p) => p.id === m.defaultPresetId) ?? m.presets[0];
  return entry({
    code: m.code,
    slug: m.slug,
    name: m.name,
    description: m.description,
    source: m.source,
    render: "vessel",
    style: m.source === "vessel-core" ? m.coreKind : style,
    standardRef: m.standard,
    designer: true,
    quoteOnly: false,
    axes,
    defaultDims: pickDims(def?.dims ?? {}, axes),
    presets: m.presets.map((p) => ({ id: p.id, name: p.name, dims: pickDims(p.dims, axes), ...(p.capacityMl ? { capacityMl: p.capacityMl } : {}) })),
  });
});

/* ───────────────────────────── family models outside the library ───────────────────────────── */

const IN_LIBRARY = new Set(MODELS.map((m) => m.code));

function extraEntry(source: string, d: FamilyDefLike): CatalogueEntry | null {
  if (IN_LIBRARY.has(d.code)) return null;
  const any = d as unknown as Record<string, unknown>;
  let render: CatalogueRender = "dieline";
  let axes: AxisKey[] = ["L", "W", "H"];
  let defaults: object = (any.defaultDims ?? any.defaultHost ?? {}) as object;
  let presets: CataloguePresetRow[] = [];
  const rawPresets = (any.presets ?? []) as { id: string; name: { ar: string; en: string }; dims: object; capacityMl?: number }[];
  if (source === "fefco-09") render = "fitting";
  if (source === "foodservice") {
    if (d.kind === "frustum") {
      render = "cup";
      axes = ["topD", "bottomD", "H"];
    } else if (d.kind === "lathe") {
      render = "lid";
      axes = ["rimD", "H"];
    } else if (d.kind === "molded") render = "pulp";
  }
  if (source === "vessel-cosmetic") {
    render = "blister";
    axes = ["D", "H", "G"];
    const def = rawPresets.find((p) => p.id === any.defaultPresetId) ?? rawPresets[0];
    defaults = def?.dims ?? {};
  }
  presets = rawPresets.map((p) => ({ id: p.id, name: p.name, dims: pickDims(p.dims, axes), ...(p.capacityMl ? { capacityMl: p.capacityMl } : {}) }));
  return entry({
    code: d.code,
    slug: d.slug,
    name: d.name,
    description: d.description,
    source,
    render,
    style: styleOf(d),
    standardRef: d.standard,
    designer: false,
    // No seeded printer prices these stocks yet (cupstock, moulded fibre, kraft paper, envelopes,
    // bulk triple wall, blister foil): always a request for a quote.
    quoteOnly: true,
    axes,
    defaultDims: pickDims(defaults, axes),
    presets,
  });
}

const EXTRA_ENTRIES: CatalogueEntry[] = FAMILY_SOURCES.flatMap(([source, list]) => list.map((d) => extraEntry(source, d))).filter((e): e is CatalogueEntry => !!e);

/* ───────────────────────────── catalogue ───────────────────────────── */

function uniqueSlugs(list: CatalogueEntry[]): CatalogueEntry[] {
  const seen = new Set<string>();
  return list.map((e) => {
    let slug = e.slug;
    if (seen.has(slug)) slug = `${slug}-${e.code.toLowerCase().replace(/_/g, "-")}`;
    seen.add(slug);
    return slug === e.slug ? e : { ...e, slug };
  });
}

const FAMILY_RANK = new Map<string, number>(CATALOGUE_FAMILIES.map((f, i) => [f, i]));

/** Every model, by family (catalogue order), then sub-family, then standard code / name. */
export const CATALOGUE: CatalogueEntry[] = uniqueSlugs([...LIBRARY_ENTRIES, ...EXTRA_ENTRIES]).sort(
  (a, b) =>
    (FAMILY_RANK.get(a.family) ?? 99) - (FAMILY_RANK.get(b.family) ?? 99) ||
    a.subFamily.localeCompare(b.subFamily) ||
    (a.standard.code ?? "~").localeCompare(b.standard.code ?? "~") ||
    a.name.en.localeCompare(b.name.en),
);

const BY_CODE = new Map(CATALOGUE.map((e) => [e.code, e]));
const BY_SLUG = new Map(CATALOGUE.map((e) => [e.slug, e]));

export function catalogueEntry(code: string): CatalogueEntry | null {
  return BY_CODE.get(code) ?? null;
}

/** Slug, or a code in any case. */
export function catalogueEntryFromParam(param: string): CatalogueEntry | null {
  const p = decodeURIComponent(param).trim();
  return BY_SLUG.get(p.toLowerCase()) ?? BY_CODE.get(p) ?? BY_CODE.get(p.toUpperCase()) ?? null;
}

/** Thumbnail rendered from the real 3D model by scripts/render-catalogue-thumbnails.ts. */
export function catalogueThumb(code: string): string {
  return `/models/${encodeURIComponent(code)}.webp`;
}

export function toCatalogueCard(e: CatalogueEntry, instantPrice: boolean): CatalogueCard {
  return {
    code: e.code,
    slug: e.slug,
    name: e.name,
    family: e.family,
    subFamily: e.subFamily,
    standard: e.standard,
    availableInEgypt: e.availableInEgypt,
    regions: e.regions,
    designer: e.designer,
    quoteOnly: e.quoteOnly,
    search: ownSearchText(e),
    render: e.render,
    instantPrice,
  };
}

/** Count of models per family / per Egypt availability (catalogue headers, docs). */
export function catalogueCounts(list: readonly Pick<CatalogueEntry, "family" | "availableInEgypt">[] = CATALOGUE) {
  const byFamily: Record<string, number> = {};
  const byEgypt: Record<string, number> = { local: 0, imported: 0, rare: 0 };
  for (const e of list) {
    byFamily[e.family] = (byFamily[e.family] ?? 0) + 1;
    byEgypt[e.availableInEgypt]++;
  }
  return { total: list.length, byFamily, byEgypt };
}

export { AVAILABILITY };
