import { Box3, Vec3 as Vector3 } from "@/lib/dieline/math";
import type { Dims, FaceId, StructureFeatures } from "@/types";
import { DielineBuilder, rectEdges } from "../../builder";
import { clamp, pt, rectPolygon } from "../../geometry";
import { FACE_FRAMES, boundsAt, computePoses, panelLocalPoint, panelPivot } from "../../fold";
import type { Affine, DielinePanel, FaceInfo, Pt } from "../../types";
import { telescope, type StructureDraft } from "../../structures";
import { composeFaces, deepEnds } from "../fefco-02/kit";
import {
  IDENTITY_Q,
  ORIENT,
  alignOn,
  laidOut,
  maxStageOf,
  mountRoot,
  nextOrigin,
  octCap,
  offsetChamfer,
  placePiece,
  quatOf,
  rectTube,
  subtreeBounds,
  tray,
  trayLayers,
  tube,
  type Corners,
  type EndFlaps,
  type Quat,
  type TrayOpts,
} from "./kit";

/**
 * Generators for FEFCO group 03 (telescope type) and group 05 (slide type).
 * Every generator takes INNER dims (L front width, W depth, H height, mm), board caliper t
 * and features (only `lidHeightMm` is used: lid / cap depth) and returns a StructureDraft
 * the core pipeline (or ./model.ts) turns into a DielineModel. Multi-piece styles lay each
 * blank below the previous one on the sheet and give it a closed pose (`assembly`).
 */

/** Sliding clearance between nested blanks, per side (mm). */
export const clearOf = (t: number) => Math.max(1, t * 0.5);

const size = (box: Box3) => box.getSize(new Vector3());

type TrayStyle = Pick<TrayOpts, "corners" | "rollover" | "ears" | "lockNoses">;

/** Lid / cap depth from features, clamped to [min(20, H), max]. */
export const lidDepthOf = (f: StructureFeatures, fallback: number, H: number, max = H) => clamp(f.lidHeightMm ?? fallback, Math.min(20, H), max);

/* ───────────────────────── Tray + lid (0300–0309, 0322, 0323, 0330, 0331) ───────────────────────── */

/**
 * Base tray (walls up) and a lid tray sized to the base's closed outer size + clearance,
 * turned walls down over it. Full telescope when the lid depth equals H, partial otherwise.
 */
export function trayAndLid(dims: Dims, t: number, f: StructureFeatures, base: TrayStyle, lid: TrayStyle, lidDefault: number): StructureDraft {
  const clear = clearOf(t);
  const b = new DielineBuilder();
  const bt = tray(b, t, { prefix: "", L: dims.L, W: dims.W, H: dims.H, mode: "base", ...base, mount: { kind: "root", label: "Base" }, origin: pt(0, 0) });
  const closedRotation = quatOf(ORIENT.floor());
  const box = subtreeBounds(b, bt.rootId, t, closedRotation);
  const s = size(box);
  const lidH = lidDepthOf(f, lidDefault, dims.H);
  const lt = tray(b, t, { prefix: "lid_", L: s.x + 2 * clear, W: s.z + 2 * clear, H: lidH, mode: "lid", ...lid, mount: { kind: "piece", label: "Lid" }, origin: nextOrigin(b, 20) });
  placePiece(b, lt.rootId, t, ORIENT.ceiling(), alignOn(box, { top: box.max.y + t }), maxStageOf(b) + 1, dims.H * 1.4);
  // Lid layers over the base: up to 3 wall layers, plus 2 for a second pair of outside
  // gussets when the two on one wall overlap (0303 / 0304 with H > half the wall). Below a
  // partial lid the base walls show: they lie as deep as the lid's own outside layers + the
  // clearance + the base's outside gussets (0304: 11.5 mm at t 1.5, so the base end walls
  // between the gusset triangles went unprinted). Measure that depth from the closed set.
  const all = boundsAt({ panels: b.panels, rootId: b.rootId, thicknessMm: t, closedRotation }, 1);
  const outer = size(all);
  const baseWallDepth = Math.max(outer.x - bt.Lp, outer.z - bt.Wp) / 2;
  return { builder: b, closedRotation, faceDepthTol: Math.max(clear + 5 * t, baseWallDepth) + 0.5 };
}

const flapsEnd: Corners = { kind: "flaps", on: "end" };
const flapsLong: Corners = { kind: "flaps", on: "long" };
const partial = (H: number) => clamp(Math.round(H * 0.35), 20, 80);

