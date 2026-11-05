import type { Dims, MaterialCode, StructureCode } from "@/types";
import { tryGenerateDieline, BOARD_SPECS } from "@/lib/dieline";

/** Board consumption of ONE box, as pricing needs it. */
export interface BoardArea {
  /** Rectangular blank the vendor cuts from (m²), includes trim waste. */
  blankAreaM2: number;
  /** Board actually in the finished box (m²); drives weight. */
  netAreaM2: number;
  blankWidthMm: number;
  blankHeightMm: number;
  source: "dieline" | "estimate";
}

/**
 * Pluggable area provider. The default uses the shared dieline engine (src/lib/dieline), so the
 * 3D view, the print PDF and the price all agree. Tests or callers can inject their own.
 */
export type BoardAreaProvider = (code: StructureCode, dims: Dims, material: MaterialCode, thicknessMm?: number) => BoardArea;

/**
 * Blank area ≈ factor × closed-box surface area. Factors calibrated against the dieline engine at
 * each structure's default size (flaps, glue tab, dust flaps and the bounding-rectangle waste).
 * Used only when the dieline engine cannot produce a model.
 */
const ESTIMATE_FACTOR: Record<StructureCode, { blank: number; net: number }> = {
  FEFCO_0427: { blank: 2.44, net: 1.7 },
  FEFCO_0201: { blank: 1.38, net: 1.34 },
  ECMA_RTE: { blank: 2.0, net: 1.28 },
  ECMA_STE: { blank: 1.75, net: 1.27 },
  PIZZA: { blank: 1.72, net: 1.34 },
  SLEEVE: { blank: 0.88, net: 0.88 },
};

export function estimateBoardArea(code: StructureCode, dims: Dims): BoardArea {
  const { L, W, H } = dims;
  const surfaceM2 = (2 * (L * W + L * H + W * H)) / 1e6;
  const f = ESTIMATE_FACTOR[code];
  const blankAreaM2 = surfaceM2 * f.blank;
  // Assume a blank about as long as the girth; keep the area exact.
  const blankWidthMm = Math.max(L, W) * 2 + Math.min(L, W) * 2;
  const blankHeightMm = (blankAreaM2 * 1e6) / blankWidthMm;
  return { blankAreaM2, netAreaM2: surfaceM2 * f.net, blankWidthMm, blankHeightMm, source: "estimate" };
}

export const dielineBoardArea: BoardAreaProvider = (code, dims, material, thicknessMm) => {
  const model = tryGenerateDieline(code, dims, { thicknessMm: thicknessMm ?? BOARD_SPECS[material].thicknessMm });
  if (!model) return estimateBoardArea(code, dims);
  const m = model.metrics;
  return {
    blankAreaM2: m.blankAreaM2,
    netAreaM2: m.netAreaM2,
    blankWidthMm: m.blankWidthMm,
    blankHeightMm: m.blankHeightMm,
    source: "dieline",
  };
};
