import * as FLEX from "@/lib/vessels/families/flexible";
import type { PrintArea, VesselDescription, VesselModelDef } from "../types";
import { search } from "./common-vessel";


export const models: VesselModelDef[] = FLEX.DEFINITIONS.map((def) => {
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
    // E-07: every printable panel is on by default.
    defaultSurfaces: FLEX.defaultPrintPanels(def.code),
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
      return { profile: null, areas, envelope: FLEX.flexDisplayEnvelope(cfg), flex: cfg } satisfies VesselDescription;
    },
  } satisfies VesselModelDef;
});

