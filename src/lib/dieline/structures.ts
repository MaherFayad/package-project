import { Box3, Euler, Mat4 as Matrix4, Quat as Quaternion, Vec3 as Vector3 } from "./math";
import type { Dims, FaceId, StructureCode, StructureFeatures } from "@/types";
import { DielineBuilder, insetSeg, rectEdges } from "./builder";
import { boundsAt, panelPivot } from "./fold";
import { cutWindow, notchPanel, stadium, tearBand, tearStripLines } from "./features";
import { bboxOf, centroid, clamp, pt, rectPolygon } from "./geometry";
import type { DielinePanel, FaceInfo, FacePart, Polygon, Pt, Rect } from "./types";

/**
 * Parametric generators. Every generator works in inner dimensions (L front width,
 * W depth, H height), board thickness t and optional features, and lays the blank out as
 * seen from the printed side.
 *
 * Thickness compensation: crease-to-crease panel sizes are inner + (layers × t) on each
 * side, where "layers" is how many board layers stack at that wall/end once closed. So the
 * inner space of the folded 3D model equals the requested inner size, and the outer size is
 * inner + 2 × layers × t (e.g. RSC height = H + 4t: minor + major flap at both ends).
 */
export interface StructureDraft {
  builder: DielineBuilder;
  /** Quaternion [x, y, z, w] taking the main root panel from flat to upright-closed. */
  closedRotation: [number, number, number, number];
  /** Replace / extend the automatic face detection (tube, gable, …). */
  faces?: (panels: DielinePanel[], computed: Partial<Record<FaceId, FaceInfo>>) => Partial<Record<FaceId, FaceInfo>>;
  /** Replace the default safe zones (one inset bbox per face panel). */
  safeZones?: (panels: DielinePanel[], safeMm: number) => { panelId: string; rect: Rect }[];
  /**
   * How far below the outermost plane a panel may sit and still belong to a face (mm).
   * Two-piece boxes: the base wall under a shallow lid is part of the same face.
   */
  faceDepthTol?: number;
}

export type Generator = (dims: Dims, t: number, features: StructureFeatures) => StructureDraft;

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

const quat = (x: number, y: number, z: number, order: "XYZ" | "YXZ" = "YXZ"): [number, number, number, number] => {
  const q = new Quaternion().setFromEuler(new Euler(x, y, z, order));
  return [q.x, q.y, q.z, q.w];
};

const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

/** Bounds (model space, mm) of the main tree when closed — used to place extra pieces. */
function mainClosedBounds(b: DielineBuilder, t: number, closedRotation: [number, number, number, number]): Box3 {
  const ids = new Set(b.subtree(b.rootId));
  return boundsAt({ panels: b.panels.filter((p) => ids.has(p.id)), rootId: b.rootId, thicknessMm: t, closedRotation }, 1);
}

const maxStageOf = (b: DielineBuilder) => b.panels.reduce((m, p) => Math.max(m, p.foldStage, p.assembly?.stage ?? 0), 0);

/** Lowest y of everything on the sheet so far (to lay extra blanks below). */
const sheetBottom = (b: DielineBuilder) => bboxOf(b.panels.flatMap((p) => p.polygon)).y + bboxOf(b.panels.flatMap((p) => p.polygon)).height;
const sheetLeft = (b: DielineBuilder) => bboxOf(b.panels.flatMap((p) => p.polygon)).x;

/* ───────────────────────── shared closures ───────────────────────── */

type Walls = { front: Rect; back: Rect; left: Rect; right: Rect };

/**
 * Tuck closure (lid + tuck + two dust flaps) at the top or bottom of a 4-panel tube laid out
 * glue | left | front | right | back. Lid on `owner`, dust flaps on the side panels.
 */
function tuckClosure(b: DielineBuilder, w: Walls, where: "top" | "bottom", owner: "front" | "back", t: number, Lp: number, Wp: number, Hp: number) {
  const tuckD = Math.min(clamp(Wp * 0.35 + 5, 10, 30), Hp * 0.4);
  const dustD = Math.min(Wp * 0.8, Lp * 0.45);
  const ownerRect = w[owner];
  const lidY = where === "top" ? ownerRect.y - Wp : ownerRect.y + Hp;
  const lid = rect(ownerRect.x, lidY, Lp, Wp);
  const hinge = where === "top" ? rectEdges(ownerRect).top : rectEdges(ownerRect).bottom;
  b.attach(where, where, owner, hinge, Wp, { kind: "rect" }, { stage: 2, label: where === "top" ? "Top closure" : "Bottom closure" });
  const far = where === "top" ? rectEdges(lid).top : rectEdges(lid).bottom;
  b.attach(`${where}Tuck`, "tuck", where, insetSeg(far, t + 0.5), tuckD, { kind: "tuck", shoulder: 1 }, {
    stage: 2,
    // a front-hinged closure tucks against the back wall, where the glue flap is already laminated
    // inside: one more caliper in, or the two lie in one plane and z-fight (ECMA_RTE bottom, C-05)
    stack: owner === "front" ? -2 : -1,
    label: "Tuck flap",
  });
  for (const [side, r] of [["L", w.left], ["R", w.right]] as const) {
    const edge = where === "top" ? rectEdges(r).top : rectEdges(r).bottom;
    const taper = Math.min(dustD * 0.4, Wp * 0.3);
    b.attach(`${where}Dust${side}`, "dust", side === "L" ? "left" : "right", edge, dustD, { kind: "trapezoid", taperA: taper * 0.5, taperB: taper }, {
      stage: 1,
      stack: -1,
      label: "Dust flap",
    });
  }
}

/**
 * Crash-lock (automatic, pre-glued) bottom, ECMA A60.20: each of the four bottom flaps has a
 * 45° glue-assist crease from its leading corner; the long-panel flaps carry a locking
 * tongue past the centre line. Folded, the long flaps cover the bottom (front outermost).
 */
function crashLockBottom(b: DielineBuilder, w: Walls, t: number, Lp: number, Wp: number) {
  // Side flaps fold across L, long flaps across W: each stays inside its half.
  const h = Wp / 2;
  const e0 = Math.min(12, Wp * 0.22);
  // Front flap: hook tongue past the centre line. Back flap: the matching notch, so the
  // two lock edge to edge and the bottom reads as one flat panel from below.
  const L0 = w.front.width;
  const x1 = L0 * 0.28;
  const x2 = L0 * 0.62;
  const ch = Math.min(h - t, L0 * 0.3);
  const e = Math.min(e0, ((x2 - x1) / 1.2) * 0.9);
  {
    const f = b.frame("front", rectEdges(w.front).bottom);
    const poly: Polygon = [f.at(f.a, 0, 0), f.at(f.a, L0, 0), f.at(f.a, L0, h - ch), f.at(f.a, L0 - ch, h), f.at(f.a, x2, h), f.at(f.a, x2 - e * 0.6, h + e), f.at(f.a, x1 + e * 0.6, h + e), f.at(f.a, x1, h), f.at(f.a, 0, h)];
    b.attachPoly("bottom_front", "bottom", "front", [f.a, f.b], poly, { stage: 2, stack: 0, label: "Crash-lock flap" });
    b.extraCreases.push({ a: f.at(f.a, 0, 0), b: f.at(f.a, Math.min(h, L0 * 0.25), Math.min(h, L0 * 0.25)) });
  }
  {
    // Back panel runs the other way round the box: local u ↔ box x = L - u.
    const f = b.frame("back", rectEdges(w.back).bottom);
    const n1 = L0 - x2;
    const n2 = L0 - x1;
    const poly: Polygon = [f.at(f.a, 0, 0), f.at(f.a, L0, 0), f.at(f.a, L0, h - t), f.at(f.a, n2, h - t), f.at(f.a, n2 - e * 0.6, h - t - e), f.at(f.a, n1 + e * 0.6, h - t - e), f.at(f.a, n1, h - t), f.at(f.a, ch, h - t), f.at(f.a, 0, h - t - ch)];
    b.attachPoly("bottom_back", "flap", "back", [f.a, f.b], poly, { stage: 2, stack: 0, label: "Crash-lock flap" });
    b.extraCreases.push({ a: f.at(f.a, L0, 0), b: f.at(f.a, L0 - Math.min(h - t, L0 * 0.25), Math.min(h - t, L0 * 0.25)) });
  }
  for (const side of ["left", "right"] as const) {
    const f = b.frame(side, rectEdges(w[side]).bottom);
    const d = Math.min(h - t, f.length * 0.48, Lp / 2 - t);
    const poly: Polygon = [f.at(f.a, 0, 0), f.at(f.a, f.length, 0), f.at(f.a, f.length - d * 0.3, d), f.at(f.a, d * 0.3, d)];
    b.attachPoly(`bottom_${side}`, "flap", side, [f.a, f.b], poly, { stage: 1, stack: -2, label: "Crash-lock glue flap" });
    b.extraCreases.push({ a: f.at(f.a, 0, 0), b: f.at(f.a, d, d) });
  }
}

