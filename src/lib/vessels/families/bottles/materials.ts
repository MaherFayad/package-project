import type { LocalizedText } from "@/types";
import type { BottleMaterial, BottleMaterialCode, ContentCode } from "./types";

/**
 * `coreMaterial` is the core look the 3D view uses; the library passes `hex` as a tint whenever
 * the two codes differ (X-01), and the tint replaces the core colour and absorption colour. Green
 * and cobalt glass ride on the dense GLASS_AMBER base (opacity 0.55, short absorption distance):
 * on the clear base (opacity 0.16) the tint read as pale mint / lavender, i.e. nearly flint
 * (R5-3Q-F-04). Translucent natural HDPE / PP use the frosted (milky) look; amber PET uses amber
 * glass, which is the right colour.
 */
export const BOTTLE_MATERIALS: Record<BottleMaterialCode, BottleMaterial> = {
  GLASS_FLINT: { code: "GLASS_FLINT", name: { ar: "زجاج شفاف", en: "Flint glass" }, kind: "GLASS", hex: "#eef4f2", transmission: 0.92, frosted: false, recyclingCode: "70 GL", uvBlock: "low", coreMaterial: "GLASS_CLEAR" },
  GLASS_AMBER: { code: "GLASS_AMBER", name: { ar: "زجاج عسلي", en: "Amber glass" }, kind: "GLASS", hex: "#8a4b12", transmission: 0.55, frosted: false, recyclingCode: "72 GL", uvBlock: "high", coreMaterial: "GLASS_AMBER" },
  GLASS_GREEN: { code: "GLASS_GREEN", name: { ar: "زجاج أخضر", en: "Green glass" }, kind: "GLASS", hex: "#2f5a2c", transmission: 0.5, frosted: false, recyclingCode: "71 GL", uvBlock: "medium", coreMaterial: "GLASS_AMBER" },
  GLASS_COBALT: { code: "GLASS_COBALT", name: { ar: "زجاج أزرق كوبالت", en: "Cobalt blue glass" }, kind: "GLASS", hex: "#1d3f8f", transmission: 0.45, frosted: false, recyclingCode: "70 GL", uvBlock: "low", coreMaterial: "GLASS_AMBER" },
  GLASS_FROSTED: { code: "GLASS_FROSTED", name: { ar: "زجاج مصنفر", en: "Frosted glass" }, kind: "GLASS", hex: "#e4ebe9", transmission: 0.6, frosted: true, recyclingCode: "70 GL", uvBlock: "low", coreMaterial: "GLASS_FROSTED" },
  PET_CLEAR: { code: "PET_CLEAR", name: { ar: "بلاستيك PET شفاف", en: "Clear PET" }, kind: "PET", hex: "#f2f7fa", transmission: 0.95, frosted: false, recyclingCode: "1 PET", uvBlock: "low", coreMaterial: "PET_CLEAR" },
  PET_AMBER: { code: "PET_AMBER", name: { ar: "بلاستيك PET عسلي", en: "Amber PET" }, kind: "PET", hex: "#9a5418", transmission: 0.6, frosted: false, recyclingCode: "1 PET", uvBlock: "high", coreMaterial: "GLASS_AMBER" },
  PET_BLUE: { code: "PET_BLUE", name: { ar: "بلاستيك PET أزرق فاتح", en: "Light blue PET" }, kind: "PET", hex: "#cfe6f5", transmission: 0.88, frosted: false, recyclingCode: "1 PET", uvBlock: "low", coreMaterial: "PET_CLEAR" },
  HDPE_WHITE: { code: "HDPE_WHITE", name: { ar: "بلاستيك HDPE أبيض", en: "White HDPE" }, kind: "HDPE", hex: "#f4f4f1", transmission: 0, frosted: false, recyclingCode: "2 HDPE", uvBlock: "high", coreMaterial: "HDPE_WHITE" },
  HDPE_NATURAL: { code: "HDPE_NATURAL", name: { ar: "بلاستيك HDPE طبيعي", en: "Natural HDPE" }, kind: "HDPE", hex: "#ece9df", transmission: 0.35, frosted: true, recyclingCode: "2 HDPE", uvBlock: "medium", coreMaterial: "GLASS_FROSTED" },
  HDPE_COLOURED: { code: "HDPE_COLOURED", name: { ar: "بلاستيك HDPE ملون", en: "Coloured HDPE" }, kind: "HDPE", hex: "#2a2d33", transmission: 0, frosted: false, recyclingCode: "2 HDPE", uvBlock: "high", coreMaterial: "HDPE_WHITE" },
  PP_WHITE: { code: "PP_WHITE", name: { ar: "بلاستيك PP أبيض", en: "White PP" }, kind: "PP", hex: "#f6f6f4", transmission: 0, frosted: false, recyclingCode: "5 PP", uvBlock: "high", coreMaterial: "HDPE_WHITE" },
  PP_NATURAL: { code: "PP_NATURAL", name: { ar: "بلاستيك PP شفاف", en: "Translucent PP" }, kind: "PP", hex: "#eef0ee", transmission: 0.55, frosted: true, recyclingCode: "5 PP", uvBlock: "low", coreMaterial: "GLASS_FROSTED" },
};

