import type { LocalizedText } from "@/types";
import {
  CLOSURE_KINDS,
  CLOSURE_NAMES,
  PRINT_SURFACE_KINDS,
  VESSELS,
  VESSEL_KINDS,
  VESSEL_MATERIALS,
  VESSEL_MATERIAL_CODES,
  buildProfile,
  clampDims,
  describeVessel,
  labelSpecsFor,
  type ClosureKind,
  type LabelSpec,
  type LiquidCode,
  type PrintSurfaceKind,
  type VesselDims,
  type VesselKind,
  type VesselMaterialCode,
} from "@/lib/vessels";
import * as BTL from "@/lib/vessels/families/bottles";
import * as COS from "@/lib/vessels/families/cosmetic-cans";
import * as FLEX from "@/lib/vessels/families/flexible";
import type { PrintArea, VesselDescription, VesselModelDef, VesselOption } from "./types";

/**
 * Container library: the 10 core containers, the bottles / jars / tubs catalogue, the
 * cosmetic, pharma, can and tube catalogue and the flexible packs. Bottles and catalogue
 * containers render with their EXACT silhouette (family profile) through the core lathe
 * renderer; closures, materials and label maths use the nearest core kind. Flexible packs
 * render with their own film model.
 */

const isSurface = (s: string): s is PrintSurfaceKind => (PRINT_SURFACE_KINDS as readonly string[]).includes(s);
const isCoreMaterial = (s: string): s is VesselMaterialCode => (VESSEL_MATERIAL_CODES as readonly string[]).includes(s);
const isCoreClosure = (s: string): s is ClosureKind => (CLOSURE_KINDS as readonly string[]).includes(s);
const search = (...parts: (string | undefined | null)[]) => parts.filter(Boolean).join(" ").toLowerCase();

function labelArea(spec: LabelSpec): PrintArea {
  return {
    id: spec.id,
    kind: spec.kind,
    name: spec.name,
    trimWidthMm: spec.trimWidthMm,
    trimHeightMm: spec.trimHeightMm,
    bleedMm: spec.bleedMm,
    safeMm: spec.safeMm,
    trimAreaM2: spec.trimAreaM2,
    spec,
  };
}

/** Pricing structure of a core kind. */
function pricingOf(kind: VesselKind): VesselModelDef["pricing"] {
  return kind === "STAND_UP_POUCH" ? "POUCH" : kind === "SQUEEZE_TUBE" ? "TUBE" : "LABEL";
}

/** Product shown in the closest core liquid. */
const LIQUID_OF_CONTENT: Record<string, LiquidCode> = {
  WATER: "WATER",
  JUICE: "ORANGE_JUICE",
  RED_WINE: "HIBISCUS",
  WHITE_WINE: "SERUM",
  SPARKLING: "SERUM",
  BEER: "HONEY",
  OLIVE_OIL: "OLIVE_OIL",
  HOT_SAUCE: "HIBISCUS",
  SPIRIT: "PERFUME",
  MILK: "CREAM",
  SYRUP: "HIBISCUS",
  COLA: "COLA",
  SHAMPOO: "CREAM",
  DETERGENT: "CREAM",
  MOTOR_OIL: "OLIVE_OIL",
  HONEY: "HONEY",
  JAM: "HIBISCUS",
  NUT_BUTTER: "CREAM",
  PICKLES: "OLIVE_OIL",
  TAHINI: "CREAM",
  HALAWA: "CREAM",
  PAINT: "CREAM",
  NONE: "WATER",
};

/* ───────────────────────────── core ───────────────────────────── */

