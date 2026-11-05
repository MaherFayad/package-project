import { Matrix4, Vector3 } from "three";
import type { Dims } from "@/types";
import { DielineBuilder, insetSeg, rectEdges } from "@/lib/dieline/builder";
import { boundsAt } from "@/lib/dieline/fold";
import { stadium } from "@/lib/dieline/features";
import { clamp, pt, rectPolygon } from "@/lib/dieline/geometry";
import type { StructureDraft } from "@/lib/dieline/structures";
import type { Polygon } from "@/lib/dieline/types";
import {
  CRASH_LAYERS,
  IDENTITY,
  TILT,
  TOP_LAYERS,
  type CaseTop,
  caseTop,
  caseTube,
  circle,
  closedBounds,
  crashLockBottom,
  partitions,
  rect,
  sheetBox,
  webCorner,
} from "./parts";

/**
 * FEFCO group 07 — ready-glued cases: "basically one piece, shipped flat and ready to use by
 * simple setting up". Two constructions:
 * - auto-bottom (crash-lock) cases: a glued four-panel tube whose bottom flaps are pre-glued
 *   on 45° creases, so squaring the flat tube pops the bottom closed (0700–0717),
 * - ready-glued trays: web (gusset) corners glued in the flat, so the tray erects in one move
 *   (0718, 0747–0774).
 */

/* ───────────────────────── Auto-bottom cases ───────────────────────── */

export interface CaseOpts {
  top: CaseTop;
  /** 0701 / 0703: one bottom flap covers the whole bottom. */
  fullBottom?: boolean;
  /** 0716: tear-off top (perforation round the walls leaving a display tray). */
  tearOff?: boolean;
  /** Divider grid (0715, 0717): cells along L × along W. */
  cells?: { cols: number; rows: number };
}

export const caseDims = (dims: Dims, t: number, top: CaseTop) => ({
  Lp: dims.L + 2 * t,
  Wp: dims.W + 2 * t,
  Hp: dims.H + (CRASH_LAYERS + TOP_LAYERS[top]) * t,
});

/** Display-front height left after the 0716 tear-off. */
export const tearFrontHeight = (H: number) => clamp(H * 0.35, 30, 90);

export function autoBottomCase(dims: Dims, t: number, o: CaseOpts): StructureDraft {
  const { Lp, Wp, Hp } = caseDims(dims, t, o.top);
  const b = new DielineBuilder();
  const w = caseTube(b, Lp, Wp, Hp);
  crashLockBottom(b, w, t, { full: o.fullBottom });
  caseTop(b, w, t, o.top);
  if (o.tearOff) {
    // One perforation round the case: low across the front (display front), high across the
    // back (header), diagonal on the ends.
    const lowY = w.front.y + Hp - tearFrontHeight(dims.H);
    const highY = w.back.y + Math.min(25, Hp * 0.15);
    b.perfLines.push({ a: pt(w.front.x + 1, lowY), b: pt(w.front.x + Lp - 1, lowY) });
    b.perfLines.push({ a: pt(w.back.x + 1, highY), b: pt(w.back.x + Lp - 1, highY) });
    b.perfLines.push({ a: pt(w.right.x + 1, lowY), b: pt(w.right.x + Wp - 1, highY) });
    b.perfLines.push({ a: pt(w.left.x + 1, highY), b: pt(w.left.x + Wp - 1, lowY) });
  }
  if (o.cells) partitions(b, t, IDENTITY, dims, { rows: o.cells.rows, cols: o.cells.cols }, CRASH_LAYERS * t);
  return { builder: b, closedRotation: IDENTITY };
}

/* ───────────────────────── 0714: auto-bottom base + auto-bottom lid ───────────────────────── */

export const telescopeClearance = (t: number) => Math.max(1, t * 0.5);
export const telescopeLidDepth = (H: number) => clamp(Math.round(H * 0.5), 40, H);

/**
 * FEFCO 0714: two auto-bottom tubes. The base is open at the top; the lid (inner = base outer
 * + clearance) is the same construction turned upside down, slipping over the base.
 */
