import { z } from "zod";
import type { LocalizedText, Mm } from "@/types";
import { brimfulVolumeMl } from "../../profile";
import type { NeckFinish, VesselKind } from "../../types";
import { COSMETIC_DEFINITIONS } from "./definitions/cosmetic";
import { PHARMA_DEFINITIONS } from "./definitions/pharma";
import { CAN_DEFINITIONS } from "./definitions/cans";
import { TUB_DEFINITIONS, TUBE_DEFINITIONS } from "./definitions/tubs-tubes";
import { buildGeometry } from "./geometry";
import { surfacesFor } from "./surfaces";
import type {
  CatalogueDims,
  CatalogueLimits,
  CatalogueMaterialCode,
  CataloguePreset,
  CatalogueSurfaceKind,
  CatalogueVesselDefinition,
  CatalogueVesselDescription,
  ExtraClosureKind,
} from "./types";

export * from "./types";
export { EXTRA_NECKS, buildGeometry, blisterLayout, crossSection, tinLidH } from "./geometry";
export { DIRECT_BLEED_MM, DIRECT_SAFE_MM, FOIL_TAB_MM, directPrint, girthAt, lidDisc, lidRect, printFlatPoint, printUv, surfacesFor } from "./surfaces";

/** Every model in this folder (cosmetic, pharma, cans and tins, tubs and cups, tubes). */
export const DEFINITIONS: CatalogueVesselDefinition[] = [...COSMETIC_DEFINITIONS, ...PHARMA_DEFINITIONS, ...CAN_DEFINITIONS, ...TUB_DEFINITIONS, ...TUBE_DEFINITIONS];

export const DEFINITIONS_BY_CODE: Record<string, CatalogueVesselDefinition> = Object.fromEntries(DEFINITIONS.map((d) => [d.code, d]));

/**
 * Container kinds that already live in the core registry (src/lib/vessels/registry.ts) and were
 * therefore NOT redefined here. `superseded` lists core kinds this folder extends with a wider
 * definition (more sizes / direct print); the integrator decides whether to retire them.
 */
export const CORE_KINDS_SKIPPED: { kind: VesselKind; reason: string }[] = [
  { kind: "PUMP_BOTTLE", reason: "Lotion pump bottle (24-410 PET/HDPE Boston round) already in core" },
  { kind: "PERFUME_SQUARE", reason: "Square perfume flacon (FEA 15) already in core; round and oval added here" },
  { kind: "WIDE_JAR", reason: "Single-wall cream / honey jar already in core; double-wall jar added here" },
  { kind: "ROUND_TIN", reason: "Small slip-lid tin (Ø40-160) already in core; large gift tins added here" },
];
export const CORE_KINDS_SUPERSEDED: { kind: VesselKind; by: string; reason: string }[] = [
  { kind: "DROPPER_BOTTLE", by: "COS-DROPPER", reason: "core limits start at Ø22 / 50 mm, 5 and 10 ml droppers need Ø18.5" },
  { kind: "CAN", by: "CAN-BEVERAGE", reason: "adds 150 slim, 355, 473, 500 ml and the DIRECT_PRINT surface cans are really decorated with" },
  { kind: "SQUEEZE_TUBE", by: "TUBE-LAMINATE", reason: "core tube is extruded PE with a label wrap; laminate / alu / oval tubes are printed directly" },
];

