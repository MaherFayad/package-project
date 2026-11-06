import { DielineBuilder, insetSeg, rectEdges } from "../../builder";
import { clamp, pt, rectPolygon } from "../../geometry";
import type { Polygon, Pt, Rect } from "../../types";
import type { TuckLock } from "./types";

/**
 * Closure and tube helpers for ECMA group A cartons (longitudinal glue seam).
 *
 * Sheet layout (seen from the printed side, x right, y down):
 *   glue | left (W) | front (L) | right (W) | back (L)
 * The front panel is the root, so with an identity closed rotation the front faces the viewer.
 * Thickness compensation follows the engine convention: crease-to-crease = inner + layers × t.
 */

export type WallId = "front" | "back" | "left" | "right";
export type Walls = Record<WallId, Rect>;
export type End = "top" | "bottom";

export const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

/** Glue flap width, ECMA practice 12–15 mm, narrower on tiny cartons. */
export const glueWidth = (W: number, override?: number) => clamp(override ?? W * 0.3, 8, 20);

/** Default tuck depth (ECMA practice ≈ 1/3 of the closure depth + 5 mm, 10..30 mm). */
export function tuckDepth(Wp: number, Hp: number, override?: number): number {
  const d = override ?? clamp(Wp * 0.35 + 5, 10, 30);
  return clamp(d, 6, Math.max(6, Hp * 0.45));
}

/** Glue | left | front | right | back tube. Returns the wall rects (y from `y0`). */
export function tube(b: DielineBuilder, Lp: number, Wp: number, Hp: number, g: number, y0 = 0, prefix = ""): Walls {
  const xL = g;
  const xF = xL + Wp;
  const xR = xF + Lp;
  const xB = xR + Wp;
  const w: Walls = { left: rect(xL, y0, Wp, Hp), front: rect(xF, y0, Lp, Hp), right: rect(xR, y0, Wp, Hp), back: rect(xB, y0, Lp, Hp) };
  const id = (s: string) => prefix + s;
  b.root(id("front"), "front", rectPolygon(w.front.x, w.front.y, Lp, Hp), "Front");
  b.attach(id("left"), "left", id("front"), rectEdges(w.front).left, Wp, { kind: "rect" }, { stage: 0, label: "Left side" });
  b.attach(id("right"), "right", id("front"), rectEdges(w.front).right, Wp, { kind: "rect" }, { stage: 0, label: "Right side" });
  b.attach(id("back"), "back", id("right"), rectEdges(w.right).right, Lp, { kind: "rect" }, { stage: 0, label: "Back" });
  b.attach(id("glue"), "glue", id("left"), rectEdges(w.left).left, g, { kind: "trapezoid", taperA: Math.min(g * 0.6, Hp * 0.2), taperB: Math.min(g * 0.6, Hp * 0.2) }, {
    stage: 0,
    stack: -1,
    label: "Glue flap",
  });
  return w;
}

const endEdge = (r: Rect, where: End): [Pt, Pt] => (where === "top" ? rectEdges(r).top : rectEdges(r).bottom);

/** Two dust flaps (on the side panels) of a tuck closure. */
export function dustFlaps(b: DielineBuilder, w: Walls, where: End, Lp: number, Wp: number, stage = 1) {
  const dustD = Math.min(Wp * 0.8, Lp * 0.45);
  const taper = Math.min(dustD * 0.4, Wp * 0.3);
  for (const [side, r] of [["L", w.left], ["R", w.right]] as const) {
    b.attach(`${where}Dust${side}`, "dust", side === "L" ? "left" : "right", endEdge(r, where), dustD, { kind: "trapezoid", taperA: taper * 0.5, taperB: taper }, {
      stage,
      stack: -1,
      label: "Dust flap",
    });
  }
}

/** Slit lock: two short cuts just inside the tuck crease ends (catch on the dust flaps). */
function slitLocks(b: DielineBuilder, lidId: string, far: [Pt, Pt], inset: number, Lp: number) {
  const lid = b.byId(lidId);
  const f = b.frame(lidId, far);
  // `out` points away from the lid (toward the tuck): slits sit 0.4 mm on the lid side.
  const sl = Math.min(8, Lp * 0.12);
  const slit = (from: number): Polygon => [f.at(f.a, from, -0.4), f.at(f.a, from + sl, -0.4), f.at(f.a, from + sl, -0.9), f.at(f.a, from, -0.9)];
  lid.holes = [...(lid.holes ?? []), slit(inset + 1), slit(f.length - inset - 1 - sl)];
}

/**
 * Board layer a tuck sits on. A closure hinged on the front tucks into the back wall, where
 * the glue flap is already laminated (glue | left | front | right | back: the glue flap folds
 * onto the inside of the back), so that tuck sits one caliper further in (no z-fighting).
 */