export const fefco0300 = (d: Dims, t: number, f: StructureFeatures) => trayAndLid(d, t, f, { corners: flapsEnd }, { corners: flapsEnd }, d.H);
/** 0301: as 0300 but the lid's corner flaps sit on the other wall pair so they never clash. */
export const fefco0301 = (d: Dims, t: number, f: StructureFeatures) => trayAndLid(d, t, f, { corners: flapsEnd }, { corners: flapsLong }, d.H);
/** 0302: flapless cross-shaped tray and lid, corners taped or stapled. */
export const fefco0302 = (d: Dims, t: number, f: StructureFeatures) => trayAndLid(d, t, f, { corners: { kind: "none" } }, { corners: { kind: "none" } }, d.H);
/** 0303: web (gusset) corners folded flat on the outside of the long walls. */
export const fefco0303 = (d: Dims, t: number, f: StructureFeatures) => {
  const c: Corners = { kind: "gusset", against: "long", side: "out" };
  return trayAndLid(d, t, f, { corners: c }, { corners: c }, d.H);
};
/** 0304: as 0303 but the gussets fold onto the alternate (end) panels. */
export const fefco0304 = (d: Dims, t: number, f: StructureFeatures) => {
  const c: Corners = { kind: "gusset", against: "end", side: "out" };
  return trayAndLid(d, t, f, { corners: c }, { corners: c }, d.H);
};
/** 0306: full-depth flapped base with a shallow cap (partial telescope). */
export const fefco0306 = (d: Dims, t: number, f: StructureFeatures) => trayAndLid(d, t, f, { corners: flapsEnd }, { corners: flapsEnd }, clamp(Math.round(d.H * 0.25), 20, 60));
/** 0307: locking-tab corners folded outside, nose engages a slit; seal after filling. */
export const fefco0307 = (d: Dims, t: number, f: StructureFeatures) => {
  const c: Corners = { kind: "flaps", on: "end", outside: true, lock: true };
  return trayAndLid(d, t, f, { corners: c }, { corners: c }, partial(d.H));
};
/** 0308: gusset corners folded inside against the long walls, relief slots at the corners. */
export const fefco0308 = (d: Dims, t: number, f: StructureFeatures) => {
  const c: Corners = { kind: "gusset", against: "long", side: "in", slot: true };
  return trayAndLid(d, t, f, { corners: c }, { corners: c }, partial(d.H));
};
/** 0309: gusset corners folded inside against the end walls, no slots (gapless corners). */
export const fefco0309 = (d: Dims, t: number, f: StructureFeatures) => {
  const c: Corners = { kind: "gusset", against: "end", side: "in" };
  return trayAndLid(d, t, f, { corners: c }, { corners: c }, partial(d.H));
};
/** 0322: rolled double end walls trapping corner ears (friction lock), lid alike. */
export const fefco0322 = (d: Dims, t: number, f: StructureFeatures) => {
  const s: TrayStyle = { corners: { kind: "none" }, rollover: { end: true }, ears: "long" };
  return trayAndLid(d, t, f, s, s, partial(d.H));
};
/** 0323: double walls on all four sides (ears trapped in the long walls), lid alike. */
export const fefco0323 = (d: Dims, t: number, f: StructureFeatures) => {
  const s: TrayStyle = { corners: { kind: "none" }, rollover: { end: true, long: true }, ears: "end" };
  return trayAndLid(d, t, f, s, s, partial(d.H));
};
/** 0330: self-erecting tray and cap (0422/0423 type): rolled end walls, ears, locking noses into floor slots. */
export const fefco0330 = (d: Dims, t: number, f: StructureFeatures) => {
  const s: TrayStyle = { corners: { kind: "none" }, rollover: { end: true }, ears: "long", lockNoses: true };
  return trayAndLid(d, t, f, s, s, partial(d.H));
};
/** 0331: tray and cap with rolled long walls trapping ears on the end walls (friction locking). */
export const fefco0331 = (d: Dims, t: number, f: StructureFeatures) => {
  const s: TrayStyle = { corners: { kind: "none" }, rollover: { long: true }, ears: "end" };
  return trayAndLid(d, t, f, s, s, partial(d.H));
};

/* ───────────────────────── Slotted bodies (0312, 0313, 0320, 0321) ───────────────────────── */

function slottedFlaps(Lp: number, Wp: number, t: number, kind: "slotted" | "envelope"): EndFlaps {
  return { kind, depthMajor: Wp / 2, depthMinor: Math.min(Wp / 2, Lp / 2 - t), majors: [0, 2] };
}

/** HSC / RSC tube body: crease height = inner + 2t per closed end. */
function slottedBody(b: DielineBuilder, t: number, o: { prefix: string; L: number; W: number; H: number; top: boolean; bottom: boolean; kind?: "slotted" | "envelope"; mount: TrayOpts["mount"]; origin: ReturnType<typeof pt> }) {
  const Lp = o.L + 2 * t;
  const Wp = o.W + 2 * t;
  const Hp = o.H + (o.top ? 2 * t : 0) + (o.bottom ? 2 * t : 0);
  const fl = slottedFlaps(Lp, Wp, t, o.kind ?? "slotted");
  return rectTube(b, t, { prefix: o.prefix, Lp, Wp, Hp, mount: o.mount, origin: o.origin, top: o.top ? fl : undefined, bottom: o.bottom ? fl : undefined });
}

/** 0320: two half-slotted containers (FEFCO 0200), lid over base. Delegates to the core generator. */
export const fefco0320 = (d: Dims, t: number, f: StructureFeatures) => telescope(d, t, f);

