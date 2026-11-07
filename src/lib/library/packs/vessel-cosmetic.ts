import type { LocalizedText } from "@/types";
import { CLOSURE_NAMES, VESSELS, discSpec, VESSEL_MATERIALS, buildProfile, labelSpecsFor, vesselEnvelope, type PrintSurfaceKind, type VesselKind, type VesselMaterialCode } from "@/lib/vessels";
import * as COS from "@/lib/vessels/families/cosmetic-cans";
import type { VesselModelDef, VesselOption } from "../types";
import { isCoreClosure, isCoreMaterial, isSurface, labelArea, search } from "./common-vessel";
/** Cosmetic / can closures drawn with an engine closure style instead of the core default (E-04). */
const COS_CLOSURE_STYLE: Partial<Record<string, string>> = {
  ROLL_BALL_CAP: "ROLL_ON_BALL",
  AIRLESS_PUMP: "AIRLESS_PUMP",
  BULLET_CAP: "BULLET_CAP",
  PEEL_FOIL: "PEEL_FOIL",
  LIDDING_FOIL: "PEEL_FOIL",
  TOP_SEAL_FILM: "PEEL_FOIL",
  EASY_OPEN_END: "EOE_RING",
  PLUG_LID: "PLUG_LID",
  LEVER_LID: "LEVER_LID",
  SNAP_LID: "SNAP_LID",
  HINGED_LID: "HINGED_LID",
  TWIST_UP: "TWIST_UP",
  // R5-3Q-G: mascara / lip-gloss wand caps and nail-polish brush caps are tall cylindrical overcaps
  // (≈ 40 % of the closed height), not a jar lug lid / a perfume mist pump.
  WAND_CAP: "BULLET_CAP",
  BRUSH_CAP: "BULLET_CAP",
  // R6: closures that used to collapse onto a plain screw / lug cap or the bare pump
  MIST_PUMP_COLLAR: "MIST_COLLAR",
  CHILD_RESISTANT_CAP: "CR_CAP",
  PIERCING_CAP: "PIERCING",
  DROPPER_TIP_CAP: "DROPPER_TIP",
  AEROSOL_VALVE: "AEROSOL",
  CRIMP_FLIP_OFF: "CRIMP_FLIP_OFF",
  DOUBLE_WALL_CAP: "DOUBLE_WALL_CAP",
  // R6-3Q-G-04: a serum pump is not a full lotion pump
  TREATMENT_PUMP: "TREATMENT_PUMP",
};

/**
 * Default closure colour (R5-3Q-F-13 / G-25 / G-11): "MATCH" = the lid is the container's own
 * material and colour (a clear APET clamshell is one clear piece, tinplate tins have tinplate lids,
 * a compact lid matches its base); metal seals default to bare metal.
 */
const COS_CLOSURE_COLOR: Partial<Record<string, string>> = {
  HINGED_LID: "MATCH",
  SNAP_LID: "MATCH",
  TOP_SEAL_FILM: "MATCH",
  SLIP_LID: "MATCH",
  PLUG_LID: "MATCH",
  LEVER_LID: "MATCH",
  HINGED_COMPACT_LID: "MATCH",
  CRIMP_FLIP_OFF: "BLUE",
  PEEL_FOIL: "SILVER",
  LIDDING_FOIL: "SILVER",
  MIST_PUMP_COLLAR: "SILVER",
};

/**
 * R5-3Q-G: catalogue closures whose nearest core renderer kind is not the model core's default
 * (the default collapsed them onto another option or drew the wrong part).
 */
const COS_CLOSURE_CORE: Partial<Record<string, string>> = {
  // treatment (serum) pump: a small pump actuator, not the dropper bulb it collapsed to
  TREATMENT_PUMP: "LOTION_PUMP",
  // wand cap: screw-cap core so the bottle-neck BULLET_CAP style applies (a LUG_LID core blocks styles)
  WAND_CAP: "SCREW_CAP",
  // R6 styled closures replace a screw-cap core (the engine refuses a style over LUG_LID)
  CRIMP_FLIP_OFF: "SCREW_CAP",
  CHILD_RESISTANT_CAP: "SCREW_CAP",
  DROPPER_TIP_CAP: "SCREW_CAP",
  PIERCING_CAP: "SCREW_TUBE_CAP",
  // OPC ampoule is flame-sealed: no closure at all (ZIP_SEAL core draws no parts)
  OPC_BREAK: "ZIP_SEAL",
  // aerosol: the profile's 1 inch valve cup, not a beverage-can pull tab inside it
  AEROSOL_VALVE: "ZIP_SEAL",
  // plain double-seamed food can end: the profile's end panel; the hidden core pull tab swung up
  // out of the seam in the open view (a seamed end does not open)
  DOUBLE_SEAM_END: "ZIP_SEAL",
};

