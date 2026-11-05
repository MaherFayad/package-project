import type { LabelFinish, LabelFinishCode, LabelStock, LabelStockCode, PrintSurfaceKind } from "./types";

const LABELS: PrintSurfaceKind[] = ["WRAP", "FRONT", "BACK", "NECK", "LID"];

/**
 * Label face stocks that Egyptian narrow-web (flexo / digital) label printers run.
 * PETG shrink: ~75-79% max TD shrink at 100 C (Transcendia SP700A, UPM RafShrink PETG TDO 45);
 * we design to 70% to keep artwork distortion predictable.
 */
export const LABEL_STOCKS: Record<LabelStockCode, LabelStock> = {
  PAPER_SEMIGLOSS: {
    code: "PAPER_SEMIGLOSS",
    name: { ar: "ورق نصف لامع", en: "Semi-gloss paper" },
    thicknessMicron: 80,
    waterproof: false,
    transparent: false,
    metallic: false,
    surfaces: LABELS,
    bestFor: { ar: "العسل والمربى والمنتجات الجافة", en: "Honey, jams and dry goods" },
  },
  WHITE_BOPP: {
    code: "WHITE_BOPP",
    name: { ar: "بي أو بي بي أبيض", en: "White BOPP" },
    thicknessMicron: 60,
    waterproof: true,
    transparent: false,
    metallic: false,
    surfaces: LABELS,
    bestFor: { ar: "المياه والعصائر ومستحضرات التجميل", en: "Water, juice, cosmetics and anything chilled" },
  },
  CLEAR_BOPP: {
    code: "CLEAR_BOPP",
    name: { ar: "بي أو بي بي شفاف", en: "Clear BOPP" },
    thicknessMicron: 50,
    waterproof: true,
    transparent: true,
    metallic: false,
    surfaces: LABELS,
    bestFor: { ar: "مظهر بدون ملصق على الزجاج", en: "No-label look on glass and clear PET" },
  },
  METALLIC_BOPP: {
    code: "METALLIC_BOPP",
    name: { ar: "بي أو بي بي معدني فضي", en: "Metallic silver BOPP" },
    thicknessMicron: 50,
    waterproof: true,
    transparent: false,
    metallic: true,
    surfaces: LABELS,
    bestFor: { ar: "العطور ومنتجات الهدايا", en: "Perfume and premium gifts" },
  },
  PETG_SHRINK: {
    code: "PETG_SHRINK",
    name: { ar: "فيلم انكماش PETG", en: "PETG shrink film" },
    thicknessMicron: 45,
    waterproof: true,
    transparent: true,
    metallic: false,
    shrink: { maxTdPct: 75, designLimitPct: 70, mdPct: 3 },
    surfaces: ["SHRINK_SLEEVE"],
    bestFor: { ar: "تغطية العبوة بالكامل من 360 درجة", en: "Full 360 degree, top-to-bottom decoration" },
  },
};

export const LABEL_FINISHES: Record<LabelFinishCode, LabelFinish> = {
  NONE: { code: "NONE", name: { ar: "بدون", en: "None" } },
  GLOSS_VARNISH: { code: "GLOSS_VARNISH", name: { ar: "ورنيش لامع", en: "Gloss varnish" }, stocks: ["PAPER_SEMIGLOSS", "WHITE_BOPP", "CLEAR_BOPP", "METALLIC_BOPP"] },
  MATTE_VARNISH: { code: "MATTE_VARNISH", name: { ar: "ورنيش مطفي", en: "Matte varnish" } },
  GLOSS_LAMINATION: { code: "GLOSS_LAMINATION", name: { ar: "سلوفان لامع", en: "Gloss lamination" }, stocks: ["PAPER_SEMIGLOSS", "WHITE_BOPP", "CLEAR_BOPP", "METALLIC_BOPP"] },
  MATTE_LAMINATION: { code: "MATTE_LAMINATION", name: { ar: "سلوفان مطفي", en: "Matte lamination" }, stocks: ["PAPER_SEMIGLOSS", "WHITE_BOPP", "CLEAR_BOPP", "METALLIC_BOPP"] },
  HOT_FOIL: { code: "HOT_FOIL", name: { ar: "بصمة ذهبي", en: "Hot foil" }, stocks: ["PAPER_SEMIGLOSS", "WHITE_BOPP", "CLEAR_BOPP"] },
  SPOT_UV: { code: "SPOT_UV", name: { ar: "يو في موضعي", en: "Spot UV" }, stocks: ["PAPER_SEMIGLOSS", "WHITE_BOPP", "METALLIC_BOPP"] },
  EMBOSS: { code: "EMBOSS", name: { ar: "بارز", en: "Emboss" }, stocks: ["PAPER_SEMIGLOSS"] },
};

/** Finishes allowed on a stock. */
export function finishesForStock(stock: LabelStockCode): LabelFinishCode[] {
  return (Object.keys(LABEL_FINISHES) as LabelFinishCode[]).filter((f) => {
    const allowed = LABEL_FINISHES[f].stocks;
    if (stock === "PETG_SHRINK") return f === "NONE" || f === "MATTE_VARNISH";
    return !allowed || allowed.includes(stock);
  });
}

/** Stocks allowed on a surface kind. */
export function stocksForSurface(kind: PrintSurfaceKind): LabelStockCode[] {
  return (Object.keys(LABEL_STOCKS) as LabelStockCode[]).filter((s) => LABEL_STOCKS[s].surfaces.includes(kind));
}
