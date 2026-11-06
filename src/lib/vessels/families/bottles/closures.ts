import type { BottleClosure, BottleClosureCode, BottleFinish } from "./types";

/**
 * Closures of this catalogue (heights are typical, mm).
 *
 * `coreClosure` is the core lathe closure the 3D view draws until the renderer has its own
 * crown / cork / ROPP parts. Metal closures (ROPP, crown, cork capsule, mushroom-cork foil)
 * fall back to the smooth metal LUG_LID over the height the closure really covers
 * (`BottleProfile.finishH`, see builder). FLIP_TOP and SWING_TOP must NOT use the core
 * FLIP_TOP: that one is a squeeze-tube cap drawn at y = 0 (it showed as a band round the base).
 */
export const BOTTLE_CLOSURES: Record<BottleClosureCode, BottleClosure> = {
  SCREW_CAP: { code: "SCREW_CAP", name: { ar: "غطاء لولبي", en: "Screw cap" }, fits: ["screw"], heightAboveMm: 3, skirtMm: 12, extraDiameterMm: 2.6, tamperEvident: false, printableTop: true, coreClosure: "SCREW_CAP" },
  SCREW_CAP_TE: { code: "SCREW_CAP_TE", name: { ar: "غطاء لولبي بحلقة أمان", en: "Screw cap with tamper band" }, fits: ["screw"], heightAboveMm: 3, skirtMm: 16, extraDiameterMm: 2.6, tamperEvident: true, printableTop: true, coreClosure: "SCREW_CAP" },
  CHILD_RESISTANT_CAP: { code: "CHILD_RESISTANT_CAP", name: { ar: "غطاء أمان للأطفال", en: "Child-resistant cap" }, fits: ["screw", "ropp"], heightAboveMm: 5, skirtMm: 16, extraDiameterMm: 5, tamperEvident: true, printableTop: true, coreClosure: "SCREW_CAP" },
  ROPP_CAP: { code: "ROPP_CAP", name: { ar: "غطاء ألومنيوم ملفوف", en: "Roll-on pilfer-proof cap" }, fits: ["ropp"], heightAboveMm: 1.5, skirtMm: 18, extraDiameterMm: 0.8, tamperEvident: true, printableTop: true, coreClosure: "LUG_LID" },
  POURER_CAP: { code: "POURER_CAP", name: { ar: "غطاء بصباب", en: "Pourer cap" }, fits: ["ropp"], heightAboveMm: 6, skirtMm: 18, extraDiameterMm: 0.8, tamperEvident: true, printableTop: true, coreClosure: "LUG_LID" },
  CROWN_26: { code: "CROWN_26", name: { ar: "غطاء تاجي 26 مم", en: "26 mm crown cork" }, fits: ["crown"], heightAboveMm: 1, skirtMm: 5.5, extraDiameterMm: 6, tamperEvident: true, printableTop: true, coreClosure: "LUG_LID" },
  CROWN_29: { code: "CROWN_29", name: { ar: "غطاء تاجي 29 مم", en: "29 mm crown cork" }, fits: ["crown"], heightAboveMm: 1, skirtMm: 6, extraDiameterMm: 6, tamperEvident: true, printableTop: true, coreClosure: "LUG_LID" },
  NATURAL_CORK: { code: "NATURAL_CORK", name: { ar: "سدادة فلين بكبسولة", en: "Cork with capsule" }, fits: ["cork"], heightAboveMm: 0.5, skirtMm: 50, extraDiameterMm: 0.6, tamperEvident: true, printableTop: true, coreClosure: "LUG_LID" },
  SPARKLING_CORK: { code: "SPARKLING_CORK", name: { ar: "سدادة فطرية بسلك", en: "Mushroom cork with wire hood" }, fits: ["crown"], heightAboveMm: 24, skirtMm: 90, extraDiameterMm: 2, tamperEvident: true, printableTop: true, coreClosure: "LUG_LID" },
  BAR_TOP: { code: "BAR_TOP", name: { ar: "سدادة بمقبض", en: "Bar-top stopper" }, fits: ["bartop", "cork"], heightAboveMm: 16, skirtMm: 0, extraDiameterMm: 4, tamperEvident: false, printableTop: true, coreClosure: "SCREW_CAP" },
  SWING_TOP: { code: "SWING_TOP", name: { ar: "غطاء قلاب بسلك", en: "Swing-top stopper" }, fits: ["swing"], heightAboveMm: 14, skirtMm: 0, extraDiameterMm: 4, tamperEvident: false, printableTop: false, coreClosure: "LUG_LID" },
  FLIP_TOP: { code: "FLIP_TOP", name: { ar: "غطاء قلاب", en: "Flip-top cap" }, fits: ["screw"], heightAboveMm: 12, skirtMm: 10, extraDiameterMm: 4, tamperEvident: false, printableTop: true, coreClosure: "SCREW_CAP" },
  SPORTS_CAP: { code: "SPORTS_CAP", name: { ar: "غطاء رياضي", en: "Sports cap" }, fits: ["screw"], heightAboveMm: 17, skirtMm: 14, extraDiameterMm: 4, tamperEvident: true, printableTop: false, coreClosure: "SPORTS_CAP" },
  ORIFICE_REDUCER_CAP: { code: "ORIFICE_REDUCER_CAP", name: { ar: "غطاء بمقلل فوهة", en: "Cap with orifice reducer" }, fits: ["screw"], heightAboveMm: 3, skirtMm: 14, extraDiameterMm: 2.6, tamperEvident: false, printableTop: true, coreClosure: "SCREW_CAP" },
  LUG_LID: { code: "LUG_LID", name: { ar: "غطاء معدني ملتوي", en: "Twist-off lug lid" }, fits: ["lug"], heightAboveMm: 1.8, skirtMm: 9, extraDiameterMm: 1.6, tamperEvident: true, printableTop: true, coreClosure: "LUG_LID" },
  MASON_LID_BAND: { code: "MASON_LID_BAND", name: { ar: "غطاء وحلقة برطمان", en: "Two-piece lid and band" }, fits: ["mason"], heightAboveMm: 1.5, skirtMm: 12, extraDiameterMm: 2.4, tamperEvident: false, printableTop: true, coreClosure: "LUG_LID" },
  SNAP_CAP_NON_SPILL: { code: "SNAP_CAP_NON_SPILL", name: { ar: "غطاء كبس مانع للتسرب", en: "Non-spill snap cap" }, fits: ["snap"], heightAboveMm: 6, skirtMm: 20, extraDiameterMm: 3, tamperEvident: true, printableTop: true, coreClosure: "SCREW_CAP" },
  VENTED_SCREW_CAP: { code: "VENTED_SCREW_CAP", name: { ar: "غطاء لولبي بفتحة تهوية", en: "Vented screw cap" }, fits: ["screw"], heightAboveMm: 4, skirtMm: 16, extraDiameterMm: 4, tamperEvident: true, printableTop: true, coreClosure: "SCREW_CAP" },
  MEASURE_CAP: { code: "MEASURE_CAP", name: { ar: "غطاء مكيال", en: "Measuring cap" }, fits: ["screw"], heightAboveMm: 32, skirtMm: 12, extraDiameterMm: 14, tamperEvident: false, printableTop: false, coreClosure: "SCREW_CAP" },
  TAMPER_LID: { code: "TAMPER_LID", name: { ar: "غطاء كبس بشريط أمان", en: "Snap lid with tear strip" }, fits: ["rim"], heightAboveMm: 4, skirtMm: 10, extraDiameterMm: 3, tamperEvident: true, printableTop: true, coreClosure: "SLIP_LID" },
};

export function closureFits(code: BottleClosureCode, finish: BottleFinish): boolean {
  return BOTTLE_CLOSURES[code].fits.includes(finish.kind);
}
