import { Vec3 as Vector3 } from "@/lib/dieline/math";
import type { Dims, FaceId, StructureFeatures } from "@/types";
import { DielineBuilder, insetSeg, rectEdges } from "../../builder";
import { cutWindow, notchPanel, stadium } from "../../features";
import { clamp, pt, rectPolygon } from "../../geometry";
import type { DielineAccessory, DielinePanel, FaceInfo, Polygon, Pt, Rect } from "../../types";
import { WRAP_VISUAL_MM, mainClosedBounds, poseMatrix, quat, rect, sheetBottom, tabStack, turnInStack } from "./common";

export { WRAP_VISUAL_MM, tabStack, turnInStack };
import type { ConstructionSpec, FamilyDraft } from "./types";

/**
 * Rigid set-up boxes: greyboard trays and boards wrapped in printed paper.
 *
 * The dieline is the WRAP sheet (what is printed), one panel per greyboard face, so the 3D
 * fold shows the real board thickness `t` (greyboard + paper). Crease-to-crease sizes follow
 * the engine's thickness compensation: tray base = inner + 2t, walls = H + t (they cover the
 * floor edge), so the folded inner space equals the requested inner size.
 * Wrap turn-ins roll 180° over every rim to the inside (8–15 mm); corner tabs on the long walls
 * wrap round the corners under the end walls. There is no FEFCO/ECMA code for rigid boxes:
 * vendors work from the inner size and the board caliper.
 */

/** Paper caliper included in t (157 gsm art paper + glue). */
export const WRAP_PAPER_MM = 0.15;
/** Clearance per side between a lid / sleeve and what it slides over (mm). */
export const RIGID_CLEARANCE_MM = 0.5;

/** Wall ends stop this short of a corner (keeps coincident end faces from z-fighting). */
export const CORNER_GAP_MM = 0.1;

export const turnInFor = (H: number) => clamp(H * 0.45, 8, 15);
const tabDepth = (W: number) => clamp(W * 0.08, 6, 12);
const closedBase = quat(Math.PI / 2, 0, 0);

type WallName = "front" | "back" | "left" | "right";

interface TrayLayout {
  base: Rect;
  Lp: number;
  Wp: number;
  Hp: number;
  walls: Record<WallName, { id: string; r: Rect; edge: [Pt, Pt]; far: [Pt, Pt] }>;
  rootId: string;
  build(root: (id: string, poly: Polygon) => void): void;
}

/**
 * Wrapped greyboard tray (open top). `mode: "base"` lies printed side down (bottom outside)
 * and the wall above it on the sheet becomes the FRONT; `mode: "lid"` is turned the other way
 * up, so the wall above becomes the BACK.
 */
