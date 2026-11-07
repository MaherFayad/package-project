import { BoxGeometry, CatmullRomCurve3, ConeGeometry, CylinderGeometry, ExtrudeGeometry, Shape, ShapeGeometry, SphereGeometry, TorusGeometry, TubeGeometry, Vector3, type BufferGeometry } from "three";
import { radiusAt, roundCorners, tubeDims, tinLidHeight, type ClosureKind, type ControlPoint, type VesselDims, type VesselKind, type VesselProfile } from "@/lib/vessels";
import { revolve, ringsFromPoints, type Ring } from "./geometry";

/** What a part is made of (the model maps roles to materials). */
/** "gasket": the red rubber ring of a swing top; "wire": bare steel wire (bail, cage). */
/** "clear": a clear PP / PETG overcap. */
export type PartRole = "cap" | "capMetal" | "rubber" | "pipette" | "dark" | "body" | "gasket" | "wire" | "clear";

export interface ClosurePart {
  geometry: BufferGeometry;
  role: PartRole;
  /** "moving" parts follow the open animation; "static" stay on the container. */
  group: "moving" | "static" | "tab";
  position?: [number, number, number];
}

export interface ClosureModel {
  parts: ClosurePart[];
  /** How the closure opens in the "open" animation. */
  motion: "unscrew" | "lift" | "tab" | "none";
  /** Unscrew: turns and thread rise (mm). */
  turns: number;
  rise: number;
  /** Lift: how far the moving group travels up after unscrewing (mm). */
  lift: number;
  /** Tab pivot (can end) in mm. */
  pivot?: [number, number, number];
  /** Top of the closed closure (for framing). */
  topY: number;
  /**
   * Flat top a lid (disc) label sits on, when the closure covers the container's own lid plane
   * (snap / plug / hinged lids): the label rides on the lid instead of hiding under it (R5-3Q-G-25).
   */
  printTopY?: number;
}

const lathe = (pts: ControlPoint[], opts: { segments?: number; ribs?: { count: number; depth: number; where: (r: Ring) => boolean }; section?: VesselProfile["section"] } = {}) =>
  revolve(ringsFromPoints(roundCorners(pts, 5)), { segments: opts.segments ?? 96, ribs: opts.ribs, section: opts.section });

interface ScrewCapOptions {
  /** Wider shell (mm on the radius): child-resistant caps are a double shell over the inner cap. */
  extraR?: number;
  /** Taller top (mm). */
  extraTop?: number;
  /** Tamper-evident band under the skirt (bridges + a break line), as on TE / vented caps. */
  te?: boolean;
  /** Rib count (0 = smooth). */
  ribs?: number;
}

/** Ribbed screw cap over a finish. */
function screwCap(p: VesselProfile, extraTopPts: ControlPoint[] = [], o: ScrewCapOptions = {}): { geometry: BufferGeometry; yt: number; yb: number; r: number } {
  const top = p.finishTopY;
  const r = p.finishR + 1.5 + (o.extraR ?? 0);
  const yb = top - p.finishH - 0.6;
  const yt = top + 2.8 + (o.extraTop ?? 0);
  // TE band: a ~3 mm ring below the skirt, joined by a perforated break line (the ring stays on
  // the neck bead when the cap is first opened)
  const band: ControlPoint[] = o.te
    ? [
        { r: r - 1.1, y: yb - 3.2 + 3 },
        { r: r - 1.1, y: yb - 3.2, round: 0.3 },
        { r: r - 0.3, y: yb - 3.2, round: 0.3 },
        { r: r - 0.1, y: yb - 0.9 },
        { r: r - 0.75, y: yb - 0.55 },
        { r: r - 0.75, y: yb - 0.2 },
        { r: r - 0.2, y: yb, round: 0.2 },
      ]
    : [
        { r: r - 1.1, y: yb + 6 },
        { r: r - 1.1, y: yb, round: 0.3 },
        { r: r - 0.2, y: yb, round: 0.3 },
      ];
  const pts: ControlPoint[] = [
    ...band,
    { r, y: yb + 0.7, round: 0.3 },
    { r, y: yb + 2.2 },
    { r: r - 0.45, y: yb + 2.6 },
    { r, y: yb + 3.0 },
    { r, y: yt - 1.2, round: 1.2 },
    { r: r - 0.9, y: yt, round: 0.8 },
    ...(extraTopPts.length ? extraTopPts : [{ r: 0, y: yt }]),
  ];
  const ribTop = yt - 1.6;
  const count = o.ribs ?? 72;
  const geometry = lathe(pts, count ? { segments: 240, ribs: { count, depth: 0.32, where: (ring) => ring.y > yb + 3.4 && ring.y < ribTop && ring.r > r - 0.05 } } : { segments: 160 });
  return { geometry, yt, yb: o.te ? yb - 3.2 : yb, r };
}

/** Steel wire along a path (mm points). */
function wire(points: [number, number, number][], radius = 0.75): BufferGeometry {
  const curve = new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z)), false, "centripetal");
  return new TubeGeometry(curve, Math.max(24, points.length * 12), radius, 8, false);
}

/** Largest outer radius of the container body below `belowY` (cap flush with the body). */
function bodyR(p: VesselProfile, belowY: number): number {
  let m = 0;
  for (const q of p.outer as { r: number; y: number }[]) if (q.y < belowY) m = Math.max(m, q.r);
  return m;
}

/** Length of the neck below the finish top: down to where the glass widens past 1.35 × the finish. */
function neckLength(p: VesselProfile): number {
  const top = p.finishTopY;
  for (let d = 2; d < top; d += 1) if (radiusAt(p.outer as never, top - d) > p.finishR * 1.35) return d;
  return top * 0.3;
}

/**
 * Closure styles the core kinds cannot express (X-01): a bottle can carry them instead of its
 * core closure. Real references: 26 mm crown (ISO 12821, fluted steel, ~6 mm tall), ROPP
 * aluminium (knurled top band, long plain skirt with a perforated pilfer ring), wine cork under a
 * 40–60 mm foil capsule, sparkling mushroom cork under foil + wire hood, ROPP pourer with spout.
 */
