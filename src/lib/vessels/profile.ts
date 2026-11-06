import type { Mm } from "@/types";
import type { CrossSection, NeckFinish, ProfilePoint, VesselDims, VesselKind, VesselProfile } from "./types";

/**
 * Parametric outer profiles (lathe outlines) for every container. Pure math, no three.js,
 * so it runs in unit tests and on the server (envelopes, label specs, pricing).
 */

// ---------------------------------------------------------------------------------------------
// Neck finishes (thread standards). T = outer diameter over the thread, H = finish height.
// Values from GPI/SPI finish tables and closure maker drawings (PCO 1881: ISBT 2006, 27.4 mm T).
// ---------------------------------------------------------------------------------------------
export const NECK_FINISHES = {
  PCO_1881: { code: "PCO 1881 (28 mm)", outerDiameterMm: 27.4, heightMm: 13.5, thread: "screw" },
  F18_400: { code: "18-400", outerDiameterMm: 17.8, heightMm: 9.0, thread: "screw" },
  DIN18: { code: "DIN 18 (18-415)", outerDiameterMm: 17.8, heightMm: 13.0, thread: "screw" },
  F20_410: { code: "20-410", outerDiameterMm: 19.8, heightMm: 13.7, thread: "screw" },
  F24_410: { code: "24-410", outerDiameterMm: 23.9, heightMm: 15.4, thread: "screw" },
  F28_410: { code: "28-410", outerDiameterMm: 27.9, heightMm: 16.0, thread: "screw" },
  FEA15: { code: "FEA 15 crimp", outerDiameterMm: 17.4, heightMm: 7.0, thread: "crimp" },
  TO53: { code: "TO 53 lug", outerDiameterMm: 53, heightMm: 9.5, thread: "lug" },
  TO63: { code: "TO 63 lug", outerDiameterMm: 63, heightMm: 9.5, thread: "lug" },
  TO70: { code: "TO 70 lug", outerDiameterMm: 70, heightMm: 10, thread: "lug" },
  /** Beverage can ends: nominal size in inches + sixteenths (202 = 2 2/16 in). */
  END_202: { code: "202 end", outerDiameterMm: 54.0, heightMm: 3.0, thread: "seam" },
  END_200: { code: "200 end", outerDiameterMm: 50.8, heightMm: 3.0, thread: "seam" },
} as const satisfies Record<string, NeckFinish>;

// ---------------------------------------------------------------------------------------------
// Polyline helpers
// ---------------------------------------------------------------------------------------------

/** Control vertex: `round` is a corner radius (mm), `s` is squareness (1 = section shape, 0 = round). */
export interface ControlPoint extends ProfilePoint {
  round?: Mm;
  s?: number;
}

/** Profile point with squareness (only meaningful for roundedRect sections). */
export interface SectionPoint extends ProfilePoint {
  s: number;
}

/**
 * Replace every corner with a rounded (quadratic, tangent-continuous) fillet of about `round` mm,
 * clamped so neighbouring fillets never overlap. Endpoints are kept as is.
 */