const CORE: VesselModelDef[] = VESSEL_KINDS.map((kind) => {
  const d = VESSELS[kind];
  const flat = kind === "STAND_UP_POUCH";
  return {
    kind: "vessel",
    code: kind,
    slug: kind.toLowerCase().replace(/_/g, "-"),
    group: d.family === "POUCH" ? "POUCHES" : d.family === "CAN" || d.family === "TIN" ? "CANS" : d.family === "TUBE" ? "TUBES" : "BOTTLES_JARS",
    source: "vessel-core",
    standard: d.neck?.code ?? "",
    name: d.name,
    description: d.description,
    search: search(kind, kind.replace(/_/g, " "), d.name.en, d.name.ar, d.neck?.code),
    render: "lathe",
    coreKind: kind,
    limits: d.limits,
    axes: { D: flat ? "width" : "diameter", ...(d.limits.G ? { G: flat ? "gusset" : "depth" } : {}) },
    presets: d.presets.map((p) => ({ id: p.id, name: p.name, capacityMl: p.capacityMl, dims: p.dims })),
    defaultPresetId: d.defaultPresetId,
    containers: d.materials.map((m) => ({ code: m, name: VESSEL_MATERIALS[m].name, core: m })),
    defaultContainer: d.defaultMaterial,
    closures: d.closures.map((c) => ({ code: c, name: CLOSURE_NAMES[c], core: c })),
    defaultClosure: d.defaultClosure,
    surfaces: [...d.surfaces],
    defaultSurfaces: [...d.defaultSurfaces],
    fillable: d.fillable,
    defaultLiquid: d.defaultLiquid,
    pricing: pricingOf(kind),
    describe(dims, surfaces, presetId) {
      const neck = d.presets.find((p) => p.id === presetId)?.neck ?? d.neck;
      const r = describeVessel({ kind, dims: clampDims(kind, dims), neck, surfaces: surfaces.filter(isSurface) });
      return { profile: r.profile, areas: r.labels.map(labelArea), envelope: r.envelope };
    },
  } satisfies VesselModelDef;
});

/* ───────────────────────────── bottles, jars, tubs ───────────────────────────── */

/** Bottle closures drawn with an engine closure style instead of their core screw cap (X-01). */
const BOTTLE_CLOSURE_STYLE: Partial<Record<string, string>> = {
  ROPP_CAP: "ROPP",
  POURER_CAP: "POURER",
  CROWN_26: "CROWN",
  CROWN_29: "CROWN",
  NATURAL_CORK: "CORK_CAPSULE",
  SPARKLING_CORK: "SPARKLING",
};

/** Cosmetic materials whose core look has the wrong colour (X-01, V-14). */
const COS_TINT: Partial<Record<string, string>> = { ABS_BLACK: "#161616" };

const BOTTLES: VesselModelDef[] = BTL.DEFINITIONS.map((def) => {
  const preset = BTL.bottlePreset(def);
  const coreKind = def.coreKind;
  const containers: VesselOption[] = def.materials.map((m) => {
    const mat = BTL.BOTTLE_MATERIALS[m];
    // the core material is only the nearest look: carry the real colour when it differs (X-01)
    return { code: m, name: mat.name, core: mat.coreMaterial, ...(mat.code !== mat.coreMaterial ? { tint: mat.hex } : {}) };
  });
  const closures: VesselOption[] = def.closures.map((c) => {
    const style = BOTTLE_CLOSURE_STYLE[c];
    return { code: c, name: BTL.BOTTLE_CLOSURES[c].name, core: BTL.BOTTLE_CLOSURES[c].coreClosure, ...(style ? { closureStyle: style } : {}) };
  });
  return {
    kind: "vessel",
    code: def.code,
    slug: def.slug,
    group: "BOTTLES_JARS",
    source: "vessel-bottles",
    standard: def.standard === "none" ? (preset.finish ?? "") : def.standard,
    name: def.name,
    description: def.description,
    search: search(def.code, def.code.replace(/_/g, " "), def.name.en, def.name.ar, def.standard, def.subFamily, ...def.typicalUses.map((u) => `${u.en} ${u.ar}`)),
    render: "lathe",
    coreKind,
    limits: def.limits,
    axes: { D: "diameter", ...(def.limits.G ? { G: "depth" as const } : {}) },
    presets: def.presets.map((p) => ({ id: p.id, name: p.name, capacityMl: p.capacityMl, dims: p.dims })),
    defaultPresetId: def.defaultPresetId,
    containers,
    defaultContainer: def.defaultMaterial,
    closures,
    defaultClosure: def.defaultClosure,
    surfaces: def.surfaces.filter(isSurface),
    defaultSurfaces: def.defaultSurfaces.filter(isSurface),
    fillable: def.fillable,
    defaultLiquid: LIQUID_OF_CONTENT[def.defaultContent] ?? "WATER",
    pricing: "LABEL",
    describe(dims, surfaces, presetId) {
      const p = BTL.bottlePreset(def, presetId);
      const v = BTL.validateBottleDims(def, dims);
      if (!v.ok) throw new Error(`Invalid dims for ${def.code}`);
      const profile = BTL.profileFor(def, dims, p.finish);
      const labels = labelSpecsFor(coreKind, dims, profile, surfaces.filter(isSurface));
      return { profile, areas: labels.map(labelArea), envelope: BTL.bottleEnvelope(def, profile, dims) };
    },
  } satisfies VesselModelDef;
});

