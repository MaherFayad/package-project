import type { Dims, StructureFeatures } from "@/types";
import { DielineBuilder, insetSeg, rectEdges } from "../../../builder";
import { cutWindow } from "../../../features";
import { clamp, pt, rectPolygon } from "../../../geometry";
import { pizza, trayWithLid, type StructureDraft } from "../../../structures";
import type { Polygon, Pt } from "../../../types";
import { obliqueFace } from "../engine";
import { TRAY_ROTATION, deg, flaredPoly, flipLayout, rect, slot } from "./common";

type TrayOpts = Parameters<typeof trayWithLid>[2];

/**
 * One-piece cake box: tray with glued/locked corner ears, hinged lid with tuck and side
 * flaps, die-cut lid window with film (on by default). Bakery practice in Egypt: SBS or CUK
 * board, delivered flat, erected in the shop.
 */
export function cakeBox(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  const o: TrayOpts = { doubleFront: false, doubleSides: false, ears: true, lid: true, lidDust: true, tuckRatio: 0.6 };
  return trayWithLid(dims, t, o, f);
}

/** Lock-corner bakery / pastry box: like the cake box but with rolled double end walls that trap the ears (no glue). */
export function bakeryBox(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  const o: TrayOpts = { doubleFront: false, doubleSides: true, ears: true, lid: true, lidDust: true, tuckRatio: 0.55 };
  return trayWithLid(dims, t, o, f);
}

/** FEFCO 0426 pizza box sized for round pizzas (core generator, inch presets). */
export function roundPizza(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  return pizza(dims, t, f);
}

/**
 * Burger clamshell: two trays (base and domed lid) hinged on the back wall, corner ears
 * glued inside the side walls, front lock tab on the lid that drops behind the base front
 * wall through a slot. H = total closed inner height (base 45 %, lid 55 %).
 */
export function burgerClamshell(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  const Lp = dims.L + 4 * t;
  const Wp = dims.W + 2 * t;
  const Ht = dims.H + 2 * t;
  const h1 = Ht * 0.45;
  const h2 = Ht - h1;
  const b = new DielineBuilder();
  const base = rect(0, 0, Lp, Wp);
  b.root("base", "bottom", rectPolygon(0, 0, Lp, Wp), "Base");
  const back = rect(0, -h1, Lp, h1);
  const lidBack = rect(0, -h1 - h2, Lp, h2);
  const lidTop = rect(0, -h1 - h2 - Wp, Lp, Wp);
  const lidFront = rect(0, lidTop.y - h2, Lp, h2);
  const front = rect(0, Wp, Lp, h1);
  b.attach("back", "back", "base", rectEdges(base).top, h1, { kind: "rect" }, { stage: 0, label: "Base back wall" });
  b.attach("front", "front", "base", rectEdges(base).bottom, h1, { kind: "rect" }, { stage: 0, label: "Base front wall" });
  b.attach("right", "right", "base", rectEdges(base).left, h1, { kind: "rect" }, { stage: 1, label: "Base side wall" });
  b.attach("left", "left", "base", rectEdges(base).right, h1, { kind: "rect" }, { stage: 1, label: "Base side wall" });
  // Lid back continues the base back wall above the hinge crease (closed fold 0).
  b.attach("lidBack", "back", "back", rectEdges(back).top, h2, { kind: "rect" }, { fold: 0, stage: 2, label: "Lid back wall (hinge)" });
  b.attach("top", "top", "lidBack", rectEdges(lidBack).top, Wp, { kind: "rect" }, { stage: 2, label: "Lid top" });
  b.attach("lidFront", "front", "top", rectEdges(lidTop).top, h2, { kind: "rect" }, { stage: 3, label: "Lid front wall" });
  b.attach("lidRight", "right", "top", rectEdges(lidTop).left, h2, { kind: "rect" }, { stage: 3, label: "Lid side wall" });
  b.attach("lidLeft", "left", "top", rectEdges(lidTop).right, h2, { kind: "rect" }, { stage: 3, label: "Lid side wall" });
  // Corner ears (glued inside the side walls).
  const ear = (id: string, parent: string, edge: [Pt, Pt], d: number, stage: number) => b.attach(id, "ear", parent, edge, d, { kind: "trapezoid", taperA: Math.min(d * 0.4, 6), taperB: Math.min(d * 0.4, 6) }, { stage, stack: -1, label: "Corner ear" });
  const eD = Math.min(Wp * 0.35, 30);
  ear("earBackL", "back", rectEdges(back).left, eD, 0);
  ear("earBackR", "back", rectEdges(back).right, eD, 0);
  ear("earFrontL", "front", rectEdges(front).left, eD, 0);
  ear("earFrontR", "front", rectEdges(front).right, eD, 0);
  ear("earLidBackL", "lidBack", rectEdges(lidBack).left, eD, 2);
  ear("earLidBackR", "lidBack", rectEdges(lidBack).right, eD, 2);
  ear("earLidFrontL", "lidFront", rectEdges(lidFront).left, eD, 3);
  ear("earLidFrontR", "lidFront", rectEdges(lidFront).right, eD, 3);
  // Front lock: tab on the lid front, slot near the base front rim.
  const tabW = Math.min(50, Lp * 0.35);
  const tabD = Math.min(14, h1 * 0.4);
  b.attach("lockTab", "tuck", "lidFront", insetSeg(rectEdges(lidFront).top, (Lp - tabW) / 2), tabD, { kind: "tuck", shoulder: 1 }, { fold: 0, stage: 3, stack: -1, label: "Lock tab" });
  b.byId("front").holes = [slot(pt(Lp / 2, Wp + h1 - Math.min(5, h1 * 0.15)), tabW + 2, Math.max(1.5, t + 1))];
  flipLayout(b);
  if (f.window) cutWindow(b, "top", f.window, { margin: 15 });
  return { builder: b, closedRotation: TRAY_ROTATION };
}