/** 0321: two half-slotted tubes with envelope (tapered) flaps; the lid telescopes to any height. */
export function fefco0321(dims: Dims, t: number, f: StructureFeatures): StructureDraft {
  const clear = clearOf(t);
  const b = new DielineBuilder();
  const base = slottedBody(b, t, { prefix: "", L: dims.L, W: dims.W, H: dims.H, top: false, bottom: true, kind: "envelope", mount: { kind: "root", label: "Base" }, origin: pt(0, 0) });
  // Base crease height H + 2t: the lid's top flaps (2 layers) rest on the rim, leaving H inside.
  const box = subtreeBounds(b, base.rootId, t);
  const s = size(box);
  const lidH = lidDepthOf(f, dims.H, dims.H);
  // The lid's manufacturer's joint lies inside its left wall, in the gap over the base: +t a
  // side on L so the joint clears the base wall (it went 0.5 mm into it: 3d.md R4-08).
  const lid = slottedBody(b, t, { prefix: "lid_", L: s.x + 2 * clear + 2 * t, W: s.z + 2 * clear, H: lidH, top: true, bottom: false, kind: "envelope", mount: { kind: "piece", label: "Lid" }, origin: nextOrigin(b, 20) });
  placePiece(b, lid.rootId, t, ORIENT.upright(), alignOn(box, { top: box.max.y + 2 * t }), maxStageOf(b) + 1, dims.H * 1.4);
  // The minor envelope flaps show in the corners between the tapered majors: print them too.
  // Below a partial lid the base walls lie the lid wall + clearance + the extra caliper on L
  // deep: at clear + t + 0.5 the base end walls went unprinted (bare board under the lid).
  return { builder: b, closedRotation: IDENTITY_Q, faceDepthTol: clear + 2 * t + 0.5, faces: deepEnds({ b, t }, ["top", "bottom"], 0) };
}

/* ───────────────────────── Bodies with caps (0310, 0312, 0313, 0314, 0325) ───────────────────────── */

interface CapSpec {
  style: TrayStyle;
  top: boolean;
  bottom: boolean;
  /** Caps fit inside the body ends instead of over them (0325). */
  internal?: boolean;
}

/** Add caps over (or inside) the ends of the main body. */
function addCaps(b: DielineBuilder, t: number, dims: Dims, f: StructureFeatures, bodyRotation: Quat, spec: CapSpec, capDefault: number, capMax: number) {
  const clear = clearOf(t);
  const box = subtreeBounds(b, b.rootId, t, bodyRotation);
  const s = size(box);
  const h = lidDepthOf(f, capDefault, dims.H, capMax);
  const ends: ("bottom" | "top")[] = [];
  if (spec.bottom) ends.push("bottom");
  if (spec.top) ends.push("top");
  for (const end of ends) {
    const mode = end === "top" ? "lid" : "base";
    let L: number;
    let W: number;
    if (spec.internal) {
      // Caps hold the inner size; the sleeve is sized around them (fefco0325).
      L = dims.L;
      W = dims.W;
    } else {
      L = s.x + 2 * clear;
      W = s.z + 2 * clear;
    }
    const cap = tray(b, t, { prefix: `${end}Cap_`, L, W, H: h, mode, ...spec.style, mount: { kind: "piece", label: end === "top" ? "Top cap" : "Bottom cap" }, origin: nextOrigin(b, 20) });
    const y = spec.internal ? (end === "top" ? { top: box.max.y } : { bottom: box.min.y }) : end === "top" ? { top: box.max.y + t } : { bottom: box.min.y - t };
    placePiece(b, cap.rootId, t, end === "top" ? ORIENT.ceiling() : ORIENT.floor(), alignOn(box, y), maxStageOf(b) + 1, dims.H * 1.3);
  }
  // Cap walls stand clear of the body by the clearance plus their own layers (rolled walls
  // and trapped ears on 0314): count them all so the body walls between the caps stay printed.
  const lay = trayLayers(spec.style);
  return { faceDepthTol: clear + (Math.max(2, Math.max(lay.end, lay.long) + 1)) * t + 0.5 };
}

/** 0310: open sleeve (0501) with a cap over each end (three blanks). */
export function fefco0310(dims: Dims, t: number, f: StructureFeatures): StructureDraft {
  const b = new DielineBuilder();
  rectTube(b, t, { prefix: "", Lp: dims.L + 2 * t, Wp: dims.W + 2 * t, Hp: dims.H, mount: { kind: "root", label: "Sleeve" }, origin: pt(0, 0) });
  const r = addCaps(b, t, dims, f, IDENTITY_Q, { style: { corners: flapsEnd }, top: true, bottom: true }, clamp(Math.round(dims.H * 0.2), 30, 120), dims.H / 2);
  return { builder: b, closedRotation: IDENTITY_Q, ...r };
}

/** 0312: half-slotted body (0200, bottom flaps) with a cap lid. */
export function fefco0312(dims: Dims, t: number, f: StructureFeatures): StructureDraft {
  const b = new DielineBuilder();
  slottedBody(b, t, { prefix: "", L: dims.L, W: dims.W, H: dims.H, top: false, bottom: true, mount: { kind: "root", label: "Body" }, origin: pt(0, 0) });
  const r = addCaps(b, t, dims, f, IDENTITY_Q, { style: { corners: flapsEnd }, top: true, bottom: false }, clamp(Math.round(dims.H * 0.2), 30, 120), dims.H);
  return { builder: b, closedRotation: IDENTITY_Q, ...r };
}