export function wrapTray(
  b: DielineBuilder,
  t: number,
  o: { pre: string; L: number; W: number; H: number; origin: Pt; mode: "base" | "lid"; tabs?: boolean; turnIn?: number },
): TrayLayout {
  const Lp = o.L + 2 * t;
  const Wp = o.W + 2 * t;
  const Hp = o.H + t;
  const base = rect(o.origin.x, o.origin.y, Lp, Wp);
  const id = (s: string) => o.pre + s;
  const upper: WallName = o.mode === "lid" ? "back" : "front";
  const lower: WallName = o.mode === "lid" ? "front" : "back";
  const E = rectEdges(base);
  const mk = (name: WallName, r: Rect, edge: [Pt, Pt], far: [Pt, Pt]) => ({ id: id(name), r, edge, far });
  // Walls stop CORNER_GAP_MM short of each corner: a full-length wall's end face would lie
  // in the neighbouring wall's printed face and flicker (z-fight) down every corner.
  const g = CORNER_GAP_MM;
  const ru = rect(base.x + g, base.y - Hp, Lp - 2 * g, Hp);
  const rl = rect(base.x + g, base.y + Wp, Lp - 2 * g, Hp);
  const rL = rect(base.x - Hp, base.y + g, Hp, Wp - 2 * g);
  const rR = rect(base.x + Lp, base.y + g, Hp, Wp - 2 * g);
  const walls = {
    [upper]: mk(upper, ru, insetSeg(E.top, g), rectEdges(ru).top),
    [lower]: mk(lower, rl, insetSeg(E.bottom, g), rectEdges(rl).bottom),
    left: mk("left", rL, insetSeg(E.left, g), rectEdges(rL).left),
    right: mk("right", rR, insetSeg(E.right, g), rectEdges(rR).right),
  } as TrayLayout["walls"];
  const rootId = id(o.mode === "lid" ? "top" : "bottom");
  const ti = o.turnIn ?? turnInFor(o.H);
  return {
    base,
    Lp,
    Wp,
    Hp,
    walls,
    rootId,
    build(root) {
      root(rootId, rectPolygon(base.x, base.y, Lp, Wp));
      for (const name of ["front", "back", "left", "right"] as const) {
        const w = walls[name];
        b.attach(w.id, name, rootId, w.edge, Hp, { kind: "rect" }, { stage: 0, label: `${name[0].toUpperCase()}${name.slice(1)} wall` });
        b.attach(`${w.id}Turn`, "inner", w.id, insetSeg(w.far, t + 0.3), ti, { kind: "trapezoid", taperA: 1, taperB: 1 }, { fold: 180, pivotDepth: 1, stage: 1, stack: turnInStack(t), label: "Turn-in" });
      }
      if (o.tabs !== false) {
        for (const name of ["front", "back"] as const) {
          const e = rectEdges(walls[name].r);
          const d = tabDepth(o.W);
          for (const [k, edge] of [["L", e.left], ["R", e.right]] as const) {
            b.attach(id(`${name}Tab${k}`), "ear", walls[name].id, insetSeg(edge, 1, 1), d, { kind: "trapezoid", taperA: d * 0.5, taperB: d * 0.5 }, { stage: 0, stack: tabStack(t), label: "Corner tab" });
          }
        }
      }
    },
  };
}

/** The outline edge of `p` lying on the line through `edge`. */
function nearEdgeTo(p: DielinePanel, edge: [Pt, Pt]): [Pt, Pt] | null {
  const n = p.polygon.length;
  const d = { x: edge[1].x - edge[0].x, y: edge[1].y - edge[0].y };
  const l = Math.hypot(d.x, d.y);
  for (let i = 0; i < n; i++) {
    const a = p.polygon[i];
    const c = p.polygon[(i + 1) % n];
    const off = (q: Pt) => Math.abs(d.x * (q.y - edge[0].y) - d.y * (q.x - edge[0].x)) / l;
    if (off(a) < 1e-3 && off(c) < 1e-3) return [a, c];
  }
  return null;
}

/** Finger notches through two walls of a tray and their turn-ins. */
function notchWalls(b: DielineBuilder, tray: TrayLayout, names: WallName[], r: number) {
  for (const name of names) {
    const w = b.byId(tray.walls[name].id);
    notchPanel(w, tray.walls[name].far, r);
    const ti = b.byId(`${tray.walls[name].id}Turn`);
    const near = nearEdgeTo(ti, tray.walls[name].far);
    if (near) notchPanel(ti, near, r);
  }
}

/** Keep only the face parts whose panel passes `keep` (hidden under a cover or sleeve). */
function filterFaces(computed: Partial<Record<FaceId, FaceInfo>>, keep: (face: FaceId, panelId: string) => boolean) {
  const out: Partial<Record<FaceId, FaceInfo>> = {};
  for (const [face, info] of Object.entries(computed) as [FaceId, FaceInfo][]) {
    const parts = info.parts.filter((p) => keep(face, p.panelId));
    if (parts.length) out[face] = { ...info, parts };
  }
  return out;
}

const turnInGap = (H: number) => turnInFor(H) + 15;

/* ───────────── Lid and base (lid-off), optional window ───────────── */

/**
 * Two-piece lid-off box. Lid inner = base outer + clearance; default lid depth 40 % of H
 * (`lidHeightMm` up to H for a full-telescope lid). Window: die-cut aperture in the lid top
 * with clear film glued inside.
 */
