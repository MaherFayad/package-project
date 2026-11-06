import { Box3, Mat4 as Matrix4, Quat as Quaternion, Vec3 as Vector3 } from "@/lib/dieline/math";
import { DielineBuilder, insetSeg, rectEdges } from "../../builder";
import { boundsAt } from "../../fold";
import { bboxOf, centroid, clamp, pt, rectPolygon } from "../../geometry";
import type { PanelRole, Polygon, Pt, Segment } from "../../types";

/**
 * Building blocks shared by the FEFCO 03 (telescope) and 05 (slide) generators:
 * cross-shaped trays and caps (corner flaps, gussets, roll-over walls, ears), tubes and
 * sleeves (with optional slotted / envelope end flaps), octagonal tubes and caps, and the
 * placement of extra blanks (lid, caps, inner sleeve) in their closed pose.
 *
 * Conventions follow src/lib/dieline/structures.ts: inner mm in, panels crease-to-crease
 * = inner + 2 × layers × t, fold pivots on the printed surface, 180° roll-ins pivot one
 * caliper deep.
 */

export type Quat = [number, number, number, number];
export const IDENTITY_Q: Quat = [0, 0, 0, 1];

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/**
 * Closed orientations (flat frame → model). Flat frame: X = sheet x, Y = -sheet y,
 * printed surface toward +Z, panels fold toward -Z.
 */
export const ORIENT = {
  /** Root printed side to the front, sheet-up = up (tubes standing on end, 0501). */
  upright: () => new Matrix4(),
  /** Root printed side down, folded walls up, sheet-up = front (base tray, bottom cap). */
  floor: () => new Matrix4().makeRotationX(Math.PI / 2),
  /** Root printed side up, folded walls down, sheet-up = back (lid, top cap). */
  ceiling: () => new Matrix4().makeRotationX(-Math.PI / 2),
  /** Root printed side up, chain (sheet x) runs toward the front, sheet-up = right (0503 wrap). */
  topChainFront: () => new Matrix4().makeBasis(v(0, 0, 1), v(1, 0, 0), v(0, 1, 0)),
  /** Root printed side down, chain runs toward the front, sheet-up = left (0510 wrap). */
  floorChainFront: () => new Matrix4().makeBasis(v(0, 0, 1), v(-1, 0, 0), v(0, -1, 0)),
  /** Root printed side to the back, chain folds toward the front (inner U liner, 0512). */
  rear: () => new Matrix4().makeRotationY(Math.PI),
};

export function quatOf(m: Matrix4): Quat {
  const q = new Quaternion().setFromRotationMatrix(m);
  return [q.x, q.y, q.z, q.w];
}

/** Closed bounds (model mm) of one blank (root + descendants). */
export function subtreeBounds(b: DielineBuilder, rootId: string, t: number, rotation: Quat = IDENTITY_Q): Box3 {
  const ids = new Set(b.subtree(rootId));
  return boundsAt({ panels: b.panels.filter((p) => ids.has(p.id)), rootId, thicknessMm: t, closedRotation: rotation }, 1);
}

/** Lowest y and leftmost x of everything on the sheet so far (to lay further blanks out). */
export function sheetExtent(b: DielineBuilder) {
  if (!b.panels.length) return { left: 0, bottom: 0, right: 0, top: 0 };
  const box = bboxOf(b.panels.flatMap((p) => p.polygon));
  return { left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height };
}

/** Next free origin on the sheet: below everything drawn so far, 15 mm gap. */
export const nextOrigin = (b: DielineBuilder, gap = 15): Pt => {
  if (!b.panels.length) return pt(0, 0);
  const e = sheetExtent(b);
  return pt(e.left, e.bottom + gap);
};

/** Where a blank starts: as the main root or as an extra piece (lid, cap, inner sleeve). */
export type Mount = { kind: "root"; label: string } | { kind: "piece"; label: string };

export function mountRoot(b: DielineBuilder, mount: Mount, id: string, role: PanelRole, poly: Polygon, label: string) {
  if (mount.kind === "root") {
    b.root(id, role, poly, label);
    b.pieceLabels.set(id, mount.label);
  } else {
    // Placeholder pose; `placePiece` sets the real one once the blank is complete.
    b.piece(id, role, poly, mount.label, { matrix: new Matrix4().toArray(), stage: 0 }, { label });
  }
}