/** 0313: regular slotted body (0201) with deep caps over both ends (each about half the height). */
export function fefco0313(dims: Dims, t: number, f: StructureFeatures): StructureDraft {
  const b = new DielineBuilder();
  slottedBody(b, t, { prefix: "", L: dims.L, W: dims.W, H: dims.H, top: true, bottom: true, mount: { kind: "root", label: "Body" }, origin: pt(0, 0) });
  const r = addCaps(b, t, dims, f, IDENTITY_Q, { style: { corners: flapsEnd }, top: true, bottom: true }, Math.round(dims.H * 0.45), dims.H / 2);
  return { builder: b, closedRotation: IDENTITY_Q, ...r };
}

/** 0314: open sleeve with self-locking caps (0422 type: rolled end walls trapping ears). */
export function fefco0314(dims: Dims, t: number, f: StructureFeatures): StructureDraft {
  const b = new DielineBuilder();
  rectTube(b, t, { prefix: "", Lp: dims.L + 2 * t, Wp: dims.W + 2 * t, Hp: dims.H, mount: { kind: "root", label: "Sleeve" }, origin: pt(0, 0) });
  const style: TrayStyle = { corners: { kind: "none" }, rollover: { end: true }, ears: "long" };
  const r = addCaps(b, t, dims, f, IDENTITY_Q, { style, top: true, bottom: true }, clamp(Math.round(dims.H * 0.15), 40, 150), dims.H / 2);
  return { builder: b, closedRotation: IDENTITY_Q, ...r };
}

/** 0325: open sleeve with caps fitted inside both ends (internal cap fitment). */
export function fefco0325(dims: Dims, t: number, f: StructureFeatures): StructureDraft {
  const b = new DielineBuilder();
  // Inner height H between the cap tops, which sit flush inside the sleeve ends. The caps
  // (flapped trays: inner + 2t along L, + 4t along W) hold the inner size; the sleeve fits
  // round them with clearance.
  const c = clearOf(t);
  // Lp also leaves one caliper a side for the sleeve's joint, glued inside its left side next
  // to the caps' end walls (it went 0.5 mm into them: 3d.md R4-08).
  rectTube(b, t, { prefix: "", Lp: dims.L + 2 * t + 2 * c + 4 * t, Wp: dims.W + 4 * t + 2 * c + 2 * t, Hp: dims.H + 2 * t, mount: { kind: "root", label: "Sleeve" }, origin: pt(0, 0) });
  const r = addCaps(b, t, dims, f, IDENTITY_Q, { style: { corners: flapsEnd }, top: true, bottom: true, internal: true }, clamp(Math.round(dims.H * 0.15), 30, 100), dims.H / 2);
  return { builder: b, closedRotation: IDENTITY_Q, ...r };
}

/* ───────────────────────── Octabins (0350, 0351, 0352) ───────────────────────── */

/** Chamfer leg of the octagon: regular for 0350/0351, shorter corners (longer sides) for 0352. */
export const octChamfer = (Lp: number, Wp: number, regular: boolean) => (regular ? Math.min(Lp, Wp) / (2 + Math.SQRT2) : Math.min(Lp, Wp) * 0.18);

function octBody(b: DielineBuilder, t: number, dims: Dims, regular: boolean, bottomFlaps: boolean) {
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const k = octChamfer(Lp, Wp, regular);
  const a = Lp - 2 * k;
  const w = Wp - 2 * k;
  const c = k * Math.SQRT2;
  const Hp = dims.H + (bottomFlaps ? 2 * t : 0);
  // Neighbouring minor flaps overlap toward the centre: the corner flaps go in first, one
  // caliper inside the side flaps, so no two flaps share a plane (they z-fought before).
  const flaps: EndFlaps | undefined = bottomFlaps
    ? { kind: "slotted", depthMajor: Wp / 2, depthMinor: Math.min(Wp * 0.3, c), majors: [0, 4], minorStack: { 1: -2, 3: -2, 5: -2, 7: -2 }, stages: { 1: 1, 3: 1, 5: 1, 7: 1, 2: 2, 6: 2, 0: 3, 4: 3 } }
    : undefined;
  tube(b, t, {
    prefix: "",
    widths: [a, c, w, c, a, c, w, c],
    roles: ["front", "flap", "right", "flap", "back", "flap", "left", "flap"],
    labels: ["Front", "Corner panel", "Right side", "Corner panel", "Back", "Corner panel", "Left side", "Corner panel"],
    height: Hp,
    fold: 45,
    joint: Math.min(50, c * 0.6),
    bottom: flaps,
    mount: { kind: "root", label: "Body" },
    origin: pt(0, 0),
  });
  return { Lp, Wp, k };
}

