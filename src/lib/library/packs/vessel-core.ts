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
    describe(rawDims, surfaces, presetId) {
      const dims = clampDims(kind, rawDims);
      let neck = d.presets.find((p) => p.id === presetId)?.neck ?? d.neck;
      // custom dims narrower than the neck: take the largest neck of this kind's presets that is
<<<<<<< HEAD
      // no wider than the body (a TO 63 lug lid overhung a 40 mm jar, R5-3Q-F-18)
      // R5-3Q-F-21: bottles keep the neck under ~72 % of the body (a 24 mm cap on a 30 mm Boston
      // round read as a jar); jars, tins and cans only switch when the lid would overhang
      const k = d.family === "BOTTLE" ? 0.72 : 1;
      if (neck && !flat && neck.outerDiameterMm > dims.D * k) {
        const fits = d.presets.map((p) => p.neck).filter((n): n is NonNullable<typeof n> => !!n && n.thread === neck!.thread && n.outerDiameterMm <= dims.D * k);
=======
      // no wider than the body (a TO 63 lug lid overhung a 40 mm jar, R5-3Q-F-18); a can end is
      // seamed 1.2 mm a side outside its nominal size (R6-3Q-F-02: a 202 end on a 50 mm can)
      const span = (n: NonNullable<typeof neck>) => n.outerDiameterMm + (n.thread === "seam" ? 2.4 : 0);
      if (neck && !flat && span(neck) > dims.D) {
        const fits = d.presets.map((p) => p.neck).filter((n): n is NonNullable<typeof n> => !!n && n.thread === neck!.thread && span(n) <= dims.D + 0.5);
>>>>>>> origin/claude/exciting-albattani-8kzgsu-r6-3dqa
        neck = fits.sort((a, b) => b.outerDiameterMm - a.outerDiameterMm)[0] ?? neck;
      }
      const r = describeVessel({ kind, dims, neck, surfaces: surfaces.filter(isSurface) });
      return { profile: r.profile, areas: r.labels.map(labelArea), envelope: r.envelope };
    },
  } satisfies VesselModelDef;
});

