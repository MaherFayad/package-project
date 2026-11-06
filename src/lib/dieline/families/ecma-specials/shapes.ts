import { Vec3 as Vector3 } from "@/lib/dieline/math";
import { computePoses, panelLocalPoint, panelPivot } from "../../fold";
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
  // Every wall carries artwork: the oblique panels between front and back print as the left /
  // right faces (contiguous strips on the sheet, read from outside like a wrap).
  const rightIds = Array.from({ length: half - 1 }, (_, i) => id(i + 1));
  const leftIds = Array.from({ length: half - 1 }, (_, i) => id(half + 1 + i));
  return {
    builder: b,
    closedRotation: IDENTITY,
    // Front / back are single panels (the automatic face would span the across-corners width).
    faces: (panels, computed) => ({
      ...computed,
      front: blockFace("front", panels, ["front"])!,
      back: blockFace("back", panels, ["back"])!,
      left: blockFace("left", panels, leftIds)!,
      right: blockFace("right", panels, rightIds)!,
    }),
  };
}

/* ───────────────────────── F70.01 pillow pack ───────────────────────── */

/** Roll-hinged strips per curved face of the pillow (smooth shading, curved creases). */
export const PILLOW_STRIPS = 8;

/** Lens geometry of a pillow pack: circular-arc faces through the side folds. */
export function pillowLens(dims: Dims, t: number) {
  const chord = dims.L + 2 * t;
  const sag = dims.W / 2 + t;
  const R = (chord * chord) / 4 / (2 * sag) + sag / 2;
  const theta = Math.asin(Math.min(1, chord / (2 * R)));
  return { chord, sag, R, theta };
}

/**
 * Pillow pack (ECMA F70.01, end flaps completely covered): a long-seam-glued tube whose two
 * faces are bowed into a lens and whose ends close along CURVED creases, without glue.
 *
 * Each face is a circular arc through the side folds (chord L + 2t, rise W/2 + t), built from
 * `PILLOW_STRIPS` strips on smooth `roll` hinges, so it shades as one curved surface. The end
 * creases are arcs on the sheet (sagitta `crease` at the face centre, 0 at the side folds) and
 * the cut outline beyond them is a second, deeper arc. Every strip carries its slice of the
 * end lobe, hinged on its stretch of the curved crease and folded in until the lobe edge
 * reaches the centre plane (back lobes first, front lobes over them), so the closed ends read
 * as the familiar curved "pillow" lobes. L = width, W = thickness at the centre, H = body
 * length at the side folds (the centre is longer by the crease arcs).
 */
