import { BufferAttribute, BufferGeometry, CylinderGeometry, DataTexture, Path, Quaternion, RepeatWrapping, RGBAFormat, Shape, ShapeGeometry, Vector3 } from "three";
import {
  BIB_GLAND,
  FILM_THICKNESS_MM,
  HANG_HOLE_EURO,
  HANG_HOLE_ROUND_D_MM,
  MAILER_FLAP_MM,
  ROUND_CORNER_R_MM,
  SPOUT,
  TEAR_NOTCH_DEPTH_MM,
  TEAR_NOTCH_HEIGHT_MM,
  TIN_TIE,
  VALVE_BELOW_TOP_MM,
  VALVE_D_MM,
  VALVE_HEIGHT_MM,
  ZIPPER_BELOW_TOP_SEAL_MM,
} from "./constants";
import { definitionFor } from "./definitions";
import { baseFoldMm, panelUv, printLayout, rectUv } from "./layout";
import type { FlexConfig } from "./schema";
import { orient, panelPoint, solveShape, type FlexShape } from "./shape";
import type { FlexPanelId, FlexPrintLayout, FlexPrintPanel } from "./types";

/**
 * three.js BufferGeometry builders for filled flexible packs (mm; scale the group to metres).
 * Every printable part carries a `uv` that addresses its panel's PRINT area (trim + bleed), so a
 * texture drawn on the flat panel lands in place. Seal parts also carry `uv1` in crimp pitches
 * for a repeating crimp normal map (texture.channel = 1, see crimpNormalTexture()).
 */

export type FlexPartRole = "face" | "seal" | "fin" | "base" | "zipper" | "valve" | "spout" | "tinTie" | "flap";

export interface FlexMeshPart {
  id: string;
  role: FlexPartRole;
  /** Panel whose artwork this part shows (uv addresses that panel's print area). */
  panel?: FlexPanelId;
  /** Render both sides (thin fins, flaps, open sleeves). */
  doubleSided?: boolean;
  geometry: BufferGeometry;
}

export interface FlexModel {
  config: FlexConfig;
  shape: FlexShape;
  layout: FlexPrintLayout;
  parts: FlexMeshPart[];
  /** Clear window on the front panel in UV space (alphaMap it on the front material). */
  windowUv?: { u0: number; v0: number; u1: number; v1: number };
}

type V3 = [number, number, number];

const EPS = FILM_THICKNESS_MM;

function panelOf(layout: FlexPrintLayout, id: FlexPanelId): FlexPrintPanel {
  const p = layout.panels.find((x) => x.id === id);
  if (!p) throw new Error(`panel ${id} missing in layout`);
  return p;
}

/**
 * Indexed grid: pos[i][j] with i up the pack and j left-to-right as seen from outside, so the
 * triangles (i,j)-(i,j+1)-(i+1,j) face outward.
 */
