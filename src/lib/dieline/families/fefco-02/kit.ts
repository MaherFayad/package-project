import { DielineBuilder, insetSeg, rectEdges, type FlapShape, type PanelOpts } from "../../builder";
import { stadium } from "../../features";
import { clamp, pt, rectPolygon } from "../../geometry";
import type { DielinePanel, PanelRole, Polygon, Pt, Rect } from "../../types";

/**
 * Construction kit for FEFCO group 02 slotted-type boxes.
 *
 * Sheet layout (viewed from the printed outside, y down), as the shared RSC generator:
 *   manufacturer's joint | front (L) | right (B) | back (L) | left (B)
 * The front wall is the root panel; walls fold +90° around it, flaps fold +90° over the
 * ends. FEFCO draws its layouts from the INSIDE; ours is the mirror image, which is the
 * same die seen from the print side.
 *
 * Panel sizes are crease-to-crease: inner + t per wall layer on each side, and
 * H + (top layers + bottom layers) × t for the wall height, so the folded inner space
 * equals the requested inner size.
 */

export type WallId = "front" | "right" | "back" | "left";
export type End = "top" | "bottom";
export type Walls = Record<WallId, Rect>;

export const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

/** Slot width between flaps: about two board calipers (FEFCO practice), 4–8 mm. */
export const slotWidth = (t: number) => clamp(2 * t + 2, 4, 8);

/** Glued manufacturer's joint width: 30–35 mm on corrugated, never more than 40% of H. */
export const jointWidth = (Hp: number) => Math.min(35, Math.max(15, Hp * 0.4));

export interface Ctx {
  b: DielineBuilder;
  t: number;
  Lp: number;
  Wp: number;
  Hp: number;
  slot: number;
  walls: Walls;
  /** Panel id of each wall (split walls use their main half). */
  wallIds: Record<WallId, string>;
}

/** Standard tube: joint | front | right | back | left. Front is the root. */
export function standardTube(Lp: number, Wp: number, Hp: number, t: number, opts: { joint?: boolean } = {}): Ctx {
  const b = new DielineBuilder();
  const j = jointWidth(Hp);
  const xF = j;
  const walls: Walls = {
    front: rect(xF, 0, Lp, Hp),
    right: rect(xF + Lp, 0, Wp, Hp),
    back: rect(xF + Lp + Wp, 0, Lp, Hp),
    left: rect(xF + 2 * Lp + Wp, 0, Wp, Hp),
  };
  b.root("front", "front", rectPolygon(walls.front.x, 0, Lp, Hp), "Front");
  b.attach("right", "right", "front", rectEdges(walls.front).right, Wp, { kind: "rect" }, { stage: 0, label: "Right side" });
  b.attach("back", "back", "right", rectEdges(walls.right).right, Lp, { kind: "rect" }, { stage: 0, label: "Back" });
  b.attach("left", "left", "back", rectEdges(walls.back).right, Wp, { kind: "rect" }, { stage: 0, label: "Left side" });
  if (opts.joint !== false) {
    b.attach("glue", "glue", "front", rectEdges(walls.front).left, j, { kind: "trapezoid", taperA: j * 0.25, taperB: j * 0.25 }, {
      stage: 0,
      stack: -1,
      label: "Manufacturer's joint",
    });
  }
  return { b, t, Lp, Wp, Hp, slot: slotWidth(t), walls, wallIds: { front: "front", right: "right", back: "back", left: "left" } };
}

export const isMajor = (w: WallId) => w === "front" || w === "back";

/** Hinge segment at one end of a wall, inset by half a slot (or custom amounts) at each end. */
export function endHinge(c: Ctx, wall: Rect, end: End, insetA?: number, insetB?: number): [Pt, Pt] {
  const e = end === "top" ? rectEdges(wall).top : rectEdges(wall).bottom;
  return insetSeg(e, insetA ?? c.slot / 2, insetB ?? insetA ?? c.slot / 2);
}

export interface FlapOpts extends PanelOpts {
  id?: string;
  role?: PanelRole;
  shape?: FlapShape;
  insetA?: number;
  insetB?: number;
  /** Override the parent panel / wall rect (split walls). */
  parentId?: string;
  wallRect?: Rect;
}

