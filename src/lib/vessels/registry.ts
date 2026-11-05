import type { LocalizedText, Mm } from "@/types";
import { labelSpecsFor } from "./labels";
import { NECK_FINISHES, brimfulVolumeMl, buildProfile, pouchDims, tinLidHeight, tubeDims } from "./profile";
import type {
  ClosureKind,
  LabelSpec,
  NeckFinish,
  PrintSurfaceKind,
  Range,
  VesselDims,
  VesselFamily,
  VesselKind,
  VesselMaterialCode,
  VesselPreset,
  VesselProfile,
} from "./types";

export interface VesselDefinition {
  kind: VesselKind;
  family: VesselFamily;
  name: LocalizedText;
  description: LocalizedText;
  materials: VesselMaterialCode[];
  defaultMaterial: VesselMaterialCode;
  closures: ClosureKind[];
  defaultClosure: ClosureKind;
  neck?: NeckFinish;
  limits: { D: Range; H: Range; G?: Range; taper?: Range };
  presets: VesselPreset[];
  defaultPresetId: string;
  surfaces: PrintSurfaceKind[];
  defaultSurfaces: PrintSurfaceKind[];
  /** Has a visible product inside (transparent containers). */
  fillable: boolean;
  defaultLiquid: LiquidCode;
  defaultFill: number;
}

const P = NECK_FINISHES;

/**
 * Container registry. Preset sizes are real catalogue sizes (sources noted per preset) so the
 * label a buyer designs fits the bottle they will actually buy from an Egyptian supplier.
 * Brimful volumes computed from these profiles are checked against the nominal capacity in tests.
 */
