import type { Mm } from "@/types";
import { radiusAt, roundCorners, squarenessAt, type ControlPoint } from "../../index";
import { bottleSectionArea, bottleSectionPerimeter, coreSectionFor } from "./section";
import type { BaseStyle, BottleFinish, BottleProfile, BottleSection, HandleSpec, SectionPoint, ShapeRecipe, VesselDims, WallZone } from "./types";

/**
 * Generic parametric profile for every model of this catalogue. A recipe gives proportions
 * (fractions of H and R) and thicknesses; dims give D, H (and G, taper); the finish gives the
 * neck. Output follows the core contract: mm, Y up, standing on y = 0, outer[0] on the axis.
 */

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function sectionFor(recipe: ShapeRecipe, dims: VesselDims): BottleSection {
  if (recipe.section === "round") return { kind: "round" };
  if (recipe.section === "polygon") return { kind: "polygon", sides: recipe.sides ?? 6, cornerRatio: recipe.cornerRatio ?? 0.12 };
  const depth = dims.G ?? dims.D * (recipe.defaultDepthRatio ?? 1);
  return { kind: "rect", depthRatio: Math.min(1, depth / dims.D), cornerRatio: recipe.cornerRatio ?? 0.2 };
}

/** Top and bottom body radius (half widths) after taper. */
export function bodyRadii(recipe: ShapeRecipe, dims: VesselDims): { Rb: Mm; Rt: Mm } {
  const R = dims.D / 2;
  const t = (dims.taper ?? 0) / 2;
  return recipe.taper === "out" ? { Rb: R - t, Rt: R } : { Rb: R, Rt: R - t };
}

interface FinishOut {
  pts: ControlPoint[];
  /** Root (neck) radius under the finish. */
  rootR: Mm;
}

/** Finish outline from rootY to topY, then down into the bore. */
function finishPoints(f: BottleFinish, rootR: Mm, rootY: Mm, topY: Mm, wall: Mm): FinishOut {
  const T = f.outerDiameterMm / 2;
  const pts: ControlPoint[] = [];
  const bore = f.boreMm > 0 ? f.boreMm / 2 : rootR - wall;
  const base = topY - f.heightMm;
  const s = 0;
  switch (f.kind) {
    case "crown":
    case "swing": {
      // neck, transfer bead at the bottom of the finish, then the crown bead at the top
      pts.push({ r: T - 1.8, y: base, round: 0.8, s });
      pts.push({ r: T - 0.6, y: base + 1.2, round: 0.6, s });
      pts.push({ r: T - 0.6, y: base + 3.2, round: 0.6, s });
      pts.push({ r: T - 2.2, y: base + 4.6, round: 0.8, s });
      pts.push({ r: T - 2.2, y: topY - 7, round: 1.2, s });
      pts.push({ r: T, y: topY - 4.2, round: 1.4, s });
      pts.push({ r: T, y: topY - 1.6, round: 1.4, s });
      break;
    }
    case "cork":
    case "bartop": {
      const band = Math.min(f.heightMm, 11);
      pts.push({ r: rootR, y: topY - band - 1.2, round: 0.8, s });
      pts.push({ r: T, y: topY - band, round: 0.8, s });
      pts.push({ r: T, y: topY - 1.4, round: 1.2, s });
      break;
    }
    case "rim": {
      // handled by the tub builder
      break;
    }
    default: {
      const root = T - (f.kind === "lug" ? 0.8 : 0.9);
      const threadH = Math.min(12, f.heightMm);
      const threadStart = topY - threadH;
      if (f.supportRing) {
        const ringY = base - 1.2;
        pts.push({ r: root, y: ringY - 1.4, round: 0.4, s });
        pts.push({ r: T + 2.6, y: ringY - 1.0, round: 0.5, s });
        pts.push({ r: T + 2.6, y: ringY, round: 0.5, s });
        pts.push({ r: root, y: ringY + 0.4, round: 0.3, s });
      } else {
        pts.push({ r: root, y: Math.max(rootY + 0.2, base - 0.4), round: 0.6, s });
      }
      if (f.tamperBead || f.kind === "ropp") {
        pts.push({ r: root, y: threadStart - 3.2, s });
        pts.push({ r: T - 0.2, y: threadStart - 2.2, round: 0.5, s });
        pts.push({ r: root, y: threadStart - 1.0, s });
      }
      const crests = f.kind === "lug" ? 1 : 2;
      const pitch = Math.min(4, threadH / (crests + 1.2));
      let y = threadStart + pitch * 0.6;
      for (let k = 0; k < crests; k++) {
        pts.push({ r: root, y: y - pitch * 0.35, s });
        pts.push({ r: T, y, round: 0.3, s });
        pts.push({ r: root, y: y + pitch * 0.35, s });
        y += pitch;
      }
      pts.push({ r: root, y: topY - 1.2, round: 0.5, s });
      break;
    }
  }
  const lipR = pts.length ? pts[pts.length - 1].r : T;
  pts.push({ r: lipR, y: topY, round: 0.6, s });
  pts.push({ r: bore, y: topY, round: 0.3, s });
  pts.push({ r: bore, y: topY - 6, s });
  return { pts, rootR };
}

