import type { Dims, StructureFeatures } from "@/types";
import { DielineBuilder, insetSeg, rectEdges } from "../../builder";
import { cutWindow, notchPanel } from "../../features";
import { clamp, rectPolygon } from "../../geometry";
import type { Pt, Rect, Segment } from "../../types";
import { TRAY_ROTATION, rect, slit } from "./kit";
import type { EcmaDraft } from "./types";

/**
 * Glued trays, ECMA Group B (B40 / B44) and Group F20 hinged-lid variants.
 *
 * Layout (sheet, printed side up): base in the middle, FRONT wall above it, back wall below,
 * left / right walls beside it. Closing tilts the base 90° about X (TRAY_ROTATION) so the
 * sheet-top wall faces the viewer and every wall rises with a +90° fold.
 *
 * Thickness compensation: base = inner + 2 × (wall layers) × t; walls = H + t (base board),
 * H + 2t with a lid (the lid board lies inside the rim).
 */
export interface TrayFrame {
  b: DielineBuilder;
  Lp: number;
  Wp: number;
  Hp: number;
  base: Rect;
  walls: { front: Rect; back: Rect; left: Rect; right: Rect };
}

/** Base + four single walls. `endLayers` / `sideLayers` = board layers at left-right / front-back walls. */
export function trayFrame(dims: Dims, t: number, endLayers: number, sideLayers: number, wallStage = { long: 1, end: 0 }, lid = false): TrayFrame {
  const Lp = dims.L + 2 * endLayers * t;
  const Wp = dims.W + 2 * sideLayers * t;
  const Hp = dims.H + (lid ? 2 : 1) * t;
  const b = new DielineBuilder();
  const base = rect(0, 0, Lp, Wp);
  const walls = { front: rect(0, -Hp, Lp, Hp), back: rect(0, Wp, Lp, Hp), left: rect(-Hp, 0, Hp, Wp), right: rect(Lp, 0, Hp, Wp) };
  b.root("base", "bottom", rectPolygon(0, 0, Lp, Wp), "Base");
  b.attach("front", "front", "base", rectEdges(base).top, Hp, { kind: "rect" }, { stage: wallStage.long, label: "Front wall" });
  b.attach("back", "back", "base", rectEdges(base).bottom, Hp, { kind: "rect" }, { stage: wallStage.long, label: "Back wall" });
  b.attach("left", "left", "base", rectEdges(base).left, Hp, { kind: "rect" }, { stage: wallStage.end, label: "Left end wall" });
  b.attach("right", "right", "base", rectEdges(base).right, Hp, { kind: "rect" }, { stage: wallStage.end, label: "Right end wall" });
  return { b, Lp, Wp, Hp, base, walls };
}

/**
 * Four-corner glue flaps: on the long (front/back) walls' side edges, folded 90° inward and
 * glued inside the end walls (ECMA B, locking code 20 "glued corner/panel, not webbed").
 */
export function cornerGlueFlaps(fr: TrayFrame, t: number) {
  const { b, Wp, Hp, walls } = fr;
  const d = Math.min(30, Wp * 0.4, Hp * 1.2);
  const flap = (id: string, wall: "front" | "back", side: "left" | "right") => {
    const e = side === "left" ? rectEdges(walls[wall]).left : rectEdges(walls[wall]).right;
    // a-end of left/right edges is the sheet-top end: rim for the front wall, base for the back.
    const rimAtA = wall === "front";
    const seg = insetSeg(e, rimAtA ? 1 : t + 1, rimAtA ? t + 1 : 1);
    const taper = Math.min(d * 0.35, Hp * 0.25);
    b.attach(id, "glue", wall, seg, d, { kind: "trapezoid", taperA: rimAtA ? 1 : taper, taperB: rimAtA ? taper : 1 }, { stage: 1, stack: -1, label: "Corner glue flap" });
  };
  flap("glueFL", "front", "left");
  flap("glueFR", "front", "right");
  flap("glueBL", "back", "left");
  flap("glueBR", "back", "right");
}

/* ───────────────────────── B40.20 four-corner glued tray ───────────────────────── */

export function fourCornerTray(dims: Dims, t: number, f: StructureFeatures = {}): EcmaDraft {
  const fr = trayFrame(dims, t, 2, 1);
  cornerGlueFlaps(fr, t);
  trayRimFeatures(fr, f);
  return { builder: fr.b, closedRotation: TRAY_ROTATION };
}

/* ───────────────────────── B40.21 Beers tray (webbed glued corners) ───────────────────────── */