export const tuckStackFor = (owner: "front" | "back") => (owner === "front" ? -2 : -1);

/**
 * Tuck closure: closure panel (lid) hinged on `owner`, tuck flap on the far edge, dust flaps
 * on the side panels. Closure + dust = two board layers at that end.
 */
export function tuckClosure(
  b: DielineBuilder,
  w: Walls,
  where: End,
  owner: "front" | "back",
  t: number,
  Lp: number,
  Wp: number,
  Hp: number,
  o: { tuckDepthMm?: number; lock?: TuckLock; dust?: boolean; tuckStack?: number } = {},
) {
  const tuckD = tuckDepth(Wp, Hp, o.tuckDepthMm);
  const ownerRect = w[owner];
  const lidY = where === "top" ? ownerRect.y - Wp : ownerRect.y + Hp;
  const lid = rect(ownerRect.x, lidY, Lp, Wp);
  b.attach(where, where, owner, endEdge(ownerRect, where), Wp, { kind: "rect" }, { stage: 2, label: where === "top" ? "Top closure" : "Bottom closure" });
  const far = where === "top" ? rectEdges(lid).top : rectEdges(lid).bottom;
  const inset = t + 0.5;
  b.attach(`${where}Tuck`, "tuck", where, insetSeg(far, inset), tuckD, { kind: "tuck", shoulder: 1 }, { stage: 2, stack: o.tuckStack ?? tuckStackFor(owner), label: "Tuck flap" });
  if (o.lock === "slit") slitLocks(b, where, far, inset, Lp);
  if (o.dust !== false) dustFlaps(b, w, where, Lp, Wp);
}

/**
 * Seal end (ECMA A10 "full overlapping closure"): minor flaps on the side panels, then the
 * back major flap, then the front major flap on top; both majors span the full depth and are
 * glued together (three layers).
 */
export function sealEnd(b: DielineBuilder, w: Walls, where: End, t: number, Lp: number, Wp: number) {
  const minorD = Math.min(Lp * 0.45, Wp * 0.9);
  for (const side of ["left", "right"] as const) {
    b.attach(`${where}Minor_${side}`, "dust", side, insetSeg(endEdge(w[side], where), 0.5), minorD, { kind: "trapezoid", taperA: minorD * 0.15, taperB: minorD * 0.15 }, {
      stage: 1,
      stack: -2,
      label: "Minor flap",
    });
  }
  b.attach(`${where}Inner`, "flap", "back", insetSeg(endEdge(w.back, where), 0.5), Wp - t, { kind: "rect" }, { stage: 2, stack: -1, label: "Inner major flap (glued)" });
  b.attach(where, where, "front", endEdge(w.front, where), Wp, { kind: "rect" }, { stage: 3, stack: 0, label: "Outer major flap" });
}

/**
 * Crash-lock (automatic, pre-glued) bottom, ECMA A60: each flap has a 45° glue-assist crease
 * from its leading corner; the long-panel flaps carry a locking tongue past the centre line.
 */
export function crashLockBottom(b: DielineBuilder, w: Walls, t: number, Wp: number, Lp: number) {
  const h = Wp / 2;
  const e = Math.min(12, Wp * 0.22);
  // Both long flaps close flush on the outer bottom plane, meeting on the centre line; only
  // their locking tongues pass the centre and hook in ABOVE the opposite flap. The tongue is a
  // child on a virtual (`roll`: no crease, no cut) hinge one caliper further in, so the two
  // halves never share a plane (no z-fighting) and the whole bottom carries artwork.
  const long = (id: "front" | "back") => {
    const f = b.frame(id, rectEdges(w[id]).bottom);
    const L = f.length;
    const x1 = L * 0.28;
    const x2 = L * 0.62;
    const ch = Math.min(h - t, L * 0.3);
    const poly: Polygon = [f.at(f.a, 0, 0), f.at(f.a, L, 0), f.at(f.a, L, h - ch), f.at(f.a, L - ch, h), f.at(f.a, x2, h), f.at(f.a, x1, h), f.at(f.a, 0, h)];
    b.attachPoly(`bottom_${id}`, id === "front" ? "bottom" : "flap", id, [f.a, f.b], poly, { stage: 2, label: "Crash-lock flap" });
    const tongue: Polygon = [f.at(f.a, x2, h), f.at(f.a, x2 - e * 0.6, h + e), f.at(f.a, x1 + e * 0.6, h + e), f.at(f.a, x1, h)];
    b.attachPoly(`bottom_${id}Lock`, "tuck", `bottom_${id}`, [f.at(f.a, x1, h), f.at(f.a, x2, h)], tongue, { fold: 0, stage: 2, stack: -1, hingeKind: "roll", label: "Crash-lock tongue" });
    b.extraCreases.push({ a: f.at(f.a, 0, 0), b: f.at(f.a, Math.min(h, L * 0.45), Math.min(h, L * 0.45)) });
  };
  long("front");
  long("back");
  for (const side of ["left", "right"] as const) {
    const f = b.frame(side, rectEdges(w[side]).bottom);
    // Never reaches past the middle of the bottom, even when W > L.
    const d = Math.min(h - t, f.length * 0.48, Lp / 2 - t);
    const poly: Polygon = [f.at(f.a, 0, 0), f.at(f.a, f.length, 0), f.at(f.a, f.length - d * 0.3, d), f.at(f.a, d * 0.3, d)];
    b.attachPoly(`bottom_${side}`, "flap", side, [f.a, f.b], poly, { stage: 1, stack: -2, label: "Crash-lock glue flap" });
    b.extraCreases.push({ a: f.at(f.a, 0, 0), b: f.at(f.a, d, d) });
  }
}