function grid(pos: V3[][], uv: [number, number][][], uv1?: [number, number][][]): BufferGeometry {
  const rows = pos.length;
  const cols = pos[0].length;
  const p = new Float32Array(rows * cols * 3);
  const t = new Float32Array(rows * cols * 2);
  const t1 = uv1 ? new Float32Array(rows * cols * 2) : undefined;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const k = i * cols + j;
      p.set(pos[i][j], k * 3);
      t.set(uv[i][j], k * 2);
      if (t1 && uv1) t1.set(uv1[i][j], k * 2);
    }
  const idx: number[] = [];
  for (let i = 0; i < rows - 1; i++)
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(p, 3));
  g.setAttribute("uv", new BufferAttribute(t, 2));
  if (t1) g.setAttribute("uv1", new BufferAttribute(t1, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** Reverse triangle winding (back faces of flat seal parts). */
function flipWinding(g: BufferGeometry) {
  const index = g.getIndex();
  if (!index) return;
  const a = index.array as Uint16Array | Uint32Array;
  for (let i = 0; i < a.length; i += 3) {
    const tmp = a[i + 1];
    a[i + 1] = a[i + 2];
    a[i + 2] = tmp;
  }
  index.needsUpdate = true;
}

function transformPositions(g: BufferGeometry, f: (p: V3) => V3) {
  const pos = g.getAttribute("position") as BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const q = f([pos.getX(i), pos.getY(i), pos.getZ(i)]);
    pos.setXYZ(i, q[0], q[1], q[2]);
  }
  pos.needsUpdate = true;
}

function finalizeGeometry(g: BufferGeometry, shape: FlexShape): BufferGeometry {
  if (shape.horizontal) transformPositions(g, (p) => orient(shape, p));
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------------------------------------
// Faces
// ---------------------------------------------------------------------------------------------

function faceParts(shape: FlexShape, layout: FlexPrintLayout): FlexMeshPart[] {
  const parts: FlexMeshPart[] = [];
  const ids = shape.rows[0].strips.map((s) => s.panel);
  for (const id of ids) {
    const panel = panelOf(layout, id);
    const pos: V3[][] = [];
    const uv: [number, number][][] = [];
    for (const row of shape.rows) {
      const strip = row.strips.find((s) => s.panel === id)!;
      pos.push(strip.pts.map((p) => [p.x, row.y, p.z] as V3));
      uv.push(strip.pts.map((p) => panelUv(panel, p.s, row.tFlat)));
    }
    parts.push({ id: `face-${id}`, role: "face", panel: id, doubleSided: shape.model === "sleeve", geometry: finalizeGeometry(grid(pos, uv), shape) });
  }
  return parts;
}

// ---------------------------------------------------------------------------------------------
// Seals (flat, two plies, crimped)
// ---------------------------------------------------------------------------------------------

interface StripFeatures {
  notch: boolean;
  corners: number;
  hangHole: FlexConfig["options"]["hangHole"];
  chamferRight: number;
}

/** Outline of a flat end seal band between y0 and y1 across the full face width W. */
function endSealShape(W: number, y0: number, y1: number, f: StripFeatures, roundTop: boolean): Shape {
  const L = -W / 2;
  const R = W / 2;
  const h = y1 - y0;
  const rr = Math.min(f.corners, h * 0.95, W / 4);
  const notchY = y0 + h * 0.45;
  const nd = Math.min(TEAR_NOTCH_DEPTH_MM, W / 6);
  const nh = Math.min(TEAR_NOTCH_HEIGHT_MM, h * 0.6) / 2;
  const s = new Shape();
  // corners on the outer edge only: top corners for the top seal, bottom corners for the bottom seal
  const rb = roundTop ? 0 : rr;
  const rt = roundTop ? rr : 0;
  s.moveTo(L + rb, y0);
  s.lineTo(R - rb, y0);
  if (rb > 0) s.absarc(R - rb, y0 + rb, rb, -Math.PI / 2, 0, false);
  if (f.notch) {
    s.lineTo(R, notchY - nh);
    s.lineTo(R - nd, notchY);
    s.lineTo(R, notchY + nh);
  }
  if (f.chamferRight > 0) {
    s.lineTo(R, y1 - f.chamferRight);
    s.lineTo(R - f.chamferRight, y1);
  } else {
    s.lineTo(R, y1 - rt);
    if (rt > 0) s.absarc(R - rt, y1 - rt, rt, 0, Math.PI / 2, false);
  }
  s.lineTo(L + rt, y1);
  if (rt > 0) s.absarc(L + rt, y1 - rt, rt, Math.PI / 2, Math.PI, false);
  if (f.notch) {
    s.lineTo(L, notchY + nh);
    s.lineTo(L + nd, notchY);
    s.lineTo(L, notchY - nh);
  }
  s.lineTo(L, y0 + rb);
  if (rb > 0) s.absarc(L + rb, y0 + rb, rb, Math.PI, (3 * Math.PI) / 2, false);
  if (f.hangHole !== "none") {
    const cy = (y0 + y1) / 2;
    const hole = new Path();
    if (f.hangHole === "round") {
      hole.absarc(0, cy, HANG_HOLE_ROUND_D_MM / 2, 0, Math.PI * 2, true);
    } else {
      const hw = HANG_HOLE_EURO.w / 2;
      const hr = HANG_HOLE_EURO.h / 2;
      hole.moveTo(-hw + hr, cy - hr);
      hole.absarc(-hw + hr, cy, hr, -Math.PI / 2, -(3 * Math.PI) / 2, true);
      hole.lineTo(hw - hr, cy + hr);
      hole.absarc(hw - hr, cy, hr, Math.PI / 2, -Math.PI / 2, true);
      hole.lineTo(-hw + hr, cy - hr);
    }
    s.holes.push(hole);
  }
  return s;
}

/** Two-sided flat part from a planar shape: front ply at +z (front panel UV), back ply at -z. */
function flatPlies(
  shape: FlexShape,
  layout: FlexPrintLayout,
  outline: Shape,
  flat: (x: number, y: number) => { s: number; t: number },
  id: string,
  pitch: number,
  crimpAcross: boolean,
): FlexMeshPart[] {
  const out: FlexMeshPart[] = [];
  const W = shape.faceW;
  for (const side of ["front", "back"] as const) {
    const g = new ShapeGeometry(outline, 12);
    const pos = g.getAttribute("position") as BufferAttribute;
    const panel = panelOf(layout, side);
    const uv = new Float32Array(pos.count * 2);
    const uv1 = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const f = flat(x, y);
      const s = side === "front" ? f.s : W - f.s;
      const [u, v] = panelUv(panel, s, f.t);
      uv[i * 2] = u;
      uv[i * 2 + 1] = v;
      const p = pitch > 0 ? pitch : 1e6;
      uv1[i * 2] = (crimpAcross ? x : y) / p;
      uv1[i * 2 + 1] = (crimpAcross ? y : x) / p;
      pos.setZ(i, side === "front" ? EPS : -EPS);
    }
    g.setAttribute("uv", new BufferAttribute(uv, 2));
    g.setAttribute("uv1", new BufferAttribute(uv1, 2));
    if (side === "back") flipWinding(g);
    out.push({ id: `${id}-${side}`, role: "seal", panel: side, geometry: finalizeGeometry(g, shape) });
  }
  return out;
}

function sealParts(shape: FlexShape, layout: FlexPrintLayout): FlexMeshPart[] {
  if (shape.model === "sleeve") return [];
  const cfg = shape.config;
  const c = definitionFor(cfg.code).construction;
  const o = cfg.options;
  const W = shape.faceW;
  const H = shape.faceH;
  const { top, bottom, side } = shape.seals;
  const minSeal = Math.min(...[top, bottom || top, side || top].filter((v) => v > 0));
  const corners = o.roundCorners ? Math.min(ROUND_CORNER_R_MM, minSeal) : 0;
  const pitch = c.crimpPitchMm;
  const parts: FlexMeshPart[] = [];
  const fold = baseFoldMm(cfg);

  if (top > 0) {
    const y0 = shape.bodyTopY;
    const y1 = shape.topY;
    const outline = endSealShape(W, y0, y1, { notch: o.tearNotch, corners, hangHole: o.hangHole, chamferRight: o.spout === "corner" ? top * 0.9 : 0 }, true);
    parts.push(...flatPlies(shape, layout, outline, (x, y) => ({ s: x + W / 2, t: y1 - y }), "seal-top", pitch, true));
  }
  if (bottom > 0) {
    const outline = endSealShape(W, 0, bottom, { notch: false, corners, hangHole: "none", chamferRight: 0 }, false);
    parts.push(...flatPlies(shape, layout, outline, (x, y) => ({ s: x + W / 2, t: H - fold - y }), "seal-bottom", pitch, true));
  }
  if (side > 0) {
    for (const sign of [1, -1] as const) {
      for (const ply of ["front", "back"] as const) {
        const panel = panelOf(layout, ply);
        const pos: V3[][] = [];
        const uv: [number, number][][] = [];
        const uv1: [number, number][][] = [];
        for (const row of shape.rows) {
          const a = Math.abs(row.strips[0].pts[row.strips[0].pts.length - 1].x);
          const z = ply === "front" ? EPS : -EPS;
          // j runs left-to-right as seen from this ply's outside
          const xs = ply === "front" ? (sign > 0 ? [a, a + side] : [-a - side, -a]) : sign > 0 ? [a + side, a] : [-a, -a - side];
          pos.push(xs.map((x) => [x, row.y, z] as V3));
          uv.push(
            xs.map((x) => {
              const sFront = x > 0 ? W - side + (x - a) : x + a + side;
              return panelUv(panel, ply === "front" ? sFront : W - sFront, row.tFlat);
            }),
          );
          uv1.push(xs.map((x) => [row.y / (pitch || 1e6), x / (pitch || 1e6)]));
        }
        parts.push({ id: `seal-side-${sign > 0 ? "right" : "left"}-${ply}`, role: "seal", panel: ply, geometry: finalizeGeometry(grid(pos, uv, uv1), shape) });
      }
    }
  }
  return parts;
}

// ---------------------------------------------------------------------------------------------
// Fins (centre back seal, corner seals)
// ---------------------------------------------------------------------------------------------

function finParts(shape: FlexShape, layout: FlexPrintLayout): FlexMeshPart[] {
  const cfg = shape.config;
  const c = definitionFor(cfg.code).construction;
  const parts: FlexMeshPart[] = [];
  const W = shape.faceW;
  if (c.backFin > 0 && shape.model !== "sleeve") {
    const back = panelOf(layout, "back");
    const pos: V3[][] = [];
    const uv: [number, number][][] = [];
    const cols = 4;
    const lift = 0.5;
    const addFlat = (y: number, t: number) => {
      const row: V3[] = [];
      const ru: [number, number][] = [];
      for (let j = 0; j <= cols; j++) {
        const s = W / 2 - c.backFin + (c.backFin * j) / cols;
        row.push([W / 2 - s, y, -EPS - lift]);
        ru.push(panelUv(back, s, t));
      }
      pos.push(row);
      uv.push(ru);
    };
    if (shape.seals.bottom > 0) addFlat(0, shape.faceH);
    for (const r of shape.rows) {
      const row: V3[] = [];
      const ru: [number, number][] = [];
      for (let j = 0; j <= cols; j++) {
        const s = W / 2 - c.backFin + (c.backFin * j) / cols;
        const q = panelPoint(shape, "back", s, r.tFlat);
        const p = q ? q.p : ([W / 2 - s, r.y, 0] as V3);
        const n = q ? q.n : ([0, 0, -1] as V3);
        row.push([p[0] + n[0] * lift, r.y, p[2] + n[2] * lift]);
        ru.push(panelUv(back, s, r.tFlat));
      }
      pos.push(row);
      uv.push(ru);
    }
    if (shape.seals.top > 0) addFlat(shape.topY, 0);
    parts.push({ id: "fin-back", role: "fin", panel: "back", doubleSided: true, geometry: finalizeGeometry(grid(pos, uv), shape) });
  }
  if (c.cornerFins > 0 && shape.model === "box") {
    const f = c.cornerFins;
    const G = cfg.dims.G ?? 0;
    for (const [sx, sz, panel, sEdge] of [
      [1, 1, "gussetRight", 0],
      [1, -1, "gussetRight", G],
      [-1, -1, "gussetLeft", 0],
      [-1, 1, "gussetLeft", G],
    ] as const) {
      const pnl = panelOf(layout, panel);
      const pos: V3[][] = [];
      const uv: [number, number][][] = [];
      for (const r of shape.rows) {
        const fr = r.strips[0].pts;
        const corner = sx > 0 ? fr[fr.length - 1] : fr[0];
        const cz = Math.abs(corner.z);
        const ax = Math.abs(corner.x);
        const dx = sx * Math.SQRT1_2;
        const dz = sz * Math.SQRT1_2;
        const p0: V3 = [sx * ax, r.y, sz * cz];
        const p1: V3 = [p0[0] + dx * f, r.y, p0[2] + dz * f];
        pos.push(sx * sz > 0 ? [p0, p1] : [p1, p0]);
        const u = panelUv(pnl, sEdge, r.tFlat);
        uv.push([u, u]);
      }
      parts.push({ id: `fin-corner-${sx > 0 ? "r" : "l"}${sz > 0 ? "f" : "b"}`, role: "fin", panel, doubleSided: true, geometry: finalizeGeometry(grid(pos, uv), shape) });
    }
  }
  return parts;
}

// ---------------------------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------------------------

function baseParts(shape: FlexShape, layout: FlexPrintLayout): FlexMeshPart[] {
  const b = shape.base;
  if (!b) return [];
  const cfg = shape.config;
  const W = shape.faceW;
  const H = shape.faceH;
  const G = cfg.dims.G ?? 0;
  const y = 0.05;
  const parts: FlexMeshPart[] = [];
  const pieces: { id: string; panel: FlexPanelId; zSign: number }[] = [];
  const hasBottomPanel = layout.panels.some((p) => p.id === "bottom");
  if (hasBottomPanel) pieces.push({ id: "base", panel: "bottom", zSign: 0 });
  else pieces.push({ id: "base-front", panel: "front", zSign: 1 }, { id: "base-back", panel: "back", zSign: -1 });
  const nx = 24;
  const nz = 12;
  for (const piece of pieces) {
    const panel = panelOf(layout, piece.panel);
    const pos: V3[][] = [];
    const uv: [number, number][][] = [];
    // i runs from back (-z) to front (+z) under the pack, j from -x to +x: the grid faces down (-y)
    for (let i = 0; i <= nz; i++) {
      const fz = i / nz;
      const zLo = piece.zSign > 0 ? 0 : -1;
      const zHi = piece.zSign < 0 ? 0 : 1;
      const zn = zLo + (zHi - zLo) * fz;
      const row: V3[] = [];
      const ru: [number, number][] = [];
      for (let j = 0; j <= nx; j++) {
        const xn = -1 + (2 * j) / nx;
        let x: number;
        let z: number;
        if (b.kind === "oval") {
          const half = Math.sqrt(Math.max(0, 1 - zn * zn));
          x = xn * b.a * half;
          z = zn * b.b;
        } else {
          x = xn * b.a;
          z = zn * b.c;
        }
        row.push([x, y, z]);
        if (piece.panel === "bottom") {
          const side = shape.seals.side;
          const s = side + ((xn + 1) / 2) * (W - 2 * side);
          ru.push(panelUv(panel, s, ((1 - zn) / 2) * G));
        } else {
          const s = piece.zSign > 0 ? ((xn + 1) / 2) * W : ((1 - xn) / 2) * W;
          ru.push(panelUv(panel, s, H - Math.abs(zn) * (G / 2)));
        }
      }
      pos.push(row);
      uv.push(ru);
    }
    parts.push({ id: piece.id, role: "base", panel: piece.panel, geometry: finalizeGeometry(grid(pos, uv), shape) });
  }
  return parts;
}

// ---------------------------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------------------------

/** Surface-following band on a panel between flat t0..t1 and s0..s1, lifted along the normal. */
function surfaceBand(shape: FlexShape, panel: FlexPanelId, s0: number, s1: number, t0: number, t1: number, lift: (fv: number) => number, cols = 24, rows = 4): V3[][] | null {
  const pos: V3[][] = [];
  for (let i = 0; i <= rows; i++) {
    // i goes up the pack: t decreases
    const fv = i / rows;
    const t = t1 + (t0 - t1) * fv;
    const row: V3[] = [];
    for (let j = 0; j <= cols; j++) {
      const s = s0 + ((s1 - s0) * j) / cols;
      const q = panelPoint(shape, panel, s, t);
      if (!q) return null;
      const l = lift(fv);
      row.push([q.p[0] + q.n[0] * l, q.p[1] + q.n[1] * l, q.p[2] + q.n[2] * l]);
    }
    pos.push(row);
  }
  return pos;
}

const plainUv = (pos: V3[][]) => pos.map((r, i) => r.map((_, j) => [j / (r.length - 1), i / (pos.length - 1)] as [number, number]));

function placeCylinder(g: BufferGeometry, at: V3, axis: V3, lift: number): BufferGeometry {
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...axis).normalize());
  g.applyQuaternion(q);
  g.translate(at[0] + axis[0] * lift, at[1] + axis[1] * lift, at[2] + axis[2] * lift);
  return g;
}