/** A flap on one end of a wall. Returns the panel and its far edge (for children). */
export function flap(c: Ctx, wall: WallId, end: End, depth: number, o: FlapOpts = {}): { panel: DielinePanel; far: [Pt, Pt] } {
  const parentId = o.parentId ?? c.wallIds[wall];
  const r = o.wallRect ?? c.walls[wall];
  const hinge = endHinge(c, r, end, o.insetA, o.insetB);
  const id = o.id ?? `${end}Flap_${parentId}`;
  const major = isMajor(wall);
  const panel = c.b.attach(id, o.role ?? "flap", parentId, hinge, depth, o.shape ?? { kind: "rect" }, {
    stage: o.stage ?? (major ? 2 : 1),
    stack: o.stack ?? (major ? 0 : -1),
    label: o.label ?? (major ? "Major flap" : "Minor flap"),
    ...(o.fold !== undefined ? { fold: o.fold } : {}),
    ...(o.pivotDepth !== undefined ? { pivotDepth: o.pivotDepth } : {}),
    ...(o.holes ? { holes: o.holes } : {}),
    ...(o.printable !== undefined ? { printable: o.printable } : {}),
  });
  const f = c.b.frame(parentId, hinge);
  return { panel, far: [f.at(f.a, 0, depth), f.at(f.a, f.length, depth)] };
}

/** Depth at which two opposite flaps meet in the middle. */
export const meetMajor = (c: Ctx) => c.Wp / 2;
export const meetMinor = (c: Ctx) => c.Lp / 2 - c.t;
/** Full-width flap (reaches the opposite wall). */
export const fullMajor = (c: Ctx) => c.Wp - 2 * c.t;

/**
 * Plain slotted flaps on one end. `major` / `minor` are depths; overlapping majors put the
 * back flap one layer inside the front flap, and the minors one layer further in.
 */
export function slottedEnd(c: Ctx, end: End, major: number, minor: number, o: { overlap?: boolean } = {}) {
  const ov = o.overlap ?? false;
  flap(c, "left", end, minor, { stack: ov ? -2 : -1 });
  flap(c, "right", end, minor, { stack: ov ? -2 : -1 });
  flap(c, "front", end, major, { stack: 0, stage: ov ? 3 : 2, label: ov ? "Outer major flap" : "Major flap" });
  flap(c, "back", end, major, { stack: ov ? -1 : 0, stage: 2, label: ov ? "Inner major flap" : "Major flap" });
}

/** RSC end: majors meet at the centre, minors as deep as the majors (never past the centre). */
export function rscEnd(c: Ctx, end: End) {
  slottedEnd(c, end, meetMajor(c), Math.min(meetMajor(c), meetMinor(c)));
}

/**
 * Tuck lid closure (0210/0211/0212/0215/0227 family): the lid on one major wall spans the
 * opening and tucks inside the opposite wall; dust flaps on both minor walls go under it.
 */
export function tuckLidEnd(c: Ctx, end: End, owner: "front" | "back", o: { dust?: number } = {}) {
  const dustD = o.dust ?? Math.min(c.Wp * 0.75, meetMinor(c));
  for (const side of ["left", "right"] as const) {
    flap(c, side, end, dustD, {
      role: "dust",
      shape: { kind: "trapezoid", taperA: Math.min(dustD * 0.3, c.Wp * 0.2), taperB: Math.min(dustD * 0.3, c.Wp * 0.2) },
      stack: -1,
      stage: 1,
      label: "Dust flap",
    });
  }
  const lid = flap(c, owner, end, c.Wp, { id: `${end}Lid`, role: end === "top" ? "top" : "bottom", stage: 2, stack: 0, label: "Tuck lid", insetA: c.t, insetB: c.t });
  const tuckD = Math.min(clamp(c.Wp * 0.3, 15, 50), c.Hp * 0.4);
  c.b.attach(`${end}Tuck`, "tuck", lid.panel.id, insetSeg(lid.far, 2 * c.t + 1), tuckD, { kind: "tuck", shoulder: 2 }, { stage: 2, stack: -1, label: "Tuck flap" });
  return lid;
}