export const VESSELS: Record<VesselKind, VesselDefinition> = {
  ROUND_BOTTLE: {
    kind: "ROUND_BOTTLE",
    family: "BOTTLE",
    name: { ar: "زجاجة مياه وعصير", en: "Water and juice bottle" },
    description: { ar: "زجاجة PET دائرية بعنق PCO 1881 مقاس 28 مم", en: "Round PET bottle with a 28 mm PCO 1881 neck" },
    materials: ["PET_CLEAR", "HDPE_WHITE"],
    defaultMaterial: "PET_CLEAR",
    closures: ["SCREW_CAP", "SPORTS_CAP"],
    defaultClosure: "SCREW_CAP",
    neck: P.PCO_1881,
    limits: { D: { min: 50, max: 100 }, H: { min: 130, max: 330 } },
    presets: [
      { id: "pet-330", name: { ar: "330 مل", en: "330 ml" }, capacityMl: 330, dims: { D: 59, H: 171.4 }, neck: P.PCO_1881, source: "Petainer 330 ml water bottle, 28 mm: Ø59 x 171.4 mm" },
      { id: "pet-500", name: { ar: "500 مل", en: "500 ml" }, capacityMl: 500, dims: { D: 65, H: 197 }, neck: P.PCO_1881, source: "Petainer 500 ml, 28 mm PCO 1881: Ø65 x 197 mm" },
      { id: "pet-1000", name: { ar: "1 لتر", en: "1 litre" }, capacityMl: 1000, dims: { D: 80, H: 265 }, neck: P.PCO_1881, source: "Typical 1 l still water PET, 28 mm (approx. Ø80 x 265 mm, confirm with supplier)" },
    ],
    defaultPresetId: "pet-500",
    surfaces: ["WRAP", "FRONT", "BACK", "SHRINK_SLEEVE", "NECK", "LID"],
    defaultSurfaces: ["WRAP"],
    fillable: true,
    defaultLiquid: "WATER",
    defaultFill: 0.94,
  },
  BOSTON_ROUND: {
    kind: "BOSTON_ROUND",
    family: "BOTTLE",
    name: { ar: "زجاجة بوسطن", en: "Boston round bottle" },
    description: { ar: "زجاجة زجاجية بكتف دائري للزيوت والعصائر الطبيعية", en: "Glass bottle with a heavy round shoulder for oils, syrups and tonics" },
    materials: ["GLASS_AMBER", "GLASS_CLEAR", "GLASS_FROSTED"],
    defaultMaterial: "GLASS_AMBER",
    closures: ["SCREW_CAP", "LOTION_PUMP"],
    defaultClosure: "SCREW_CAP",
    neck: P.F20_410,
    limits: { D: { min: 30, max: 90 }, H: { min: 60, max: 220 } },
    presets: [
      { id: "boston-100", name: { ar: "100 مل", en: "100 ml" }, capacityMl: 100, dims: { D: 45, H: 105 }, neck: P.F20_410, source: "Glass Boston round 100 ml, 20-410 (approx. Ø45 x 105 mm)" },
      { id: "boston-250", name: { ar: "250 مل", en: "250 ml" }, capacityMl: 250, dims: { D: 60, H: 140 }, neck: P.F24_410, source: "Glass Boston round 250 ml, 24-410 (approx. Ø60 x 140 mm)" },
    ],
    defaultPresetId: "boston-100",
    surfaces: ["WRAP", "FRONT", "BACK", "SHRINK_SLEEVE", "LID"],
    defaultSurfaces: ["FRONT"],
    fillable: true,
    defaultLiquid: "OLIVE_OIL",
    defaultFill: 0.9,
  },
  DROPPER_BOTTLE: {
    kind: "DROPPER_BOTTLE",
    family: "BOTTLE",
    name: { ar: "زجاجة قطارة", en: "Dropper bottle" },
    description: { ar: "زجاجة سيروم بعنق DIN 18 وقطارة", en: "Serum bottle with a DIN 18 neck and glass dropper" },
    materials: ["GLASS_AMBER", "GLASS_CLEAR", "GLASS_FROSTED"],
    defaultMaterial: "GLASS_FROSTED",
    closures: ["DROPPER", "SCREW_CAP"],
    defaultClosure: "DROPPER",
    neck: P.DIN18,
    limits: { D: { min: 22, max: 50 }, H: { min: 50, max: 130 } },
    presets: [
      { id: "dropper-30", name: { ar: "30 مل", en: "30 ml" }, capacityMl: 30, dims: { D: 32, H: 78 }, neck: P.DIN18, source: "TricorBraun / Premium Vials 30 ml euro dropper, 18 mm: Ø31.8-32.6 x 77.8-78.9 mm" },
      { id: "dropper-50", name: { ar: "50 مل", en: "50 ml" }, capacityMl: 50, dims: { D: 37, H: 92 }, neck: P.DIN18, source: "50 ml euro dropper, 18 mm (approx. Ø37 x 92 mm)" },
    ],
    defaultPresetId: "dropper-30",
    surfaces: ["WRAP", "FRONT", "BACK", "SHRINK_SLEEVE"],
    defaultSurfaces: ["WRAP"],
    fillable: true,
    defaultLiquid: "SERUM",
    defaultFill: 0.82,
  },
  PUMP_BOTTLE: {
    kind: "PUMP_BOTTLE",
    family: "BOTTLE",
    name: { ar: "زجاجة مضخة", en: "Pump bottle" },
    description: { ar: "زجاجة بوسطن بلاستيك بعنق 24-410 ومضخة لوشن", en: "Plastic Boston round with a 24-410 neck and lotion pump" },
    materials: ["PET_CLEAR", "HDPE_WHITE"],
    defaultMaterial: "HDPE_WHITE",
    closures: ["LOTION_PUMP", "SCREW_CAP"],
    defaultClosure: "LOTION_PUMP",
    neck: P.F24_410,
    limits: { D: { min: 40, max: 90 }, H: { min: 90, max: 240 } },
    presets: [
      { id: "pump-250", name: { ar: "250 مل", en: "250 ml" }, capacityMl: 250, dims: { D: 58, H: 129 }, neck: P.F24_410, source: "Berlin Packaging 250 ml PET Boston round 24/410: Ø58 x 129 mm" },
      { id: "pump-500", name: { ar: "500 مل", en: "500 ml" }, capacityMl: 500, dims: { D: 72, H: 162 }, neck: P.F24_410, source: "500 ml PET Boston round 24/410 (approx. Ø72 x 162 mm)" },
    ],
    defaultPresetId: "pump-250",
    surfaces: ["WRAP", "FRONT", "BACK", "SHRINK_SLEEVE"],
    defaultSurfaces: ["FRONT", "BACK"],
    fillable: true,
    defaultLiquid: "CREAM",
    defaultFill: 0.9,
  },
  PERFUME_SQUARE: {
    kind: "PERFUME_SQUARE",
    family: "BOTTLE",
    name: { ar: "زجاجة عطر مربعة", en: "Square perfume bottle" },
    description: { ar: "زجاجة عطر زجاج سميك بعنق FEA 15 وبخاخ", en: "Heavy-base glass flacon with FEA 15 crimp neck and mist pump" },
    materials: ["GLASS_CLEAR", "GLASS_FROSTED"],
    defaultMaterial: "GLASS_CLEAR",
    closures: ["MIST_PUMP"],
    defaultClosure: "MIST_PUMP",
    neck: P.FEA15,
    limits: { D: { min: 28, max: 70 }, H: { min: 60, max: 170 }, G: { min: 18, max: 70 } },
    presets: [
      { id: "perfume-50", name: { ar: "50 مل", en: "50 ml" }, capacityMl: 50, dims: { D: 40, H: 76, G: 40 }, neck: P.FEA15, source: "Square FEA 15 flacon 50 ml (approx. 40 x 40 x 76 mm)" },
      { id: "perfume-100", name: { ar: "100 مل", en: "100 ml" }, capacityMl: 100, dims: { D: 45, H: 100, G: 45 }, neck: P.FEA15, source: "Vaza 100 ml square perfume bottle, 15 mm crimp: 45 x 45 x 100 mm" },
    ],
    defaultPresetId: "perfume-50",
    surfaces: ["FRONT", "BACK"],
    defaultSurfaces: ["FRONT"],
    fillable: true,
    defaultLiquid: "PERFUME",
    defaultFill: 0.86,
  },
  WIDE_JAR: {
    kind: "WIDE_JAR",
    family: "JAR",
    name: { ar: "برطمان واسع الفوهة", en: "Wide-mouth jar" },
    description: { ar: "برطمان زجاج بغطاء معدني للعسل والكريمات", en: "Glass jar with a twist-off lug lid for honey, jam and creams" },
    materials: ["GLASS_CLEAR", "GLASS_AMBER", "GLASS_FROSTED", "PET_CLEAR"],
    defaultMaterial: "GLASS_CLEAR",
    closures: ["LUG_LID"],
    defaultClosure: "LUG_LID",
    neck: P.TO63,
    limits: { D: { min: 45, max: 110 }, H: { min: 40, max: 160 }, taper: { min: 0, max: 12 } },
    presets: [
      { id: "jar-100g", name: { ar: "100 جم", en: "100 g" }, capacityMl: 70, dims: { D: 54, H: 52 }, neck: P.TO53, source: "100 g honey jar, TO 53 (approx. Ø54 x 52 mm; honey 1.42 g/ml)" },
      { id: "jar-250g", name: { ar: "250 جم", en: "250 g" }, capacityMl: 180, dims: { D: 68, H: 76 }, neck: P.TO63, source: "250 g honey jar, TO 63 (approx. Ø68 x 76 mm)" },
      { id: "jar-500g", name: { ar: "500 جم", en: "500 g" }, capacityMl: 370, dims: { D: 71.8, H: 122 }, neck: P.TO63, source: "Aura 370 ml / 500 g honey jar, TO 63: Ø71.8 x 122 mm" },
      { id: "cream-100", name: { ar: "كريم 100 مل", en: "Cream 100 ml" }, capacityMl: 100, dims: { D: 76, H: 40, taper: 6 }, neck: P.TO70, source: "Tapered cosmetic jar 100 ml, TO 70 (approx. Ø76 x 40 mm)" },
    ],
    defaultPresetId: "jar-250g",
    surfaces: ["WRAP", "FRONT", "BACK", "LID", "SHRINK_SLEEVE"],
    defaultSurfaces: ["WRAP", "LID"],
    fillable: true,
    defaultLiquid: "HONEY",
    defaultFill: 0.9,
  },
  CAN: {
    kind: "CAN",
    family: "CAN",
    name: { ar: "علبة ألومنيوم", en: "Aluminium can" },
    description: { ar: "علبة مشروبات من قطعتين بغطاء فتح سهل", en: "Two-piece beverage can with a stay-on-tab end" },
    materials: ["ALUMINIUM"],
    defaultMaterial: "ALUMINIUM",
    closures: ["CAN_END"],
    defaultClosure: "CAN_END",
    neck: P.END_202,
    limits: { D: { min: 50, max: 70 }, H: { min: 80, max: 170 } },
    presets: [
      { id: "can-250-slim", name: { ar: "250 مل رفيعة", en: "250 ml slim" }, capacityMl: 250, dims: { D: 53.4, H: 134 }, neck: P.END_200, source: "Ardagh 250 ml slim: Ø53.4 x 134.0 mm, 200 end" },
      { id: "can-330", name: { ar: "330 مل عادية", en: "330 ml standard" }, capacityMl: 330, dims: { D: 66.2, H: 115.2 }, neck: P.END_202, source: "Crown 330 ml standard: Ø66 x 115.2 mm, 202 end" },
      { id: "can-330-sleek", name: { ar: "330 مل سليك", en: "330 ml sleek" }, capacityMl: 330, dims: { D: 58.1, H: 145.4 }, neck: P.END_202, source: "Ardagh 330 ml sleek: Ø58.1 x 145.4 mm" },
    ],
    defaultPresetId: "can-330",
    surfaces: ["WRAP", "SHRINK_SLEEVE"],
    defaultSurfaces: ["SHRINK_SLEEVE"],
    fillable: false,
    defaultLiquid: "COLA",
    defaultFill: 0.95,
  },
  ROUND_TIN: {
    kind: "ROUND_TIN",
    family: "TIN",
    name: { ar: "علبة صفيح دائرية", en: "Round metal tin" },
    description: { ar: "علبة صفيح بغطاء منزلق للشموع والبلسم والحلوى", en: "Tinplate tin with a slip lid for candles, balms and sweets" },
    materials: ["TINPLATE"],
    defaultMaterial: "TINPLATE",
    closures: ["SLIP_LID"],
    defaultClosure: "SLIP_LID",
    limits: { D: { min: 40, max: 160 }, H: { min: 15, max: 120 } },
    presets: [
      { id: "tin-50", name: { ar: "50 مل مسطحة", en: "50 ml flat" }, capacityMl: 50, dims: { D: 60, H: 22 }, source: "Flat balm tin (approx. Ø60 x 22 mm)" },
      { id: "tin-100", name: { ar: "100 مل", en: "100 ml" }, capacityMl: 100, dims: { D: 65, H: 38 }, source: "Deep round tin 100 ml (approx. Ø65 x 38 mm)" },
      { id: "tin-200", name: { ar: "200 مل", en: "200 ml" }, capacityMl: 200, dims: { D: 75, H: 54 }, source: "Distrebution 200 ml slip-lid tin: Ø75 x 54 mm" },
    ],
    defaultPresetId: "tin-200",
    surfaces: ["WRAP", "LID"],
    defaultSurfaces: ["WRAP", "LID"],
    fillable: false,
    defaultLiquid: "CREAM",
    defaultFill: 0,
  },
  STAND_UP_POUCH: {
    kind: "STAND_UP_POUCH",
    family: "POUCH",
    name: { ar: "كيس واقف بسوستة", en: "Stand-up pouch" },
    description: { ar: "كيس دوي باك بقاعدة وسوستة للبن والمكسرات والتوابل", en: "Doypack with bottom gusset and zip for coffee, nuts and spices" },
    materials: ["KRAFT_POUCH", "WHITE_POUCH"],
    defaultMaterial: "KRAFT_POUCH",
    closures: ["ZIP_SEAL"],
    defaultClosure: "ZIP_SEAL",
    limits: { D: { min: 80, max: 300 }, H: { min: 120, max: 400 }, G: { min: 40, max: 140 } },
    presets: [
      { id: "pouch-250g", name: { ar: "250 جم", en: "250 g" }, capacityMl: 700, dims: { D: 160, H: 230, G: 80 }, source: "250 g coffee doypack 160 x 230 + 80 mm (Vivopak / Epac range)" },
      { id: "pouch-500g", name: { ar: "500 جم", en: "500 g" }, capacityMl: 1400, dims: { D: 190, H: 275, G: 100 }, source: "Vivopak 500 g: 190 x 275 + 100 mm" },
      { id: "pouch-1kg", name: { ar: "1 كجم", en: "1 kg" }, capacityMl: 2800, dims: { D: 235, H: 300, G: 110 }, source: "Epac 1 kg: 235 x 300 x 110 mm" },
    ],
    defaultPresetId: "pouch-250g",
    surfaces: ["FRONT", "BACK"],
    defaultSurfaces: ["FRONT"],
    fillable: false,
    defaultLiquid: "CREAM",
    defaultFill: 0,
  },
  SQUEEZE_TUBE: {
    kind: "SQUEEZE_TUBE",
    family: "TUBE",
    name: { ar: "أنبوبة كريم", en: "Squeeze tube" },
    description: { ar: "أنبوبة بلاستيك للكريمات بغطاء قلاب أو لولبي", en: "PE cosmetic tube with flip-top or screw cap" },
    materials: ["PE_TUBE_WHITE"],
    defaultMaterial: "PE_TUBE_WHITE",
    closures: ["FLIP_TOP", "SCREW_TUBE_CAP"],
    defaultClosure: "FLIP_TOP",
    limits: { D: { min: 19, max: 60 }, H: { min: 60, max: 220 } },
    presets: [
      { id: "tube-50", name: { ar: "50 مل", en: "50 ml" }, capacityMl: 50, dims: { D: 30, H: 120 }, source: "Ø30 mm tube, 74-168 mm sealed length = 30-90 ml" },
      { id: "tube-100", name: { ar: "100 مل", en: "100 ml" }, capacityMl: 100, dims: { D: 40, H: 160 }, source: "Ø40 mm flip-top tube, 85-175 mm = 50-150 ml" },
    ],
    defaultPresetId: "tube-50",
    surfaces: ["WRAP"],
    defaultSurfaces: ["WRAP"],
    fillable: false,
    defaultLiquid: "CREAM",
    defaultFill: 0,
  },
};

