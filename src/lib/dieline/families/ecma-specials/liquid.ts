import type { Dims, StructureFeatures } from "@/types";
import { DielineBuilder, insetSeg, rectEdges } from "../../builder";
import { clamp, pt } from "../../geometry";
import type { Polygon, Segment } from "../../types";
import { IDENTITY, blockFace, deg, rect, tube4, withDeepParts, withLiftedParts, type Walls } from "./kit";
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


/** Clearance (mm) between the folded gusset and the roof board above it (no z-fighting). */
export const GUSSET_CLEARANCE_MM = 0.08;
/** Depth (mm) of the gusset apex under the roof board's inside surface at the ridge. */
export const GUSSET_APEX_DROP_MM = 0.5;
/** The tucks' outer corner stops this far inside the end plane (never proud of the end). */
const TUCK_INSET_MM = 0.05;

type V3 = [number, number, number];
const v3sub = (p: V3, q: V3): V3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const v3dot = (p: V3, q: V3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const v3cross = (p: V3, q: V3): V3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
const v3scale = (p: V3, k: number): V3 => [p[0] * k, p[1] * k, p[2] * k];
const v3add = (p: V3, q: V3): V3 => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
const v3len = (p: V3) => Math.hypot(p[0], p[1], p[2]);

/** Closed fold of the gable-end gusset: centre halves on the end wall, tucks on the diagonals. */
export interface GussetFolds {
  /** Centre half-triangles, folded inward about the end wall's top crease (deg). */
  half: number;
  /** Outer triangles, folded back (toward the printed side) about the diagonal creases (deg). */
  tuck: number;
  /** Tuck stack offset and pivot depth (calipers): together they drop it clear under the roof. */
  tuckStack: number;
  tuckPivot: number;
  /** How far the tucks' ridge corner sits inside the end plane (mm). */
  recess: number;
}

/**
 * Closed fold of the gusset of a gable end `2a` wide whose top strip is `h` tall (the roof
 * panel length), under 45° roof panels of caliper `t` hinged on the front / back wall tops.
 * End frame: e along the end wall's top edge (from its centre N toward the front corner A),
 * n inward (toward the other end), z up; the roof's printed surface is the plane e + z = a.
 *  - The centre halves tilt inward about the wall top until their apex M (on the sheet, the
 *    top centre of the strip) sits under the ridge, just inside the roof board.
 *  - Each tuck (A, M, D) folds back about the diagonal A–M until its far corner D is back on
 *    the end plane (n = 0): its outer edge A–D runs along the roof's end edge, as on the
 *    sheet where it is the tube corner continued up the top strip.
 *  - A stack offset plus a pivot depth then slide the tuck straight down from the roof (along
 *    the roof normal) until its back surface clears the roof's inside by `gap`.
 */
export function gussetFolds(a: number, h: number, t: number, gap = GUSSET_CLEARANCE_MM, drop = GUSSET_APEX_DROP_MM): GussetFolds {
  const roofOut: V3 = [Math.SQRT1_2, 0, Math.SQRT1_2];
  const A: V3 = [a, 0, 0];
  const pose = (half: number) => {
    const M: V3 = [0, h * Math.sin(half), h * Math.cos(half)];
    const nHalf: V3 = [0, -Math.cos(half), Math.sin(half)]; // printed side: out and up
    // Flat, D lies in the half's plane beyond the diagonal, straight above A on the sheet.
    const Dflat = v3add(A, v3scale(M, 1));
    const axis = v3scale(v3sub(M, A), 1 / v3len(v3sub(M, A)));
    const rotate = (p: V3, ang: number): V3 => {
      const q = v3sub(p, A);
      const c = Math.cos(ang);
      const sn = Math.sin(ang);
      return v3add(A, v3add(v3add(v3scale(q, c), v3scale(v3cross(axis, q), sn)), v3scale(axis, v3dot(axis, q) * (1 - c))));
    };
    // Rotation sense that swings D out over the half's printed side, toward the roof.
    const dir = v3dot(v3sub(rotate(Dflat, 0.05), Dflat), nHalf) > 0 ? 1 : -1;
    // The fold that brings D furthest out toward the end plane (golden-section search).
    const nOf = (ang: number) => rotate(Dflat, dir * ang)[1];
    let lo = (60 * Math.PI) / 180;
    let hi = (170 * Math.PI) / 180;
    for (let i = 0; i < 80; i++) {
      const m1 = hi - (hi - lo) * 0.618;
      const m2 = lo + (hi - lo) * 0.618;
      if (nOf(m1) < nOf(m2)) hi = m2;
      else lo = m1;
    }
    const psi = (lo + hi) / 2;
    return { M, nHalf, axis, psi, D: rotate(Dflat, dir * psi) };
  };
  // Inward tilt of the halves at which the tucks just reach the end plane (tangent): a
  // shallower tilt would swing D out past the end, a steeper one leaves a slot under the roof.
  let lo = (35 * Math.PI) / 180;
  let hi = (55 * Math.PI) / 180;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (pose(mid).D[1] < TUCK_INSET_MM) lo = mid;
    else hi = mid;
  }
  // …and at least steep enough for the apex to clear the roof board at the ridge.
  // (The apex goes GUSSET_APEX_DROP_MM under the roof's inside: the half's diagonal edge then
  // runs clearly below the roof's printed surface instead of grazing it, which z-fights.)
  const inside = a - (t + drop) * Math.SQRT2;
  const half = Math.max(hi, Math.acos(Math.min(1, inside / h)));
  const { M, nHalf, psi, D } = pose(half);
  let nTuck = v3cross(v3sub(M, A), v3sub(D, A));
  nTuck = v3scale(nTuck, 1 / v3len(nTuck));
  if (v3dot(nTuck, roofOut) > 0) nTuck = v3scale(nTuck, -1); // printed side faces away from the roof
  // Drop the tuck away from the roof along u: across the hinge axis (the only shifts a stack
  // offset and a pivot depth can make) with no n part (its outer edge stays on the end plane).
  let u: V3 = [M[2], 0, a];
  u = v3scale(u, 1 / v3len(u));
  const cu = v3dot(roofOut, u);
  // Back surface (t behind the printed side, toward the roof) of the highest corner ≤ inside.
  const top = Math.max(...[A, M, D].map((p) => v3dot(roofOut, p)));
  const roofInside = a * Math.SQRT1_2 - t; // roof's inside surface, along roofOut
  const k = Math.max(0, (top - t * v3dot(roofOut, nTuck) - (roofInside - gap)) / cu);
  // T = α·nTuck + β·nHalf, with α = (stack + pivot)·t and β = −pivot·t (see fold.ts poses).
  const T = v3scale(u, -k);
  const c = v3dot(nTuck, nHalf);
  const tn = v3dot(T, nTuck);
  const th = v3dot(T, nHalf);
  const alpha = (tn - c * th) / (1 - c * c);
  const beta = (th - c * tn) / (1 - c * c);
  const pivot = t > 0 ? -beta / t : 0;
  const stack = t > 0 ? alpha / t - pivot : 0;
  // Toward the printed side (the tuck turns back over the half's outside): a negative fold.
  return { half: deg(half), tuck: -deg(psi), tuckStack: stack, tuckPivot: pivot, recess: D[1] };
}