export function autoBottomTelescope(dims: Dims, t: number): StructureDraft {
  const { Lp, Wp, Hp } = caseDims(dims, t, "open");
  const clr = telescopeClearance(t);
  const b = new DielineBuilder();
  const w = caseTube(b, Lp, Wp, Hp);
  crashLockBottom(b, w, t);
  const baseBox = closedBounds(b, b.subtree("front"), t, IDENTITY);

  const lidH = telescopeLidDepth(dims.H);
  const lidLp = Lp + 2 * clr + 2 * t;
  const lidWp = Wp + 2 * clr + 2 * t;
  const lidHp = lidH + CRASH_LAYERS * t;
  const sb = sheetBox(b);
  const origin = pt(sb.x, sb.y + sb.height + lidWp / 2 + 30);
  const lw = caseTube(b, lidLp, lidWp, lidHp, { prefix: "lid_", origin, piece: { label: "Lid", assembly: { matrix: new Matrix4().toArray(), stage: 3, lift: dims.H * 1.2 } } });
  crashLockBottom(b, lw, t, { prefix: "lid_" });
  // Lid closed in its own flat frame (identity assembly), then turned over onto the base.
  const lidBox = boundsAt({ panels: b.panels.filter((p) => b.subtree("lid_front").includes(p.id)), rootId: "lid_front", thicknessMm: t, closedRotation: IDENTITY }, 1);
  const cl = lidBox.getCenter(new Vector3());
  const lidOuterH = lidBox.max.y - lidBox.min.y;
  const target = new Vector3((baseBox.min.x + baseBox.max.x) / 2, baseBox.max.y + CRASH_LAYERS * t - lidOuterH / 2, (baseBox.min.z + baseBox.max.z) / 2);
  const m = new Matrix4().makeTranslation(target.x, target.y, target.z).multiply(new Matrix4().makeRotationZ(Math.PI)).multiply(new Matrix4().makeTranslation(-cl.x, -cl.y, -cl.z));
  b.byId("lid_front").assembly = { matrix: m.toArray(), stage: 3, lift: dims.H * 1.2 };
  return { builder: b, closedRotation: IDENTITY, faceDepthTol: clr + t + 0.6 };
}

/* ───────────────────────── 0752: glued tube with cells ───────────────────────── */

export const tubeCells = (L: number, W: number) => clamp(Math.round(L / Math.max(W, 60)), 2, 8);

/**
 * FEFCO 0752: a long glued four-panel tube, open at both ends, divided into a row of cells.
 * The die-cut cell tongues of the standard are modelled as cross partitions.
 */
export function cellTube(dims: Dims, t: number): StructureDraft {
  const Lt = dims.L;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 2 * t;
  const b = new DielineBuilder();
  const base = rect(0, 0, Lt, Wp);
  const back = rect(0, Wp, Lt, Hp);
  const top = rect(0, Wp + Hp, Lt, Wp);
  b.root("bottom", "bottom", rectPolygon(0, 0, Lt, Wp), "Bottom");
  b.attach("front", "front", "bottom", rectEdges(base).top, Hp, { kind: "rect" }, { stage: 0, label: "Front" });
  b.attach("back", "back", "bottom", rectEdges(base).bottom, Hp, { kind: "rect" }, { stage: 0, label: "Back" });
  b.attach("top", "top", "back", rectEdges(back).bottom, Wp, { kind: "rect" }, { stage: 0, label: "Top" });
  const j = clamp(dims.H * 0.25, 20, 35);
  b.attach("joint", "glue", "top", insetSeg(rectEdges(top).bottom, 2), j, { kind: "trapezoid", taperA: j * 0.3, taperB: j * 0.3 }, { stage: 0, stack: -1, label: "Manufacturer's joint" });
  partitions(b, t, TILT, dims, { rows: 1, cols: tubeCells(dims.L, dims.W) }, t);
  return { builder: b, closedRotation: TILT };
}

/* ───────────────────────── Ready-glued trays ───────────────────────── */

export interface TrayOpts {
  /** Web corners onto the end walls (hinged on the long walls) or onto the long walls. "back" = only the two back corners are webs, the front corners use glue flaps (0747). */
  webs: "ends" | "long" | "back";
  doubleLong?: boolean;
  doubleEnds?: boolean;
  lid?: "tuck" | "tuckDust" | "skirt";
  lidHoles?: boolean;
  baseHoles?: number;
  endHandHoles?: boolean;
  longHandHoles?: boolean;
  /** Stacking lugs on the end-wall rims (0770). */
  lugs?: boolean;
  /** Cut-down long walls (0771). */
  cutDown?: boolean;
}

export const lugHeight = (H: number) => clamp(H * 0.08, 6, 12);

export const trayDims = (dims: Dims, t: number, o: TrayOpts) => ({
  Lp: dims.L + 2 * t * (o.doubleEnds ? 2 : 1),
  Wp: dims.W + 2 * t * (o.doubleLong ? 2 : 1),
  Hp: dims.H + t * (o.lid ? 2 : 1),
});