export const MATERIAL_NAMES: Partial<Record<CatalogueMaterialCode, LocalizedText & { transparent: boolean }>> = {
  GLASS_TYPE1_CLEAR: { ar: "زجاج بوروسيليكات شفاف نوع 1", en: "Type I borosilicate, clear", transparent: true },
  GLASS_TYPE1_AMBER: { ar: "زجاج بوروسيليكات عسلي نوع 1", en: "Type I borosilicate, amber", transparent: true },
  PP_WHITE: { ar: "بولي بروبيلين أبيض", en: "White PP", transparent: false },
  PP_NATURAL: { ar: "بولي بروبيلين طبيعي", en: "Natural PP", transparent: false },
  PP_CLEAR: { ar: "بولي بروبيلين شفاف", en: "Clear PP", transparent: true },
  PS_WHITE: { ar: "بولي ستيرين أبيض", en: "White PS", transparent: false },
  LDPE_NATURAL: { ar: "بولي إيثيلين منخفض الكثافة طبيعي", en: "Natural LDPE", transparent: false },
  LDPE_WHITE: { ar: "بولي إيثيلين منخفض الكثافة أبيض", en: "White LDPE", transparent: false },
  HDPE_NATURAL: { ar: "بولي إيثيلين عالي الكثافة طبيعي", en: "Natural HDPE", transparent: false },
  PETG_CLEAR: { ar: "بلاستيك PETG شفاف", en: "Clear PETG", transparent: true },
  ACRYLIC_CLEAR: { ar: "أكريليك شفاف", en: "Clear acrylic (PMMA)", transparent: true },
  ABS_BLACK: { ar: "بلاستيك ABS أسود", en: "Black ABS", transparent: false },
  APET_CLEAR: { ar: "بلاستيك APET شفاف", en: "Clear APET", transparent: true },
  RPET_CLEAR: { ar: "بلاستيك PET معاد التدوير", en: "Clear rPET", transparent: true },
  PVC_PVDC_CLEAR: { ar: "PVC مغطى بـ PVDC", en: "PVC/PVDC film", transparent: true },
  ALU_COLD_FORM: { ar: "ألومنيوم مشكل على البارد", en: "Cold-form aluminium (Alu-Alu)", transparent: false },
  ALU_TUBE: { ar: "ألومنيوم أنابيب", en: "Tube aluminium (99.7%)", transparent: false },
  LAMINATE_ABL: { ar: "رقائق بحاجز ألومنيوم", en: "Aluminium barrier laminate (ABL)", transparent: false },
  LAMINATE_PBL: { ar: "رقائق بحاجز بلاستيكي", en: "Plastic barrier laminate (PBL)", transparent: false },
  PE_BOARD: { ar: "كرتون مبطن بالبولي إيثيلين", en: "PE-coated board", transparent: false },
};

export const CLOSURE_NAMES: Record<ExtraClosureKind, LocalizedText> = {
  AIRLESS_PUMP: { ar: "مضخة بدون هواء", en: "Airless pump" },
  TREATMENT_PUMP: { ar: "مضخة سيروم", en: "Treatment pump" },
  MIST_PUMP_COLLAR: { ar: "بخاخ عطر بطوق", en: "Mist pump with collar" },
  ROLL_BALL_CAP: { ar: "كرة دوارة بغطاء", en: "Roller ball and cap" },
  TWIST_UP: { ar: "آلية تدوير", en: "Twist-up mechanism" },
  BULLET_CAP: { ar: "غطاء أحمر الشفاه", en: "Lipstick cap" },
  WAND_CAP: { ar: "غطاء بفرشاة تطبيق", en: "Wand cap" },
  BRUSH_CAP: { ar: "غطاء بفرشاة", en: "Brush cap" },
  HINGED_COMPACT_LID: { ar: "غطاء مفصلي بمرآة", en: "Hinged mirror lid" },
  DOUBLE_WALL_CAP: { ar: "غطاء مزدوج الجدار", en: "Double-wall cap" },
  CRIMP_FLIP_OFF: { ar: "غطاء ألومنيوم قابل للنزع", en: "Flip-off crimp seal" },
  OPC_BREAK: { ar: "نقطة كسر", en: "One-point cut" },
  CHILD_RESISTANT_CAP: { ar: "غطاء مقاوم لفتح الأطفال", en: "Child-resistant cap" },
  DROPPER_TIP_CAP: { ar: "فوهة تقطير بغطاء", en: "Dropper tip and cap" },
  LIDDING_FOIL: { ar: "رقاقة غلق", en: "Lidding foil" },
  PIERCING_CAP: { ar: "غطاء ثاقب", en: "Piercing cap" },
  DOUBLE_SEAM_END: { ar: "غطاء بلحام مزدوج", en: "Double-seamed end" },
  EASY_OPEN_END: { ar: "غطاء فتح سهل", en: "Easy-open end" },
  LEVER_LID: { ar: "غطاء ضغط", en: "Lever lid" },
  PLUG_LID: { ar: "غطاء داخلي محكم", en: "Plug lid" },
  AEROSOL_VALVE: { ar: "صمام بخاخ", en: "Aerosol valve" },
  PEEL_FOIL: { ar: "رقاقة قابلة للنزع", en: "Peelable foil" },
  SNAP_LID: { ar: "غطاء ضغط بلاستيك", en: "Snap-on lid" },
  HINGED_LID: { ar: "غطاء مفصلي", en: "Hinged lid" },
  TOP_SEAL_FILM: { ar: "فيلم غلق علوي", en: "Top-seal film" },
};

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