/**
 * Gable-end gusset of a gable-top carton. The end panel's top strip (as tall as the roof
 * panels beside it) carries two diagonal creases from the end wall's top corners up to the
 * centre of the strip's top edge, and a vertical centre crease. Closed, the two centre
 * half-triangles tilt inward together (the recessed triangle seen at each end, its apex under
 * the fin) and the two outer triangles (tucks) fold back along the diagonals under the roof
 * panels, so the gable opening between the roof edges is closed with no gap.
 */
function gableGussets(b: DielineBuilder, w: Walls, Wp: number, h: number, folds: GussetFolds, joins: Segment[]) {
  for (const side of ["left", "right"] as const) {
    const r = w[side];
    const A = pt(r.x, r.y);
    const N = pt(r.x + Wp / 2, r.y);
    const B = pt(r.x + Wp, r.y);
    const M = pt(r.x + Wp / 2, r.y - h);
    const D = pt(r.x, r.y - h);
    const C = pt(r.x + Wp, r.y - h);
    const ha = `gusset_${side}_a`;
    const hb = `gusset_${side}_b`;
    b.attachPoly(ha, side, side, [A, N], [A, N, M], { fold: folds.half, stage: 2, label: "Gable gusset" });
    // Centre crease: the second half hangs on the first along it (flat when sealed: the two
    // halves make one recessed triangle), its wall-top edge is the same crease continued.
    // As a hinge the centre crease renders as a printed fold, not a cut seam between halves.
    b.attachPoly(hb, side, ha, [N, M], [N, B, M], { fold: 0, stage: 2, label: "Gable gusset" });
    joins.push({ a: N, b: B });
    const tuck = { fold: folds.tuck, stage: 2, stack: folds.tuckStack, pivotDepth: folds.tuckPivot, label: "Gusset tuck" };
    b.attachPoly(`${ha}_tuck`, side, ha, [A, M], [A, M, D], tuck);
    b.attachPoly(`${hb}_tuck`, side, hb, [M, B], [M, B, C], tuck);
    // Tube corners continued up the top strip: tuck ↔ roof panel where they meet on the sheet.
    if (side === "left") joins.push({ a: B, b: C });
    else joins.push({ a: A, b: D }, { a: B, b: C });
  }
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
  const w = tube4(b, Lp, Wp, Hp, LS_STRIP_MM);
  const joins: Segment[] = [];
  for (const side of ["front", "back"] as const) {
    const r = w[side];
    const roofId = `roof_${side}`;
    b.attach(roofId, "top", side, rectEdges(r).top, roofLen, { kind: "rect" }, { fold: roofAngle, stage: 2, label: "Roof panel" });
    const roofTop = { a: pt(r.x, r.y - roofLen), b: pt(r.x + Lp, r.y - roofLen) };
    b.attach(`fin_${side}`, "top", roofId, [roofTop.a, roofTop.b], GABLE_FIN_MM, { kind: "rect" }, { fold: -roofAngle, stage: 2, label: "Top seal fin" });
  }
  gableGussets(b, w, Wp, roofLen, gussetFolds(Wp / 2, roofLen, t), joins);
  sealedBottom(b, w, t, Wp, 4);
  return {
    builder: b,
    closedRotation: IDENTITY,
    joins,
    faces: (panels, computed) => {
      const { top: _top, ...rest } = computed;
      void _top;
      // The back seal flap shows on the underside beside the front one (R5-3Q-D-06).
      const bottom = withLiftedParts(rest, { panels, rootId: b.rootId, thicknessMm: t, closedRotation: IDENTITY }, "bottom", ["bottom_back"]);
      // Gable ends: the end wall and its whole top strip carry the end artwork, printed
      // contiguously on the sheet: the gusset halves (the recessed triangle seen between the
      // roof edges) and the tucks, whose printed side is the ceiling of that pocket.
      const end = (side: "left" | "right") => blockFace(side, panels, [side, ...["a", "b"].flatMap((k) => [`gusset_${side}_${k}`, `gusset_${side}_${k}_tuck`])])!;
      return {
        ...bottom,
        front: blockFace("front", panels, ["fin_front", "roof_front", "front"])!,
        back: blockFace("back", panels, ["fin_back", "roof_back", "back"])!,
        left: end("left"),
        right: end("right"),
      };
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
  // Front flap one caliper above the back flap it overlaps (both show from above, both printed).
  b.attach("top_back", "flap", "back", rectEdges(w.back).top, Wp / 2 + fin, { kind: "rect" }, { stage: 1, label: "Top seal flap" });
  b.attach("top", "top", "front", rectEdges(w.front).top, Wp / 2 + fin, { kind: "rect" }, { stage: 2, stack: 1, label: "Top seal flap" });
  b.attach("bottom_back", "flap", "back", rectEdges(w.back).bottom, Wp / 2 + fin, { kind: "rect" }, { stage: 1, stack: -1, label: "Bottom seal flap" });
  b.attach("bottom", "bottom", "front", rectEdges(w.front).bottom, Wp / 2 + fin, { kind: "rect" }, { stage: 2, label: "Bottom seal flap" });
  // Top ears: the sealed top flattens into a triangular ear at each side that is folded down
  // flat onto the side panel, printed side out. Each ear is two halves, one on the side edge
  // of each top seal flap (front half on the front flap, back half on the back flap), meeting
  // on the centre line. Bottom ears fold under the base.
  const topBack = rect(w.back.x, w.back.y - (Wp / 2 + fin), Lp, Wp / 2 + fin);
  const topFront = rect(w.front.x, w.front.y - (Wp / 2 + fin), Lp, Wp / 2 + fin);
  const half = Wp / 2;
  const ear = (id: string, flap: string, r: typeof topFront, side: "left" | "right", stack: number) => {
    // Flap rect: its hinge (front/back wall top) is the bottom edge, the centre line `half` above.
    const x = side === "left" ? r.x : r.x + r.width;
    const corner = pt(x, r.y + r.height);
    const centre = pt(x, r.y + r.height - half);
    const out = side === "left" ? -1 : 1;
    const apex = pt(x + out * half, r.y + r.height - half);
    b.attachPoly(id, "ear", flap, [corner, centre], [corner, centre, apex], { fold: 90, stage: 3, stack, label: "Top ear" });
  };
  for (const side of ["left", "right"] as const) {
    // One caliper out from the side panel they lie on.
    ear(`ear_top_${side}`, "top", topFront, side, 1);
    ear(`ear_topBack_${side}`, "top_back", topBack, side === "left" ? "right" : "left", 1);
    const r = w[side];
    const botEar: Polygon = [pt(r.x, r.y + r.height), pt(r.x + r.width, r.y + r.height), pt(r.x + r.width / 2, r.y + r.height + Wp / 2)];
    b.attachPoly(`ear_bottom_${side}`, "ear", side, rectEdges(r).bottom, botEar, { fold: 90, stage: 3, stack: 1, label: "Bottom ear" });
  }
  return {
    builder: b,
    closedRotation: IDENTITY,
    faceDepthTol: t + 0.2,
    // From above both seal flaps show (the front one overlaps the back one by the fin): print both.
    // Underneath, the back seal flap shows beside the front one and the ears (R5-3Q-D-06).
    faces: (panels, computed) => {
      const input = { panels, rootId: b.rootId, thicknessMm: t, closedRotation: IDENTITY };
      return withLiftedParts(withDeepParts(computed, input, "top", ["top", "top_back"], 2 * t + 0.2), input, "bottom", ["bottom_back"], t + 0.2);
    },
  };
}