function octabin(dims: Dims, t: number, f: StructureFeatures, regular: boolean, bottomFlaps: boolean): StructureDraft {
  const clear = clearOf(t);
  const b = new DielineBuilder();
  const { k } = octBody(b, t, dims, regular, bottomFlaps);
  const box = subtreeBounds(b, b.rootId, t);
  const s = size(box);
  const h = lidDepthOf(f, clamp(Math.round(dims.H * 0.15), 80, 200), dims.H, dims.H / 2);
  const d = clear + t;
  const ends: ("top" | "bottom")[] = bottomFlaps ? ["top"] : ["bottom", "top"];
  for (const end of ends) {
    const cap = octCap(b, {
      prefix: `${end}Cap_`,
      Lx: s.x + 2 * clear + 2 * t,
      Wy: s.z + 2 * clear + 2 * t,
      k: offsetChamfer(k, d),
      h: h + t,
      mode: end === "top" ? "lid" : "base",
      mount: { kind: "piece", label: end === "top" ? "Top cap" : "Bottom cap" },
      origin: nextOrigin(b, 20),
    });
    placePiece(b, cap.rootId, t, end === "top" ? ORIENT.ceiling() : ORIENT.floor(), alignOn(box, end === "top" ? { top: box.max.y + t } : { bottom: box.min.y - t }), maxStageOf(b) + 1, dims.H * 0.8);
  }
  // 0350 flap bottom: the side and corner minor flaps show round the two majors (most of the
  // octagon), so they join the bottom face too (they showed bare board under a bottom design).
  const faces = bottomFlaps ? composeFaces(octFaces(t), deepEnds({ b, t }, ["bottom"], 0)) : octFaces(t);
  return { builder: b, closedRotation: IDENTITY_Q, faceDepthTol: clear + 2 * t + 0.5, faces };
}

/**
 * Octabin side faces unrolled round the corners: each face is its flat side panel plus the
 * near half of both corner panels, so artwork wraps the 45° chamfers continuously instead of
 * leaving the corner panels bare. Body: drawn upright side by side on the sheet (p0 front …
 * p7 corner, joint on p0's left), so each corner half is a translation of the side panel's
 * own mapping (p(i+1) continues to its right on the sheet; p(i−1) is the previous panel in
 * the chain, for the front p7 at the far end). Cap rims: the corner rim walls are cut apart
 * from the straight ones on the sheet, so their halves are unrolled in 3D about the vertical
 * edge they share with the straight rim wall.
 */
const octFaces = (t: number) => (panels: DielinePanel[], computed: Partial<Record<FaceId, FaceInfo>>) => {
  const out = { ...computed };
  const byId = new Map(panels.map((p) => [p.id, p]));
  const poses = computePoses({ panels, rootId: "p0", thicknessMm: t, closedRotation: IDENTITY_Q }, 1);
  const world = (panel: DielinePanel, q: Pt) => panelLocalPoint(panel, q, 0, panelPivot(panel, t), t).applyMatrix4(poses.get(panel.id)!.world);
  const sides: [FaceId, number][] = [["front", 0], ["right", 2], ["back", 4], ["left", 6]];
  for (const [id, i] of sides) {
    const face = out[id];
    if (!face) continue;
    const parts = [...face.parts];
    const side = byId.get(`p${i}`);
    const own = face.parts.find((p) => p.panelId === side?.id);
    const next = byId.get(`p${i + 1}`);
    const prev = byId.get(`p${(i + 7) % 8}`);
    if (side && own && next && prev) {
      const [m0, m1, m2, m3, e, f] = own.transform;
      const sx = m0 * own.rect.x + m2 * own.rect.y + e;
      const half = next.bbox.width / 2;
      parts.push({ panelId: next.id, rect: { x: own.rect.x + own.rect.width, y: own.rect.y, width: half, height: own.rect.height }, transform: own.transform });
      const shift = prev.bbox.x + prev.bbox.width - sx;
      parts.push({ panelId: prev.id, rect: { x: own.rect.x - half, y: own.rect.y, width: half, height: own.rect.height }, transform: [m0, m1, m2, m3, e + shift, f] });
    }
    // Cap rims: unroll each corner rim wall about its shared edge with the straight rim wall.
    const { r, d } = FACE_FRAMES[id];
    for (const part of face.parts) {
      const m = /^(topCap_|bottomCap_)wall(\d)$/.exec(part.panelId);
      if (!m) continue;
      const wall = byId.get(part.panelId)!;
      const k = Number(m[2]);
      // Anchor: a face point and its world position on the straight rim wall.
      const u0 = part.rect.x + part.rect.width / 2;
      const v0 = part.rect.y + part.rect.height / 2;
      const [a0, b0, c0, d0, e0, f0] = part.transform;
      const w0 = world(wall, { x: a0 * u0 + c0 * v0 + e0, y: b0 * u0 + d0 * v0 + f0 });
      const wallPts = wall.polygon.map((q) => world(wall, q));
      for (const nb of [(k + 1) % 8, (k + 7) % 8]) {
        const corner = byId.get(`${m[1]}wall${nb}`);
        if (!corner) continue;
        const pts = corner.polygon.map((q) => world(corner, q));
        const cc = pts.reduce((acc, q) => acc.add(q), new Vector3()).multiplyScalar(1 / pts.length);
        const s = Math.sign(cc.clone().sub(w0).dot(r)) || 1;
        // Shared vertical edge: the straight wall's extreme toward the corner wall.
        const edge = wallPts.reduce((best, q) => (s * q.dot(r) > s * best.dot(r) ? q : best));
        const nrm = new Vector3(0, 0, 1).transformDirection(poses.get(corner.id)!.world);
        const g = cc.clone().sub(edge).setY(0);
        g.sub(nrm.clone().multiplyScalar(g.dot(nrm))).normalize();
        const uE = u0 + edge.clone().sub(w0).dot(r);
        const toFace = (q: Pt) => {
          const w = world(corner, q);
          return { u: uE + s * w.clone().sub(edge).dot(g), v: v0 + w.clone().sub(w0).dot(d) };
        };
        const o = toFace({ x: 0, y: 0 });
        const ex = toFace({ x: 1, y: 0 });
        const ey = toFace({ x: 0, y: 1 });
        const [p00, p10, p01, p11] = [ex.u - o.u, ex.v - o.v, ey.u - o.u, ey.v - o.v];
        const det = p00 * p11 - p01 * p10;
        if (Math.abs(det) < 1e-9) continue;
        const [i00, i01, i10, i11] = [p11 / det, -p01 / det, -p10 / det, p00 / det];
        const transform: Affine = [i00, i10, i01, i11, -(i00 * o.u + i01 * o.v), -(i10 * o.u + i11 * o.v)];
        const uv = corner.polygon.map(toFace);
        const halfW = (Math.max(...uv.map((q) => q.u)) - Math.min(...uv.map((q) => q.u))) / 2;
        const vMin = Math.min(...uv.map((q) => q.v));
        const vMax = Math.max(...uv.map((q) => q.v));
        parts.push({ panelId: corner.id, rect: { x: s > 0 ? uE : uE - halfW, y: vMin, width: halfW, height: vMax - vMin }, transform });
      }
    }
    out[id] = { ...face, parts };
  }
  return out;
};