// ---------------------------------------------------------------------------------------------
// Appearance data shared by the 3D view and the designer UI
// ---------------------------------------------------------------------------------------------

export const CLOSURE_COLORS = {
  WHITE: { hex: "#f3f3f1", metal: false, name: { ar: "أبيض", en: "White" } },
  BLACK: { hex: "#1f1f22", metal: false, name: { ar: "أسود", en: "Black" } },
  GOLD: { hex: "#c9a14a", metal: true, name: { ar: "ذهبي", en: "Gold" } },
  SILVER: { hex: "#c3c7cc", metal: true, name: { ar: "فضي", en: "Silver" } },
  BLUE: { hex: "#1f5fbf", metal: false, name: { ar: "أزرق", en: "Blue" } },
  RED: { hex: "#c3202c", metal: false, name: { ar: "أحمر", en: "Red" } },
  GREEN: { hex: "#2c8a4b", metal: false, name: { ar: "أخضر", en: "Green" } },
  NATURAL: { hex: "#e8e4d8", metal: false, name: { ar: "طبيعي", en: "Natural" } },
} as const satisfies Record<string, { hex: string; metal: boolean; name: LocalizedText }>;
export type ClosureColorCode = keyof typeof CLOSURE_COLORS;

/** clarity: 1 = water-clear, 0 = opaque (cream). */
export const LIQUIDS = {
  WATER: { hex: "#d8ecfb", clarity: 1, name: { ar: "مياه", en: "Water" } },
  ORANGE_JUICE: { hex: "#f39a1e", clarity: 0.15, name: { ar: "عصير برتقال", en: "Orange juice" } },
  MANGO: { hex: "#f4ad25", clarity: 0.05, name: { ar: "مانجو", en: "Mango" } },
  HIBISCUS: { hex: "#8e1030", clarity: 0.55, name: { ar: "كركديه", en: "Hibiscus" } },
  HONEY: { hex: "#d88a12", clarity: 0.6, name: { ar: "عسل", en: "Honey" } },
  OLIVE_OIL: { hex: "#b2a52c", clarity: 0.7, name: { ar: "زيت زيتون", en: "Olive oil" } },
  SERUM: { hex: "#f1d79a", clarity: 0.85, name: { ar: "سيروم", en: "Serum" } },
  PERFUME: { hex: "#f4e3b8", clarity: 0.95, name: { ar: "عطر", en: "Perfume" } },
  CREAM: { hex: "#f6f0e7", clarity: 0, name: { ar: "كريم", en: "Cream" } },
  COLA: { hex: "#3b1a0c", clarity: 0.3, name: { ar: "كولا", en: "Cola" } },
} as const satisfies Record<string, { hex: string; clarity: number; name: LocalizedText }>;
export type LiquidCode = keyof typeof LIQUIDS;

