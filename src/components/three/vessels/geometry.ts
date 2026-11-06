import { BufferAttribute, BufferGeometry } from "three";
import {
  pouchDims,
  radiusAt,
  squarenessAt,
  surfaceUv,
  tubeDims,
  type CrossSection,
  type LabelSpec,
  type SectionPoint,
  type VesselDims,
  type VesselProfile,
} from "@/lib/vessels";

/**
 * Vessel geometry builders. Everything is in millimetres (the model group is scaled to metres).
 * Normals are analytic (profile tangent x section normal), so lathe seams never show, and the
 * winding is outward-facing (checked in tests). UVs follow the flat print contract in
 * `@/lib/vessels` (surfaceUv), so artwork painted in flat label space wraps without distortion.
 */

export interface Ring {
  y: number;
  r: number;
  /** squareness 0..1 (roundedRect sections) */
  s: number;
  /** outward normal in the profile plane: radial, vertical */
  nr: number;
  ny: number;
  /** cumulative arc length from the first ring */
  arc: number;
}

/** Rings with normals from a profile polyline. */
export function ringsFromPoints(points: { r: number; y: number; s?: number }[]): Ring[] {
  const n = points.length;
  const rings: Ring[] = [];
  let arc = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    if (i > 0) arc += Math.hypot(p.r - points[i - 1].r, p.y - points[i - 1].y);
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    let dr = b.r - a.r;
    let dy = b.y - a.y;
    const len = Math.hypot(dr, dy) || 1;
    dr /= len;
    dy /= len;
    let nr = dy;
    let ny = -dr;
    if (p.r < 1e-6) {
      // on the axis: the surface is horizontal there
      nr = 0;
      ny = ny >= 0 ? 1 : -1;
    }
    rings.push({ y: p.y, r: p.r, s: p.s ?? 1, nr, ny, arc });
  }
  return rings;
}

/** Point + normal of a cross-section at perimeter fraction p (0 = front centre, increasing to the right). */
export function sectionPoint(section: CrossSection, a: number, s: number, p: number, out: { x: number; z: number; nx: number; nz: number }) {
  const phi = p * Math.PI * 2;
  const cx = Math.sin(phi);
  const cz = Math.cos(phi);
  if (section.kind === "round" || s <= 0) {
    out.x = a * cx;
    out.z = a * cz;
    out.nx = cx;
    out.nz = cz;
    return out;
  }
  // rounded rectangle walked by arc length, starting front-centre (+z) towards +x
  const hw = a;
  const hd = a * section.depthRatio;
  const c = Math.max(1e-4, Math.min(a * section.cornerRatio, hw, hd));
  const sx = hw - c;
  const sz = hd - c;
  const q = (Math.PI / 2) * c;
  const segs = [sx, q, 2 * sz, q, 2 * sx, q, 2 * sz, q, sx];
  const total = segs.reduce((x, y) => x + y, 0);
  let d = (((p % 1) + 1) % 1) * total;
  let rx = 0;
  let rz = 0;
  let nx = 0;
  let nz = 1;
  const corner = (cxx: number, czz: number, start: number, t: number) => {
    const ang = start + (t / q) * (Math.PI / 2);
    nx = Math.sin(ang);
    nz = Math.cos(ang);
    rx = cxx + c * nx;
    rz = czz + c * nz;
  };
  if ((d -= segs[0]) < 0) {
    rx = sx + d;
    rz = hd;
  } else if ((d -= segs[1]) < 0) corner(sx, sz, 0, d + q);
  else if ((d -= segs[2]) < 0) {
    rx = hw;
    rz = sz - (2 * sz + d);
    nx = 1;
    nz = 0;
  } else if ((d -= segs[3]) < 0) corner(sx, -sz, Math.PI / 2, d + q);
  else if ((d -= segs[4]) < 0) {
    rx = sx - (2 * sx + d);
    rz = -hd;
    nx = 0;
    nz = -1;
  } else if ((d -= segs[5]) < 0) corner(-sx, -sz, Math.PI, d + q);
  else if ((d -= segs[6]) < 0) {
    rx = -hw;
    rz = -sz + (2 * sz + d);
    nx = -1;
    nz = 0;
  } else if ((d -= segs[7]) < 0) corner(-sx, sz, (3 * Math.PI) / 2, d + q);
  else {
    rx = -sx + (sx + d);
    rz = hd;
    nx = 0;
    nz = 1;
  }
  if (s >= 1) {
    out.x = rx;
    out.z = rz;
    out.nx = nx;
    out.nz = nz;
    return out;
  }
  // blend towards a circle (neck) by squareness
  out.x = a * cx + (rx - a * cx) * s;
  out.z = a * cz + (rz - a * cz) * s;
  const bx = cx + (nx - cx) * s;
  const bz = cz + (nz - cz) * s;
  const l = Math.hypot(bx, bz) || 1;
  out.nx = bx / l;
  out.nz = bz / l;
  return out;
}

