import { Vector3 } from "three";
import type { Dims, StructureFeatures } from "@/types";
import { DielineBuilder, insetSeg, rectEdges } from "../../builder";
import { cutWindow } from "../../features";
import { bboxOf, clamp, insetRect, pt, rectPolygon } from "../../geometry";
import type { DielinePanel, PanelRole, Polygon, Pt } from "../../types";
import { IDENTITY, blockFace, deg, glueWidth, ngonOnEdge, orientClosed, quat, rect } from "./kit";
import type { EcmaDraft } from "./types";

/* ───────────────────────── C10.40 / C10.50 polygonal cartons ───────────────────────── */

/** Side length of a regular n-gon with the given across-flats size. */
export const ngonSide = (acrossFlats: number, n: number) => acrossFlats * Math.tan(Math.PI / n);

/**
 * Long-seam-glued regular prism (hexagon n = 6, octagon n = 8), ECMA Group C body 10
 * (rectangular solid), basis 40 (6-cornered) / 50 (8-cornered).
 * L = W = inner across-flats size, H = inner height.
 * Closure "tuck": polygon lid with tuck + reduced dust flaps (closure code 20).
 * Closure "cover": polygon lid fully covering + reduced flaps, no tuck (closure code 11).
 * Top lid hinged on the back panel, bottom lid on the front (reverse arrangement).
 */
export function polygonalCarton(dims: Dims, t: number, n: 6 | 8, closure: "tuck" | "cover", f: StructureFeatures = {}): EcmaDraft {
  const a = ngonSide(dims.L + 2 * t, n);
  const Hp = dims.H + 4 * t;
  const fold = 360 / n;
  const half = n / 2;
  const g = glueWidth(a);
  const b = new DielineBuilder();
  const id = (k: number) => (k === 0 ? "front" : k === half ? "back" : `side${k}`);
  // Oblique panels get the neutral "inner" role (no FaceId).
  const role = (k: number): PanelRole => (k === 0 ? "front" : k === half ? "back" : n === 8 && k === 2 ? "right" : n === 8 && k === 6 ? "left" : "inner");
  const panelRect = (k: number) => rect(k <= half ? k * a : -(n - k) * a, 0, a, Hp);
  b.root("front", "front", rectPolygon(0, 0, a, Hp), "Front");
  for (let k = 1; k <= half; k++) {
    b.attach(id(k), role(k), id(k - 1), rectEdges(panelRect(k - 1)).right, a, { kind: "rect" }, { fold, stage: 0, label: `Side panel ${k}` });
  }
  for (let k = n - 1; k > half; k--) {
    const parent = k === n - 1 ? "front" : id(k + 1);
    b.attach(id(k), role(k), parent, rectEdges(panelRect(k === n - 1 ? 0 : k + 1)).left, a, { kind: "rect" }, { fold, stage: 0, label: `Side panel ${k}` });
  }
  const last = id(half + 1);
  b.attach("glue", "glue", last, rectEdges(panelRect(half + 1)).left, g, { kind: "trapezoid", taperA: g * 0.6, taperB: g * 0.6 }, { fold, stage: 0, stack: -1, label: "Glue flap" });

  const closureAt = (where: "top" | "bottom", owner: number) => {
    const r = panelRect(owner);
    const hinge = where === "top" ? rectEdges(r).top : rectEdges(r).bottom;
    const poly = ngonOnEdge(b, id(owner), hinge, n, t + 0.3);
    b.attachPoly(where, where, id(owner), hinge, poly, { stage: 2, label: where === "top" ? "Top lid" : "Bottom lid" });
    if (closure === "tuck") {
      const far: [Pt, Pt] = [poly[half], poly[half + 1]];
      const td = clamp(a * 0.6, 10, 30);
      b.attach(`${where}Tuck`, "tuck", where, insetSeg(far, t + 0.5), td, { kind: "tuck", shoulder: 1 }, { stage: 2, stack: -1, label: "Tuck flap" });
    }
    for (let k = 0; k < n; k++) {
      if (k === owner) continue;
      if (closure === "tuck" && k === (owner + half) % n) continue; // the tuck goes there
      const rk = panelRect(k);
      const e = where === "top" ? rectEdges(rk).top : rectEdges(rk).bottom;
      const d = Math.min(a * 0.32, 25);
      b.attach(`${where}Dust${k}`, "dust", id(k), insetSeg(e, 0.5), d, { kind: "trapezoid", taperA: d * 0.55, taperB: d * 0.55 }, { stage: 1, stack: -1, label: "Reduced flap" });
    }
  };
  closureAt("top", half);
  closureAt("bottom", 0);
  if (f.window) cutWindow(b, "front", { ...f.window, widthRatio: Math.min(0.6, f.window.widthRatio ?? 0.55) });
  return { builder: b, closedRotation: IDENTITY };
}