export function lidAndBase(dims: Dims, t: number, f: StructureFeatures = {}, o: { lidRatio?: number } = {}): FamilyDraft {
  const c = RIGID_CLEARANCE_MM;
  const b = new DielineBuilder();
  const base = wrapTray(b, t, { pre: "", L: dims.L, W: dims.W, H: dims.H, origin: pt(0, 0), mode: "base" });
  base.build((id, poly) => b.root(id, "bottom", poly, "Base"));
  b.pieceLabels.set("bottom", "Base");
  const box = mainClosedBounds(b, t, closedBase);

  const lidH = clamp(f.lidHeightMm ?? Math.round(dims.H * (o.lidRatio ?? 0.4)), Math.min(15, dims.H), dims.H);
  // Lid inner = base outer + clearance + the lid's own turn-in paper on each side.
  const lidL = dims.L + 2 * t + 2 * (c + WRAP_VISUAL_MM);
  const lidW = dims.W + 2 * t + 2 * (c + WRAP_VISUAL_MM);
  const y0 = sheetBottom(b) + lidH + t + turnInGap(lidH);
  const lid = wrapTray(b, t, { pre: "lid_", L: lidL, W: lidW, H: lidH, origin: pt(0, y0), mode: "lid" });
  const target = new Vector3((box.min.x + box.max.x) / 2, box.max.y + t, (box.min.z + box.max.z) / 2);
  const matrix = poseMatrix(lid.base, target, -Math.PI / 2);
  lid.build((id, poly) => b.piece(id, "top", poly, "Lid", { matrix, stage: 3, lift: dims.H * 1.2 }, { label: "Lid" }));

  if (f.window) cutWindow(b, "lid_top", { ...f.window, face: "top", film: f.window.film ?? true }, { margin: 15 });
  if (f.thumbNotch) notchWalls(b, base, ["front", "back"], Math.min(14, dims.L * 0.08, dims.H * 0.35));
  return { builder: b, closedRotation: closedBase, faceDepthTol: c + t + 0.5 };
}

/* ───────────── Shoulder (neck) box ───────────── */

/**
 * Three pieces: base tray, a wrapped neck sleeve glued inside the base and standing proud of
 * it, and a lid that slips over the neck and rests on the base rim (the "shoulder"), flush
 * with the base outside. Inner size = inside the neck; `lidHeightMm` = exposed neck height.
 */
export function shoulderBox(dims: Dims, t: number, f: StructureFeatures = {}): FamilyDraft {
  const c = RIGID_CLEARANCE_MM;
  const e = clamp(f.lidHeightMm ?? clamp(Math.round(dims.H * 0.3), 15, 50), 10, Math.max(10, dims.H * 0.7));
  const Ln = dims.L + 2 * t;
  const Wn = dims.W + 2 * t;
  const Hb = dims.H - e;
  const p = WRAP_VISUAL_MM;
  const b = new DielineBuilder();
  // The neck is glued inside the base over the base turn-ins: base inner = neck outer + paper.
  const base = wrapTray(b, t, { pre: "", L: Ln + 2 * p, W: Wn + 2 * p, H: Hb, origin: pt(0, 0), mode: "base" });
  base.build((id, poly) => b.root(id, "bottom", poly, "Base"));
  b.pieceLabels.set("bottom", "Base");
  const box = mainClosedBounds(b, t, closedBase);
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;

  // Neck sleeve: front | right | back | left | glue, with turn-ins over the top rim.
  const Hn = dims.H;
  const ti = turnInFor(Hn);
  const yN = sheetBottom(b) + 15 + ti;
  const fr = rect(0, yN, Ln, Hn);
  const delta = new Vector3(cx - (fr.x + fr.width / 2), box.min.y + t + (fr.y + fr.height), box.max.z - t - p);
  const nm = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, delta.x, delta.y, delta.z, 1];
  b.piece("neck_front", "inner", rectPolygon(fr.x, fr.y, fr.width, fr.height), "Neck", { matrix: nm, stage: 2, lift: dims.H * 0.8 }, { label: "Neck front" });
  const widths = [Ln, Wn, Ln, Wn];
  const names = ["neck_front", "neck_right", "neck_back", "neck_left"];
  let x = fr.x;
  for (let i = 0; i < 4; i++) {
    const r = rect(x, yN, widths[i], Hn);
    if (i > 0) b.attach(names[i], "inner", names[i - 1], rectEdges(rect(x - widths[i - 1], yN, widths[i - 1], Hn)).right, widths[i], { kind: "rect" }, { stage: 0, label: "Neck wall" });
    b.attach(`${names[i]}Turn`, "inner", names[i], insetSeg(rectEdges(r).top, t + 0.3), ti, { kind: "trapezoid", taperA: 1, taperB: 1 }, { fold: 180, pivotDepth: 1, stage: 1, stack: turnInStack(t), label: "Turn-in" });
    x += widths[i];
  }
  b.attach("neck_glue", "glue", "neck_left", rectEdges(rect(x - Wn, yN, Wn, Hn)).right, Math.min(15, Ln * 0.3), { kind: "trapezoid", taperA: 3, taperB: 3 }, { stage: 0, stack: tabStack(t), label: "Glue flap" });

  // Lid over the neck (clearance + its own turn-in paper), resting on the base rim.
  const lidL = Ln + 2 * (c + p);
  const lidW = Wn + 2 * (c + p);
  const y0 = sheetBottom(b) + e + t + turnInGap(e);
  const lid = wrapTray(b, t, { pre: "lid_", L: lidL, W: lidW, H: e, origin: pt(0, y0), mode: "lid" });
  const target = new Vector3(cx, box.min.y + 2 * t + dims.H, cz);
  const matrix = poseMatrix(lid.base, target, -Math.PI / 2);
  lid.build((id, poly) => b.piece(id, "top", poly, "Lid", { matrix, stage: 4, lift: dims.H * 1.2 }, { label: "Lid" }));
  if (f.window) cutWindow(b, "lid_top", { ...f.window, face: "top", film: f.window.film ?? true }, { margin: 15 });
  return { builder: b, closedRotation: closedBase, faceDepthTol: c + t * 0.5 };
}