/**
 * Build a blank at local coordinates, then move it so its bbox top-left sits at `origin`.
 * Extra creases and perforations made while building move with it.
 */
export function laidOut<T extends { rootId: string }>(b: DielineBuilder, origin: Pt, build: () => T): T {
  const c0 = b.extraCreases.length;
  const p0 = b.perfLines.length;
  const res = build();
  const ids = b.subtree(res.rootId);
  const box = bboxOf(ids.flatMap((id) => b.byId(id).polygon));
  const dx = origin.x - box.x;
  const dy = origin.y - box.y;
  b.translate(ids, dx, dy);
  const mv = (s: Segment): Segment => ({ a: pt(s.a.x + dx, s.a.y + dy), b: pt(s.b.x + dx, s.b.y + dy) });
  for (let i = c0; i < b.extraCreases.length; i++) b.extraCreases[i] = mv(b.extraCreases[i]);
  for (let i = p0; i < b.perfLines.length; i++) b.perfLines[i] = mv(b.perfLines[i]);
  return res;
}

/**
 * Give an extra blank its closed pose: oriented by `orient`, then translated so that
 * `align(bounds)` (a model-space offset computed from its oriented bounds) puts it in place.
 */
export function placePiece(
  b: DielineBuilder,
  rootId: string,
  t: number,
  orient: Matrix4,
  align: (box: Box3) => Vector3,
  stage: number,
  lift = 0,
) {
  const root = b.byId(rootId);
  const c = centroid(root.polygon);
  const m0 = orient.clone().multiply(new Matrix4().makeTranslation(-c.x, c.y, 0));
  root.assembly = { matrix: m0.toArray(), stage, lift };
  const box = subtreeBounds(b, rootId, t);
  const d = align(box);
  root.assembly.matrix = new Matrix4().makeTranslation(d.x, d.y, d.z).multiply(m0).toArray();
}

/** Align helpers: centre on x/z of `ref`; y by one of min/max/centre. */
export function alignOn(ref: Box3, y: { top?: number; bottom?: number; centre?: boolean }) {
  return (box: Box3) => {
    const rc = ref.getCenter(new Vector3());
    const bc = box.getCenter(new Vector3());
    let dy = rc.y - bc.y;
    if (y.top !== undefined) dy = y.top - box.max.y;
    else if (y.bottom !== undefined) dy = y.bottom - box.min.y;
    return new Vector3(rc.x - bc.x, dy, rc.z - bc.z);
  };
}

export const maxStageOf = (b: DielineBuilder) => b.panels.reduce((m, p) => Math.max(m, p.foldStage, p.assembly?.stage ?? 0), 0);

/* ───────────────────────── Cross-shaped trays and caps ───────────────────────── */

/**
 * Corner construction of a tray / cap blank.
 * - none:   flapless cross, corners taped or stapled (FEFCO 0302).
 * - flaps:  corner flaps on the `on` walls wrap round the corner (inside by default) and are
 *           glued or stitched to the other walls (0300, 0301, 0306, caps 0310/0312/0313).
 *           `lock` gives them a rounded locking nose engaging a slit (0307, folded outside).
 * - gusset: the corner square stays joined to both walls (web corner) and folds in half
 *           along its diagonal, then flat `side` against the `against` walls (0303/0304/0308/
 *           0309). `slot` cuts a relief square at the inner corner.
 */
export type Corners =
  | { kind: "none" }
  | { kind: "flaps"; on: "end" | "long"; outside?: boolean; lock?: boolean }
  | { kind: "gusset"; against: "end" | "long"; side: "in" | "out"; slot?: boolean };

export interface TrayOpts {
  prefix: string;
  /** Inner mm: L along sheet x (between the end walls), W along sheet y (between the long walls), H wall. */
  L: number;
  W: number;
  H: number;
  /** base: walls up, sheet-top wall becomes the front. lid: walls down, sheet-top wall is the back. */
  mode: "base" | "lid";
  corners: Corners;
  /** Double (roll-over) walls folded 180° inside. */
  rollover?: { end?: boolean; long?: boolean };
  /** Locking ears on these walls' ends, trapped inside the rolled walls of the other pair. */
  ears?: "end" | "long";
  /** Rolled walls end in locking noses that engage slots in the tray floor (0330). */
  lockNoses?: boolean;
  mount: Mount;
  origin: Pt;
}

