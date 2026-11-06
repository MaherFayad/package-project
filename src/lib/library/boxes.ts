import type { Dims, DimsPreset, LocalizedText, MaterialCode, StructureCode, StructureFamily, StructureParamLimits } from "@/types";
import { MATERIAL_CODES } from "@/types";
import { BOARD_SPECS, STRUCTURE_LIST, generateDieline, type DielineModel, type FeatureSupport } from "@/lib/dieline";
import * as F02 from "@/lib/dieline/families/fefco-02";
import * as F0305 from "@/lib/dieline/families/fefco-03-05";
import * as F04 from "@/lib/dieline/families/fefco-04";
import * as F0607 from "@/lib/dieline/families/fefco-06-07";
import * as F09 from "@/lib/dieline/families/fefco-09";
import * as TUCK from "@/lib/dieline/families/ecma-tuck";
import * as SPEC from "@/lib/dieline/families/ecma-specials";
import * as FOOD from "@/lib/dieline/families/foodservice";
import * as RT from "@/lib/dieline/families/rigid-tubes";
import type { BoxModelDef, ModelGroup, ModelSource } from "./types";

/**
 * Box library: the 13 core structures plus every family generator whose output folds in the
 * shared 3D engine and whose boards printers in Egypt quote (rate cards exist). Families that
 * are not dielines (paper cups, lids, moulded pulp) or whose stocks no seeded printer quotes
 * (paper bags, envelopes, triple-wall bulk) are left out; `EXCLUDED_FAMILY_MODELS` lists why.
 */

const NO_FEATURES: FeatureSupport = { windowFaces: [], thumbNotch: false, handle: false, tearStrip: false, partitions: false, lidHeight: false, displayFront: false };

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

function groupOf(family: StructureFamily, sub: string, code: string): ModelGroup {
  const s = `${sub} ${code}`.toLowerCase();
  if (family === "RIGID") return "RIGID";
  if (family === "TUBE") return "TUBES";
  if (s.includes("tray") || code === "FEFCO_0422") return "TRAYS";
  if (family === "FOLDING_CARTON") return "CARTONS";
  return "BOXES";
}

const search = (...parts: (string | undefined | null)[]) => parts.filter(Boolean).join(" ").toLowerCase();

interface RawDef {
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
}

function familyEntry(source: ModelSource, d: RawDef, build: BoxModelDef["build"], limits = d.params!, defaultDims = d.defaultDims!, presets = d.presets ?? []): BoxModelDef | null {
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
    search: search(d.code, d.code.replace(/_/g, " "), d.name.en, d.name.ar, d.standard, d.slug, sub),
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
  };
}

/* ───────────────────────────── core ───────────────────────────── */

const CORE: BoxModelDef[] = STRUCTURE_LIST.filter((s) => s.shape !== "flat").map((s) => ({
  kind: "box",
  code: s.code,
  slug: s.slug,
  group: groupOf(s.family, "", s.code),
  source: "core",
  standard: s.standard,
  name: s.name,
  description: s.description,
  search: search(s.code, s.code.replace(/_/g, " "), s.name.en, s.name.ar, s.standard, s.slug),
  family: s.family,
  shape: s.shape === "cylinder" ? "cylinder" : "box",
  limits: s.params,
  defaultDims: s.defaultDims,
  presets: s.presets,
  materials: s.materials,
  features: s.features,
  baseFor: () => s.code,
  build: (dims, o) => generateDieline(s.code, dims, { thicknessMm: o.thicknessMm, features: o.features }),
  fidelity: "exact",
}));

/* ───────────────────────────── families ───────────────────────────── */

const asModel = (m: unknown) => m as DielineModel;