/**
 * Takeout noodle pail ("oyster pail"), wire-free: square/rectangular bottom, four walls
 * flaring out by `FLARE_DEG`, top closure of four flaps with a tab-and-slit lock instead of
 * a wire handle. L × W = bottom inner size, H = inner height.
 */
export const PAIL_FLARE_DEG = 9;
export function noodlePail(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  const th = (PAIL_FLARE_DEG * Math.PI) / 180;
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const s = (dims.H + t) / Math.cos(th);
  const e = (dims.H + t) * Math.tan(th);
  const b = new DielineBuilder();
  const base = rect(0, 0, Lp, Wp);
  b.root("base", "bottom", rectPolygon(0, 0, Lp, Wp), "Bottom");
  const wallFold = 90 - deg(th);
  const walls: [string, "back" | "front" | "left" | "right", [Pt, Pt]][] = [
    ["back", "back", rectEdges(base).top],
    ["front", "front", rectEdges(base).bottom],
    ["right", "right", rectEdges(base).left],
    ["left", "left", rectEdges(base).right],
  ];
  const far: Record<string, [Pt, Pt]> = {};
  for (const [id, role, edge] of walls) {
    const w = flaredPoly(b, "base", edge, s, e);
    b.attachPoly(id, role, "base", edge, w.poly, { fold: wallFold, stage: 0, label: "Flared wall" });
    far[id] = w.far;
  }
  // Closure: side flaps first, then front over back with tab-and-slit lock.
  const Lt = Lp + 2 * e;
  const Wt = Wp + 2 * e;
  const closeFold = 90 + deg(th);
  for (const id of ["left", "right"]) {
    const d = Math.min(Lt * 0.45, Wt * 0.6);
    b.attach(`${id}Flap`, "dust", id, far[id], d, { kind: "trapezoid", taperA: d * 0.6, taperB: d * 0.6 }, { fold: closeFold, stage: 1, stack: -2, label: "Side closure flap" });
  }
  b.attach("backFlap", "flap", "back", far.back, Wt * 0.5, { kind: "trapezoid", taperA: 4, taperB: 4 }, { fold: closeFold, stage: 2, stack: -1, label: "Back closure flap" });
  const frontD = Wt * 0.5;
  b.attach("top", "top", "front", far.front, frontD, { kind: "trapezoid", taperA: 4, taperB: 4 }, { fold: closeFold, stage: 3, label: "Front closure flap" });
  const tabW = Math.min(36, Lt * 0.3);
  const topFar = (() => {
    const fr = b.frame("front", far.front);
    return [fr.at(fr.a, 4, frontD), fr.at(fr.a, fr.length - 4, frontD)] as [Pt, Pt];
  })();
  b.attach("lockTab", "tuck", "top", insetSeg(topFar, (Math.hypot(topFar[1].x - topFar[0].x, topFar[1].y - topFar[0].y) - tabW) / 2), Math.min(14, Wt * 0.15), { kind: "tuck", shoulder: 1 }, { fold: 90, stage: 3, stack: -1, label: "Lock tab" });
  // Slit in the back flap where the tab enters (just inside its far edge).
  const bf = b.byId("backFlap");
  const bfr = b.frame("back", far.back);
  const sc = bfr.at(bfr.a, bfr.length / 2, Wt * 0.5 - Math.min(10, Wt * 0.1));
  bf.holes = [slot(sc, tabW + 2, Math.max(1.5, t + 1))];
  flipLayout(b);
  void f;
  return {
    builder: b,
    closedRotation: TRAY_ROTATION,
    faces: (panels, computed) => {
      const out = { ...computed };
      for (const face of ["front", "back", "left", "right"] as const) {
        const fi = obliqueFace(face, panels, "base", t, TRAY_ROTATION, face);
        if (fi) out[face] = fi;
      }
      return out;
    },
  };
}