export interface TrayBlank {
  rootId: string;
  /** Crease-to-crease panel sizes. */
  Lp: number;
  Wp: number;
  Hp: number;
}

/** Inner-space layers stacked at the end walls (x) and long walls (y). */
export function trayLayers(o: Pick<TrayOpts, "corners" | "rollover" | "ears">) {
  let end = 1;
  let long = 1;
  if (o.rollover?.end) end += 1;
  if (o.rollover?.long) long += 1;
  if (o.ears === "long" && o.rollover?.end) end += 1;
  if (o.ears === "end" && o.rollover?.long) long += 1;
  const c = o.corners;
  if (c.kind === "flaps" && !c.outside) {
    if (c.on === "end") long += 1;
    else end += 1;
  }
  if (c.kind === "gusset" && c.side === "in") {
    if (c.against === "end") end += 2;
    else long += 2;
  }
  return { end, long };
}

export function tray(b: DielineBuilder, t: number, o: TrayOpts): TrayBlank {
  const lay = trayLayers(o);
  const Lp = o.L + 2 * lay.end * t;
  const Wp = o.W + 2 * lay.long * t;
  const Hp = o.H + t;
  const id = (s: string) => o.prefix + s;
  const rootId = id(o.mode === "base" ? "bottom" : "top");
  return laidOut(b, o.origin, () => {
    const floor = { x: 0, y: 0, width: Lp, height: Wp };
    const fe = rectEdges(floor);
    mountRoot(b, o.mount, rootId, o.mode === "base" ? "bottom" : "top", rectPolygon(0, 0, Lp, Wp), o.mode === "base" ? "Tray floor" : "Lid top");
    const sheetTop: PanelRole = o.mode === "base" ? "front" : "back";
    const sheetBottom: PanelRole = o.mode === "base" ? "back" : "front";
    const walls = {
      longT: { role: sheetTop, edge: fe.top, kind: "long" as const },
      longB: { role: sheetBottom, edge: fe.bottom, kind: "long" as const },
      endL: { role: "left" as PanelRole, edge: fe.left, kind: "end" as const },
      endR: { role: "right" as PanelRole, edge: fe.right, kind: "end" as const },
    };
    // Erection order: the wall pair that carries the corner flaps / ears goes up first, those
    // flaps fold in, then the other pair rises over them (so nothing sweeps through a wall).
    const c0 = o.corners;
    const carrier: "end" | "long" | null = o.ears ?? (c0.kind === "flaps" && !c0.outside ? c0.on : null);
    for (const [k, w] of Object.entries(walls)) {
      const stage = carrier && w.kind !== carrier ? 2 : 0;
      b.attach(id(k), w.role, rootId, w.edge, Hp, { kind: "rect" }, { stage, label: `${w.kind === "long" ? "Long" : "End"} wall` });
    }

    const c = o.corners;
    // Corner points: O on the floor corner, uE along the end wall's side edge (outward, sheet x),
    // uL along the long wall's side edge (outward, sheet y).
    const corners = [
      { k: "TL", O: pt(0, 0), sx: -1, sy: -1, end: "endL", long: "longT" },
      { k: "TR", O: pt(Lp, 0), sx: 1, sy: -1, end: "endR", long: "longT" },
      { k: "BL", O: pt(0, Wp), sx: -1, sy: 1, end: "endL", long: "longB" },
      { k: "BR", O: pt(Lp, Wp), sx: 1, sy: 1, end: "endR", long: "longB" },
    ];
    if (c.kind === "flaps") {
      for (const cr of corners) {
        const wallId = id(c.on === "end" ? cr.end : cr.long);
        // Side edge of the carrying wall at this corner.
        const E = pt(cr.O.x + cr.sx * Hp, cr.O.y);
        const G = pt(cr.O.x, cr.O.y + cr.sy * Hp);
        // Start one caliper (+0.5) up from the floor crease: the wall bends round the floor's
        // edge there, and a flap reaching down to the crease would sit inside the floor board.
        const edge: [Pt, Pt] = insetSeg(c.on === "end" ? [cr.O, E] : [cr.O, G], t + 0.5, 0);
        const runLen = c.on === "end" ? Lp : Wp;
        const d = clamp(Math.min(Hp, runLen * 0.4), 8, 80);
        const fid = id(`flap${cr.k}`);
        if (c.lock) {
          const f = b.frame(wallId, edge);
          const n = Math.min(d * 0.35, 14);
          const poly: Polygon = [
            f.at(f.a, 0, 0),
            f.at(f.a, f.length, 0),
            f.at(f.a, f.length - 2, d),
            f.at(f.a, f.length * 0.62, d),
            f.at(f.a, f.length * 0.55, d + n),
            f.at(f.a, f.length * 0.4, d + n),
            f.at(f.a, f.length * 0.33, d),
            f.at(f.a, 2, d),
          ];
          b.attachPoly(fid, "flap", wallId, [f.a, f.b], poly, { stage: 1, stack: c.outside ? 1 : -1, label: "Locking corner flap" });
          // Slit in the neighbouring wall that receives the nose.
          const other = b.byId(id(c.on === "end" ? cr.long : cr.end));
          const r = other.bbox;
          const hgt = f.length * 0.475;
          const slitW = Math.max(1.2, t + 0.3);
          const slitL = f.length * 0.2;
          const run = d + n * 0.5;
          const slit =
            c.on === "end"
              ? rectPolygon(cr.O.x - cr.sx * run - slitW / 2, cr.O.y + cr.sy * hgt - slitL / 2, slitW, slitL)
              : rectPolygon(cr.O.x + cr.sx * hgt - slitL / 2, cr.O.y - cr.sy * run - slitW / 2, slitL, slitW);
          const sb = bboxOf(slit);
          if (sb.x > r.x && sb.y > r.y && sb.x + sb.width < r.x + r.width && sb.y + sb.height < r.y + r.height) other.holes = [...(other.holes ?? []), slit];
        } else {
          b.attach(fid, "flap", wallId, edge, d, { kind: "trapezoid", taperA: 1, taperB: Math.min(d * 0.25, Hp * 0.2) }, {
            stage: 1,
            stack: c.outside ? 1 : -1,
            label: "Corner flap",
          });
        }
      }
    }
    if (c.kind === "gusset") {
      const s = c.slot ? clamp(t * 2, 2, 6) : 0;
      // Both gussets of a wall fold onto it from its two corners; each covers Hp along it.
      const overlap = 2 * Hp > (c.against === "end" ? Wp : Lp);
      for (const cr of corners) {
        const O = cr.O;
        const uE = pt(cr.sx, 0);
        const uL = pt(0, cr.sy);
        const P = (e: number, l: number) => pt(O.x + uE.x * e + uL.x * l, O.y + uE.y * e + uL.y * l);
        // End triangle (next to the end wall) and long triangle (next to the long wall).
        const endTri: Polygon = s ? [P(s, 0), P(Hp, 0), P(Hp, Hp), P(s, s)] : [O, P(Hp, 0), P(Hp, Hp)];
        const longTri: Polygon = s ? [P(0, s), P(s, s), P(Hp, Hp), P(0, Hp)] : [O, P(Hp, Hp), P(0, Hp)];
        const endHinge: [Pt, Pt] = [P(s, 0), P(Hp, 0)];
        const longHinge: [Pt, Pt] = [P(0, s), P(0, Hp)];
        const diag: [Pt, Pt] = [P(s, s), P(Hp, Hp)];
        const againstEnd = c.against === "end";
        const hingedTri = againstEnd ? endTri : longTri;
        const otherTri = againstEnd ? longTri : endTri;
        const wallId = id(againstEnd ? cr.end : cr.long);
        const out = c.side === "out";
        b.attachPoly(id(`gus${cr.k}a`), "ear", wallId, againstEnd ? endHinge : longHinge, hingedTri, {
          stage: 1,
          fold: out ? -180 : 180,
          // When the two gussets on one wall are deeper than half its length they overlap: the
          // second pair lies one more board pair out (or in) so the two never share a plane.
          pivotDepth: (out ? 0 : 1) + (overlap && cr.sy > 0 ? (out ? -1 : 1) : 0),
          label: "Corner gusset",
        });
        b.attachPoly(id(`gus${cr.k}b`), "ear", id(`gus${cr.k}a`), diag, otherTri, {
          stage: 1,
          fold: out ? 180 : -180,
          pivotDepth: out ? 1 : 0,
          label: "Corner gusset",
        });
        // Web crease to the other wall: board stays joined, so it is a crease, not a cut.
        const web = againstEnd ? longHinge : endHinge;
        b.extraCreases.push({ a: web[0], b: web[1] });
      }
    }

    // Ears (locking flaps) on the ends of one wall pair, trapped by the rolled walls of the other.
    if (o.ears) {
      for (const cr of corners) {
        const wallId = id(o.ears === "end" ? cr.end : cr.long);
        const E = pt(cr.O.x + cr.sx * Hp, cr.O.y);
        const G = pt(cr.O.x, cr.O.y + cr.sy * Hp);
        const edge: [Pt, Pt] = o.ears === "end" ? [cr.O, E] : [cr.O, G];
        const runLen = o.ears === "end" ? Lp : Wp;
        const d = clamp(runLen * 0.3, 10, Math.max(10, Hp));
        b.attach(id(`ear${cr.k}`), "ear", wallId, insetSeg(edge, t + 0.5, t + 0.5), d, { kind: "trapezoid", taperA: 1, taperB: Math.min(d * 0.5, Hp * 0.3) }, {
          stage: 1,
          stack: -1,
          label: "Locking ear",
        });
      }
    }

    // Roll-over walls.
    const roll = (wid: keyof typeof walls, insetLayers: number, trapsEars: boolean) => {
      const w = b.byId(id(wid));
      const r = w.bbox;
      const e = rectEdges(r);
      const far: [Pt, Pt] = wid === "longT" ? e.top : wid === "longB" ? e.bottom : wid === "endL" ? e.left : e.right;
      const [a, c2] = insetSeg(far, insetLayers * t + 0.5);
      const depth = Hp - (trapsEars ? 2 : 1) * t - 0.5;
      const f = b.frame(id(wid), [a, c2]);
      const poly: Polygon = [f.at(f.a, 0, 0), f.at(f.a, f.length, 0)];
      if (o.lockNoses) {
        const nw = Math.min(16, f.length * 0.12);
        const nd = 2 * t + 1;
        poly.push(f.at(f.a, f.length, depth), f.at(f.a, f.length * 0.75 + nw / 2, depth), f.at(f.a, f.length * 0.75 + nw / 2, depth + nd), f.at(f.a, f.length * 0.75 - nw / 2, depth + nd), f.at(f.a, f.length * 0.75 - nw / 2, depth));
        poly.push(f.at(f.a, f.length * 0.25 + nw / 2, depth), f.at(f.a, f.length * 0.25 + nw / 2, depth + nd), f.at(f.a, f.length * 0.25 - nw / 2, depth + nd), f.at(f.a, f.length * 0.25 - nw / 2, depth), f.at(f.a, 0, depth));
        // Matching slots in the floor, one caliper in from the wall crease.
        const floorPanel = b.byId(rootId);
        const sl = (u: number) => {
          const cx = a.x + (c2.x - a.x) * u;
          const cy = a.y + (c2.y - a.y) * u;
          const along = Math.abs(c2.x - a.x) > Math.abs(c2.y - a.y);
          const off = insetLayers * t + t / 2 + 0.25;
          const sw = nw + 1;
          const sh = t + 0.6;
          if (wid === "longT") return rectPolygon(cx - sw / 2, off, sw, sh);
          if (wid === "longB") return rectPolygon(cx - sw / 2, Wp - off - sh, sw, sh);
          if (wid === "endL") return rectPolygon(off, cy - sw / 2, sh, sw);
          void along;
          return rectPolygon(Lp - off - sh, cy - sw / 2, sh, sw);
        };
        floorPanel.holes = [...(floorPanel.holes ?? []), sl(0.25), sl(0.75)];
      } else {
        poly.push(f.at(f.a, f.length, depth), f.at(f.a, 0, depth));
      }
      b.attachPoly(id(`${wid}Inner`), "inner", id(wid), [a, c2], poly, { fold: 180, pivotDepth: trapsEars ? 1.5 : 1, stage: 3, label: "Roll-over inner wall" });
    };
    if (o.rollover?.end) {
      const inset = lay.long; // clear the long walls' layers at both ends
      roll("endL", inset, o.ears === "long");
      roll("endR", inset, o.ears === "long");
    }
    if (o.rollover?.long) {
      const inset = lay.end;
      roll("longT", inset, o.ears === "end");
      roll("longB", inset, o.ears === "end");
    }
    return { rootId, Lp, Wp, Hp };
  });
}