/**
 * 1-2-3 snap-lock bottom, ECMA A55.20: (1) side dust flaps, (2) front flap with a centre
 * slot, (3) back flap whose two locking tabs push through and catch.
 */
function snapLockBottom(b: DielineBuilder, w: Walls, t: number, Wp: number) {
  const Lp = w.front.width;
  for (const side of ["left", "right"] as const) {
    const f = b.frame(side, rectEdges(w[side]).bottom);
    const d = Math.min(Wp * 0.45, f.length * 0.48, Lp / 2 - t);
    b.attach(`bottom_${side}`, "dust", side, [f.a, f.b], d, { kind: "trapezoid", taperA: d * 0.35, taperB: d * 0.35 }, { stage: 1, stack: -2, label: "Bottom dust flap (1)" });
  }
  {
    const f = b.frame("front", rectEdges(w.front).bottom);
    const L = f.length;
    const d = Wp * 0.5 + Math.min(8, Wp * 0.15);
    const sw = Math.min(L * 0.3, 40);
    const sd = Math.min(d * 0.35, 14);
    const c = L / 2;
    const ch = Math.min(d * 0.3, L * 0.12);
    const poly: Polygon = [f.at(f.a, 0, 0), f.at(f.a, L, 0), f.at(f.a, L, d - ch), f.at(f.a, L - ch, d), f.at(f.a, c + sw / 2, d), f.at(f.a, c + sw / 2 - 2, d - sd), f.at(f.a, c - sw / 2 + 2, d - sd), f.at(f.a, c - sw / 2, d), f.at(f.a, ch, d), f.at(f.a, 0, d - ch)];
    b.attachPoly("bottom_front", "flap", "front", [f.a, f.b], poly, { stage: 2, stack: -1, label: "Bottom slot flap (2)" });
  }
  {
    const f = b.frame("back", rectEdges(w.back).bottom);
    const L = f.length;
    // Flap 3 is the big one: it covers most of the bottom and locks over flap 2.
    const d = Math.max(Wp * 0.5 + Math.min(8, Wp * 0.15), Wp * 0.72) - t;
    const tab = Math.min(10, Wp * 0.18);
    const tw = Math.min(L * 0.18, 25);
    const ch = Math.min(d * 0.3, L * 0.12);
    const c = L / 2;
    const poly: Polygon = [f.at(f.a, 0, 0), f.at(f.a, L, 0), f.at(f.a, L, d - ch), f.at(f.a, L - ch, d), f.at(f.a, c + tw * 1.6, d), f.at(f.a, c + tw * 1.4, d + tab), f.at(f.a, c + tw * 0.5, d + tab), f.at(f.a, c + tw * 0.3, d), f.at(f.a, c - tw * 0.3, d), f.at(f.a, c - tw * 0.5, d + tab), f.at(f.a, c - tw * 1.4, d + tab), f.at(f.a, c - tw * 1.6, d), f.at(f.a, ch, d), f.at(f.a, 0, d - ch)];
    b.attachPoly("bottom_back", "bottom", "back", [f.a, f.b], poly, { stage: 3, stack: 0, label: "Bottom lock flap (3)" });
  }
}

/** Glue | left | front | right | back tube of a folding carton. Returns the wall rects. */
function cartonTube(b: DielineBuilder, Lp: number, Wp: number, Hp: number, g: number, sideShape?: (r: Rect) => Polygon): Walls {
  const xL = g;
  const xF = xL + Wp;
  const xR = xF + Lp;
  const xB = xR + Wp;
  const w: Walls = { left: rect(xL, 0, Wp, Hp), front: rect(xF, 0, Lp, Hp), right: rect(xR, 0, Wp, Hp), back: rect(xB, 0, Lp, Hp) };
  b.root("front", "front", rectPolygon(w.front.x, w.front.y, Lp, Hp), "Front");
  if (sideShape) {
    b.attachPoly("left", "left", "front", rectEdges(w.front).left, sideShape(w.left), { stage: 0, label: "Left side" });
    b.attachPoly("right", "right", "front", rectEdges(w.front).right, sideShape(w.right), { stage: 0, label: "Right side" });
  } else {
    b.attach("left", "left", "front", rectEdges(w.front).left, Wp, { kind: "rect" }, { stage: 0, label: "Left side" });
    b.attach("right", "right", "front", rectEdges(w.front).right, Wp, { kind: "rect" }, { stage: 0, label: "Right side" });
  }
  b.attach("back", "back", "right", rectEdges(w.right).right, Lp, { kind: "rect" }, { stage: 0, label: "Back" });
  b.attach("glue", "glue", "left", rectEdges(w.left).left, g, { kind: "trapezoid", taperA: g * 0.6, taperB: g * 0.6 }, { stage: 0, stack: -1, label: "Glue flap" });
  return w;
}

/** Glue flap width for folding cartons (ECMA practice: 12–15 mm, narrower on tiny cartons). */
const cartonGlue = (W: number) => clamp(W * 0.3, 10, 15);

function cartonFeatures(b: DielineBuilder, w: Walls, f: StructureFeatures, opts: { notchTop: boolean }) {
  if (f.window) cutWindow(b, f.window.face === "back" ? "back" : "front", f.window);
  if (f.thumbNotch && opts.notchTop) {
    const front = b.byId("front");
    notchPanel(front, rectEdges(w.front).top, Math.min(12, w.front.width * 0.18));
  }
}

/* ───────────────────────── Tuck end folding cartons (ECMA) ───────────────────────── */

/**
 * Straight tuck end (both closures hinged on the back panel) or reverse tuck end
 * (top closure on the back, bottom closure on the front).
 * Layout, left → right: glue flap | left | front | right | back. Lid + dust flaps stack two
 * layers at each end, so the height panel is H + 4t.
 */
export function tuckEndCarton(dims: Dims, t: number, reverse: boolean, f: StructureFeatures = {}): StructureDraft {
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 4 * t;
  const b = new DielineBuilder();
  const w = cartonTube(b, Lp, Wp, Hp, cartonGlue(dims.W));
  tuckClosure(b, w, "top", "back", t, Lp, Wp, Hp);
  tuckClosure(b, w, "bottom", reverse ? "front" : "back", t, Lp, Wp, Hp);
  cartonFeatures(b, w, f, { notchTop: true });
  return { builder: b, closedRotation: IDENTITY };
}

/** Tuck top (on the back) + crash-lock bottom, ECMA A60.20. */
export function crashLockCarton(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 5 * t; // top: lid + dust; bottom: up to three flap layers
  const b = new DielineBuilder();
  const w = cartonTube(b, Lp, Wp, Hp, cartonGlue(dims.W));
  tuckClosure(b, w, "top", "back", t, Lp, Wp, Hp);
  crashLockBottom(b, w, t, Lp, Wp);
  cartonFeatures(b, w, f, { notchTop: true });
  return { builder: b, closedRotation: IDENTITY };
}

