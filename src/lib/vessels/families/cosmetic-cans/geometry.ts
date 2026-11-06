import type { Mm } from "@/types";
import { buildProfile, roundCorners, tubeDims, type ControlPoint } from "../../profile";
import type { CrossSection, NeckFinish, VesselProfile } from "../../types";
import type { BlisterCavity, BlisterGeometry, CatalogueDims, CatalogueGeometry, LidGeometry, SectionKind, ShapeSpec } from "./types";

/**
 * Parametric outer profiles for the catalogue. Output is the core `VesselProfile` (lathe outline,
 * mm, Y up, standing on y = 0) so the existing vessel renderer, volume and sleeve math work
 * unchanged. Non-round bodies use the core roundedRect section (extrusion along the profile).
 */

/** Neck finishes not in core NECK_FINISHES (T = thread / crimp outer diameter, H = finish height). */
export const EXTRA_NECKS = {
  /** ISO 8362-6 crimp neck for 13 mm and 20 mm stoppers (2R..4R use 13 mm). */
  CRIMP_13: { code: "13 mm crimp (ISO 8362-6)", outerDiameterMm: 13, heightMm: 3.6, thread: "crimp" },
  CRIMP_20: { code: "20 mm crimp (ISO 8362-6)", outerDiameterMm: 20, heightMm: 3.6, thread: "crimp" },
  F13_415: { code: "13-415", outerDiameterMm: 12.8, heightMm: 9.4, thread: "screw" },
  F15_415: { code: "15-415", outerDiameterMm: 14.8, heightMm: 9.5, thread: "screw" },
  F18_410: { code: "18-410", outerDiameterMm: 17.8, heightMm: 9.0, thread: "screw" },
  F20_410: { code: "20-410", outerDiameterMm: 19.8, heightMm: 9.5, thread: "screw" },
  F24_410: { code: "24-410", outerDiameterMm: 23.9, heightMm: 10.5, thread: "screw" },
  F38_400: { code: "38-400", outerDiameterMm: 37.6, heightMm: 9.7, thread: "screw" },
  F45_400: { code: "45-400", outerDiameterMm: 44.6, heightMm: 9.7, thread: "screw" },
  F53_400: { code: "53-400", outerDiameterMm: 52.6, heightMm: 9.7, thread: "screw" },
  F58_400: { code: "58-400", outerDiameterMm: 57.6, heightMm: 9.7, thread: "screw" },
  F70_400: { code: "70-400", outerDiameterMm: 69.6, heightMm: 10.2, thread: "screw" },
  FEA15: { code: "FEA 15 crimp", outerDiameterMm: 17.4, heightMm: 7.0, thread: "crimp" },
  /** 1 inch aerosol valve cup (FEA 215): curl over the 25.4 mm opening. */
  AEROSOL_1IN: { code: "1 in valve cup (FEA 215)", outerDiameterMm: 31.0, heightMm: 4.0, thread: "crimp" },
  WIPER_12: { code: "12 mm wiper neck", outerDiameterMm: 12.5, heightMm: 8.0, thread: "screw" },
  END_200: { code: "200 end", outerDiameterMm: 50.8, heightMm: 3.0, thread: "seam" },
  END_202: { code: "202 end", outerDiameterMm: 54.0, heightMm: 3.0, thread: "seam" },
} as const satisfies Record<string, NeckFinish>;

export function crossSection(kind: SectionKind, d: CatalogueDims, cornerRatio = 0.16): CrossSection {
  const depthRatio = (d.G ?? d.D) / d.D;
  switch (kind) {
    case "round":
      return { kind: "round" };
    case "square":
      return { kind: "roundedRect", cornerRatio, depthRatio };
    case "rect":
      return { kind: "roundedRect", cornerRatio, depthRatio };
    case "stadium":
      // corner = half depth: straight long sides with full round ends (oval approximation)
      return { kind: "roundedRect", cornerRatio: depthRatio, depthRatio };
  }
}

const isRound = (s: SectionKind) => s === "round";