/**
 * Fries scoop: open-top tube, back panel full height, front panel lower with a scooped
 * (concave) rim, side walls sloping between them; tuck bottom with dust flaps.
 * L = front width, W = depth, H = back height.
 */
export function friesScoop(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const Hb = dims.H + t;
  const Hf = Hb * 0.7;
  const dip = Math.min(Hf * 0.15, Lp * 0.12);
  const g = clamp(dims.W * 0.3, 10, 15);
  const b = new DielineBuilder();
  const xL = g;
  const xF = xL + Wp;
  const xR = xF + Lp;
  const xB = xR + Wp;
  const yTopF = Hb - Hf;
  const arc: Pt[] = [];
  const N = 12;
  for (let i = 1; i < N; i++) arc.push(pt(xF + Lp - (i / N) * Lp, yTopF + dip * Math.sin((Math.PI * i) / N)));
  const frontPoly: Polygon = [pt(xF, Hb), pt(xF + Lp, Hb), pt(xF + Lp, yTopF), ...arc, pt(xF, yTopF)];
  b.root("front", "front", frontPoly, "Front (scoop)");
  b.attachPoly("left", "left", "front", [pt(xF, yTopF), pt(xF, Hb)], [pt(xF, yTopF), pt(xF, Hb), pt(xL, Hb), pt(xL, 0)], { stage: 0, label: "Left side" });
  b.attachPoly("right", "right", "front", [pt(xR, yTopF), pt(xR, Hb)], [pt(xR, yTopF), pt(xR, Hb), pt(xB, Hb), pt(xB, 0)], { stage: 0, label: "Right side" });
  b.attachPoly("back", "back", "right", [pt(xB, 0), pt(xB, Hb)], rectPolygon(xB, 0, Lp, Hb), { stage: 0, label: "Back" });
  b.attach("glue", "glue", "left", [pt(xL, 0), pt(xL, Hb)], g, { kind: "trapezoid", taperA: g * 0.6, taperB: g * 0.6 }, { stage: 0, stack: -1, label: "Glue flap" });
  const bottomF: [Pt, Pt] = [pt(xF, Hb), pt(xF + Lp, Hb)];
  b.attach("bottom", "bottom", "front", bottomF, Wp, { kind: "rect" }, { stage: 2, label: "Bottom" });
  b.attach("bottomTuck", "tuck", "bottom", insetSeg([pt(xF, Hb + Wp), pt(xF + Lp, Hb + Wp)], t + 0.5), Math.min(15, Hb * 0.25), { kind: "tuck", shoulder: 1 }, { stage: 2, stack: -1, label: "Bottom tuck" });
  for (const [id, x0] of [["left", xL], ["right", xR]] as const) {
    const d = Math.min(Wp * 0.8, Lp * 0.45);
    b.attach(`dust_${id}`, "dust", id, [pt(x0, Hb), pt(x0 + Wp, Hb)], d, { kind: "trapezoid", taperA: d * 0.3, taperB: d * 0.3 }, { stage: 1, stack: -1, label: "Bottom dust flap" });
  }
  if (f.window) cutWindow(b, "back", f.window);
  return { builder: b, closedRotation: [0, 0, 0, 1] };
}