export const CLOSURE_STYLES = [
  "CROWN",
  "ROPP",
  "CORK_CAPSULE",
  "SPARKLING",
  "POURER",
  "ROLL_ON_BALL",
  "AIRLESS_PUMP",
  "BULLET_CAP",
  "PEEL_FOIL",
  "EOE_RING",
  "PLUG_LID",
  "LEVER_LID",
  "SNAP_LID",
  "HINGED_LID",
  "TWIST_UP",
  // R6 (R5-3Q-F-06 … G-14): closures that used to collapse onto a plain screw / lug cap
  "SWING_TOP",
  "MEASURE_CUP",
  "FLIP_TOP_CAP",
  "CR_CAP",
  "TE_CAP",
  "BAR_TOP",
  "MIST_COLLAR",
  "DROPPER_TIP",
  "AEROSOL",
  "CRIMP_FLIP_OFF",
  "DOUBLE_WALL_CAP",
  "PIERCING",
  // R6-3Q-G-04
  "TREATMENT_PUMP",
] as const;
/** Styles that close the whole mouth of a can / tub / tray (allowed over lid and can-end cores). */
const MOUTH_STYLES: readonly string[] = ["PEEL_FOIL", "EOE_RING", "PLUG_LID", "LEVER_LID", "SNAP_LID", "HINGED_LID", "TWIST_UP", "DOUBLE_WALL_CAP"];
/** Squeeze-tube styles (the tube stands on its cap at y = 0). */
const TUBE_STYLES: readonly string[] = ["PIERCING"];
export type ClosureStyle = (typeof CLOSURE_STYLES)[number];

/** Capsule / sleeve hugging the neck from `top` down `depth` mm (follows the glass, +gap). */
function neckSleeve(p: VesselProfile, depth: number, gap: number, top: number): ControlPoint[] {
  const pts: ControlPoint[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const y = top - depth + (depth * i) / steps;
    pts.push({ r: Math.max(p.finishR, radiusAt(p.outer as never, y)) + gap, y });
  }
  return pts;
}