/** Round the control polygon, drop it onto y = 0 and attach the zones. */
function finalize(ctrl: ControlPoint[], section: CrossSection, extra: Omit<VesselProfile, "outer" | "section">): VesselProfile {
  const outer = roundCorners(ctrl);
  let minY = Infinity;
  for (const p of outer) minY = Math.min(minY, p.y);
  const dy = minY > 0 && minY < 1.5 ? minY : 0;
  if (dy) for (const p of outer) p.y -= dy;
  const z = <T extends { y0: Mm; y1: Mm }>(v: T): T => ({ ...v, y0: v.y0 - dy, y1: v.y1 - dy });
  return {
    outer,
    section,
    ...extra,
    body: z(extra.body),
    shoulder: extra.shoulder ? z(extra.shoulder) : undefined,
    finishTopY: extra.finishTopY - dy,
    fillMaxY: extra.fillMaxY - dy,
  };
}

/** Thread / crimp finish from (rootY) to topY, then into the bore. s = 0 (round neck). */
function finish(neck: NeckFinish, rootY: Mm, topY: Mm, bore: Mm): ControlPoint[] {
  const T = neck.outerDiameterMm / 2;
  const root = T - Math.min(0.9, T * 0.08);
  const start = topY - neck.heightMm;
  const pts: ControlPoint[] = [];
  if (rootY < start - 0.2) pts.push({ r: root, y: rootY + 0.01, round: 0.5, s: 0 });
  if (neck.thread === "screw" || neck.thread === "lug") {
    const pitch = Math.min(3.5, neck.heightMm / 3.2);
    let y = start + pitch * 0.6;
    for (let k = 0; k < 2; k++) {
      pts.push({ r: root, y: y - pitch * 0.35, s: 0 });
      pts.push({ r: T, y, round: 0.25, s: 0 });
      pts.push({ r: root, y: y + pitch * 0.35, s: 0 });
      y += pitch;
    }
    pts.push({ r: root, y: topY - 0.8, round: 0.4, s: 0 });
  } else if (neck.thread === "crimp") {
    pts.push({ r: root - 0.4, y: start + 0.2, round: 0.3, s: 0 });
    pts.push({ r: T, y: start + neck.heightMm * 0.45, round: Math.min(1.2, neck.heightMm * 0.3), s: 0 });
    pts.push({ r: T, y: topY - 0.4, round: 0.4, s: 0 });
  }
  pts.push({ r: root, y: topY, round: 0.4, s: 0 });
  pts.push({ r: Math.max(0.3, root - bore), y: topY, round: 0.3, s: 0 });
  pts.push({ r: Math.max(0.3, root - bore), y: topY - Math.min(6, neck.heightMm + 2), s: 0 });
  return pts;
}

// ---------------------------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------------------------

interface Built {
  profile: VesselProfile;
  innerTopY: Mm;
  sleeveY0: Mm;
  sleeveY1: Mm;
  lid: LidGeometry | null;
  closedH: Mm;
  /**
   * Where the renderer anchors the closure (profile.finishTopY) when it is not the top of the
   * profile: the end panel of ring-pull / foil ends, and the anchor that puts a renderer overcap
   * (BULLET_CAP, TWIST_UP) flush with the case top.
   */
  closureY?: Mm;
}