export function roundCorners(pts: ControlPoint[], steps = 6): SectionPoint[] {
  const out: SectionPoint[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const s = p.s ?? 1;
    const round = p.round ?? 0;
    if (i === 0 || i === n - 1 || round <= 0) {
      out.push({ r: p.r, y: p.y, s });
      continue;
    }
    const a = pts[i - 1];
    const b = pts[i + 1];
    const inR = p.r - a.r;
    const inY = p.y - a.y;
    const outR = b.r - p.r;
    const outY = b.y - p.y;
    const lenIn = Math.hypot(inR, inY);
    const lenOut = Math.hypot(outR, outY);
    if (lenIn < 1e-6 || lenOut < 1e-6) {
      out.push({ r: p.r, y: p.y, s });
      continue;
    }
    const cos = -(inR * outR + inY * outY) / (lenIn * lenOut); // cos of the interior angle
    const theta = Math.acos(Math.max(-1, Math.min(1, cos)));
    if (theta > Math.PI - 1e-3) {
      out.push({ r: p.r, y: p.y, s });
      continue;
    }
    const d = Math.min(round / Math.tan(theta / 2), lenIn * 0.5, lenOut * 0.5);
    const t1 = { r: p.r - (inR / lenIn) * d, y: p.y - (inY / lenIn) * d };
    const t2 = { r: p.r + (outR / lenOut) * d, y: p.y + (outY / lenOut) * d };
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const u = 1 - t;
      out.push({
        r: u * u * t1.r + 2 * u * t * p.r + t * t * t2.r,
        y: u * u * t1.y + 2 * u * t * p.y + t * t * t2.y,
        s, // squareness follows the vertex; segments between vertices blend linearly
      });
    }
  }
  return out;
}

/** Sample a quarter ellipse from (r0,y0) (vertical tangent) to (r1,y1) (horizontal tangent). */
function bostonShoulder(r0: Mm, y0: Mm, r1: Mm, y1: Mm, steps = 14): ControlPoint[] {
  const pts: ControlPoint[] = [];
  for (let k = 1; k < steps; k++) {
    const t = (k / steps) * (Math.PI / 2);
    pts.push({ r: r1 + (r0 - r1) * Math.cos(t), y: y0 + (y1 - y0) * Math.sin(t) });
  }
  return pts;
}

// ---------------------------------------------------------------------------------------------
// Silhouette queries
// ---------------------------------------------------------------------------------------------

/** Largest outer radius of the profile at height y (ignores the bore inside the finish). */
export function radiusAt(outer: ProfilePoint[], y: Mm): Mm {
  let best = 0;
  for (let i = 0; i < outer.length - 1; i++) {
    const a = outer[i];
    const b = outer[i + 1];
    const lo = Math.min(a.y, b.y);
    const hi = Math.max(a.y, b.y);
    if (y < lo - 1e-9 || y > hi + 1e-9) continue;
    const r = hi - lo < 1e-9 ? Math.max(a.r, b.r) : a.r + ((y - a.y) / (b.y - a.y)) * (b.r - a.r);
    if (r > best) best = r;
  }
  return best;
}

/** Squareness at height y (max over segments crossing y, as for the radius). */
export function squarenessAt(outer: SectionPoint[], y: Mm): number {
  let bestR = -1;
  let s = 1;
  for (let i = 0; i < outer.length - 1; i++) {
    const a = outer[i];
    const b = outer[i + 1];
    if (y < Math.min(a.y, b.y) - 1e-9 || y > Math.max(a.y, b.y) + 1e-9) continue;
    const t = Math.abs(b.y - a.y) < 1e-9 ? 0.5 : (y - a.y) / (b.y - a.y);
    const r = a.r + t * (b.r - a.r);
    if (r > bestR) {
      bestR = r;
      s = a.s + t * (b.s - a.s);
    }
  }
  return s;
}

/** Rounded regular polygon numbers: sides, tan(π/n), corner radius (apothem a). */
export function polygonParts(section: { sides: number; cornerRatio: number }, a: Mm) {
  const n = Math.max(3, Math.round(section.sides));
  return { n, t: Math.tan(Math.PI / n), c: Math.min(a, Math.max(0, a * section.cornerRatio)) };
}

/** Area of a cross-section of half width a (mm²). */
export function sectionArea(section: CrossSection, a: Mm, squareness = 1): number {
  if (a <= 0) return 0;
  const round = Math.PI * a * a;
  if (section.kind === "round") return round;
  if (section.kind === "polygon") {
    const { n, t, c } = polygonParts(section, a);
    return round + (n * a * a * t - c * c * (n * t - Math.PI) - round) * squareness;
  }
  const w = 2 * a;
  const d = 2 * a * section.depthRatio;
  const c = Math.min(a * section.cornerRatio, a, a * section.depthRatio);
  const rect = w * d - (4 - Math.PI) * c * c;
  // a round neck under a square body: blend by squareness (the shoulder transition)
  const roundD = Math.PI * a * a * section.depthRatio;
  return roundD + (rect - roundD) * squareness;
}

