import type { Dims, DimsPreset, LocalizedText, MaterialCode, StructureCode, StructureFamily, StructureParamLimits } from "@/types";
import { MATERIAL_CODES } from "@/types";
import { BOARD_SPECS, type DielineModel, type FeatureSupport } from "@/lib/dieline";
import type { BoxModelDef, ModelGroup, ModelSource } from "../types";

/**
 * Shared box-model helpers for the per-family packs (PERF-04). No family generator is imported
 * here, so a pack only pulls its own family.
 */

export const NO_FEATURES: FeatureSupport = { windowFaces: [], thumbNotch: false, handle: false, tearStrip: false, partitions: false, lidHeight: false, displayFront: false };

const PRICED_MATERIALS = new Set<string>(MATERIAL_CODES);

/** Map a family's own board codes onto boards our rate cards price (same construction). */
const MATERIAL_ALIASES: Record<string, MaterialCode> = {
  GREYBOARD_1500_WRAP: "GREYBOARD_WRAP",
  GREYBOARD_2500_WRAP: "GREYBOARD_WRAP",
  WHITE_TUBE: "KRAFT_TUBE",
};

function pricedMaterials(list: readonly string[] | undefined, family: StructureFamily): MaterialCode[] {
  const out: MaterialCode[] = [];
  for (const raw of list ?? []) {
    const m = (PRICED_MATERIALS.has(raw) ? raw : MATERIAL_ALIASES[raw]) as MaterialCode | undefined;
    if (!m || out.includes(m)) continue;
    const fam = BOARD_SPECS[m].family;
    // Only boards a box can be made from (labels / films never).
    if (fam === "LABEL" || fam === "FLEXIBLE") continue;
    // A corrugated style printed on SBS (or the reverse) needs another rate card: keep both
    // families only when the family itself lists them.
    void family;
    out.push(m);
  }
  return out;
}

/** Core structure a family model is produced and priced as, for a board. */
export function baseStructure(source: ModelSource, sub: string, material: MaterialCode, code = ""): StructureCode {
  const fam = BOARD_SPECS[material].family;
  const s = `${sub} ${code}`.toLowerCase();
  if (fam === "RIGID") return "RIGID_BOX";
  if (fam === "TUBE") return "PAPER_TUBE";
  if (fam === "CORRUGATED") {
    if (s.includes("pizza") || code === "FEFCO_0426") return "PIZZA";
    if (s.includes("tray") || s.includes("display")) return "FEFCO_0422";
    if (s.includes("telescope") || s.includes("slide") || s.includes("half-shell") || s.includes("caps") || s.includes("lid")) return "FEFCO_0320";
    if (s.includes("folder") || s.includes("wrap") || s.includes("mailer")) return "FEFCO_0427";
    return "FEFCO_0201";
  }
  // folding carton (SBS)
  if (s.includes("sleeve")) return "SLEEVE";
  if (s.includes("carrier") || s.includes("gable")) return "GABLE_BOX";
  if (s.includes("crash") || s.includes("auto")) return "ECMA_CLB";
  if (s.includes("lock_bottom") || s.includes("lock-bottom") || s.includes("snap")) return "ECMA_SLB";
  if (s.includes("tuck") || s.includes("pharma") || s.includes("hanger") || s.includes("window") || s.includes("double_wall")) return "ECMA_RTE";
  return "ECMA_STE";
}

export function groupOf(family: StructureFamily, sub: string, code: string): ModelGroup {
  const s = `${sub} ${code}`.toLowerCase();
  if (family === "RIGID") return "RIGID";
  if (family === "TUBE") return "TUBES";
  if (s.includes("tray") || code === "FEFCO_0422") return "TRAYS";
  if (family === "FOLDING_CARTON") return "CARTONS";
  return "BOXES";
}

/** Styles whose folded state has no top: trays, half slotted containers, open displays and sleeves. */
export function isOpenTop(code: string, sub: string): boolean {
  const s = `${sub} ${code}`.toLowerCase();
  // Lidded trays, telescope sets, capped sleeves, hinged lids and wraps close.
  if (/(^|[\s_-])lid|lidded|telescope|caps|hinged|wrap/.test(s)) return false;
  if (/tray|display|open|sleeve|liner|pad|partition|cushion|corner|scoop|carrier|basket/.test(s)) return true;
  return ["FEFCO_0200", "FEFCO_0422", "SLEEVE", "ECMA_SLEEVE_OPEN"].includes(code);
}

export const search = (...parts: (string | undefined | null)[]) => parts.filter(Boolean).join(" ").toLowerCase();

export interface RawDef {
  code: string;
  slug: string;
  family: string;
  subFamily?: unknown;
  standard?: string | null;
  name: LocalizedText;
  description: LocalizedText;
  params?: StructureParamLimits;
  defaultDims?: Dims;
  presets?: DimsPreset[];
  materials?: string[];
  features?: FeatureSupport;
  shape?: string;
  fidelity?: string;
  keywords?: string[];
}

export function familyEntry(source: ModelSource, d: RawDef, build: BoxModelDef["build"], limits = d.params!, defaultDims = d.defaultDims!, presets = d.presets ?? []): BoxModelDef | null {
  const family = (d.family === "INTERIOR_FITTING" ? "CORRUGATED" : d.family) as StructureFamily;
  if (!["CORRUGATED", "FOLDING_CARTON", "RIGID", "TUBE"].includes(family)) return null;
  const materials = pricedMaterials(d.materials, family);
  if (!materials.length) return null;
  const sub = typeof d.subFamily === "string" ? d.subFamily : ((d.subFamily as { code?: string } | undefined)?.code ?? "");
  const shape = d.shape === "cylinder" || d.shape === "octagon" || d.shape === "flat" ? d.shape : "box";
  return {
    kind: "box",
    code: d.code,
    slug: d.slug,
    group: groupOf(family, sub, d.code),
    source,
    standard: d.standard ?? "",
    name: d.name,
    description: d.description,
    search: search(d.code, d.code.replace(/_/g, " "), d.name.en, d.name.ar, d.standard, d.slug, sub, ...(d.keywords ?? [])),
    ...(d.keywords?.length ? { keywords: d.keywords } : {}),
    family,
    shape,
    limits,
    defaultDims,
    presets,
    materials,
    features: d.features ?? NO_FEATURES,
    baseFor: (m) => baseStructure(source, sub, m, d.code),
    build,
    fidelity: d.fidelity === "simplified" ? "simplified" : "exact",
    ...(isOpenTop(d.code, sub) ? { openTop: true } : {}),
  };
}


export const asModel = (m: unknown) => m as DielineModel;

/** FEFCO 09 fittings without a printable face (partition sets, cushions, corner pieces). */
export const UNPRINTED_FITTINGS = new Set(["FEFCO_0930", "FEFCO_0933", "FEFCO_0934", "FEFCO_0935", "FEFCO_0946", "FEFCO_0947", "FEFCO_0949", "FEFCO_0949A", "FEFCO_0973", "FEFCO_0974", "FEFCO_0975", "FEFCO_0976"]);
