import type { Dims, FaceId, StructureFeatures } from "@/types";
import { DielineBuilder, insetSeg, rectEdges } from "../../../builder";
import { cutWindow } from "../../../features";
import { computeFaces } from "../../../fold";
import { clamp, pt, rectPolygon } from "../../../geometry";
import { pizza, trayWithLid, type StructureDraft } from "../../../structures";
import type { Polygon, Pt } from "../../../types";
import { obliqueFace, stackedObliqueFace } from "../engine";
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

/** Steam vents in a pizza box front: diameter and count (two, either side of centre). */
export const PIZZA_VENT_MM = 8;

/** Round hole as a 16-gon. */
const circle = (c: Pt, r: number): Polygon => Array.from({ length: 16 }, (_, i) => pt(c.x + r * Math.cos((i * Math.PI) / 8), c.y + r * Math.sin((i * Math.PI) / 8)));

/**
 * FEFCO 0426 pizza box sized for round pizzas (core generator, inch presets), with the two
 * steam vents delivery pizza boxes carry: round holes through the front wall just below the
 * rim, die-cut in line through the lid tuck behind it so the steam escapes and the crust
 * stays crisp.
 */
export function roundPizza(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  const draft = pizza(dims, t, f);
  const b = draft.builder;
  const front = b.byId("front");
  const base = b.byId(b.rootId);
  const top = b.panels.find((p) => p.id === "top");
  const tuck = b.panels.find((p) => p.id === "lidTuck");
  const below = Math.min(10, front.bbox.height * 0.3);
  const r = Math.min(PIZZA_VENT_MM, front.bbox.height * 0.3) / 2;
  if (!top || !tuck || tuck.bbox.height < below + r + 2) return draft;
  // Rim = the front wall edge away from the base; tuck hinge = its edge on the lid.
  const yFront = front.bbox.y < base.bbox.y ? front.bbox.y + below : front.bbox.y + front.bbox.height - below;
  const yTuck = tuck.bbox.y > top.bbox.y ? tuck.bbox.y + below : tuck.bbox.y + tuck.bbox.height - below;
  const cx = front.bbox.x + front.bbox.width / 2;
  const off = Math.min(front.bbox.width * 0.2, 60);
  front.holes = [...(front.holes ?? []), ...[-off, off].map((dx) => circle(pt(cx + dx, yFront), r))];
  tuck.holes = [...(tuck.holes ?? []), ...[-off, off].map((dx) => circle(pt(cx + dx, yTuck), r))];
  return draft;
}

/**
 * Burger clamshell: two flared trays hinged on the back wall, the classic paperboard burger
 * box. Base walls lean OUT by `CLAMSHELL_FLARE_DEG` going up, lid walls lean in going up, so
 * the closed box is widest at the rim where lid and base meet (hexagonal side profile).
 * Corner ears on the front / back walls are glued inside the side walls; a lock tab on the lid
 * front drops through a slot near the base front rim. L × W = inner bottom, H = total closed
 * inner height (base 45 %, lid 55 %).
 */