/* ───────────── Book style with magnetic flap ───────────── */

/**
 * Base tray plus a one-piece wrapped cover: bottom board (glued under the tray) → spine →
 * lid board → front flap that closes over the front wall on hidden magnets. Cover boards
 * overhang the tray 2 mm at the ends; the flap closes flat on the front wall.
 */
export function bookBox(dims: Dims, t: number, f: StructureFeatures = {}): FamilyDraft {
  void f;
  const o = 2;
  const clr = RIGID_CLEARANCE_MM;
  const b = new DielineBuilder();
  const base = wrapTray(b, t, { pre: "", L: dims.L, W: dims.W, H: dims.H, origin: pt(0, 0), mode: "base" });
  base.build((id, poly) => b.root(id, "bottom", poly, "Tray"));
  b.pieceLabels.set("bottom", "Tray");
  const box = mainClosedBounds(b, t, closedBase);
  const Lt = box.max.x - box.min.x;
  const Wt = box.max.z - box.min.z;
  const Ht = box.max.y - box.min.y;

  // The cover's turn-ins lie between its boards and the tray: keep one paper (p) of room
  // under the bottom board, behind the spine and under the lid board.
  const p = WRAP_VISUAL_MM;
  const Lc = Lt + 2 * o;
  const Wc = Wt + 2 * t + clr + p;
  const spine = Ht + 2 * t + 2 * p;
  const flapH = Ht + t + 2 * p - 0.5;
  const ti = 15;
  const yc = sheetBottom(b) + 15 + ti;
  const rows: { id: string; role: "bottom" | "back" | "top" | "front"; h: number; label: string }[] = [
    { id: "cover_bottom", role: "bottom", h: Wc, label: "Cover bottom" },
    { id: "cover_spine", role: "back", h: spine, label: "Spine" },
    { id: "cover_lid", role: "top", h: Wc, label: "Lid board" },
    { id: "cover_flap", role: "front", h: flapH, label: "Magnetic flap" },
  ];
  const target = new Vector3((box.min.x + box.max.x) / 2, box.min.y - t - p, (box.min.z - t - p + box.max.z + t + clr) / 2);
  let y = yc;
  rows.forEach((row, i) => {
    const r = rect(0, y, Lc, row.h);
    if (i === 0) b.piece(row.id, row.role, rectPolygon(r.x, r.y, r.width, r.height), "Cover", { matrix: poseMatrix(r, target, Math.PI / 2), stage: 2, lift: dims.H * 1.5 }, { label: row.label });
    else b.attach(row.id, row.role, rows[i - 1].id, rectEdges(rect(0, y - rows[i - 1].h, Lc, rows[i - 1].h)).bottom, row.h, { kind: "rect" }, { stage: 2 + i, label: row.label });
    const E = rectEdges(r);
    for (const [k, edge] of [["L", E.left], ["R", E.right]] as const) {
      b.attach(`${row.id}Turn${k}`, "inner", row.id, insetSeg(edge, t + 0.3), ti, { kind: "trapezoid", taperA: 1, taperB: 1 }, { fold: 180, pivotDepth: 1, stage: 1, stack: turnInStack(t), label: "Turn-in" });
    }
    // End turn-ins overlap the side ones at the corners (mitred in real life): half a paper lower.
    const endStack = turnInStack(t) - WRAP_VISUAL_MM / 2 / t;
    if (i === 0) b.attach(`${row.id}TurnF`, "inner", row.id, insetSeg(E.top, t + 0.3), ti, { kind: "trapezoid", taperA: 1, taperB: 1 }, { fold: 180, pivotDepth: 1, stage: 1, stack: endStack, label: "Turn-in" });
    if (i === rows.length - 1) b.attach(`${row.id}TurnF`, "inner", row.id, insetSeg(E.bottom, t + 0.3), ti, { kind: "trapezoid", taperA: 1, taperB: 1 }, { fold: 180, pivotDepth: 1, stage: 1, stack: endStack, label: "Turn-in" });
    y += row.h;
  });
  const coverOnly: FaceId[] = ["front", "back", "top", "bottom"];
  return {
    builder: b,
    closedRotation: closedBase,
    faceDepthTol: o + 0.5,
    faces: (_panels, computed) => filterFaces(computed, (face, id) => !coverOnly.includes(face) || id.startsWith("cover_")),
  };
}