/** Girth (perimeter) of a cross-section of half width a. */
export function sectionPerimeter(section: CrossSection, a: Mm, squareness = 1): Mm {
  if (a <= 0) return 0;
  if (section.kind === "round") return 2 * Math.PI * a;
  if (section.kind === "polygon") {
    const { n, t, c } = polygonParts(section, a);
    return 2 * Math.PI * a + (2 * n * a * t - 2 * c * (n * t - Math.PI) - 2 * Math.PI * a) * squareness;
  }
  const w = 2 * a;
  const d = 2 * a * section.depthRatio;
  const c = Math.min(a * section.cornerRatio, a, a * section.depthRatio);
  const rect = 2 * (w + d) - (8 - 2 * Math.PI) * c;
  // ellipse (Ramanujan) for the round end of the blend
  const ea = a;
  const eb = a * section.depthRatio;
  const h = ((ea - eb) * (ea - eb)) / ((ea + eb) * (ea + eb));
  const ellipse = Math.PI * (ea + eb) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  return ellipse + (rect - ellipse) * squareness;
}

/** Brimful interior volume in ml (to the top of the finish minus a 1 mm lip). */
export function brimfulVolumeMl(p: VesselProfile, toY: Mm = p.finishTopY - 1, step = 0.25): number {
  const outer = p.outer as SectionPoint[];
  let mm3 = 0;
  for (let y = p.baseMm + step / 2; y < toY; y += step) {
    const a = radiusAt(outer, y) - p.wallMm;
    const s = p.section.kind === "round" ? 1 : squarenessAt(outer, y);
    mm3 += sectionArea(p.section, a, s) * step;
  }
  return mm3 / 1000;
}

/** Interior volume up to height y (fill level), ml. */
export function volumeToHeightMl(p: VesselProfile, y: Mm): number {
  return y <= p.baseMm ? 0 : brimfulVolumeMl(p, Math.min(y, p.finishTopY - 1));
}

/** Arc length of the silhouette between y0 and y1 (mm). */
export function silhouetteLength(outer: ProfilePoint[], y0: Mm, y1: Mm, step = 0.5): Mm {
  let len = 0;
  let prevR = radiusAt(outer, y0);
  for (let y = y0 + step; y <= y1 + 1e-9; y += step) {
    const yy = Math.min(y, y1);
    const r = radiusAt(outer, yy);
    len += Math.hypot(r - prevR, step);
    prevR = r;
  }
  return len;
}

// ---------------------------------------------------------------------------------------------
// Profile builders
// ---------------------------------------------------------------------------------------------

interface FinishOpts {
  /** PET bottles have a support (transfer) ring under the thread. */
  supportRing?: boolean;
  wall: Mm;
}