export const VESSEL_MATERIALS: Record<VesselMaterialCode, { name: LocalizedText; transparent: boolean }> = {
  GLASS_CLEAR: { name: { ar: "زجاج شفاف", en: "Clear glass" }, transparent: true },
  GLASS_AMBER: { name: { ar: "زجاج عسلي", en: "Amber glass" }, transparent: true },
  GLASS_FROSTED: { name: { ar: "زجاج مصنفر", en: "Frosted glass" }, transparent: true },
  PET_CLEAR: { name: { ar: "بلاستيك PET شفاف", en: "Clear PET" }, transparent: true },
  HDPE_WHITE: { name: { ar: "بلاستيك HDPE أبيض", en: "White HDPE" }, transparent: false },
  ALUMINIUM: { name: { ar: "ألومنيوم", en: "Aluminium" }, transparent: false },
  TINPLATE: { name: { ar: "صفيح", en: "Tinplate" }, transparent: false },
  KRAFT_POUCH: { name: { ar: "كرافت مبطن", en: "Kraft laminate" }, transparent: false },
  WHITE_POUCH: { name: { ar: "أبيض مطفي", en: "Matte white laminate" }, transparent: false },
  PE_TUBE_WHITE: { name: { ar: "بولي إيثيلين أبيض", en: "White PE" }, transparent: false },
};