/** 0350: octagonal body with integral bottom flaps and a cap lid. */
export const fefco0350 = (d: Dims, t: number, f: StructureFeatures) => octabin(d, t, f, true, true);
/** 0351: regular octagonal sleeve with a bottom tray and a top cap. */
export const fefco0351 = (d: Dims, t: number, f: StructureFeatures) => octabin(d, t, f, true, false);
/** 0352: octagonal sleeve with longer side panels (short corners) and two caps. */
export const fefco0352 = (d: Dims, t: number, f: StructureFeatures) => octabin(d, t, f, false, false);

/* ───────────────────────── Group 05: sleeves ───────────────────────── */

/** 0501: four-panel sleeve open top and bottom (L, W, L, W around the height). */
export function sleeve0501(b: DielineBuilder, t: number, o: { prefix: string; L: number; W: number; H: number; mount: TrayOpts["mount"]; origin: ReturnType<typeof pt>; top?: EndFlaps }) {
  return rectTube(b, t, { prefix: o.prefix, Lp: o.L + 2 * t, Wp: o.W + 2 * t, Hp: o.H, mount: o.mount, origin: o.origin, top: o.top });
}

/** 0502: sleeve open front and back (wraps top, right, bottom, left; strip height = depth). */
export function sleeve0502(b: DielineBuilder, t: number, o: { prefix: string; L: number; W: number; H: number; mount: TrayOpts["mount"]; origin: ReturnType<typeof pt> }) {
  const Lp = o.L + 2 * t;
  const Hp = o.H + 2 * t;
  return tube(b, t, { prefix: o.prefix, widths: [Lp, Hp, Lp, Hp], roles: ["top", "right", "bottom", "left"], labels: ["Top", "Right end", "Bottom", "Left end"], height: o.W, mount: o.mount, origin: o.origin });
}

/** 0503: sleeve open at the left and right ends (wraps top, front, bottom, back; strip height = length). */
export function sleeve0503(b: DielineBuilder, t: number, o: { prefix: string; L: number; W: number; H: number; mount: TrayOpts["mount"]; origin: ReturnType<typeof pt> }) {
  const Wp = o.W + 2 * t;
  const Hp = o.H + 2 * t;
  return tube(b, t, { prefix: o.prefix, widths: [Wp, Hp, Wp, Hp], roles: ["top", "front", "bottom", "back"], labels: ["Top", "Front", "Bottom", "Back"], height: o.L, mount: o.mount, origin: o.origin });
}

export function fefco0501(dims: Dims, t: number): StructureDraft {
  const b = new DielineBuilder();
  sleeve0501(b, t, { prefix: "", L: dims.L, W: dims.W, H: dims.H, mount: { kind: "root", label: "Sleeve" }, origin: pt(0, 0) });
  return { builder: b, closedRotation: IDENTITY_Q };
}

export function fefco0502(dims: Dims, t: number): StructureDraft {
  const b = new DielineBuilder();
  sleeve0502(b, t, { prefix: "", L: dims.L, W: dims.W, H: dims.H, mount: { kind: "root", label: "Sleeve" }, origin: pt(0, 0) });
  return { builder: b, closedRotation: quatOf(ORIENT.ceiling()) };
}

export function fefco0503(dims: Dims, t: number): StructureDraft {
  const b = new DielineBuilder();
  sleeve0503(b, t, { prefix: "", L: dims.L, W: dims.W, H: dims.H, mount: { kind: "root", label: "Sleeve" }, origin: pt(0, 0) });
  return { builder: b, closedRotation: quatOf(ORIENT.topChainFront()) };
}

/* ───────────────────────── Group 05: sets ───────────────────────── */

/** Place an inner blank centred in the main (outer) blank. */
function nestInside(b: DielineBuilder, t: number, rootId: string, mainRotation: Quat, orient: ReturnType<typeof ORIENT.upright>, lift: number) {
  const box = subtreeBounds(b, b.rootId, t, mainRotation);
  placePiece(b, rootId, t, orient, alignOn(box, { centre: true }), maxStageOf(b) + 1, lift);
}