function bottle(s: Extract<ShapeSpec, { type: "bottle" }>, d: CatalogueDims, neck: NeckFinish): Built {
  const R = d.D / 2;
  const T = neck.outerDiameterMm / 2;
  const topY = d.H;
  const neckR = Math.min(R - 1, T - Math.min(0.9, T * 0.08) + (s.glass ? 0.6 : 0.3));
  const collar = s.collarMm ?? 0;
  const neckRootY = topY - neck.heightMm - (s.neckMm ?? (s.glass ? 2 : 1.5)) - collar;
  const span = R - neckR;
  const shoulderH =
    s.shoulder === "round" ? span * 0.62 : s.shoulder === "cone" ? Math.max(2, span * (s.coneRatio ?? 1)) : Math.min(3.2, Math.max(1.2, span * 0.25));
  const shoulderY = neckRootY - shoulderH;
  const foot = Math.min(R * 0.2, s.glass ? 4 : 3);
  const ctrl: ControlPoint[] = [
    { r: 0, y: s.glass ? 1.4 : 0.8, s: 1 },
    { r: R * 0.8, y: 0, round: 1.2, s: 1 },
    { r: R, y: foot, round: foot * 0.8, s: 1 },
  ];
  if (s.shoulder === "round") {
    ctrl.push({ r: R, y: shoulderY, s: 1 });
    const steps = 10;
    for (let k = 1; k < steps; k++) {
      const t = (k / steps) * (Math.PI / 2);
      const sk = isRound(s.section) ? 1 : Math.cos(t); // blend square body into the round neck
      ctrl.push({ r: neckR + span * Math.cos(t), y: shoulderY + shoulderH * Math.sin(t), s: sk });
    }
  } else if (s.shoulder === "cone") {
    ctrl.push({ r: R, y: shoulderY, round: Math.min(4, span * 0.5), s: 1 });
  } else {
    ctrl.push({ r: R, y: shoulderY, round: Math.min(2.4, shoulderH * 0.8), s: 1 });
  }
  ctrl.push({ r: neckR, y: neckRootY, round: Math.min(1.2, shoulderH * 0.4), s: 0 });
  ctrl.push(...finish(neck, neckRootY, topY, s.glass ? 2.4 : 1.2));
  const body = { y0: foot + 1.5, y1: shoulderY - 0.8, r0: R, r1: R };
  const profile = finalize(ctrl, crossSection(s.section, d), {
    wallMm: s.wallMm,
    baseMm: s.baseMm,
    body,
    shoulder: { y0: shoulderY + shoulderH * 0.15, y1: shoulderY + shoulderH * 0.75, r0: radiusAtCtrl(R, neckR, 0.15, s.shoulder), r1: radiusAtCtrl(R, neckR, 0.75, s.shoulder) },
    finishTopY: topY,
    finishR: s.collarMm ? T + 1.2 : T,
    finishH: neck.heightMm + collar,
    fillMaxY: neckRootY,
  });
  return { profile, innerTopY: profile.finishTopY - 1, sleeveY0: 1, sleeveY1: neckRootY, lid: null, closedH: d.H };
}

function radiusAtCtrl(R: Mm, neckR: Mm, t: number, shoulder: "round" | "flat" | "cone"): Mm {
  if (shoulder === "round") return neckR + (R - neckR) * Math.cos((t * Math.PI) / 2);
  return R + (neckR - R) * t;
}

/** Closed cosmetic case (lipstick, deodorant stick, compact): body + cap, split groove. */
function caseShape(s: Extract<ShapeSpec, { type: "case" }>, d: CatalogueDims): Built {
  const R = d.D / 2;
  const H = d.H;
  // Overcaps drawn by the renderer; the split groove sits under the cap edge.
  // BULLET_CAP (lipstick): h = max(24, 3.2 (R + 1)), top = anchor + 0.45 h.
  // TWIST_UP (stick): from anchor - 18 to anchor + max(8, (R + 0.6) / 2).
  const bulletH = Math.max(24, 3.2 * (R + 1));
  const twistUp = Math.max(8, (R + 0.6) * 0.5);
  const split = s.cap === "bullet" ? Math.max(H * 0.3, H - bulletH + 0.8) : s.cap === "twist" ? Math.max(H * 0.3, H - twistUp - 18 + 0.8) : H * s.capSplit;
  const ch = Math.min(1.2, R * 0.08);
  const ctrl: ControlPoint[] = [
    { r: 0, y: 0 },
    { r: R - ch, y: 0, round: 0.4 },
    { r: R, y: ch, round: 0.4 },
    { r: R, y: split - 0.6 },
    { r: R - 0.5, y: split - 0.3 },
    { r: R - 0.5, y: split + 0.3 },
    { r: R, y: split + 0.6 },
    { r: R, y: H - ch, round: 0.4 },
    { r: R - ch, y: H, round: 0.4 },
    { r: 0, y: H },
  ];
  const lower = split > H / 2;
  const profile = finalize(ctrl, crossSection(s.section, d, 0.22), {
    wallMm: s.wallMm,
    baseMm: s.wallMm,
    body: lower ? { y0: ch + 1, y1: split - 1.2, r0: R, r1: R } : { y0: split + 1.2, y1: H - ch - 1, r0: R, r1: R },
    finishTopY: H,
    finishR: R,
    finishH: 0,
    fillMaxY: split,
  });
  const lid: LidGeometry = { type: s.capSplit > 0.5 && H < 35 ? "hinged" : "slip", section: s.section, y0: split, y1: H, r: R, depthRatio: (d.G ?? d.D) / d.D, topR: R - ch - 2 };
  // anchor the renderer's overcap so its top is the case top
  const closureY = s.cap === "bullet" ? H - 0.45 * bulletH : s.cap === "twist" ? H - twistUp : undefined;
  return { profile, innerTopY: split, sleeveY0: 0.5, sleeveY1: H - 0.5, lid, closedH: H, closureY };
}