const range = (r: { min: number; max: number }, label: string) =>
  z.number({ invalid_type_error: `${label} must be a number` }).finite().min(r.min, `${label} >= ${r.min} mm`).max(r.max, `${label} <= ${r.max} mm`);

/** zod schema for a definition's dims (limits + shape-specific geometric checks). */
export function dimsSchema(def: CatalogueVesselDefinition, neck: NeckFinish | undefined = def.neck) {
  const l: CatalogueLimits = def.limits;
  const shape = z.object({
    D: range(l.D, "D"),
    H: range(l.H, "H"),
    G: l.G ? range(l.G, "G").optional() : z.number().optional(),
    taper: l.taper ? range(l.taper, "taper").optional() : z.number().optional(),
    rows: l.rows ? range(l.rows, "rows").int().optional() : z.number().optional(),
    cols: l.cols ? range(l.cols, "cols").int().optional() : z.number().optional(),
    cavityD: l.cavityD ? range(l.cavityD, "cavityD").optional() : z.number().optional(),
  });
  return shape.superRefine((d, ctx) => {
    if (d.G !== undefined && def.shape.type !== "blister" && d.G > d.D + 1e-9 && !l.G)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["G"], message: "depth must not exceed width" });
    if (def.shape.type === "cup" && (d.taper ?? 0) > d.D * 0.4) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["taper"], message: "taper > 40% of the rim" });
    if (neck && def.shape.type === "bottle" && neck.outerDiameterMm > d.D)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["D"], message: "neck finish wider than the body" });
    if (def.shape.type === "blister") {
      const rows = d.rows ?? 2;
      const cols = d.cols ?? 5;
      const cav = d.cavityD ?? 10;
      if (cols * (cav + 2) > d.D - 8 || rows * (cav + 2) > d.H - 8)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cavityD"], message: "cavities do not fit inside the 4 mm sealing border" });
    }
    if (def.shape.type === "bottle" && neck && d.H < neck.heightMm + 20) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["H"], message: "too short for the neck finish" });
  });
}

/** Validate a size; pass the preset's neck when it differs from the model default. */
export function validateDims(def: CatalogueVesselDefinition, dims: CatalogueDims, neck?: NeckFinish) {
  return dimsSchema(def, neck ?? def.neck).safeParse(dims);
}

/** Clamp to limits (UI sliders). */
export function clampCatalogueDims(def: CatalogueVesselDefinition, d: CatalogueDims): CatalogueDims {
  const c = (v: number | undefined, r?: { min: number; max: number }) => (v === undefined || !r ? v : Math.min(r.max, Math.max(r.min, v)));
  const l = def.limits;
  return { D: c(d.D, l.D)!, H: c(d.H, l.H)!, G: c(d.G, l.G), taper: c(d.taper, l.taper), rows: c(d.rows, l.rows), cols: c(d.cols, l.cols), cavityD: c(d.cavityD, l.cavityD) };
}

