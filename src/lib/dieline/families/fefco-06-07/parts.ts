import { Box3, Euler, Matrix4, Quaternion, Vector3 } from "three";
import { DielineBuilder, insetSeg, rectEdges } from "@/lib/dieline/builder";
import { boundsAt } from "@/lib/dieline/fold";
import { roundedRect, stadium } from "@/lib/dieline/features";
import { bboxOf, clamp, pt, rectPolygon } from "@/lib/dieline/geometry";
import type { PanelRole, Polygon, Pt, Rect } from "@/lib/dieline/types";

/**
 * Building blocks shared by the FEFCO 06 / 07 generators. Same conventions as the core
 * generators (src/lib/dieline/structures.ts): mm, sheet y down, printed side up, inner dims,
 * panel sizes compensated by board layers so the closed model's inner space equals the
 * requested inner size.
 */

export type Quat = [number, number, number, number];
export const IDENTITY: Quat = [0, 0, 0, 1];

export function quat(x: number, y: number, z: number): Quat {
  const q = new Quaternion().setFromEuler(new Euler(x, y, z, "YXZ"));
  return [q.x, q.y, q.z, q.w];
}

/**
 * Base-rooted layouts (trays, bliss bodies): the base panel tips +90° about X so its printed
 * side faces down; the wall laid ABOVE the base on the sheet becomes the FRONT, the one on
 * the sheet's left the LEFT side.
 */
export const TILT: Quat = quat(Math.PI / 2, 0, 0);

export const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

/** Closed bounds (model mm) of a parent-closed subset of panels of the main tree. */
export function closedBounds(b: DielineBuilder, ids: Iterable<string>, t: number, rot: Quat, rootId = b.rootId): Box3 {
  const set = new Set(ids);
  return boundsAt({ panels: b.panels.filter((p) => set.has(p.id)), rootId, thicknessMm: t, closedRotation: rot }, 1);
}

export const maxStageOf = (b: DielineBuilder) => b.panels.reduce((m, p) => Math.max(m, p.foldStage, p.assembly?.stage ?? 0), 0);
export const sheetBox = (b: DielineBuilder) => bboxOf(b.panels.flatMap((p) => p.polygon));

/**
 * Add a separate blank whose root panel `polygon` (sheet mm) is placed, closed, with its flat
 * centre at `target` (model mm) after `rotation` (applied about the flat centre). In the flat
 * frame the printed side faces +Z and the board extends to -Z.
 */
export function placedPiece(
  b: DielineBuilder,
  id: string,
  role: PanelRole,
  polygon: Polygon,
  pieceLabel: string,
  target: Vector3,
  rotation: Matrix4,
  stage: number,
  lift = 0,
) {
  const box = bboxOf(polygon);
  const c = new Vector3(box.x + box.width / 2, -(box.y + box.height / 2), 0);
  const m = new Matrix4().makeTranslation(target.x, target.y, target.z).multiply(rotation).multiply(new Matrix4().makeTranslation(-c.x, -c.y, 0));
  return b.piece(id, role, polygon, pieceLabel, { matrix: m.toArray(), stage, lift }, { label: pieceLabel });
}

export const circle = (cx: number, cy: number, d: number): Polygon => roundedRect(cx, cy, d, d, d / 2, 6);

/** Hand hole (stadium) centred on a panel, `fromEdge` mm from the edge nearest `edgePt`. */
export function handHole(b: DielineBuilder, id: string, w: number, h: number, at: Pt) {
  const p = b.byId(id);
  p.holes = [...(p.holes ?? []), stadium(at.x, at.y, w, h)];
}

/* ───────────────────────── Tube cases (group 07, bliss 0615/0616 sleeves) ───────────────────────── */

export type Walls = { front: Rect; back: Rect; left: Rect; right: Rect };

/**
 * Four-panel tube, laid out left → right: manufacturer's joint | left (W) | front (L) |
 * right (W) | back (L). Root = front, standing upright (identity closed rotation). The joint
 * is glued inside the far edge of the back panel. Returns the wall rects.
 */
