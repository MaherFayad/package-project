import { Euler, Quaternion } from "three";
import type { Dims, StructureFeatures } from "@/types";
import { DielineBuilder, insetSeg, rectEdges } from "../../builder";
import { cutWindow, notchPanel, stadium } from "../../features";
import { bboxOf, clamp, dist, pt, rectPolygon } from "../../geometry";
import type { StructureDraft } from "../../structures";
import type { DielinePanel, Polygon, Pt, Rect } from "../../types";

/**
 * FEFCO group 04 construction kit.
 *
 * Every 04 style is a single blank whose BASE is hinged to the walls and (optionally) the
 * cover. They differ in: which walls are rolled double, where the corner ears sit (on the
 * long walls or on the end walls), whether the rolled walls end in interior bottom flaps,
 * how the top is closed (none, flaps from the walls, or a hinged lid with tuck / front flap
 * / side flaps), and display cut-downs. `trayKit` combines these options; each catalogue
 * entry is one option set.
 *
 * Layout before the final 180° in-plane turn (same convention as the core trayWithLid):
 *
 *                 [ lid ]               (hinged on the back wall)
 *                 [ back ]
 *   [ right end ] [ base ] [ left end ]
 *                 [ front ]
 *
 * Thickness compensation (inner dims in, panel sizes out): the base is inner + the board
 * layers that stand inside it at each wall; walls are H + base (+ cover layers).
 */

export type WallKey = "front" | "back" | "ends";

export type TopClosure =
  | { kind: "none" }
  /** Cover flaps on the far edge of the long walls ("long") or end walls ("ends"). */
  | { kind: "flaps"; on: "long" | "ends"; overlap: "meet" | "full" | "rim" }
  /** Lid hinged on the back wall. */
  | {
      kind: "lid";
      front: "tuck" | "flap" | "none";
      sides: "dust" | "rounded" | "outside" | "none";
      /** Tuck depth as a share of the front wall height. */
      tuckRatio?: number;
    };

export interface TrayKitOpts {
  /** Rolled double walls. */
  double?: Partial<Record<WallKey, boolean>>;
  /** Corner ears on the long walls (fold onto the ends) or on the end walls (fold onto the long walls). */
  ears: "long" | "ends" | "none";
  /** Interior bottom flaps at the foot of rolled walls (only where the wall is double). */
  bottomFlaps?: Partial<Record<WallKey, boolean>>;
  top: TopClosure;
  /** Lowered display front (front wall cut down between corner posts). */
  displayFront?: boolean;
  /** Raised back header for display, as a share of H. */
  header?: number;
  /** End walls taller than the long walls (raised panels), as a share of H. */
  raisedEnds?: number;
  /** Hand holes in the end walls (also cut through the rolled inner end wall). */
  handHoles?: boolean;
  /** Corner ears are glued (gluer) rather than trapped: geometry identical, metadata only. */
  gluedEars?: boolean;
}

export const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];
export const quat = (x: number, y: number, z: number): [number, number, number, number] => {
  const q = new Quaternion().setFromEuler(new Euler(x, y, z, "YXZ"));
  return [q.x, q.y, q.z, q.w];
};
export const TILT_UP = quat(Math.PI / 2, 0, 0);
export const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

/** The two outline points of a rectangular child panel opposite its hinge, ordered like the hinge. */
export function farPoints(p: DielinePanel): [Pt, Pt] {
  const h = p.hinge!;
  const others = p.polygon.filter((q) => dist(q, h.a) > 1e-6 && dist(q, h.b) > 1e-6);
  if (others.length !== 2) throw new Error(`farPoints: ${p.id} is not a 4-gon`);
  const [u, v] = others;
  return dist(u, h.a) <= dist(v, h.a) ? [u, v] : [v, u];
}

/** Turn every panel 180° in the sheet plane (front ends up on top of the sheet). */
export function turn180(b: DielineBuilder) {
  for (const panel of b.panels) {
    panel.polygon = panel.polygon.map((q) => pt(-q.x, -q.y));
    if (panel.hinge) panel.hinge = { a: pt(-panel.hinge.a.x, -panel.hinge.a.y), b: pt(-panel.hinge.b.x, -panel.hinge.b.y) };
    if (panel.holes) panel.holes = panel.holes.map((h) => h.map((q) => pt(-q.x, -q.y)));
    panel.bbox = bboxOf(panel.polygon);
  }
}

/** Board layers stacked at each wall once the tray is closed. */
export function layersOf(o: TrayKitOpts) {
  const d = o.double ?? {};
  return {
    ends: 1 + (o.ears === "long" ? 1 : 0) + (d.ends ? 1 : 0),
    front: 1 + (o.ears === "ends" ? 1 : 0) + (d.front ? 1 : 0),
    back: 1 + (o.ears === "ends" ? 1 : 0) + (d.back ? 1 : 0),
  };
}