/* ───────────────────────── Tubes and sleeves ───────────────────────── */

export type EndFlaps =
  | { kind: "slotted"; depthMajor: number; depthMinor: number; majors: number[]; minorStack?: Record<number, number>; stages?: Record<number, number> }
  | { kind: "envelope"; depthMajor: number; depthMinor: number; majors: number[]; minorStack?: Record<number, number>; stages?: Record<number, number> }
  | { kind: "dust"; depth: number; on: number[] };

export interface TubeOpts {
  prefix: string;
  /** Crease-to-crease panel widths along sheet x (root first). */
  widths: number[];
  roles: PanelRole[];
  labels?: string[];
  /** Crease-to-crease height along sheet y. */
  height: number;
  /** Fold between neighbouring panels (90 for 4 sides, 45 for an octagon). */
  fold?: number;
  /** Width of the manufacturer's joint on the root's left edge (0 = none, panels taped). */
  joint?: number;
  /** Optional end flaps. */
  top?: EndFlaps;
  bottom?: EndFlaps;
  mount: Mount;
  origin: Pt;
}

/**
 * Tube of panels side by side, each folded on the previous one's right edge, closed by a
 * manufacturer's joint on the root's left edge glued inside the last panel.
 */
export function tube(b: DielineBuilder, t: number, o: TubeOpts): { rootId: string; ids: string[] } {
  const id = (s: string) => o.prefix + s;
  const fold = o.fold ?? 90;
  return laidOut(b, o.origin, () => {
    const ids: string[] = [];
    let x = 0;
    o.widths.forEach((w, i) => {
      const pid = id(`p${i}`);
      const r = { x, y: 0, width: w, height: o.height };
      if (i === 0) mountRoot(b, o.mount, pid, o.roles[0], rectPolygon(r.x, r.y, w, o.height), o.labels?.[0] ?? "Panel 1");
      else b.attach(pid, o.roles[i], ids[i - 1], rectEdges({ x: x - o.widths[i - 1], y: 0, width: o.widths[i - 1], height: o.height }).right, w, { kind: "rect" }, { stage: 0, fold, label: o.labels?.[i] ?? `Panel ${i + 1}` });
      ids.push(pid);
      x += w;
    });
    const j = o.joint ?? Math.min(35, o.height * 0.4, o.widths[o.widths.length - 1] * 0.45);
    if (j > 0) {
      // The joint stops 2t + 1 short of each end crease, clear of end flaps stacked inside it.
      b.attach(id("joint"), "glue", ids[0], insetSeg(rectEdges({ x: 0, y: 0, width: o.widths[0], height: o.height }).left, o.top || o.bottom ? 2 * t + 1 : 0), j, { kind: "trapezoid", taperA: j * 0.25, taperB: j * 0.25 }, {
        stage: 0,
        fold,
        stack: -1,
        label: "Manufacturer's joint",
      });
    }
    const slot = clamp(2 * t + 2, 4, 8);
    for (const where of ["top", "bottom"] as const) {
      const spec = o[where];
      if (!spec) continue;
      let xx = 0;
      o.widths.forEach((w, i) => {
        const r = { x: xx, y: 0, width: w, height: o.height };
        xx += w;
        const edge = where === "top" ? rectEdges(r).top : rectEdges(r).bottom;
        if (spec.kind === "dust") {
          if (!spec.on.includes(i)) return;
          const taper = Math.min(spec.depth * 0.4, w * 0.3);
          b.attach(id(`${where}Dust${i}`), "dust", ids[i], insetSeg(edge, t + 0.5), spec.depth, { kind: "trapezoid", taperA: taper, taperB: taper }, { stage: 1, stack: -1, label: "Dust flap" });
          return;
        }
        const major = spec.majors.includes(i);
        const depth = major ? spec.depthMajor : spec.depthMinor;
        const shape = spec.kind === "envelope" ? { kind: "trapezoid" as const, taperA: Math.min(depth * 0.7, w * 0.3), taperB: Math.min(depth * 0.7, w * 0.3) } : { kind: "rect" as const };
        b.attach(id(`${where}Flap${i}`), "flap", ids[i], insetSeg(edge, slot / 2), depth, shape, {
          stage: spec.stages?.[i] ?? (major ? 2 : 1),
          stack: major ? 0 : (spec.minorStack?.[i] ?? -1),
          label: major ? "Major flap" : "Minor flap",
        });
      });
    }
    return { rootId: ids[0], ids };
  });
}