/* ───────────────────────────── cosmetic, pharma, cans, tubs, tubes ───────────────────────────── */

const COS_MATERIAL: Record<string, VesselMaterialCode> = {
  GLASS_TYPE1_CLEAR: "GLASS_CLEAR",
  GLASS_TYPE1_AMBER: "GLASS_AMBER",
  PP_WHITE: "HDPE_WHITE",
  PP_NATURAL: "HDPE_WHITE",
  PP_CLEAR: "PET_CLEAR",
  PS_WHITE: "HDPE_WHITE",
  LDPE_NATURAL: "HDPE_WHITE",
  LDPE_WHITE: "HDPE_WHITE",
  HDPE_NATURAL: "HDPE_WHITE",
  PETG_CLEAR: "PET_CLEAR",
  ACRYLIC_CLEAR: "PET_CLEAR",
  ABS_BLACK: "HDPE_WHITE",
  APET_CLEAR: "PET_CLEAR",
  RPET_CLEAR: "PET_CLEAR",
  PVC_PVDC_CLEAR: "PET_CLEAR",
  ALU_COLD_FORM: "ALUMINIUM",
  ALU_TUBE: "ALUMINIUM",
  LAMINATE_ABL: "PE_TUBE_WHITE",
  LAMINATE_PBL: "PE_TUBE_WHITE",
  PE_BOARD: "WHITE_POUCH",
};
const FAMILY_CORE: Record<string, VesselKind> = { COSMETIC: "WIDE_JAR", PHARMA: "BOSTON_ROUND", CAN: "CAN", TUB_CUP: "WIDE_JAR", TUBE: "SQUEEZE_TUBE" };