export const CLOSURE_NAMES: Record<ClosureKind, LocalizedText> = {
  SCREW_CAP: { ar: "غطاء لولبي", en: "Screw cap" },
  SPORTS_CAP: { ar: "غطاء رياضي", en: "Sports cap" },
  DROPPER: { ar: "قطارة", en: "Dropper" },
  LOTION_PUMP: { ar: "مضخة لوشن", en: "Lotion pump" },
  MIST_PUMP: { ar: "بخاخ عطر", en: "Mist pump" },
  LUG_LID: { ar: "غطاء معدني", en: "Lug lid" },
  CAN_END: { ar: "غطاء بحلقة فتح", en: "Stay-on-tab end" },
  SLIP_LID: { ar: "غطاء منزلق", en: "Slip lid" },
  ZIP_SEAL: { ar: "سوستة", en: "Zip seal" },
  FLIP_TOP: { ar: "غطاء قلاب", en: "Flip-top cap" },
  SCREW_TUBE_CAP: { ar: "غطاء لولبي", en: "Screw cap" },
};

// ---------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------

export function presetFor(kind: VesselKind, id?: string): VesselPreset {
  const def = VESSELS[kind];
  return def.presets.find((p) => p.id === id) ?? def.presets.find((p) => p.id === def.defaultPresetId) ?? def.presets[0];
}