/** Four-panel tube [L, W, L, W] standing on end (FEFCO 0501 / body of 0310, 0314, 0325). */
export function rectTube(b: DielineBuilder, t: number, o: { prefix: string; Lp: number; Wp: number; Hp: number; mount: Mount; origin: Pt; top?: EndFlaps; bottom?: EndFlaps }) {
  return tube(b, t, {
    prefix: o.prefix,
    widths: [o.Lp, o.Wp, o.Lp, o.Wp],
    roles: ["front", "right", "back", "left"],
    labels: ["Front", "Right side", "Back", "Left side"],
    height: o.Hp,
    top: o.top,
    bottom: o.bottom,
    mount: o.mount,
    origin: o.origin,
  });
}

/* ───────────────────────── Octagons (octabins) ───────────────────────── */

/** Octagon outline centred on (0,0): half extents a/2 × b/2, chamfer leg k. Clockwise on screen. */
export function octagon(Lx: number, Wy: number, k: number, cx = 0, cy = 0): Polygon {
  const x = Lx / 2;
  const y = Wy / 2;
  return [
    pt(cx - x + k, cy - y),
    pt(cx + x - k, cy - y),
    pt(cx + x, cy - y + k),
    pt(cx + x, cy + y - k),
    pt(cx + x - k, cy + y),
    pt(cx - x + k, cy + y),
    pt(cx - x, cy + y - k),
    pt(cx - x, cy - y + k),
  ];
}