/** ISO 9187-1 style ampoule: body, constriction (break ring), bulb, stem, sealed tip. */
function ampoule(d: CatalogueDims): Built {
  const R = d.D / 2;
  const H = d.H;
  const bodyTop = H * 0.56;
  const neckY = H * 0.64;
  const bulbY = H * 0.71;
  const stemY = H * 0.79;
  const ctrl: ControlPoint[] = [
    { r: 0, y: 0.6 },
    { r: R * 0.8, y: 0, round: 1 },
    { r: R, y: Math.min(2.5, R * 0.4), round: Math.min(2, R * 0.35) },
    { r: R, y: bodyTop, round: R * 0.5 },
    { r: R * 0.5, y: neckY, round: R * 0.25 },
    { r: R * 0.72, y: bulbY, round: R * 0.4 },
    { r: R * 0.36, y: stemY, round: R * 0.3 },
    { r: R * 0.33, y: H - 1.5, round: 0.6 },
    { r: 0, y: H },
  ];
  const profile = finalize(ctrl, { kind: "round" }, {
    wallMm: Math.min(0.6, R * 0.06),
    baseMm: 0.6,
    body: { y0: 3, y1: bodyTop - R * 0.5, r0: R, r1: R },
    finishTopY: H,
    finishR: R * 0.33,
    finishH: 0,
    fillMaxY: bodyTop,
  });
  return { profile, innerTopY: neckY, sleeveY0: 1, sleeveY1: bodyTop, lid: null, closedH: H };
}

/** Wide-mouth cream jar; double wall = thick acrylic outer shell around a PP cup. */
function jar(s: Extract<ShapeSpec, { type: "jar" }>, d: CatalogueDims, neck: NeckFinish): Built {
  const R = d.D / 2;
  const T = neck.outerDiameterMm / 2;
  const H = d.H;
  const neckR = T - 0.8;
  const neckRootY = H - neck.heightMm - 0.8;
  const shoulderH = Math.max(1.5, Math.min(4, (R - neckR) * 0.7));
  const shoulderY = neckRootY - shoulderH;
  const ctrl: ControlPoint[] = [
    { r: 0, y: 1.5 },
    { r: R * 0.85, y: 0, round: 2 },
    { r: R, y: 4, round: 3 },
    { r: R, y: shoulderY, round: Math.min(4, shoulderH) },
    { r: neckR, y: neckRootY, round: 0.8 },
    ...finish(neck, neckRootY, H, s.doubleWall ? Math.max(2, R - neckR) : 2.2),
  ];
  const profile = finalize(ctrl, { kind: "round" }, {
    wallMm: s.wallMm,
    baseMm: s.baseMm,
    body: { y0: 5, y1: shoulderY - 1, r0: R, r1: R },
    finishTopY: H,
    finishR: T,
    finishH: neck.heightMm,
    fillMaxY: neckRootY,
  });
  const capH = Math.max(10, Math.min(22, H * 0.45));
  const lid: LidGeometry = { type: "plug", section: "round", y0: neckRootY - 0.5, y1: neckRootY - 0.5 + capH, r: R, depthRatio: 1, topR: R - 3 };
  return { profile, innerTopY: H - 1, sleeveY0: 1, sleeveY1: shoulderY, lid, closedH: lid.y1 };
}