function handleFor(kind: ShapeRecipe["handle"], dims: VesselDims, depth: Mm, bodyTopY: Mm, finishBaseY: Mm, Rt: Mm, T: Mm, labelTopY: Mm = 0): HandleSpec | undefined {
  const H = dims.H;
  switch (kind) {
    case "jerrycan": {
      const z = -depth * 0.18;
      const x0 = -dims.D * 0.42;
      const x1 = dims.D * 0.12;
      const yTop = H - 6;
      return {
        kind: "integrated",
        tubeRadiusMm: Math.max(9, dims.D * 0.035),
        path: [
          { x: x0, y: bodyTopY - 4, z },
          { x: x0 + 8, y: yTop, z },
          { x: x1 - 8, y: yTop, z },
          { x: x1, y: bodyTopY - 4, z },
        ],
      };
    }
    case "jug": {
      const zb = -depth / 2;
      const out = Math.max(22, depth * 0.2);
      const yHi = bodyTopY + (finishBaseY - bodyTopY) * 0.55;
      // the grip joins the back wall above the back label, not across it (R5-3Q-F-05)
      const tube = Math.max(8, dims.D * 0.06);
      const yLow = Math.max(bodyTopY - H * 0.3, labelTopY + tube + 3);
      const yMid = Math.max(bodyTopY - H * 0.12, yLow + (yHi - yLow) * 0.35);
      return {
        kind: "integrated",
        tubeRadiusMm: tube,
        path: [
          { x: 0, y: yHi, z: zb * 0.4 },
          { x: 0, y: yHi, z: zb - out * 0.6 },
          { x: 0, y: yMid, z: zb - out },
          { x: 0, y: yLow, z: zb + 4 },
        ],
      };
    }
    case "bail": {
      const ear = H - Math.min(30, H * 0.12);
      const xr = Rt + 6;
      const pts: HandleSpec["path"] = [];
      for (let k = 0; k <= 12; k++) {
        const a = Math.PI - (k / 12) * Math.PI;
        pts.push({ x: xr * Math.cos(a), y: ear + xr * 0.75 * Math.sin(a), z: 0 });
      }
      return { kind: "bail", tubeRadiusMm: 2.5, path: pts };
    }
    case "clip": {
      const y = finishBaseY - 2;
      return {
        kind: "clip",
        tubeRadiusMm: 5,
        path: [
          { x: T + 3, y, z: 0 },
          { x: T + 38, y: y - 4, z: 0 },
          { x: T + 44, y: y - 46, z: 0 },
          { x: T + 12, y: y - 58, z: 0 },
        ],
      };
    }
    default:
      return undefined;
  }
}

/**
 * Height of the finish the closure covers, from the top down (mm). The core closures are drawn
 * from `finishTopY - finishH` up, so this is what makes a crown a 6 mm crimp and a cork capsule
 * a foil sleeve down the neck instead of a cap the full 18 mm finish height.
 * Crown: ISO 12821 crown skirt ~6 mm. Swing top: the stopper sits on the head bead only.
 * Cork: the capsule (EN 12726 / typical 50 to 60 mm on a 750 ml) covers the finish and part of
 * the neck. Others: the whole finish (ROPP shells, screw caps, lug lids).
 */
export function closureCoverMm(finish: BottleFinish, H: Mm, neckBaseY: Mm): Mm {
  switch (finish.kind) {
    case "crown":
      return 6.5;
    case "swing":
      return 7.5;
    case "cork":
      return Math.max(finish.heightMm, Math.min(52, (H - neckBaseY) * 0.7));
    default:
      return finish.heightMm;
  }
}

