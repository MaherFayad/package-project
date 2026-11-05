import type { Dims, StructureFeatures } from "@/types";
import { DielineBuilder, insetSeg } from "../../../builder";
import { cutWindow, notchPanel } from "../../../features";
import { clamp, pt, rectPolygon } from "../../../geometry";
import type { StructureDraft } from "../../../structures";
import { IDENTITY } from "./common";

/**
 * Paper bags. Dims follow the trade convention (ISO 6591-1 style "width × gusset × height"):
 *   L = face width, W = side gusset (opened depth), H = body height (base to mouth, without
 *   the turnover). Flat bags use W as a nominal 1 mm.
 *
 * The 3D model is the bag OPENED (standing, mouth open): the gusset is one side wall with
 * its centre fold drawn as an extra crease (the flat-pack fold line).
 */
export interface BagOpts {
  /** Top turnover depth (carrier bags fold the mouth inward and glue the handle under it). 0 = none. */
  turnover: number;
  /** Bottom style: SOS (self-opening square, block bottom). */
  bottom: "sos";
}

const seamWidth = (W: number) => clamp(W * 0.12, 12, 25);

export function gussetBag(dims: Dims, t: number, o: BagOpts, f: StructureFeatures = {}): StructureDraft {
  const Lp = dims.L + 2 * t;
  const G = dims.W + 2 * t;
  const Hp = dims.H;
  const g = seamWidth(dims.L);
  const b = new DielineBuilder();
  const xL = g;
  const xF = xL + G;
  const xR = xF + Lp;
  const xB = xR + G;
  b.root("front", "front", rectPolygon(xF, 0, Lp, Hp), "Front");
  b.attach("left", "left", "front", [pt(xF, 0), pt(xF, Hp)], G, { kind: "rect" }, { stage: 0, label: "Gusset" });
  b.attach("right", "right", "front", [pt(xR, 0), pt(xR, Hp)], G, { kind: "rect" }, { stage: 0, label: "Gusset" });
  b.attach("back", "back", "right", [pt(xB, 0), pt(xB, Hp)], Lp, { kind: "rect" }, { stage: 0, label: "Back" });
  b.attach("glue", "glue", "left", [pt(xL, 0), pt(xL, Hp)], g, { kind: "rect" }, { stage: 0, stack: -1, label: "Side seam" });
  // Gusset centre folds (flat-pack) and the SOS bottom diagonals.
  for (const x0 of [xL, xR]) {
    b.extraCreases.push({ a: pt(x0 + G / 2, 0), b: pt(x0 + G / 2, Hp) });
    b.extraCreases.push({ a: pt(x0, Hp), b: pt(x0 + G / 2, Hp - G / 2) }, { a: pt(x0 + G, Hp), b: pt(x0 + G / 2, Hp - G / 2) });
  }
  // SOS block bottom: front panel extension forms the base; back extension and gusset
  // triangles fold under it and are glued (paste flap overlap 15 mm).
  const lap = Math.min(15, G * 0.3);
  b.attach("bottom", "bottom", "front", [pt(xF, Hp), pt(xF + Lp, Hp)], G, { kind: "rect" }, { stage: 2, label: "Bottom (front extension)" });
  b.attach("bottomBack", "flap", "back", [pt(xB, Hp), pt(xB + Lp, Hp)], G / 2 + lap, { kind: "rect" }, { stage: 2, stack: -2, label: "Bottom paste flap" });
  for (const [id, x0] of [["left", xL], ["right", xR]] as const) {
    const d = G / 2;
    b.attach(`bottom_${id}`, "dust", id, [pt(x0, Hp), pt(x0 + G, Hp)], d, { kind: "trapezoid", taperA: d * 0.9, taperB: d * 0.9 }, { stage: 1, stack: -3, label: "Bottom gusset fold" });
  }
  if (o.turnover > 0) {
    const T = o.turnover;
    const wall = (id: string, x0: number, w: number) =>
      b.attach(`${id}Turn`, "inner", id, insetSeg([pt(x0, 0), pt(x0 + w, 0)], 0.5), T, { kind: "rect" }, { fold: 180, pivotDepth: 1, stage: 3, label: "Top turnover" });
    wall("front", xF, Lp);
    wall("back", xB, Lp);
    wall("left", xL, G);
    wall("right", xR, G);
  }
  if (f.window) cutWindow(b, "front", f.window, { margin: Math.max(15, o.turnover + 10) });
  if (f.thumbNotch && o.turnover === 0) notchPanel(b.byId("front"), [pt(xF, 0), pt(xF + Lp, 0)], Math.min(15, Lp * 0.1));
  return { builder: b, closedRotation: IDENTITY };
}

/** SOS flat-bottom bag (grocery, bakery, takeaway). */
export const sosBag = (dims: Dims, t: number, f: StructureFeatures = {}) => gussetBag(dims, t, { turnover: 0, bottom: "sos" }, f);

/** Carrier bag with a 40-50 mm top turnover; handles (flat strip or twisted rope) are glued under it. */
export const carrierBag = (dims: Dims, t: number, f: StructureFeatures = {}) => gussetBag(dims, t, { turnover: clamp(dims.H * 0.12, 35, 50), bottom: "sos" }, f);

/**
 * Merchandise / flat bag (no gussets): front and back hinged at the bottom fold, side seam
 * glue flap; optional thumb notch at the mouth. L = width, H = height (W ignored).
 */
export function flatBag(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  const Lp = dims.L;
  const Hp = dims.H;
  const g = seamWidth(dims.L) * 0.8;
  const b = new DielineBuilder();
  b.root("front", "front", rectPolygon(0, 0, Lp, Hp), "Front");
  b.attach("back", "back", "front", [pt(0, Hp), pt(Lp, Hp)], Hp, { kind: "rect" }, { fold: 180, pivotDepth: 1.5, stage: 1, label: "Back (bottom fold)" });
  b.attach("glue", "glue", "front", insetSeg([pt(Lp, 0), pt(Lp, Hp)], 0, 2), g, { kind: "rect" }, { fold: 180, pivotDepth: 1, stage: 0, stack: 0, label: "Side seam" });
  if (f.thumbNotch) notchPanel(b.byId("front"), [pt(0, 0), pt(Lp, 0)], Math.min(15, Lp * 0.1));
  if (f.window) cutWindow(b, "front", f.window, { margin: 15 });
  return { builder: b, closedRotation: IDENTITY };
}