/** Neck finish from the neck root (rootR, rootY) up to topY, then a little way into the bore. */
function finishPoints(neck: NeckFinish, rootY: Mm, topY: Mm, { supportRing, wall }: FinishOpts): ControlPoint[] {
  const T = neck.outerDiameterMm / 2;
  const root = T - 0.9; // root of the thread
  const pts: ControlPoint[] = [];
  const threadStart = topY - neck.heightMm;
  if (supportRing) {
    const ringY = threadStart - 1.2;
    pts.push({ r: root, y: ringY - 1.4, round: 0.4 });
    pts.push({ r: T + 2.6, y: ringY - 1.0, round: 0.5 });
    pts.push({ r: T + 2.6, y: ringY, round: 0.5 });
    pts.push({ r: root, y: ringY + 0.4, round: 0.3 });
  } else if (rootY < threadStart - 0.2) {
    pts.push({ r: root, y: Math.max(rootY, threadStart - 2), round: 0.6 });
  }
  // two thread crests (enough to read as a thread when the cap is off)
  const pitch = Math.min(4, neck.heightMm / 3.2);
  let y = threadStart + pitch * 0.6;
  for (let k = 0; k < 2 && neck.thread !== "crimp"; k++) {
    pts.push({ r: root, y: y - pitch * 0.35 });
    pts.push({ r: T, y, round: 0.3 });
    pts.push({ r: root, y: y + pitch * 0.35 });
    y += pitch;
  }
  if (neck.thread === "crimp") {
    // crimp bead
    pts.push({ r: root - 0.6, y: topY - 4.2, round: 0.4 });
    pts.push({ r: T, y: topY - 3.2, round: 1.2 });
  }
  pts.push({ r: root, y: topY - 1.4, round: 0.5 });
  pts.push({ r: root, y: topY, round: 0.6 });
  pts.push({ r: root - wall, y: topY, round: 0.3 });
  pts.push({ r: root - wall, y: topY - 6 });
  return pts;
}

function finalize(
  ctrl: ControlPoint[],
  section: CrossSection,
  extra: Omit<VesselProfile, "outer" | "section">,
): VesselProfile {
  const outer = roundCorners(ctrl);
  // fillets lift a pointed stand ring slightly; drop the outline back onto y = 0
  let minY = Infinity;
  for (const p of outer) minY = Math.min(minY, p.y);
  if (!(minY > 0 && minY < 1)) return { outer, section, ...extra };
  const dy = minY;
  for (const p of outer) p.y -= dy;
  const zone = <T extends { y0: Mm; y1: Mm }>(z: T): T => ({ ...z, y0: z.y0 - dy, y1: z.y1 - dy });
  return {
    outer,
    section,
    ...extra,
    body: zone(extra.body),
    shoulder: extra.shoulder ? zone(extra.shoulder) : undefined,
    finishTopY: extra.finishTopY - dy,
    fillMaxY: extra.fillMaxY - dy,
  };
}

/** Round PET bottle (water / juice) with grip ribs, a conical shoulder and a PCO 1881 finish. */
function roundBottle(d: VesselDims, neck: NeckFinish): VesselProfile {
  const R = d.D / 2;
  const H = d.H;
  const wall = 0.3;
  const topY = H;
  const T = neck.outerDiameterMm / 2;
  const neckBaseY = topY - neck.heightMm - 4.2; // under the support ring
  const neckR = T - 0.9 + 1.2;
  const shoulderY = H * 0.63;
  const ribs = [H * 0.14, H * 0.59];
  const ctrl: ControlPoint[] = [
    { r: 0, y: 4 },
    { r: R * 0.55, y: 0, round: 4 },
    { r: R, y: 7, round: 7 },
  ];
  for (const ry of ribs) {
    ctrl.push({ r: R, y: ry - 2.4, round: 1.2 });
    ctrl.push({ r: R - 1.3, y: ry, round: 1.2 });
    ctrl.push({ r: R, y: ry + 2.4, round: 1.2 });
  }
  ctrl.push({ r: R, y: shoulderY, round: 14 });
  ctrl.push({ r: neckR, y: neckBaseY, round: 5 });
  ctrl.push(...finishPoints(neck, neckBaseY, topY, { supportRing: true, wall: 2 }));
  const t0 = 0.3;
  const t1 = 0.72;
  const lerp = (t: number) => ({ r: R + (neckR - R) * t, y: shoulderY + (neckBaseY - shoulderY) * t });
  return finalize(ctrl, { kind: "round" }, {
    wallMm: wall,
    baseMm: 0.6,
    body: { y0: ribs[0] + 3.2, y1: ribs[1] - 3.2, r0: R, r1: R },
    shoulder: { y0: lerp(t0).y, y1: lerp(t1).y, r0: lerp(t0).r, r1: lerp(t1).r },
    finishTopY: topY,
    finishR: T,
    finishH: neck.heightMm,
    fillMaxY: neckBaseY,
  });
}