/* ───────────── Drawer (match box) with ribbon pull ───────────── */

/**
 * Wrapped tray sliding in a wrapped sleeve open at the front and back. A ribbon pull passes
 * through a slot in the drawer front (glued under the floor). Sleeve inner = drawer outer +
 * 0.75 mm per side.
 */
export function drawerBox(dims: Dims, t: number, f: StructureFeatures = {}): FamilyDraft {
  const c = 0.75;
  const b = new DielineBuilder();
  const tray = wrapTray(b, t, { pre: "", L: dims.L, W: dims.W, H: dims.H, origin: pt(0, 0), mode: "base" });
  tray.build((id, poly) => b.root(id, "bottom", poly, "Drawer"));
  b.pieceLabels.set("bottom", "Drawer");
  const ti = turnInFor(dims.H);
  // Ribbon slot (10 mm ribbon) in the front wall, below the turn-in.
  const fw = b.byId("front");
  const fromRim = Math.max(ti + 4, tray.Hp * 0.5);
  if (f.thumbNotch) notchWalls(b, tray, ["front"], Math.min(14, dims.L * 0.08, dims.H * 0.35));
  else if (fromRim + 4 < tray.Hp - t) fw.holes = [stadium(fw.bbox.x + fw.bbox.width / 2, fw.bbox.y + fromRim, 13, 3)];
  const box = mainClosedBounds(b, t, closedBase);
  const Lt = box.max.x - box.min.x;
  const Wt = box.max.z - box.min.z;
  const Ht = box.max.y - box.min.y;
  const Ls = Lt + 2 * c + 2 * t;
  const Hs = Ht + 2 * c + 2 * t;
  const tiS = 12;
  const ys = sheetBottom(b) + 15 + tiS;
  const cols: { id: string; role: "top" | "right" | "bottom" | "left"; w: number }[] = [
    { id: "sleeve_top", role: "top", w: Ls },
    { id: "sleeve_right", role: "right", w: Hs },
    { id: "sleeve_bottom", role: "bottom", w: Ls },
    { id: "sleeve_left", role: "left", w: Hs },
  ];
  const target = new Vector3((box.min.x + box.max.x) / 2, box.max.y + c + t, (box.min.z + box.max.z) / 2);
  let x = 0;
  cols.forEach((col, i) => {
    const r = rect(x, ys, col.w, Wt);
    const poly = rectPolygon(r.x, r.y, r.width, r.height);
    if (i === 0) b.piece(col.id, col.role, poly, "Sleeve", { matrix: poseMatrix(r, target, -Math.PI / 2), stage: 2, lift: dims.H * 1.5 }, { label: "Sleeve top" });
    else b.attach(col.id, col.role, cols[i - 1].id, rectEdges(rect(x - cols[i - 1].w, ys, cols[i - 1].w, Wt)).right, col.w, { kind: "rect" }, { stage: 0, label: `Sleeve ${col.role}` });
    const E = rectEdges(r);
    for (const [k, edge] of [["B", E.top], ["F", E.bottom]] as const) {
      b.attach(`${col.id}Turn${k}`, "inner", col.id, insetSeg(edge, t + 0.3), tiS, { kind: "trapezoid", taperA: 1, taperB: 1 }, { fold: 180, pivotDepth: 1, stage: 1, stack: turnInStack(t), label: "Turn-in" });
    }
    x += col.w;
  });
  b.attach("sleeve_glue", "glue", "sleeve_left", rectEdges(rect(x - Hs, ys, Hs, Wt)).right, Math.min(15, Ls * 0.3), { kind: "trapezoid", taperA: 3, taperB: 3 }, { stage: 0, stack: tabStack(t), label: "Glue flap" });
  // Ribbon pull (rigid-food E-02): out of the front slot and hanging as a short loop. Closed frame:
  // bottom centre origin; the drawer front is flush with the sleeve's front opening.
  const accessories: DielineAccessory[] = [];
  if (!f.thumbNotch && fromRim + 4 < tray.Hp - t) {
    const zf = Wt / 2 + 0.2;
    const ySlot = c + t + Ht - fromRim;
    const drop = Math.min(22, ySlot - 2);
    accessories.push({
      kind: "ribbon",
      widthMm: 10,
      color: "#2b2b2b",
      label: "Ribbon pull",
      path: [
        [0, ySlot, zf - 3],
        [0, ySlot, zf + 0.6],
        [0, ySlot - drop * 0.35, zf + 3.2],
        [0, ySlot - drop, zf + 2.2],
        [0, ySlot - drop - 1.5, zf + 0.7],
      ],
    });
  }
  return { builder: b, closedRotation: closedBase, accessories };
}