export function caseTube(
  b: DielineBuilder,
  Lp: number,
  Wp: number,
  Hp: number,
  o: { prefix?: string; origin?: Pt; joint?: number; piece?: { label: string; assembly: { matrix: number[]; stage: number; lift?: number } } } = {},
): Walls {
  const id = (s: string) => (o.prefix ?? "") + s;
  const j = o.joint ?? clamp(Hp * 0.25, 25, 35);
  const ox = o.origin?.x ?? 0;
  const oy = o.origin?.y ?? 0;
  const xL = ox + j;
  const w: Walls = {
    left: rect(xL, oy, Wp, Hp),
    front: rect(xL + Wp, oy, Lp, Hp),
    right: rect(xL + Wp + Lp, oy, Wp, Hp),
    back: rect(xL + 2 * Wp + Lp, oy, Lp, Hp),
  };
  const poly = rectPolygon(w.front.x, w.front.y, Lp, Hp);
  if (o.piece) b.piece(id("front"), "front", poly, o.piece.label, o.piece.assembly, { label: "Front" });
  else b.root(id("front"), "front", poly, "Front");
  b.attach(id("left"), "left", id("front"), rectEdges(w.front).left, Wp, { kind: "rect" }, { stage: 0, label: "Left side" });
  b.attach(id("right"), "right", id("front"), rectEdges(w.front).right, Wp, { kind: "rect" }, { stage: 0, label: "Right side" });
  b.attach(id("back"), "back", id("right"), rectEdges(w.right).right, Lp, { kind: "rect" }, { stage: 0, label: "Back" });
  b.attach(id("joint"), "glue", id("left"), rectEdges(w.left).left, j, { kind: "trapezoid", taperA: j * 0.3, taperB: j * 0.3 }, {
    stage: 0,
    stack: -1,
    label: "Manufacturer's joint",
  });
  return w;
}

/**
 * Crash-lock (auto-erect) bottom of FEFCO 07 cases (0711 family). Every bottom flap carries a
 * 45° crease from its leading hinge corner; the glue-assist triangles of the side (W) flaps are
 * glued to the L flaps on the folder-gluer, so opening the flat case drags the bottom into
 * place. The L flaps reach past the centre line and interlock with a tongue.
 *
 * Fold stages: 1 = side flaps, 2 = back L flap, 2 = front L flap (outermost) — the order the
 * bottom closes in when the case is squared up.
 *
 * `full`: 0701 / 0703 style — the back L flap is a full-width panel (W) covering the bottom,
 * the front flap tucks to its centre.
 */
export function crashLockBottom(b: DielineBuilder, w: Walls, t: number, o: { prefix?: string; full?: boolean } = {}) {
  const id = (s: string) => (o.prefix ?? "") + s;
  const Wp = w.left.width;
  const h = Wp / 2;
  const tongue = Math.min(15, Wp * 0.15);
  const long = (side: "front" | "back", stack: number, fullDepth: boolean) => {
    const f = b.frame(id(side), rectEdges(w[side]).bottom);
    const L = f.length;
    const ch = Math.min(h - t, L * 0.3);
    let poly: Polygon;
    if (fullDepth) {
      const tab = Math.min(L * 0.12, 30);
      const d = Wp - 2 * t - tongue * 0.6;
      poly = [f.at(f.a, 0, 0), f.at(f.a, L, 0), f.at(f.a, L, d - ch * 0.4), f.at(f.a, L - ch * 0.4, d), f.at(f.a, L / 2 + tab, d), f.at(f.a, L / 2 + tab * 0.7, d + tongue * 0.6), f.at(f.a, L / 2 - tab * 0.7, d + tongue * 0.6), f.at(f.a, L / 2 - tab, d), f.at(f.a, ch * 0.4, d), f.at(f.a, 0, d - ch * 0.4)];
    } else {
      const x1 = L * 0.28;
      const x2 = L * 0.62;
      poly = [f.at(f.a, 0, 0), f.at(f.a, L, 0), f.at(f.a, L, h - ch), f.at(f.a, L - ch, h), f.at(f.a, x2, h), f.at(f.a, x2 - tongue * 0.6, h + tongue), f.at(f.a, x1 + tongue * 0.6, h + tongue), f.at(f.a, x1, h), f.at(f.a, 0, h)];
    }
    b.attachPoly(id(`bottom_${side}`), side === "front" ? "bottom" : "flap", id(side), [f.a, f.b], poly, { stage: 2, stack, label: fullDepth ? "Auto-bottom full flap" : "Auto-bottom lock flap" });
    const k = Math.min(h, L * 0.45);
    b.extraCreases.push({ a: f.at(f.a, 0, 0), b: f.at(f.a, k, k) });
  };
  long("front", 0, false);
  long("back", -1, !!o.full);
  for (const side of ["left", "right"] as const) {
    const f = b.frame(id(side), rectEdges(w[side]).bottom);
    const d = Math.min(h - t, f.length * 0.48, w.front.width / 2 - t);
    const poly: Polygon = [f.at(f.a, 0, 0), f.at(f.a, f.length, 0), f.at(f.a, f.length - d * 0.3, d), f.at(f.a, d * 0.3, d)];
    b.attachPoly(id(`bottom_${side}`), "flap", id(side), [f.a, f.b], poly, { stage: 1, stack: -2, label: "Auto-bottom glue-assist flap" });
    b.extraCreases.push({ a: f.at(f.a, 0, 0), b: f.at(f.a, d, d) });
  }
}