/** Tuck top (on the back) + 1-2-3 snap-lock bottom, ECMA A55.20. */
export function snapLockCarton(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 5 * t;
  const b = new DielineBuilder();
  const w = cartonTube(b, Lp, Wp, Hp, cartonGlue(dims.W));
  tuckClosure(b, w, "top", "back", t, Lp, Wp, Hp);
  snapLockBottom(b, w, t, Wp);
  cartonFeatures(b, w, f, { notchTop: true });
  return { builder: b, closedRotation: IDENTITY };
}

/* ───────────────────────── Gable carry box ───────────────────────── */

/**
 * Gable box: carton tube with house-shaped (pentagon) ends, two roof panels rising to a
 * double-thickness handle with hand holes, and a 1-2-3 snap-lock bottom.
 * Layout: glue | left (pentagon) | front + roof + handle | right (pentagon) | back + roof + handle.
 */
export function gableBox(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 3 * t;
  const run = Wp / 2 - t; // horizontal travel of each roof so the handles meet back to back
  const rise = clamp(Wp * 0.42, 20, 90);
  const roofLen = Math.hypot(run, rise);
  const roofAngle = (Math.atan2(run, rise) * 180) / Math.PI; // fold from vertical
  const handleH = clamp(dims.H * 0.3, 35, 70);
  const b = new DielineBuilder();
  const pentagon = (r: Rect): Polygon => [pt(r.x, r.y), pt(r.x + r.width / 2, r.y - rise), pt(r.x + r.width, r.y), pt(r.x + r.width, r.y + r.height), pt(r.x, r.y + r.height)];
  const w = cartonTube(b, Lp, Wp, Hp, cartonGlue(dims.W), pentagon);
  snapLockBottom(b, w, t, Wp);

  for (const side of ["front", "back"] as const) {
    const r = w[side];
    const roofId = `roof_${side}`;
    b.attach(roofId, "top", side, rectEdges(r).top, roofLen, { kind: "rect" }, { fold: roofAngle, stage: 2, label: "Roof" });
    const roofR = rect(r.x, r.y - roofLen, Lp, roofLen);
    const handleId = `handle_${side}`;
    const hr = rect(r.x, roofR.y - handleH, Lp, handleH);
    const holes = f.handle ? [stadium(hr.x + Lp / 2, hr.y + handleH * 0.45, Math.min(90, Lp * 0.55), Math.min(26, handleH * 0.38))] : undefined;
    b.attach(handleId, "top", roofId, rectEdges(roofR).top, handleH, { kind: "rect" }, { fold: -roofAngle, stage: 2, label: "Handle", holes });
    // Roof side tabs tuck inside the gable ends.
    const tab = Math.min(12, roofLen * 0.25);
    for (const [k, edge] of [["L", rectEdges(roofR).left], ["R", rectEdges(roofR).right]] as const) {
      b.attach(`roofTab_${side}${k}`, "dust", roofId, insetSeg(edge, 2, roofLen * 0.2), tab, { kind: "trapezoid", taperA: tab * 0.6, taperB: tab * 0.3 }, { fold: 90, stage: 2, stack: -1, label: "Roof tab" });
    }
  }
  if (f.window) cutWindow(b, f.window.face === "back" ? "back" : "front", f.window);

  return {
    builder: b,
    closedRotation: IDENTITY,
    faces: (panels, computed) => {
      const { top: _top, ...rest } = computed;
      void _top;
      return {
        ...rest,
        front: columnFace("front", panels, ["handle_front", "roof_front", "front"]),
        back: columnFace("back", panels, ["handle_back", "roof_back", "back"]),
        left: columnFace("left", panels, ["left"]),
        right: columnFace("right", panels, ["right"]),
      };
    },
  };
}

/**
 * A face made of panels stacked upright in one column of the sheet (wall, roof, handle):
 * face-local mm map to sheet mm by a translation, so artwork runs over the folds exactly as
 * it is printed.
 */
function columnFace(face: FaceId, panels: DielinePanel[], ids: string[]): FaceInfo {
  const ps = ids.map((id) => panels.find((p) => p.id === id)!).filter(Boolean);
  const box = bboxOf(ps.flatMap((p) => p.polygon));
  const parts: FacePart[] = ps.map((p) => ({
    panelId: p.id,
    rect: { x: p.bbox.x - box.x, y: p.bbox.y - box.y, width: p.bbox.width, height: p.bbox.height },
    transform: [1, 0, 0, 1, box.x, box.y],
  }));
  return { face, width: box.width, height: box.height, parts };
}

/* ───────────────────────── FEFCO 0201 RSC / 0200 HSC ───────────────────────── */

interface SlottedOpts {
  top: boolean;
  bottom: boolean;
  /** Prefix for panel ids (a second piece on the same sheet). */
  prefix?: string;
  label?: string;
}

/**
 * Slotted container walls + flaps. Layout, left → right: manufacturer's joint | front |
 * right | back | left; flaps top and/or bottom. Joint attached to the front, glued inside
 * the far end of the left panel.
 */
function slotted(b: DielineBuilder, dims: { Lp: number; Wp: number; Hp: number }, t: number, o: SlottedOpts, origin: Pt = pt(0, 0)) {
  const { Lp, Wp, Hp } = dims;
  const pre = o.prefix ?? "";
  const j = Math.min(35, Hp * 0.4);
  const slot = clamp(2 * t + 2, 4, 8);
  const flapD = Wp / 2;
  const xF = origin.x + j;
  const y0 = origin.y;
  const walls: Walls = {
    front: rect(xF, y0, Lp, Hp),
    right: rect(xF + Lp, y0, Wp, Hp),
    back: rect(xF + Lp + Wp, y0, Lp, Hp),
    // The left wall's free end stops 0.1 mm short of the front's printed face: flush, its cut
    // edge z-fought down the glued-joint corner of the FRONT (R5-3Q-A).
    left: rect(xF + 2 * Lp + Wp, y0, Wp - 0.1, Hp),
  };
  const id = (s: string) => pre + s;
  return {
    walls,
    build(asPiece?: { matrix: number[]; stage: number; lift?: number }) {
      const poly = rectPolygon(walls.front.x, walls.front.y, Lp, Hp);
      if (asPiece) b.piece(id("front"), "front", poly, o.label ?? "Lid", asPiece, { label: "Front" });
      else b.root(id("front"), "front", poly, "Front");
      b.attach(id("right"), "right", id("front"), rectEdges(walls.front).right, Wp, { kind: "rect" }, { stage: 0, label: "Right side" });
      b.attach(id("back"), "back", id("right"), rectEdges(walls.right).right, Lp, { kind: "rect" }, { stage: 0, label: "Back" });
      b.attach(id("left"), "left", id("back"), rectEdges(walls.back).right, walls.left.width, { kind: "rect" }, { stage: 0, label: "Left side" });
      b.attach(id("glue"), "glue", id("front"), rectEdges(walls.front).left, j, { kind: "trapezoid", taperA: j * 0.25, taperB: j * 0.25 }, {
        stage: 0,
        // hinged 0.08 mm inside the FRONT print: on the face its hinge edge flickered by the joint corner
        stack: -1 - 0.08 / t,
        pivotDepth: 0.08 / t,
        label: "Manufacturer's joint",
      });
      for (const where of ["top", "bottom"] as const) {
        if (!o[where]) continue;
        for (const [wid, r] of Object.entries(walls)) {
          const major = wid === "front" || wid === "back";
          const edge = where === "top" ? rectEdges(r).top : rectEdges(r).bottom;
          // Minor flaps never reach past the middle, even when W > L.
          const depth = major ? flapD : Math.min(flapD, Lp / 2 - t);
          b.attach(id(`${where}Flap_${wid}`), "flap", id(wid), insetSeg(edge, slot / 2), depth, { kind: "rect" }, {
            stage: major ? 2 : 1,
            stack: major ? 0 : -1,
            label: major ? "Major flap" : "Minor flap",
          });
        }
      }
    },
  };
}

/** Hand holes centred near the top of the given wall panels. */
function handHoles(b: DielineBuilder, ids: string[], fromTop: number) {
  for (const id of ids) {
    const p = b.byId(id);
    const r = p.bbox;
    const w = Math.min(90, r.width * 0.6);
    const h = Math.min(30, r.height * 0.18);
    if (w < 40 || h < 15) continue;
    p.holes = [...(p.holes ?? []), stadium(r.x + r.width / 2, r.y + Math.max(fromTop, h) + h / 2, w, h)];
  }
}