/** Two-piece aluminium beverage can: domed base, necked top, double seam. */
function bevcan(d: CatalogueDims, neck: NeckFinish): Built {
  const R = d.D / 2;
  const H = d.H;
  const Rs = neck.outerDiameterMm / 2 + 1.2;
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
  const profile = finalize(ctrl, { kind: "round" }, {
    wallMm: 0.1,
    baseMm: 10,
    body: { y0: 10, y1: neckY - 3, r0: R, r1: R },
    finishTopY: H,
    finishR: Rs,
    finishH: 3,
    fillMaxY: H - 8,
  });
  return { profile, innerTopY: H - 6, sleeveY0: 3, sleeveY1: H - 3.4, lid: null, closedH: H };
}

/** Food can (3-piece welded or 2-piece drawn), fish tins, paint tins: double seams, beads. */
function metalcan(s: Extract<ShapeSpec, { type: "metalcan" }>, d: CatalogueDims): Built {
  const R = d.D / 2;
  const H = d.H;
  const seam = 1.4; // double seam stands proud of the body
  const sh = Math.min(3, H * 0.12); // seam height
  const endIn = Math.min(2.2, R * 0.08); // countersink inset of the end panel
  const ctrl: ControlPoint[] = [];
  if (s.bottomSeam) {
    ctrl.push({ r: 0, y: sh + 0.2 }, { r: R - endIn, y: sh + 0.2, round: 0.6 }, { r: R - endIn, y: 0.6, round: 0.4 });
    ctrl.push({ r: R + seam - 0.4, y: 0, round: 0.5 }, { r: R + seam, y: sh, round: 0.6 }, { r: R, y: sh + 0.6, round: 0.6 });
  } else {
    ctrl.push({ r: 0, y: 0.8 }, { r: R * 0.82, y: 0, round: 1.5 }, { r: R, y: Math.min(4, H * 0.18), round: Math.min(3, H * 0.14) });
  }
  const bodyY0 = s.bottomSeam ? sh + 1.5 : Math.min(4, H * 0.18) + 1;
  const bodyY1 = H - sh - 1.5;
  if (s.beads && bodyY1 - bodyY0 > 40) {
    // panel beads: two bands of rings, leaving the label panel middle smooth
    const n = 3;
    for (const zone of [bodyY0 + 6, bodyY1 - 6 - (n - 1) * 4]) {
      for (let k = 0; k < n; k++) {
        const y = zone + k * 4;
        ctrl.push({ r: R, y: y - 1.2, round: 0.5 }, { r: R - 0.7, y, round: 0.6 }, { r: R, y: y + 1.2, round: 0.5 });
      }
    }
  }
  ctrl.push({ r: R, y: H - sh - 0.6, round: 0.6 }, { r: R + seam, y: H - sh, round: 0.6 }, { r: R + seam - 0.4, y: H, round: 0.5 });
  ctrl.push({ r: R - endIn, y: H - 0.6, round: 0.4 }, { r: R - endIn, y: H - s.endDepthMm, round: 0.6 }, { r: 0, y: H - s.endDepthMm });
  const section = crossSection(s.section, d, 0.27);
  const profile = finalize(ctrl, section, {
    wallMm: 0.2,
    baseMm: s.bottomSeam ? sh + 0.2 : 0.5,
    body: { y0: bodyY0, y1: bodyY1, r0: R, r1: R },
    finishTopY: H,
    finishR: R + seam,
    finishH: sh,
    fillMaxY: H - s.endDepthMm,
  });
  const lid: LidGeometry = {
    type: s.endDepthMm > 4 ? "lever" : "end",
    section: s.section,
    y0: H - s.endDepthMm,
    y1: H,
    r: R + seam,
    depthRatio: section.kind === "round" ? 1 : section.depthRatio,
    topR: R - endIn - 2,
  };
  // Ring-pull and foil ends: anchor on the end panel, where the renderer's EOE_RING / PEEL_FOIL sit
  // (a plain double-seam end keeps the generic core tab under the panel). Lever lids: the renderer's
  // LEVER_LID plugs into the chime from the seam top (default anchor H).
  const closureY = lid.type === "lever" ? undefined : H - s.endDepthMm;
  return { profile, innerTopY: H - s.endDepthMm, sleeveY0: bodyY0 - 1, sleeveY1: bodyY1 + 1, lid, closedH: H, closureY };
}