/** Board layers the crash-lock bottom stacks (outer → inner): front flap, back flap, side flaps. */
export const CRASH_LAYERS = 3;

export type CaseTop = "open" | "rsc" | "fol" | "halfHalf" | "tuckLid" | "handle";

/** Board layers a top closure adds at the top of the case. */
export const TOP_LAYERS: Record<CaseTop, number> = { open: 0, rsc: 2, fol: 3, halfHalf: 2, tuckLid: 2, handle: 1 };

/** Handle height above the rim for the "handle" top (mm). */
export const handleHeight = (Wp: number) => clamp(Wp * 0.5, 40, 80);

/**
 * Top closures of the 07 cases, stages 3 (inner flaps) and 4 (outer flaps / lid).
 * - rsc: four flaps W/2 (FEFCO 0711),
 * - fol: long flaps W deep, fully overlapping (0703),
 * - halfHalf: long flaps W/2 and end flaps L/2, all meeting at the centre (0712),
 * - tuckLid: lid on the back + tuck, dust flaps on the ends (0713),
 * - handle: long-wall flaps rise into a double-thickness handle with hand holes (0717).
 */
export function caseTop(b: DielineBuilder, w: Walls, t: number, kind: CaseTop, prefix = "") {
  const id = (s: string) => prefix + s;
  const Lp = w.front.width;
  const Wp = w.left.width;
  const slot = clamp(2 * t + 2, 4, 8);
  const flap = (wall: keyof Walls, depth: number, stage: number, stack: number, label: string) =>
    b.attach(id(`top_${wall}`), "flap", id(wall), insetSeg(rectEdges(w[wall]).top, slot / 2), depth, { kind: "rect" }, { stage, stack, label });
  switch (kind) {
    case "open":
      return;
    case "rsc":
      flap("left", Math.min(Wp / 2, Lp / 2 - t), 3, -1, "Minor flap");
      flap("right", Math.min(Wp / 2, Lp / 2 - t), 3, -1, "Minor flap");
      flap("front", Wp / 2, 4, 0, "Major flap");
      flap("back", Wp / 2, 4, 0, "Major flap");
      return;
    case "fol":
      flap("left", Math.min(Wp / 2, Lp / 2 - t), 3, -2, "Minor flap");
      flap("right", Math.min(Wp / 2, Lp / 2 - t), 3, -2, "Minor flap");
      flap("back", Wp - t, 3, -1, "Full-overlap flap");
      flap("front", Wp - t, 4, 0, "Full-overlap flap");
      return;
    case "halfHalf":
      flap("front", Wp / 2, 3, -1, "Long flap");
      flap("back", Wp / 2, 3, -1, "Long flap");
      flap("left", Lp / 2 - 0.5, 4, 0, "End flap");
      flap("right", Lp / 2 - 0.5, 4, 0, "End flap");
      return;
    case "tuckLid": {
      for (const side of ["left", "right"] as const) {
        const d = Math.min(Wp * 0.7, Lp * 0.4);
        b.attach(id(`top_dust_${side}`), "dust", id(side), rectEdges(w[side]).top, d, { kind: "trapezoid", taperA: d * 0.3, taperB: d * 0.5 }, { stage: 3, stack: -1, label: "Dust flap" });
      }
      b.attach(id("top"), "top", id("back"), rectEdges(w.back).top, Wp, { kind: "rect" }, { stage: 4, label: "Lid" });
      const lid = rect(w.back.x, w.back.y - Wp, Lp, Wp);
      const tuckD = clamp(w.front.height * 0.3, 20, 50);
      b.attach(id("top_tuck"), "tuck", id("top"), insetSeg(rectEdges(lid).top, t + 1), tuckD, { kind: "tuck", shoulder: 2 }, { stage: 4, stack: -1, label: "Tuck flap" });
      return;
    }
    case "handle": {
      const hh = handleHeight(Wp);
      for (const side of ["front", "back"] as const) {
        const r = w[side];
        const d = Wp / 2 - t;
        b.attach(id(`top_${side}`), "flap", id(side), rectEdges(r).top, d, { kind: "rect" }, { stage: 3, label: "Handle base flap" });
        const fr = rect(r.x, r.y - d, Lp, d);
        const hid = id(`handle_${side}`);
        b.attach(hid, "flap", id(`top_${side}`), rectEdges(fr).top, hh, { kind: "rect" }, {
          fold: -90,
          stage: 3,
          label: "Carry handle",
          holes: [stadium(r.x + Lp / 2, fr.y - hh * 0.5, Math.min(100, Lp * 0.55), Math.min(28, hh * 0.4))],
        });
      }
      return;
    }
  }
}