/**
 * How far a foil sleeve of the closure runs down from the top (mm), 0 when none. The 3D view
 * draws the wine capsule (CORK_CAPSULE style) 48 mm deep and the sparkling foil hood
 * (SPARKLING style, the only closure on the 29 mm sparkling finish besides a crown) 85 mm deep;
 * a neck label under them pokes through the foil, so the neck zone stops above them.
 */
export function neckSleeveMm(finish: BottleFinish, H: Mm, neckBaseY: Mm): Mm {
  if (finish.kind === "cork") return Math.max(48, closureCoverMm(finish, H, neckBaseY));
  if (finish.id === "CROWN_29") return 85;
  return 0;
}

/** Build the profile. Throws if the proportions collapse (validated dims never do). */
export function buildBottleProfile(recipe: ShapeRecipe, dims: VesselDims, finish: BottleFinish): BottleProfile {
  const H = dims.H;
  const { Rb, Rt } = bodyRadii(recipe, dims);
  const section = sectionFor(recipe, dims);
  const sq = recipe.section === "round" ? 0 : 1;
  const wall = recipe.wallMm;
  const ctrl: ControlPoint[] = [];

  // ---- base --------------------------------------------------------------------------------
  let base: BaseStyle;
  let yBody0: Mm;
  let innerBaseY = recipe.baseMm;
  const heelR = recipe.heel * Rb;
  switch (recipe.base.kind) {
    case "punt": {
      const depth = recipe.base.depth * Rb;
      base = { kind: "punt", depthMm: depth };
      ctrl.push({ r: 0, y: depth, s: sq }, { r: Rb * 0.42, y: depth * 0.55, round: 3, s: sq }, { r: Rb * 0.74, y: 0, round: 2.5, s: sq });
      yBody0 = heelR * 1.1;
      ctrl.push({ r: Rb, y: yBody0, round: heelR, s: sq });
      innerBaseY = depth + recipe.baseMm;
      break;
    }
    case "petaloid": {
      const c = recipe.base.clearance * Rb;
      base = { kind: "petaloid", feet: recipe.base.feet, clearanceMm: c };
      yBody0 = Rb * 0.5;
      ctrl.push({ r: 0, y: c, s: sq }, { r: Rb * 0.58, y: 0, round: 3, s: sq }, { r: Rb, y: yBody0, round: Rb * 0.38, s: sq });
      innerBaseY = c + recipe.baseMm;
      break;
    }
    case "stackRing": {
      base = { kind: "stackRing" };
      yBody0 = Math.max(4, heelR * 1.1);
      ctrl.push({ r: 0, y: 2.5, s: sq }, { r: Rb - 4, y: 2.5, round: 0.8, s: sq }, { r: Rb - 4, y: 0, round: 0.8, s: sq }, { r: Rb - 1, y: 0, round: 0.8, s: sq });
      ctrl.push({ r: Rb, y: yBody0, round: Math.min(heelR, 3), s: sq });
      innerBaseY = 2.5 + recipe.baseMm;
      break;
    }
    default: {
      base = { kind: "flat" };
      yBody0 = Math.max(2, heelR * 1.1);
      ctrl.push({ r: 0, y: recipe.glass ? 1.5 : 0.8, s: sq }, { r: Rb * 0.8, y: 0, round: 1.5, s: sq }, { r: Rb, y: yBody0, round: heelR, s: sq });
    }
  }

  // ---- finish placement ---------------------------------------------------------------------
  const isRim = finish.kind === "rim";
  const T = isRim ? Rt + 2.5 : finish.outerDiameterMm / 2;
  const rootR = finish.kind === "crown" || finish.kind === "swing" ? T - 1.8 : finish.kind === "cork" || finish.kind === "bartop" ? T - 1.2 : T - 0.9;
  const finishBaseY = isRim ? H - finish.heightMm : H - finish.heightMm - (finish.supportRing ? 3.6 : 0.6);
  // a tall finish (BVS 30H60 screw) replaces most of the neck instead of pushing the shoulder down
  const neckLen = Math.max(0, recipe.neckLen * H - Math.max(0, finish.heightMm - 18));
  const neckBaseY = finishBaseY - neckLen;
  const nb = rootR + recipe.neckFlare;
  const nt = rootR + (recipe.neckTop ?? recipe.neckFlare);
  const bodyTopY = isRim ? finishBaseY : Math.min(H * recipe.bodyTop, neckBaseY - 3);
  if (!(bodyTopY > yBody0 + 2)) throw new Error(`profile collapsed: body ${yBody0.toFixed(1)}..${bodyTopY.toFixed(1)}`);

  // ---- body (with ribs / waist) -------------------------------------------------------------
  const rAt = (y: Mm) => lerp(Rb, Rt, (y - yBody0) / (bodyTopY - yBody0));
  const bodyPts: ControlPoint[] = [];
  const depthRib = recipe.ribDepth ?? 1.3;
  for (const f of recipe.ribs ?? []) {
    const y = f * H;
    bodyPts.push({ r: rAt(y - 2.4), y: y - 2.4, round: 1.2, s: sq }, { r: rAt(y) - depthRib, y, round: 1.2, s: sq }, { r: rAt(y + 2.4), y: y + 2.4, round: 1.2, s: sq });
  }
  if (recipe.waist) {
    const w = recipe.waist;
    const y0 = (w.y - w.h / 2) * H;
    const y1 = (w.y + w.h / 2) * H;
    const hh = y1 - y0;
    bodyPts.push({ r: rAt(y0), y: y0, round: hh * 0.3, s: sq }, { r: rAt(w.y * H) * (1 - w.depth), y: w.y * H, round: hh * 0.6, s: sq }, { r: rAt(y1), y: y1, round: hh * 0.3, s: sq });
  }
  bodyPts.sort((a, b) => a.y - b.y);
  ctrl.push(...bodyPts);

  // ---- shoulder, neck, finish ---------------------------------------------------------------
  let neckZone: WallZone | undefined;
  if (isRim) {
    const lipH = finish.heightMm;
    ctrl.push({ r: Rt, y: H - lipH, round: 1, s: sq });
    ctrl.push({ r: T, y: H - lipH + 1.5, round: 1, s: sq });
    ctrl.push({ r: T, y: H - 1, round: 1, s: sq });
    ctrl.push({ r: Rt - wall, y: H, round: 0.6, s: sq });
    ctrl.push({ r: Rt - wall, y: H - 6, s: sq });
  } else {
    const sr = (recipe.shoulderRound ?? 0.3) * Rt;
    const shoulderLen = Math.hypot(Rt - nb, neckBaseY - bodyTopY);
    const steps = 16;
    switch (recipe.shoulder) {
      case "ogive":
      case "boston": {
        ctrl.push({ r: Rt, y: bodyTopY, s: sq });
        for (let k = 1; k < steps; k++) {
          const t = k / steps;
          if (recipe.shoulder === "ogive") {
            ctrl.push({ r: Rt - (Rt - nb) * smooth(t), y: lerp(bodyTopY, neckBaseY, t), s: sq * (1 - smooth(t)) });
          } else {
            const a = t * (Math.PI / 2);
            ctrl.push({ r: nb + (Rt - nb) * Math.cos(a), y: bodyTopY + (neckBaseY - bodyTopY) * Math.sin(a), s: sq * Math.cos(a) });
          }
        }
        ctrl.push({ r: nb, y: neckBaseY, round: recipe.shoulder === "boston" ? Math.min(3, neckLen * 0.4 + 0.5) : 0, s: 0 });
        break;
      }
      default: {
        const round = Math.min(sr, shoulderLen * 0.2);
        ctrl.push({ r: Rt, y: bodyTopY, round, s: sq });
        ctrl.push({ r: nb, y: neckBaseY, round: neckLen >= 12 ? Math.min(round, neckLen * 0.15) : Math.min(round, Math.max(1, neckLen * 0.4)), s: 0 });
        if (neckLen < 12) {
          const z0 = 0.35;
          const z1 = 0.65;
          neckZone = { y0: lerp(bodyTopY, neckBaseY, z0), y1: lerp(bodyTopY, neckBaseY, z1), r0: lerp(Rt, nb, z0), r1: lerp(Rt, nb, z1) };
        }
      }
    }
    if (neckLen >= 12) {
      const y0 = neckBaseY + Math.max(Math.min(6, neckLen * 0.2), 3.2);
      // a neck label ends 3 mm under a foil sleeve that runs down the neck (R5-3Q-F-03)
      const sleeve = neckSleeveMm(finish, H, neckBaseY);
      const y1 = Math.min(finishBaseY - Math.min(4, neckLen * 0.1), sleeve > 0 ? H - sleeve - 3 : Infinity);
      const at = (y: Mm) => lerp(nb, nt, (y - neckBaseY) / (finishBaseY - neckBaseY));
      if (y1 - y0 >= 10) neckZone = { y0, y1, r0: at(y0), r1: at(y1) };
    }
    ctrl.push({ r: nt, y: finishBaseY, round: 0.8, s: 0 });
    ctrl.push(...finishPoints(finish, nt, finishBaseY, H, recipe.glass ? 2.5 : 1.2).pts);
  }

  const outer = roundCorners(ctrl) as SectionPoint[];
  // fillets lift a pointed stand ring slightly: remap y linearly so the base is on y = 0 and
  // the top stays at H (closed height = input H exactly)
  let minY = Infinity;
  for (const p of outer) minY = Math.min(minY, p.y);
  const dy = minY > 0 && minY < 1 ? minY : 0;
  const k = H / (H - dy);
  const Y = (y: Mm) => (y - dy) * k;
  if (dy) for (const p of outer) p.y = Math.max(0, Y(p.y));
  const shift = <Z extends WallZone>(z: Z): Z => ({ ...z, y0: Y(z.y0), y1: Y(z.y1) });

  const ly0 = recipe.label[0] * H;
  const ly1 = recipe.label[1] * H;
  const body = shift({ y0: ly0, y1: ly1, r0: rAt(ly0), r1: rAt(ly1) });
  const depthAt = section.kind === "rect" ? dims.D * section.depthRatio : dims.D;
  return {
    outer,
    section: coreSectionFor(section),
    bottleSection: section,
    wallMm: wall,
    baseMm: Y(innerBaseY),
    innerBaseY: Y(innerBaseY),
    base,
    body,
    shoulder: neckZone ? shift(neckZone) : undefined,
    neckZone: neckZone ? shift(neckZone) : undefined,
    finishTopY: H,
    finishR: T,
    finishH: closureCoverMm(finish, H, neckBaseY),
    fillMaxY: Y(isRim ? H - finish.heightMm - 2 : finishBaseY),
    handle: handleFor(recipe.handle, dims, depthAt, bodyTopY, finishBaseY, Rt, T, ly1),
  };
}