/** Layer counts of the box ends (for inner-height compensation). RSC: minor + major flap. */
export function rsc(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  const b = new DielineBuilder();
  const s = slotted(b, { Lp: dims.L + 2 * t, Wp: dims.W + 2 * t, Hp: dims.H + 4 * t }, t, { top: true, bottom: true });
  s.build();
  if (f.handle) handHoles(b, ["left", "right"], Math.max(25, dims.H * 0.1));
  if (f.tearStrip) tearBand(b, ["front", "right", "back", "left"], Math.min(60, dims.H * 0.3));
  if (f.partitions) {
    // Bottom flaps (stages 1–2) close, the dividers drop in (3), then the top flaps (4–5).
    defer(b, (p) => p.id.startsWith("topFlap_"), 3);
    addPartitions(b, t, IDENTITY, dims, f.partitions, 2 * t, 3);
  }
  return { builder: b, closedRotation: IDENTITY };
}

/**
 * FEFCO 0320: full telescope box of two half-slotted containers (FEFCO 0200). The base is
 * open at the top (bottom flaps only); the lid (top flaps only) is sized to the base's outer
 * size plus clearance and slides down over it. Lid depth defaults to the full height.
 */
export function telescope(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  const clear = Math.max(1, t * 0.5);
  const b = new DielineBuilder();
  const base = slotted(b, { Lp: dims.L + 2 * t, Wp: dims.W + 2 * t, Hp: dims.H + 2 * t }, t, { top: false, bottom: true });
  base.build();
  const lidH = clamp(f.lidHeightMm ?? dims.H, Math.min(30, dims.H), dims.H);
  // The lid's manufacturer's joint lies inside its left wall: one more caliper of length (and the
  // lid shifted half of it to the left) keeps `clear` on both sides of the base. Without it the
  // joint ran 0.5–1.5 mm into the base's left wall (R5-3Q-A).
  const lidDims = { Lp: dims.L + 2 * t + 2 * clear + 2 * t + t, Wp: dims.W + 2 * t + 2 * clear + 2 * t, Hp: lidH + 2 * t };
  const y0 = sheetBottom(b) + lidDims.Wp / 2 + 15;
  const lid = slotted(b, lidDims, t, { top: true, bottom: false, prefix: "lid_", label: "Lid" }, pt(sheetLeft(b), y0));
  // Closed: lid front sits clear + t in front of the base front, centred, its top flaps
  // (two layers) resting on the base rim.
  const baseFront = base.walls.front;
  const lidFront = lid.walls.front;
  const cb = panelPivot(b.byId("front"), t);
  const delta = new Vector3(baseFront.x + baseFront.width / 2 - (lidFront.x + lidFront.width / 2) - t / 2, -baseFront.y + 2 * t + lidFront.y, clear + t);
  const matrix = new Matrix4().makeTranslation(delta.x - cb.x, delta.y - cb.y, delta.z - cb.z).toArray();
  lid.build({ matrix, stage: 3, lift: dims.H * 1.4 });

  if (f.thumbNotch) for (const id of ["front", "back"]) notchPanel(b.byId(id), rectEdges(base.walls[id as "front" | "back"]).top, Math.min(15, dims.L * 0.08));
  if (f.handle && lidH < dims.H * 0.6) handHoles(b, ["left", "right"], lidH + 10);
  if (f.partitions) {
    defer(b, (p) => p.id === "lid_front", 1); // dividers (3) before the lid (4)
    addPartitions(b, t, IDENTITY, dims, f.partitions, 2 * t, 3);
  }
  return { builder: b, closedRotation: IDENTITY, faceDepthTol: clear + t + 0.5 };
}

/* ───────────────────────── Trays (mailer 0427, pizza 0426, display tray 0422) ───────────────────────── */

interface TrayOpts {
  doubleFront: boolean;
  doubleSides: boolean;
  ears: boolean;
  lid: boolean;
  lidDust: boolean;
  tuckRatio: number;
  displayFront?: boolean;
  /**
   * The lid closes ON the front and side walls (FEFCO 0427 / 0426): those walls stop one
   * caliper below the back wall (H + t, not H + 2t) and the lid's tuck and side flaps hinge
   * from the lid's underside. Without it every wall, ear, inner wall, tuck and flap ran up
   * into the lid board and their top edges lay in the lid's printed face (raw-board lines
   * across the TOP artwork, R5-3Q-A).
   */
  lidOnWalls?: boolean;
  /**
   * Corner clearance (mm): the front wall stops this short of each corner and the side walls
   * this short of the front and one caliper + this short of the back, so no wall's end face
   * lies in a neighbouring wall's printed face (the full-length walls z-fought down every
   * vertical corner of the tray, R5-3Q-A). The back wall keeps its full length (lid hinge).
   */
  cornerGap?: number;
}

/**
 * Base in the middle; back wall + lid + front tuck above it; front wall (optionally
 * rolled double) below; side walls (optionally rolled double, trapping ears) left/right.
 *
 * Compensation: the base is inner + 2 × (wall layers) × t in each direction (side walls:
 * outer + ear + rolled inner = 3 layers; front: 1 or 2 layers; back: 1), the walls are
 * H + 2t (base + lid).
 */