function familyModels(): BoxModelDef[] {
  const out: (BoxModelDef | null)[] = [];

  for (const d of F02.DEFINITIONS)
    out.push(familyEntry("fefco-02", d as unknown as RawDef, (dims, o) => asModel(F02.buildFefco02Dieline(d, dims, { thicknessMm: o.thicknessMm, features: o.features }))));

  for (const d of F0305.DEFINITIONS)
    out.push(familyEntry("fefco-03-05", d as unknown as RawDef, (dims, o) => asModel(F0305.generateFamilyDieline(d, dims, { thicknessMm: o.thicknessMm, features: o.features }))));

  for (const d of F04.DEFINITIONS)
    out.push(familyEntry("fefco-04", d as unknown as RawDef, (dims, o) => asModel(F04.generateFamilyDieline(d, dims, { thicknessMm: o.thicknessMm, features: o.features }))));

  for (const d of F0607.DEFINITIONS)
    out.push(familyEntry("fefco-06-07", d as unknown as RawDef, (dims, o) => asModel(F0607.generateFamilyDieline(d, dims, { thicknessMm: o.thicknessMm, features: o.features }))));

  for (const d of TUCK.DEFINITIONS)
    out.push(familyEntry("ecma-tuck", d as unknown as RawDef, (dims, o) => asModel(TUCK.generateEcmaDieline(d, dims, { thicknessMm: o.thicknessMm, features: o.features }))));

  for (const d of SPEC.DEFINITIONS)
    out.push(familyEntry("ecma-specials", d as unknown as RawDef, (dims, o) => asModel(SPEC.generateFamilyDieline(d, dims, { thicknessMm: o.thicknessMm, features: o.features }))));

  for (const d of FOOD.DEFINITIONS) {
    if (d.kind !== "dieline") continue;
    out.push(
      familyEntry("foodservice", d as unknown as RawDef, (dims, o) => {
        const r = FOOD.buildFoodservice(d.code, dims, { thicknessMm: o.thicknessMm, features: o.features });
        if (r.kind !== "dieline") throw new Error(`${d.code} is not a dieline`);
        return asModel(r.model);
      }),
    );
  }

  for (const d of RT.DEFINITIONS)
    out.push(familyEntry("rigid-tubes", d as unknown as RawDef, (dims, o) => asModel(d.generate(dims, { thicknessMm: o.thicknessMm, features: o.features }))));

  // FEFCO 09 interior fittings: sized by the HOST box's inner dims. Slotted partitions and
  // cushions have no face that carries print (they are plain board inside the box): left out.
  for (const d of F09.DEFINITIONS) {
    if (UNPRINTED_FITTINGS.has(d.code)) continue;
    const presets = d.presets.map((p) => ({ id: p.id, name: p.name, dims: p.dims, ...(p.standard ? { standard: p.standard } : {}) }));
    const optionsFor = (dims: Dims) => d.presets.find((p) => p.dims.L === dims.L && p.dims.W === dims.W && p.dims.H === dims.H)?.options ?? {};
    out.push(
      familyEntry(
        "fefco-09",
        { ...(d as unknown as RawDef), family: "INTERIOR_FITTING", standard: d.standard },
        (dims, o) => asModel(F09.generateFitting(d.code, { host: dims, ...optionsFor(dims) }, { thicknessMm: o.thicknessMm })),
        d.hostLimits,
        d.defaultHost,
        presets,
      ),
    );
  }
  return out.filter((x): x is BoxModelDef => !!x);
}

/** FEFCO 09 fittings without a printable face (partition sets, cushions, corner pieces). */
const UNPRINTED_FITTINGS = new Set(["FEFCO_0930", "FEFCO_0933", "FEFCO_0934", "FEFCO_0935", "FEFCO_0946", "FEFCO_0947", "FEFCO_0949", "FEFCO_0949A", "FEFCO_0973", "FEFCO_0974", "FEFCO_0975", "FEFCO_0976"]);

function dedupe(list: BoxModelDef[]): BoxModelDef[] {
  const codes = new Set<string>();
  const slugs = new Set<string>();
  const out: BoxModelDef[] = [];
  for (const m of list) {
    if (codes.has(m.code)) continue;
    codes.add(m.code);
    let slug = m.slug;
    if (slugs.has(slug)) slug = `${slug}-${m.code.toLowerCase().replace(/_/g, "-")}`;
    slugs.add(slug);
    out.push(slug === m.slug ? m : { ...m, slug });
  }
  return out;
}

/** Every box model, core first. */
export const BOX_MODELS: BoxModelDef[] = dedupe([...CORE, ...familyModels()]);

/** Family models left out of the designer and why (documentation + tests). */
export const EXCLUDED_FAMILY_MODELS: { code: string; reason: string }[] = (() => {
  const inLib = new Set(BOX_MODELS.map((m) => m.code));
  const out: { code: string; reason: string }[] = [];
  for (const d of FOOD.DEFINITIONS) {
    if (d.kind !== "dieline") out.push({ code: d.code, reason: `${d.kind} part (cup, lid or moulded pulp), not a folding dieline` });
    else if (!inLib.has(d.code)) out.push({ code: d.code, reason: "paper or food stock no seeded printer quotes yet" });
  }
  for (const code of UNPRINTED_FITTINGS) out.push({ code, reason: "unprinted interior fitting (partition set / cushion): no face carries artwork" });
  for (const d of RT.DEFINITIONS) if (!inLib.has(d.code)) out.push({ code: d.code, reason: "stock no seeded printer quotes yet (envelope paper, BC / triple wall)" });
  return out;
})();