function styledClosure(style: ClosureStyle, p: VesselProfile): ClosureModel {
  const top = p.finishTopY;
  const r = p.finishR;
  switch (style) {
    case "CROWN": {
      const yb = top - 6;
      const yt = top + 0.8;
      const g = lathe(
        [
          { r: r + 1.6, y: yb, s: 1 },
          { r: r + 2.2, y: yb + 0.6, round: 0.4 },
          { r: r + 1.4, y: yt - 1.2, round: 0.8 },
          { r: r + 0.6, y: yt, round: 0.6 },
          { r: 0, y: yt },
        ],
        // 21 flutes crimped round the bead
        { segments: 168, ribs: { count: 21, depth: 0.9, where: (ring) => ring.y < yt - 1.4 } },
      );
      return { parts: [{ geometry: g, role: "capMetal", group: "moving" }], motion: "lift", turns: 0, rise: 0, lift: 22, topY: yt };
    }
    case "ROPP":
    case "POURER": {
      // R5-3Q-F-02: an 18 mm skirt on a beer / oil ROPP finish, the full finish on a wine BVS
      // 30H60 (Stelvin) shell ~60 mm long
      const yb = top - Math.max(18, p.finishH);
      const yt = top + 1.5;
      const skirt = lathe(
        [
          { r: r + 0.3, y: yb + 3 },
          { r: r + 0.3, y: yb, round: 0.2 },
          { r: r + 0.8, y: yb + 0.3, round: 0.3 },
          { r: r + 0.8, y: yb + 3.2 },
          { r: r + 0.55, y: yb + 3.6 }, // pilfer-proof perforation line
          { r: r + 0.8, y: yb + 4 },
          { r: r + 0.8, y: yt - 1, round: 0.8 },
          { r: r - 0.6, y: yt, round: 0.6 },
          { r: 0, y: yt },
        ],
        { segments: 192, ribs: { count: 96, depth: 0.18, where: (ring) => ring.y > yt - 6 && ring.y < yt - 1.2 } },
      );
      const parts: ClosurePart[] = [{ geometry: skirt, role: "capMetal", group: "moving" }];
      let topY = yt;
      if (style === "POURER") {
        const sr = Math.max(2.5, r * 0.32);
        const spout = lathe([
          { r: sr * 0.7, y: yt + 6 },
          { r: sr, y: yt + 6, round: 0.3 },
          { r: sr * 0.85, y: yt + 1.5 },
          { r: sr * 1.8, y: yt, round: 0.6 },
          { r: 0, y: yt },
        ]);
        parts.push({ geometry: spout, role: "cap", group: "moving" });
        topY = yt + 6;
      }
      return { parts, motion: "unscrew", turns: 1.5, rise: 3, lift: 26, topY };
    }
    case "CORK_CAPSULE": {
      const yt = top + 0.5;
      // R5-3Q-F-15: the 40–60 mm capsule covers the neck, not a fixed 48 mm that ran onto the
      // shoulder of a short (187 ml, 250 ml) neck
      const sleeve = neckSleeve(p, Math.max(30, Math.min(55, neckLength(p) * 0.85, Math.max(p.finishH, 48))), 0.35, top);
      const g = lathe([...sleeve, { r: r + 0.35, y: yt, round: 0.6 }, { r: 0, y: yt }]);
      return { parts: [{ geometry: g, role: "capMetal", group: "moving" }], motion: "lift", turns: 0, rise: 0, lift: 30, topY: yt };
    }
    case "ROLL_ON_BALL": {
      // PP / glass ball seated in the fitment, tall dome cap over it
      const br = Math.max(3, r * 0.82);
      const ball = new SphereGeometry(br, 40, 24);
      ball.translate(0, top + br * 0.35, 0);
      const yb = top - p.finishH;
      const yt = top + br * 1.5 + 2;
      const cap = lathe([
        { r: r + 0.8, y: yb + 3 },
        { r: r + 0.8, y: yb, round: 0.3 },
        { r: r + 1.6, y: yb + 0.6, round: 0.5 },
        { r: r + 1.6, y: yt - r * 0.9, round: r * 0.8 },
        { r: 0, y: yt },
      ]);
      return {
        parts: [
          { geometry: ball, role: "pipette", group: "static" },
          { geometry: cap, role: "cap", group: "moving" },
        ],
        motion: "unscrew",
        turns: 1.5,
        rise: 3,
        lift: 30,
        topY: yt,
      };
    }
    case "AIRLESS_PUMP": {
      // flush collar + low actuator under a clear-ish overcap the width of the body
      const R = Math.max(r + 2, radiusAt(p.outer as never, top - 2));
      const collar = lathe([
        { r: R - 0.2, y: top - 8 },
        { r: R, y: top - 7.6, round: 0.3 },
        { r: R, y: top + 3, round: 0.8 },
        { r: r * 0.75, y: top + 3 },
        { r: r * 0.75, y: top + 9, round: 1.2 },
        { r: 0, y: top + 9 },
      ]);
      const yt = top + 16;
      const over = lathe([
        { r: R - 0.3, y: top - 7 },
        { r: R + 0.3, y: top - 7, round: 0.3 },
        { r: R + 0.3, y: yt - 2, round: 2 },
        { r: 0, y: yt },
      ]);
      return {
        parts: [
          { geometry: collar, role: "capMetal", group: "static" },
          { geometry: over, role: "cap", group: "moving" },
        ],
        motion: "lift",
        turns: 0,
        rise: 0,
        lift: 26,
        topY: yt,
      };
    }
    case "BULLET_CAP": {
      // lipstick / balm overcap: a straight cylinder reaching well down the case
      // flush with the case / bottle body, not the neck (R5-3Q-G-02: the lip-gloss cap was
      // narrower than its bottle)
      const R = Math.max(r + 1, radiusAt(p.outer as never, top - 2) + 0.4, bodyR(p, top - 2) + 0.3);
      const h = Math.max(24, R * 3.2);
      const yb = top - h * 0.55;
      const yt = yb + h;
      const cap = lathe([
        { r: R - 0.4, y: yb + 3 },
        { r: R - 0.4, y: yb, round: 0.2 },
        { r: R, y: yb + 0.3, round: 0.3 },
        { r: R, y: yt - 1, round: 1 },
        { r: 0, y: yt },
      ]);
      return { parts: [{ geometry: cap, role: "capMetal", group: "moving" }], motion: "lift", turns: 0, rise: 0, lift: h * 0.8, topY: yt };
    }
    case "PEEL_FOIL":
    case "EOE_RING": {
      // flat end over the whole mouth (follows the section); EOE adds a riveted ring pull
      const R = Math.max(r, radiusAt(p.outer as never, top - 0.5));
      const y = top + 0.15;
      const disc = lathe([{ r: R + 0.3, y: y - 0.5 }, { r: R + 0.3, y, round: 0.3 }, { r: 0, y }], { section: p.section });
      const parts: ClosurePart[] = [{ geometry: disc, role: style === "PEEL_FOIL" ? "capMetal" : "body", group: style === "PEEL_FOIL" ? "moving" : "static" }];
      if (style === "EOE_RING") {
        const rr = Math.max(6, Math.min(14, R * 0.22));
        const ring = new TorusGeometry(rr, 1, 10, 40);
        ring.rotateX(-Math.PI / 2);
        // ring towards the front edge, inside the end on rectangular / oval tins (half depth = R × depthRatio)
        const half = p.section.kind === "roundedRect" ? R * p.section.depthRatio : R;
        const z = Math.max(rr + 2, half * 0.55);
        ring.translate(0, y + 1.2, z);
        const rivet = new CylinderGeometry(1.6, 1.8, 0.8, 20);
        rivet.translate(0, y + 0.4, z - rr);
        parts.push({ geometry: ring, role: "body", group: "tab" }, { geometry: rivet, role: "body", group: "static" });
        return { parts, motion: "tab", turns: 0, rise: 0, lift: 0, pivot: [0, y + 1, z - rr], topY: y + 2.2 };
      }
      return { parts, motion: "lift", turns: 0, rise: 0, lift: 20, topY: y, printTopY: y };
    }
    case "PLUG_LID":
    case "LEVER_LID": {
      // plug sits inside the rim with a flange on top; lever lid adds the pry groove ring
      const R = Math.max(r, radiusAt(p.outer as never, top - 0.5));
      const y = top + 0.8;
      const pts: ControlPoint[] = [
        { r: R - 2.2, y: top - 6 },
        { r: R - 1.6, y: top - 6, round: 0.6 },
        { r: R - 1.6, y: top - 0.6 },
        { r: R + 0.6, y: top - 0.2, round: 0.4 },
        { r: R + 0.6, y, round: 0.5 },
      ];
      if (style === "LEVER_LID") pts.push({ r: R - 3, y }, { r: R - 4, y: y - 1.6, round: 0.5 }, { r: R - 5.4, y: y - 1.6, round: 0.5 }, { r: R - 6.4, y });
      pts.push({ r: 0, y });
      const lid = lathe(pts, { section: p.section });
      return { parts: [{ geometry: lid, role: "capMetal", group: "moving" }], motion: "lift", turns: 0, rise: 0, lift: 22, topY: y, printTopY: y };
    }
    case "SNAP_LID": {
      // thermoformed / moulded snap lid over the rim: short skirt, slightly domed top
      const R = Math.max(r, radiusAt(p.outer as never, top - 0.5)) + 0.8;
      const yb = top - 4;
      const yt = top + 3;
      const lid = lathe(
        [
          { r: R - 0.5, y: yb + 2 },
          { r: R - 0.5, y: yb, round: 0.2 },
          { r: R, y: yb + 0.4, round: 0.4 },
          { r: R, y: top + 1.2, round: 1 },
          // flat panel (the printed / embossed lid top), slight shoulder
          { r: R - 1.4, y: yt, round: 1.2 },
          { r: 0, y: yt },
        ],
        { section: p.section },
      );
      return { parts: [{ geometry: lid, role: "cap", group: "moving" }], motion: "lift", turns: 0, rise: 0, lift: 24, topY: yt, printTopY: yt };
    }
    case "HINGED_LID": {
      // clamshell: the lid is the tray's mirror, hinged at the back edge (opens with the lift motion's tilt)
      const R = Math.max(r, radiusAt(p.outer as never, top - 0.5)) + 0.6;
      const depth = Math.max(8, Math.min(30, top * 0.35));
      const yt = top + depth;
      const lid = lathe(
        [
          { r: R + 1.5, y: top },
          { r: R + 1.5, y: top + 1, round: 0.5 },
          { r: R, y: top + 1.5 },
          { r: R * 0.92, y: yt, round: 4 },
          { r: 0, y: yt },
        ],
        { section: p.section },
      );
      return { parts: [{ geometry: lid, role: "cap", group: "moving" }], motion: "lift", turns: 0, rise: 0, lift: depth * 0.8, topY: yt, printTopY: yt };
    }
    case "TWIST_UP": {
      // deodorant / balm stick: dome cap the full barrel width (follows an oval or rounded section)
      const R = Math.max(r, radiusAt(p.outer as never, top - 2)) + 0.6;
      const yb = top - 18;
      const yt = top + Math.max(8, R * 0.5);
      const lid = lathe(
        [
          { r: R - 0.5, y: yb + 2 },
          { r: R - 0.5, y: yb, round: 0.2 },
          { r: R, y: yb + 0.4, round: 0.4 },
          { r: R, y: top, round: 2 },
          { r: R * 0.6, y: yt, round: R * 0.4 },
          { r: 0, y: yt },
        ],
        { section: p.section },
      );
      return { parts: [{ geometry: lid, role: "cap", group: "moving" }], motion: "lift", turns: 0, rise: 0, lift: 30, topY: yt };
    }
    case "SWING_TOP": {
      // R5-3Q-F-06: ceramic / PP dome stopper on a red rubber ring, held by a wire bail: a neck
      // ring under the bead, two side levers and a loop over the stopper top
      const sr = r + 0.8;
      const ys = top + 1.6;
      const yt = ys + Math.max(9, r * 0.8);
      const stopper = lathe([
        { r: r * 0.55, y: top - 5 },
        { r: r * 0.62, y: ys - 0.2, round: 0.3 },
        { r: sr, y: ys, round: 0.8 },
        { r: sr, y: ys + 3, round: 1.5 },
        { r: sr * 0.62, y: yt, round: sr * 0.5 },
        { r: 0, y: yt },
      ]);
      const gasket = new TorusGeometry(r * 0.86, 0.95, 10, 48);
      gasket.rotateX(Math.PI / 2);
      gasket.translate(0, top + 0.5, 0);
      const neckY = top - Math.max(8, p.finishH * 0.75);
      const nr = Math.max(p.finishR, radiusAt(p.outer as never, neckY)) + 0.7;
      const ring = new TorusGeometry(nr, 0.8, 8, 48);
      ring.rotateX(Math.PI / 2);
      ring.translate(0, neckY, 0);
      const parts: ClosurePart[] = [
        { geometry: stopper, role: "cap", group: "moving" },
        { geometry: gasket, role: "gasket", group: "moving" },
        { geometry: ring, role: "wire", group: "static" },
      ];
      for (const sx of [-1, 1]) {
        // lever from the neck ring up past the stopper, then the bail over the top
        parts.push({
          geometry: wire([
            [sx * nr, neckY, 0],
            [sx * (nr + 1.2), neckY + (ys - neckY) * 0.55, 0],
            [sx * (sr + 1.4), ys + 1.5, 0],
          ]),
          role: "wire",
          group: "static",
        });
      }
      parts.push({
        geometry: wire([
          [-(sr + 1.4), ys + 1.5, 0],
          [-(sr * 0.7), yt + 0.4, 0],
          [0, yt + 0.9, 0],
          [sr * 0.7, yt + 0.4, 0],
          [sr + 1.4, ys + 1.5, 0],
        ]),
        role: "wire",
        group: "moving",
      });
      return { parts, motion: "lift", turns: 0, rise: 0, lift: 18, topY: yt + 1.7 };
    }
    case "MEASURE_CUP": {
      // R5-3Q-F-07: detergent dosing cup screwed over the spout, Ø 55–65 mm, 30–35 mm tall,
      // translucent PP with fill lines moulded round the side
      const R = r + 7;
      const yb = top - 12;
      const yt = top + 32;
      const cup = lathe(
        [
          { r: R - 1.4, y: yb + 4 },
          { r: R - 1.4, y: yb, round: 0.4 },
          { r: R, y: yb + 0.5, round: 0.6 },
          { r: R, y: yb + 1.6 },
          { r: R - 0.7, y: yb + 2.4 },
          { r: R - 0.7, y: yt - 2, round: 1.5 },
          { r: R - 2.4, y: yt, round: 1.4 },
          { r: 0, y: yt },
        ],
        { segments: 160, ribs: { count: 4, depth: 0.25, where: (ring) => ring.y > yb + 8 && ring.y < yt - 6 && Math.round(ring.y) % 6 === 0 } },
      );
      return { parts: [{ geometry: cup, role: "cap", group: "moving" }], motion: "unscrew", turns: 1.2, rise: 3, lift: 30, topY: yt };
    }
    case "FLIP_TOP_CAP": {
      // R5-3Q-F-08: 24/410 flip-top: base and lid split by the hinge line, a hinge at the back,
      // a thumb notch at the front and a dispensing orifice under the lid
      const R = r + 1.6;
      const yb = top - p.finishH - 0.6;
      const yt = top + 10;
      const seam = yt - 4.2;
      const body = lathe([
        { r: R - 1.1, y: yb + 5 },
        { r: R - 1.1, y: yb, round: 0.3 },
        { r: R, y: yb + 0.6, round: 0.5 },
        { r: R, y: seam - 0.4 },
        { r: R - 0.45, y: seam },
        { r: R, y: seam + 0.4 },
        { r: R, y: yt - 1.4, round: 1.4 },
        { r: R - 1.6, y: yt, round: 1 },
        { r: 0, y: yt },
      ]);
      const hinge = new BoxGeometry(R * 0.7, 3.2, 1.6);
      hinge.translate(0, seam, -R - 0.4);
      const notch = new BoxGeometry(R * 0.5, 1.4, 1.2);
      notch.translate(0, seam + 1.2, R + 0.2);
      return {
        parts: [
          { geometry: body, role: "cap", group: "moving" },
          { geometry: hinge, role: "cap", group: "moving" },
          { geometry: notch, role: "cap", group: "moving" },
        ],
        motion: "unscrew",
        turns: 2,
        rise: Math.min(6, p.finishH * 0.45),
        lift: 26,
        topY: yt,
      };
    }
    case "CR_CAP":
    case "TE_CAP": {
      // R5-3Q-F-09 / G-07: ISO 8317 push-and-turn double shell, wider and taller than a plain
      // cap, with a TE band; R5-3Q-F-10: tamper-evident screw caps show the band under the skirt
      const cr = style === "CR_CAP";
      const { geometry, yt } = screwCap(p, [], cr ? { extraR: 2.5, extraTop: 2, te: true, ribs: 36 } : { te: true });
      return { parts: [{ geometry, role: "cap", group: "moving" }], motion: "unscrew", turns: 2, rise: Math.min(6, p.finishH * 0.45), lift: 26, topY: yt };
    }
    case "BAR_TOP": {
      // R5-3Q-F-11: T-cork: a Ø 30 × 16 mm head (wood / PP) on a cork shank in the neck
      const R = Math.max(15, r + 4);
      const y0 = top + 0.4;
      const yt = y0 + 16;
      const head = lathe([
        { r: r * 0.92, y: top - 2 },
        { r: r * 0.92, y: y0 },
        { r: R - 1.5, y: y0, round: 0.6 },
        { r: R, y: y0 + 2, round: 1.5 },
        { r: R, y: yt - 2.5, round: 2.2 },
        { r: R - 2.5, y: yt, round: 2 },
        { r: 0, y: yt },
      ]);
      return { parts: [{ geometry: head, role: "cap", group: "moving" }], motion: "lift", turns: 0, rise: 0, lift: 34, topY: yt };
    }
    case "MIST_COLLAR": {
      // R5-3Q-G-06: the mist pump with a metal collar sleeved over the crimp ferrule and the neck
      const base = buildClosure("PERFUME_SQUARE", "MIST_PUMP", { D: 2 * bodyR(p, top), H: top }, p);
      const neck = Math.max(6, Math.min(neckLength(p), 14));
      const cr = r + 2.6;
      const collar = lathe([
        { r: cr - 0.8, y: top - neck + 2 },
        { r: cr - 0.8, y: top - neck, round: 0.3 },
        { r: cr, y: top - neck + 0.5, round: 0.5 },
        { r: cr, y: top - 1.2, round: 1 },
        { r: r + 0.9, y: top, round: 0.6 },
        { r: r + 0.4, y: top },
      ]);
      return { ...base, parts: [...base.parts, { geometry: collar, role: "capMetal", group: "static" }] };
    }
    case "DROPPER_TIP": {
      // R5-3Q-G-14: LDPE dropper nozzle in the neck, a tall pointed cap over it
      const nozzle = lathe([
        { r: r * 0.92, y: top - 1 },
        { r: r * 0.92, y: top + 1, round: 0.5 },
        { r: r * 0.55, y: top + 3, round: 0.8 },
        { r: 1.4, y: top + 11, round: 0.5 },
        { r: 0.6, y: top + 11.6 },
        { r: 0, y: top + 11.6 },
      ]);
      const R = r + 1.6;
      const yb = top - p.finishH - 0.6;
      const yt = top + 15;
      const cap = lathe(
        [
          { r: R - 1, y: yb + 5 },
          { r: R - 1, y: yb, round: 0.3 },
          { r: R, y: yb + 0.6, round: 0.5 },
          { r: R, y: top + 2 },
          { r: R * 0.5, y: yt - 1.5, round: 1.5 },
          { r: R * 0.32, y: yt, round: 1 },
          { r: 0, y: yt },
        ],
        { segments: 180, ribs: { count: 30, depth: 0.35, where: (ring) => ring.y > yb + 1.5 && ring.y < top + 1.5 && ring.r > R - 0.05 } },
      );
      return {
        parts: [
          { geometry: nozzle, role: "pipette", group: "static" },
          { geometry: cap, role: "cap", group: "moving" },
        ],
        motion: "unscrew",
        turns: 1.5,
        rise: 3,
        lift: 26,
        topY: yt,
      };
    }
    case "AEROSOL": {
      // R5-3Q-G-04 (remainder): stem and spray actuator on the 1 in valve cup
      const stem = new CylinderGeometry(1.6, 1.6, 5, 16);
      stem.translate(0, top + 2.5, 0);
      const ar = Math.max(9, Math.min(13, r * 0.7));
      const ah = 13;
      const y0 = top + 4;
      const act = lathe([
        { r: ar - 0.6, y: y0 },
        { r: ar, y: y0 + 0.8, round: 0.5 },
        { r: ar, y: y0 + ah - 3, round: 2.5 },
        { r: ar * 0.55, y: y0 + ah, round: 2 },
        { r: 0, y: y0 + ah },
      ]);
      const finger = new BoxGeometry(ar * 1.1, 0.6, ar * 0.9);
      finger.rotateX(-0.25);
      finger.translate(0, y0 + ah - 0.4, -ar * 0.15);
      const orifice = new CylinderGeometry(0.8, 0.8, 0.4, 16);
      orifice.rotateX(Math.PI / 2);
      orifice.translate(0, y0 + ah * 0.55, ar + 0.05);
      return {
        parts: [
          { geometry: stem, role: "cap", group: "static" },
          { geometry: act, role: "cap", group: "static" },
          { geometry: finger, role: "cap", group: "static" },
          { geometry: orifice, role: "dark", group: "static" },
        ],
        motion: "none",
        turns: 0,
        rise: 0,
        lift: 0,
        topY: y0 + ah,
      };
    }
    case "CRIMP_FLIP_OFF": {
      // R5-3Q-G-08 (remainder): aluminium crimp seal over the stopper, a plastic flip-off button on top
      const yb = top - Math.max(4, p.finishH * 0.8);
      const yt = top + 1.2;
      const crimp = lathe([
        { r: r - 0.2, y: yb },
        { r: r + 0.4, y: yb + 0.6, round: 0.3 },
        { r: r + 0.4, y: yt - 0.6, round: 0.6 },
        { r: r - 1.2, y: yt, round: 0.4 },
        { r: r * 0.5, y: yt },
      ]);
      const button = lathe([
        { r: r * 0.5, y: yt - 0.3 },
        // R6-3Q-G-05: the flip-off button is the crimp's own diameter
        { r: r + 0.35, y: yt + 0.2, round: 0.4 },
        { r: r + 0.35, y: yt + 2.6, round: 1 },
        { r: 0, y: yt + 2.8 },
      ]);
      return {
        parts: [
          { geometry: crimp, role: "body", group: "static" },
          { geometry: button, role: "cap", group: "moving" },
        ],
        motion: "lift",
        turns: 0,
        rise: 0,
        lift: 14,
        topY: yt + 2.8,
      };
    }
    case "DOUBLE_WALL_CAP": {
      // R5-3Q-G-11: the cap of a double-wall jar is flush with the OUTER wall, not the inner
      // pot's thread (it overhung the neck and stopped short of the jar edge)
      const R = Math.max(r + 1.5, bodyR(p, top - 1) + 0.2);
      const yb = top - Math.max(p.finishH, 6) - 0.4;
      const yt = top + 3.2;
      const cap = lathe([
        { r: R - 1.2, y: yb + 4 },
        { r: R - 1.2, y: yb, round: 0.3 },
        { r: R, y: yb + 0.6, round: 0.5 },
        { r: R, y: yt - 1.6, round: 1.6 },
        { r: R - 1.6, y: yt, round: 1.2 },
        { r: 0, y: yt },
      ]);
      return { parts: [{ geometry: cap, role: "cap", group: "moving" }], motion: "unscrew", turns: 1.5, rise: 2.5, lift: 26, topY: yt, printTopY: yt };
    }
    case "TREATMENT_PUMP": {
      // R6-3Q-G-04: serum / treatment pump: a short ribbed collar, a Ø ≤ 16 mm actuator with a
      // short spout (≤ 8 mm) and a clear overcap just wider than the finish
      const cr = r + 0.8;
      const yb = top - p.finishH - 0.4;
      const yc = top + 1.2;
      const collar = lathe(
        [
          { r: cr - 0.8, y: yb + 3 },
          { r: cr - 0.8, y: yb, round: 0.3 },
          { r: cr, y: yb + 0.4, round: 0.4 },
          { r: cr, y: yc - 0.6, round: 0.6 },
          { r: Math.min(cr - 0.8, 3.2), y: yc },
          { r: 2, y: yc },
          { r: 2, y: yc + 2.5 },
          { r: 0, y: yc + 2.5 },
        ],
        { segments: 120, ribs: { count: 30, depth: 0.3, where: (ring) => ring.y > yb + 0.8 && ring.y < yc - 0.8 && ring.r > cr - 0.05 } },
      );
      const or = r + 1.5;
      // the actuator and its spout fit under the overcap (r + 1.5): a short spout on a narrow neck
      const hr = Math.min(8, Math.max(3.5, r), or - 3);
      const h0 = yc + 2;
      const head = lathe([
        { r: 0, y: h0 },
        { r: hr, y: h0, round: 0.8 },
        { r: hr, y: h0 + 7, round: 1.6 },
        { r: 0, y: h0 + 7.4 },
      ]);
      const sl = Math.max(2, Math.min(8, hr * 0.9, or - 0.8 - hr + 1));
      const spout = new CylinderGeometry(1.3, 1.5, sl, 16);
      spout.rotateX(Math.PI / 2);
      spout.translate(0, h0 + 4.5, hr + sl / 2 - 1);
      const orifice = new CylinderGeometry(0.6, 0.6, 0.3, 12);
      orifice.rotateX(Math.PI / 2);
      orifice.translate(0, h0 + 4.5, hr + sl - 0.9);
      const ob = yb + 0.5;
      const ot = h0 + 7.4 + 2.5;
      const overcap = lathe([
        { r: or - 0.6, y: ob + 3 },
        { r: or - 0.6, y: ob, round: 0.2 },
        { r: or, y: ob + 0.3, round: 0.3 },
        { r: or, y: ob + 4, round: 2 },
        { r: or, y: ot - 1.5, round: 1.5 },
        { r: 0, y: ot },
      ]);
      return {
        parts: [
          { geometry: collar, role: "cap", group: "static" },
          { geometry: head, role: "cap", group: "static" },
          { geometry: spout, role: "cap", group: "static" },
          { geometry: orifice, role: "dark", group: "static" },
          { geometry: overcap, role: "clear", group: "moving" },
        ],
        motion: "lift",
        turns: 0,
        rise: 0,
        lift: 30,
        topY: ot,
      };
    }
    case "PIERCING":
      // drawn in buildClosure (tube coordinates)
      return { parts: [], motion: "none", turns: 0, rise: 0, lift: 0, topY: top };
    case "SPARKLING": {
      // R6-3Q-F-08: the hood runs ~28 % of the bottle down the neck, 45–85 mm (a piccolo's foil is
      // ~50 mm; a fixed 85 mm reached the label on small bottles)
      const foil = neckSleeve(p, Math.min(85, Math.max(45, 0.28 * top)), 0.4, top);
      const mr = r + 2;
      const yt = top + 24;
      const g = lathe([
        ...foil,
        { r: r + 0.6, y: top + 6 },
        { r: mr, y: top + 10, round: 2 },
        { r: mr, y: yt - 5, round: 3 },
        { r: mr * 0.55, y: yt, round: 2 },
        { r: 0, y: yt },
      ]);
      // wire cage ring at the lip
      const cage = lathe([
        { r: r + 1.1, y: top - 2 },
        { r: r + 1.5, y: top - 1.4, round: 0.3 },
        { r: r + 1.1, y: top - 0.8 },
      ]);
      return {
        parts: [
          { geometry: g, role: "capMetal", group: "moving" },
          { geometry: cage, role: "dark", group: "moving" },
        ],
        motion: "lift",
        turns: 0,
        rise: 0,
        lift: 34,
        topY: yt,
      };
    }
  }
}