export function trayWithLid(dims: Dims, t: number, o: TrayOpts, f: StructureFeatures = {}): StructureDraft {
  const sideLayers = o.doubleSides ? (o.ears ? 3 : 2) : o.ears ? 2 : 1;
  const frontLayers = o.doubleFront ? 2 : 1;
  const Lp = dims.L + 2 * sideLayers * t;
  const Wp = dims.W + (frontLayers + 1) * t;
  const Hp = dims.H + (o.lid ? 2 : 1) * t;
  // Front and side walls: under the lid when it closes on them.
  const Hw = o.lid && o.lidOnWalls ? Hp - t : Hp;
  const b = new DielineBuilder();

  const base = rect(0, 0, Lp, Wp);
  const back = rect(0, -Hp, Lp, Hp);
  const lid = rect(0, -Hp - Wp, Lp, Wp);
  const g = o.cornerGap ?? 0;
  const front = rect(g, Wp, Lp - 2 * g, Hw);
  const sideL = rect(-Hw, 0, Hw, Wp);
  const sideR = rect(Lp, 0, Hw, Wp);
  // Side-wall hinges: a-end of the base's left/right edges is the back.
  const sideEdge = (e: [Pt, Pt]) => (g > 0 ? insetSeg(e, t + g, g) : e);

  b.root("base", "bottom", rectPolygon(base.x, base.y, base.width, base.height), "Base");
  b.attach("back", "back", "base", rectEdges(base).top, Hp, { kind: "rect" }, { stage: 0, label: "Back wall" });
  if (o.displayFront) {
    const fr = b.frame("base", insetSeg(rectEdges(base).bottom, g));
    const Lf = Lp - 2 * g;
    const corner = Math.min(25, Lp * 0.15);
    const drop = Hw * 0.5;
    const slope = Math.min(drop, (Lp - 2 * corner) * 0.2);
    const poly: Polygon = [fr.at(fr.a, 0, 0), fr.at(fr.a, Lf, 0), fr.at(fr.a, Lf, Hw), fr.at(fr.a, Lf - corner, Hw), fr.at(fr.a, Lf - corner - slope, Hw - drop), fr.at(fr.a, corner + slope, Hw - drop), fr.at(fr.a, corner, Hw), fr.at(fr.a, 0, Hw)];
    b.attachPoly("front", "front", "base", [fr.a, fr.b], poly, { stage: 0, label: "Display front" });
  } else {
    b.attach("front", "front", "base", insetSeg(rectEdges(base).bottom, g), Hw, { kind: "rect" }, { stage: 0, label: "Front wall" });
  }
  // The closed tray is turned 180° so its front faces the viewer: the panel on the
  // dieline's right becomes the box's left side.
  b.attach("right", "right", "base", sideEdge(rectEdges(base).left), Hw, { kind: "rect" }, { stage: 0, label: "Right wall" });
  b.attach("left", "left", "base", sideEdge(rectEdges(base).right), Hw, { kind: "rect" }, { stage: 0, label: "Left wall" });

  if (o.ears) {
    const earD = Wp * 0.4;
    const taper = Math.min(earD * 0.5, Hw * 0.3);
    // Hinged a hair inside the wall's printed face: on the face itself the ear's hinge edge lay
    // in the front / back print and flickered as a board-coloured line down each corner.
    const earPivot = g > 0 ? (0.8 * g) / t : 0;
    // Back wall: box top is its top edge (a-end of left/right edges); its ears stop under the lid.
    const under = Hp - Hw;
    b.attach("earBackL", "ear", "back", insetSeg(rectEdges(back).left, under, 0), earD, { kind: "trapezoid", taperA: taper, taperB: 1 }, { stage: 1, stack: -1 - earPivot, pivotDepth: earPivot, label: "Ear" });
    b.attach("earBackR", "ear", "back", insetSeg(rectEdges(back).right, under, 0), earD, { kind: "trapezoid", taperA: taper, taperB: 1 }, { stage: 1, stack: -1 - earPivot, pivotDepth: earPivot, label: "Ear" });
    // Front wall: box top is its bottom edge (b-end).
    b.attach("earFrontL", "ear", "front", rectEdges(front).left, earD, { kind: "trapezoid", taperA: 1, taperB: taper }, { stage: 1, stack: -1 + (g - earPivot * t) / t, pivotDepth: earPivot, label: "Ear" });
    b.attach("earFrontR", "ear", "front", rectEdges(front).right, earD, { kind: "trapezoid", taperA: 1, taperB: taper }, { stage: 1, stack: -1 + (g - earPivot * t) / t, pivotDepth: earPivot, label: "Ear" });
  }

  if (o.doubleSides) {
    const inset = (frontLayers + 1) * t + 0.5;
    const depth = Hw - 2 * t - 0.5;
    const pivotDepth = o.ears ? 1.5 : 1;
    b.attach("rightInner", "inner", "right", insetSeg(rectEdges(sideL).left, inset), depth, { kind: "rect" }, { fold: 180, pivotDepth, stage: 2, label: "Inner wall" });
    b.attach("leftInner", "inner", "left", insetSeg(rectEdges(sideR).right, inset), depth, { kind: "rect" }, { fold: 180, pivotDepth, stage: 2, label: "Inner wall" });
  }
  if (o.doubleFront) {
    const inset = sideLayers * t + 0.5;
    b.attach("frontInner", "inner", "front", insetSeg(rectEdges(front).bottom, inset), Hw - 2 * t - 0.5, { kind: "rect" }, {
      fold: 180,
      pivotDepth: 1,
      stage: 2,
      label: "Inner front wall",
    });
  }

  if (o.lid) {
    b.attach("top", "top", "back", rectEdges(back).top, Wp, { kind: "rect" }, { stage: 3, label: "Lid" });
    const tuckInset = sideLayers * t + 1;
    const tuckD = Math.max(8, (Hp - 2 * t - 2) * o.tuckRatio);
    b.attach("lidTuck", "tuck", "top", insetSeg(rectEdges(lid).top, tuckInset), tuckD, { kind: "tuck", shoulder: 2 }, {
      stage: 3,
      // hinged at the lid's underside (pivot one caliper in), so one more layer of stack keeps it behind the front wall
      ...(o.lidOnWalls ? { pivotDepth: 1, stack: -frontLayers - 1 } : { stack: -frontLayers }),
      label: "Lid tuck",
    });
    if (o.lidDust) {
      const inset = frontLayers * t + 1;
      const d = Math.max(6, Hp - 2 * t - 2);
      const taper = Math.min(d * 0.6, Wp * 0.3);
      // Lid left edge runs from its far (front) end at the top to the back hinge at the bottom.
      b.attach("lidDustL", "dust", "top", insetSeg(rectEdges(lid).left, inset), d, { kind: "trapezoid", taperA: taper, taperB: 2 }, {
        stage: 3,
        ...(o.lidOnWalls ? { pivotDepth: 1, stack: -sideLayers - 1 } : { stack: -sideLayers }),
        label: "Lid side flap",
      });
      b.attach("lidDustR", "dust", "top", insetSeg(rectEdges(lid).right, inset), d, { kind: "trapezoid", taperA: taper, taperB: 2 }, {
        stage: 3,
        ...(o.lidOnWalls ? { pivotDepth: 1, stack: -sideLayers - 1 } : { stack: -sideLayers }),
        label: "Lid side flap",
      });
    }
  }
  // Turn the layout 180° in its plane (front wall at the top of the sheet) so closing is
  // a single +90° tilt about X: the sheet tips toward the viewer and the front faces them.
  for (const panel of b.panels) {
    panel.polygon = panel.polygon.map((q) => ({ x: -q.x, y: -q.y }));
    if (panel.hinge) panel.hinge = { a: { x: -panel.hinge.a.x, y: -panel.hinge.a.y }, b: { x: -panel.hinge.b.x, y: -panel.hinge.b.y } };
    panel.bbox = bboxOf(panel.polygon);
  }
  const closedRotation = quat(Math.PI / 2, 0, 0);

  // Features (final sheet coordinates).
  if (f.window && o.lid) cutWindow(b, "top", f.window, { margin: Math.max(12, sideLayers * t + 8) });
  if (f.tearStrip && o.lid) {
    // Two perforations across the lid just behind the tuck crease: pulling the strip frees
    // the lid from the glued tuck (e-commerce tear-open mailer).
    const tuck = b.byId("lidTuck").hinge!;
    const lidC = centroid(b.byId("top").polygon);
    const ext = { a: pt(b.byId("top").bbox.x, tuck.a.y), b: pt(b.byId("top").bbox.x + b.byId("top").bbox.width, tuck.b.y) };
    b.perfLines.push(...tearStripLines(ext, lidC, 10, 8, 1));
  }
  if (f.thumbNotch && !o.lid && !o.displayFront) {
    const fr = b.byId("front");
    const far = farEdge(fr);
    if (far) notchPanel(fr, far, Math.min(18, Lp * 0.1));
  }
  if (f.handle && !o.lid) {
    // Hand holes near the rim of the single (not rolled) walls.
    for (const id of o.displayFront ? ["back"] : ["front", "back"]) {
      const p = b.byId(id);
      const far = farEdge(p);
      if (!far) continue;
      const len = Math.hypot(far[1].x - far[0].x, far[1].y - far[0].y);
      const w = Math.min(80, len * 0.45);
      const h = Math.min(26, Hp * 0.25);
      if (w < 35 || h < 14) continue;
      const mid = pt((far[0].x + far[1].x) / 2, (far[0].y + far[1].y) / 2);
      const c = centroid(p.polygon);
      const k = Math.min(0.9, (h / 2 + Math.max(10, Hp * 0.12)) / Math.hypot(c.x - mid.x, c.y - mid.y));
      p.holes = [...(p.holes ?? []), stadium(mid.x + (c.x - mid.x) * k, mid.y + (c.y - mid.y) * k, w, h)];
    }
  }
  if (f.partitions) {
    // Dividers go in before the lid closes.
    if (o.lid) defer(b, (p) => ["top", "lidTuck", "lidDustL", "lidDustR"].includes(p.id), 1);
    addPartitions(b, t, closedRotation, dims, f.partitions, t, 3);
  }
  return { builder: b, closedRotation };
}