/**
 * Sandwich wedge: right-triangle prism. Base L × W, back wall L × H, sloped lid panel
 * (hypotenuse, usually windowed) glued to the back wall; triangular end walls with glue
 * flaps on the slope. L = length, W = depth at the base, H = height at the back.
 */
export function sandwichWedge(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 2 * t;
  const S = Math.hypot(Wp, Hp);
  const alpha = Math.atan2(Hp, Wp);
  const b = new DielineBuilder();
  const base = rect(0, 0, Lp, Wp);
  b.root("base", "bottom", rectPolygon(0, 0, Lp, Wp), "Base");
  b.attach("back", "back", "base", rectEdges(base).top, Hp, { kind: "rect" }, { stage: 0, label: "Back wall" });
  // End triangles: base side edge (back corner at top of sheet) → apex H above the back corner.
  const tri = (edge: [Pt, Pt]) => {
    const fr = b.frame("base", edge);
    // edge runs from back (y=0) to front (y=Wp); the vertical leg stands at the back end.
    return [fr.at(fr.a, 0, 0), fr.at(fr.a, fr.length, 0), fr.at(fr.a, 0, Hp)];
  };
  const eL: [Pt, Pt] = [pt(0, 0), pt(0, Wp)];
  const eR: [Pt, Pt] = [pt(Lp, 0), pt(Lp, Wp)];
  b.attachPoly("right", "right", "base", eL, tri(eL), { stage: 1, label: "End triangle" });
  b.attachPoly("left", "left", "base", eR, tri(eR), { stage: 1, label: "End triangle" });
  const slope = rect(0, Wp, Lp, S);
  b.attach("top", "top", "base", rectEdges(base).bottom, S, { kind: "rect" }, { fold: 180 - deg(alpha), stage: 2, label: "Sloped lid" });
  const gD = Math.min(15, Hp * 0.4);
  b.attach("slopeGlue", "glue", "top", insetSeg(rectEdges(slope).bottom, t + 0.5), gD, { kind: "trapezoid", taperA: 3, taperB: 3 }, { fold: 90 + deg(alpha), stage: 3, stack: -1, label: "Glue flap (to back wall)" });
  const sideD = Math.min(12, Wp * 0.3);
  b.attach("slopeFlapR", "glue", "top", insetSeg(rectEdges(slope).left, S * 0.25, S * 0.2), sideD, { kind: "trapezoid", taperA: 3, taperB: 3 }, { stage: 3, stack: -1, label: "Glue flap (to end)" });
  b.attach("slopeFlapL", "glue", "top", insetSeg(rectEdges(slope).right, S * 0.25, S * 0.2), sideD, { kind: "trapezoid", taperA: 3, taperB: 3 }, { stage: 3, stack: -1, label: "Glue flap (to end)" });
  flipLayout(b);
  if (f.window) cutWindow(b, "top", f.window, { margin: 12 });
  return {
    builder: b,
    closedRotation: TRAY_ROTATION,
    faces: (panels, computed) => {
      const top = obliqueFace("top", panels, "base", t, TRAY_ROTATION, "top");
      return top ? { ...computed, top, front: { ...top, face: "front" } } : computed;
    },
  };
}