/** Closure (and its open motion) for a container. Geometry in mm, container coordinates. */
export function buildClosure(kind: VesselKind, closure: ClosureKind, dims: VesselDims, profile: VesselProfile, style?: ClosureStyle | null): ClosureModel {
  // A faceted (hex) glass jar still has a round thread finish: its lug lid / cap is round (R4-V01).
  const p: VesselProfile = profile.section.kind === "polygon" ? { ...profile, section: { kind: "round" } } : profile;
  // bottle-neck styles replace a screw-cap core (the core the library collapses them to)
  if (style && (CLOSURE_STYLES as readonly string[]).includes(style)) {
    if (TUBE_STYLES.includes(style)) {
      if (kind === "SQUEEZE_TUBE") return piercingTubeCap(dims);
    } else if (MOUTH_STYLES.includes(style)) return styledClosure(style, p);
    else if (p.finishR > 0 && closure !== "CAN_END" && closure !== "SLIP_LID" && closure !== "LUG_LID") return styledClosure(style, p);
  }
  const top = p.finishTopY;
  switch (closure) {
    case "SCREW_CAP": {
      const { geometry, yt } = screwCap(p);
      return { parts: [{ geometry, role: "cap", group: "moving" }], motion: "unscrew", turns: 2, rise: Math.min(6, p.finishH * 0.45), lift: 26, topY: yt };
    }
    case "SPORTS_CAP": {
      const r = p.finishR + 1.5;
      const yt0 = top + 2.8;
      const { geometry, yt } = screwCap(p, [
        { r: r - 1.6, y: yt0, round: 0.6 },
        { r: 9, y: yt0, round: 0.8 },
        { r: 9, y: yt0 + 5, round: 1.2 },
        { r: 6.4, y: yt0 + 7, round: 1 },
        { r: 6.4, y: yt0 + 13.6, round: 1.2 },
        { r: 2.6, y: yt0 + 14.2, round: 0.5 },
        { r: 0, y: yt0 + 14.2 },
      ]);
      return { parts: [{ geometry, role: "cap", group: "moving" }], motion: "unscrew", turns: 2, rise: Math.min(6, p.finishH * 0.45), lift: 26, topY: yt + 14.2 };
    }
    case "DROPPER": {
      // R6-3Q-G-06: the ribbed collar never wider than the bottle (a 5 ml DIN 18 bottle, D 19)
      const r = Math.min(p.finishR + 1.7, Math.max(p.finishR + 0.6, bodyR(p, top - p.finishH) - 0.65)); // ribs add 0.45
      const yb = top - p.finishH - 0.6;
      const yt = top + 2.4;
      const collar = lathe(
        [
          { r: r - 1, y: yb + 5 },
          { r: r - 1, y: yb, round: 0.3 },
          { r, y: yb + 0.4, round: 0.5 },
          { r, y: yt - 0.8, round: 0.8 },
          { r: r - 1.2, y: yt, round: 0.5 },
          { r: 0, y: yt },
        ],
        { segments: 180, ribs: { count: 40, depth: 0.45, where: (ring) => ring.y > yb + 1 && ring.y < yt - 1.2 && ring.r > r - 0.05 } },
      );
      const rb = p.finishR * 0.62;
      const bulb = lathe([
        { r: rb + 0.8, y: yt - 0.2 },
        { r: rb + 0.8, y: yt + 1.6, round: 0.6 },
        { r: rb, y: yt + 2.6, round: 1 },
        { r: rb * 1.14, y: yt + 10, round: 4 },
        { r: rb * 1.08, y: yt + 18, round: 4 },
        { r: rb * 0.6, y: yt + 25, round: 3 },
        { r: 0, y: yt + 26 },
      ]);
      const tipY = p.baseMm + 5;
      const pipette = lathe(
        [
          { r: 0, y: tipY },
          { r: 0.7, y: tipY, round: 0.3 },
          { r: 2.5, y: tipY + 9, round: 1 },
          { r: 2.9, y: tipY + 12 },
          { r: 2.9, y: top - 1 },
          { r: 0, y: top - 1 },
        ],
        { segments: 32 },
      );
      return {
        parts: [
          { geometry: collar, role: "capMetal", group: "moving" },
          { geometry: bulb, role: "rubber", group: "moving" },
          { geometry: pipette, role: "pipette", group: "moving" },
        ],
        motion: "unscrew",
        turns: 1.5,
        rise: 4,
        lift: Math.max(30, top - tipY + 6),
        topY: yt + 26,
      };
    }
    case "LOTION_PUMP": {
      const r = p.finishR + 1.9;
      const yb = top - p.finishH - 0.4;
      const yt = top + 1.5;
      const collar = lathe(
        [
          { r: r - 1, y: yb + 5 },
          { r: r - 1, y: yb, round: 0.3 },
          { r, y: yb + 0.4, round: 0.5 },
          { r, y: yt - 0.8, round: 0.8 },
          { r: 5, y: yt, round: 0.6 },
          { r: 3.6, y: yt + 0.8, round: 0.4 },
          { r: 3.6, y: yt + 14 },
          { r: 0, y: yt + 14 },
        ],
        { segments: 180, ribs: { count: 44, depth: 0.45, where: (ring) => ring.y > yb + 1 && ring.y < yt - 1.2 && ring.r > r - 0.05 } },
      );
      const head = lathe([
        { r: 0, y: yt + 13 },
        { r: 10.5, y: yt + 13, round: 1.6 },
        { r: 11.2, y: yt + 20, round: 2.5 },
        { r: 9.5, y: yt + 25.5, round: 3 },
        { r: 0, y: yt + 26 },
      ]);
      const nozzle = new CylinderGeometry(2.3, 2.5, 18, 24, 1, false);
      nozzle.rotateX(Math.PI / 2);
      nozzle.translate(0, yt + 21.5, 17);
      const orifice = new CylinderGeometry(1.1, 1.1, 0.4, 16);
      orifice.rotateX(Math.PI / 2);
      orifice.translate(0, yt + 21.5, 26.1);
      return {
        parts: [
          { geometry: collar, role: "cap", group: "moving" },
          { geometry: head, role: "cap", group: "moving" },
          { geometry: nozzle, role: "cap", group: "moving" },
          { geometry: orifice, role: "dark", group: "moving" },
        ],
        motion: "unscrew",
        turns: 1.5,
        rise: 4,
        lift: 30,
        topY: yt + 26,
      };
    }
    case "MIST_PUMP": {
      const r = p.finishR + 0.8;
      const yb = top - 5.2;
      const yt = top + 2.2;
      const ferrule = lathe([
        { r: r + 0.6, y: yb },
        { r, y: yb + 1.2, round: 0.6 },
        { r, y: yt - 0.6, round: 0.6 },
        { r: 3.2, y: yt, round: 0.4 },
        { r: 2.4, y: yt },
        { r: 2.4, y: yt + 3 },
        { r: 6.2, y: yt + 3, round: 0.5 },
        { r: 6.2, y: yt + 12, round: 1.2 },
        { r: 0, y: yt + 12.4 },
      ]);
      const orifice = new CylinderGeometry(0.75, 0.75, 0.3, 16);
      orifice.rotateX(Math.PI / 2);
      orifice.translate(0, yt + 9, 6.25);
      const capR = Math.min((dims.D / 2) * 0.66, 15);
      const cb = top - p.finishH - 2.4;
      const ct = yt + 16;
      const overcap = lathe([
        { r: capR - 1.2, y: cb + 6 },
        { r: capR - 1.2, y: cb, round: 0.4 },
        { r: capR, y: cb + 0.6, round: 0.6 },
        { r: capR, y: ct - 2.5, round: 2.5 },
        { r: capR - 2.5, y: ct, round: 2 },
        { r: 0, y: ct },
      ]);
      return {
        parts: [
          { geometry: ferrule, role: "capMetal", group: "static" },
          { geometry: orifice, role: "dark", group: "static" },
          { geometry: overcap, role: "cap", group: "moving" },
        ],
        motion: "lift",
        turns: 0,
        rise: 0,
        lift: 34,
        topY: ct,
      };
    }
    case "LUG_LID": {
      // R6-3Q-F-06: twist-off sizes are the lid's own diameter (a TO 70 lid is ~70–72 mm): the
      // shell sits 0.4 mm outside the finish, plus the 0.5 mm curl (it was 1.6 + 0.5 mm a side)
      const r = p.finishR + 0.4;
      const yb = top - p.finishH + 0.5;
      const yt = top + 1.6;
      const lid = lathe([
        { r: r - 1, y: yb + 3 },
        { r: r - 1, y: yb, round: 0.3 },
        { r: r + 0.5, y: yb + 0.4, round: 0.6 },
        { r: r + 0.5, y: yb + 1.3, round: 0.4 },
        { r, y: yb + 1.8, round: 0.4 },
        { r, y: yt - 1.4, round: 1.4 },
        { r: r - 1.6, y: yt, round: 1 },
        { r: 0, y: yt },
      ], { section: p.section });
      // a square / rectangular rim cannot be unscrewed: its lid lifts straight off
      const round = p.section.kind === "round";
      return { parts: [{ geometry: lid, role: "capMetal", group: "moving" }], motion: round ? "unscrew" : "lift", turns: round ? 0.3 : 0, rise: round ? 2.5 : 0, lift: 24, topY: yt };
    }
    case "SLIP_LID": {
      const R = dims.D / 2;
      const rl = R + 0.6;
      const yt = dims.H + 0.6;
      const yb = dims.H - tinLidHeight(dims);
      const lid = lathe([
        { r: rl - 0.4, y: yb + 4 },
        { r: rl - 0.4, y: yb, round: 0.3 },
        { r: rl + 0.3, y: yb + 0.4, round: 0.5 },
        { r: rl, y: yb + 1, round: 0.4 },
        { r: rl, y: yt - 1.2, round: 1.2 },
        { r: rl - 1.4, y: yt, round: 0.8 },
        { r: 0, y: yt },
      ], { section: p.section });
      return { parts: [{ geometry: lid, role: "capMetal", group: "moving" }], motion: "lift", turns: 0, rise: 0, lift: Math.max(24, tinLidHeight(dims) + 14), topY: yt };
    }
    case "CAN_END": {
      const panelY = top - 5.3 + 0.35;
      // tab and opening are drawn for a 202 (Ø52 mm panel, r ≈ 27) end: scale to this end
      const k = Math.max(0.55, Math.min(2.4, p.finishR / 27));
      const tab = new Shape();
      const w = 6.2;
      const back = -8.5;
      const front = 13.5;
      const cr = 4.6;
      tab.moveTo(-w + cr, back);
      tab.lineTo(w - cr, back);
      tab.quadraticCurveTo(w, back, w, back + cr);
      tab.lineTo(w * 0.86, front - cr);
      tab.quadraticCurveTo(w * 0.8, front, 0, front);
      tab.quadraticCurveTo(-w * 0.8, front, -w * 0.86, front - cr);
      tab.lineTo(-w, back + cr);
      tab.quadraticCurveTo(-w, back, -w + cr, back);
      const hole = new Shape();
      hole.absellipse(0, back + 4.2, 3.6, 2.6, 0, Math.PI * 2, false, 0);
      tab.holes.push(hole);
      const tabGeo = new ExtrudeGeometry(tab, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.22, bevelSegments: 2, curveSegments: 24 });
      tabGeo.rotateX(-Math.PI / 2);
      tabGeo.scale(k, 1, k);
      tabGeo.translate(0, panelY, 0);
      const rivet = new CylinderGeometry(1.5 * k, 1.7 * k, 0.7, 24);
      rivet.translate(0, panelY + 0.35, 0);
      const opening = new Shape();
      opening.moveTo(-7, 4);
      opening.quadraticCurveTo(0, 2, 7, 4);
      opening.quadraticCurveTo(9.5, 14, 0, 18.5);
      opening.quadraticCurveTo(-9.5, 14, -7, 4);
      const openGeo = new ShapeGeometry(opening, 24);
      openGeo.rotateX(-Math.PI / 2);
      openGeo.scale(k, 1, k);
      openGeo.translate(0, top - 5.3 + 0.03, 0);
      return {
        parts: [
          // pull tabs are plain aluminium whatever the cap colour (E-05)
          { geometry: tabGeo, role: "body", group: "tab" },
          { geometry: rivet, role: "body", group: "static" },
          { geometry: openGeo, role: "dark", group: "static" },
        ],
        motion: "tab",
        turns: 0,
        rise: 0,
        lift: 0,
        pivot: [0, panelY + 0.4, 1.5 * k],
        topY: top,
      };
    }
    case "FLIP_TOP":
    case "SCREW_TUBE_CAP": {
      const t = tubeDims(dims);
      const flip = closure === "FLIP_TOP";
      const cr = flip ? t.capR : t.capR * 0.74;
      const seam = t.capH * 0.32;
      const pts: ControlPoint[] = [
        { r: 0, y: 0 },
        { r: cr - 1.6, y: 0, round: 1 },
        { r: cr, y: 1.4, round: 1 },
        ...(flip
          ? [
              { r: cr, y: seam - 0.5 },
              { r: cr - 0.4, y: seam },
              { r: cr, y: seam + 0.5 },
            ]
          : []),
        { r: cr, y: t.capH - 0.8, round: 0.8 },
        { r: t.nozzleR + 0.5, y: t.capH, round: 0.5 },
        { r: 0, y: t.capH },
      ];
      const cap = lathe(pts, flip ? {} : { segments: 180, ribs: { count: 48, depth: 0.4, where: (ring) => ring.y > 2 && ring.y < t.capH - 1.5 } });
      const parts: ClosurePart[] = [{ geometry: cap, role: "cap", group: "static" }];
      if (flip) {
        // R5-3Q-F-14: a flip-top reads as one: hinge strap at the back across the lid line, a
        // thumb lip at the front (the screw cap is a slim fluted cylinder with a shoulder disc)
        const hinge = new BoxGeometry(cr * 0.55, 4, 1.4);
        hinge.translate(0, seam, -cr - 0.3);
        const lip = new BoxGeometry(cr * 0.45, 1.2, 1.4);
        lip.translate(0, seam - 1, cr + 0.2);
        parts.push({ geometry: hinge, role: "cap", group: "static" }, { geometry: lip, role: "cap", group: "static" });
      }
      if (!flip) {
        // shoulder disc between the slim screw cap and the round tube
        const disc = lathe([
          { r: 0, y: t.capH - 0.01 },
          { r: t.R, y: t.capH - 0.01 },
        ]);
        parts.push({ geometry: disc, role: "body", group: "static" });
      }
      return { parts, motion: "none", turns: 0, rise: 0, lift: 0, topY: t.totalH };
    }
    case "ZIP_SEAL":
    default:
      return { parts: [], motion: "none", turns: 0, rise: 0, lift: 0, topY: kind === "STAND_UP_POUCH" ? dims.H : top };
  }
}