// ---------------------------------------------------------------------------------------------
// Volume and girth on the exact section
// ---------------------------------------------------------------------------------------------

/** Inner girth-weighted helpers: half width and squareness at height y. */
export function halfWidthAt(p: BottleProfile, y: Mm): { a: Mm; s: number } {
  const a = radiusAt(p.outer, y);
  const s = p.bottleSection.kind === "round" ? 1 : squarenessAt(p.outer, y);
  return { a, s };
}

/** Interior volume from the inner base up to y (ml). */
export function bottleVolumeToMl(p: BottleProfile, toY: Mm, step = 0.25): number {
  let mm3 = 0;
  const top = Math.min(toY, p.finishTopY - 1);
  for (let y = p.innerBaseY + step / 2; y < top; y += step) {
    const { a, s } = halfWidthAt(p, y);
    const h = Math.min(step, top - (y - step / 2));
    mm3 += bottleSectionArea(p.bottleSection, a - p.wallMm, s) * h;
  }
  return mm3 / 1000;
}

/** Brimful (overflow) volume, ml: to 1 mm under the top of the finish. */
export function bottleBrimfulMl(p: BottleProfile): number {
  return bottleVolumeToMl(p, p.finishTopY - 1);
}

/** Outer girth at height y (mm). */
export function bottleGirthAt(p: BottleProfile, y: Mm): Mm {
  const { a, s } = halfWidthAt(p, y);
  return bottleSectionPerimeter(p.bottleSection, a, s);
}

/**
 * Fill line: height y (mm) at which the container holds `ml`. Returns the fill height and
 * the headspace below the finish top. Uses bisection on the exact volume.
 */
export function fillLevelFor(p: BottleProfile, ml: number): { y: Mm; headspaceMm: Mm; overfilled: boolean } {
  const brim = bottleBrimfulMl(p);
  if (ml >= brim) return { y: p.finishTopY - 1, headspaceMm: 1, overfilled: ml > brim };
  let lo = p.innerBaseY;
  let hi = p.finishTopY - 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (bottleVolumeToMl(p, mid, 0.5) < ml) lo = mid;
    else hi = mid;
  }
  const y = (lo + hi) / 2;
  return { y, headspaceMm: p.finishTopY - y, overfilled: false };
}
