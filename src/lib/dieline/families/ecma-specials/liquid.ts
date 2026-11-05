import type { Dims, StructureFeatures } from "@/types";
import { DielineBuilder, insetSeg, rectEdges } from "../../builder";
import { clamp, pt } from "../../geometry";
import type { Polygon } from "../../types";
import { IDENTITY, blockFace, deg, tube4, type Walls } from "./kit";
import type { EcmaDraft } from "./types";

/**
 * Liquid packaging cartons (generic, no ECMA style number: they are formed, filled and
 * heat-sealed on form-fill-seal machines from liquid packaging board, LPB). Both are
 * modelled from a long-seam tube: glue (longitudinal seal strip) | left | front | right | back.
 */

/** Longitudinal seal strip width (mm). */
export const LS_STRIP_MM = 8;
/** Top fin (transverse seal) height of a gable top (mm). */
export const GABLE_FIN_MM = 9;

/** Brimful body volume in ml (L × W × H inner mm³ / 1000). */
export const bodyVolumeMl = (d: Dims) => (d.L * d.W * d.H) / 1000;

/** Sealed square bottom: side triangles fold in first, back then front panel overlap. */
function sealedBottom(b: DielineBuilder, w: Walls, t: number, Wp: number, overlap: number) {
  for (const side of ["left", "right"] as const) {
    const e = rectEdges(w[side]).bottom;
    const d = Wp / 2 - t;
    b.attach(`bottom_${side}`, "dust", side, insetSeg(e, 0.5), d, { kind: "trapezoid", taperA: d * 0.98, taperB: d * 0.98 }, { stage: 1, stack: -2, label: "Bottom gusset" });
  }
  b.attach("bottom_back", "flap", "back", rectEdges(w.back).bottom, Wp / 2 + overlap, { kind: "rect" }, { stage: 2, stack: -1, label: "Bottom seal flap" });
  b.attach("bottom", "bottom", "front", rectEdges(w.front).bottom, Wp / 2 + overlap, { kind: "rect" }, { stage: 3, label: "Bottom seal flap" });
}

/* ───────────────────────── Gable-top liquid carton (250 ml – 2 L) ───────────────────────── */

/**
 * Gable-top carton (fresh milk, juice): square body, two 45° roof panels on the front and
 * back rising to a vertical sealed fin, gable ends on the side panels (the gusset folds in
 * under the roof), and a sealed square bottom. L = W = inner body width, H = body height to
 * the roof crease (capacity = L × W × H, the roof is head space).
 */
export function gableTopCarton(dims: Dims, t: number, f: StructureFeatures = {}): EcmaDraft {
  void f;
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 3 * t;
  const run = Wp / 2 - t;
  const rise = run; // 45° roof
  const roofLen = Math.hypot(run, rise);
  const roofAngle = deg(Math.atan2(run, rise));
  const b = new DielineBuilder();
  const gable = (r: { x: number; y: number; width: number; height: number }): Polygon => [pt(r.x, r.y), pt(r.x + r.width / 2, r.y - rise), pt(r.x + r.width, r.y), pt(r.x + r.width, r.y + r.height), pt(r.x, r.y + r.height)];
  const w = tube4(b, Lp, Wp, Hp, LS_STRIP_MM, gable);
  for (const side of ["left", "right"] as const) {
    const r = w[side];
    // Gusset creases: the gable end folds in along the roof line and the centre line.
    b.extraCreases.push({ a: pt(r.x, r.y), b: pt(r.x + r.width, r.y) });
    b.extraCreases.push({ a: pt(r.x + r.width / 2, r.y), b: pt(r.x + r.width / 2, r.y - rise) });
  }
  for (const side of ["front", "back"] as const) {
    const r = w[side];
    const roofId = `roof_${side}`;
    b.attach(roofId, "top", side, rectEdges(r).top, roofLen, { kind: "rect" }, { fold: roofAngle, stage: 2, label: "Roof panel" });
    const roofTop = { a: pt(r.x, r.y - roofLen), b: pt(r.x + Lp, r.y - roofLen) };
    b.attach(`fin_${side}`, "top", roofId, [roofTop.a, roofTop.b], GABLE_FIN_MM, { kind: "rect" }, { fold: -roofAngle, stage: 2, label: "Top seal fin" });
  }
  sealedBottom(b, w, t, Wp, 4);
  return {
    builder: b,
    closedRotation: IDENTITY,
    faces: (panels, computed) => {
      const { top: _top, ...rest } = computed;
      void _top;
      return { ...rest, front: blockFace("front", panels, ["fin_front", "roof_front", "front"])!, back: blockFace("back", panels, ["fin_back", "roof_back", "back"])! };
    },
  };
}

/* ───────────────────────── Aseptic brick carton (200 ml – 1 L) ───────────────────────── */

/**
 * Aseptic brick: rectangular body with flat sealed top and bottom. The transverse seals make
 * a fin across each end; the triangular "ears" left at the sides are folded down flat onto
 * the side panels at the top and under the base at the bottom. L = front width, W = depth,
 * H = inner height (capacity = L × W × H).
 */
export function asepticBrick(dims: Dims, t: number, f: StructureFeatures = {}): EcmaDraft {
  void f;
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 4 * t;
  const b = new DielineBuilder();
  const w = tube4(b, Lp, Wp, Hp, LS_STRIP_MM);
  const fin = clamp(Wp * 0.12, 4, 8);
  // Top: back flap (with the seal fin overlap) under the front flap.
  b.attach("top_back", "flap", "back", rectEdges(w.back).top, Wp / 2 + fin, { kind: "rect" }, { stage: 1, stack: -1, label: "Top seal flap" });
  b.attach("top", "top", "front", rectEdges(w.front).top, Wp / 2 + fin, { kind: "rect" }, { stage: 2, label: "Top seal flap" });
  b.attach("bottom_back", "flap", "back", rectEdges(w.back).bottom, Wp / 2 + fin, { kind: "rect" }, { stage: 1, stack: -1, label: "Bottom seal flap" });
  b.attach("bottom", "bottom", "front", rectEdges(w.front).bottom, Wp / 2 + fin, { kind: "rect" }, { stage: 2, label: "Bottom seal flap" });
  for (const side of ["left", "right"] as const) {
    const r = w[side];
    const topEar: Polygon = [pt(r.x, r.y), pt(r.x + r.width, r.y), pt(r.x + r.width / 2, r.y - Wp / 2)];
    const botEar: Polygon = [pt(r.x, r.y + r.height), pt(r.x + r.width, r.y + r.height), pt(r.x + r.width / 2, r.y + r.height + Wp / 2)];
    // Top ears fold outward and down flat onto the side panel; bottom ears fold under the base.
    b.attachPoly(`ear_top_${side}`, "ear", side, rectEdges(r).top, topEar, { fold: -180, pivotDepth: 0, stage: 3, label: "Top ear" });
    b.attachPoly(`ear_bottom_${side}`, "ear", side, rectEdges(r).bottom, botEar, { fold: 90, stage: 3, stack: 1, label: "Bottom ear" });
  }
  return { builder: b, closedRotation: IDENTITY, faceDepthTol: t + 0.2 };
}