/** 0504: 0502 inner sleeve (closes top, bottom and ends) slid into a 0501 outer sleeve (front, back, ends). */
export function fefco0504(dims: Dims, t: number): StructureDraft {
  const c = clearOf(t);
  const b = new DielineBuilder();
  // L leaves one caliper a side for the outer sleeve's joint, glued inside its left side next
  // to the inner sleeve's end (it went 0.5 mm into it: 3d.md R4-08).
  sleeve0501(b, t, { prefix: "", L: dims.L + 4 * t + 2 * c, W: dims.W + 2 * c, H: dims.H + 2 * t + 2 * c, mount: { kind: "root", label: "Outer sleeve" }, origin: pt(0, 0) });
  const inner = sleeve0502(b, t, { prefix: "in_", L: dims.L, W: dims.W, H: dims.H, mount: { kind: "piece", label: "Inner sleeve" }, origin: nextOrigin(b) });
  nestInside(b, t, inner.rootId, IDENTITY_Q, ORIENT.ceiling(), dims.H * 1.5);
  return { builder: b, closedRotation: IDENTITY_Q, faceDepthTol: c + t + 0.5 };
}

/** 0505: 0503 inner sleeve slid into a 0502 outer sleeve, closing all six sides. */
export function fefco0505(dims: Dims, t: number): StructureDraft {
  const c = clearOf(t);
  const b = new DielineBuilder();
  sleeve0502(b, t, { prefix: "", L: dims.L + 2 * c, W: dims.W + 2 * t + 2 * c, H: dims.H + 2 * t + 2 * c, mount: { kind: "root", label: "Outer sleeve" }, origin: pt(0, 0) });
  const rot = quatOf(ORIENT.ceiling());
  const inner = sleeve0503(b, t, { prefix: "in_", L: dims.L, W: dims.W, H: dims.H, mount: { kind: "piece", label: "Inner sleeve" }, origin: nextOrigin(b) });
  nestInside(b, t, inner.rootId, rot, ORIENT.topChainFront(), dims.H * 1.5);
  return { builder: b, closedRotation: rot, faceDepthTol: c + t + 0.5 };
}

/** 0507: 0503 inner sleeve slid into a 0501 outer sleeve (another opening side). */
export function fefco0507(dims: Dims, t: number): StructureDraft {
  const c = clearOf(t);
  const b = new DielineBuilder();
  sleeve0501(b, t, { prefix: "", L: dims.L + 2 * c, W: dims.W + 2 * t + 2 * c, H: dims.H + 2 * t + 2 * c, mount: { kind: "root", label: "Outer sleeve" }, origin: pt(0, 0) });
  const inner = sleeve0503(b, t, { prefix: "in_", L: dims.L, W: dims.W, H: dims.H, mount: { kind: "piece", label: "Inner sleeve" }, origin: nextOrigin(b) });
  nestInside(b, t, inner.rootId, IDENTITY_Q, ORIENT.topChainFront(), dims.H * 1.5);
  return { builder: b, closedRotation: IDENTITY_Q, faceDepthTol: c + t + 0.5 };
}

/** FEFCO 0907-style U liner: floor with two end walls (closes a 0503 sleeve's open ends). */
function uLiner(b: DielineBuilder, t: number, o: { prefix: string; L: number; W: number; H: number; mount: TrayOpts["mount"]; origin: ReturnType<typeof pt> }) {
  const Lb = o.L + 2 * t;
  const Hw = o.H + t;
  const id = (s: string) => o.prefix + s;
  return laidOut(b, o.origin, () => {
    const floor = { x: 0, y: 0, width: Lb, height: o.W };
    const poly = rectPolygon(0, 0, Lb, o.W);
    mountRoot(b, o.mount, id("bottom"), "bottom", poly, "Liner floor");
    b.attach(id("left"), "left", id("bottom"), rectEdges(floor).left, Hw, { kind: "rect" }, { stage: 0, label: "Liner end" });
    b.attach(id("right"), "right", id("bottom"), rectEdges(floor).right, Hw, { kind: "rect" }, { stage: 0, label: "Liner end" });
    return { rootId: id("bottom") };
  });
}

/** 0509: slide closure set: a 0907 U liner (floor + end walls) slid into a 0503 sleeve. */
export function fefco0509(dims: Dims, t: number): StructureDraft {
  const c = clearOf(t);
  const b = new DielineBuilder();
  sleeve0503(b, t, { prefix: "", L: dims.L + 2 * t + 2 * c, W: dims.W + 2 * c, H: dims.H + t + 2 * c, mount: { kind: "root", label: "Sleeve" }, origin: pt(0, 0) });
  const rot = quatOf(ORIENT.topChainFront());
  const liner = uLiner(b, t, { prefix: "in_", L: dims.L, W: dims.W, H: dims.H, mount: { kind: "piece", label: "Liner" }, origin: nextOrigin(b) });
  nestInside(b, t, liner.rootId, rot, ORIENT.floor(), dims.H * 1.5);
  return { builder: b, closedRotation: rot, faceDepthTol: c + t + 0.5 };
}

