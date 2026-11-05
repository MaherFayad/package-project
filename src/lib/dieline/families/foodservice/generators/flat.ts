import type { Dims, StructureFeatures } from "@/types";
import { DielineBuilder } from "../../../builder";
import { roundedRect } from "../../../features";
import { pt } from "../../../geometry";
import { sleeve, type StructureDraft } from "../../../structures";
import { IDENTITY } from "./common";

/**
 * Hang tag on flat stock: rounded rectangle with a punched string hole (5 mm Ø) centred
 * 8 mm below the top edge. L = width, H = height (W ignored: board caliper).
 */
export const HANG_TAG_HOLE_D = 5;
export function hangTag(dims: Dims): StructureDraft {
  const r = Math.min(4, dims.L * 0.08);
  const b = new DielineBuilder();
  const outline = roundedRect(dims.L / 2, dims.H / 2, dims.L, dims.H, r, 4);
  const hole = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return pt(dims.L / 2 + (HANG_TAG_HOLE_D / 2) * Math.cos(a), 8 + (HANG_TAG_HOLE_D / 2) * Math.sin(a));
  });
  b.root("front", "front", outline, "Tag", { holes: [hole] });
  return { builder: b, closedRotation: IDENTITY };
}

/** Belly band: a narrow printed wrap (sleeve open on both sides) around a box or tray. L = band width. */
export const bellyBand = (dims: Dims, t: number, f: StructureFeatures = {}) => sleeve(dims, t, f);

/** Gift wrap sleeve: full-width sleeve that slides over a gift box or tray, optional window. */
export const giftSleeve = (dims: Dims, t: number, f: StructureFeatures = {}) => sleeve(dims, t, f);