/** Clamp dims to the kind's limits. */
export function clampDims(kind: VesselKind, dims: VesselDims): VesselDims {
  const l = VESSELS[kind].limits;
  const c = (v: number | undefined, r?: Range) => (v === undefined || !r ? v : Math.min(r.max, Math.max(r.min, v)));
  return { D: c(dims.D, l.D)!, H: c(dims.H, l.H)!, G: c(dims.G, l.G), taper: c(dims.taper, l.taper) };
}

/** Height of the closure above the top of the container (mm), for framing and boxes. */
export function closureHeightAbove(closure: ClosureKind): Mm {
  switch (closure) {
    case "SCREW_CAP":
      return 3;
    case "SPORTS_CAP":
      return 17;
    case "DROPPER":
      return 29;
    case "LOTION_PUMP":
      return 28;
    case "MIST_PUMP":
      return 19;
    case "LUG_LID":
      return 1.8;
    case "CAN_END":
      return 0.6;
    case "SLIP_LID":
      return 0.6;
    default:
      return 0;
  }
}

/** Outer envelope of the closed container (mm): what a box for it must hold. */
export function vesselEnvelope(kind: VesselKind, dims: VesselDims, closure: ClosureKind = VESSELS[kind].defaultClosure, neck?: NeckFinish) {
  const profile = buildProfile(kind, dims, neck);
  if (kind === "STAND_UP_POUCH") {
    const p = pouchDims(dims);
    return { width: p.W, depth: p.G, height: p.H };
  }
  if (kind === "SQUEEZE_TUBE") {
    const t = tubeDims(dims);
    return { width: Math.PI * t.R, depth: 2 * t.R, height: t.totalH };
  }
  let maxR = 0;
  for (const p of profile.outer) maxR = Math.max(maxR, p.r);
  const lidR = kind === "ROUND_TIN" ? dims.D / 2 + 0.6 : 0;
  const w = 2 * Math.max(maxR, lidR);
  const depth = profile.section.kind === "roundedRect" ? w * profile.section.depthRatio : w;
  return { width: w, depth, height: dims.H + closureHeightAbove(closure) };
}

export interface VesselConfig {
  kind: VesselKind;
  dims: VesselDims;
  neck?: NeckFinish;
  surfaces: PrintSurfaceKind[];
}

export interface VesselDescription {
  profile: VesselProfile;
  labels: LabelSpec[];
  brimfulMl: number;
  envelope: { width: Mm; depth: Mm; height: Mm };
}

/** Everything a page needs about a configured container: profile, print areas, capacity. */
export function describeVessel(cfg: VesselConfig): VesselDescription {
  const dims = clampDims(cfg.kind, cfg.dims);
  const profile = buildProfile(cfg.kind, dims, cfg.neck);
  const def = VESSELS[cfg.kind];
  const surfaces = cfg.surfaces.filter((s) => def.surfaces.includes(s));
  const revolved = cfg.kind !== "STAND_UP_POUCH" && cfg.kind !== "SQUEEZE_TUBE";
  return {
    profile,
    labels: labelSpecsFor(cfg.kind, dims, profile, surfaces),
    brimfulMl: revolved ? Math.round(brimfulVolumeMl(profile)) : 0,
    envelope: vesselEnvelope(cfg.kind, dims, undefined, cfg.neck),
  };
}

export { tinLidHeight };