/** Decorative tins (biscuit, gift, tea caddy): straight body, slip (or plug + slip) lid. */
export function tinLidH(d: CatalogueDims): Mm {
  return Math.max(10, Math.min(30, d.H * 0.22));
}

function tin(s: Extract<ShapeSpec, { type: "tin" }>, d: CatalogueDims): Built {
  const R = d.D / 2;
  const H = d.H;
  const lidH = tinLidH(d);
  // open body with a rolled rim for every section: the renderer's slip lid (core SLIP_LID) and plug
  // lid (PLUG_LID style) follow the section, square tins included
  const ctrl: ControlPoint[] = [
    { r: 0, y: 0.6 },
    { r: R - 1.5, y: 0, round: 0.8 },
    { r: R, y: 1.6, round: 1 },
    { r: R, y: H - 1.4, round: 0.5 },
    { r: R - 0.8, y: H, round: 0.4 },
    { r: R - 1.1, y: H - 0.5 },
    { r: R - 1.1, y: H - 6 },
  ];
  const section = crossSection(s.section, d, 0.1);
  const profile = finalize(ctrl, section, {
    wallMm: 0.25,
    baseMm: 0.6,
    body: { y0: 3, y1: H - lidH - 1.5, r0: R, r1: R },
    finishTopY: H,
    finishR: R,
    finishH: lidH,
    fillMaxY: H - 2,
  });
  const lid: LidGeometry = {
    type: s.lid,
    section: s.section,
    y0: H - lidH,
    y1: H + 0.6,
    r: R + 0.6,
    depthRatio: section.kind === "round" ? 1 : section.depthRatio,
    topR: R + 0.6 - 4,
  };
  return { profile, innerTopY: H - 1, sleeveY0: 1, sleeveY1: H - lidH - 0.5, lid, closedH: H + 0.6 };
}

/** Aerosol can: domed/concave base, ogive shoulder, 1 inch valve-cup curl. */
function aerosol(s: Extract<ShapeSpec, { type: "aerosol" }>, d: CatalogueDims, neck: NeckFinish): Built {
  const R = d.D / 2;
  const H = d.H;
  const curlR = neck.outerDiameterMm / 2;
  const shoulderH = Math.max(8, (R - curlR) * 1.35);
  const curlY = H - neck.heightMm;
  const shoulderY = curlY - shoulderH;
  const ctrl: ControlPoint[] = s.monobloc
    ? [
        { r: 0, y: 7 },
        { r: R * 0.7, y: 1.6, round: 3 },
        { r: R * 0.86, y: 0, round: 1.5 },
        { r: R, y: 3, round: 3 },
      ]
    : [
        { r: 0, y: 9 },
        { r: R * 0.85, y: 3.2, round: 2 },
        { r: R - 1.6, y: 0.4, round: 0.4 },
        { r: R + 1.2, y: 0, round: 0.5 },
        { r: R + 1.3, y: 3, round: 0.6 },
        { r: R, y: 3.6, round: 0.6 },
      ];
  ctrl.push({ r: R, y: shoulderY, round: shoulderH * 0.7 });
  ctrl.push({ r: curlR - 1, y: curlY, round: 1.5 });
  ctrl.push({ r: curlR, y: curlY + neck.heightMm * 0.5, round: 1.2 });
  ctrl.push({ r: curlR - 1.2, y: H, round: 0.3 });
  ctrl.push({ r: 12.7, y: H - 1.2, round: 0.3 });
  ctrl.push({ r: 12.7, y: H - 5, round: 0.6 });
  ctrl.push({ r: 0, y: H - 5 });
  const bodyY0 = s.monobloc ? 5 : 5.5;
  const profile = finalize(ctrl, { kind: "round" }, {
    wallMm: s.monobloc ? 0.45 : 0.22,
    baseMm: s.monobloc ? 7 : 9,
    body: { y0: bodyY0, y1: shoulderY - 1, r0: R, r1: R },
    shoulder: { y0: shoulderY + 1, y1: shoulderY + shoulderH * 0.5, r0: R - 0.5, r1: R - (R - curlR) * 0.45 },
    finishTopY: H,
    finishR: curlR,
    finishH: neck.heightMm,
    fillMaxY: curlY,
  });
  return { profile, innerTopY: curlY, sleeveY0: 1, sleeveY1: shoulderY + shoulderH * 0.5, lid: null, closedH: H };
}