/** The outline edge of a rectangular child panel opposite its hinge. */
function farEdge(p: DielinePanel): [Pt, Pt] | null {
  if (!p.hinge) return null;
  const h = p.hinge;
  const n = p.polygon.length;
  let best: [Pt, Pt] | null = null;
  let bestD = -1;
  const hm = pt((h.a.x + h.b.x) / 2, (h.a.y + h.b.y) / 2);
  for (let i = 0; i < n; i++) {
    const a = p.polygon[i];
    const c = p.polygon[(i + 1) % n];
    const m = pt((a.x + c.x) / 2, (a.y + c.y) / 2);
    const len = Math.hypot(c.x - a.x, c.y - a.y);
    const d = Math.hypot(m.x - hm.x, m.y - hm.y);
    if (len > Math.hypot(h.b.x - h.a.x, h.b.y - h.a.y) * 0.8 && d > bestD) {
      bestD = d;
      best = [a, c];
    }
  }
  return best;
}

export function mailer(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  return trayWithLid(dims, t, { doubleFront: true, doubleSides: true, ears: true, lid: true, lidDust: true, tuckRatio: 0.75, lidOnWalls: true, cornerGap: 0.1 }, f);
}

/** FEFCO 0426 pizza box: single front, rolled double side walls trapping ears, lid with tuck and side flaps. */
export function pizza(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  return trayWithLid(dims, t, { doubleFront: false, doubleSides: true, ears: true, lid: true, lidDust: true, tuckRatio: 0.7, lidOnWalls: true, cornerGap: 0.1 }, f);
}

/** FEFCO 0422 self-locking tray: rolled double end walls lock the corner ears; no glue. */
export function displayTray(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  return trayWithLid(dims, t, { doubleFront: false, doubleSides: true, ears: true, lid: false, lidDust: false, tuckRatio: 0, displayFront: !!f.displayFront, cornerGap: 0.1 }, f);
}

/* ───────────────────────── Partitions (divider grid) ───────────────────────── */

/** Push the closing panels (lid, top flaps, lid piece) `by` stages later. */
function defer(b: DielineBuilder, match: (p: DielinePanel) => boolean, by: number) {
  for (const p of b.panels) {
    if (!match(p)) continue;
    if (p.assembly) p.assembly.stage += by;
    else p.foldStage += by;
  }
}

/**
 * Slotted divider strips (separate blanks) laid below the box on the sheet and assembled
 * into a rows × cols grid inside the closed box. Strips along L are slotted from the top,
 * strips along W from the bottom (half height each), so they interlock.
 */
function addPartitions(b: DielineBuilder, t: number, closedRotation: [number, number, number, number], dims: Dims, grid: { rows: number; cols: number }, floor: number, stageAt?: number) {
  const box = mainClosedBounds(b, t, closedRotation);
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const y0 = box.min.y + floor;
  const h = Math.max(10, dims.H - Math.max(3, 2 * t));
  const lenL = dims.L - 2;
  const lenW = dims.W - 2;
  const slotW = t + 0.6;
  const xs = Array.from({ length: grid.cols - 1 }, (_, i) => cx - dims.L / 2 + ((i + 1) * dims.L) / grid.cols);
  const zs = Array.from({ length: grid.rows - 1 }, (_, i) => cz - dims.W / 2 + ((i + 1) * dims.W) / grid.rows);
  const stage = stageAt ?? maxStageOf(b) + 1;
  let sx = sheetLeft(b);
  const sy = sheetBottom(b) + 15;

  const strip = (id: string, len: number, slots: number[], fromTop: boolean): Polygon => {
    // Outline running clockwise on screen, with rectangular slots (concave).
    const top: Pt[] = [pt(sx, sy)];
    const bottom: Pt[] = [];
    const sorted = [...slots].sort((a, c) => a - c);
    if (fromTop) {
      for (const u of sorted) top.push(pt(sx + u - slotW / 2, sy), pt(sx + u - slotW / 2, sy + h / 2), pt(sx + u + slotW / 2, sy + h / 2), pt(sx + u + slotW / 2, sy));
      top.push(pt(sx + len, sy), pt(sx + len, sy + h), pt(sx, sy + h));
      return top;
    }
    top.push(pt(sx + len, sy), pt(sx + len, sy + h));
    for (const u of sorted.reverse()) bottom.push(pt(sx + u + slotW / 2, sy + h), pt(sx + u + slotW / 2, sy + h / 2), pt(sx + u - slotW / 2, sy + h / 2), pt(sx + u - slotW / 2, sy + h));
    void id;
    return [...top, ...bottom, pt(sx, sy + h)];
  };

  const place = (id: string, poly: Polygon, len: number, target: Vector3, alongZ: boolean) => {
    const flatC = new Vector3(sx + len / 2, -(sy + h / 2), 0);
    const m = new Matrix4().makeTranslation(target.x, target.y, target.z);
    if (alongZ) m.multiply(new Matrix4().makeRotationY(Math.PI / 2));
    m.multiply(new Matrix4().makeTranslation(-flatC.x, -flatC.y, -flatC.z));
    b.piece(id, "inner", poly, "Divider", { matrix: m.toArray(), stage, lift: dims.H * 1.3 }, { label: "Divider" }).printable = false;
    sx += len + 10;
  };

  zs.forEach((z, i) => {
    const slots = xs.map((x) => x - (cx - lenL / 2));
    const poly = strip(`divL${i}`, lenL, slots, true);
    place(`divL${i}`, poly, lenL, new Vector3(cx, y0 + h / 2 + 0.5, z + t / 2), false);
  });
  xs.forEach((x, i) => {
    // RotY(90°) maps flat +X to model -Z: strip coordinate u sits at z = cz + len/2 - u.
    const slots = zs.map((z) => lenW / 2 - (z - cz));
    const poly = strip(`divW${i}`, lenW, slots, false);
    place(`divW${i}`, poly, lenW, new Vector3(x + t / 2, y0 + h / 2 + 0.5, cz), true);
  });
}

/* ───────────────────────── Sleeve ───────────────────────── */

/**
 * Sleeve that slides over a tray: wraps top, front, bottom and back; open at the left
 * and right ends (so there are no left/right faces). L is the sleeve's length along the
 * open axis. Layout, top → bottom: glue | top | front | bottom | back.
 */
export function sleeve(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  const Lx = dims.L;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 2 * t;
  const g = clamp(dims.W * 0.25, 10, 20);
  const b = new DielineBuilder();
  const top = rect(0, g, Lx, Wp);
  const front = rect(0, g + Wp, Lx, Hp);
  const bottom = rect(0, g + Wp + Hp, Lx, Wp);
  b.root("front", "front", rectPolygon(front.x, front.y, front.width, front.height), "Front");
  b.attach("top", "top", "front", rectEdges(front).top, Wp, { kind: "rect" }, { stage: 0, label: "Top" });
  b.attach("bottom", "bottom", "front", rectEdges(front).bottom, Wp, { kind: "rect" }, { stage: 0, label: "Bottom" });
  b.attach("back", "back", "bottom", rectEdges(bottom).bottom, Hp, { kind: "rect" }, { stage: 1, label: "Back" });
  b.attach("glue", "glue", "top", rectEdges(top).top, g, { kind: "trapezoid", taperA: g * 0.6, taperB: g * 0.6 }, {
    stage: 1,
    stack: -1,
    label: "Glue flap",
  });
  if (f.window) cutWindow(b, f.window.face === "top" ? "top" : "front", f.window);
  return { builder: b, closedRotation: IDENTITY };
}

/* ───────────────────────── Paper tube (composite can) ───────────────────────── */

/** Strip count of a rolled wall: ~8 mm facets, a multiple of 4 (front/back halves split cleanly). */
export function tubeSegments(outerDiameter: number): number {
  return 4 * Math.round(clamp((Math.PI * outerDiameter) / 8, 24, 64) / 4);
}

/**
 * Spiral-wound paper tube with a telescoping lid. The dieline is the printed label wrap:
 * the body label (open top, paper end disc at the bottom) and the lid label with its top
 * disc. In 3D each label is bent from narrow strips on virtual "roll" hinges so it wraps
 * into a cylinder. L = W = inner diameter, H = inner body height.
 */