/* ───────────── Hinged lid ───────────── */

/**
 * Base and lid trays of the same footprint; the lid rests on the base rim and is hinged at
 * the back with a paper hinge strip glued over both back walls (one continuous wrap).
 * Inner height H = base depth + lid depth (`lidHeightMm`, default 30 %).
 */
export function hingedLidBox(dims: Dims, t: number, f: StructureFeatures = {}): FamilyDraft {
  const Hl = clamp(f.lidHeightMm ?? Math.round(dims.H * 0.3), 10, Math.max(10, dims.H * 0.6));
  const Hb = Math.max(10, dims.H - Hl);
  const b = new DielineBuilder();
  const base = wrapTray(b, t, { pre: "", L: dims.L, W: dims.W, H: Hb, origin: pt(0, 0), mode: "base" });
  base.build((id, poly) => b.root(id, "bottom", poly, "Base"));
  b.pieceLabels.set("bottom", "Base");
  const box = mainClosedBounds(b, t, closedBase);
  const y0 = sheetBottom(b) + Hl + t + turnInGap(Hl);
  const lid = wrapTray(b, t, { pre: "lid_", L: dims.L, W: dims.W, H: Hl, origin: pt(0, y0), mode: "lid" });
  const target = new Vector3((box.min.x + box.max.x) / 2, box.max.y + Hl + t, (box.min.z + box.max.z) / 2);
  lid.build((id, poly) => b.piece(id, "top", poly, "Lid", { matrix: poseMatrix(lid.base, target, -Math.PI / 2), stage: 3, lift: dims.H * 1.2 }, { label: "Lid" }));
  if (f.window) cutWindow(b, "lid_top", { ...f.window, face: "top", film: f.window.film ?? true }, { margin: 15 });
  if (f.thumbNotch) notchWalls(b, base, ["front"], Math.min(14, dims.L * 0.08, Hb * 0.35));
  return { builder: b, closedRotation: closedBase };
}

/* ───────────── Collapsible (fold-flat) rigid box ───────────── */

/**
 * Ships flat and is set up by the buyer: base board with four walls; the side walls are
 * double (inner board folds over the rim) and trap corner ears from the front and back walls;
 * the back wall carries the lid and a magnetic front flap. Compensation: base L = L + 6t
 * (side wall + ear + inner board each end), W = W + 2t.
 */
