// Eager model library: doc helpers below read the registry (PERF-04).
import "@/lib/library";
import type { DesignDoc, Dims, MaterialCode, StructureCode } from "@/types";
import { emptyArtwork } from "@/types";
import { docBoardArea } from "@/lib/library/doc";
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
  FEFCO_0320: { blank: 2.0, net: 1.95 },
  ECMA_CLB: { blank: 1.61, net: 1.23 },
  ECMA_SLB: { blank: 1.9, net: 1.32 },
  FEFCO_0422: { blank: 1.11, net: 0.98 },
  GABLE_BOX: { blank: 1.7, net: 1.36 },
  PAPER_TUBE: { blank: 1.58, net: 1.08 },
  RIGID_BOX: { blank: 1.71, net: 1.44 },
  // Flat parts (W = 1): surface ≈ 2·L·H, the part itself is L·H.
  ROLL_LABEL: { blank: 0.5, net: 0.5 },
  PRINTED_POUCH: { blank: 0.5, net: 0.5 },
  PRINTED_TUBE: { blank: 0.5, net: 0.5 },
  // Paper bag: tube + turnover + block bottom ≈ 1.1 × the closed surface (2·(LW + LH + WH)).
  PAPER_BAG: { blank: 1.1, net: 1.0 },
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

/**
 * Added by 3D integration: board / stock use of a LIBRARY model (family box style or container
 * labels), from its own dieline or print areas. null when the size is invalid for the model.
 */
export function modelBoardArea(
  input: { structureCode: StructureCode; dims: Dims; model?: { code: string; features?: DesignDoc["features"]; vessel?: DesignDoc["vessel"] } },
  material: MaterialCode,
): BoardArea | null {
  if (!input.model) return null;
  const doc: DesignDoc = {
    v: 1,
    name: "",
    structureCode: input.structureCode,
    modelCode: input.model.code,
    dims: input.dims,
    materialCode: material,
    finishCode: "NONE",
    printSides: "OUTSIDE",
    artwork: emptyArtwork(),
    ...(input.model.features ? { features: input.model.features } : {}),
    ...(input.model.vessel ? { vessel: input.model.vessel } : {}),
  };
  return docBoardArea(doc);
}