export function paperTube(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  const D = dims.L;
  const N = tubeSegments(D + 2 * t);
  const tan = Math.tan(Math.PI / N);
  const R = D / 2 + t; // apothem of the outer surface
  const s = 2 * R * tan;
  const Hb = dims.H + t;
  const clear = 0.4;
  const Rl = R + t + clear;
  const sl = 2 * Rl * tan;
  const lidH = clamp(f.lidHeightMm ?? clamp(dims.H * 0.28, 20, 60), 15, Math.max(15, dims.H * 0.6));
  const Hl = lidH + t;
  const roll = 360 / N;
  const nR = N / 2;
  const nLeft = N / 2 - 1;
  const b = new DielineBuilder();
  const overlap = Math.min(10, s * 1.5);

  /** Regular N-gon end disc hinged on a strip edge (matches the rolled strips exactly). */
  const disc = (parentId: string, id: string, hinge: [Pt, Pt], side: number, role: "top" | "bottom", label: string) => {
    const fr = b.frame(parentId, hinge);
    const poly: Polygon = [];
    let ux = 0;
    let uy = 0;
    for (let i = 0; i < N; i++) {
      poly.push(fr.at(fr.a, ux, uy));
      const a = (i * 2 * Math.PI) / N; // turn toward "out" (away from the strip) each side
      ux += Math.cos(a) * side;
      uy += Math.sin(a) * side;
    }
    return b.attachPoly(id, role, parentId, hinge, poly, { stage: 1, label, printable: role === "top" });
  };


  // Body label strips: root at the front, chains to the right and left.
  const x0 = nLeft * s + 0;
  b.root("body0", "front", rectPolygon(x0, 0, s, Hb), "Body label");
  for (let i = 1; i <= nR; i++) {
    const r = rect(x0 + (i - 1) * s, 0, s, Hb);
    b.attach(`body${i}`, i < N / 4 ? "front" : "back", `body${i - 1}`, rectEdges(r).right, s, { kind: "rect" }, { fold: roll, stage: 0, hingeKind: "roll", label: "Body label" });
  }
  for (let j = 1; j <= nLeft; j++) {
    const r = rect(x0 - (j - 1) * s, 0, s, Hb);
    const parent = j === 1 ? "body0" : `body${N - j + 1}`;
    b.attach(`body${N - j}`, N - j >= (3 * N) / 4 ? "front" : "back", parent, rectEdges(r).left, s, { kind: "rect" }, { fold: roll, stage: 0, hingeKind: "roll", label: "Body label" });
  }
  // Label overlap (glued under the other end).
  {
    const r = rect(x0 + nR * s, 0, s, Hb);
    b.attach("bodyGlue", "glue", `body${nR}`, rectEdges(r).right, overlap, { kind: "rect" }, { fold: roll, stage: 0, stack: -(0.15 / t), hingeKind: "roll", label: "Label overlap" });
  }
  disc("body0", "bodyBottom", rectEdges(rect(x0, 0, s, Hb)).bottom, s, "bottom", "Bottom end");

  // Lid label, laid below.
  const y0 = Hb + 2 * R + 15 + 2 * Rl;
  const xl0 = x0 + s / 2 - sl / 2;
  const lidRootRect = rect(xl0, y0, sl, Hl);
  const cb = panelPivot(b.byId("body0"), t);
  const delta = new Vector3(x0 + s / 2 - (xl0 + sl / 2), -0 + t + y0, Rl - R);
  // Closed pose: half a strip about +Y (see the return below); the lid piece turns with the body.
  const closedRotation = quat(0, Math.PI / N, 0);
  const matrix = new Matrix4()
    .makeRotationFromQuaternion(new Quaternion(...closedRotation))
    .multiply(new Matrix4().makeTranslation(delta.x - cb.x, delta.y - cb.y, delta.z - cb.z))
    .toArray();
  b.piece("lid0", "front", rectPolygon(lidRootRect.x, lidRootRect.y, sl, Hl), "Lid", { matrix, stage: 2, lift: dims.H * 0.6 }, { label: "Lid label" });
  for (let i = 1; i <= nR; i++) {
    const r = rect(xl0 + (i - 1) * sl, y0, sl, Hl);
    b.attach(`lid${i}`, i < N / 4 ? "front" : "back", `lid${i - 1}`, rectEdges(r).right, sl, { kind: "rect" }, { fold: roll, stage: 0, hingeKind: "roll", label: "Lid label" });
  }
  for (let j = 1; j <= nLeft; j++) {
    const r = rect(xl0 - (j - 1) * sl, y0, sl, Hl);
    const parent = j === 1 ? "lid0" : `lid${N - j + 1}`;
    b.attach(`lid${N - j}`, N - j >= (3 * N) / 4 ? "front" : "back", parent, rectEdges(r).left, sl, { kind: "rect" }, { fold: roll, stage: 0, hingeKind: "roll", label: "Lid label" });
  }
  {
    const r = rect(xl0 + nR * sl, y0, sl, Hl);
    b.attach("lidGlue", "glue", `lid${nR}`, rectEdges(r).right, overlap, { kind: "rect" }, { fold: roll, stage: 0, stack: -(0.15 / t), hingeKind: "roll", label: "Label overlap" });
  }
  disc("lid0", "lidTop", rectEdges(lidRootRect).top, sl, "top", "Lid top");

  const stripIndex = (id: string, prefix: string) => (id.startsWith(prefix) && /^\d+$/.test(id.slice(prefix.length)) ? Number(id.slice(prefix.length)) : -1);
  const halfFace = (face: "front" | "back", panels: DielinePanel[]): FaceInfo => {
    const width = (N / 2) * s;
    const height = Hb + t;
    const parts: FacePart[] = [];
    const start = face === "front" ? -N / 4 : N / 4;
    for (let k = 0; k < N / 2; k++) {
      const i = (((start + k) % N) + N) % N;
      const u = k * s;
      const body = panels.find((p) => stripIndex(p.id, "body") === i);
      const lidP = panels.find((p) => stripIndex(p.id, "lid") === i);
      if (lidP) {
        const sc = sl / s;
        parts.push({ panelId: lidP.id, rect: { x: u, y: 0, width: s, height: Math.min(Hl, height) }, transform: [sc, 0, 0, 1, lidP.bbox.x - u * sc, lidP.bbox.y] });
      }
      if (body) {
        // body top edge sits t below the closed top (under the lid disc)
        // From the body's top edge (t below the closed top): the label runs on under the
        // lid, so the design continues when the lid is off.
        parts.push({ panelId: body.id, rect: { x: u, y: t, width: s, height: Math.max(0.5, height - t) }, transform: [1, 0, 0, 1, body.bbox.x - u, body.bbox.y - t] });
      }
    }
    return { face, width, height, parts };
  };

  return {
    builder: b,
    // The FRONT half is strips 3N/4…N/4-1, so its centre is the LEFT edge of the root strip, half
    // a strip (180/N °) left of +Z: the front label sat off-centre and the back colour showed
    // early on the right silhouette (R5-3Q-A). Turn the closed tube by half a strip so the
    // centre of the FRONT face looks straight down +Z.
    closedRotation,
    faces: (panels, computed) => ({ front: halfFace("front", panels), back: halfFace("back", panels), ...(computed.top ? { top: computed.top } : {}) }),
    safeZones: (panels, safe) =>
      panels
        .filter((p) => p.printable && p.role !== "glue")
        .map((p) => ({
          panelId: p.id,
          rect: p.id === "lidTop" ? { x: p.bbox.x + safe, y: p.bbox.y + safe, width: Math.max(0, p.bbox.width - 2 * safe), height: Math.max(0, p.bbox.height - 2 * safe) } : { x: p.bbox.x, y: p.bbox.y + safe, width: p.bbox.width, height: Math.max(0, p.bbox.height - 2 * safe) },
        })),
  };
}

/* ───────────────────────── Rigid set-up box (lid and base) ───────────────────────── */

/**
 * Rigid box: greyboard tray wrapped in printed paper; separate lid of the same build. The
 * dieline is the WRAP sheet (what is printed): bottom/top panel, four walls, turn-ins that
 * roll over the rim to the inside (15 mm), corner tabs on the long walls. Board thickness =
 * greyboard + paper. Lid inner = base outer + 0.5 mm clearance per side; lid depth defaults
 * to ~40 % of the height (shoulder-less lid-off box).
 */