/**
 * Beers-style tray: each corner is a square web (H × H) split by a diagonal crease. Erected,
 * the web doubles on its diagonal and lies flat inside the end wall where it is glued, so the
 * tray knocks down flat for shipping and pops up for filling (bakery / confectionery).
 * Tree: web half A hangs on the long wall (fold 90°), half B on A's diagonal (fold 180°);
 * layers inside each end wall, outside → in: end wall | B (glued to it) | A (stack −2).
 * B's other edge is a crease shared with the end wall (a "join").
 */
export function beersTray(dims: Dims, t: number, f: StructureFeatures = {}): EcmaDraft {
  const fr = trayFrame(dims, t, 3, 1, { long: 0, end: 0 });
  const { b, Lp, Wp, Hp } = fr;
  const joins: Segment[] = [];
  const P = (x: number, y: number): Pt => ({ x, y });
  // corner: [cornerX, cornerY, sx (outward x sign), sy (outward y sign), long wall]
  const corners: [number, number, number, number, "front" | "back", string][] = [
    [0, 0, -1, -1, "front", "FL"],
    [Lp, 0, 1, -1, "front", "FR"],
    [0, Wp, -1, 1, "back", "BL"],
    [Lp, Wp, 1, 1, "back", "BR"],
  ];
  for (const [cx, cy, sx, sy, wall, k] of corners) {
    const c = P(cx, cy);
    const wallEdgeEnd = P(cx, cy + sy * Hp); // along the long wall's side edge
    const outer = P(cx + sx * Hp, cy + sy * Hp);
    const endEdgeEnd = P(cx + sx * Hp, cy); // along the end wall's edge
    b.attachPoly(`web${k}A`, "ear", wall, [c, wallEdgeEnd], [c, wallEdgeEnd, outer], { fold: 90, stage: 0, stack: -2, label: "Corner web" });
    b.attachPoly(`web${k}B`, "ear", `web${k}A`, [c, outer], [c, outer, endEdgeEnd], { fold: 180, pivotDepth: 1, stage: 0, label: "Corner web" });
    joins.push({ a: c, b: endEdgeEnd });
  }
  trayRimFeatures(fr, f);
  return { builder: b, closedRotation: TRAY_ROTATION, joins };
}

/* ───────────────────────── B44.20 Brightwood tray (double end walls) ───────────────────────── */

/**
 * Brightwood-style tray: four-corner glued tray whose end walls are double: the inner end
 * panel rolls over the rim (180°) and traps the corner glue flaps, giving a rigid, set-up
 * (non-collapsing) tray with clean rolled rims (ECMA B44: glued tray with 2 double walls).
 */
export function brightwoodTray(dims: Dims, t: number, f: StructureFeatures = {}): EcmaDraft {
  const fr = trayFrame(dims, t, 3, 1);
  const { b, Hp, walls } = fr;
  cornerGlueFlaps(fr, t);
  const depth = Hp - 2 * t - 0.5;
  for (const side of ["left", "right"] as const) {
    const far = side === "left" ? rectEdges(walls.left).left : rectEdges(walls.right).right;
    b.attach(`${side}Inner`, "inner", side, insetSeg(far, t + 0.5), depth, { kind: "rect" }, { fold: 180, pivotDepth: 1.5, stage: 2, label: "Inner end wall" });
  }
  trayRimFeatures(fr, f);
  return { builder: b, closedRotation: TRAY_ROTATION };
}

/* ───────────────────────── F20.41 six-corner tray with hinged lid ───────────────────────── */

/**
 * Six-corner tray: four-corner glued base tray plus a cover hinged on the back wall rim with
 * a front flap and two side flaps; the front flap's two glue flaps are glued to the side
 * flaps (corners 5 and 6). The cover does not tuck: a tongue on the front flap locks into a
 * slit in the front wall (ECMA F20.41 hinge back lid with glued corners).
 */