/**
 * 1-2-3 snap-lock bottom, ECMA A55: (1) side dust flaps, (2) front flap with a centre slot,
 * (3) back flap whose two locking tabs push through the slot and catch.
 */
export function snapLockBottom(b: DielineBuilder, w: Walls, t: number, Wp: number, Lp: number) {
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
    const d = Wp * 0.5 + Math.min(8, Wp * 0.15) - t;
    const tab = Math.min(10, Wp * 0.18);
    const tw = Math.min(L * 0.18, 25);
    const ch = Math.min(d * 0.3, L * 0.12);
    const c = L / 2;
    const poly: Polygon = [f.at(f.a, 0, 0), f.at(f.a, L, 0), f.at(f.a, L, d - ch), f.at(f.a, L - ch, d), f.at(f.a, c + tw * 1.6, d), f.at(f.a, c + tw * 1.4, d + tab), f.at(f.a, c + tw * 0.5, d + tab), f.at(f.a, c + tw * 0.3, d), f.at(f.a, c - tw * 0.3, d), f.at(f.a, c - tw * 0.5, d + tab), f.at(f.a, c - tw * 1.4, d + tab), f.at(f.a, c - tw * 1.6, d), f.at(f.a, ch, d), f.at(f.a, 0, d - ch)];
    b.attachPoly("bottom_back", "bottom", "back", [f.a, f.b], poly, { stage: 3, stack: 0, label: "Bottom lock flap (3)" });
  }
}

/* ───────────────────────── hang holes ───────────────────────── */

/** Euro slot ("sombrero"): 30 × 5 mm slot with a Ø10 mm half-round at the top centre. */
export const EURO_SLOT = { slotWidth: 30, slotHeight: 5, domeDiameter: 10 } as const;
/** Round hang hole for peg hooks (prongs up to ~7 mm). */
export const ROUND_HOLE_DIAMETER = 8;

/**
 * Hang hole outline centred on x = cx, with its TOP (dome top / circle top) at y = top.
 * `flip` mirrors it vertically about y = top (for the folded-back tag layer).
 */
export function hangHolePolygon(kind: "euro" | "round", cx: number, top: number, scale = 1, flip = false): Polygon {
  const s = flip ? -1 : 1;
  const Y = (dy: number) => top + s * dy;
  if (kind === "round") {
    const r = (ROUND_HOLE_DIAMETER / 2) * scale;
    return Array.from({ length: 20 }, (_, i) => {
      const a = (i / 20) * Math.PI * 2;
      return pt(cx + Math.cos(a) * r, Y(r + Math.sin(a) * r * s));
    });
  }
  const hw = (EURO_SLOT.slotWidth / 2) * scale;
  const sh = EURO_SLOT.slotHeight * scale;
  const r = (EURO_SLOT.domeDiameter / 2) * scale;
  // Dome from y = 0 (top) to y = r; slot from y = r to y = r + sh.
  const arc: Pt[] = [];
  for (let k = 0; k <= 10; k++) {
    const a = (k / 10) * Math.PI; // right → over the top → left
    arc.push(pt(cx + Math.cos(a) * r, Y(r - Math.sin(a) * r)));
  }
  return [pt(cx - hw, Y(r + sh)), pt(cx + hw, Y(r + sh)), pt(cx + hw, Y(r)), ...arc, pt(cx - hw, Y(r))];
}

/** Total height of a hang hole (mm, unscaled). */
export const hangHoleHeight = (kind: "euro" | "round") => (kind === "round" ? ROUND_HOLE_DIAMETER : EURO_SLOT.domeDiameter / 2 + EURO_SLOT.slotHeight);
export const hangHoleWidth = (kind: "euro" | "round") => (kind === "round" ? ROUND_HOLE_DIAMETER : EURO_SLOT.slotWidth);