export function pillowPack(dims: Dims, t: number, f: StructureFeatures = {}): EcmaDraft {
  void f;
  const M = PILLOW_STRIPS;
  const { sag, R, theta } = pillowLens(dims, t);
  const w = 2 * R * Math.sin(theta / M); // strip width (chord of 2θ/M of arc)
  const Fw = M * w; // flat face width
  const H = dims.H;
  const roll = deg((2 * theta) / M);
  const sideFold = 180 - deg((2 * theta * (M - 1)) / M);
  const creaseSag = clamp(sag * 0.55, 4, H * 0.12);
  const lobe = clamp(sag * 1.3, 8, Fw * 0.45); // lobe depth beyond the crease at the centre
  const prof = (u: number) => Math.max(0, 1 - (2 * u / Fw - 1) ** 2); // 1 at the centre, 0 at the folds
  const crease = (u: number) => creaseSag * prof(u);
  const cut = (u: number) => (creaseSag + lobe) * prof(u);

  const b = new DielineBuilder();
  const sid = (face: "front" | "back", k: number) => `${face}${k}`;
  const x0 = (face: "front" | "back", k: number) => (face === "front" ? 0 : Fw) + k * w;
  const strip = (face: "front" | "back", k: number): Polygon => {
    const xa = x0(face, k);
    const ua = k * w;
    return [pt(xa, -crease(ua)), pt(xa + w, -crease(ua + w)), pt(xa + w, H + crease(ua + w)), pt(xa, H + crease(ua))];
  };
  const edge = (poly: Polygon, side: "left" | "right"): [Pt, Pt] => (side === "right" ? [poly[1], poly[2]] : [poly[0], poly[3]]);

  // Root: the front strip right of the centre; the rest chain out to both sides.
  const root = M / 2;
  b.root(sid("front", root), "front", strip("front", root), "Front");
  for (let k = root + 1; k < M; k++) b.attachPoly(sid("front", k), "front", sid("front", k - 1), edge(strip("front", k - 1), "right"), strip("front", k), { fold: roll, stage: 0, hingeKind: "roll", label: "Front" });
  for (let k = root - 1; k >= 0; k--) b.attachPoly(sid("front", k), "front", sid("front", k + 1), edge(strip("front", k + 1), "left"), strip("front", k), { fold: roll, stage: 0, hingeKind: "roll", label: "Front" });
  b.attachPoly(sid("back", 0), "back", sid("front", M - 1), edge(strip("front", M - 1), "right"), strip("back", 0), { fold: sideFold, stage: 0, label: "Back" });
  for (let k = 1; k < M; k++) b.attachPoly(sid("back", k), "back", sid("back", k - 1), edge(strip("back", k - 1), "right"), strip("back", k), { fold: roll, stage: 0, hingeKind: "roll", label: "Back" });
  const g = glueWidth(dims.W + 20);
  b.attach("glue", "glue", sid("back", M - 1), edge(strip("back", M - 1), "right"), g, { kind: "trapezoid", taperA: g * 0.5, taperB: g * 0.5 }, { fold: sideFold, stage: 0, stack: -1, label: "Glue flap" });

  // End lobes, one slice per strip, hinged on the strip's stretch of the curved crease.
  const SUB = 4;
  for (const face of ["front", "back"] as const) {
    for (let k = 0; k < M; k++) {
      const ua = k * w;
      const xa = x0(face, k);
      const um = ua + w / 2;
      // Closed: the strip's distance from the centre plane and its tilt against it.
      const beta = -theta + ((k + 0.5) * 2 * theta) / M;
      const z = R * Math.cos(theta / M) * Math.cos(beta) - (R - sag);
      const d = cut(um) - crease(um);
      const target = Math.max(0, z - 0.6 * t);
      const fold = d > 0.5 ? deg(Math.asin(Math.min(0.97, target / (d * Math.cos(beta))))) : 90;
      for (const top of [true, false]) {
        const sgn = top ? -1 : 1;
        const y = (v: number) => (top ? 0 : H) + sgn * v;
        const hinge: [Pt, Pt] = [pt(xa, y(crease(ua))), pt(xa + w, y(crease(ua + w)))];
        const outline: Polygon = [hinge[0], hinge[1]];
        for (let i = SUB; i >= 0; i--) {
          const u = ua + (i / SUB) * w;
          const c = cut(u);
          if (c - crease(u) > 1e-3) outline.push(pt(xa + (i / SUB) * w, y(c)));
        }
        if (outline.length < 3) continue;
        b.attachPoly(`${sid(face, k)}${top ? "Top" : "Bot"}`, "flap", sid(face, k), hinge, outline, {
          fold,
          stage: face === "front" ? 2 : 1,
          stack: face === "front" ? 0 : -1,
          label: "End lobe",
        });
      }
    }
  }

  // Closed orientation: turn about Y so the front chord (side fold to side fold) runs along +X.
  const input = { panels: b.panels, rootId: b.rootId, thicknessMm: t, closedRotation: IDENTITY };
  const poses = computePoses(input, 1);
  const world = (id: string, q: Pt) => {
    const panel = b.byId(id);
    return panelLocalPoint(panel, q, 0, panelPivot(panel, t), t).applyMatrix4(poses.get(id)!.world);
  };
  const v = world(sid("front", M - 1), pt(Fw, H / 2)).sub(world(sid("front", 0), pt(0, H / 2)));
  const closedRotation = quat(0, Math.atan2(v.z, v.x), 0);
  const faceIds = (face: "front" | "back") => b.panels.filter((p) => p.id.startsWith(face)).map((p) => p.id);
  return {
    builder: b,
    closedRotation,
    faces: (panels) => ({ front: blockFace("front", panels, faceIds("front"))!, back: blockFace("back", panels, faceIds("back"))! }),
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
  // Circumradius of the 24-facet mouth: the across-flats inner width (the narrowest mouth a
  // product meets) is L, so the facets' apothem is L / 2 + t (R5-3Q-D-02: a corner radius of
  // L / 2 + t left the mouth 0.6–0.9 mm under L across the flats).
  const R = (dims.L / 2 + t) / Math.cos(Math.PI / N);
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
  // Apex at the bottom of the sheet, mouth arc at the top: the artwork reads upright on the
  // closed cone (mouth up). k runs right → left so the glue flap stays on the sheet's left.
  const ray = (k: number) => pt(-Math.cos(theta0 + k * gamma) * sl, -Math.sin(theta0 + k * gamma) * sl);
  const facet = (k: number): Polygon => [apex, ray(k), ray(k + 1)];
  const root = N / 2;
  const fid = (k: number) => (k === root ? "front" : `facet${k}`);
  b.root("front", "front", facet(root), "Cone wall");
  for (let k = root + 1; k < N; k++) b.attachPoly(fid(k), "front", fid(k - 1), [apex, ray(k)], facet(k), { fold, stage: 0, hingeKind: "roll", label: "Cone wall" });
  for (let k = root - 1; k >= 0; k--) b.attachPoly(fid(k), "front", fid(k + 1), [apex, ray(k + 1)], facet(k), { fold, stage: 0, hingeKind: "roll", label: "Cone wall" });
  // Glue flap: a strip tapering to the tip, never wider than the facet it is glued under. A
  // constant-width flap stood out of the cone near the apex, where the facets are narrower than
  // the flap (R4-07). The flap is the facet-N triangle cut at width g at the mouth.
  const g = Math.min(clamp(R * 0.18, 10, 15), chord * 0.9);
  const mouth = ray(N);
  const next = ray(N + 1);
  const len = Math.hypot(next.x - mouth.x, next.y - mouth.y) || 1;
  const s = g / len;
  const flap: Polygon = [apex, mouth, pt(mouth.x + (next.x - mouth.x) * s, mouth.y + (next.y - mouth.y) * s)];
  b.attachPoly("glue", "glue", fid(N - 1), [apex, mouth], flap, { fold, stage: 0, stack: -1, label: "Glue flap" });
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