export function catalogueDefinition(code: string): CatalogueVesselDefinition | undefined {
  return DEFINITIONS_BY_CODE[code];
}

export function cataloguePreset(def: CatalogueVesselDefinition, id?: string): CataloguePreset {
  return def.presets.find((p) => p.id === id) ?? def.presets.find((p) => p.id === def.defaultPresetId) ?? def.presets[0];
}

/** Extra height of each closure above the container top (mm). */
export function catalogueClosureHeight(def: CatalogueVesselDefinition, d: CatalogueDims): Mm {
  switch (def.defaultClosure) {
    case "DROPPER":
      return 29;
    case "TREATMENT_PUMP":
      return 24;
    case "AIRLESS_PUMP":
      return 17;
    case "MIST_PUMP":
    case "MIST_PUMP_COLLAR":
      return 19;
    case "ROLL_BALL_CAP":
      return Math.max(14, d.D * 0.55);
    case "WAND_CAP":
      return Math.max(28, d.H * 0.45);
    case "BRUSH_CAP":
      return 32;
    case "CRIMP_FLIP_OFF":
      return 3;
    case "CHILD_RESISTANT_CAP":
      return 12;
    case "DROPPER_TIP_CAP":
      return 22;
    case "AEROSOL_VALVE":
      return 38;
    case "SCREW_CAP":
      return 3;
    case "CAN_END":
    case "SLIP_LID":
      return 0.6;
    default:
      return 0;
  }
}

/** Everything a page needs about a configured catalogue container. */
export function describeCatalogueVessel(def: CatalogueVesselDefinition, dims: CatalogueDims, surfaces: CatalogueSurfaceKind[] = def.defaultSurfaces, presetId?: string): CatalogueVesselDescription {
  const d = clampCatalogueDims(def, dims);
  const neck = (presetId ? def.presets.find((p) => p.id === presetId)?.neck : undefined) ?? def.neck;
  const geometry = buildGeometry(def.shape, d, neck);
  const wanted = surfaces.filter((s) => def.surfaces.includes(s));
  const printSurfaces = surfacesFor(geometry, d, wanted);
  let brimfulMl = 0;
  if (geometry.profile && geometry.kind !== "tube") brimfulMl = Math.round(brimfulVolumeMl(geometry.profile, geometry.innerTopY) * 10) / 10;
  const envelope = catalogueEnvelope(def, d, geometry);
  return { geometry, surfaces: printSurfaces, brimfulMl, envelope };
}

export function catalogueEnvelope(def: CatalogueVesselDefinition, d: CatalogueDims, geometry = buildGeometry(def.shape, d, def.neck)) {
  if (geometry.kind === "blister") return { width: d.D, depth: geometry.overallHeightMm, height: d.H };
  const p = geometry.profile!;
  let maxR = 0;
  for (const q of p.outer) maxR = Math.max(maxR, q.r);
  if (geometry.lid) maxR = Math.max(maxR, geometry.lid.r);
  if (geometry.kind === "tube") {
    const flat = Math.PI * (d.D / 2);
    return { width: flat, depth: def.shape.type === "tube" && def.shape.oval ? (d.G ?? d.D) : d.D, height: geometry.overallHeightMm };
  }
  const w = 2 * maxR;
  const depth = p.section.kind === "roundedRect" ? w * p.section.depthRatio : w;
  // lids drawn by the geometry are already inside overallHeightMm
  return { width: w, depth, height: geometry.overallHeightMm + (geometry.lid ? 0 : catalogueClosureHeight(def, d)) };
}

/** Definitions grouped by family (for catalogue pages). */
export function definitionsByFamily() {
  const out: Record<string, CatalogueVesselDefinition[]> = {};
  for (const d of DEFINITIONS) (out[d.family] ??= []).push(d);
  return out;
}