export function readyGluedTray(dims: Dims, t: number, o: TrayOpts): StructureDraft {
  const { Lp, Wp, Hp } = trayDims(dims, t, o);
  const b = new DielineBuilder();
  const base = rect(0, 0, Lp, Wp);
  const front = rect(0, -Hp, Lp, Hp);
  const back = rect(0, Wp, Lp, Hp);
  const left = rect(-Hp, 0, Hp, Wp);
  const right = rect(Lp, 0, Hp, Wp);
  b.root("bottom", "bottom", rectPolygon(0, 0, Lp, Wp), "Base");
  if (o.baseHoles) {
    const n = o.baseHoles;
    const d = Math.min(30, dims.W * 0.12, (dims.L * 0.6) / n);
    const holes: Polygon[] = [];
    for (let i = 0; i < n; i++) holes.push(circle(Lp * (0.2 + (0.6 * (i + 0.5)) / n), Wp / 2 + (n > 3 && i % 2 ? Wp * 0.18 : 0), d));
    b.byId("bottom").holes = holes;
  }

  // Long walls (front / back).
  const longWall = (id: "front" | "back") => {
    const edge = id === "front" ? rectEdges(base).top : rectEdges(base).bottom;
    if (o.cutDown) {
      const f = b.frame("bottom", edge);
      const L = f.length;
      const drop = Hp * 0.35;
      const c = Math.min(L * 0.2, 60);
      const s = Math.min(drop, 20);
      const poly: Polygon = [f.at(f.a, 0, 0), f.at(f.a, L, 0), f.at(f.a, L, Hp), f.at(f.a, L - c, Hp), f.at(f.a, L - c - s, Hp - drop), f.at(f.a, c + s, Hp - drop), f.at(f.a, c, Hp), f.at(f.a, 0, Hp)];
      b.attachPoly(id, id, "bottom", [f.a, f.b], poly, { stage: 0, label: "Cut-down long wall" });
    } else {
      b.attach(id, id, "bottom", edge, Hp, { kind: "rect" }, { stage: 0, label: "Long wall" });
    }
  };
  longWall("front");
  longWall("back");

  // End walls (left / right), optionally with stacking lugs at the rim corners.
  const endWall = (id: "left" | "right") => {
    const edge = id === "left" ? rectEdges(base).left : rectEdges(base).right;
    if (o.lugs) {
      const f = b.frame("bottom", edge);
      const L = f.length;
      const lw = Math.min(25, L * 0.15);
      const lh = lugHeight(dims.H);
      const poly: Polygon = [f.at(f.a, 0, 0), f.at(f.a, L, 0), f.at(f.a, L, Hp), f.at(f.a, L - 2 * t - 1, Hp), f.at(f.a, L - 2 * t - 1, Hp + lh), f.at(f.a, L - 2 * t - 1 - lw, Hp + lh), f.at(f.a, L - 2 * t - 1 - lw, Hp), f.at(f.a, 2 * t + 1 + lw, Hp), f.at(f.a, 2 * t + 1 + lw, Hp + lh), f.at(f.a, 2 * t + 1, Hp + lh), f.at(f.a, 2 * t + 1, Hp), f.at(f.a, 0, Hp)];
      b.attachPoly(id, id, "bottom", [f.a, f.b], poly, { stage: 0, label: "End wall with stacking lugs" });
    } else {
      b.attach(id, id, "bottom", edge, Hp, { kind: "rect" }, { stage: 0, label: "End wall" });
    }
  };
  endWall("left");
  endWall("right");

  // Corners.
  const sideLayers = o.doubleEnds ? 2 : 1;
  const longLayers = o.doubleLong ? 2 : 1;
  if (o.webs === "ends" || o.webs === "back") {
    webCorner(b, "back", [pt(Lp, Wp), pt(Lp, Wp + Hp)], Hp, "br");
    webCorner(b, "back", [pt(0, Wp), pt(0, Wp + Hp)], Hp, "bl");
    if (o.webs === "ends") {
      webCorner(b, "front", [pt(Lp, 0), pt(Lp, -Hp)], Hp, "fr");
      webCorner(b, "front", [pt(0, 0), pt(0, -Hp)], Hp, "fl");
    } else {
      const e = Math.min(Wp * 0.3, 40);
      b.attach("cornerFlapR", "glue", "front", [pt(Lp, 0), pt(Lp, -Hp)], e, { kind: "trapezoid", taperA: 2, taperB: e * 0.4 }, { stage: 0, stack: -1, label: "Corner glue flap" });
      b.attach("cornerFlapL", "glue", "front", [pt(0, 0), pt(0, -Hp)], e, { kind: "trapezoid", taperA: 2, taperB: e * 0.4 }, { stage: 0, stack: -1, label: "Corner glue flap" });
    }
  } else {
    webCorner(b, "right", [pt(Lp, 0), pt(Lp + Hp, 0)], Hp, "rf");
    webCorner(b, "right", [pt(Lp, Wp), pt(Lp + Hp, Wp)], Hp, "rb");
    webCorner(b, "left", [pt(0, 0), pt(-Hp, 0)], Hp, "lf");
    webCorner(b, "left", [pt(0, Wp), pt(-Hp, Wp)], Hp, "lb");
  }
  const websOnEnds = o.webs !== "long";

  // Rolled double walls (inner walls fold 180° over the rim).
  if (o.doubleLong) {
    const inset = sideLayers * t + (websOnEnds ? 2 * t : 0) + 0.5;
    for (const [id, edge] of [["front", rectEdges(front).top], ["back", rectEdges(back).bottom]] as const) {
      b.attach(`${id}Inner`, "inner", id, insetSeg(edge, inset), Hp - t - 0.5, { kind: "rect" }, { fold: 180, pivotDepth: 1, stage: 1, label: "Inner long wall" });
    }
  }
  if (o.doubleEnds) {
    const inset = longLayers * t + (websOnEnds ? 0 : 2 * t) + 0.5;
    for (const [id, edge] of [["left", rectEdges(left).left], ["right", rectEdges(right).right]] as const) {
      b.attach(`${id}Inner`, "inner", id, insetSeg(edge, inset), Hp - t - 0.5, { kind: "rect" }, { fold: 180, pivotDepth: 1, stage: 1, label: "Inner end wall" });
    }
  }

  // Hand holes.
  const hw = (len: number) => Math.min(90, len * 0.45);
  const hh = Math.min(26, Hp * 0.22);
  const holeAt = (id: string, cx: number, cy: number, w: number, horizontal: boolean) => {
    const p = b.byId(id);
    if (w < 35 || hh < 12) return;
    p.holes = [...(p.holes ?? []), horizontal ? stadium(cx, cy, w, hh) : stadium(cx, cy, hh, w, false)];
  };
  const rimOff = Math.max(12, Hp * 0.15) + hh / 2;
  if (o.endHandHoles) {
    holeAt("left", -Hp + rimOff, Wp / 2, hw(Wp), false);
    holeAt("right", Lp + Hp - rimOff, Wp / 2, hw(Wp), false);
    if (o.doubleEnds) {
      for (const id of ["leftInner", "rightInner"]) {
        const p = b.byId(id);
        // The inner wall's rim is its hinge edge.
        const hx = id === "leftInner" ? p.bbox.x + p.bbox.width - rimOff : p.bbox.x + rimOff;
        holeAt(id, hx, Wp / 2, hw(Wp), false);
      }
    }
  }
  if (o.longHandHoles) {
    holeAt("front", Lp / 2, -Hp + rimOff, hw(Lp), true);
    holeAt("back", Lp / 2, Wp + Hp - rimOff, hw(Lp), true);
    if (o.doubleLong) {
      const fi = b.byId("frontInner");
      holeAt("frontInner", Lp / 2, fi.bbox.y + fi.bbox.height - rimOff, hw(Lp), true);
      const bi = b.byId("backInner");
      holeAt("backInner", Lp / 2, bi.bbox.y + rimOff, hw(Lp), true);
    }
  }

  // Lid on the back wall.
  if (o.lid) {
    const lidD = o.lid === "skirt" ? Wp + t : Wp;
    b.attach("top", "top", "back", rectEdges(back).bottom, lidD, { kind: "rect" }, { stage: 2, label: "Lid" });
    const lid = rect(0, Wp + Hp, Lp, lidD);
    if (o.lid === "skirt") {
      b.attach("skirt", "front", "top", rectEdges(lid).bottom, Hp - 2 * t, { kind: "rect" }, { stage: 3, label: "Lid front skirt" });
    } else {
      const inset = sideLayers * t + (websOnEnds ? 2 * t : 0) + 1;
      b.attach("tuck", "tuck", "top", insetSeg(rectEdges(lid).bottom, inset), clamp(dims.H * 0.6, 15, 45), { kind: "tuck", shoulder: 2 }, { stage: 3, stack: -longLayers, label: "Lid tuck" });
    }
    if (o.lid === "tuckDust" || o.lid === "skirt") {
      const d = clamp(dims.H * 0.5, 10, 40);
      const inset = longLayers * t + 1;
      for (const [k, edge] of [["L", rectEdges(lid).left], ["R", rectEdges(lid).right]] as const) {
        b.attach(`lidDust${k}`, "dust", "top", insetSeg(edge, inset), d, { kind: "trapezoid", taperA: 2, taperB: d * 0.6 }, { stage: 3, stack: -(sideLayers + (websOnEnds ? 2 : 0)), label: "Lid side flap (v)" });
      }
    }
    if (o.lidHoles) {
      const cols = clamp(Math.floor(dims.L / 55), 2, 6);
      const rows = clamp(Math.floor(dims.W / 55), 2, 5);
      const d = Math.min((dims.L * 0.8) / cols, (dims.W * 0.8) / rows) * 0.7;
      const holes: Polygon[] = [];
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) holes.push(circle(Lp * (0.1 + (0.8 * (i + 0.5)) / cols), lid.y + lidD * (0.1 + (0.8 * (j + 0.5)) / rows), d));
      b.byId("top").holes = holes;
    }
  }
  return { builder: b, closedRotation: TILT };
}