/**
 * 1-2-3 snap-lock bottom (0215, 0216, 0217), the corrugated version of ECMA A55.20:
 * (1) hooked minor flaps, (2) front flap with a centre slot, (3) back flap whose locking
 * tongue pushes through the slot and catches on the hooks.
 */
export function snapLockBottom(c: Ctx) {
  const { b, t, Wp } = c;
  for (const side of ["left", "right"] as const) {
    const hinge = endHinge(c, c.walls[side], "bottom");
    const f = b.frame(c.wallIds[side], hinge);
    const L = f.length;
    const d = Math.min(Wp * 0.45, meetMinor(c));
    const hook = Math.min(d * 0.3, L * 0.18);
    const poly: Polygon = [
      f.at(f.a, 0, 0),
      f.at(f.a, L, 0),
      f.at(f.a, L, d * 0.35),
      f.at(f.a, L - hook, d),
      f.at(f.a, hook, d),
      f.at(f.a, 0, d * 0.35),
    ];
    b.attachPoly(`bottom_${side}`, "dust", c.wallIds[side], hinge, poly, { stage: 1, stack: -2, label: "Hooked bottom flap (1)" });
  }
  {
    const hinge = endHinge(c, c.walls.front, "bottom");
    const f = b.frame("front", hinge);
    const L = f.length;
    const d = Wp * 0.5 + Math.min(10, Wp * 0.15);
    const sw = Math.min(L * 0.3, 60);
    const sd = Math.min(d * 0.35, 20);
    const ch = Math.min(d * 0.3, L * 0.12);
    const m = L / 2;
    const poly: Polygon = [
      f.at(f.a, 0, 0),
      f.at(f.a, L, 0),
      f.at(f.a, L, d - ch),
      f.at(f.a, L - ch, d),
      f.at(f.a, m + sw / 2, d),
      f.at(f.a, m + sw / 2 - 3, d - sd),
      f.at(f.a, m - sw / 2 + 3, d - sd),
      f.at(f.a, m - sw / 2, d),
      f.at(f.a, ch, d),
      f.at(f.a, 0, d - ch),
    ];
    b.attachPoly("bottom_front", "flap", "front", hinge, poly, { stage: 2, stack: -1, label: "Slotted bottom flap (2)" });
  }
  {
    const hinge = endHinge(c, c.walls.back, "bottom");
    const f = b.frame(c.wallIds.back, hinge);
    const L = f.length;
    const d = Wp * 0.5 + Math.min(10, Wp * 0.15) - t;
    const tab = Math.min(15, Wp * 0.18);
    const tw = Math.min(L * 0.12, 30);
    const ch = Math.min(d * 0.3, L * 0.12);
    const m = L / 2;
    const poly: Polygon = [
      f.at(f.a, 0, 0),
      f.at(f.a, L, 0),
      f.at(f.a, L, d - ch),
      f.at(f.a, L - ch, d),
      f.at(f.a, m + tw, d),
      f.at(f.a, m + tw * 0.8, d + tab),
      f.at(f.a, m - tw * 0.8, d + tab),
      f.at(f.a, m - tw, d),
      f.at(f.a, ch, d),
      f.at(f.a, 0, d - ch),
    ];
    b.attachPoly("bottom_back", "bottom", c.wallIds.back, hinge, poly, { stage: 3, stack: 0, label: "Locking bottom flap (3)" });
  }
}

/** Hand holes centred near the top of the minor walls (FEFCO PC/UC handholds). */
export function handHoles(c: Ctx, fromTop: number) {
  for (const w of ["left", "right"] as const) {
    const p = c.b.byId(c.wallIds[w]);
    const r = c.walls[w];
    const hw = Math.min(90, r.width * 0.6);
    const hh = Math.min(30, r.height * 0.18);
    if (hw < 40 || hh < 15) continue;
    p.holes = [...(p.holes ?? []), stadium(r.x + r.width / 2, r.y + Math.max(fromTop, hh) + hh / 2, hw, hh)];
  }
}

/** Short horizontal slit (die-cut line with width) as a hole polygon. */
export function slit(cx: number, cy: number, w: number, h = 3): Polygon {
  return rectPolygon(cx - w / 2, cy - h / 2, w, h);
}

export { pt };
