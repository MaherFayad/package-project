import type { LocalizedText, MaterialCode } from "@/types";

/**
 * Foodservice substrates. Codes that already exist in `MATERIAL_CODES` are reused as is;
 * the rest are new and must be added to `src/types/material.ts`, the seed and BOARD_SPECS
 * by the integrator. Calipers are typical mill values (confirm per supplier).
 */
export const FOOD_MATERIAL_CODES = [
  // existing core boards
  "SBS_300",
  "SBS_350",
  "E_FLUTE_KRAFT",
  "E_FLUTE_WHITE",
  "B_FLUTE_KRAFT",
  // new
  "CUK_300", //          coated unbleached kraft board, grease resistant (burger / noodle / bakery)
  "CUPSTOCK_PE_280", //  cupstock 260-280 gsm, PE coated one side (hot cups, bowls)
  "CUPSTOCK_AQ_280", //  cupstock with aqueous (plastic-free) barrier
  "KRAFT_PAPER_80", //   brown sack kraft 80 gsm (SOS bags, bread bags)
  "KRAFT_PAPER_120", //  brown kraft 120 gsm (carrier bags)
  "WHITE_KRAFT_100", //  bleached kraft 100 gsm (carrier / merchandise bags)
  "GREASEPROOF_50", //   greaseproof paper 50 gsm (bakery bags)
  "MOLDED_PULP_RECYCLED", // recycled newsprint / OCC molded fibre
  "MOLDED_PULP_BAGASSE", //  sugarcane bagasse molded fibre (food contact)
  "LID_PS", //           polystyrene thermoformed lid (not printed)
  "LID_PET", //          PET clear lid (not printed)
  "LID_PAPER", //        paperboard / pulp lid (printable top)
] as const;
export type FoodMaterialCode = (typeof FOOD_MATERIAL_CODES)[number];

export interface FoodMaterialSpec {
  code: FoodMaterialCode;
  name: LocalizedText;
  /** Caliper used for dieline thickness compensation, mm. */
  thicknessMm: number;
  gsm: number | null;
  foodContact: boolean;
  printable: boolean;
  /** Present in core MATERIAL_CODES already. */
  core: boolean;
}

const m = (code: FoodMaterialCode, ar: string, en: string, thicknessMm: number, gsm: number | null, foodContact: boolean, printable = true): FoodMaterialSpec => ({
  code,
  name: { ar, en },
  thicknessMm,
  gsm,
  foodContact,
  printable,
  core: (["SBS_300", "SBS_350", "E_FLUTE_KRAFT", "E_FLUTE_WHITE", "B_FLUTE_KRAFT"] as string[]).includes(code),
});

export const FOOD_MATERIALS: Record<FoodMaterialCode, FoodMaterialSpec> = {
  SBS_300: m("SBS_300", "كرتون دوبلكس أبيض 300 جم", "SBS board 300 gsm", 0.4, 300, true),
  SBS_350: m("SBS_350", "كرتون دوبلكس أبيض 350 جم", "SBS board 350 gsm", 0.48, 350, true),
  E_FLUTE_KRAFT: m("E_FLUTE_KRAFT", "كرتون مضلع E كرافت", "E-flute kraft", 1.5, null, true),
  E_FLUTE_WHITE: m("E_FLUTE_WHITE", "كرتون مضلع E أبيض", "E-flute white", 1.5, null, true),
  B_FLUTE_KRAFT: m("B_FLUTE_KRAFT", "كرتون مضلع B كرافت", "B-flute kraft", 3, null, false),
  CUK_300: m("CUK_300", "كرتون كرافت مطلي 300 جم", "Coated unbleached kraft 300 gsm", 0.45, 300, true),
  CUPSTOCK_PE_280: m("CUPSTOCK_PE_280", "ورق أكواب مبطن بالبولي إيثيلين 280 جم", "PE-coated cupstock 280 gsm", 0.38, 280, true),
  CUPSTOCK_AQ_280: m("CUPSTOCK_AQ_280", "ورق أكواب بطلاء مائي 280 جم", "Aqueous-barrier cupstock 280 gsm", 0.38, 280, true),
  KRAFT_PAPER_80: m("KRAFT_PAPER_80", "ورق كرافت بني 80 جم", "Brown kraft paper 80 gsm", 0.11, 80, true),
  KRAFT_PAPER_120: m("KRAFT_PAPER_120", "ورق كرافت بني 120 جم", "Brown kraft paper 120 gsm", 0.16, 120, false),
  WHITE_KRAFT_100: m("WHITE_KRAFT_100", "ورق كرافت أبيض 100 جم", "White kraft paper 100 gsm", 0.13, 100, true),
  GREASEPROOF_50: m("GREASEPROOF_50", "ورق مقاوم للدهون 50 جم", "Greaseproof paper 50 gsm", 0.06, 50, true),
  MOLDED_PULP_RECYCLED: m("MOLDED_PULP_RECYCLED", "لب ورق معاد التدوير", "Recycled molded pulp", 2, null, false, false),
  MOLDED_PULP_BAGASSE: m("MOLDED_PULP_BAGASSE", "لب قصب السكر", "Bagasse molded fibre", 1.2, null, true, false),
  LID_PS: m("LID_PS", "بوليسترين", "Polystyrene (PS)", 0.3, null, true, false),
  LID_PET: m("LID_PET", "بولي إيثيلين تيرفثالات شفاف", "Clear PET", 0.3, null, true, false),
  LID_PAPER: m("LID_PAPER", "غطاء ورقي", "Paperboard lid", 0.45, 300, true),
};

/** Existing core material code, if this substrate already has one. */
export function coreMaterial(code: FoodMaterialCode): MaterialCode | null {
  return FOOD_MATERIALS[code].core ? (code as MaterialCode) : null;
}