/** Chamfer leg after offsetting an axis-aligned octagon outward by d. */
export const offsetChamfer = (k: number, d: number) => k + d * (2 - Math.SQRT2);

/**
 * Octagonal cap / tray: octagon top with eight rim walls folded 90°.
 * In base mode it is a bottom tray (walls up), in lid mode a cap (walls down).
 */
export function octCap(b: DielineBuilder, o: { prefix: string; Lx: number; Wy: number; k: number; h: number; mode: "base" | "lid"; mount: Mount; origin: Pt }) {
  const id = (s: string) => o.prefix + s;
  const rootId = id(o.mode === "base" ? "bottom" : "top");
  return laidOut(b, o.origin, () => {
    const poly = octagon(o.Lx, o.Wy, o.k);
    mountRoot(b, o.mount, rootId, o.mode === "base" ? "bottom" : "top", poly, o.mode === "base" ? "Octagonal tray" : "Octagonal cap");
    const sheetTop: PanelRole = o.mode === "base" ? "front" : "back";
    const sheetBottom: PanelRole = o.mode === "base" ? "back" : "front";
    const roleOf = (i: number): PanelRole => ([sheetTop, "flap", "right", "flap", sheetBottom, "flap", "left", "flap"] as PanelRole[])[i];
    for (let i = 0; i < 8; i++) {
      const a = poly[i];
      const c = poly[(i + 1) % 8];
      // Edge 0 is the sheet-top side, 2 right, 4 bottom, 6 left; odd edges are chamfers.
      const role = roleOf(i);
      b.attach(id(`wall${i}`), role, rootId, [a, c], o.h, { kind: "trapezoid", taperA: i % 2 ? 1 : 0.5, taperB: i % 2 ? 1 : 0.5 }, { stage: 0, label: i % 2 ? "Corner rim wall" : "Rim wall" });
    }
    return { rootId };
  });
}
