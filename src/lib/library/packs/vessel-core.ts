import { CLOSURE_NAMES, VESSELS, VESSEL_KINDS, VESSEL_MATERIALS, clampDims, describeVessel } from "@/lib/vessels";
import type { VesselModelDef } from "../types";
import { isSurface, labelArea, pricingOf, search } from "./common-vessel";


/** The core containers (pack "vessel-core"). */
export const models: VesselModelDef[] = VESSEL_KINDS.map((kind) => {
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