export function rigidBox(dims: Dims, t: number, f: StructureFeatures = {}): StructureDraft {
  const clear = 0.5;
  // Turn-ins and corner tabs are wrap PAPER (~0.15 mm), not greyboard: drawn 0.3 mm proud of their
  // wall instead of a full caliper inside it (same convention as families/rigid-tubes RF-01 / RF-05).
  // At a full caliper the lid's turn-ins pierced the base walls by 1.65 mm and the tabs z-fought
  // the end turn-ins (3d-visual C-01, R4-14).
  const PAPER = 0.3;
  const CORNER_GAP = 0.1;
  const turnInStack = -Math.max(0, t - PAPER) / t;
  const tabStack = -(PAPER / 2) / t;
  // Corner tabs hinge a hair (0.08 mm) inside the long wall's printed face: hinged on the face
  // itself, the tab's unprinted hinge edge lay in that face and flickered as a pale strip
  // down each corner of the lid and the base (R5-3Q-A).
  const tabPivot = (0.8 * CORNER_GAP) / t;
  const b = new DielineBuilder();
  const turnIn = (H: number) => clamp(H * 0.45, 8, 15);
  const tabD = (W: number) => clamp(W * 0.08, 6, 12);

  const tray = (pre: string, L: number, W: number, H: number, lidMode: boolean, origin: Pt) => {
    const Lp = L + 2 * t;
    const Wp = W + 2 * t;
    const Hp = H + t;
    const base = rect(origin.x, origin.y, Lp, Wp);
    const id = (s: string) => pre + s;
    // Base: wall above the bottom panel becomes the FRONT after the closing tilt;
    // lid: it becomes the BACK (the lid is turned the other way up).
    const upper = lidMode ? "back" : "front";
    const lower = lidMode ? "front" : "back";
    // Walls stop CORNER_GAP short of each corner (as families/rigid-tubes RF-06): a full-length
    // wall's end face lies in the neighbouring wall's printed face and z-fights down every corner
    // (raw-board / wrong-colour slivers at the lid and base corners, R5-3Q-A).
    const g = CORNER_GAP;
    const E = rectEdges(base);
    const walls: Record<string, { r: Rect; edge: [Pt, Pt]; role: "front" | "back" | "left" | "right" }> = {
      [upper]: { r: rect(base.x + g, base.y - Hp, Lp - 2 * g, Hp), edge: insetSeg(E.top, g), role: upper },
      [lower]: { r: rect(base.x + g, base.y + Wp, Lp - 2 * g, Hp), edge: insetSeg(E.bottom, g), role: lower },
      left: { r: rect(base.x - Hp, base.y + g, Hp, Wp - 2 * g), edge: insetSeg(E.left, g), role: "left" },
      right: { r: rect(base.x + Lp, base.y + g, Hp, Wp - 2 * g), edge: insetSeg(E.right, g), role: "right" },
    };
    return {
      base,
      Lp,
      Wp,
      Hp,
      build(rootFn: (poly: Polygon) => void) {
        rootFn(rectPolygon(base.x, base.y, Lp, Wp));
        for (const [name, wdef] of Object.entries(walls)) {
          b.attach(id(name), wdef.role, id(lidMode ? "top" : "bottom"), wdef.edge, Hp, { kind: "rect" }, { stage: 0, label: `${name[0].toUpperCase()}${name.slice(1)} wall` });
          const far = farEdge(b.byId(id(name)))!;
          const ti = turnIn(H);
          b.attach(id(`${name}Turn`), "inner", id(name), insetSeg(far, t + 0.3), ti, { kind: "trapezoid", taperA: 1, taperB: 1 }, { fold: 180, pivotDepth: 1, stage: 1, stack: turnInStack, label: "Turn-in" });
        }
        // Corner tabs on the long walls wrap round the corners under the end walls.
        for (const name of ["front", "back"]) {
          const w = b.byId(id(name));
          const r = w.bbox;
          const e = rectEdges(r);
          const d = tabD(W);
          for (const [k, edge] of [["L", e.left], ["R", e.right]] as const) {
            b.attach(id(`${name}Tab${k}`), "ear", id(name), insetSeg(edge, 1, 1), d, { kind: "trapezoid", taperA: d * 0.5, taperB: d * 0.5 }, { stage: 0, stack: tabStack, pivotDepth: tabPivot, label: "Corner tab" });
          }
        }
      },
    };
  };

  const base = tray("", dims.L, dims.W, dims.H, false, pt(0, 0));
  base.build((poly) => b.root("bottom", "bottom", poly, "Base"));
  const closedRotation = quat(Math.PI / 2, 0, 0);
  const box = mainClosedBounds(b, t, closedRotation);

  const lidH = clamp(f.lidHeightMm ?? Math.round(dims.H * 0.4), Math.min(15, dims.H), dims.H);
  const lidL = dims.L + 2 * t + 2 * clear;
  const lidW = dims.W + 2 * t + 2 * clear;
  const y0 = sheetBottom(b) + (lidH + t) + 20;
  const lid = tray("lid_", lidL, lidW, lidH, true, pt(0, y0));
  // Closed lid: top panel printed side up, resting on the base rim, centred.
  const lidCentreFlat = new Vector3(lid.base.x + lid.Lp / 2, -(lid.base.y + lid.Wp / 2), 0);
  const target = new Vector3((box.min.x + box.max.x) / 2, box.max.y + t, (box.min.z + box.max.z) / 2);
  const m = new Matrix4().makeTranslation(target.x, target.y, target.z).multiply(new Matrix4().makeRotationX(-Math.PI / 2)).multiply(new Matrix4().makeTranslation(-lidCentreFlat.x, -lidCentreFlat.y, 0));
  lid.build((poly) => b.piece("lid_top", "top", poly, "Lid", { matrix: m.toArray(), stage: 3, lift: dims.H * 1.2 }, { label: "Lid" }));

  if (f.window) cutWindow(b, "lid_top", f.window, { margin: 15 });
  if (f.thumbNotch) {
    // Finger notches through the base's front and back walls (and their turn-ins).
    for (const name of ["front", "back"]) {
      const w = b.byId(name);
      const far = farEdge(w)!;
      const r = Math.min(14, dims.L * 0.08, dims.H * 0.35);
      notchPanel(w, far, r);
      const ti = b.byId(`${name}Turn`);
      const near = nearEdgeTo(ti, far);
      if (near) notchPanel(ti, near, r);
    }
  }
  if (f.partitions) addPartitions(b, t, closedRotation, dims, f.partitions, t, 2); // before the lid (3)
  return { builder: b, closedRotation, faceDepthTol: clear + t + 0.5 };
}

/** The outline edge of `p` lying on the line through `edge` (turn-in's hinge side). */
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

/**
 * Flat printed part of a container (roll label, pouch web, tube body): one rectangle L × H,
 * printed on the outside, no folds. The container's own print areas (src/lib/library) carry
 * the exact label shapes; this is what the printer cuts per unit.
 */
function flatPart(dims: Dims): StructureDraft {
  const b = new DielineBuilder();
  b.root("front", "front", rectPolygon(0, 0, dims.L, dims.H), "Print area");
  return { builder: b, closedRotation: IDENTITY };
}

export const GENERATORS: Record<StructureCode, Generator> = {
  FEFCO_0427: mailer,
  FEFCO_0201: rsc,
  ECMA_RTE: (d, t, f) => tuckEndCarton(d, t, true, f),
  ECMA_STE: (d, t, f) => tuckEndCarton(d, t, false, f),
  PIZZA: pizza,
  SLEEVE: sleeve,
  FEFCO_0320: telescope,
  ECMA_CLB: crashLockCarton,
  ECMA_SLB: snapLockCarton,
  FEFCO_0422: displayTray,
  GABLE_BOX: gableBox,
  PAPER_TUBE: paperTube,
  RIGID_BOX: rigidBox,
  ROLL_LABEL: flatPart,
  PRINTED_POUCH: flatPart,
  PRINTED_TUBE: flatPart,
};