/** Fill (product) appearance. clarity: 1 = water clear, 0 = opaque. density g/ml for grams presets. */
export const CONTENTS: Record<ContentCode, { name: LocalizedText; hex: string; clarity: number; density: number }> = {
  WATER: { name: { ar: "مياه", en: "Water" }, hex: "#d8ecfb", clarity: 1, density: 1 },
  JUICE: { name: { ar: "عصير", en: "Juice" }, hex: "#f39a1e", clarity: 0.15, density: 1.05 },
  RED_WINE: { name: { ar: "نبيذ أحمر", en: "Red wine" }, hex: "#5a0d1c", clarity: 0.35, density: 0.99 },
  WHITE_WINE: { name: { ar: "نبيذ أبيض", en: "White wine" }, hex: "#efe2a2", clarity: 0.9, density: 0.99 },
  SPARKLING: { name: { ar: "مشروب فوار", en: "Sparkling drink" }, hex: "#f1e6b0", clarity: 0.9, density: 1 },
  BEER: { name: { ar: "بيرة", en: "Beer" }, hex: "#c98a1d", clarity: 0.6, density: 1.01 },
  OLIVE_OIL: { name: { ar: "زيت زيتون", en: "Olive oil" }, hex: "#b2a52c", clarity: 0.7, density: 0.92 },
  HOT_SAUCE: { name: { ar: "صلصة حارة", en: "Hot sauce" }, hex: "#b8261a", clarity: 0.05, density: 1.05 },
  SPIRIT: { name: { ar: "مشروب كحولي", en: "Spirit" }, hex: "#e9d6a6", clarity: 0.95, density: 0.95 },
  MILK: { name: { ar: "حليب", en: "Milk" }, hex: "#fbfaf4", clarity: 0, density: 1.03 },
  SYRUP: { name: { ar: "شراب", en: "Syrup" }, hex: "#a23c1c", clarity: 0.45, density: 1.25 },
  COLA: { name: { ar: "مشروب غازي", en: "Soft drink" }, hex: "#3b1a0c", clarity: 0.3, density: 1.04 },
  SHAMPOO: { name: { ar: "شامبو", en: "Shampoo" }, hex: "#e8d9f0", clarity: 0.1, density: 1.02 },
  DETERGENT: { name: { ar: "منظف سائل", en: "Liquid detergent" }, hex: "#3f8fd8", clarity: 0.2, density: 1.03 },
  MOTOR_OIL: { name: { ar: "زيت محركات", en: "Motor oil" }, hex: "#c49a2a", clarity: 0.6, density: 0.87 },
  HONEY: { name: { ar: "عسل", en: "Honey" }, hex: "#d88a12", clarity: 0.6, density: 1.42 },
  JAM: { name: { ar: "مربى", en: "Jam" }, hex: "#9e1b2c", clarity: 0.2, density: 1.33 },
  NUT_BUTTER: { name: { ar: "زبدة فول سوداني", en: "Peanut butter" }, hex: "#b27a3c", clarity: 0, density: 1.1 },
  PICKLES: { name: { ar: "مخلل", en: "Pickles" }, hex: "#9aa13a", clarity: 0.4, density: 1.05 },
  TAHINI: { name: { ar: "طحينة", en: "Tahini" }, hex: "#c9a873", clarity: 0, density: 1.1 },
  HALAWA: { name: { ar: "حلاوة طحينية", en: "Halawa" }, hex: "#d8c39a", clarity: 0, density: 1.25 },
  PAINT: { name: { ar: "دهان", en: "Paint" }, hex: "#f0f0ee", clarity: 0, density: 1.3 },
  NONE: { name: { ar: "فارغ", en: "Empty" }, hex: "#ffffff", clarity: 1, density: 1 },
};