/** Cosmetic materials whose core look has the wrong colour (X-01, V-14). */
const COS_TINT: Partial<Record<string, string>> = {
  ABS_BLACK: "#161616",
  // R5-3Q-G: natural (unpigmented) PP / HDPE / LDPE is translucent milky (same hex as the bottles
  // family's HDPE_NATURAL / PP_NATURAL), on the frosted core below.
  PP_NATURAL: "#eef0ee",
  HDPE_NATURAL: "#ece9df",
  LDPE_NATURAL: "#eeece4",
  // rPET carries a faint grey-blue cast from recycled flake; APET / virgin PET is water clear
  RPET_CLEAR: "#e4ecef",
};

export 

const COS_MATERIAL: Record<string, VesselMaterialCode> = {
  GLASS_TYPE1_CLEAR: "GLASS_CLEAR",
  GLASS_TYPE1_AMBER: "GLASS_AMBER",
  PP_WHITE: "HDPE_WHITE",
  PP_NATURAL: "GLASS_FROSTED",
  PP_CLEAR: "PET_CLEAR",
  PS_WHITE: "HDPE_WHITE",
  LDPE_NATURAL: "GLASS_FROSTED",
  LDPE_WHITE: "HDPE_WHITE",
  HDPE_NATURAL: "GLASS_FROSTED",
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

export const models: VesselModelDef[] = COS.DEFINITIONS.filter((d) => d.geometry !== "blister").map((def) => {
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
    core: COS_CLOSURE_CORE[c] ?? (isCoreClosure(c) && coreDef.closures.includes(c) ? c : coreDef.defaultClosure),
    ...(COS_CLOSURE_STYLE[c] ? { closureStyle: COS_CLOSURE_STYLE[c] } : {}),
    ...(COS_CLOSURE_COLOR[c] ? { defaultColor: COS_CLOSURE_COLOR[c] } : {}),
  }));
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
    // E-02 / E-03: catalogue print surfaces mapped to renderable ones, and a per-model liquid.
    surfaces: COS.displaySurfaces(def).surfaces,
    defaultSurfaces: COS.displaySurfaces(def).defaultSurfaces,
    fillable: def.fillable,
    defaultLiquid: COS.displayLiquid(def),
    pricing: def.geometry === "tube" ? "TUBE" : "LABEL",
    describe(dims, wanted, presetId) {
      const d = COS.clampCatalogueDims(def, dims);
      const neck = COS.neckFor(def, d, presetId);
      if (def.geometry === "tube") {
        // R6-3Q-G: build at the catalogue size, not the core tube's limits (Ø19 min): a Ø12 ointment
        // tube was described as Ø19 (wrap print area 60 mm on a 38 mm girth, artwork squeezed, cap
        // from the wider profile) while the renderer drew the body at Ø12.
        const profile = buildProfile("SQUEEZE_TUBE", d);
        let labels = labelSpecsFor("SQUEEZE_TUBE", d, profile, wanted.filter(isSurface));
        if (!labels.length) labels = labelSpecsFor("SQUEEZE_TUBE", d, profile, ["WRAP"]);
        return { profile, areas: labels.map(labelArea), envelope: vesselEnvelope("SQUEEZE_TUBE", d) };
      }
      const g = COS.buildGeometry(def.shape, d, neck);
      const profile = g.profile ?? buildProfile(coreKind, d);
      let labels = labelSpecsFor(coreKind, d, profile, wanted.filter(isSurface));
      // Shapes the core label maths cannot wrap with the asked surface (oval sardine lids…): fall back
      // to a front label, then a wrap, so there is always something to print.
      for (const alt of [["FRONT"], ["WRAP"]] as PrintSurfaceKind[][]) if (!labels.length) labels = labelSpecsFor(coreKind, d, profile, alt);
      // R5-3Q-G: a round cup whose only closure is the renderer's SNAP_LID (ice-cream pint, deli pot):
      // the core lid disc (finish top + 1.6) sat UNDER the domed snap lid (top + 3), so only a ring of the
      // lid print showed at the rim. Put it on the lid's crown (dome R × 0.7 → y top + 3).
      if (def.shape.type === "cup" && def.shape.lid === "snap" && profile.section.kind === "round" && def.closures.every((c) => c === "SNAP_LID")) {
        const R = profile.finishR + 0.8;
        labels = labels.map((l) => (l.kind === "LID" ? discSpec(profile.finishTopY + 3.05, R * 0.72) : l));
      }
      return { profile, areas: labels.map(labelArea), envelope: COS.catalogueEnvelope(def, d, g) };
    },
  } satisfies VesselModelDef;
});

