import { CylinderGeometry, ExtrudeGeometry, Shape, ShapeGeometry, SphereGeometry, TorusGeometry, type BufferGeometry } from "three";
import { radiusAt, roundCorners, tubeDims, tinLidHeight, type ClosureKind, type ControlPoint, type VesselDims, type VesselKind, type VesselProfile } from "@/lib/vessels";
import { revolve, ringsFromPoints, type Ring } from "./geometry";

/** What a part is made of (the model maps roles to materials). */
export type PartRole = "cap" | "capMetal" | "rubber" | "pipette" | "dark" | "body";

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
}

const lathe = (pts: ControlPoint[], opts: { segments?: number; ribs?: { count: number; depth: number; where: (r: Ring) => boolean }; section?: VesselProfile["section"] } = {}) =>
  revolve(ringsFromPoints(roundCorners(pts, 5)), { segments: opts.segments ?? 96, ribs: opts.ribs, section: opts.section });

/** Ribbed screw cap over a finish. */
function screwCap(p: VesselProfile, extraTop: ControlPoint[] = []): { geometry: BufferGeometry; yt: number } {
  const top = p.finishTopY;
  const r = p.finishR + 1.5;
  const yb = top - p.finishH - 0.6;
  const yt = top + 2.8;
  const pts: ControlPoint[] = [
    { r: r - 1.1, y: yb + 6 },
    { r: r - 1.1, y: yb, round: 0.3 },
    { r: r - 0.2, y: yb, round: 0.3 },
    { r, y: yb + 0.7, round: 0.3 },
    { r, y: yb + 2.2 },
    { r: r - 0.45, y: yb + 2.6 },
    { r, y: yb + 3.0 },
    { r, y: yt - 1.2, round: 1.2 },
    { r: r - 0.9, y: yt, round: 0.8 },
    ...(extraTop.length ? extraTop : [{ r: 0, y: yt }]),
  ];
  const ribTop = yt - 1.6;
  const geometry = lathe(pts, { segments: 240, ribs: { count: 72, depth: 0.32, where: (ring) => ring.y > yb + 3.4 && ring.y < ribTop && ring.r > r - 0.05 } });
  return { geometry, yt };
}

/**
 * Closure styles the core kinds cannot express (X-01): a bottle can carry them instead of its
 * core closure. Real references: 26 mm crown (ISO 12821, fluted steel, ~6 mm tall), ROPP
 * aluminium (knurled top band, long plain skirt with a perforated pilfer ring), wine cork under a
 * 40–60 mm foil capsule, sparkling mushroom cork under foil + wire hood, ROPP pourer with spout.
 */
export const CLOSURE_STYLES = ["CROWN", "ROPP", "CORK_CAPSULE", "SPARKLING", "POURER", "ROLL_ON_BALL", "AIRLESS_PUMP", "BULLET_CAP", "PEEL_FOIL", "EOE_RING"] as const;
/** Styles that close the whole mouth of a can / tub / tray (allowed over lid and can-end cores). */
const MOUTH_STYLES: readonly string[] = ["PEEL_FOIL", "EOE_RING"];
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
      const yb = top - 18;
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
      const sleeve = neckSleeve(p, 48, 0.35, top);
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
      const R = Math.max(r + 1, radiusAt(p.outer as never, top - 2) + 0.4);
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
        ring.translate(0, y + 1.2, R * 0.55);
        const rivet = new CylinderGeometry(1.6, 1.8, 0.8, 20);
        rivet.translate(0, y + 0.4, R * 0.55 - rr);
        parts.push({ geometry: ring, role: "body", group: "tab" }, { geometry: rivet, role: "body", group: "static" });
        return { parts, motion: "tab", turns: 0, rise: 0, lift: 0, pivot: [0, y + 1, R * 0.55 - rr], topY: y + 2.2 };
      }
      return { parts, motion: "lift", turns: 0, rise: 0, lift: 20, topY: y };
    }
    case "SPARKLING": {
      const foil = neckSleeve(p, 85, 0.4, top);
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
export function buildClosure(kind: VesselKind, closure: ClosureKind, dims: VesselDims, p: VesselProfile, style?: ClosureStyle | null): ClosureModel {
  // bottle-neck styles replace a screw-cap core (the core the library collapses them to)
  if (style && (CLOSURE_STYLES as readonly string[]).includes(style)) {
    if (MOUTH_STYLES.includes(style)) return styledClosure(style, p);
    if (p.finishR > 0 && closure !== "CAN_END" && closure !== "SLIP_LID" && closure !== "LUG_LID") return styledClosure(style, p);
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
      const r = p.finishR + 1.7;
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
      const r = p.finishR + 1.6;
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