/* ───────────────────────── F70.01 pillow pack ───────────────────────── */

/**
 * Pillow pack (ECMA F70.01, end flaps completely covered): a long-seam-glued tube whose
 * curved end lobes close it without glue. The lens-shaped cross section is modelled as a
 * rhombus (two facets per face joined by a smooth "roll" hinge; the side folds are real
 * creases), each lobe hinged on its facet's end and folded in until it reaches the centre
 * plane. L = width, W = thickness at the centre, H = straight body length.
 */
export function pillowPack(dims: Dims, t: number, f: StructureFeatures = {}): EcmaDraft {
  void f;
  const halfL = dims.L / 2 + t;
  const halfW = dims.W / 2 + t;
  const s = Math.hypot(halfL, halfW);
  const alpha = Math.atan2(halfW, halfL);
  const ridge = deg(2 * alpha);
  const side = 180 - ridge;
  const H = dims.H;
  const d = clamp(dims.W * 0.85, 10, s * 0.95);
  const lobeFold = deg(Math.asin(Math.min(0.95, halfW / d)));
  const b = new DielineBuilder();
  const ids = ["frontL", "frontR", "backR", "backL"] as const;
  const strip = (i: number) => rect(i * s, 0, s, H);
  b.root("frontL", "front", rectPolygon(0, 0, s, H), "Front (left half)");
  b.attach("frontR", "front", "frontL", rectEdges(strip(0)).right, s, { kind: "rect" }, { fold: ridge, stage: 0, hingeKind: "roll", label: "Front (right half)" });
  b.attach("backR", "back", "frontR", rectEdges(strip(1)).right, s, { kind: "rect" }, { fold: side, stage: 0, label: "Back (right half)" });
  b.attach("backL", "back", "backR", rectEdges(strip(2)).right, s, { kind: "rect" }, { fold: ridge, stage: 0, hingeKind: "roll", label: "Back (left half)" });
  const g = glueWidth(dims.W + 20);
  b.attach("glue", "glue", "backL", rectEdges(strip(3)).right, g, { kind: "trapezoid", taperA: g * 0.5, taperB: g * 0.5 }, { fold: side, stage: 0, stack: -1, label: "Glue flap" });

  // Lobes: one parabolic arc per face (sagitta d at the face centre, 0 at the side folds).
  const arc = (i: number, top: boolean): Polygon => {
    const pair0 = i < 2 ? 0 : 2 * s;
    const x0 = i * s;
    const y0 = top ? 0 : H;
    const sign = top ? -1 : 1;
    const steps = 8;
    const pts: Pt[] = [pt(x0, y0), pt(x0 + s, y0)];
    for (let k = steps; k >= 0; k--) {
      const x = x0 + (k / steps) * s;
      const u = (x - pair0 - s) / s;
      const h = d * (1 - u * u);
      if (h > 1e-6) pts.push(pt(x, y0 + sign * h));
    }
    return pts;
  };
  ids.forEach((pid, i) => {
    for (const top of [true, false]) {
      const e = top ? rectEdges(strip(i)).top : rectEdges(strip(i)).bottom;
      const front = i < 2;
      b.attachPoly(`${pid}${top ? "Top" : "Bot"}`, "flap", pid, e, arc(i, top), { fold: lobeFold, stage: front ? 2 : 1, stack: front ? 0 : -1, label: "End lobe" });
    }
  });
  // Curved creases are drawn as the hinge chords; the arcs are cut lines.
  return {
    builder: b,
    closedRotation: quat(0, -alpha, 0),
    faces: (panels) => ({
      front: blockFace("front", panels, ["frontL", "frontR"])!,
      back: blockFace("back", panels, ["backR", "backL"])!,
    }),
  };
}

/* ───────────────────────── Cone ───────────────────────── */