/** Cover layers on top of the walls (adds to the wall height). */
function coverLayers(top: TopClosure): number {
  if (top.kind === "lid") return 1;
  if (top.kind === "flaps") return top.overlap === "full" ? 2 : 1;
  return 0;
}

interface WallInfo {
  id: "front" | "back" | "right" | "left";
  key: WallKey;
  rect: Rect;
  /** Outline edge on the base (hinge). */
  baseEdge: [Pt, Pt];
  /** Outline edge opposite the base (rim). */
  farEdge: [Pt, Pt];
  /** Side edges as [rim point, base point]. */
  sides: [[Pt, Pt], [Pt, Pt]];
  height: number;
}

export function trayKit(dims: Dims, t: number, o: TrayKitOpts, f: StructureFeatures = {}): StructureDraft {
  const d = o.double ?? {};
  const bf = o.bottomFlaps ?? {};
  const lay = layersOf(o);
  const cover = coverLayers(o.top);
  const Lp = dims.L + 2 * lay.ends * t;
  const Wp = dims.W + (lay.front + lay.back) * t;

  // Wall heights. Flap covers only raise the walls that carry them; the others stop under the flaps.
  const Hbase = dims.H + t;
  const flapsOn = o.top.kind === "flaps" ? o.top.on : null;
  const hLong = Hbase + (o.top.kind === "lid" || flapsOn === "long" ? cover * t : 0);
  const hEnds = Hbase + (o.top.kind === "lid" || flapsOn === "ends" ? cover * t : 0);
  const Hf = o.top.kind === "lid" ? Hbase + t : hLong;
  const Hb = (o.top.kind === "lid" ? Hbase + t : hLong) + (o.header ? dims.H * o.header : 0);
  const He = hEnds + (o.raisedEnds ? dims.H * o.raisedEnds : 0);

  const b = new DielineBuilder();
  const base = rect(0, 0, Lp, Wp);
  b.root("base", "bottom", rectPolygon(0, 0, Lp, Wp), "Base");

  const backR = rect(0, -Hb, Lp, Hb);
  const frontR = rect(0, Wp, Lp, Hf);
  const rightR = rect(-He, 0, He, Wp);
  const leftR = rect(Lp, 0, He, Wp);
  const E = (r: Rect) => rectEdges(r);
  const walls: WallInfo[] = [
    { id: "back", key: "back", rect: backR, baseEdge: E(base).top, farEdge: E(backR).top, sides: [[E(backR).left[0], E(backR).left[1]], [E(backR).right[0], E(backR).right[1]]], height: Hb },
    { id: "front", key: "front", rect: frontR, baseEdge: E(base).bottom, farEdge: E(frontR).bottom, sides: [[E(frontR).left[1], E(frontR).left[0]], [E(frontR).right[1], E(frontR).right[0]]], height: Hf },
    // Turned 180° at the end: the panel on the sheet's left becomes the box's right end.
    { id: "right", key: "ends", rect: rightR, baseEdge: E(base).left, farEdge: E(rightR).left, sides: [[E(rightR).top[0], E(rightR).top[1]], [E(rightR).bottom[0], E(rightR).bottom[1]]], height: He },
    { id: "left", key: "ends", rect: leftR, baseEdge: E(base).right, farEdge: E(leftR).right, sides: [[E(leftR).top[1], E(leftR).top[0]], [E(leftR).bottom[1], E(leftR).bottom[0]]], height: He },
  ];
  const wall = (id: WallInfo["id"]) => walls.find((w) => w.id === id)!;

  // ── fold order (stages), as the blank is erected by hand:
  //   ear-owning walls with their ears folded in → receiving walls rise outside the ears →
  //   rolled inner walls (end walls first, long walls tuck between them) with their
  //   interior bottom flaps → lid side flaps that go inside → lid with its tuck → flaps that wrap outside.
  // Without ears every wall rises together. Stage numbers are compact (no idle pauses).
  const hasEars = o.ears !== "none";
  const ownsEars = (key: WallKey) => (o.ears === "long" ? key !== "ends" : o.ears === "ends" ? key === "ends" : false);
  // Ears fold in while their wall rises; the receiving walls then rise outside them.
  const wallStage = (key: WallKey) => (!hasEars || ownsEars(key) ? 0 : 1);
  const EAR_STAGE = 0;
  const anyInner = walls.some((w) => d[w.key] && !(w.id === "front" && o.displayFront));
  const innerEnds = !!d.ends;
  const innerLong = !!(d.front && !o.displayFront) || !!d.back;
  const innerBase = hasEars ? 2 : 1;
  const innerStage = (key: WallKey) => innerBase + (key !== "ends" && innerEnds ? 1 : 0);
  const topBase = anyInner ? innerBase + (innerEnds && innerLong ? 2 : 1) : hasEars ? 2 : 1;

  // ── walls
  for (const w of walls) {
    if (w.id === "front" && o.displayFront) {
      const fr = b.frame("base", w.baseEdge);
      const corner = Math.min(25, Lp * 0.15);
      const drop = Hf * 0.5;
      const slope = Math.min(drop, (Lp - 2 * corner) * 0.2);
      const poly: Polygon = [fr.at(fr.a, 0, 0), fr.at(fr.a, Lp, 0), fr.at(fr.a, Lp, Hf), fr.at(fr.a, Lp - corner, Hf), fr.at(fr.a, Lp - corner - slope, Hf - drop), fr.at(fr.a, corner + slope, Hf - drop), fr.at(fr.a, corner, Hf), fr.at(fr.a, 0, Hf)];
      b.attachPoly("front", "front", "base", [fr.a, fr.b], poly, { stage: wallStage("front"), label: "Display front" });
      continue;
    }
    b.attach(w.id, w.id, "base", w.baseEdge, w.height, { kind: "rect" }, { stage: wallStage(w.key), label: `${w.id[0].toUpperCase()}${w.id.slice(1)} wall` });
  }

  // ── corner ears: fold onto the inside of the neighbouring wall
  const earOwners = o.ears === "long" ? walls.filter((w) => w.key !== "ends") : o.ears === "ends" ? walls.filter((w) => w.key === "ends") : [];
  for (const w of earOwners) {
    const neighbourH = w.key === "ends" ? Math.min(Hf, Hb) : He;
    const span = w.key === "ends" ? Lp : Wp;
    // End-wall ears lie along the long walls on the sheet: keep them shorter than those walls
    // so they never run into the lid side flaps or cover flaps hinged beyond them.
    const earD = clamp(span * 0.38, 10, w.key === "ends" ? Math.min(110, Math.min(Hf, Hb) - 2) : 160);
    w.sides.forEach(([rim, basePt], i) => {
      const h = Math.min(w.height, neighbourH) - 0.5;
      const k = h / dist(rim, basePt);
      const rimPt = pt(basePt.x + (rim.x - basePt.x) * k, basePt.y + (rim.y - basePt.y) * k);
      const taper = Math.min(earD * 0.5, h * 0.3);
      b.attach(`ear_${w.id}_${i}`, "ear", w.id, [rimPt, basePt], earD, { kind: "trapezoid", taperA: taper, taperB: 1 }, { stage: EAR_STAGE, stack: -1, label: o.gluedEars ? "Glue ear" : "Locking ear" });
    });
  }
  const earsTrappedBy = (key: WallKey) => (key === "ends" ? o.ears === "long" : o.ears === "ends");

  // ── rolled inner walls and interior bottom flaps
  for (const w of walls) {
    if (!d[w.key]) continue;
    if (w.id === "front" && o.displayFront) continue;
    const across = w.key === "ends" ? (lay.front + lay.back) / 2 : lay.ends;
    const inset = across * t + 0.5;
    const withFlap = !!bf[w.key];
    // With a bottom flap the inner wall stops one caliper (+0.1 mm) above the base's inner face so
    // the flap, folded flat, rests ON the base instead of sinking into it.
    const depth = w.height - (withFlap ? 2 * t + 0.1 : 2 * t + 0.5);
    const inner = b.attach(`${w.id}Inner`, "inner", w.id, insetSeg(w.farEdge, inset), Math.max(5, depth), { kind: "rect" }, {
      fold: 180,
      pivotDepth: earsTrappedBy(w.key) ? 1.5 : 1,
      stage: innerStage(w.key),
      label: "Inner wall",
    });
    if (withFlap) {
      const span = w.key === "ends" ? Lp : Wp;
      const fd = clamp(span * 0.25, 10, w.key === "ends" ? 80 : 60);
      const hingeLen = dist(inner.hinge!.a, inner.hinge!.b);
      // 45° mitred ends (+1 mm + 2 calipers clearance for the inset hinges): neighbouring interior flaps meet on the corner diagonal
      // instead of overlapping in the same plane (z-fighting).
      const taper = Math.min(fd + 1 + 2 * t, hingeLen * 0.45);
      b.attach(`${w.id}BottomFlap`, "flap", inner.id, farPoints(inner), fd, { kind: "trapezoid", taperA: taper, taperB: taper }, {
        fold: -90,
        // Folded square just before the inner wall rolls in, so it lands on the base instead of sweeping through it.
        stage: innerStage(w.key) - 1,
        stack: 0,
        label: "Interior bottom flap",
      });
    }
  }

  // ── top closure
  let outsideFlaps = false;
  const top = o.top;
  if (top.kind === "flaps") {
    const owners = top.on === "long" ? [wall("front"), wall("back")] : [wall("right"), wall("left")];
    const span = top.on === "long" ? Wp : Lp;
    owners.forEach((w, i) => {
      const depth = top.overlap === "full" ? span - 2 * t : top.overlap === "meet" ? span / 2 - 1 : span * 0.22;
      b.attach(`cover_${w.id}`, "flap", w.id, w.farEdge, depth, { kind: "rect" }, {
        stage: topBase + (top.overlap === "full" ? 1 - i : 0),
        stack: top.overlap === "full" ? -i : 0,
        label: top.overlap === "rim" ? "Rim flap" : "Cover flap",
      });
    });
  } else if (top.kind === "lid") {
    const back = wall("back");
    const lidR = rect(0, -Hb - Wp, Lp, Wp);
    b.attach("top", "top", "back", back.farEdge, Wp, { kind: "rect" }, { stage: topBase + 1, label: "Lid" });
    if (top.front === "tuck") {
      const tuckD = Math.max(8, (Hf - 2 * t - 2) * (top.tuckRatio ?? 0.7));
      b.attach("lidTuck", "tuck", "top", insetSeg(E(lidR).top, lay.ends * t + 1), tuckD, { kind: "tuck", shoulder: 2 }, { stage: topBase + 1, stack: -lay.front, label: "Lid tuck" });
    } else if (top.front === "flap") {
      outsideFlaps = true;
      b.attach("lidFront", "flap", "top", E(lidR).top, Math.max(10, Hf * 0.45), { kind: "rect" }, { stage: topBase + 2, stack: 1, label: "Lid front flap" });
    }
    if (top.sides !== "none") {
      const outside = top.sides === "outside";
      outsideFlaps ||= outside;
      const inset = outside ? 0 : lay.front * t + 1;
      const dd = outside ? Math.max(10, He * 0.45) : Math.max(6, He - 2 * t - 2);
      const taper = top.sides === "rounded" ? Math.min(dd * 0.9, Wp * 0.4) : outside ? 0 : Math.min(dd * 0.6, Wp * 0.3);
      for (const [id, edge] of [["lidSideR", E(lidR).left], ["lidSideL", E(lidR).right]] as const) {
        b.attach(id, "dust", "top", insetSeg(edge, inset), dd, { kind: "trapezoid", taperA: taper, taperB: outside ? 0 : 2 }, {
          // Inside flaps fold square first and slide inside the end walls; outside flaps wrap over after the lid.
          stage: outside ? topBase + 2 : topBase,
          stack: outside ? 1 : -lay.ends,
          label: outside ? "Lid side flap (outside)" : "Lid side flap",
        });
      }
    }
  }

  // ── hand holes in the end walls (and their rolled inner walls)
  if ((o.handHoles || f.handle) && top.kind !== "lid") {
    for (const w of [wall("right"), wall("left")]) {
      const p = b.byId(w.id);
      const [ra, rb] = w.farEdge;
      const mid = pt((ra.x + rb.x) / 2, (ra.y + rb.y) / 2);
      const hw = Math.min(80, Wp * 0.45);
      const hh = Math.min(26, w.height * 0.25);
      if (hw < 35 || hh < 14) continue;
      const off = hh / 2 + Math.max(10, w.height * 0.12);
      const sign = w.id === "right" ? 1 : -1; // toward the base
      p.holes = [...(p.holes ?? []), stadium(mid.x + sign * off, mid.y, hh, hw, false)];
      const inner = b.panels.find((q) => q.id === `${w.id}Inner`);
      if (inner) inner.holes = [...(inner.holes ?? []), stadium(mid.x - sign * off, mid.y, hh, hw, false)];
    }
  }

  turn180(b);

  // ── features in final sheet coordinates
  if (f.window && top.kind === "lid") cutWindow(b, "top", f.window, { margin: Math.max(12, lay.ends * t + 8) });
  if (f.thumbNotch && top.kind === "none" && !o.displayFront) {
    const fr = b.byId("front");
    notchPanel(fr, farPoints(fr), Math.min(18, Lp * 0.1));
  }

  return { builder: b, closedRotation: TILT_UP, ...(outsideFlaps ? { faceDepthTol: t + 0.5 } : {}) };
}