/** Moulded / thermoformed cups, tubs, punnets and clamshells (wider at the top). */
function cup(s: Extract<ShapeSpec, { type: "cup" }>, d: CatalogueDims): Built {
  const Rt = d.D / 2;
  const Rb = Rt - (d.taper ?? 0) / 2;
  const H = d.H;
  const f = s.flangeMm;
  const section = crossSection(s.section, d, s.section === "round" ? 0.2 : 0.18);
  if (s.lid === "hinged") {
    // Clamshell base tray with its flange. The renderer's HINGED_LID draws the mirrored lid tray,
    // max(8, min(30, 0.35 hb)) deep above the flange, so pick the hinge line hb for a closed height H.
    const lidDepth = (y: Mm) => Math.max(8, Math.min(30, 0.35 * y));
    const hb = lidDepth(H / 1.35) === 0.35 * (H / 1.35) ? H / 1.35 : lidDepth(H / 1.35) === 30 ? H - 30 : H - 8;
    const Rm = Rt; // flange line (widest)
    const ctrl: ControlPoint[] = [
      { r: 0, y: 0 },
      { r: Rb, y: 0, round: Math.min(4, Rb * 0.1) },
      { r: Rm - f, y: hb - 1, round: 1 },
      { r: Rm, y: hb - 0.4, round: 0.5 },
      { r: Rm, y: hb, round: 0.3 },
      { r: Rm - f, y: hb, round: 0.3 },
      { r: Rm - f - 0.3, y: hb - 3 },
    ];
    const profile = finalize(ctrl, section, {
      wallMm: s.wallMm,
      baseMm: s.wallMm,
      body: { y0: 2, y1: hb - 2, r0: Rb + (Rm - f - Rb) * (2 / hb), r1: Rb + (Rm - f - Rb) * ((hb - 2) / hb) },
      finishTopY: hb,
      finishR: Rm,
      finishH: 0,
      fillMaxY: hb,
    });
    const lid: LidGeometry = { type: "hinged", section: s.section, y0: hb, y1: H, r: Rm, depthRatio: section.kind === "round" ? 1 : section.depthRatio, topR: Rm - 4 };
    return { profile, innerTopY: hb - s.wallMm, sleeveY0: 1, sleeveY1: hb - 1, lid, closedH: H };
  }
  // Tubs and cups: open rim with a flange; snap lids (SNAP_LID), film lids (PEEL_FOIL) and hinged
  // options are drawn by the renderer and follow the section.
  const rimY = H - 1.2;
  const top: ControlPoint[] = [
    { r: Rt + f, y: H, round: 0.4 },
    { r: Rt - s.wallMm, y: H, round: 0.3 },
    { r: Rt - s.wallMm - 0.2, y: H - 3 },
  ];
  const ctrl: ControlPoint[] = [
    { r: 0, y: 1.2 },
    { r: Rb - 2, y: 0, round: 1 },
    { r: Rb, y: 1.5, round: 1.5 },
    { r: Rt - 0.4, y: rimY - 1, round: 1.5 },
    { r: Rt + f, y: rimY, round: 0.5 },
    ...top,
  ];
  const y0 = 3;
  const y1 = rimY - 2.5;
  const rAt = (y: Mm) => Rb + ((Rt - 0.4 - Rb) * (y - 1.5)) / (rimY - 1 - 1.5);
  const profile = finalize(ctrl, section, {
    wallMm: s.wallMm,
    baseMm: s.wallMm,
    body: { y0, y1, r0: rAt(y0), r1: rAt(y1) },
    finishTopY: H,
    finishR: Rt + f,
    finishH: 1.2,
    fillMaxY: H - 2,
  });
  const lidT = s.lid === "snap" ? Math.max(6, Math.min(14, H * 0.12)) : s.lid === "foil" ? 0.1 : 0;
  const lid: LidGeometry | null =
    s.lid === "none" ? null : { type: s.lid, section: s.section, y0: H - (s.lid === "snap" ? 2 : 0), y1: H + lidT, r: Rt + f + (s.lid === "snap" ? 1 : 0), depthRatio: section.kind === "round" ? 1 : section.depthRatio, topR: Rt - 3 };
  return { profile, innerTopY: H - 0.5, sleeveY0: 2, sleeveY1: rimY - 1.5, lid, closedH: lid ? lid.y1 : H };
}