const COSMETIC: VesselModelDef[] = COS.DEFINITIONS.filter((d) => d.geometry !== "blister").map((def) => {
  const coreKind: VesselKind = def.geometry === "tube" ? "SQUEEZE_TUBE" : (def.coreKind ?? FAMILY_CORE[def.family] ?? "WIDE_JAR");
  const coreDef = VESSELS[coreKind];
  const materialName = (m: string): LocalizedText => {
    const n = COS.MATERIAL_NAMES[m as keyof typeof COS.MATERIAL_NAMES];
    return n ? { ar: n.ar, en: n.en } : isCoreMaterial(m) ? VESSEL_MATERIALS[m].name : { ar: m, en: m };
  };
  const containers: VesselOption[] = def.materials.map((m) => ({
    code: m,
    name: materialName(m),
    core: isCoreMaterial(m) ? m : (COS_MATERIAL[m] ?? coreDef.defaultMaterial),
    ...(COS_TINT[m] ? { tint: COS_TINT[m] } : {}),
  }));
  const closures: VesselOption[] = def.closures.map((c) => ({
    code: c,
    name: isCoreClosure(c) ? CLOSURE_NAMES[c] : (COS.CLOSURE_NAMES[c as keyof typeof COS.CLOSURE_NAMES] ?? { ar: c, en: c }),
    core: isCoreClosure(c) && coreDef.closures.includes(c) ? c : coreDef.defaultClosure,
  }));
  const surfaces = def.surfaces.filter(isSurface);
  const can = def.family === "CAN";
  return {
    kind: "vessel",
    code: def.code,
    slug: `${def.slug}`,
    group: can ? "CANS" : def.family === "TUBE" || def.geometry === "tube" ? "TUBES" : "BOTTLES_JARS",
    source: "vessel-cosmetic",
    standard: def.standard ?? def.neck?.code ?? "",
    name: def.name,
    description: def.description,
    search: search(def.code, def.code.replace(/[-_]/g, " "), def.name.en, def.name.ar, def.standard, def.subFamily.name.en, def.subFamily.name.ar),
    render: "lathe",
    coreKind,
    limits: { D: def.limits.D, H: def.limits.H, ...(def.limits.G ? { G: def.limits.G } : {}), ...(def.limits.taper ? { taper: def.limits.taper } : {}) },
    axes: { D: def.geometry === "extrusion" ? "width" : "diameter", ...(def.limits.G ? { G: "depth" as const } : {}) },
    presets: def.presets.map((p) => ({ id: p.id, name: p.name, capacityMl: p.capacityMl || undefined, dims: { D: p.dims.D, H: p.dims.H, G: p.dims.G, taper: p.dims.taper } })),
    defaultPresetId: def.defaultPresetId,
    containers,
    defaultContainer: def.defaultMaterial,
    closures,
    defaultClosure: def.defaultClosure,
    surfaces: surfaces.length ? surfaces : ["WRAP"],
    defaultSurfaces: def.defaultSurfaces.filter(isSurface).length ? def.defaultSurfaces.filter(isSurface) : [surfaces[0] ?? "WRAP"],
    fillable: def.fillable,
    defaultLiquid: can ? "COLA" : def.family === "PHARMA" ? "SERUM" : "CREAM",
    pricing: def.geometry === "tube" ? "TUBE" : "LABEL",
    describe(dims, wanted, presetId) {
      const d = COS.clampCatalogueDims(def, dims);
      const neck = def.presets.find((p) => p.id === presetId)?.neck ?? def.neck;
      if (def.geometry === "tube") {
        const cd = clampDims("SQUEEZE_TUBE", d);
        let r = describeVessel({ kind: "SQUEEZE_TUBE", dims: cd, surfaces: wanted.filter(isSurface) });
        if (!r.labels.length) r = describeVessel({ kind: "SQUEEZE_TUBE", dims: cd, surfaces: ["WRAP"] });
        return { profile: r.profile, areas: r.labels.map(labelArea), envelope: r.envelope };
      }
      const g = COS.buildGeometry(def.shape, d, neck);
      const profile = g.profile ?? buildProfile(coreKind, d);
      let labels = labelSpecsFor(coreKind, d, profile, wanted.filter(isSurface));
      // Shapes the core label maths cannot wrap with the asked surface (oval sardine lids…): fall back
      // to a front label, then a wrap, so there is always something to print.
      for (const alt of [["FRONT"], ["WRAP"]] as PrintSurfaceKind[][]) if (!labels.length) labels = labelSpecsFor(coreKind, d, profile, alt);
      return { profile, areas: labels.map(labelArea), envelope: COS.catalogueEnvelope(def, d, g) };
    },
  } satisfies VesselModelDef;
});

/* ───────────────────────────── flexible packs ───────────────────────────── */