export const CLAMSHELL_FLARE_DEG = 12;
export function burgerClamshell(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  const th = (CLAMSHELL_FLARE_DEG * Math.PI) / 180;
  const Lp = dims.L + 4 * t;
  const Wp = dims.W + 2 * t;
  const Ht = dims.H + 2 * t;
  const h1 = Ht * 0.45;
  const h2 = Ht - h1;
  const s1 = h1 / Math.cos(th);
  const s2 = h2 / Math.cos(th);
  const e1 = h1 * Math.tan(th);
  const e2 = h2 * Math.tan(th);
  const wallFold = 90 - deg(th);
  // Two flared walls meet at the corner line; a front/back ear folds onto the side wall
  // plane: the angle between their normals.
  const earFold = deg(Math.acos(Math.sin(th) ** 2));
  // On the flat sheet the gap between two flared walls at a corner is 90° − 2·(flare in the
  // sheet); taper the ear's corner end so it never overlaps the neighbouring wall.
  const sheetFlare = Math.atan(Math.tan(th) * Math.cos(th));
  const cornerTaper = (d: number) => d / Math.tan(Math.PI / 2 - 2 * sheetFlare - (6 * Math.PI) / 180);

  const b = new DielineBuilder();
  const base = rect(0, 0, Lp, Wp);
  const E = rectEdges(base);
  b.root("base", "bottom", rectPolygon(0, 0, Lp, Wp), "Base");
  const wall = (id: string, role: "front" | "back" | "left" | "right", parent: string, edge: [Pt, Pt], depth: number, grow: number, fold: number, stage: number, label: string) => {
    const w = flaredPoly(b, parent, edge, depth, grow);
    b.attachPoly(id, role, parent, edge, w.poly, { fold, stage, label });
    return w;
  };
  const back = wall("back", "back", "base", E.top, s1, e1, wallFold, 0, "Base back wall");
  const front = wall("front", "front", "base", E.bottom, s1, e1, wallFold, 0, "Base front wall");
  wall("right", "right", "base", E.left, s1, e1, wallFold, 1, "Base side wall");
  wall("left", "left", "base", E.right, s1, e1, wallFold, 1, "Base side wall");
  // Lid back continues the base back above the hinge crease, leaning in: fold 2θ.
  const lidBack = wall("lidBack", "back", "back", back.far, s2, -e2, 2 * deg(th), 2, "Lid back wall (hinge)");
  const Lt = Lp + 2 * e1 - 2 * e2;
  const Wt = Wp + 2 * e1 - 2 * e2;
  b.attach("top", "top", "lidBack", lidBack.far, Wt, { kind: "rect" }, { fold: wallFold, stage: 2, label: "Lid top" });
  const topR = (() => {
    const fr = b.frame("lidBack", lidBack.far);
    const q = [fr.a, fr.b, fr.at(fr.b, 0, Wt), fr.at(fr.a, 0, Wt)];
    const xs = q.map((p) => p.x);
    const ys = q.map((p) => p.y);
    return rect(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  })();
  const TE = rectEdges(topR);
  const lidFront = wall("lidFront", "front", "top", TE.top, s2, e2, wallFold, 3, "Lid front wall");
  wall("lidRight", "right", "top", TE.left, s2, e2, wallFold, 3, "Lid side wall");
  wall("lidLeft", "left", "top", TE.right, s2, e2, wallFold, 3, "Lid side wall");
  void Lt;

  // Corner ears (glued inside the side walls). `corner` = the lateral edge's end at the
  // sheet corner between the two walls.
  const eD = Math.min(Wp * 0.3, h1 * 0.9, 26);
  const ear = (id: string, parent: string, corner: Pt, other: Pt, stage: number) => {
    const d = Math.min(eD, Math.hypot(other.x - corner.x, other.y - corner.y) * 0.9);
    b.attach(id, "ear", parent, [corner, other], d, { kind: "trapezoid", taperA: Math.min(cornerTaper(d), d * 0.9), taperB: Math.min(4, d * 0.3) }, { fold: earFold, pivotDepth: 0, stage, stack: -1, label: "Corner ear" });
  };
  // flaredPoly → [hinge a, hinge b, far b, far a].
  const lat = (w: { poly: Polygon }, atHinge: boolean) => {
    const [p0, p1, p2, p3] = w.poly;
    return atHinge ? ([[p0, p3], [p1, p2]] as const) : ([[p3, p0], [p2, p1]] as const);
  };
  for (const [k, [c, o]] of lat(back, true).entries()) ear(`earBack${k ? "R" : "L"}`, "back", c, o, 0);
  for (const [k, [c, o]] of lat(front, true).entries()) ear(`earFront${k ? "R" : "L"}`, "front", c, o, 0);
  for (const [k, [c, o]] of lat(lidBack, false).entries()) ear(`earLidBack${k ? "R" : "L"}`, "lidBack", c, o, 2);
  for (const [k, [c, o]] of lat(lidFront, true).entries()) ear(`earLidFront${k ? "R" : "L"}`, "lidFront", c, o, 3);

  // Front lock: tab on the lid front rim, turned 2θ so it drops inside the base front through
  // a slot just below the base rim.
  const Lr = Lp + 2 * e1;
  const tabW = Math.min(50, Lr * 0.35);
  const tabD = Math.min(14, h1 * 0.4);
  b.attach("lockTab", "tuck", "lidFront", insetSeg(lidFront.far, (Lr - tabW) / 2), tabD, { kind: "tuck", shoulder: 1 }, { fold: 2 * deg(th), stage: 3, stack: -1, label: "Lock tab" });
  const ff = b.frame("base", E.bottom);
  const slotDepth = s1 - Math.min(5, s1 * 0.15);
  b.byId("front").holes = [slot(ff.at(ff.a, ff.length / 2, slotDepth), tabW + 2, Math.max(1.5, t + 1))];
  flipLayout(b);
  if (f.window) cutWindow(b, "top", f.window, { margin: 15 });
  return {
    builder: b,
    closedRotation: TRAY_ROTATION,
    faces: (panels, computed) => {
      const out = { ...computed };
      const sides: [FaceId, string[]][] = [
        ["front", ["lidFront", "front"]],
        ["back", ["lidBack", "back"]],
        ["left", ["lidLeft", "left"]],
        ["right", ["lidRight", "right"]],
      ];
      for (const [face, ids] of sides) {
        const fi = stackedObliqueFace(face, panels, "base", t, TRAY_ROTATION, ids);
        if (fi) out[face] = fi;
      }
      return out;
    },
  };
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
      // The back closure flap shows behind the front one on top (half the lid): the automatic
      // top face skips it (stacked one caliper in), which left it plain board and cut the
      // top artwork in half (R5-3Q-D-07). Same face frame; the stack only shifts it along n.
      const lifted = panels.map((p) => (p.id === "backFlap" ? { ...p, stackOffset: 0 } : p));
      const back = computeFaces({ panels: lifted, rootId: "base", thicknessMm: t, closedRotation: TRAY_ROTATION }).faces.top?.parts.find((x) => x.panelId === "backFlap");
      if (out.top && back) out.top = { ...out.top, parts: [back, ...out.top.parts] };
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
  b.attach("bottomTuck", "tuck", "bottom", insetSeg([pt(xF, Hb + Wp), pt(xF + Lp, Hb + Wp)], t + 0.5), Math.min(15, Hb * 0.25), { kind: "tuck", shoulder: 1 }, { stage: 2, stack: -2, label: "Bottom tuck" }); // under the glue flap
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
    // The sloped lid's board edge at its two hinges stands ~0.7 t proud of the base and back
    // planes, so the automatic back and bottom faces (0.25 t deep) came out empty: the back
    // wall and base printed nothing (R5-3Q-D-08).
    faceDepthTol: t,
    faces: (panels, computed) => {
      // The sloped (window) lid is ONE face, "top". It was also copied as "front", so two
      // faces mapped the same panel: the editor listed both, the front artwork was painted
      // over the top artwork and a design on Top never showed (R6-3Q-D).
      const top = obliqueFace("top", panels, "base", t, TRAY_ROTATION, "top");
      const { front: _front, ...rest } = computed;
      void _front;
      return top ? { ...rest, top } : rest;
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
  // Corner ears fold from the back wall to the side wall's angle φ and must lie on the side
  // wall's INSIDE face. With pivot depth d and stack s (in t) the folded ear's face sits
  // t·(d(1 + cos φ) + s) off the side wall's outer face (want −t), and its hinge end moves
  // t·(d(1 + cos φ)(1 − cos φ) − cos φ) into the box (want ≥ 0, else it pokes out the back).
  // The old d = 1, s = −1 pushed the ears 0.56 mm through the side walls.
  const phi = Math.atan2(D, B / 2);
  const cphi = Math.cos(phi);
  const earPivot = cphi / (1 - cphi * cphi) + 0.05;
  const earStack = -1 - earPivot * (1 + cphi);
  const eD = Math.min(25, D * 0.25);
  b.attach("earL", "ear", "back", [pt(0, 0), pt(0, -Hp)], eD, { kind: "trapezoid", taperA: 4, taperB: 4 }, { fold: 180 - deg(phi), pivotDepth: earPivot, stage: 0, stack: earStack, label: "Corner ear" });
  b.attach("earR", "ear", "back", [pt(B, 0), pt(B, -Hp)], eD, { kind: "trapezoid", taperA: 4, taperB: 4 }, { fold: 180 - deg(phi), pivotDepth: earPivot, stage: 0, stack: earStack, label: "Corner ear" });
  const yL = -Hp;
  const lidTri: Polygon = [pt(0, yL), pt(B, yL), pt(B / 2, yL - D)];
  b.attachPoly("top", "top", "back", [pt(0, yL), pt(B, yL)], lidTri, { stage: 2, label: "Lid" });
  const flapD = Math.max(6, Hp - 2 * t - 2);
  const s = Math.hypot(B / 2, D);
  b.attach("lidFlapR", "dust", "top", insetSeg([pt(0, yL), pt(B / 2, yL - D)], 3, s * 0.18), flapD, { kind: "trapezoid", taperA: 3, taperB: flapD * 0.6 }, { stage: 3, stack: -2, label: "Lid side flap" });
  b.attach("lidFlapL", "dust", "top", insetSeg([pt(B, yL), pt(B / 2, yL - D)], 3, s * 0.18), flapD, { kind: "trapezoid", taperA: 3, taperB: flapD * 0.6 }, { stage: 3, stack: -2, label: "Lid side flap" });
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
  return {
    builder: b,
    closedRotation: TRAY_ROTATION,
    // The oblique side walls' board ends stand ~0.4 t behind the back wall plane at the back
    // corners, so the automatic back face (0.25 t deep) was empty (R5-3Q-D-09).
    faceDepthTol: t,
    // The two long side walls are what shows on the counter: print them (left / right) as
    // oblique faces (they were plain board, R5-3Q-D-09).
    faces: (panels, computed) => {
      const out = { ...computed };
      for (const [face, id] of [["right", "sideR"], ["left", "sideL"]] as const) {
        const fi = obliqueFace(face, panels, "base", t, TRAY_ROTATION, id);
        if (fi) out[face] = fi;
      }
      return out;
    },
  };
}