/** Squeeze tubes reuse the core tube profile (cap down, crimp seal up). */
function tube(s: Extract<ShapeSpec, { type: "tube" }>, d: CatalogueDims): Built {
  const core = buildProfile("SQUEEZE_TUBE", { D: d.D, H: d.H });
  const t = tubeDims({ D: d.D, H: d.H });
  const section: CrossSection = s.oval ? crossSection("stadium", d) : { kind: "round" };
  const profile: VesselProfile = { ...core, section, wallMm: s.metal ? 0.12 : core.wallMm };
  return { profile, innerTopY: t.sealY0, sleeveY0: t.bodyY0, sleeveY1: t.sealY0, lid: null, closedH: t.totalH };
}

/** Blister: grid of round cavities on a rectangular card, sealing border kept free. */
export function blisterLayout(d: CatalogueDims): BlisterGeometry {
  const rows = Math.max(1, Math.round(d.rows ?? 2));
  const cols = Math.max(1, Math.round(d.cols ?? 5));
  const cav = d.cavityD ?? 10;
  const border = 4;
  const pitchX = (d.D - 2 * border) / cols;
  const pitchY = (d.H - 2 * border) / rows;
  const cavities: BlisterCavity[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cavities.push({ x: border + pitchX * (c + 0.5), y: border + pitchY * (r + 0.5), d: cav });
  return { widthMm: d.D, heightMm: d.H, cavityDepthMm: d.G ?? 4, cavities, borderMm: border, foilMicron: 20 };
}

/** Build the full geometry for a shape + size. */
export function buildGeometry(shape: ShapeSpec, d: CatalogueDims, neck?: NeckFinish): CatalogueGeometry {
  if (shape.type === "blister") {
    const blister = blisterLayout(d);
    const h = (d.G ?? 4) + 0.6;
    return { kind: "blister", profile: null, lid: null, blister, innerTopY: 0, sleeveY0: 0, sleeveY1: 0, printY0: 0, printY1: d.H, overallHeightMm: h };
  }
  const n = (fallback: NeckFinish) => neck ?? fallback;
  let b: Built;
  let kind: CatalogueGeometry["kind"] = "lathe";
  switch (shape.type) {
    case "bottle":
      b = bottle(shape, d, n(EXTRA_NECKS.F18_410));
      break;
    case "case":
      b = caseShape(shape, d);
      break;
    case "ampoule":
      b = ampoule(d);
      break;
    case "jar":
      b = jar(shape, d, n(EXTRA_NECKS.F58_400));
      break;
    case "bevcan":
      b = bevcan(d, n(EXTRA_NECKS.END_202));
      break;
    case "metalcan":
      b = metalcan(shape, d);
      break;
    case "tin":
      b = tin(shape, d);
      break;
    case "aerosol":
      b = aerosol(shape, d, n(EXTRA_NECKS.AEROSOL_1IN));
      break;
    case "cup":
      b = cup(shape, d);
      break;
    case "tube":
      b = tube(shape, d);
      kind = "tube";
      break;
  }
  if (b.closureY !== undefined) b = { ...b, profile: { ...b.profile, finishTopY: b.closureY } };
  if (kind === "lathe" && b.profile.section.kind === "roundedRect") kind = "extrusion";
  return {
    kind,
    profile: b.profile,
    lid: b.lid,
    blister: null,
    innerTopY: b.innerTopY,
    sleeveY0: b.sleeveY0,
    sleeveY1: b.sleeveY1,
    printY0: b.profile.body.y0,
    printY1: b.profile.body.y1,
    overallHeightMm: b.closedH,
  };
}