/* ───────────────────────── Web (gusset) corners for ready-glued trays ───────────────────────── */

/**
 * Web corner between two tray walls: the corner square split by its diagonal. Triangle A is
 * hinged on `parentId`'s corner edge [p0 (base corner) → p1 (rim corner)], triangle B on A's
 * diagonal. Closed, A swings 90° against the adjacent wall (mesh pushed one board inward) and
 * B folds 180° onto A's inner side: a double
 * triangle lying against the adjacent wall's inner face (glued in the flat on the
 * folder-gluer, so the tray erects in one move). B's edge on the adjacent wall is a crease.
 */
export function webCorner(b: DielineBuilder, parentId: string, edge: [Pt, Pt], depth: number, key: string) {
  const f = b.frame(parentId, edge);
  const [p0, p1] = edge;
  const q1 = f.at(p1, 0, depth);
  const q0 = f.at(p0, 0, depth);
  b.attachPoly(`web_${key}_a`, "ear", parentId, [p0, p1], [p0, p1, q1], { fold: 90, pivotDepth: 0, stack: -1, stage: 0, printable: false, label: "Web corner" });
  b.attachPoly(`web_${key}_b`, "ear", `web_${key}_a`, [p0, q1], [p0, q1, q0], { fold: 180, pivotDepth: 1.5, stage: 0, printable: false, label: "Web corner" });
  b.extraCreases.push({ a: p0, b: q0 });
}

/* ───────────────────────── Partitions (separate slotted strips) ───────────────────────── */

/**
 * Slotted divider strips assembled into a rows × cols grid inside the closed main tree.
 * Strips along L are slotted from the top, strips along W from the bottom.
 */
export function partitions(b: DielineBuilder, t: number, rot: Quat, dims: { L: number; W: number; H: number }, grid: { rows: number; cols: number }, floor: number) {
  const box = closedBounds(b, b.subtree(b.rootId), t, rot);
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const y0 = box.min.y + floor;
  const h = Math.max(10, dims.H - Math.max(3, 2 * t));
  const lenL = dims.L - 2;
  const lenW = dims.W - 2;
  const slotW = t + 0.6;
  const xs = Array.from({ length: grid.cols - 1 }, (_, i) => cx - dims.L / 2 + ((i + 1) * dims.L) / grid.cols);
  const zs = Array.from({ length: grid.rows - 1 }, (_, i) => cz - dims.W / 2 + ((i + 1) * dims.W) / grid.rows);
  const stage = maxStageOf(b) + 1;
  const sb = sheetBox(b);
  let sx = sb.x;
  const sy = sb.y + sb.height + 15;
  const strip = (len: number, slots: number[], fromTop: boolean): Polygon => {
    const s = [...slots].sort((a, c) => a - c);
    const out: Pt[] = [pt(sx, sy)];
    if (fromTop) {
      for (const u of s) out.push(pt(sx + u - slotW / 2, sy), pt(sx + u - slotW / 2, sy + h / 2), pt(sx + u + slotW / 2, sy + h / 2), pt(sx + u + slotW / 2, sy));
      out.push(pt(sx + len, sy), pt(sx + len, sy + h), pt(sx, sy + h));
      return out;
    }
    out.push(pt(sx + len, sy), pt(sx + len, sy + h));
    for (const u of s.reverse()) out.push(pt(sx + u + slotW / 2, sy + h), pt(sx + u + slotW / 2, sy + h / 2), pt(sx + u - slotW / 2, sy + h / 2), pt(sx + u - slotW / 2, sy + h));
    out.push(pt(sx, sy + h));
    return out;
  };
  const place = (id: string, poly: Polygon, len: number, target: Vector3, alongZ: boolean) => {
    const rotM = alongZ ? new Matrix4().makeRotationY(Math.PI / 2) : new Matrix4();
    placedPiece(b, id, "inner", poly, "Divider", target, rotM, stage, dims.H * 1.3).printable = false;
    sx += len + 10;
  };
  zs.forEach((z, i) => {
    const poly = strip(lenL, xs.map((x) => x - (cx - lenL / 2)), true);
    place(`divL${i}`, poly, lenL, new Vector3(cx, y0 + h / 2 + 0.5, z + t / 2), false);
  });
  xs.forEach((x, i) => {
    const poly = strip(lenW, zs.map((z) => lenW / 2 - (z - cz)), false);
    place(`divW${i}`, poly, lenW, new Vector3(x + t / 2, y0 + h / 2 + 0.5, cz), true);
  });
}