/** Boston round: straight body, heavy quarter-ellipse shoulder, short neck. Glass or PET. */
function bostonRound(d: VesselDims, neck: NeckFinish, glass: boolean): VesselProfile {
  const R = d.D / 2;
  const H = d.H;
  const wall = glass ? 1.8 : 0.6;
  const base = glass ? Math.max(3, R * 0.16) : 0.8;
  const T = neck.outerDiameterMm / 2;
  const topY = H;
  const neckR = T - 0.9 + (glass ? 0.4 : 0.2);
  const neckRootY = topY - neck.heightMm - (glass ? 2.2 : 1.6);
  const shoulderH = (R - neckR) * 0.62;
  const shoulderY = neckRootY - shoulderH;
  const ctrl: ControlPoint[] = [
    { r: 0, y: glass ? 1.6 : 1 },
    { r: R * 0.78, y: 0, round: 1.6 },
    { r: R, y: Math.min(R * 0.2, 6), round: Math.min(R * 0.18, 5) },
    { r: R, y: shoulderY },
    ...bostonShoulder(R, shoulderY, neckR, neckRootY),
    { r: neckR, y: neckRootY, round: 0.8 },
    ...finishPoints(neck, neckRootY, topY, { wall: glass ? 2 : 1.2 }),
  ];
  const bodyY0 = Math.min(R * 0.2, 6) + 2;
  return finalize(ctrl, { kind: "round" }, {
    wallMm: wall,
    baseMm: base,
    body: { y0: bodyY0, y1: shoulderY - 1, r0: R, r1: R },
    finishTopY: topY,
    finishR: T,
    finishH: neck.heightMm,
    fillMaxY: neckRootY,
  });
}

/** Square perfume flacon: thick glass, flat shoulder, FEA 15 crimp neck. */
function perfumeSquare(d: VesselDims, neck: NeckFinish): VesselProfile {
  const R = d.D / 2;
  const depthRatio = (d.G ?? d.D) / d.D;
  const H = d.H;
  const T = neck.outerDiameterMm / 2;
  const topY = H;
  const neckR = T - 0.6;
  const neckRootY = topY - neck.heightMm - 2.5;
  const shoulderY = neckRootY - 3;
  const ctrl: ControlPoint[] = [
    { r: 0, y: 0.8, s: 1 },
    { r: R - 0.5, y: 0, round: 1.2, s: 1 },
    { r: R, y: 1.2, round: 1.2, s: 1 },
    { r: R, y: shoulderY, round: 2.4, s: 1 },
    { r: neckR + 2.2, y: neckRootY, round: 1.2, s: 0 },
    { r: neckR, y: neckRootY + 0.6, round: 0.6, s: 0 },
    ...finishPoints(neck, neckRootY + 0.6, topY, { wall: 3.5 }).map((p) => ({ ...p, s: 0 })),
  ];
  return finalize(ctrl, { kind: "roundedRect", cornerRatio: 0.16, depthRatio }, {
    wallMm: 3.2,
    baseMm: Math.min(10, H * 0.12),
    body: { y0: 4, y1: shoulderY - 2, r0: R, r1: R },
    finishTopY: topY,
    finishR: T,
    finishH: neck.heightMm,
    fillMaxY: neckRootY,
  });
}