function featureParts(shape: FlexShape, layout: FlexPrintLayout): FlexMeshPart[] {
  const cfg = shape.config;
  const o = cfg.options;
  const W = shape.faceW;
  const top = shape.seals.top;
  const parts: FlexMeshPart[] = [];
  const side = shape.seals.side;

  if (o.zipper) {
    const t = top + ZIPPER_BELOW_TOP_SEAL_MM;
    for (const panel of ["front", "back"] as const) {
      const pos = surfaceBand(shape, panel, side, W - side, t - 2, t + 2, (fv) => 0.9 * Math.sin(Math.PI * fv), 32, 6);
      if (pos) parts.push({ id: `zipper-${panel}`, role: "zipper", panel, geometry: finalizeGeometry(grid(pos, pos.map((r) => r.map(() => panelUv(panelOf(layout, panel), W / 2, t)))), shape) });
    }
  }
  if (o.tinTie) {
    const t0 = top + TIN_TIE.belowTopSealMm;
    const pos = surfaceBand(shape, "front", -TIN_TIE.overhangMm, W + TIN_TIE.overhangMm, t0, t0 + TIN_TIE.widthMm, () => 0.6, 32, 2);
    if (pos) parts.push({ id: "tin-tie", role: "tinTie", doubleSided: true, geometry: finalizeGeometry(grid(pos, plainUv(pos)), shape) });
  }
  if (o.valve) {
    const q = panelPoint(shape, "front", W / 2, VALVE_BELOW_TOP_MM);
    if (q) {
      const base = placeCylinder(new CylinderGeometry(VALVE_D_MM / 2, VALVE_D_MM / 2, VALVE_HEIGHT_MM, 40), q.p, q.n, VALVE_HEIGHT_MM / 2);
      const cap = placeCylinder(new CylinderGeometry(VALVE_D_MM * 0.22, VALVE_D_MM * 0.22, VALVE_HEIGHT_MM * 1.6, 24), q.p, q.n, VALVE_HEIGHT_MM * 0.8);
      parts.push({ id: "valve", role: "valve", geometry: finalizeGeometry(base, shape) }, { id: "valve-cap", role: "valve", geometry: finalizeGeometry(cap, shape) });
    }
  }
  if (o.spout !== "none") {
    let at: V3;
    let axis: V3;
    let neckD: number = SPOUT.neckDMm;
    let capD: number = SPOUT.capDMm;
    let h: number = SPOUT.heightMm;
    if (o.spout === "corner") {
      const ch = top * 0.9;
      at = [W / 2 - ch / 2, shape.topY - ch / 2, 0];
      axis = [Math.SQRT1_2, Math.SQRT1_2, 0];
    } else if (o.spout === "top") {
      at = [0, shape.topY - 2, 0];
      axis = [0, 1, 0];
    } else {
      const q = panelPoint(shape, "front", W / 2, top + 40) ?? { p: [0, shape.bodyTopY - 40, 10] as V3, n: [0, 0, 1] as V3 };
      at = q.p;
      axis = q.n;
      neckD = BIB_GLAND.neckDMm;
      capD = BIB_GLAND.capDMm;
      h = BIB_GLAND.heightMm;
    }
    const neck = placeCylinder(new CylinderGeometry(neckD / 2, neckD / 2, h * 0.4, 32), at, axis, h * 0.2);
    const cap = placeCylinder(new CylinderGeometry(capD / 2, capD / 2, h * 0.6, 32), at, axis, h * 0.7);
    parts.push({ id: "spout-neck", role: "spout", geometry: finalizeGeometry(neck, shape) }, { id: "spout-cap", role: "spout", geometry: finalizeGeometry(cap, shape) });
  }
  if (o.adhesiveFlap) {
    const pos = surfaceBand(shape, "front", side, W - side, 0, Math.min(MAILER_FLAP_MM, shape.faceH * 0.3), () => 0.5, 24, 6);
    if (pos) parts.push({ id: "flap", role: "flap", doubleSided: true, geometry: finalizeGeometry(grid(pos, plainUv(pos)), shape) });
  }
  return parts;
}