const FLEXIBLE: VesselModelDef[] = FLEX.DEFINITIONS.map((def) => {
  const panels = def.panels as string[];
  return {
    kind: "vessel",
    code: def.code,
    slug: def.slug,
    group: def.subFamily === "SLEEVE" ? "BOTTLES_JARS" : "POUCHES",
    source: "vessel-flexible",
    standard: def.standard ?? "",
    name: def.name,
    description: def.description,
    search: search(def.code, def.code.replace(/_/g, " "), def.name.en, def.name.ar, def.subFamily, ...def.typicalUses.map((u) => `${u.en} ${u.ar}`)),
    render: "flexible",
    coreKind: "STAND_UP_POUCH",
    limits: { D: def.limits.W, H: def.limits.H, ...(def.limits.G ? { G: def.limits.G } : {}) },
    axes: { D: "width", ...(def.limits.G ? { G: "gusset" as const } : {}) },
    presets: def.presets.map((p) => ({ id: p.id, name: p.name, dims: { D: p.dims.W, H: p.dims.H, ...(p.dims.G !== undefined ? { G: p.dims.G } : {}) } })),
    defaultPresetId: def.presets[0]?.id ?? "default",
    containers: def.materials.map((m) => ({ code: m, name: FLEX.FILM_MATERIALS[m].name, core: m })),
    defaultContainer: def.defaultMaterial,
    closures: [],
    defaultClosure: "",
    surfaces: panels,
    defaultSurfaces: panels.filter((p) => p === "front" || p === "back" || p === "sleeve").length ? panels.filter((p) => p === "front" || p === "back" || p === "sleeve") : panels.slice(0, 1),
    fillable: false,
    defaultLiquid: "WATER",
    pricing: "POUCH",
    describe(dims, wanted, _presetId, ...rest: unknown[]) {
      const material = (typeof rest[0] === "string" ? rest[0] : def.defaultMaterial) as FLEX.FilmMaterialCode;
      const cfg = FLEX.parseFlexConfig({ code: def.code, dims: { W: dims.D, H: dims.H, ...(def.limits.G ? { G: dims.G ?? def.defaultDims.G } : {}) }, fill: def.defaultFill, material, options: {} });
      const layout = FLEX.printLayout(cfg);
      const areas: PrintArea[] = layout.panels
        .filter((p) => wanted.includes(p.id))
        .map((p) => ({
          id: `flex-${p.id}`,
          kind: p.id,
          name: p.name,
          trimWidthMm: p.trimWidthMm,
          trimHeightMm: p.trimHeightMm,
          bleedMm: p.bleedMm,
          safeMm: p.safeMm,
          trimAreaM2: p.trimAreaM2,
          panel: p.id,
        }));
      const G = cfg.dims.G ?? 0;
      return { profile: null, areas, envelope: { width: cfg.dims.W, depth: Math.max(G, 30), height: cfg.dims.H }, flex: cfg } satisfies VesselDescription;
    },
  } satisfies VesselModelDef;
});

function dedupe(list: VesselModelDef[]): VesselModelDef[] {
  const codes = new Set<string>();
  const slugs = new Set<string>();
  const out: VesselModelDef[] = [];
  for (const m of list) {
    if (codes.has(m.code)) continue;
    codes.add(m.code);
    const slug = slugs.has(m.slug) ? `${m.slug}-${m.code.toLowerCase().replace(/_/g, "-")}` : m.slug;
    slugs.add(slug);
    out.push(slug === m.slug ? m : { ...m, slug });
  }
  return out;
}

export const VESSEL_MODELS: VesselModelDef[] = dedupe([...CORE, ...BOTTLES, ...COSMETIC, ...FLEXIBLE]);

/** Flexible film material for a design (the "container" of a flexible model). */
export function describeVesselModel(m: VesselModelDef, dims: VesselDims, surfaces: string[], presetId?: string, container?: string): VesselDescription {
  return (m.describe as (d: VesselDims, s: string[], p?: string, c?: string) => VesselDescription)(dims, surfaces, presetId, container);
}