/**
 * R5-3Q-G-10: pharma / aluminium tube piercing cap: a tall, slim fluted cap (the tube stands on it)
 * with the piercing spike moulded in its crown, visible as a cone in the recessed end.
 */
function piercingTubeCap(dims: VesselDims): ClosureModel {
  const t = tubeDims(dims);
  const cr = Math.max(t.nozzleR + 2.5, t.capR * 0.62);
  const h = t.capH;
  const cap = lathe(
    [
      { r: cr * 0.55, y: 1.2 },
      { r: cr * 0.75, y: 0, round: 0.4 },
      { r: cr, y: 0.8, round: 0.8 },
      { r: cr, y: h - 2.4 },
      { r: cr * 0.82, y: h - 0.6, round: 0.6 },
      { r: 0, y: h - 0.6 },
    ],
    { segments: 180, ribs: { count: 24, depth: 0.55, where: (ring) => ring.y > 2 && ring.y < h - 3 && ring.r > cr - 0.05 } },
  );
  const spike = new ConeGeometry(cr * 0.3, 3.2, 20);
  spike.rotateX(Math.PI);
  spike.translate(0, 1.2 + 1.6, 0);
  const disc = lathe([
    { r: 0, y: h - 0.01 },
    { r: t.R, y: h - 0.01 },
  ]);
  return {
    parts: [
      { geometry: cap, role: "cap", group: "static" },
      { geometry: spike, role: "cap", group: "static" },
      { geometry: disc, role: "body", group: "static" },
    ],
    motion: "none",
    turns: 0,
    rise: 0,
    lift: 0,
    topY: t.totalH,
  };
}