export function collapsibleBox(dims: Dims, t: number, f: StructureFeatures = {}): FamilyDraft {
  void f;
  const Lp = dims.L + 6 * t;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + t;
  const b = new DielineBuilder();
  const base = rect(0, 0, Lp, Wp);
  const E = rectEdges(base);
  b.root("bottom", "bottom", rectPolygon(0, 0, Lp, Wp), "Base");
  b.pieceLabels.set("bottom", "Box");
  b.attach("front", "front", "bottom", E.top, Hp, { kind: "rect" }, { stage: 0, label: "Front wall" });
  b.attach("back", "back", "bottom", E.bottom, Hp + t, { kind: "rect" }, { stage: 0, label: "Back wall" });
  const earD = Math.min(Wp * 0.4, 40);
  for (const [name, r] of [["front", rect(0, -Hp, Lp, Hp)], ["back", rect(0, Wp, Lp, Hp + t)]] as const) {
    const e = rectEdges(r);
    const len = Math.min(Hp, r.height) - 2;
    for (const [k, edge] of [["L", e.left], ["R", e.right]] as const) {
      const seg: [Pt, Pt] = name === "front" ? [pt(edge[0].x, edge[1].y - len), edge[1]] : [edge[0], pt(edge[0].x, edge[0].y + len)];
      b.attach(`${name}Ear${k}`, "ear", name, insetSeg(seg, 1, 1), earD, { kind: "trapezoid", taperA: earD * 0.3, taperB: earD * 0.3 }, { stage: 0, stack: -1, label: "Locking ear" });
    }
  }
  for (const [name, edge, r] of [["left", E.left, rect(-Hp, 0, Hp, Wp)], ["right", E.right, rect(Lp, 0, Hp, Wp)]] as const) {
    b.attach(name, name, "bottom", edge, Hp, { kind: "rect" }, { stage: 1, label: "Side wall" });
    const far = name === "left" ? rectEdges(r).left : rectEdges(r).right;
    b.attach(`${name}Inner`, "inner", name, insetSeg(far, 0.5), dims.H - 0.5, { kind: "rect" }, { fold: 180, pivotDepth: 1.5, stage: 2, label: "Inner side wall" });
  }
  const back = rect(0, Wp, Lp, Hp + t);
  b.attach("lid", "top", "back", rectEdges(back).bottom, Wp + t, { kind: "rect" }, { stage: 3, label: "Lid" });
  const lidR = rect(0, Wp + Hp + t, Lp, Wp + t);
  b.attach("flap", "front", "lid", rectEdges(lidR).bottom, dims.H + 2 * t - 0.5, { kind: "rect" }, { stage: 4, label: "Magnetic flap" });
  return { builder: b, closedRotation: closedBase };
}

/* ───────────── Construction specs (greyboard cut list) ───────────── */

const trayBlank = (label: string, L: number, W: number, H: number, g: number) => ({
  label,
  widthMm: Math.round((L + 2 * g + 2 * H) * 10) / 10,
  heightMm: Math.round((W + 2 * g + 2 * H) * 10) / 10,
  qty: 1,
});

/** Greyboard caliper inside a wrapped wall of thickness t. */
export const boardCaliper = (t: number) => Math.max(0.5, t - WRAP_PAPER_MM);