export const CONE_FACETS = 24;

/** Developed (flat) sector angle of a cone of base radius r and height h, degrees. */
export const coneSectorDeg = (r: number, h: number) => (360 * r) / Math.hypot(r, h);

/**
 * Paperboard cone (fries, popcorn, sweets, flowers): an annular-free sector rolled into a
 * pointed cone and glued along a radial flap. Modelled as a 24-facet pyramid on smooth roll
 * hinges. L = W = mouth inner diameter, H = height from tip to mouth.
 */
export function cone(dims: Dims, t: number, f: StructureFeatures = {}): EcmaDraft {
  void f;
  const N = CONE_FACETS;
  const R = dims.L / 2 + t;
  const H = dims.H;
  const sl = Math.hypot(R, H);
  const chord = 2 * R * Math.sin(Math.PI / N);
  const gamma = 2 * Math.asin(chord / (2 * sl));
  // Dihedral fold between neighbouring facets of the regular pyramid.
  const V = (k: number) => new Vector3(R * Math.cos((2 * Math.PI * k) / N), R * Math.sin((2 * Math.PI * k) / N), 0);
  const A = new Vector3(0, 0, -H);
  const nrm = (k: number) => new Vector3().crossVectors(V(k).sub(A), V(k + 1).sub(A)).normalize();
  const fold = deg(Math.acos(clamp(nrm(0).dot(nrm(1)), -1, 1)));

  const b = new DielineBuilder();
  const apex = pt(0, 0);
  const theta0 = Math.PI / 2 - (N * gamma) / 2;
  const ray = (k: number) => pt(Math.cos(theta0 + k * gamma) * sl, Math.sin(theta0 + k * gamma) * sl);
  const facet = (k: number): Polygon => [apex, ray(k), ray(k + 1)];
  const root = N / 2;
  const fid = (k: number) => (k === root ? "front" : `facet${k}`);
  b.root("front", "front", facet(root), "Cone wall");
  for (let k = root + 1; k < N; k++) b.attachPoly(fid(k), "front", fid(k - 1), [apex, ray(k)], facet(k), { fold, stage: 0, hingeKind: "roll", label: "Cone wall" });
  for (let k = root - 1; k >= 0; k--) b.attachPoly(fid(k), "front", fid(k + 1), [apex, ray(k + 1)], facet(k), { fold, stage: 0, hingeKind: "roll", label: "Cone wall" });
  const g = clamp(R * 0.18, 10, 15);
  b.attach("glue", "glue", fid(N - 1), [apex, ray(N)], g, { kind: "trapezoid", taperA: Math.min(g * 0.9, sl * 0.2), taperB: 1 }, { fold, stage: 0, stack: -1, label: "Glue flap" });
  for (const p of b.panels) if (p.id.startsWith("facet")) p.role = "inner";

  const closedRotation = orientClosed(b, t, (world) => {
    const tip = world("front", apex);
    const rim = new Vector3();
    for (let k = 0; k < N; k++) rim.add(world(fid(k), ray(k + 1)));
    return rim.multiplyScalar(1 / N).sub(tip);
  });
  const wallIds = Array.from({ length: N }, (_, k) => fid(k));
  return {
    builder: b,
    closedRotation,
    faces: (panels) => ({ front: blockFace("front", panels, wallIds)! }),
    safeZones: (panels, safe) => {
      const mid = panels.filter((p) => wallIds.slice(N / 4, (3 * N) / 4).includes(p.id));
      const box = bboxOf(mid.flatMap((p: DielinePanel) => p.polygon));
      // Keep artwork in the band near the mouth, where the wall is widest; one clipped rect per facet.
      const band = insetRect({ x: box.x, y: box.y + box.height * 0.45, width: box.width, height: box.height * 0.5 }, safe);
      return mid.flatMap((p) => {
        const x0 = Math.max(band.x, p.bbox.x);
        const y0 = Math.max(band.y, p.bbox.y);
        const x1 = Math.min(band.x + band.width, p.bbox.x + p.bbox.width);
        const y1 = Math.min(band.y + band.height, p.bbox.y + p.bbox.height);
        return x1 - x0 > 0.5 && y1 - y0 > 0.5 ? [{ panelId: p.id, rect: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } }] : [];
      });
    },
  };
}