// ---------------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------------

/** Build every mesh part of a configured flexible pack. */
export function buildFlexibleModel(cfg: FlexConfig): FlexModel {
  const shape = solveShape(cfg);
  const layout = printLayout(cfg);
  const parts = [...faceParts(shape, layout), ...sealParts(shape, layout), ...finParts(shape, layout), ...baseParts(shape, layout), ...featureParts(shape, layout)];
  const front = layout.panels.find((p) => p.id === "front");
  return { config: cfg, shape, layout, parts, windowUv: front?.window ? rectUv(front, front.window) : undefined };
}

/**
 * Crimp normal map: fine serrations (one ridge per texel row repeat). Seal parts carry `uv1` in
 * crimp pitches, so set `texture.channel = 1` (done here) and use it as the seal normalMap.
 */
export function crimpNormalTexture(size = 32): DataTexture {
  const data = new Uint8Array(size * 4 * 4);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < size; x++) {
      const slope = Math.cos((2 * Math.PI * x) / size);
      const nx = slope * 0.7;
      const nz = Math.sqrt(1 - nx * nx);
      const k = (y * size + x) * 4;
      data[k] = Math.round((nx * 0.5 + 0.5) * 255);
      data[k + 1] = 128;
      data[k + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[k + 3] = 255;
    }
  const tex = new DataTexture(data, size, 4, RGBAFormat);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.channel = 1;
  tex.needsUpdate = true;
  return tex;
}