export function rigidConstruction(kind: "lidBase" | "window" | "shoulder" | "book" | "drawer" | "hinged" | "collapsible", dims: Dims, t: number, f: StructureFeatures = {}): ConstructionSpec {
  const g = boardCaliper(t);
  const c = RIGID_CLEARANCE_MM;
  const extras: string[] = [`Greyboard ${g.toFixed(2)} mm, wrap paper 157 gsm (turn-ins ${turnInFor(dims.H).toFixed(0)} mm)`];
  switch (kind) {
    case "lidBase":
    case "window": {
      const lidH = clamp(f.lidHeightMm ?? Math.round(dims.H * 0.4), Math.min(15, dims.H), dims.H);
      if (kind === "window" || f.window) extras.push("Clear PET window film glued inside the lid top");
      return { boards: [trayBlank("Base tray (V-scored, corners notched)", dims.L, dims.W, dims.H, g), trayBlank("Lid tray", dims.L + 2 * t + 2 * c, dims.W + 2 * t + 2 * c, lidH, g)], extras };
    }
    case "shoulder": {
      const e = clamp(f.lidHeightMm ?? clamp(Math.round(dims.H * 0.3), 15, 50), 10, Math.max(10, dims.H * 0.7));
      const Ln = dims.L + 2 * t;
      const Wn = dims.W + 2 * t;
      return {
        boards: [
          trayBlank("Base tray", Ln, Wn, dims.H - e, g),
          { label: "Neck sleeve (scored strip)", widthMm: Math.round((2 * Ln + 2 * Wn) * 10) / 10, heightMm: dims.H, qty: 1 },
          trayBlank("Lid tray", Ln + 2 * c, Wn + 2 * c, e, g),
        ],
        extras: [...extras, `Neck stands ${e} mm proud of the base`],
      };
    }
    case "book": {
      const Lt = dims.L + 2 * t;
      const Wt = dims.W + 2 * t;
      const Ht = dims.H + t;
      return {
        boards: [
          trayBlank("Tray", dims.L, dims.W, dims.H, g),
          { label: "Cover bottom / lid board", widthMm: Lt + 4, heightMm: Math.round((Wt + 2 * t + c) * 10) / 10, qty: 2 },
          { label: "Spine board", widthMm: Lt + 4, heightMm: Math.round((Ht + 2 * t) * 10) / 10, qty: 1 },
          { label: "Flap board", widthMm: Lt + 4, heightMm: Math.round((Ht + t - 0.5) * 10) / 10, qty: 1 },
        ],
        extras: [...extras, "4 × neodymium disc magnets Ø10 × 2 mm (2 in the flap, 2 behind the front wall wrap)", "Cover boards spaced 2t + 1 mm apart at the spine joints (paper hinge)"],
      };
    }
    case "drawer": {
      const Lt = dims.L + 2 * t;
      const Ht = dims.H + t;
      return {
        boards: [trayBlank("Drawer tray", dims.L, dims.W, dims.H, g), { label: "Sleeve (scored, 4 panels)", widthMm: Math.round((2 * (Lt + 1.5 + 2 * t) + 2 * (Ht + 1.5 + 2 * t)) * 10) / 10, heightMm: dims.W + 2 * t, qty: 1 }],
        extras: [...extras, f.thumbNotch ? "Thumb notch in the drawer front" : `Ribbon pull 10 mm × ${Math.round(dims.W * 0.5 + 40)} mm, through the front slot, glued under the floor`],
      };
    }
    case "hinged": {
      const Hl = clamp(f.lidHeightMm ?? Math.round(dims.H * 0.3), 10, Math.max(10, dims.H * 0.6));
      return {
        boards: [trayBlank("Base tray", dims.L, dims.W, dims.H - Hl, g), trayBlank("Lid tray", dims.L, dims.W, Hl, g)],
        extras: [...extras, `Paper hinge strip ${Math.round(dims.L - 10)} × 40 mm across both back walls`],
      };
    }
    case "collapsible": {
      const Lp = dims.L + 6 * t;
      const Wp = dims.W + 2 * t;
      return {
        boards: [
          { label: "Base board", widthMm: Math.round(Lp * 10) / 10, heightMm: Math.round(Wp * 10) / 10, qty: 1 },
          { label: "Front / back wall", widthMm: Math.round(Lp * 10) / 10, heightMm: Math.round((dims.H + t) * 10) / 10, qty: 2 },
          { label: "Side wall (outer + inner)", widthMm: Math.round(Wp * 10) / 10, heightMm: Math.round((dims.H + t) * 10) / 10, qty: 4 },
          { label: "Lid board", widthMm: Math.round(Lp * 10) / 10, heightMm: Math.round((Wp + t) * 10) / 10, qty: 1 },
          { label: "Flap board", widthMm: Math.round(Lp * 10) / 10, heightMm: Math.round((dims.H + 2 * t - 0.5) * 10) / 10, qty: 1 },
        ],
        extras: [...extras, "Boards laid on the wrap with 2t gaps at every fold (ships flat)", "2 magnets in the flap, 2 behind the front wall; double-sided tape on the locking ears"],
      };
    }
  }
}
