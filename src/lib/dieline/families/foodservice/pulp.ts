import type { Mm } from "@/types";
import type { MeshData, PrintArea, PulpDims, PulpLayout } from "./types";

/**
 * Molded pulp (egg cartons, egg flats, cup carriers, fruit trays) as a height-field shell:
 * y = f(x, z) over the outer footprint. Molded fibre is not printed directly at scale, so the
 * only print surface is the paper slip label on an egg-carton lid (a rectangle with bleed and
 * safe zone). Coordinates: mm, Y up, footprint centred on the origin, front toward +Z.
 */
export interface PulpModel {
  dims: PulpDims;
  layout: PulpLayout;
  /** Cell centres (x, z) and opening radius. */
  cells: { x: Mm; z: Mm }[];
  cellRadiusMm: Mm;
  /** Height of the base tray (cells); = H for lidless parts. */
  baseHeightMm: Mm;
  /** Lid height above the base when closed (0 without lid). */
  lidHeightMm: Mm;
  /** Height at a point of the base (cells / rim / posts). */
  baseHeight: (x: Mm, z: Mm) => Mm;
  /** Lid label (paper slip label on the lid top). */
  label: PrintArea | null;
  label3d: { y: Mm; x0: Mm; x1: Mm; z0: Mm; z1: Mm } | null;
}

export const PULP_WALL_MM = 1.6;
export const PULP_RIM_MM = 6;

export function buildPulp(dims: PulpDims, layout: PulpLayout, bleed = 3, safe = 3): PulpModel {
  const { rows, cols } = layout;
  const baseH = layout.lid ? dims.H * 0.55 : dims.H;
  const lidH = layout.lid ? dims.H - baseH : 0;
  const innerL = dims.L - 2 * PULP_RIM_MM;
  const innerW = dims.W - 2 * PULP_RIM_MM;
  const px = innerL / cols;
  const pz = innerW / rows;
  const rc = (Math.min(px, pz) / 2) * layout.cellRatio;
  const cells: { x: number; z: number }[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ x: -innerL / 2 + (c + 0.5) * px, z: -innerW / 2 + (r + 0.5) * pz });
  const rimY = layout.posts ? baseH * 0.7 : baseH;
  const baseHeight = (x: number, z: number) => {
    if (Math.abs(x) > dims.L / 2 + 1e-6 || Math.abs(z) > dims.W / 2 + 1e-6) return 0;
    // Outer skirt slopes down to the table on the last 2 mm.
    const edge = Math.min(dims.L / 2 - Math.abs(x), dims.W / 2 - Math.abs(z));
    if (edge < 2) return rimY * Math.max(0, edge / 2);
    // Nearest cell → bowl profile.
    const c = Math.floor((x + innerL / 2) / px);
    const r = Math.floor((z + innerW / 2) / pz);
    let y = rimY;
    if (c >= 0 && c < cols && r >= 0 && r < rows) {
      const cx = -innerL / 2 + (c + 0.5) * px;
      const cz = -innerW / 2 + (r + 0.5) * pz;
      const d = Math.hypot(x - cx, z - cz);
      if (d < rc) y = PULP_WALL_MM + (rimY - PULP_WALL_MM) * Math.pow(d / rc, 1.6);
      // Posts between four cells (egg flats): cones rising to the full height.
      if (layout.posts) {
        const gx = Math.round((x + innerL / 2) / px);
        const gz = Math.round((z + innerW / 2) / pz);
        if (gx > 0 && gx < cols && gz > 0 && gz < rows) {
          const dp = Math.hypot(x - (-innerL / 2 + gx * px), z - (-innerW / 2 + gz * pz));
          const pr = Math.min(px, pz) * 0.22;
          if (dp < pr) y = Math.max(y, rimY + (baseH - rimY) * (1 - dp / pr));
        }
      }
    }
    return y;
  };
  let label: PrintArea | null = null;
  let label3d: PulpModel["label3d"] = null;
  if (layout.lid) {
    const w = dims.L * 0.75;
    const h = dims.W * 0.6;
    const r = (x0: number, y0: number, ww: number, hh: number) => [{ x: x0, y: y0 }, { x: x0 + ww, y: y0 }, { x: x0 + ww, y: y0 + hh }, { x: x0, y: y0 + hh }];
    label = { trim: r(bleed, bleed, w, h), bleed: r(0, 0, w + 2 * bleed, h + 2 * bleed), safe: r(bleed + safe, bleed + safe, w - 2 * safe, h - 2 * safe), widthMm: w + 2 * bleed, heightMm: h + 2 * bleed, bleedMm: bleed, safeMm: safe, trimAreaM2: (w * h) / 1e6 };
    label3d = { y: dims.H, x0: -w / 2, x1: w / 2, z0: -h / 2, z1: h / 2 };
  }
  return { dims: { ...dims }, layout: { ...layout }, cells, cellRadiusMm: rc, baseHeightMm: baseH, lidHeightMm: lidH, baseHeight, label, label3d };
}

/** Lid height field (closed, sits on the base): flat top with 8 mm chamfered edges. */
export function lidHeight(m: PulpModel, x: Mm, z: Mm): Mm {
  if (!m.layout.lid) return 0;
  const edge = Math.min(m.dims.L / 2 - Math.abs(x), m.dims.W / 2 - Math.abs(z));
  if (edge < 0) return m.baseHeightMm;
  const ch = 8;
  return m.baseHeightMm + m.lidHeightMm * Math.min(1, edge / ch);
}

/** Grid mesh of a height field over the footprint (planar top UVs: u along x, v along -z). */
export function heightFieldMesh(m: PulpModel, part: "base" | "lid" = "base", stepMm = 2.5): MeshData {
  const nx = Math.max(8, Math.ceil(m.dims.L / stepMm));
  const nz = Math.max(8, Math.ceil(m.dims.W / stepMm));
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const x = -m.dims.L / 2 + (i / nx) * m.dims.L;
      const z = -m.dims.W / 2 + (j / nz) * m.dims.W;
      const y = part === "base" ? m.baseHeight(x, z) : lidHeight(m, x, z);
      positions.push(x, y, z);
      uvs.push(i / nx, 1 - j / nz);
    }
  const row = nx + 1;
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * row + i;
      indices.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  return { positions: new Float32Array(positions), uvs: new Float32Array(uvs), indices: new Uint32Array(indices) };
}