/**
 * Wrap of the 0510–0512 enclosures: floor, front and back walls, a hinged top flap (lid) on
 * the back wall and a tuck on the lid's front edge. Open at both ends. Laid out across the
 * sheet: lid tuck | lid | back | floor | front.
 */
function enclosureWrap(b: DielineBuilder, t: number, o: { L: number; W: number; H: number; lidDust?: boolean }) {
  const Wp = o.W + 2 * t;
  const Hp = o.H + 2 * t;
  const L = o.L;
  const floor = { x: 0, y: 0, width: Wp, height: L };
  b.root("bottom", "bottom", rectPolygon(0, 0, Wp, L), "Floor");
  b.pieceLabels.set("bottom", "Wrap");
  b.attach("front", "front", "bottom", rectEdges(floor).right, Hp, { kind: "rect" }, { stage: 0, label: "Front wall" });
  b.attach("back", "back", "bottom", rectEdges(floor).left, Hp, { kind: "rect" }, { stage: 0, label: "Back wall" });
  const back = { x: -Hp, y: 0, width: Hp, height: L };
  b.attach("top", "top", "back", rectEdges(back).left, Wp, { kind: "rect" }, { stage: 3, label: "Top flap (lid)" });
  const lid = { x: -Hp - Wp, y: 0, width: Wp, height: L };
  const tuckD = clamp(Hp * 0.4, 12, 40);
  const [a, c] = rectEdges(lid).left;
  b.attach("lidTuck", "tuck", "top", [pt(a.x, a.y + t + 1), pt(c.x, c.y - t - 1)], tuckD, { kind: "tuck", shoulder: 1 }, { stage: 3, stack: -1, label: "Lid tuck" });
  return { rootId: "bottom", Wp, Hp };
}

/** 0510: wrap (floor, walls, top flap) sealed inside a 0501 outer sleeve, then the top flap closes. */
export function fefco0510(dims: Dims, t: number): StructureDraft {
  return enclosure(dims, t, false);
}

/** 0511: as 0510 with dust flaps on the outer sleeve's ends that tuck under the top flap. */
export function fefco0511(dims: Dims, t: number): StructureDraft {
  return enclosure(dims, t, true);
}

function enclosure(dims: Dims, t: number, dust: boolean): StructureDraft {
  const c = clearOf(t);
  const b = new DielineBuilder();
  enclosureWrap(b, t, { L: dims.L, W: dims.W, H: dims.H });
  const rot = quatOf(ORIENT.floorChainFront());
  const box = subtreeBounds(b, b.rootId, t, rot);
  // Outer sleeve: covers the wrap's front and back and closes the open ends; stops under the lid.
  const Wi = dims.W + 2 * t + 2 * c;
  const Hs = dims.H + t;
  const top: EndFlaps | undefined = dust ? { kind: "dust", depth: clamp(Wi * 0.4, 15, 80), on: [1, 3] } : undefined;
  const sl = sleeve0501(b, t, { prefix: "sl_", L: dims.L + 2 * c, W: Wi, H: Hs, mount: { kind: "piece", label: "Outer sleeve" }, origin: nextOrigin(b, 20), top });
  // Stage 2 (before the top flap closes at stage 3).
  placePiece(b, sl.rootId, t, ORIENT.upright(), alignOn(box, { bottom: box.min.y }), 2, dims.H * 1.3);
  return { builder: b, closedRotation: rot, faceDepthTol: c + t + 0.5 };
}

/** 0512: as 0510/0511 but the second blank (U liner with the end walls) sits inside the wrap. */
export function fefco0512(dims: Dims, t: number): StructureDraft {
  const c = clearOf(t);
  const b = new DielineBuilder();
  enclosureWrap(b, t, { L: dims.L + 2 * t + 2 * c, W: dims.W + t + c, H: dims.H + c });
  const rot = quatOf(ORIENT.floorChainFront());
  const box = subtreeBounds(b, b.rootId, t, rot);
  // Inner liner: back panel + two end walls folded forward, standing on the wrap floor.
  const Ll = dims.L + 2 * t;
  const liner = laidOut(b, nextOrigin(b, 20), () => {
    const r = { x: 0, y: 0, width: Ll, height: dims.H };
    mountRoot(b, { kind: "piece", label: "Inner liner" }, "in_p0", "back", rectPolygon(0, 0, Ll, dims.H), "Liner back");
    b.attach("in_endR", "left", "in_p0", rectEdges(r).right, dims.W, { kind: "rect" }, { stage: 0, label: "Liner end" });
    b.attach("in_endL", "right", "in_p0", rectEdges(r).left, dims.W, { kind: "rect" }, { stage: 0, label: "Liner end" });
    return { rootId: "in_p0" };
  });
  placePiece(
    b,
    liner.rootId,
    t,
    ORIENT.rear(),
    (lb) => {
      const rc = box.getCenter(new Vector3());
      const lc = lb.getCenter(new Vector3());
      return new Vector3(rc.x - lc.x, box.min.y + t - lb.min.y, box.min.z + t - lb.min.z);
    },
    2,
    dims.H * 1.3,
  );
  return { builder: b, closedRotation: rot, faceDepthTol: c + t + 0.5 };
}