/** Wide-mouth jar (honey, cream): straight or slightly tapered body, short shoulder, lug finish. */
function wideJar(d: VesselDims, neck: NeckFinish): VesselProfile {
  const Rb = d.D / 2;
  const Rt = Rb - (d.taper ?? 0) / 2;
  const H = d.H;
  const T = neck.outerDiameterMm / 2;
  const topY = H;
  const neckR = T - 0.9;
  const neckRootY = topY - neck.heightMm - 1.2;
  const shoulderH = Math.max(2.5, (Rt - neckR) * 0.9);
  const shoulderY = neckRootY - shoulderH;
  const ctrl: ControlPoint[] = [
    { r: 0, y: 2 },
    { r: Rb * 0.86, y: 0, round: 2 },
    { r: Rb, y: 5, round: 4 },
    { r: Rt, y: shoulderY, round: Math.min(5, shoulderH * 0.9) },
    { r: neckR, y: neckRootY, round: 1.5 },
    ...finishPoints(neck, neckRootY, topY, { wall: 2.6 }),
  ];
  return finalize(ctrl, { kind: "round" }, {
    wallMm: 2.6,
    baseMm: 4,
    body: { y0: 7, y1: shoulderY - 2, r0: Rb + ((Rt - Rb) * (7 - 5)) / (shoulderY - 5), r1: Rb + ((Rt - Rb) * (shoulderY - 2 - 5)) / (shoulderY - 5) },
    finishTopY: topY,
    finishR: T,
    finishH: neck.heightMm,
    fillMaxY: neckRootY,
  });
}

/** Two-piece aluminium beverage can: domed base, necked top, double seam and end panel. */
function can(d: VesselDims, neck: NeckFinish): VesselProfile {
  const R = d.D / 2;
  const H = d.H;
  const Rs = neck.outerDiameterMm / 2 + 1.2; // seam sits just outside the nominal end size
  const neckY = H - Math.max(9, (R - Rs) * 2.6 + 4);
  const ctrl: ControlPoint[] = [
    { r: 0, y: 10 },
    { r: R * 0.6, y: 2.5, round: 4 },
    { r: R * 0.74, y: 0, round: 1.2 },
    { r: R * 0.84, y: 0.4, round: 1.5 },
    { r: R, y: 8, round: 5 },
    { r: R, y: neckY, round: 6 },
    { r: Rs - 1.6, y: H - 3.4, round: 2 },
    { r: Rs, y: H - 2.8, round: 0.6 },
    { r: Rs, y: H, round: 0.7 },
    { r: Rs - 1.5, y: H, round: 0.5 },
    { r: Rs - 2.4, y: H - 6.4, round: 0.8 },
    { r: Rs - 4.2, y: H - 6.2, round: 1.2 },
    { r: Rs - 5.2, y: H - 5.3, round: 1 },
    { r: 0, y: H - 5.3 },
  ];
  return finalize(ctrl, { kind: "round" }, {
    wallMm: 0.1,
    baseMm: 10,
    body: { y0: 10, y1: neckY - 3, r0: R, r1: R },
    finishTopY: H,
    finishR: Rs,
    finishH: 3,
    fillMaxY: H - 8,
  });
}

/** Round metal tin with a slip lid (lid drawn separately). */
function roundTin(d: VesselDims): VesselProfile {
  const R = d.D / 2;
  const H = d.H;
  const ctrl: ControlPoint[] = [
    { r: 0, y: 0.5 },
    { r: R - 1.2, y: 0, round: 0.8 },
    { r: R, y: 1.4, round: 1 },
    { r: R, y: H - 1.2, round: 0.5 },
    { r: R - 0.7, y: H, round: 0.4 },
    { r: R - 1.0, y: H - 0.4 },
    { r: R - 1.0, y: H - 6 },
  ];
  const lidH = tinLidHeight(d);
  return finalize(ctrl, { kind: "round" }, {
    wallMm: 0.25,
    baseMm: 0.5,
    body: { y0: 2.5, y1: H - lidH - 1, r0: R, r1: R },
    finishTopY: H,
    finishR: R,
    finishH: lidH,
    fillMaxY: H - 2,
  });
}

/** Height of a tin's slip lid skirt. */
export function tinLidHeight(d: VesselDims): Mm {
  return Math.min(16, Math.max(6, d.H * 0.3));
}