export interface RevolveOptions {
  section?: CrossSection;
  segments?: number;
  /** Perimeter fraction where the surface starts (default -0.5 = seam at the back). */
  pStart?: number;
  /** Perimeter fraction covered (default 1). */
  pLength?: number;
  /** Radius offset added to every ring (labels sit slightly proud). */
  offset?: number;
  /** Knurled ribs: count and depth (mm), applied to rings where ribbed(ring) is true. */
  ribs?: { count: number; depth: number; where: (ring: Ring) => boolean };
  /** UV per vertex: s = perimeter fraction 0..1 within the range, t = ring arc fraction 0..1. */
  uv?: (s: number, t: number, ring: Ring) => [number, number];
}

/** Revolve rings around Y. Indexed triangles, outward winding, analytic normals. */
export function revolve(rings: Ring[], opts: RevolveOptions = {}): BufferGeometry {
  const section = opts.section ?? { kind: "round" };
  const seg = opts.segments ?? 96;
  const pStart = opts.pStart ?? -0.5;
  const pLength = opts.pLength ?? 1;
  const off = opts.offset ?? 0;
  const cols = seg + 1;
  const pos = new Float32Array(rings.length * cols * 3);
  const nor = new Float32Array(rings.length * cols * 3);
  const uvs = new Float32Array(rings.length * cols * 2);
  const totalArc = rings[rings.length - 1]?.arc || 1;
  const sp = { x: 0, z: 0, nx: 0, nz: 1 };
  let k = 0;
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    const ribbed = opts.ribs && opts.ribs.where(ring);
    for (let j = 0; j < cols; j++) {
      const s = j / seg;
      const p = pStart + s * pLength;
      let a = ring.r + off;
      let tangentialSlope = 0;
      if (ribbed && opts.ribs) {
        const w = opts.ribs.count * p * Math.PI * 2;
        a += opts.ribs.depth * 0.5 * (1 + Math.cos(w));
        tangentialSlope = (-opts.ribs.depth * 0.5 * opts.ribs.count * Math.sin(w)) / Math.max(a, 1e-3);
      }
      sectionPoint(section, Math.max(0, a), ring.s, p, sp);
      let snx = sp.nx;
      let snz = sp.nz;
      if (tangentialSlope !== 0) {
        // tilt the section normal against the rib slope (polar curve normal)
        const tx = sp.nz;
        const tz = -sp.nx;
        snx = sp.nx - tangentialSlope * tx;
        snz = sp.nz - tangentialSlope * tz;
        const l = Math.hypot(snx, snz) || 1;
        snx /= l;
        snz /= l;
      }
      pos[k * 3] = sp.x;
      pos[k * 3 + 1] = ring.y;
      pos[k * 3 + 2] = sp.z;
      let nx = ring.nr * snx;
      let ny = ring.ny;
      let nz = ring.nr * snz;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l;
      ny /= l;
      nz /= l;
      nor[k * 3] = nx;
      nor[k * 3 + 1] = ny;
      nor[k * 3 + 2] = nz;
      const t = ring.arc / totalArc;
      const [u, v] = opts.uv ? opts.uv(s, t, ring) : [s, t];
      uvs[k * 2] = u;
      uvs[k * 2 + 1] = v;
      k++;
    }
  }
  const index: number[] = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      // skip degenerate quads on the axis
      if (rings[i].r + off < 1e-6 && rings[i + 1].r + off < 1e-6) continue;
      index.push(a, b, c, b, d, c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("normal", new BufferAttribute(nor, 3));
  g.setAttribute("uv", new BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** The container body. */
export function bodyGeometry(profile: VesselProfile, segments = 96): BufferGeometry {
  return revolve(ringsFromPoints(profile.outer as SectionPoint[]), { section: profile.section, segments });
}

/** Interior (product) solid up to the finish; clip it at the fill height with a plane. */
export function liquidGeometry(profile: VesselProfile, segments = 64): BufferGeometry {
  const outer = profile.outer as SectionPoint[];
  const top = profile.fillMaxY + Math.min(4, (profile.finishTopY - profile.fillMaxY) * 0.5);
  const y0 = profile.baseMm + 0.05;
  const n = Math.max(24, Math.round((top - y0) / 1.2));
  const pts: { r: number; y: number; s: number }[] = [{ r: 0, y: y0, s: 1 }];
  for (let i = 0; i <= n; i++) {
    const y = y0 + ((top - y0) * i) / n;
    const r = Math.max(0.2, radiusAt(outer, y) - profile.wallMm - 0.08);
    const s = profile.section.kind === "round" ? 1 : squarenessAt(outer, y);
    pts.push({ r, y, s });
  }
  pts.push({ r: 0, y: top, s: 1 });
  return revolve(ringsFromPoints(pts), { section: profile.section, segments });
}

/** Inner radius (half width) of the product at height y. */
export function innerRadiusAt(profile: VesselProfile, y: number): number {
  return Math.max(0.2, radiusAt(profile.outer, y) - profile.wallMm - 0.08);
}

/** A label band (wrap / front / back / neck) following its frustum, UVs per the flat contract. */
export function bandLabelGeometry(spec: LabelSpec, offset = 0.18, segments = 96): BufferGeometry {
  if (spec.placement.type !== "band") throw new Error("not a band label");
  const { y0, y1, r0, r1, phiStart, phiLength } = spec.placement;
  const rows = 12;
  const pts = Array.from({ length: rows + 1 }, (_, i) => {
    const t = i / rows;
    return { r: r0 + (r1 - r0) * t, y: y0 + (y1 - y0) * t };
  });
  const rings = ringsFromPoints(pts);
  const cols = Math.max(8, Math.round((segments * phiLength) / (Math.PI * 2)));
  return revolve(rings, {
    segments: cols,
    pStart: phiStart / (Math.PI * 2),
    pLength: phiLength / (Math.PI * 2),
    offset,
    uv: (s, t) => surfaceUv(spec, s, t),
  });
}

/** Sleeve rings at uniform arc length along the silhouette (and the loose, unshrunk cylinder). */
export function sleeveRings(profile: VesselProfile, spec: LabelSpec, rows = 90) {
  if (spec.placement.type !== "sleeve" || !spec.sleeve) throw new Error("not a sleeve");
  const { y0, y1 } = spec.placement;
  const samples: { y: number; r: number; arc: number }[] = [];
  let arc = 0;
  let prev: { y: number; r: number } | null = null;
  for (let y = y0; y <= y1 + 1e-9; y += 0.25) {
    const r = radiusAt(profile.outer, Math.min(y, y1));
    if (prev) arc += Math.hypot(r - prev.r, y - prev.y);
    samples.push({ y, r, arc });
    prev = { y, r };
  }
  const total = arc || 1;
  const pts: { r: number; y: number }[] = [];
  let k = 0;
  for (let i = 0; i <= rows; i++) {
    const target = (i / rows) * total;
    while (k < samples.length - 2 && samples[k + 1].arc < target) k++;
    const a = samples[k];
    const b = samples[k + 1] ?? a;
    const f = b.arc > a.arc ? (target - a.arc) / (b.arc - a.arc) : 0;
    pts.push({ r: a.r + (b.r - a.r) * f, y: a.y + (b.y - a.y) * f });
  }
  const looseR = spec.sleeve.circumferenceMm / (2 * Math.PI);
  return { conform: ringsFromPoints(pts), looseR };
}

/**
 * Shrink sleeve geometry plus the "before shrink" positions/normals (a loose cylinder), so the
 * view can animate the heat tunnel by lerping between the two.
 */
export function sleeveGeometry(profile: VesselProfile, spec: LabelSpec, segments = 96) {
  const { conform, looseR } = sleeveRings(profile, spec);
  const uv = (s: number, t: number): [number, number] => surfaceUv(spec, s, t);
  const fitted = revolve(conform, { segments, offset: 0.14, uv });
  const looseRings = conform.map((r) => ({ ...r, r: looseR, nr: 1, ny: 0 }));
  const loose = revolve(looseRings, { segments, uv });
  const target = {
    position: (fitted.getAttribute("position").array as Float32Array).slice(),
    normal: (fitted.getAttribute("normal").array as Float32Array).slice(),
  };
  const start = {
    position: (loose.getAttribute("position").array as Float32Array).slice(),
    normal: (loose.getAttribute("normal").array as Float32Array).slice(),
  };
  loose.dispose();
  return { geometry: fitted, start, target };
}

/** Round label on a lid top, facing up. Its top edge points to the back (reads from the front). */
export function discLabelGeometry(spec: LabelSpec, segments = 72): BufferGeometry {
  if (spec.placement.type !== "disc") throw new Error("not a disc label");
  const { y, radius } = spec.placement;
  const pos: number[] = [0, y, 0];
  const nor: number[] = [0, 1, 0];
  const b = spec.bleedMm;
  const uvAt = (x: number, z: number): [number, number] => [(b + radius + x) / spec.printWidthMm, (b + radius - z) / spec.printHeightMm];
  const uv: number[] = [...uvAt(0, 0)];
  for (let j = 0; j <= segments; j++) {
    const a = (j / segments) * Math.PI * 2;
    const x = radius * Math.sin(a);
    const z = radius * Math.cos(a);
    pos.push(x, y, z);
    nor.push(0, 1, 0);
    uv.push(...uvAt(x, z));
  }
  const index: number[] = [];
  for (let j = 1; j <= segments; j++) index.push(0, j, j + 1);
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(index);
  return g;
}

/** Grid surface helper: f(u, v) -> position; normals by finite differences. */
export function gridSurface(
  cols: number,
  rows: number,
  f: (u: number, v: number) => [number, number, number],
  uvf: (u: number, v: number) => [number, number] = (u, v) => [u, v],
  flip = false,
): BufferGeometry {
  const pos = new Float32Array((cols + 1) * (rows + 1) * 3);
  const nor = new Float32Array((cols + 1) * (rows + 1) * 3);
  const uvs = new Float32Array((cols + 1) * (rows + 1) * 2);
  const e = 1e-3;
  let k = 0;
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= cols; j++) {
      const u = j / cols;
      const v = i / rows;
      const p = f(u, v);
      const pu = f(Math.min(1, u + e), v);
      const pu2 = f(Math.max(0, u - e), v);
      const pv = f(u, Math.min(1, v + e));
      const pv2 = f(u, Math.max(0, v - e));
      const du = [pu[0] - pu2[0], pu[1] - pu2[1], pu[2] - pu2[2]];
      const dv = [pv[0] - pv2[0], pv[1] - pv2[1], pv[2] - pv2[2]];
      let nx = du[1] * dv[2] - du[2] * dv[1];
      let ny = du[2] * dv[0] - du[0] * dv[2];
      let nz = du[0] * dv[1] - du[1] * dv[0];
      const l = Math.hypot(nx, ny, nz) || 1;
      const sg = flip ? -1 : 1;
      nx = (nx / l) * sg;
      ny = (ny / l) * sg;
      nz = (nz / l) * sg;
      pos.set(p, k * 3);
      nor[k * 3] = nx;
      nor[k * 3 + 1] = ny;
      nor[k * 3 + 2] = nz;
      const [uu, vv] = uvf(u, v);
      uvs[k * 2] = uu;
      uvs[k * 2 + 1] = vv;
      k++;
    }
  }
  const index: number[] = [];
  const C = cols + 1;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const a = i * C + j;
      const b = a + 1;
      const c = a + C;
      const d = c + 1;
      if (flip) index.push(a, c, b, b, c, d);
      else index.push(a, b, c, b, d, c);
    }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("normal", new BufferAttribute(nor, 3));
  g.setAttribute("uv", new BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------------------------------------
// Stand-up pouch
// ---------------------------------------------------------------------------------------------

/** Half depth of a filled pouch at (x, y) in mm (z of the front panel). */
export function pouchDepth(dims: VesselDims, x: number, y: number): number {
  const p = pouchDims(dims);
  const fillTop = p.H * 0.8;
  const u = Math.min(1, Math.max(0, y / fillTop));
  const base = (p.G / 2) * Math.pow(1 - u, 0.9);
  const belly = p.G * 0.13 * Math.sin(Math.PI * Math.pow(u, 0.8));
  const across = Math.max(0, 1 - Math.pow((2 * x) / p.W, 2));
  // the side seals stay flat for a few mm
  const seal = Math.min(1, Math.max(0, (p.W / 2 - Math.abs(x)) / p.sideSeal));
  return (base + belly) * Math.sqrt(across) * seal + 0.35;
}

export function pouchPanelGeometry(dims: VesselDims, face: "front" | "back"): BufferGeometry {
  const p = pouchDims(dims);
  const sign = face === "front" ? 1 : -1;
  return gridSurface(
    48,
    64,
    (u, v) => {
      const x = (u - 0.5) * p.W * sign;
      const y = v * p.H;
      return [x, y, sign * pouchDepth(dims, x, y)];
    },
    (u, v) => [u, v],
  );
}

/** Oval bottom gusset (seen when looking from below). */
export function pouchBottomGeometry(dims: VesselDims): BufferGeometry {
  const p = pouchDims(dims);
  return gridSurface(
    48,
    8,
    (u, v) => {
      const x = (u - 0.5) * p.W;
      const zMax = pouchDepth(dims, x, 0);
      return [x, 0.2 + 1.5 * Math.sin(Math.PI * v), (v - 0.5) * 2 * zMax];
    },
    (u, v) => [u, v],
  );
}

/** Pouch face label that follows the bulge. */
export function pouchLabelGeometry(dims: VesselDims, spec: LabelSpec): BufferGeometry {
  if (spec.placement.type !== "face") throw new Error("not a face label");
  const { x0, x1, y0, y1, face } = spec.placement;
  const sign = face === "front" ? 1 : -1;
  return gridSurface(
    24,
    24,
    (u, v) => {
      const x = (x0 + (x1 - x0) * u) * sign;
      const y = y0 + (y1 - y0) * v;
      return [x, y, sign * (pouchDepth(dims, x, y) + 0.25)];
    },
    (u, v) => surfaceUv(spec, u, v),
  );
}

/** Flat face label on a square bottle panel. */
export function faceLabelGeometry(spec: LabelSpec, faceZ: number): BufferGeometry {
  if (spec.placement.type !== "face") throw new Error("not a face label");
  const { x0, x1, y0, y1, face } = spec.placement;
  const sign = face === "front" ? 1 : -1;
  return gridSurface(
    2,
    2,
    (u, v) => [(x0 + (x1 - x0) * u) * sign, y0 + (y1 - y0) * v, sign * (faceZ + 0.18)],
    (u, v) => surfaceUv(spec, u, v),
  );
}

// ---------------------------------------------------------------------------------------------
// Squeeze tube (stands on its cap; flattens into the crimp seal at the top)
// ---------------------------------------------------------------------------------------------

export function tubeBodyGeometry(dims: VesselDims, spec?: LabelSpec, segments = 96): BufferGeometry {
  const t = tubeDims(dims);
  // oval tubes (G < D): the body is elliptical (b = G/2) and still flattens into the crimp
  const ov = dims.G && dims.D ? Math.min(1, Math.max(0.2, dims.G / dims.D)) : 1;
  const rows = 70;
  const morphStart = t.bodyY0 + (t.sealY0 - t.bodyY0) * 0.32;
  const ringAt = (i: number) => {
    const f = i / rows;
    const y = t.capH + (t.totalH - t.capH) * f;
    let a: number;
    let b: number;
    if (y <= t.bodyY0) {
      // conical shoulder from the nozzle to the body
      const k = (y - t.capH) / (t.bodyY0 - t.capH);
      const e = Math.sin((k * Math.PI) / 2);
      a = t.nozzleR + (t.R - t.nozzleR) * e;
      b = a * (1 + (ov - 1) * e); // round at the nozzle, oval at the body
    } else {
      const m = Math.min(1, Math.max(0, (y - morphStart) / (t.sealY0 - morphStart)));
      const sm = m * m * (3 - 2 * m);
      a = t.R * (1 + (Math.PI / 2 - 1) * sm);
      b = Math.max(0.5, t.R * ov * (1 - sm));
    }
    return { y, a, b };
  };
  const cols = segments + 1;
  const pos = new Float32Array((rows + 1) * cols * 3);
  const uvs = new Float32Array((rows + 1) * cols * 2);
  let k = 0;
  for (let i = 0; i <= rows; i++) {
    const { y, a, b } = ringAt(i);
    for (let j = 0; j < cols; j++) {
      const s = j / segments;
      const phi = (s - 0.5) * Math.PI * 2;
      pos[k * 3] = a * Math.sin(phi);
      pos[k * 3 + 1] = y;
      pos[k * 3 + 2] = b * Math.cos(phi);
      let u = s;
      let v = (y - t.capH) / (t.totalH - t.capH);
      if (spec && spec.placement.type === "band") {
        const tt = (y - spec.placement.y0) / (spec.placement.y1 - spec.placement.y0);
        [u, v] = surfaceUv(spec, s, Math.min(1.04, Math.max(-0.04, tt)));
      }
      uvs[k * 2] = u;
      uvs[k * 2 + 1] = v;
      k++;
    }
  }
  const index: number[] = [];
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < segments; j++) {
      const a0 = i * cols + j;
      index.push(a0, a0 + 1, a0 + cols, a0 + 1, a0 + cols + 1, a0 + cols);
    }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("uv", new BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  // weld the seam (first and last column share a position) so it does not show
  const nor = g.getAttribute("normal") as BufferAttribute;
  for (let i = 0; i <= rows; i++) {
    const a = i * cols;
    const b = a + segments;
    const x = nor.getX(a) + nor.getX(b);
    const y = nor.getY(a) + nor.getY(b);
    const z = nor.getZ(a) + nor.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    nor.setXYZ(a, x / l, y / l, z / l);
    nor.setXYZ(b, x / l, y / l, z / l);
  }
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** Check (tests/dev): fraction of triangles whose winding agrees with the stored vertex normals. */
export function outwardWindingRatio(g: BufferGeometry): number {
  const pos = g.getAttribute("position");
  const nor = g.getAttribute("normal");
  const idx = g.getIndex();
  if (!idx) return 1;
  let ok = 0;
  let total = 0;
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i);
    const b = idx.getX(i + 1);
    const c = idx.getX(i + 2);
    const ax = pos.getX(a);
    const ay = pos.getY(a);
    const az = pos.getZ(a);
    const ux = pos.getX(b) - ax;
    const uy = pos.getY(b) - ay;
    const uz = pos.getZ(b) - az;
    const vx = pos.getX(c) - ax;
    const vy = pos.getY(c) - ay;
    const vz = pos.getZ(c) - az;
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    const len = Math.hypot(cx, cy, cz);
    if (len < 1e-9) continue;
    const nx = nor.getX(a) + nor.getX(b) + nor.getX(c);
    const ny = nor.getY(a) + nor.getY(b) + nor.getY(c);
    const nz = nor.getZ(a) + nor.getZ(b) + nor.getZ(c);
    total++;
    if (cx * nx + cy * ny + cz * nz > 0) ok++;
  }
  return total ? ok / total : 1;
}
