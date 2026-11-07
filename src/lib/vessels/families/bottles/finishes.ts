import { NECK_FINISHES } from "../../index";
import type { BottleFinish } from "./types";

/**
 * Neck finishes (T = outer diameter over the thread / bead, H = finish height, mm).
 *
 * `verified: true` values come from the standard or a maker drawing cited in `standard`;
 * the rest are typical trade values (confirm with the closure supplier before tooling).
 * SPI/GPI finishes: the first number is T in mm, the second the thread style
 * (400 = 1 turn short, 410 = 1.5 turns, 414/415 = 2 turns tall).
 */
const core = NECK_FINISHES;

export const FINISHES = {
  // --- PET beverage (ISBT / preform makers) --------------------------------------------------
  PCO_1881: { ...core.PCO_1881, id: "PCO_1881", kind: "screw", standard: "ISBT PCO 1881 (28 mm short neck)", boreMm: 21.7, supportRing: true, tamperBead: true, verified: true },
  PCO_1810: { id: "PCO_1810", code: "PCO 1810 (28 mm)", outerDiameterMm: 27.4, heightMm: 16.5, thread: "screw", kind: "screw", standard: "ISBT PCO 1810 (28 mm)", boreMm: 21.7, supportRing: true, tamperBead: true, verified: false },
  HOTFILL_38: { id: "HOTFILL_38", code: "38 mm 3-start", outerDiameterMm: 37.9, heightMm: 15.5, thread: "screw", kind: "screw", standard: "38 mm 3-start hot-fill (trade)", boreMm: 33.0, supportRing: true, tamperBead: true, verified: false },
  SCREW_48: { id: "SCREW_48", code: "48 mm screw", outerDiameterMm: 48, heightMm: 16, thread: "screw", kind: "screw", standard: "48 mm bulk-water screw neck (trade)", boreMm: 41, supportRing: true, tamperBead: true, verified: false },
  SNAP_55: { id: "SNAP_55", code: "55 mm snap (crown)", outerDiameterMm: 55, heightMm: 22, thread: "none", kind: "snap", standard: "55 mm water-cooler snap neck (trade)", boreMm: 45, supportRing: true, verified: true },
  // --- SPI / GPI continuous thread ------------------------------------------------------------
  // R5-3Q-F-21: the narrow necks small syrups / ovals / oils use (30–60 ml)
  F20_410: { ...core.F20_410, id: "F20_410", kind: "screw", standard: "SPI/GPI 20-410", boreMm: 13.2, verified: true },
  PP18: { id: "PP18", code: "PP 18 x 14 (ROPP)", outerDiameterMm: 18, heightMm: 14, thread: "screw", kind: "ropp", standard: "18 mm roll-on pilfer-proof (pharma, trade)", boreMm: 11.5, tamperBead: true, verified: false },
  F24_410: { ...core.F24_410, id: "F24_410", kind: "screw", standard: "SPI/GPI 24-410", boreMm: 17.5, verified: true },
  F24_414: { id: "F24_414", code: "24-414", outerDiameterMm: 23.9, heightMm: 18.0, thread: "screw", kind: "screw", standard: "GPI 24-414 (woozy)", boreMm: 13.5, verified: false },
  F28_400: { id: "F28_400", code: "28-400", outerDiameterMm: 27.9, heightMm: 10.2, thread: "screw", kind: "screw", standard: "SPI/GPI 28-400", boreMm: 20.5, verified: true },
  F28_410: { ...core.F28_410, id: "F28_410", kind: "screw", standard: "SPI/GPI 28-410", boreMm: 20.5, verified: true },
  F38_400: { id: "F38_400", code: "38-400", outerDiameterMm: 37.6, heightMm: 10.3, thread: "screw", kind: "screw", standard: "SPI/GPI 38-400", boreMm: 29.5, tamperBead: true, verified: true },
  F70_400: { id: "F70_400", code: "70-400", outerDiameterMm: 69.6, heightMm: 10.9, thread: "screw", kind: "screw", standard: "SPI/GPI 70-400", boreMm: 62, verified: true },
  F89_400: { id: "F89_400", code: "89-400", outerDiameterMm: 88.4, heightMm: 11.4, thread: "screw", kind: "screw", standard: "SPI/GPI 89-400", boreMm: 80, verified: false },
  // --- Glass roll-on (ROPP), crown, cork --------------------------------------------------------
  PP28: { id: "PP28", code: "PP 28 x 18 (ROPP)", outerDiameterMm: 28, heightMm: 18, thread: "screw", kind: "ropp", standard: "CETIE PP 28 roll-on pilfer-proof", boreMm: 19.5, tamperBead: true, verified: false },
  PP31_5: { id: "PP31_5", code: "PP 31.5 x 18 (ROPP)", outerDiameterMm: 30.2, heightMm: 18, thread: "screw", kind: "ropp", standard: "PP 31.5 x 18 ROPP (oil pourer)", boreMm: 21, tamperBead: true, verified: true },
  BVS_30H60: { id: "BVS_30H60", code: "BVS 30 x 60", outerDiameterMm: 29.8, heightMm: 60, thread: "screw", kind: "ropp", standard: "CETIE BVS 30H60 wine screw cap", boreMm: 18.5, tamperBead: true, verified: false },
  CROWN_26: { id: "CROWN_26", code: "26 mm crown (26 H 180)", outerDiameterMm: 26.3, heightMm: 18.0, thread: "crimp", kind: "crown", standard: "ISO 12821 (26 H 180 crown finish)", boreMm: 16.0, verified: true },
  CROWN_29: { id: "CROWN_29", code: "29 mm crown (sparkling)", outerDiameterMm: 29.4, heightMm: 18.0, thread: "crimp", kind: "crown", standard: "CETIE 29 mm crown / cork finish for sparkling wine", boreMm: 17.5, verified: false },
  CORK_18_5: { id: "CORK_18_5", code: "Cork 18.5 (CETIE GME 1.04)", outerDiameterMm: 29.5, heightMm: 12, thread: "none", kind: "cork", standard: "EN 12726 / CETIE GME 1.04 cork mouth, 18.5 mm bore", boreMm: 18.5, verified: true },
  BARTOP_18_5: { id: "BARTOP_18_5", code: "Bar top 18.5", outerDiameterMm: 25.5, heightMm: 14, thread: "none", kind: "bartop", standard: "18.5 mm bar-top (T-cork) finish", boreMm: 18.5, verified: true },
  SWING_26: { id: "SWING_26", code: "Swing-top bead", outerDiameterMm: 26.3, heightMm: 16, thread: "none", kind: "swing", standard: "Swing-top (flip) bead, wire lugs", boreMm: 16.0, verified: false },
  // --- Lug (twist-off) for jars and wide-neck bottles ----------------------------------------------
  TO38: { id: "TO38", code: "TO 38 lug", outerDiameterMm: 38, heightMm: 9, thread: "lug", kind: "lug", standard: "Twist-off 38 (4 lug)", boreMm: 31, verified: false },
  TO43: { id: "TO43", code: "TO 43 lug", outerDiameterMm: 43, heightMm: 9, thread: "lug", kind: "lug", standard: "Twist-off 43 (4 lug)", boreMm: 36, verified: false },
  TO53: { ...core.TO53, id: "TO53", kind: "lug", standard: "Twist-off 53 (4 lug)", boreMm: 45.5, verified: false },
  TO58: { id: "TO58", code: "TO 58 lug", outerDiameterMm: 58, heightMm: 9.5, thread: "lug", kind: "lug", standard: "Twist-off 58 (4 lug)", boreMm: 50.5, verified: true },
  TO63: { ...core.TO63, id: "TO63", kind: "lug", standard: "Twist-off 63 (6 lug)", boreMm: 55, verified: true },
  TO66: { id: "TO66", code: "TO 66 lug", outerDiameterMm: 66, heightMm: 10, thread: "lug", kind: "lug", standard: "Twist-off 66 (6 lug)", boreMm: 58, verified: false },
  TO70: { ...core.TO70, id: "TO70", kind: "lug", standard: "Twist-off 70 (6 lug)", boreMm: 62, verified: false },
  TO82: { id: "TO82", code: "TO 82 lug", outerDiameterMm: 82, heightMm: 10.5, thread: "lug", kind: "lug", standard: "Twist-off 82 (6 lug)", boreMm: 73, verified: false },
  // --- Mason (two-piece lid + band) -----------------------------------------------------------------
  MASON_70: { id: "MASON_70", code: "Regular mouth 70 mm", outerDiameterMm: 70, heightMm: 13, thread: "screw", kind: "mason", standard: "Mason regular mouth (70 mm lid)", boreMm: 60, verified: true },
  MASON_86: { id: "MASON_86", code: "Wide mouth 86 mm", outerDiameterMm: 86, heightMm: 13, thread: "screw", kind: "mason", standard: "Mason wide mouth (86 mm lid)", boreMm: 76, verified: true },
  // --- Jerrycans (DIN 6063 style buttress) ------------------------------------------------------------
  DIN45: { id: "DIN45", code: "DIN 45", outerDiameterMm: 45, heightMm: 17, thread: "screw", kind: "screw", standard: "DIN 45 jerrycan neck", boreMm: 34, tamperBead: true, verified: true },
  DIN51: { id: "DIN51", code: "DIN 51", outerDiameterMm: 51, heightMm: 18, thread: "screw", kind: "screw", standard: "DIN 51 jerrycan neck", boreMm: 40, tamperBead: true, verified: false },
  DIN61: { id: "DIN61", code: "DIN 61", outerDiameterMm: 61, heightMm: 20, thread: "screw", kind: "screw", standard: "DIN 61 jerrycan neck (47 mm opening)", boreMm: 47, tamperBead: true, verified: true },
  // --- Open-top tubs and pails: the rim is sized from the body (outerDiameterMm is a placeholder) --------
  RIM: { id: "RIM", code: "Open-top rim", outerDiameterMm: 0, heightMm: 8, thread: "none", kind: "rim", standard: "Open-top snap-lid rim", boreMm: 0, verified: false },
} as const satisfies Record<string, BottleFinish>;

export type FinishId = keyof typeof FINISHES;

export function finishById(id: string): BottleFinish {
  const f = (FINISHES as Record<string, BottleFinish>)[id];
  if (!f) throw new Error(`Unknown finish ${id}`);
  return f;
}
