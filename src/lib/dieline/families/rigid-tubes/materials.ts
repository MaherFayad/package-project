import type { FamilyMaterial, FamilyMaterialCode } from "./types";

/**
 * Calipers: greyboard 1.5 / 2 / 2.5 mm + 157 gsm art paper wrap (~0.15 mm); spiral tube wall
 * 1.5 mm; B flute ~3 mm, BC double wall ~7 mm, AAA triple wall ~15 mm; papers by gsm.
 */
export const FAMILY_MATERIALS: Record<FamilyMaterialCode, FamilyMaterial> = {
  GREYBOARD_WRAP: { code: "GREYBOARD_WRAP", family: "RIGID", thicknessMm: 2.15, shared: true, name: { ar: "كرتون رمادي 2 مم مكسو بورق مطبوع", en: "2 mm greyboard, printed wrap" } },
  GREYBOARD_1500_WRAP: { code: "GREYBOARD_1500_WRAP", family: "RIGID", thicknessMm: 1.65, shared: false, name: { ar: "كرتون رمادي 1.5 مم مكسو بورق مطبوع", en: "1.5 mm greyboard, printed wrap" } },
  GREYBOARD_2500_WRAP: { code: "GREYBOARD_2500_WRAP", family: "RIGID", thicknessMm: 2.65, shared: false, name: { ar: "كرتون رمادي 2.5 مم مكسو بورق مطبوع", en: "2.5 mm greyboard, printed wrap" } },
  KRAFT_TUBE: { code: "KRAFT_TUBE", family: "TUBE", thicknessMm: 1.5, shared: true, name: { ar: "أنبوب كرافت ملفوف بملصق مطبوع", en: "Kraft tube, printed label" } },
  WHITE_TUBE: { code: "WHITE_TUBE", family: "TUBE", thicknessMm: 1.5, shared: false, name: { ar: "أنبوب ببطانة بيضاء وملصق مطبوع", en: "White-lined tube, printed label" } },
  B_FLUTE_KRAFT: { code: "B_FLUTE_KRAFT", family: "CORRUGATED", thicknessMm: 3, shared: true, name: { ar: "كرتون مضلع طبقة واحدة B", en: "Single wall B flute" } },
  BC_FLUTE_KRAFT: { code: "BC_FLUTE_KRAFT", family: "CORRUGATED", thicknessMm: 7, shared: false, name: { ar: "كرتون مضلع مزدوج BC", en: "Double wall BC flute" } },
  AAA_TRIPLE_KRAFT: { code: "AAA_TRIPLE_KRAFT", family: "CORRUGATED", thicknessMm: 15, shared: false, name: { ar: "كرتون مضلع ثلاثي الطبقات", en: "Triple wall corrugated" } },
  OFFSET_PAPER_100: { code: "OFFSET_PAPER_100", family: "ENVELOPE", thicknessMm: 0.12, shared: false, name: { ar: "ورق أوفست أبيض 100 جم", en: "White offset 100 gsm" } },
  KRAFT_PAPER_120: { code: "KRAFT_PAPER_120", family: "ENVELOPE", thicknessMm: 0.16, shared: false, name: { ar: "ورق كرافت بني 120 جم", en: "Brown kraft 120 gsm" } },
  CARD_PAPER_160: { code: "CARD_PAPER_160", family: "ENVELOPE", thicknessMm: 0.2, shared: false, name: { ar: "ورق ملون 160 جم", en: "Coloured paper 160 gsm" } },
  PADDED_KRAFT: { code: "PADDED_KRAFT", family: "ENVELOPE", thicknessMm: 3.5, shared: false, name: { ar: "كرافت مبطن", en: "Padded kraft" } },
};