export function sixCornerTray(dims: Dims, t: number, f: StructureFeatures = {}): EcmaDraft {
  const fr = trayFrame(dims, t, 2, 1, undefined, true);
  const { b, Lp, Wp, Hp, walls } = fr;
  cornerGlueFlaps(fr, t);
  const c = 0.5;
  // Lid overhang per side: the side flap (t) sits outside the front flap's corner glue flap
  // (t), which lies on the end wall, so the overhang is 2 caliper + clearance. A 1t overhang
  // only cleared SBS (0.4 mm glue flap in a 0.5 mm gap); E-flute glue flaps (1.5 mm) cut
  // 1 mm into the end walls (R5-3Q-D-01).
  const e = 2 * t + c;
  const Wl = Wp + t + c;
  const dL = clamp(Math.min(dims.H * 0.5, 40), 12, Hp - 2);
  const y0 = Wp + Hp;
  const lid = rect(-e, y0, Lp + 2 * e, Wl);
  b.attachPoly("top", "top", "back", rectEdges(walls.back).bottom, rectPolygon(lid.x, lid.y, lid.width, lid.height), { stage: 3, label: "Cover" });
  b.attach("lidSideL", "dust", "top", rectEdges(lid).left, dL, { kind: "rect" }, { stage: 2, label: "Cover side flap" });
  b.attach("lidSideR", "dust", "top", rectEdges(lid).right, dL, { kind: "rect" }, { stage: 2, label: "Cover side flap" });
  const lf = rect(lid.x, lid.y + Wl, lid.width, dL);
  b.attach("lidFront", "flap", "top", rectEdges(lid).bottom, dL, { kind: "rect" }, { stage: 2, label: "Cover front flap" });
  const gd = Math.min(dL - 2, 18, Wl * 0.3);
  b.attach("lidGlueL", "glue", "lidFront", insetSeg(rectEdges(lf).left, 1, 1), gd, { kind: "trapezoid", taperA: 1, taperB: gd * 0.4 }, { stage: 1, stack: -1, label: "Cover corner glue flap" });
  b.attach("lidGlueR", "glue", "lidFront", insetSeg(rectEdges(lf).right, 1, 1), gd, { kind: "trapezoid", taperA: 1, taperB: gd * 0.4 }, { stage: 1, stack: -1, label: "Cover corner glue flap" });
  // Lock tongue on the front flap edge, slit in the front wall at the same height.
  const tw = Math.min(30, Lp * 0.25);
  const td = Math.min(8, dL * 0.4);
  const cx = lf.x + lf.width / 2;
  b.attach("lidLock", "tuck", "lidFront", [{ x: cx - tw / 2, y: lf.y + dL }, { x: cx + tw / 2, y: lf.y + dL }], td, { kind: "trapezoid", taperA: td * 0.4, taperB: td * 0.4 }, { stage: 3, stack: -1, label: "Lock tongue" });
  const front = b.byId("front");
  front.holes = [...(front.holes ?? []), slit(walls.front.x + Lp / 2, walls.front.y + dL - 1, tw + 2)];
  if (f.window) cutWindow(b, "top", f.window, { margin: 12 });
  return { builder: b, closedRotation: TRAY_ROTATION, faceDepthTol: e + 0.5 };
}

/* ───────────────────────── F20.40 tray with hinged tuck lid ───────────────────────── */

/**
 * Tray with a continuous base and lid (ECMA F20.40): four-corner glued tray, lid hinged on
 * the back wall rim, tuck flap into the front wall and dust flaps into the end walls.
 */
export function hingedTuckTray(dims: Dims, t: number, f: StructureFeatures = {}): EcmaDraft {
  const fr = trayFrame(dims, t, 2, 1, undefined, true);
  const { b, Lp, Wp, Hp, walls } = fr;
  cornerGlueFlaps(fr, t);
  const y0 = Wp + Hp;
  const lid = rect(0, y0, Lp, Wp);
  b.attach("top", "top", "back", rectEdges(walls.back).bottom, Wp, { kind: "rect" }, { stage: 3, label: "Lid" });
  const tuckD = clamp((Hp - 2 * t) * 0.6, 10, 45);
  b.attach("lidTuck", "tuck", "top", insetSeg(rectEdges(lid).bottom, 2 * t + 1), tuckD, { kind: "tuck", shoulder: 2 }, { stage: 3, stack: -1, label: "Lid tuck" });
  const dd = clamp((Hp - 2 * t) * 0.6, 8, 40);
  const taper = Math.min(dd * 0.6, Wp * 0.3);
  // Lid left edge runs from the hinge (top, a-end) to the front (bottom, b-end).
  b.attach("lidDustL", "dust", "top", insetSeg(rectEdges(lid).left, 1, t + 1), dd, { kind: "trapezoid", taperA: 2, taperB: taper }, { stage: 3, stack: -2, label: "Lid dust flap" });
  b.attach("lidDustR", "dust", "top", insetSeg(rectEdges(lid).right, 1, t + 1), dd, { kind: "trapezoid", taperA: 2, taperB: taper }, { stage: 3, stack: -2, label: "Lid dust flap" });
  if (f.thumbNotch) notchPanel(b.byId("front"), rectEdges(walls.front).top, Math.min(14, Lp * 0.08));
  if (f.window) cutWindow(b, "top", f.window, { margin: 12 });
  return { builder: b, closedRotation: TRAY_ROTATION };
}

/** Open-tray options: thumb notch on the front rim, window in the front wall. */
function trayRimFeatures(fr: TrayFrame, f: StructureFeatures) {
  if (f.thumbNotch) notchPanel(fr.b.byId("front"), rectEdges(fr.walls.front).top, Math.min(14, fr.Lp * 0.08, fr.Hp * 0.35));
  if (f.window) cutWindow(fr.b, "front", f.window, { margin: 8 });
}