/** Squeeze tube geometry numbers (body is not revolved: it flattens to the crimp seal). */
export function tubeDims(d: VesselDims) {
  const R = d.D / 2;
  const capH = Math.max(14, d.D * 0.62);
  const capR = Math.min(R * 0.96, R - 0.5);
  const shoulderH = Math.max(4, R * 0.42);
  const sealH = d.D <= 25 ? 7 : 10;
  const bodyY0 = capH + shoulderH;
  const totalH = capH + d.H;
  return { R, capH, capR, shoulderH, sealH, bodyY0, sealY0: totalH - sealH, totalH, nozzleR: 6.5 };
}

/** Stand-up pouch numbers (W x H + G). */
export function pouchDims(d: VesselDims) {
  const W = d.D;
  const G = d.G ?? Math.round(d.D * 0.5);
  const topSeal = 10;
  const sideSeal = 6;
  const zipperY = d.H - 32;
  return { W, H: d.H, G, topSeal, sideSeal, zipperY, tearNotchY: d.H - 22 };
}

function tube(d: VesselDims): VesselProfile {
  const t = tubeDims(d);
  const ctrl: ControlPoint[] = [
    { r: 0, y: 0 },
    { r: t.capR, y: 0, round: 1.5 },
    { r: t.capR, y: t.capH, round: 0.5 },
    { r: t.nozzleR, y: t.capH },
    { r: t.R, y: t.bodyY0, round: 3 },
    { r: t.R, y: t.sealY0 },
    { r: 0.6, y: t.totalH },
  ];
  return finalize(ctrl, { kind: "round" }, {
    wallMm: 0.4,
    baseMm: t.capH,
    body: { y0: t.bodyY0 + 4, y1: t.sealY0 - 4, r0: t.R, r1: t.R },
    finishTopY: t.capH,
    finishR: t.nozzleR,
    finishH: 0,
    fillMaxY: t.sealY0,
  });
}

function pouch(d: VesselDims): VesselProfile {
  const p = pouchDims(d);
  const ctrl: ControlPoint[] = [
    { r: 0, y: 0 },
    { r: p.W / 2, y: 0 },
    { r: p.W / 2, y: p.H },
    { r: 0, y: p.H },
  ];
  return finalize(ctrl, { kind: "roundedRect", cornerRatio: 0.02, depthRatio: p.G / p.W }, {
    wallMm: 0.1,
    baseMm: 0,
    body: { y0: 0, y1: p.H, r0: p.W / 2, r1: p.W / 2 },
    finishTopY: p.H,
    finishR: p.W / 2,
    finishH: 0,
    fillMaxY: p.zipperY - 10,
  });
}

/** Build the outer profile of a container. `neck` defaults to the kind's usual finish. */
export function buildProfile(kind: VesselKind, dims: VesselDims, neck?: NeckFinish): VesselProfile {
  switch (kind) {
    case "ROUND_BOTTLE":
      return roundBottle(dims, neck ?? NECK_FINISHES.PCO_1881);
    case "BOSTON_ROUND":
      return bostonRound(dims, neck ?? NECK_FINISHES.F20_410, true);
    case "DROPPER_BOTTLE":
      return bostonRound(dims, neck ?? NECK_FINISHES.DIN18, true);
    case "PUMP_BOTTLE":
      return bostonRound(dims, neck ?? NECK_FINISHES.F24_410, false);
    case "PERFUME_SQUARE":
      return perfumeSquare(dims, neck ?? NECK_FINISHES.FEA15);
    case "WIDE_JAR":
      return wideJar(dims, neck ?? NECK_FINISHES.TO63);
    case "CAN":
      return can(dims, neck ?? NECK_FINISHES.END_202);
    case "ROUND_TIN":
      return roundTin(dims);
    case "SQUEEZE_TUBE":
      return tube(dims);
    case "STAND_UP_POUCH":
      return pouch(dims);
  }
}