/**
 * Pizza slice box: isosceles-triangle tray (back edge L, depth W to the nose) with a
 * hinged triangular lid and side tuck flaps; back-wall ears glued inside the side walls.
 */
export function pizzaSlice(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  const B = dims.L + 4 * t;
  const D = dims.W + 2 * t;
  const Hp = dims.H + 2 * t;
  const b = new DielineBuilder();
  const tri: Polygon = [pt(0, 0), pt(B, 0), pt(B / 2, D)];
  b.root("base", "bottom", tri, "Base");
  b.attach("back", "back", "base", [pt(0, 0), pt(B, 0)], Hp, { kind: "rect" }, { stage: 0, label: "Back wall" });
  b.attach("sideR", "flap", "base", [pt(0, 0), pt(B / 2, D)], Hp, { kind: "rect" }, { stage: 1, label: "Side wall" });
  b.attach("sideL", "flap", "base", [pt(B, 0), pt(B / 2, D)], Hp, { kind: "rect" }, { stage: 1, label: "Side wall" });
  const eD = Math.min(25, D * 0.25);
  b.attach("earL", "ear", "back", [pt(0, 0), pt(0, -Hp)], eD, { kind: "trapezoid", taperA: 4, taperB: 4 }, { fold: 180 - deg(Math.atan2(D, B / 2)), pivotDepth: 1, stage: 0, stack: -1, label: "Corner ear" });
  b.attach("earR", "ear", "back", [pt(B, 0), pt(B, -Hp)], eD, { kind: "trapezoid", taperA: 4, taperB: 4 }, { fold: 180 - deg(Math.atan2(D, B / 2)), pivotDepth: 1, stage: 0, stack: -1, label: "Corner ear" });
  const yL = -Hp;
  const lidTri: Polygon = [pt(0, yL), pt(B, yL), pt(B / 2, yL - D)];
  b.attachPoly("top", "top", "back", [pt(0, yL), pt(B, yL)], lidTri, { stage: 2, label: "Lid" });
  const flapD = Math.max(6, Hp - 2 * t - 2);
  const s = Math.hypot(B / 2, D);
  b.attach("lidFlapR", "dust", "top", insetSeg([pt(0, yL), pt(B / 2, yL - D)], 3, s * 0.18), flapD, { kind: "trapezoid", taperA: 3, taperB: flapD * 0.6 }, { stage: 3, stack: -1, label: "Lid side flap" });
  b.attach("lidFlapL", "dust", "top", insetSeg([pt(B, yL), pt(B / 2, yL - D)], 3, s * 0.18), flapD, { kind: "trapezoid", taperA: 3, taperB: flapD * 0.6 }, { stage: 3, stack: -1, label: "Lid side flap" });
  flipLayout(b);
  if (f.window) {
    // Triangular lid: a centred window in the lid's middle third.
    const lid = b.byId("top");
    const c = { x: (lid.polygon[0].x + lid.polygon[1].x + lid.polygon[2].x) / 3, y: (lid.polygon[0].y + lid.polygon[1].y + lid.polygon[2].y) / 3 };
    const w = B * 0.3;
    const h = D * 0.25;
    lid.holes = [slot(c, w, h)];
    if (f.window.film !== false) b.films.push({ panelId: "top", polygon: slot(c, w + 12, h + 12) });
  }
  return { builder: b, closedRotation: TRAY_ROTATION };
}
